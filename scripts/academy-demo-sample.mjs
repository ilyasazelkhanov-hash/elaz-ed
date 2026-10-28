/** Deliberately public demo: one module, independent checks, no live grading keys. */
export function academyDemoSample(catalog) {
 const copy=structuredClone(catalog)
 const entities=copy.entities.filter(n=>['CORE-000','CORE-000-M1'].includes(n.code)||(n.kind==='lesson'&&n.parent_code==='CORE-000-M1'))
 const codes=new Set(entities.map(n=>n.code))
 const assessments=copy.entities.filter(n=>n.kind==='assessment'&&codes.has(n.parent_code))
 const rubrics=new Set(assessments.map(n=>n.data.rubric_code).filter(Boolean))
 const links=copy.links.filter(l=>codes.has(l.target_code))
 entities.push(...assessments,...copy.entities.filter(n=>rubrics.has(n.code)||(n.kind==='source'&&links.some(l=>l.source_code===n.code))))
 for(const n of entities){
  if(n.kind==='assessment'){
   n.code=`DEMO-${n.code}`;n.title=`${n.title} · демо`
   if(n.data.rubric_code)n.data.rubric_code=`DEMO-${n.data.rubric_code}`
   if(n.data.kind==='quiz')n.data.questions=[
    {id:'demo-local-progress',prompt:'Где хранится прогресс этой демонстрации?',choices:['В рабочем курсе','Только на этом устройстве','В Telegram-канале'],answer:1},
    {id:'demo-isolated',prompt:'Изменяет ли демо результаты основного обучения?',choices:['Да','Нет'],answer:1},
   ]
  }
  if(n.kind==='rubric')n.code=`DEMO-${n.code}`
 }
 const course=entities.find(n=>n.code==='CORE-000')
 course.title='Знакомство с обучением · демо'
 course.data={level:'Core',hours:1,outcome:'Попробуй вводный модуль: чтение, практика и проверка. Демо-прогресс хранится только на этом устройстве.'}
 return {entities,links,prerequisites:[]}
}
