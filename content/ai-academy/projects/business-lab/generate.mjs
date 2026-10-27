import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {meetingPacket,agenda,followup} from './work.mjs'
const root=fileURLToPath(new URL('./',import.meta.url)),meeting=JSON.parse(await readFile(root+'meeting.json','utf8')),packet=meetingPacket(meeting)
const output={packet,agenda:agenda([{title:'Цель',minutes:5,decision:'Подтвердить задачу'},{title:'Evidence',minutes:10,decision:'Определить известное и пробелы'},{title:'Варианты',minutes:10,decision:'Выбрать ограниченную проверку'},{title:'Следующие шаги',minutes:5,decision:'Назначить действия или отметить неизвестное'}],30)}
await writeFile(root+'packet.json',JSON.stringify(output,null,2)+'\n');await writeFile(root+'follow-up.md',followup(packet)+'\n');console.log('Generated a thirty-minute agenda, sourced meeting packet and unsent follow-up draft from synthetic notes.')
