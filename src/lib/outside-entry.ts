import directory from '../../content/ai-practice-2026-10-25/course-directory.json' with { type: 'json' }
import { parseGuideStartParam } from './discovery-events.ts'

const courseCode = '(?:CORE-000|(?:VC|ENG|AU|AG|CR|DS|MK|DT|BI)-(?:101|201|301))'
const courseRoute = new RegExp(`^/(?:courses/(?:courses/)?|academy/courses/)${courseCode}$`)

/** Public content only. Never relay search strings, drafts, admin routes or account data. */
export function publicEntryHash(value: string): string | null {
  const path = value.replace(/^#/, '').replace(/\/$/, '')
  if (['/blog', '/courses', '/courses/start', '/courses/og-practice', '/academy'].includes(path)) return `#${path}`
  const post = /^\/blog\/([1-9]\d*)$/.exec(path)
  if (post && Number.isSafeInteger(Number(post[1]))) return `#${path}`
  const guide = /^\/courses\/start\/([a-z-]+)$/.exec(path)
  if (guide && parseGuideStartParam(`g_${guide[1]}`)) return `#${path}`
  const practice = /^\/courses\/og-practice\/([a-z-]+)(?:\/([a-z0-9-]+))?$/.exec(path)
  if (practice) {
    const course = directory.find(item => item.key === practice[1])
    if (course && (!practice[2] || course.lessons.some(item => item.key === practice[2]))) return `#${path}`
  }
  return courseRoute.test(path) ? `#${path}` : null
}

/** Bot /start transports at most 64 URL-safe characters, also accepted by startapp. */
export function entryHashFromParam(param: string): string | null {
  if (!/^open_[A-Za-z0-9_-]{1,59}$/.test(param)) return null
  return publicEntryHash('/' + param.slice(5).replaceAll('_', '/'))
}

export function outsideEntryLinks(location: Pick<Location, 'hash' | 'pathname' | 'search'>) {
  const start = new URLSearchParams(location.search).get('sp') || ''
  // A present hash takes precedence, including an unknown or explicit home hash.
  let hash = location.hash ? publicEntryHash(location.hash) : publicEntryHash(location.pathname)
  if (!location.hash && !hash && location.pathname === '/') {
    hash = entryHashFromParam(start)
    const post = /^(?:l)([1-9]\d*)(?:_r[1-9]\d*)?$/.exec(start)
    if (!hash && post) hash = publicEntryHash(`/blog/${post[1]}`)
    const guide = parseGuideStartParam(start)
    if (!hash && guide) hash = publicEntryHash(`/courses/start/${guide.guideId}`)
    if (!hash && start === 'courses') hash = '#/courses'
    if (!hash && start === 'academy') hash = '#/academy'
    if (!hash && start.startsWith('course_')) hash = publicEntryHash(`/courses/${start.slice(7)}`)
    if (!hash && start.startsWith('academy_')) hash = publicEntryHash(`/academy/courses/${start.slice(8)}`)
  }
  const param = hash ? 'open_' + hash.slice(2).replaceAll('/', '_') : ''
  // Fail closed if future content identifiers outgrow the bot's transport.
  const supported = param.length <= 64 && entryHashFromParam(param) === hash && hash !== null
  return {
    telegram: supported ? `https://t.me/elazart_bot?start=${param}` : 'https://t.me/elazart_bot',
    demo: supported ? `/?demo${hash}` : '/?demo',
  }
}
