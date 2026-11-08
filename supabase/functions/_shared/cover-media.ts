/** Keep the original URL, including signed query strings, when selecting media. */
export function isGifCoverUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value, 'https://cover.invalid')
    return /\.gif$/i.test(url.pathname) || ['format', 'fm'].some(key => url.searchParams.get(key)?.toLowerCase() === 'gif')
  } catch { return false }
}
