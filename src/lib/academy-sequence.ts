type Positioned = { code: string; position?: number; parent_code?: string | null }
type Progress = { lesson_code: string; state?: string; status?: string; completed?: boolean; completed_at?: string }

const compareCodes = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true }) || a.localeCompare(b, 'en')
const numericCode = (a: Positioned, b: Positioned) => compareCodes(a.code, b.code)
const position = (item: Positioned, pattern: RegExp) => Number.isFinite(item.position) ? item.position! : Number(item.code.match(pattern)?.[1] ?? Number.MAX_SAFE_INTEGER)
const moduleCode = (lesson: Positioned) => lesson.parent_code || lesson.code.replace(/-L\d+$/, '')

/** Keep the curriculum order independent of the order returned by an API or search. */
export function orderedAcademyModules<T extends Positioned>(modules: T[]): T[] {
  return [...modules].sort((a, b) => position(a, /-M(\d+)$/) - position(b, /-M(\d+)$/) || numericCode(a, b))
}

export function orderedAcademyLessons<T extends Positioned>(lessons: T[], modules: Positioned[] = []): T[] {
  const moduleOrder = new Map(orderedAcademyModules(modules).map((item, index) => [item.code, index]))
  return [...lessons].sort((a, b) => {
    const am = moduleCode(a), bm = moduleCode(b)
    if (am !== bm) {
      const ai = moduleOrder.get(am), bi = moduleOrder.get(bm)
      if (ai !== undefined || bi !== undefined) return (ai ?? Number.MAX_SAFE_INTEGER) - (bi ?? Number.MAX_SAFE_INTEGER)
      const difference = Number(am.match(/-M(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER) - Number(bm.match(/-M(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)
      return difference || compareCodes(am, bm)
    }
    return position(a, /-L(\d+)$/) - position(b, /-L(\d+)$/) || numericCode(a, b)
  })
}

export function academyLessonPosition<T extends Positioned>(code: string, lessons: T[], modules: Positioned[] = []) {
  const ordered = orderedAcademyLessons(lessons, modules), index = ordered.findIndex(item => item.code === code)
  if (index < 0) return undefined
  const lesson = ordered[index], parent = moduleCode(lesson)
  const parents = [...new Set(ordered.map(moduleCode))]
  const knownModules = orderedAcademyModules(modules)
  const moduleIndex = knownModules.findIndex(item => item.code === parent)
  const siblings = ordered.filter(item => moduleCode(item) === parent)
  const localIndex = siblings.findIndex(item => item.code === code)
  const moduleNumber = (moduleIndex < 0 ? parents.indexOf(parent) : moduleIndex) + 1
  return {
    number: index + 1,
    total: ordered.length,
    moduleNumber,
    moduleTotal: knownModules.length || parents.length,
    localNumber: localIndex + 1,
    localTotal: siblings.length,
    label: `${moduleNumber}.${localIndex + 1}`,
    previous: ordered[index - 1],
    next: ordered[index + 1],
  }
}

export function isAcademyLessonComplete(item?: Partial<Progress>|null) {
  if(!item)return false
  if(item.completed===true||(item.state||item.status)==='completed')return true
  return !item.state&&!item.status&&typeof item.completed_at==='string'&&Number.isFinite(Date.parse(item.completed_at))
}
export function completedAcademyLessonCodes(progress: Progress[] = []) {
  return new Set(progress.filter(isAcademyLessonComplete).map(item => item.lesson_code))
}
