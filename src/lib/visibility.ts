import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

type VisibilityCallback = (visible: boolean) => void
type ObserverGroup = { observer: IntersectionObserver; targets: Map<Element, Set<VisibilityCallback>> }
const observers = new Map<string, ObserverGroup>()

// All emoji/covers share observers, including inside the app's nested scrollers.
function observeVisibility(element: Element, callback: VisibilityCallback, rootMargin: string) {
  if (typeof IntersectionObserver === 'undefined') {
    callback(true)
    return () => {}
  }
  let group = observers.get(rootMargin)
  if (!group) {
    const targets = new Map<Element, Set<VisibilityCallback>>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        targets.get(entry.target)?.forEach((notify) => notify(entry.isIntersecting))
      }
    }, { rootMargin })
    group = { observer, targets }
    observers.set(rootMargin, group)
  }
  const { observer, targets } = group
  let callbacks = targets.get(element)
  if (!callbacks) {
    callbacks = new Set()
    targets.set(element, callbacks)
    observer.observe(element)
  }
  callbacks.add(callback)
  return () => {
    callbacks.delete(callback)
    if (!callbacks.size) {
      targets.delete(element)
      observer.unobserve(element)
    }
    if (!targets.size) {
      observer.disconnect()
      observers.delete(rootMargin)
    }
  }
}

export function useElementVisible<T extends Element>(ref: RefObject<T | null>, enabled = true, rootMargin = '0px') {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(false)
    if (!enabled || !ref.current) return
    return observeVisibility(ref.current, setVisible, rootMargin)
  }, [enabled, ref, rootMargin])
  return enabled && visible
}

const documentSubscribers = new Set<() => void>()
const notifyDocumentVisibility = () => documentSubscribers.forEach((notify) => notify())
function subscribeDocumentVisibility(notify: () => void) {
  if (!documentSubscribers.size) document.addEventListener('visibilitychange', notifyDocumentVisibility)
  documentSubscribers.add(notify)
  return () => {
    documentSubscribers.delete(notify)
    if (!documentSubscribers.size) document.removeEventListener('visibilitychange', notifyDocumentVisibility)
  }
}
const noSubscription = () => () => {}
const documentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
const serverVisible = () => true

export function useDocumentVisible(enabled = true) {
  return useSyncExternalStore(enabled ? subscribeDocumentVisibility : noSubscription, documentVisible, serverVisible)
}

let motionQuery: MediaQueryList | undefined
const motionSubscribers = new Set<() => void>()
const notifyMotionPreference = () => motionSubscribers.forEach((notify) => notify())
function reducedMotionQuery() {
  if (!motionQuery && typeof window !== 'undefined' && window.matchMedia) {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  }
  return motionQuery
}
function subscribeMotionPreference(notify: () => void) {
  const query = reducedMotionQuery()
  if (!motionSubscribers.size) query?.addEventListener('change', notifyMotionPreference)
  motionSubscribers.add(notify)
  return () => {
    motionSubscribers.delete(notify)
    if (!motionSubscribers.size) query?.removeEventListener('change', notifyMotionPreference)
  }
}
const prefersReducedMotion = () => reducedMotionQuery()?.matches ?? false
const serverReducedMotion = () => false

export function usePrefersReducedMotion(enabled = true) {
  return useSyncExternalStore(enabled ? subscribeMotionPreference : noSubscription, prefersReducedMotion, serverReducedMotion)
}
