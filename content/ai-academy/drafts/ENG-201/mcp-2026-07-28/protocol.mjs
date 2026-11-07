// Original teaching implementation of a small MCP 2026-07-28 subset.
// Normative sources and limitations are recorded in sources.json and README.md.
export const VERSION = '2026-07-28'
export const VERSION_KEY = 'io.modelcontextprotocol/protocolVersion'
export const CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities'
export const CLIENT_INFO_KEY = 'io.modelcontextprotocol/clientInfo'
export const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo'

const serverInfo = {name: 'academy-modern-readonly-example', version: '0.1.0'}
const notes = Object.freeze({
  brief: 'Учебная задача: сравни два протокольных обмена. Здесь нет клиентских данных.',
  checks: 'Проверь версию каждого запроса, отсутствие handshake и отказ неизвестному инструменту.'
})
const tool = {
  name: 'read_exercise_note',
  description: 'Read a fixed synthetic teaching note. Does not read files, execute commands or access the network.',
  inputSchema: {
    type: 'object',
    properties: {topic: {type: 'string', enum: Object.keys(notes)}},
    required: ['topic'],
    additionalProperties: false
  },
  annotations: {readOnlyHint: true, destructiveHint: false, openWorldHint: false}
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validId = value => typeof value === 'string' || Number.isSafeInteger(value)
const has = (value, key) => Object.hasOwn(value, key)

export function failure(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    ...(validId(id) ? {id} : {}),
    error: {code, message, ...(data === undefined ? {} : {data})}
  }
}

function complete(id, result) {
  return {jsonrpc: '2.0', id, result: {
    resultType: 'complete',
    ...result,
    _meta: {[SERVER_INFO_KEY]: {...serverInfo}}
  }}
}

function toolFailure(id, message) {
  return complete(id, {content: [{type: 'text', text: message}], isError: true})
}

// Synchronous fixed-data operations have no pending work, background tasks or session state.
export function handleRequest(request) {
  if (!record(request) || request.jsonrpc !== '2.0' ||
      typeof request.method !== 'string' || !request.method ||
      has(request, 'result') || has(request, 'error')) {
    // Preserve a readable correlation ID even when another envelope field is invalid.
    return failure(record(request) && has(request, 'id') ? request.id : undefined,
      -32600, 'Invalid request')
  }
  if (!has(request, 'id')) return undefined // Notifications are never executed as tool calls.
  if (!validId(request.id)) return failure(undefined, -32600, 'Invalid request ID')
  const {id, method, params} = request
  if (method === 'initialize') {
    return failure(id, -32601,
      'Legacy initialize is not supported. This example supports MCP 2026-07-28 with per-request metadata.')
  }
  if (!record(params) || !record(params._meta)) {
    return failure(id, -32602, 'Every request needs params._meta')
  }
  const meta = params._meta
  if (typeof meta[VERSION_KEY] !== 'string' || !meta[VERSION_KEY] ||
      !record(meta[CAPABILITIES_KEY])) {
    return failure(id, -32602, 'Protocol version and client capabilities are required on every request')
  }
  if (has(meta, CLIENT_INFO_KEY) &&
      (!record(meta[CLIENT_INFO_KEY]) || typeof meta[CLIENT_INFO_KEY].name !== 'string' ||
       typeof meta[CLIENT_INFO_KEY].version !== 'string')) {
    return failure(id, -32602, 'Invalid client identity metadata')
  }
  if (meta[VERSION_KEY] !== VERSION) {
    return failure(id, -32022, 'Unsupported protocol version',
      {supported: [VERSION], requested: meta[VERSION_KEY]})
  }
  if (method === 'server/discover') {
    return complete(id, {
      supportedVersions: [VERSION],
      capabilities: {tools: {}},
      instructions: 'A local teaching example with two fixed notes. No filesystem or network tools.'
    })
  }
  if (method === 'tools/list') {
    if (has(params, 'cursor')) return failure(id, -32602, 'This fixed one-page list has no valid cursors')
    return complete(id, {tools: [structuredClone(tool)]})
  }
  if (method === 'tools/call') {
    if (typeof params.name !== 'string' || params.name !== tool.name ||
        (has(params, 'arguments') && !record(params.arguments))) {
      return failure(id, -32602, 'Unknown tool or malformed tool call')
    }
    const args = params.arguments
    if (!record(args) || Object.keys(args).length !== 1 ||
        !has(args, 'topic') || typeof args.topic !== 'string' || !has(notes, args.topic)) {
      return toolFailure(id, 'Use exactly one topic: brief or checks. Paths and commands are not accepted.')
    }
    return complete(id, {content: [{type: 'text', text: notes[args.topic]}]})
  }
  return failure(id, -32601, 'Method not found')
}
