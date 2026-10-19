import { isDemo } from './api'
import { initData } from './tg'
import { useStore } from '../store'
export { safeAcademyUrl } from './academy-types'
export type { AcademyEntity, AcademySourceLink } from './academy-types'
export const academyEnabled = isDemo || import.meta.env.VITE_ACADEMY_ENABLED === 'true'

const messages: Record<string,string> = {
  forbidden:'Недостаточно прав.',not_found:'Запись не найдена.',not_published:'Материал ещё готовится к публикации.',
  enrollment_required:'Сначала запишитесь на курс.',prerequisite_required:'Сначала завершите подготовительный курс или подтвердите входной уровень.',
  version_conflict:'Запись уже изменена. Обновите страницу перед сохранением.',content_required:'Перед публикацией добавьте готовый материал.',
  assessment_required:'Для публикации проверки знаний настройте вопросы и ответы.',assessment_not_configured:'Проверка пока не настроена.',
  review_required:'Это задание завершается после проверки работы.',quiz_required:'Для завершения пройдите проверку знаний.',
  self_review_forbidden:'Нельзя оценивать собственную работу.',passing_score_required:'Для зачёта необходимо не менее 70 баллов.',
  critical_gate_failed:'Не выполнен обязательный критерий.',attempt_limit:'Попытки исчерпаны. Обратитесь к преподавателю.',
  already_submitted:'Работа уже ожидает проверки.',artifact_required:'Добавьте текст работы или ссылку на результат.',
  access_required:'Для этого курса требуется отдельный доступ.',course_incomplete:'Сначала выполните обязательные занятия.',
  capstone_required:'Для сертификата требуется успешная защита проекта.',invalid_url:'Используйте открытую HTTPS-ссылку без ключей доступа.',
  academy_not_ready:'Академия ещё не подключена к серверу. Повторите позже.',network:'Нет связи с сервером. Попробуйте ещё раз.',
  access_forbidden:'Материал пока недоступен. Проверьте публикацию курса и своё зачисление.',
  prerequisites_required:'Сначала завершите подготовительный курс или подтвердите входной уровень.',
  approval_required:'Сначала переведите запись в статус «Готов к публикации».',
  source_unverified:'Перед публикацией источника подтвердите права, доступность ссылки и дату проверки.',
  rubric_required:'Назначьте опубликованную рубрику оценивания.',review_pending:'Работа уже ожидает проверки.',
  completion_required:'Для подтверждения завершите обязательные занятия и успешно защитите проект.',
  scores_invalid:'Заполните баллы по каждому критерию в пределах указанного максимума.',
  evidence_required:'Добавьте HTTPS-ссылку на проект для подтверждения уровня.',
  source_link_invalid:'Проверьте код источника и код курса, модуля или занятия.',
  artifact_invalid:'Добавьте текст работы или корректную HTTPS-ссылку на результат.',
  payment_required:'Для продолжения откройте доступ к курсу через его страницу.',
  product_not_found:'Продукт курса пока недоступен. Обратитесь к автору.',
  storage_unavailable:'Хранилище файлов пока не подключено. Сохраните текст или постоянную ссылку на работу.',
  file_invalid:'Проверьте формат и размер файла: до 10 МБ, PDF, PNG, JPEG, WEBP, TXT или ZIP.',
  file_metadata_mismatch:'Загруженный файл не соответствует выбранному. Прикрепите его заново.',
  file_content_invalid:'Формат содержимого файла не прошёл проверку. Выберите другой файл.',
  file_upload_incomplete:'Загрузка файла не завершена. Попробуйте прикрепить его заново.',
  file_forbidden:'Нет доступа к этому вложению.',
  consent_required:'Подтвердите согласие на публичную публикацию работы.',
  portfolio_artifact_required:'Для портфолио добавьте текст или постоянную публичную ссылку без параметров доступа.',
}
let demo: Promise<any> | undefined
async function demoClient() {
  // Published builds exclude authored bodies and grading keys from demo assets by default.
  demo ??= Promise.all([import('./academy-domain'),import('./academy-storage'),import.meta.env.DEV||import.meta.env.VITE_ACADEMY_PUBLIC_DEMO==='true'
    ? import('../../content/ai-academy/catalog.learning.json')
    : import('../../content/ai-academy/catalog.normalized.json')]).then(([{createAcademyEngine},{createAcademySnapshotStorage},{default:seed}]) => {
    const key='og:academy:demo:v1'
    const storage=createAcademySnapshotStorage<any>(localStorage,key)
    window.addEventListener('storage',event=>{if(event.key===key||event.key===null)storage.invalidate()})
    return createAcademyEngine(seed as any,storage)
  })
  return demo
}
export async function academyRequest<T=any>(action: string, payload: Record<string,unknown> = {}): Promise<T> {
  try {
    payload={...payload}
    for(const key of ['q','level','direction','parent_code','language','source_type']) if(payload[key]==='')delete payload[key]
    if (isDemo) {
      const me=useStore.getState().me
      return await (await demoClient())({id:me?.id ?? 1,is_admin:me?.is_admin ?? false,commerce:useStore.getState().courses},action,payload)
    }
    const res=await fetch(`${import.meta.env.VITE_API_URL ?? ''}/academy`,{
      method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({auth:initData,action,payload}),
    }).catch(()=>{throw new Error('network')})
    const body=await res.json().catch(()=>({error:'academy_not_ready'}))
    if (!res.ok) throw new Error(body.error ?? 'academy_not_ready')
    return body as T
  } catch (error) {
    const code=error instanceof Error ? error.message : 'unknown'
    const normalized=code.replace(/^academy_/,'')
    throw new Error(messages[normalized] ?? messages[code] ?? `Не удалось выполнить действие (${code}).`)
  }
}

export async function academyPublicRequest(action:'certificate_public'|'portfolio_public',payload:Record<string,unknown>){
  if(isDemo){const me=useStore.getState().me;return(await demoClient())({id:me?.id??1,is_admin:false},action,payload)}
  const res=await fetch(`${import.meta.env.VITE_API_URL??''}/academy_public`,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,payload})})
  if(!res.ok)throw new Error('Подтверждение недоступно или ссылка отозвана.')
  return res.json()
}
