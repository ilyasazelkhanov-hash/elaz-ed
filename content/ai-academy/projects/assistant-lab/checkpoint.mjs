import {TaskStore} from './tasks.mjs'
const command=process.argv[2],file=process.argv[3]||'checkpoint.sqlite',store=new TaskStore(file)
const owner={id:'learner',role:'student'},reviewer={id:'fictional-teacher',role:'reviewer'},id='TASK-CHECKPOINT'
try{
 if(command==='prepare'){const task=store.create(owner,id,'Вымышленное обращение: уточнить стоимость ремонта.');if(task.state==='draft')store.approve(reviewer,id,task.version);console.log(JSON.stringify({state:store.read(owner,id).state,notice:'Подтверждение учебного reviewer имитируется кодом. Это не система аутентификации преподавателя.'}))}
 else if(command==='execute'){store.execute(owner,id);console.log(JSON.stringify({state:store.read(owner,id).state,localTickets:store.count(),externalDelivery:false}))}
 else if(command==='cancel'){store.cancel(owner,id);console.log(JSON.stringify({state:store.read(owner,id).state}))}
 else throw Error('Use prepare, execute or cancel, followed by a path to an isolated teaching SQLite file.')
}finally{store.close()}
