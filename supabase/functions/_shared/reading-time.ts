/** Reading estimate, not practice time. Ignore markup and invisible link destinations. */
export function readingWords(markdown: string): number {
 const text = markdown.replace(/<!--[\s\S]*?-->/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s*\[[^\]]+\]:.*$/gm, ' ')
  .replace(/https?:\/\/\S+/g, ' ').replace(/<[^>]*>/g, ' ')
 return text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}
export function readingMinutes(markdown: string): number {
 return Math.max(1, Math.ceil(readingWords(markdown) / 180))
}
