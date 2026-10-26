import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('./',import.meta.url)),brief=JSON.parse(await readFile(root+'brief.json','utf8'))
const names=['01-question','02-photo','03-detail','04-options','05-next']
const assets=names.map((name,i)=>({id:name,file:`assets/${name}.png`,width:1080,height:1350,origin:'original_author_vector_render_not_ai',alt:['Сумка с заплаткой: вопрос о сохранении вещи','Та же сумка: подготовить фото','Крупная деталь шва и заплатки','Та же сумка: обсудить варианты ремонта','Та же сумка: подготовить вопрос'][i],rights:{state:'owned',record:'Original author SVG in this learning archive'},dependencies:[`assets/${name}.svg`],claims:[]}))
for(const [name,seconds] of [['intro',15],['campaign',12]])assets.push({id:name,file:`assets/${name}.mp4`,width:360,height:640,seconds,origin:'procedural_card_montage_with_local_flite_speech_not_ai_video',alt:'Пять учебных карточек вымышленной мастерской; английская синтетическая речь и русские субтитры',rights:{state:'owned',record:'Original vector artwork and original narration text; locally synthesized flite speech'},dependencies:[`assets/${name}.vtt`,'assets/voice.wav'],claims:[]})
await writeFile(root+'manifest.json',JSON.stringify({version:1,fictional:true,creator:brief.creator,facts:brief.facts,budget:brief.budget,assets},null,2)+'\n')
