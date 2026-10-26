/** Telegram startapp parameters support only a catalog or known course, never an admin route. */
export function academyEntry(hash: string, pathname: string, startParam: string): string | null {
  if (hash === '#/academy' || hash.startsWith('#/academy/')) return hash.slice(1)
  if (pathname === '/academy' || pathname.startsWith('/academy/')) return pathname
  if (startParam === 'academy') return '/academy'
  const course = /^academy_(CORE-000|(?:VC|ENG|AU|AG|CR|DS|MK|DT|BI)-(?:101|201|301))$/.exec(startParam)?.[1]
  return course ? `/academy/courses/${course}` : null
}
