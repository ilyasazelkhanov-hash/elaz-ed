import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFile, readdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const digest = value => createHash('sha256').update(value).digest('hex')
const commitPattern = /^[a-f0-9]{40}$/i

export function frontendSourceIdentity(base = root, env = process.env) {
  let commit = null, dirty = null
  const supplied = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA
  if (commitPattern.test(supplied || '')) commit = supplied.toLowerCase()
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
    if (!commit && commitPattern.test(head)) commit = head.toLowerCase()
    dirty = head.toLowerCase() !== commit || !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
  } catch {}
  return {commit, dirty}
}

// Build-log-only diagnostics: never attach this object to the public release manifest.
// Only Git metadata is inspected. JSON encoding prevents filenames injecting log lines.
export function frontendSourceDiagnostics(base = root, env = process.env) {
  const supplied = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA
  const result = {head: null, declared_commit: commitPattern.test(supplied || '') ? supplied.toLowerCase() : null, tracked_changes: [], truncated: false, available: false}
  const git = args => execFileSync('git', args, {cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']})
  try {
    const head = git(['rev-parse', 'HEAD']).trim()
    result.head = commitPattern.test(head) ? head.toLowerCase() : null
    const entries = git(['status', '--porcelain=v1', '-z', '--untracked-files=no']).split('\0')
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i]) continue
      const status = entries[i].slice(0, 2)
      const change = {status, path: entries[i].slice(3)}
      if (/[RC]/.test(status)) change.from = entries[++i] || ''
      if (result.tracked_changes.length < 100) result.tracked_changes.push(change)
      else result.truncated = true
    }
    result.available = true
  } catch {} // Do not print subprocess errors, absolute paths or environment values.
  return result
}

// This public file contains build identity only, never environment variables or user data.
export async function frontendRelease(base = root, env = process.env, identity = frontendSourceIdentity(base, env)) {
  const files = []
  const visit = async relative => {
    for (const entry of (await readdir(path.join(base, 'dist', relative), {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) await visit(name)
      else if (name !== 'release.json') files.push({path: name, sha256: digest(await readFile(path.join(base, 'dist', name)))})
    }
  }
  await visit('')
  return {schema: 1, ...identity, built_at: new Date().toISOString(), build_sha256: digest(JSON.stringify(files)), file_count: files.length}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = await frontendRelease()
  await writeFile(path.join(root, 'dist/release.json'), JSON.stringify(release, null, 2) + '\n')
  console.log(`Frontend identity: ${release.commit || 'unknown commit'}, ${release.file_count} files, dirty=${release.dirty}`)
}
