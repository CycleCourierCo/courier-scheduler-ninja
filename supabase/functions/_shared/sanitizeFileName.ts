/** Strip anything that could break a Supabase storage key. */
export function sanitizeFileName(name: string): string {
  const trimmed = (name || 'file').normalize('NFKD')
  const dot = trimmed.lastIndexOf('.')
  let base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  let ext = dot > 0 ? trimmed.slice(dot + 1) : ''

  const clean = (s: string) =>
    s
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')

  base = clean(base).slice(0, 60) || 'file'
  ext = clean(ext).slice(0, 10)
  return ext ? `${base}.${ext}` : base
}
