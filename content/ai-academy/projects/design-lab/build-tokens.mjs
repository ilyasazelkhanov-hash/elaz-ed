import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('./',import.meta.url)),tokens=JSON.parse(await readFile(root+'tokens.json','utf8'))
if(!Number.isInteger(tokens.version)||Object.values(tokens.colors).some(v=>!/^#[0-9a-f]{6}$/i.test(v))||Object.values(tokens.space).some(v=>!Number.isFinite(v)||v<0)||!Number.isFinite(tokens.radius))throw Error('invalid_tokens')
const css=':root{'+Object.entries(tokens.colors).map(([key,value])=>`--${key}:${value}`).join(';')+';'+Object.entries(tokens.space).map(([key,value])=>`--space-${key}:${value}px`).join(';')+`;--radius:${tokens.radius}px}\n`
await writeFile(root+'tokens.css',css);console.log('Built design token CSS version',tokens.version)
