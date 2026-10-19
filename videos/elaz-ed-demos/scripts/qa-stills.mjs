import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, 'out', 'qa');
await mkdir(output, {recursive:true});
const serveUrl = await bundle({entryPoint:path.join(root,'src/index.ts'),outDir:path.join(root,'out','qa-bundle')});
const browser = await openBrowser('chrome', {browserExecutable:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const frames = [0,75,149,150,210,320,359,360,400,495,610,629,630,690,750,840,869,870,920,1020,1079,1080,1110,1280,1319,1320,1360,1430,1510,1560,1589,1590,1695,1799];
try {
 const composition = await selectComposition({serveUrl,id:'ElazEdEmployeesDemo',puppeteerInstance:browser});
 for (const frame of frames) {
   await renderStill({serveUrl,composition,puppeteerInstance:browser,frame,output:path.join(output, String(frame).padStart(4,'0')+'.png'),scale:0.5,logLevel:'error'});
   console.log('Verified frame '+frame);
 }
 await writeFile(path.join(output,'verification.json'),JSON.stringify({composition:composition.id,width:composition.width,height:composition.height,fps:composition.fps,durationInFrames:composition.durationInFrames,frames,verifiedAt:new Date().toISOString()},null,2));
} finally {await browser.close({silent:true});}
