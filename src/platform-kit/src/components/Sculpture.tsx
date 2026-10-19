import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/** Original procedural 3D artwork. All materials follow the brand tokens. */
export default function Sculpture({
  color = '#245BFF',
  accent = '#C5F277',
  variant = 'orbit',
  reduced: forcedReduced = false,
}: {
  color?: string
  accent?: string
  variant?: string
  reduced?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100)
    camera.position.z = 8
    const group = new THREE.Group()
    scene.add(group)
    scene.add(new THREE.AmbientLight(0xffffff, 2.5))
    const light = new THREE.DirectionalLight(0xffffff, 7)
    light.position.set(3, 4, 5)
    scene.add(light)
    const rim = new THREE.PointLight(accent, 25, 15)
    rim.position.set(-3, -2, 3)
    scene.add(rim)
    const blue = new THREE.PointLight(color, 20, 15)
    blue.position.set(4, 1, -2)
    scene.add(blue)
    const envCanvas = document.createElement('canvas')
    envCanvas.width = 1024
    envCanvas.height = 512
    const ctx = envCanvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 1024, 512)
    grad.addColorStop(0, '#080c24')
    grad.addColorStop(0.24, '#ffffff')
    grad.addColorStop(0.32, color)
    grad.addColorStop(0.48, '#172e5f')
    grad.addColorStop(0.6, '#ffffff')
    grad.addColorStop(0.75, accent)
    grad.addColorStop(1, '#0b1020')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1024, 512)
    const envTexture = new THREE.CanvasTexture(envCanvas)
    envTexture.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = envTexture
    const material = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.86,
      roughness: 0.17,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.8,
    })
    const pearl = new THREE.MeshPhysicalMaterial({
      color: '#fafcff',
      metalness: 0.94,
      roughness: 0.14,
      clearcoat: 1,
      envMapIntensity: 1.6,
    })
    const lime = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.42, roughness: 0.23, clearcoat: 1 })
    if (variant === 'gift') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.6, 1.5, 3, 3, 3), material)
      group.add(box)
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.66, 1.56), lime)
      group.add(stripe)
      for (const side of [-1, 1]) {
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.12, 20, 64), pearl)
        bow.position.set(side * 0.3, 1.06, 0)
        bow.rotation.set(0.5, 0, side * 0.6)
        group.add(bow)
      }
    } else {
      const shape = new THREE.Mesh(
        variant === 'star'
          ? new THREE.IcosahedronGeometry(1.25, 0)
          : new THREE.TorusKnotGeometry(0.94, 0.33, 180, 32, 2, 3),
        material,
      )
      group.add(shape)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.065, 16, 100), pearl)
      ring.rotation.set(0.9, 0.4, 0.2)
      group.add(ring)
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 12, 100), lime)
      ring2.rotation.set(-0.5, 0.8, -0.4)
      group.add(ring2)
    }
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.065 + i * 0.008, 16, 12), i % 2 ? lime : pearl)
      dot.position.set(Math.sin(i * 2.4) * 2.1, Math.cos(i * 2) * 1.8, Math.sin(i) * 0.5)
      group.add(dot)
    }
    const pointer = { x: 0, y: 0 }
    const move = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointer.x = (e.clientX - rect.left) / rect.width - 0.5
      pointer.y = (e.clientY - rect.top) / rect.height - 0.5
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerdown', move)
    const resize = () => {
      const w = host.clientWidth || 300,
        h = host.clientHeight || 300
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // setSize clears the drawing buffer; static reduced-motion scenes need a fresh frame too.
      renderer.render(scene, camera)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    const reduced = forcedReduced || matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let visible = true
    const intersection = new IntersectionObserver((entries) => (visible = entries[0].isIntersecting))
    intersection.observe(host)
    const scrollRoot = host.closest('.az-app')
    if (reduced) {
      group.rotation.y = 0.25
      group.rotation.x = -0.18
      renderer.render(scene, camera)
    } else
      renderer.setAnimationLoop(() => {
        if (!visible) return
        const t = (performance.now() - start) / 1000,
          scroll = reduced ? 0 : Number((scrollRoot as HTMLElement | null)?.scrollTop ?? 0) * 0.0007
        group.rotation.y = (reduced ? 0.25 : t * 0.18) + pointer.x * 0.7 + scroll
        group.rotation.x = -0.18 + pointer.y * 0.3 - scroll * 0.4
        group.rotation.z = Math.sin(t * 0.4) * 0.09
        group.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.1
        renderer.render(scene, camera)
      })
    return () => {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      intersection.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerdown', move)
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
        }
      })
      material.dispose()
      pearl.dispose()
      lime.dispose()
      envTexture.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [color, accent, variant, forcedReduced])
  return (
    <div className="az-sculpture" ref={ref} aria-hidden="true">
      <div className="az-sculpture-fallback">✦</div>
    </div>
  )
}
