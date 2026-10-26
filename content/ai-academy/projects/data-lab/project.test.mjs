import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
test('Python analytics suite executes at least ten unskipped tests',()=>{const result=spawnSync('python3',['-m','unittest','test_analysis.py','-v'],{cwd:fileURLToPath(new URL('./',import.meta.url)),env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);const count=Number(result.stderr.match(/Ran (\d+) tests/)?.[1]);assert.ok(count>=10);assert.match(result.stderr,/\nOK\n/)})
