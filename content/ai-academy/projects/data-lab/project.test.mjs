import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
test('Python analytics suite executes at least ten unskipped tests',()=>{const binary=process.env.PYTHON??(process.platform==='win32'?'python':'python3');const result=spawnSync(binary,['-m','unittest','test_analysis.py','-v'],{cwd:fileURLToPath(new URL('./',import.meta.url)),env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'},encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.error?`Python unavailable (${binary}): ${result.error.message}. Set PYTHON to a Python 3.12+ executable.`:result.stderr);const count=Number(result.stderr.match(/Ran (\d+) tests/)?.[1]);assert.ok(count>=10);assert.match(result.stderr,/\r?\nOK\r?\n/)})
