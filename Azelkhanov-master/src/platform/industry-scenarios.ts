import type { Entity, Snapshot } from './contracts.ts'

/** Presentation only. Booking rights, capacity and membership remain server-owned. */
export function fittingAppointments(entities: Entity[], now = Date.now()): Entity[] {
  return entities
    .filter(
      (entity) =>
        entity.published &&
        (entity.publishAt === null || Date.parse(entity.publishAt) <= now) &&
        ['event', 'slot'].includes(entity.kind) &&
        entity.data.industry === 'fashion' &&
        entity.data.appointmentType === 'fitting' &&
        typeof entity.data.startsAt === 'string' &&
        Date.parse(entity.data.startsAt) > now,
    )
    .sort((a, b) => Date.parse(String(a.data.startsAt)) - Date.parse(String(b.data.startsAt)))
}

/** Explicitly chosen interest, not a diagnostic score or inferred skill level. */
export const expertGoals = [
  {
    id: 'goal:content',
    title: 'Создавать контент',
    nextStep: 'Выберите одну идею для публикации, подготовьте черновик и проверьте факты перед публикацией.',
  },
  {
    id: 'goal:tools',
    title: 'Освоить инструменты',
    nextStep: 'Выберите один инструмент и проверьте его на небольшой задаче. Сравните результат с вашими требованиями.',
  },
  {
    id: 'goal:services',
    title: 'Развивать услуги',
    nextStep: 'Опишите задачу клиента и ожидаемый результат услуги. Проверьте предположение в разговоре с клиентом.',
  },
] as const

/** Keep catalog order; opening a step never counts as completing it. */
export function companyJourney(
  snapshot: Pick<Snapshot, 'entities' | 'config' | 'progress' | 'me' | 'journey'>,
  now = Date.now(),
) {
  const steps = snapshot.entities
    .filter(
      (entity) =>
        entity.published &&
        (entity.publishAt === null || Date.parse(entity.publishAt) <= now) &&
        snapshot.config.modules.includes(entity.module) &&
        ['article', 'video', 'file'].includes(entity.kind) &&
        entity.data.industry === 'company',
    )
    .slice(0, 3)
  const completedIds = new Set(
    snapshot.progress.filter((progress) => progress.userId === snapshot.me.id).map((progress) => progress.entityId),
  )
  return {
    steps,
    completed: steps.filter((step) => completedIds.has(step.id)).length,
    next: steps.find((step) => !completedIds.has(step.id)),
    started:
      steps.length > 0 &&
      (snapshot.journey?.entityId === steps[0].id || steps.some((step) => completedIds.has(step.id))),
  }
}
