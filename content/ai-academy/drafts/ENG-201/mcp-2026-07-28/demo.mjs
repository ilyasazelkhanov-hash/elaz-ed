import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {VERSION, VERSION_KEY, CAPABILITIES_KEY, CLIENT_INFO_KEY} from './protocol.mjs'

const meta = {
  [VERSION_KEY]: VERSION,
  [CAPABILITIES_KEY]: {},
  [CLIENT_INFO_KEY]: {name: 'academy-modern-demo', version: '0.1.0'}
}
const request = (id, method, params = {}) => ({
  jsonrpc: '2.0', id, method, params: {...params, _meta: {...meta}}
})
const messages = [
  request(1, 'server/discover'),
  request(2, 'tools/list'),
  request(3, 'tools/call', {name: 'read_exercise_note', arguments: {topic: 'brief'}}),
  {...request(4, 'tools/list'), params: {_meta: {...meta, [VERSION_KEY]: '2025-03-26'}}}
]
const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))],
  {stdio: ['pipe', 'inherit', 'inherit'], shell: false})
const timeout = setTimeout(() => child.kill(), 3000)
child.once('error', error => {
  clearTimeout(timeout)
  console.error(error.message)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  clearTimeout(timeout)
  process.exitCode = signal || code !== 0 ? 1 : 0
})
child.stdin.end(messages.map(message => JSON.stringify(message)).join('\n') + '\n')
