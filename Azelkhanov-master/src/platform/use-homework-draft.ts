import { useState } from 'react'
import { readHomeworkDraft, writeHomeworkDraft, clearSubmittedHomework, type HomeworkDraft } from './learning-draft.ts'

export function useHomeworkDraft(key: string) {
  const [state, setState] = useState(() => ({ key, ...readHomeworkDraft(key), status: '' }))
  const current = state.key === key ? state : { key, ...readHomeworkDraft(key), status: '' }
  if (state.key !== key) setState(current)
  const update = (patch: Partial<HomeworkDraft>) => {
    const value = { ...readHomeworkDraft(key), ...patch }
    const saved = writeHomeworkDraft(key, value)
    setState({ key, ...value, status: saved ? 'Черновик сохранён в этом сеансе' : 'Черновик сохранён до обновления страницы' })
  }
  return {
    ...current,
    setBody: (body: string) => update({ body }),
    setFile: (file: string) => update({ file }),
    submitted: (value: HomeworkDraft) => {
      if (clearSubmittedHomework(key, value)) setState({ key, body: '', file: '', status: '' })
    },
  }
}
