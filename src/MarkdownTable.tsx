import { Children, isValidElement, type ReactNode } from 'react'

function childrenOf(node: ReactNode): ReactNode {
  return isValidElement<{ children?: ReactNode }>(node) ? node.props.children : null
}
function rowsOf(nodes: ReactNode): ReactNode[][] {
  return Children.toArray(nodes).flatMap(node => {
    if (!isValidElement(node)) return []
    if (node.type === 'tr') return [Children.toArray(childrenOf(node)).filter(isValidElement).map(childrenOf)]
    return rowsOf(childrenOf(node))
  })
}
export function MarkdownTable({ children }: { children?: ReactNode }) {
  const [headers, ...rows] = rowsOf(children)
  const cards = headers?.length > 1 && rows.length > 0 && rows.every(row => row.length === headers.length)
  return (
    <div className={cards ? 'markdown-table responsive-table' : 'markdown-table'}>
      <div className="table-wrap" role="region" aria-label="Таблица: прокрутка по горизонтали" tabIndex={0}>
        <table>{children}</table>
      </div>
      {cards && <div className="table-cards">
        {rows.map((row, i) => <article className="table-card" key={i}>
          <h4>{row[0]}</h4>
          <dl>{row.slice(1).map((cell, j) => <div key={j}><dt>{headers[j + 1]}</dt><dd>{cell}</dd></div>)}</dl>
        </article>)}
      </div>}
    </div>
  )
}
