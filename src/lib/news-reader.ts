export { readingMinutes } from '../../supabase/functions/_shared/reading-time.ts'
import { ogPracticeCourses, type PracticeCourse } from './og-practice.ts'
import { resolvePracticeCourse } from './og-course-access.ts'
import type { Card, Course } from './types'

/** Presentation only. The authored Markdown and source URLs remain untouched in storage.
 * Source appendices are not promoted into primary sources: editorial.sources is the
 * editor's explicit primary-source list. Inline citations and ordinary sections stay.
 */
export function newsArticleBody(body: string): string {
 const lines = body.split('\n'), output: string[] = []
 let sourcesDepth: number | null = null, fence: string | null = null
 for (let index = 0; index < lines.length; index++) {
  const line = lines[index], trimmed = line.trim()
  if (/^(?: {4}|\t)/.test(line)) { output.push(line); continue }
  const delimiter = trimmed.match(/^(`{3,}|~{3,})/)
  if (delimiter) {
   if (!fence) fence = delimiter[1]
   else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = null
   output.push(line); continue
  }
  if (fence) { output.push(line); continue }
  const heading = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/)
  const label = (heading?.[2] ?? trimmed).replace(/\*\*|__/g, '').replace(/:\s*$/, '').trim()
  const sourceHeading = /^(?:первоисточники|источники(?:\s+(?:анонса|новости|публикации))?)$/i.test(label)
  const setext = /^(?:={3,}|-{3,})\s*$/.test(lines[index + 1]?.trim() ?? '')
  if (sourceHeading) {
   sourcesDepth = heading?.[1].length ?? (setext && lines[index + 1].trim()[0] === '=' ? 1 : 2)
   if (setext) index++
   continue
  }
  const sectionDepth = heading?.[1].length ?? (setext && trimmed ? (lines[index + 1].trim()[0] === '=' ? 1 : 2) : null)
  if (sectionDepth !== null && sourcesDepth !== null && sectionDepth <= sourcesDepth) sourcesDepth = null
  // Only bibliography entries, not prose or code, disappear with the appendix.
  // Definitions are invisible Markdown infrastructure; keep them for inline citations.
  const entry = trimmed.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '')
  const linkEntry = /^(?:\[[^\]]+\](?:\(https?:\/\/[^\s]+\)|\[[^\]]*\])|<?https?:\/\/[^\s<>]+>?)[.;]?$/i.test(entry)
  const labelledSource = /^(?:первоисточник|источник)(?:\s+анонса)?\s*:\s*(?:\[[^\]]+\]\(https?:\/\/[^\s]+\)|<?https?:\/\/[^\s<>]+>?)[.;]?$/i.test(trimmed.replace(/\*\*|__/g, ''))
  if ((sourcesDepth !== null && linkEntry) || labelledSource) continue
  output.push(line)
 }
 // Leave whitespace alone: indentation and blank lines can be meaningful in code.
 return output.join('\n')
}

export type NewsCourseRecommendation = { outline: PracticeCourse; course: Course; reason: string }
type NewsTopic = Pick<Card, 'title' | 'subtitle' | 'category'>
const recommendationRules = [
 { key: 'coding', pattern: /вайб.?код|vibe.?cod|\bcodex\b|\bcursor\b|claude\s+code|\bopencode\b|\breact\b|\bvite\b|\bgithub\b|\bide\b|программир|разработк|репозитори|pull\s?request|кодовый|прототип.{0,20}(?:сайт|приложен)/i, reason: 'Практика создания и проверки своего приложения.' },
 { key: 'media', pattern: /изображен|картин|визуал|\bmidjourney\b|\bflux\b|\bsora\b|\bveo\b|\brunway\b|\bkling\b|видео|ролик|монтаж|музык|звук|голос|субтитр/i, reason: 'Практика работы с изображениями, видео и звуком.' },
 { key: 'text', pattern: /исследован|\bnotebook(?:lm)?\b|\bgamma\b|\bsql\b|\bcsv\b|\bexcel\b|таблиц|анализ.{0,15}данн|презентац|редактур|копирайт|написан.{0,12}текст|провер.{0,12}(?:факт|источник)/i, reason: 'Практика исследования, проверки источников и подготовки материалов.' },
 { key: 'automation', pattern: /автоматизац|\bn8n\b|\bzapier\b|\bmake\.com\b|вебхук|\bwebhook\b|интеграц|\bworkflow\b|повторяем.{0,12}процесс|коннектор|расписани|(?:^|[^а-яё])агент(?:ы|ов|а|ом|ам|ами|ах|н[а-яё]*)?(?![а-яё])/i, reason: 'Практика настройки повторяемого процесса и проверки действий ИИ.' },
 { key: 'foundations', pattern: /\bchatgpt\b|\bgpt[-\s\d]|\bllm\b|\bclaude\b|\bgemini\b|\bmcp\b|\bskills?\b|промпт|нейросет|языков.{0,12}модел|выбор.{0,12}инструмент/i, reason: 'Основа для выбора инструмента, работы с контекстом и проверки ответа.' },
] as const

/** Match concrete subjects first. No static-only, missing, ambiguous or empty courses.
 * Relevance describes the course's actual practice, not coverage of a just-announced feature.
 */
export function newsCourseRecommendations(post: NewsTopic, courses: Course[], limit = 2): NewsCourseRecommendation[] {
 const text = `${post.title ?? ''} ${post.subtitle ?? ''}`
 const matches = recommendationRules.filter(rule => rule.pattern.test(text))
 const specific = matches.filter(rule => rule.key !== 'foundations')
 const selected = specific.length ? specific : matches
 const count = Number.isFinite(limit) ? Math.max(0, Math.min(3, Math.floor(limit))) : 2
 return selected.flatMap(rule => {
  const outline = ogPracticeCourses.find(item => item.key === rule.key)
  if (!outline) return []
  const course = resolvePracticeCourse(outline, courses)
  if (!course || !Number.isSafeInteger(course.lessons) || course.lessons <= 0) return []
  return [{ outline, course, reason: rule.reason }]
 }).slice(0, count)
}
