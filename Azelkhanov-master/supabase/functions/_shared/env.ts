/** Never return a publishable key as a server credential. */
export function readServiceKey(get: (name: string) => string | undefined): string {
  const explicit = get('SUPABASE_SECRET_KEY') || get('SUPABASE_SERVICE_ROLE_KEY')
  if (explicit) return explicit
  try {
    const keys = JSON.parse(get('SUPABASE_SECRET_KEYS') || '{}')
    return String(keys.default ?? Object.values(keys)[0] ?? '')
  } catch {
    return ''
  }
}
