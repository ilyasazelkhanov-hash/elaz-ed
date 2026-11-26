import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'
import {createElement,useState} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {editorialReviewLabel,editorialReviewStatus} from '../src/lib/editorial.ts'
let nonce=0
const Tap=({children,feedback,onClick,...props})=>createElement('button',props,children)
const state={push(){throw Error('render cannot navigate')},pop(){},stack:[],feed:[],guard(){},toast(){},boot(){}}
const useStore=selector=>selector(state);useStore.getState=()=>state
async function load(file, overrides={}, initial=[]){
 const url=new URL(`../src/screens/${file}.tsx`,import.meta.url)
 let code=(await transformWithOxc(await readFile(url,'utf8'),url.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__adminUX;`)
 for(const name of ['react','react/jsx-runtime','motion/react','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let index=0;globalThis.__adminState=value=>useState(index in initial?initial[index++]:((index++),value))
 code=code.replace(/useState\(/g,'globalThis.__adminState(')
 globalThis.__adminUX={useStore,Tap,Cta:Tap,EmojiTile:()=>null,Spinner:()=>null,CoverImage:()=>null,inTelegram:false,sheet:{},Header:({title,right})=>createElement('header',null,title,right),api:new Proxy({},{get(){throw Error('SSR cannot call API')}}),errorText:String,editorialReviewLabel,editorialReviewStatus,GRADIENT_NAMES:[],GRADIENTS:{},readMinutes:()=>1,newsCategories:()=>[],slidesOf:()=>[''],...overrides}
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++nonce}`)
}
test('admin task hub prioritizes create and keeps statistics/archive folded',async()=>{
 const {AdminScreen}=await load('Admin')
 const html=renderToStaticMarkup(createElement(AdminScreen))
 assert.match(html,/Быстрые действия/);assert.match(html,/Материалы курсов/)
 assert.match(html,/<details[^>]*><summary[^>]*tabindex="0"[^>]*>Статистика приложения/)
 assert.match(html,/Архивные курсы и доступы/)
 assert.doesNotMatch(html,/<details[^>]*open/)
 assert.ok(html.indexOf('Быстрые действия')<html.indexOf('Статистика приложения'))
})
test('content filters disclose loaded-only scope and keep global title search',async()=>{
 const {AdminScreen}=await load('Admin')
 const html=renderToStaticMarkup(createElement(AdminScreen,{scope:'blog'}))
 assert.match(html,/Поиск по заголовку во всём разделе/)
 assert.match(html,/Статус материалов/);assert.match(html,/Черновики/)
 assert.match(html,/только на загруженные материалы/)
 assert.match(html,/aria-pressed="true"[^>]*>Все/)
})
test('editor folds secondary fields, shows publication state and clearly marks saving preview',async()=>{
 const {EditorScreen}=await load('AdminEditor')
 const html=renderToStaticMarkup(createElement(EditorScreen,{lesson:null,kind:'lesson'}))
 for(const label of ['Оформление и цвет','Первоисточники и проверка','Обложка и медиа','Дополнительные настройки']) assert.ok(html.includes(label),label)
 assert.doesNotMatch(html,/<details[^>]*open/)
 assert.match(html,/aria-label="Заголовок"/);assert.match(html,/aria-label="Текст материала"/)
 assert.match(html,/Сохранить<br\/>и смотреть/)
 assert.doesNotMatch(html,/Удалить навсегда/)
})
test('published material can be hidden from inside the editor without offering deletion',async()=>{
 const {EditorScreen}=await load('AdminEditor')
 const lesson={id:7,title:'Article',body:'Text',kind:'lesson',published:true,editorial:{kind:'evergreen'},quiz:[],minutes:1,xp:0,gradient:'aurora',emoji:'✨',course_id:null}
 const html=renderToStaticMarkup(createElement(EditorScreen,{lesson,kind:'lesson'}))
 assert.doesNotMatch(html.slice(0,html.indexOf('</header>')),/Удалить/)
 assert.match(html,/Снять с публикации/)
 assert.doesNotMatch(html,/Удаление материала|Удалить навсегда/)
})
test('legacy operations open on requests instead of an endless list plus payment controls',async()=>{
 const {CoursesAdminScreen}=await load('AdminCourses')
 const html=renderToStaticMarkup(createElement(CoursesAdminScreen))
 assert.match(html,/Управление архивными курсами/);assert.match(html,/Загружаем заявки/)
 assert.doesNotMatch(html,/Вернуть|Новый курс|Поиск покупок/)
})

test('draft filter never hides pagination when loaded page contains only published posts',async()=>{
 const items=[{id:1,title:'Published',published:true,kind:'lesson',editorial:{kind:'evergreen'}}]
 const {AdminScreen}=await load('Admin',{},[items,null,'','',null,12,false,'draft',false,'',0,false])
 const html=renderToStaticMarkup(createElement(AdminScreen,{scope:'blog'}))
 assert.doesNotMatch(html,/Редактировать: Published/)
 assert.match(html,/Сбросить фильтры/);assert.match(html,/Загрузить ещё/)
 assert.match(html,/Показано 0 из 1 загруженных/)
})
test('payment view retains search, refresh and error recovery without course editor clutter',async()=>{
 const {CoursesAdminScreen}=await load('AdminCourses',{},[[],[],'payments',''])
 const html=renderToStaticMarkup(createElement(CoursesAdminScreen))
 assert.match(html,/Поиск покупок/);assert.match(html,/Обновить статусы/)
 assert.doesNotMatch(html,/Новый курс|Новых заявок нет/)
})
test('course request failure has retry instead of endless loading',async()=>{
 const {CoursesAdminScreen}=await load('AdminCourses',{},[null,[],'requests','Offline'])
 const html=renderToStaticMarkup(createElement(CoursesAdminScreen))
 assert.match(html,/role="alert"/);assert.match(html,/Повторить загрузку/)
 assert.doesNotMatch(html,/Загружаем заявки/)
})

test('course editor cannot hard-delete purchases and offers reversible hiding',async()=>{
 const {CourseEditorScreen}=await load('AdminCourses')
 const html=renderToStaticMarkup(createElement(CourseEditorScreen,{course:{id:1,title:'Paid',published:true,price_stars:500,invite_unlock:0,emoji:'🎓',gradient:'aurora'}}))
 assert.doesNotMatch(html,/Удалить курс/)
 assert.match(html,/сохрани его как черновик/)
 assert.match(html,/покупки и выданные доступы сохранятся/)
})
