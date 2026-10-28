const courseCode = /^(?:CORE-000|(?:VC|ENG|AU|AG|CR|DS|MK|DT|BI)-(?:101|201|301))$/
export function coursesEntry(hash: string, pathname: string, start: string): string | null {
  if (hash === '#/courses' || hash.startsWith('#/courses/')) return hash.slice(1)
  if (pathname === '/courses' || pathname.startsWith('/courses/')) return pathname
  if (start === 'courses') return '/courses'
  const code = /^course_(.+)$/.exec(start)?.[1]
  return code && courseCode.test(code) ? `/courses/${code}` : null
}
export function learningPath(path: string, demo: boolean): string {
  const raw = path.replace(/^#/, '').replace(/\/+$/, '')
  const suffix = raw.replace(demo ? /^\/?academy(?=\/|$)/ : /^\/?courses(?=\/|$)/, '').replace(/^\/+/, '')
  if (!suffix) return ''
  return !demo && courseCode.test(suffix) ? `/courses/${suffix}` : `/${suffix}`
}
export function learningUrl(path: string, demo: boolean): string {
  return demo ? `/academy${path}` : path.startsWith('/courses/') ? path : `/courses${path}`
}
