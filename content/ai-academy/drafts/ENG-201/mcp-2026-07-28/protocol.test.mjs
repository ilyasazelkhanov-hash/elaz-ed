import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {VERSION, VERSION_KEY, CAPABILITIES_KEY, SERVER_INFO_KEY, handleRequest} from './protocol.mjs'

const script = fileURLToPath(new URL('./server.mjs', import.meta.url))
const env = {...process.env}
delete env.NODE_TEST_CONTEXT
const request = (id, method, params = {}) => ({
  jsonrpc: '2.0', id, method,
  params: {...params, _meta: {[VERSION_KEY]: VERSION, [CAPABILITIES_KEY]: {}}}
})
const run = input => execFileSync(process.execPath, [script],
  {input, encoding: 'utf8', env, timeout: 3000, maxBuffer: 1024 * 1024})
const lines = output => output.trim() ? output.trim().split('\n').map(JSON.parse) : []
const runMessages = messages => lines(run(messages.map(JSON.stringify).join('\n') + '\n'))

test('discover returns current versions, capabilities, result type and server identity', () => {
  const result = handleRequest(request('discover', 'server/discover'))
  assert.equal(result.id, 'discover')
  assert.equal(result.result.resultType, 'complete')
  assert.deepEqual(result.result.supportedVersions, [VERSION])
  assert.deepEqual(result.result.capabilities, {tools: {}})
  assert.equal(result.result._meta[SERVER_INFO_KEY].name, 'academy-modern-readonly-example')
  assert.equal(result.result.protocolVersion, undefined)
})

test('first request may list or call tools, without discover or initialize', () => {
  const [listed, called] = runMessages([
    request(0, 'tools/list'),
    request(1, 'tools/call', {name: 'read_exercise_note', arguments: {topic: 'brief'}})
  ])
  assert.equal(listed.result.tools.length, 1)
  assert.equal(listed.result.resultType, 'complete')
  assert.deepEqual(listed.result.tools[0].inputSchema.properties.topic.enum, ['brief', 'checks'])
  assert.match(called.result.content[0].text, /Учебная задача/)
  assert.equal(called.result.resultType, 'complete')
})

test('implementation version is distinct from protocol version and ordinary replies do not echo it', () => {
  const discovery = handleRequest(request(1, 'server/discover')).result
  assert.deepEqual(discovery.supportedVersions, ['2026-07-28'])
  for (const result of [discovery,
    handleRequest(request(2, 'tools/list')).result,
    handleRequest(request(3, 'tools/call', {name: 'read_exercise_note', arguments: {topic: 'brief'}})).result]) {
    assert.equal(result._meta[SERVER_INFO_KEY].version, '0.1.0')
    assert.notEqual(result._meta[SERVER_INFO_KEY].version, VERSION)
    assert.equal(Object.hasOwn(result, 'protocolVersion'), false)
    assert.equal(Object.hasOwn(result._meta, VERSION_KEY), false)
  }
})

test('metadata is required for every request, not remembered from an earlier request', () => {
  const withoutMeta = request(2, 'tools/list')
  delete withoutMeta.params._meta
  const withoutCaps = request(3, 'tools/list')
  delete withoutCaps.params._meta[CAPABILITIES_KEY]
  const [first, second, third, fourth] = runMessages([
    request(1, 'server/discover'), withoutMeta, withoutCaps, request(4, 'tools/list')
  ])
  assert.ok(first.result)
  assert.equal(second.error.code, -32602)
  assert.equal(third.error.code, -32602)
  assert.ok(fourth.result)
})

test('unsupported version uses -32022 with supported and requested, including on discover', () => {
  for (const method of ['server/discover', 'tools/list']) {
    const value = request(8, method)
    value.params._meta[VERSION_KEY] = '2025-03-26'
    assert.deepEqual(handleRequest(value), {
      jsonrpc: '2.0', id: 8,
      error: {code: -32022, message: 'Unsupported protocol version',
        data: {supported: [VERSION], requested: '2025-03-26'}}
    })
  }
})

test('legacy handshake is rejected with an actionable current-version diagnostic', () => {
  const result = handleRequest({jsonrpc: '2.0', id: 1, method: 'initialize', params: {}})
  assert.equal(result.error.code, -32601)
  assert.match(result.error.message, /2026-07-28/)
  assert.equal(handleRequest(request(2, 'ping')).error.code, -32601)
})

test('wrong argument schema is a tool error, unknown or malformed tool calls are protocol errors', () => {
  for (const args of [{topic: '../secret'}, {topic: '__proto__'}, {topic: 'checks', command: 'sh'}, {}]) {
    const result = handleRequest(request(1, 'tools/call', {name: 'read_exercise_note', arguments: args}))
    assert.equal(result.result.isError, true)
    assert.equal(result.result.resultType, 'complete')
    assert.equal(result.error, undefined)
  }
  for (const params of [{name: 'execute'}, {name: 'read_exercise_note', arguments: []}]) {
    assert.equal(handleRequest(request(1, 'tools/call', params)).error.code, -32602)
  }
})

test('unreadable envelopes, null/fractional IDs and batches are rejected without inventing an ID', () => {
  for (const value of [null, [], [request(1, 'tools/list')], false,
    {...request(1, 'tools/list'), id: null}, {...request(1, 'tools/list'), id: 1.5},
    {jsonrpc: '2.0'}]) {
    const response = handleRequest(value)
    assert.equal(response.error.code, -32600)
    assert.equal(response.id, undefined)
  }
})

test('malformed envelopes retain readable numeric and string request IDs', () => {
  for (const id of [0, 1, -1, '', 'broken-request']) {
    for (const value of [
      {...request(id, 'tools/list'), jsonrpc: '1.0'},
      {...request(id, 'tools/list'), method: null},
      {...request(id, 'tools/list'), result: {}},
      {...request(id, 'tools/list'), error: {}},
      {jsonrpc: '2.0', id}
    ]) {
      const response = handleRequest(value)
      assert.equal(response.error.code, -32600)
      assert.equal(response.id, id)
    }
  }
})

test('stdio error responses preserve readable IDs and omit unusable IDs', () => {
  const responses = runMessages([
    {jsonrpc: '2.0', id: 'missing-method'},
    {...request(0, 'tools/list'), result: {}},
    {...request(null, 'tools/list'), jsonrpc: '1.0'},
    request(4, 'tools/list')
  ])
  assert.deepEqual(responses.slice(0, 3).map(response => response.error.code), [-32600, -32600, -32600])
  assert.deepEqual(responses.map(response => response.id), ['missing-method', 0, undefined, 4])
  assert.equal(Object.hasOwn(responses[2], 'id'), false)
  assert.equal(responses[3].result.resultType, 'complete')
})

test('notifications get no response and cannot turn into tool calls', () => {
  const notification = request(1, 'tools/call', {name: 'read_exercise_note', arguments: {topic: 'brief'}})
  delete notification.id
  assert.equal(handleRequest(notification), undefined)
  assert.deepEqual(runMessages([notification, request(2, 'tools/list')]).map(r => r.id), [2])
})

test('capabilities and optional identity require objects of the expected basic types', () => {
  for (const capabilities of [null, [], false]) {
    const value = request(1, 'tools/list')
    value.params._meta[CAPABILITIES_KEY] = capabilities
    assert.equal(handleRequest(value).error.code, -32602)
  }
  const value = request(1, 'tools/list')
  value.params._meta['io.modelcontextprotocol/clientInfo'] = {name: false, version: '1'}
  assert.equal(handleRequest(value).error.code, -32602)
})

test('parse errors recover at the next newline; Unicode results remain valid JSON', () => {
  const output = lines(run('not-json\n' + JSON.stringify(request(9, 'tools/list')) + '\n'))
  assert.equal(output[0].error.code, -32700)
  assert.equal(output[0].id, undefined)
  assert.equal(output[1].id, 9)
})

test('oversized frame is bounded and discarded, then processing resumes', () => {
  const input = 'x'.repeat(100000) + '\n' + JSON.stringify(request(10, 'tools/list')) + '\n'
  const output = lines(run(input))
  assert.equal(output.length, 2)
  assert.equal(output[0].error.code, -32600)
  assert.equal(output[1].id, 10)
})

test('invalid UTF-8 and incomplete final frames do not become requests', () => {
  const invalid = lines(run(Buffer.from([0xc3, 0x28, 10])))
  assert.equal(invalid[0].error.code, -32700)
  const unfinished = lines(run(JSON.stringify(request(1, 'tools/list'))))
  assert.equal(unfinished[0].error.code, -32700)
})

test('stdio accepts split frames and exits when stdin closes', async () => {
  const child = spawn(process.execPath, [script], {env, stdio: ['pipe', 'pipe', 'pipe']})
  const payload = Buffer.from(JSON.stringify(request(11, 'tools/list')) + '\n')
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const outcome = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({code, signal}))
  })
  const timeout = setTimeout(() => child.kill(), 3000)
  try {
    child.stdin.write(payload.subarray(0, 17))
    child.stdin.end(payload.subarray(17))
    assert.deepEqual(await outcome, {code: 0, signal: null})
    assert.equal(stderr, '')
    assert.equal(lines(stdout)[0].id, 11)
  } finally {
    clearTimeout(timeout)
    if (child.exitCode === null) child.kill()
  }
})

test('returned descriptors cannot mutate the server tool contract', () => {
  handleRequest(request(1, 'tools/list')).result.tools[0].name = 'execute'
  assert.equal(handleRequest(request(2, 'tools/list')).result.tools[0].name, 'read_exercise_note')
})

test('unadvertised methods and unknown pagination cursor fail explicitly', () => {
  assert.equal(handleRequest(request(1, 'resources/list')).error.code, -32601)
  assert.equal(handleRequest(request(2, 'tools/list', {cursor: 'unknown'})).error.code, -32602)
})
