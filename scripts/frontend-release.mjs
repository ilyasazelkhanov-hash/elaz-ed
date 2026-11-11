import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFile, readdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const digest = value => createHash('sha256').update(value).digest('hex')
const commitPattern = /^[a-f0-9]{40}$/i

// This public file contains build identity only, never environment variables or user data.
export async function frontendRelease(base = root, env = process.env) {
  const files = []
  const visit = async relative => {
    for (const entry of (await readdir(path.join(base, 'dist', relative), {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) await visit(name)
      else if (name !== 'release.json') files.push({path: name, sha256: digest(await readFile(path.join(base, 'dist', name)))})
    }
  }
  await visit('')
  let commit = null, dirty = null
  const supplied = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA
  if (commitPattern.test(supplied || '')) commit = supplied.toLowerCase()
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
    if (!commit && commitPattern.test(head)) commit = head.toLowerCase()
    dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
  } catch {}
  return {schema: 1, commit, dirty, built_at: new Date().toISOString(), build_sha256: digest(JSON.stringify(files)), file_count: files.length}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = await frontendRelease()
  await writeFile(path.join(root, 'dist/release.json'), JSON.stringify(release, null, 2) + '\n')
  console.log(`Frontend identity: ${release.commit || 'unknown commit'}, ${release.file_count} files, dirty=${release.dirty}`)
}
