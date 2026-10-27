import {parsePilot,pilotMetrics,pilotDecision} from './economics.mjs'
import {choosePortfolio} from './portfolio.mjs'
import {policyDecision} from './governance.mjs'
const element=id=>document.getElementById(id),money=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0})
async function read(name,json=true){const response=await fetch(name);if(!response.ok)throw Error('fixture_unavailable');return json?response.json():response.text()}
try{
 const [csv,scenario,portfolio,policy]=await Promise.all([read('pilot.csv',false),read('scenario.json'),read('portfolio.json'),read('policy.json')]),metrics=pilotMetrics(parsePilot(csv))
 for(const [label,value]of [['Вручную, мин',metrics.manualMinutes],['Полный AI-процесс, мин',metrics.assistedMinutes],['Качество AI',`${metrics.assistedQualityRate*100}%`],['Сопоставимых пар',metrics.comparablePairs]]){const card=document.createElement('div');card.className='metric';const number=document.createElement('strong');number.textContent=String(value);card.append(number,document.createTextNode(label));element('metrics').append(card)}
 element('gate').textContent=pilotDecision(metrics,scenario.qualityGate).decision==='revise_before_scaling'?'Решение по учебному порогу: доработать до масштабирования. Качество ниже 90%.':'Требуется отдельное ревью решения.'
 function renderPortfolio(){
  const budget=Number(element('budget').value),effortLimit=Number(element('effort').value);element('budget-value').textContent=money.format(budget)
  if(!element('effort').value||!Number.isFinite(effortLimit)||effortLimit<0||effortLimit>500||!Number.isInteger(effortLimit)){element('selection').textContent='Введите целое число часов от 0 до 500.';return}
  const result=choosePortfolio({...portfolio,budget,effortLimit});element('selection').textContent=`Выбрано: ${result.ids.join(' + ')||'ничего'}. Внедрение: ${money.format(result.setupCost)} ₸; часы: ${result.effortHours}; сценарная оценка ёмкости минус стоимость: ${money.format(result.scenarioNetCapacityValue)} ₸ за 12 месяцев.`
 }
 function renderProjects(){element('projects').replaceChildren();const query=element('search').value.toLocaleLowerCase('ru');for(const p of portfolio.projects.filter(p=>(p.id+' '+p.title).toLocaleLowerCase('ru').includes(query))){const item=document.createElement('li');item.textContent=`${p.id}: ${p.title}. Зависимости: ${p.dependencies.join(', ')||'нет'}. Учебный допуск: ${p.approved?'да':'нет'}.`;element('projects').append(item)}}
 function renderPolicy(){const decision=policyDecision(policy,{tool:element('tool').value,dataClass:element('data-class').value,purpose:'summary',action:'prepare_draft',policyVersion:policy.version});element('policy-result').textContent=decision.allowed?'Локальное правило допускает подготовку черновика. Реального разрешения и отправки нет.':'Локальное правило отклоняет это сочетание данных и инструмента.'}
 for(const id of ['budget','effort'])element(id).addEventListener('input',renderPortfolio)
 element('search').addEventListener('input',renderProjects);for(const id of ['tool','data-class'])element(id).addEventListener('change',renderPolicy)
 renderPortfolio();renderProjects();renderPolicy();element('loading').hidden=true
}catch{element('loading').hidden=true;element('error').hidden=false}
