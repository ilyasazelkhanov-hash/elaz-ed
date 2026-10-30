import {spawnSync} from 'node:child_process'
export function checkEnvironment(env=process.env){
 const problems=[],versions={node:process.versions.node}
 if(Number(process.versions.node.split('.')[0])!==24)problems.push('Use Node 24 (CI pins 24.19.0).')
 const commands={python:[env.PYTHON??(process.platform==='win32'?'python':'python3'),['--version']],ffprobe:['ffprobe',['-version']],ffmpeg:['ffmpeg',['-version']]}
 for(const [name,[binary,args]] of Object.entries(commands)){
  const result=spawnSync(binary,args,{env,encoding:'utf8',timeout:10000,windowsHide:true})
  if(result.error||result.status!==0){problems.push(`${name} unavailable (${binary}). Install test dependencies; set PYTHON or add FFmpeg bin to PATH.`);continue}
  versions[name]=(result.stdout||result.stderr).split(/\r?\n/)[0]
  if(name==='python'&&!/Python 3\.(1[2-9]|[2-9]\d)\./.test(versions[name]))problems.push('Python 3.12+ required.')
 }
 return {problems,versions}
}
