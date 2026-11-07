import {once} from 'node:events'
import {failure, handleRequest} from './protocol.mjs'

// Bound the unfinished frame before decoding or parsing it.
export const MAX_FRAME_BYTES = 32768
const decoder = new TextDecoder('utf-8', {fatal: true})
let frame = Buffer.alloc(0)
let dropping = false

async function send(response) {
  if (response && !process.stdout.write(JSON.stringify(response) + '\n')) {
    await once(process.stdout, 'drain')
  }
}

async function accept(bytes) {
  let request
  try {
    request = JSON.parse(decoder.decode(bytes))
  } catch {
    await send(failure(undefined, -32700, 'Invalid JSON or UTF-8'))
    return
  }
  await send(handleRequest(request))
}

for await (const chunk of process.stdin) {
  let offset = 0
  while (offset < chunk.length) {
    const newline = chunk.indexOf(10, offset)
    const end = newline < 0 ? chunk.length : newline
    const segment = chunk.subarray(offset, end)
    if (!dropping) {
      if (frame.length + segment.length > MAX_FRAME_BYTES) {
        frame = Buffer.alloc(0)
        dropping = true
        await send(failure(undefined, -32600, 'Message exceeds the teaching server limit'))
      } else {
        frame = Buffer.concat([frame, segment])
      }
    }
    if (newline < 0) break
    if (!dropping) await accept(frame)
    frame = Buffer.alloc(0)
    dropping = false
    offset = newline + 1
  }
}
// An unfinished frame is not a valid newline-delimited message.
if (frame.length && !dropping) {
  await send(failure(undefined, -32700, 'Unterminated JSON-RPC frame'))
}
