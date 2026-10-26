import catalog from '../../content/ai-academy/catalog.public.json' with { type: 'json' }

/** Programs only. This adapter cannot enroll, read lesson bodies or change progress. */
export function academyProgramPreview(action: string, payload: Record<string, unknown>) {
  const entities = catalog.entities
  const ordered = (rows: typeof entities) => [...rows].sort((a, b) => a.position - b.position || a.code.localeCompare(b.code))
  if (action === 'catalog') {
    const q = String(payload.q || '').trim().toLocaleLowerCase('ru')
    const courses = ordered(entities.filter(n => n.kind === 'course' && (!payload.direction || n.parent_code === payload.direction) && (!payload.level || n.data.level === payload.level) && (!q || `${n.code} ${n.title} ${JSON.stringify(n.data)}`.toLocaleLowerCase('ru').includes(q))))
    const offset = Math.max(0, Math.floor(Number(payload.offset) || 0))
    const limit = Math.min(100, Math.max(1, Math.floor(Number(payload.limit) || 12)))
    return { preview_only: true, directions: ordered(entities.filter(n => n.kind === 'direction')), courses: courses.slice(offset, offset + limit), total: courses.length }
  }
  if (action === 'course') {
    const course = entities.find(n => n.kind === 'course' && n.code === payload.code)
    if (!course) return null
    const modules = ordered(entities.filter(n => n.kind === 'module' && n.parent_code === course.code))
    return { preview_only: true, course, modules, lessons: ordered(entities.filter(n => n.kind === 'lesson' && modules.some(m => m.code === n.parent_code))), sources: [], assessments: [], enrollment: null, progress: null }
  }
  return null
}
