/** Presentation-only punctuation. Never run on raw Markdown, code or URLs. */
export function plainDashes(text: string): string {
  // Keep numeric ranges, including dates and scientific intervals, intact.
  return text.split(/(«[^»]*»|“[^”]*”)/g).map((part, index) =>
    index % 2 ? part : part.replace(/—/g, '-').replace(/(?<!\d)–|–(?!\d)/g, '-'),
  ).join('')
}

type TextNode = { type: string; value?: string; children?: TextNode[] }

/** Normalize prose after Markdown parsing, without rewriting the source. */
export function remarkPlainDashes() {
  return (tree: TextNode) => {
    const visit = (node: TextNode) => {
      // Quotes remain verbatim. Code, raw HTML and link destinations are data.
      if (['blockquote', 'code', 'inlineCode', 'html', 'definition'].includes(node.type)) return
      if (node.type === 'text' && typeof node.value === 'string') node.value = plainDashes(node.value)
      for (const child of node.children ?? []) visit(child)
    }
    visit(tree)
  }
}
