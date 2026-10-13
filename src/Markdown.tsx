import { lazy, Suspense } from 'react'

// Разбор Markdown — самый тяжёлый кусок бандла, поэтому он грузится отдельно и заранее, пока человек на главной.
const load = () => import('./MarkdownImpl')
const Impl = lazy(load)

export const preloadMarkdown = () => void load()

export function Markdown(props: { text: string; className?: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          {[92, 100, 78].map((w) => (
            <div key={w} className="skeleton h-4 rounded-full" style={{ width: `${w}%` }} />
          ))}
        </div>
      }
    >
      <Impl {...props} />
    </Suspense>
  )
}
