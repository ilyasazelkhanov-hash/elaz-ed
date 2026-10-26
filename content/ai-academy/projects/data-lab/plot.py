"""Generate original publication-ready charts from the synthetic teaching fixture."""
import json
import os
import tempfile
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir())/'academy-matplotlib'))
font_cache = Path(tempfile.gettempdir())/'academy-font-cache'
font_cache.mkdir(exist_ok=True)
os.environ.setdefault('XDG_CACHE_HOME', str(font_cache))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from analysis import ROOT, report, series

data = report()
(ROOT/'report.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
out = ROOT/'plots'
out.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'white'})
colors = ['#7350b4','#247c70','#a3651c']
fig,ax = plt.subplots(figsize=(8,4.5))
channels = ['web','phone','referral']
values = [sum(row['total_kzt'] for row in data['rows'] if row['channel']==channel) for channel in channels]
counts = [sum(row['channel']==channel for row in data['rows']) for channel in channels]
bars=ax.bar(channels,values,color=colors)
for bar,value,n in zip(bars,values,counts):
    ax.text(bar.get_x()+bar.get_width()/2,value+100,f'{value:,} ₸\nn={n}',ha='center',va='bottom')
ax.set_ylim(0,8000)
ax.set_ylabel('Тенге, сумма принятых заказов')
ax.set_title('Учебная выручка по каналам')
fig.text(.5,.02,'Синтетические данные · 8 заказов · сравнение не доказывает причину',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,1))
fig.savefig(out/'revenue-by-channel.png',dpi=160)
plt.close(fig)
fig,ax = plt.subplots(figsize=(8,4.5))
delays=[row['actual_days']-row['promised_days'] for row in data['rows']]
values=[delays.count(value) for value in [0,1,2]]
ax.bar([0,1,2],values,color=colors)
for x,value in enumerate(values):ax.text(x,value+.08,str(value),ha='center')
ax.set_xticks([0,1,2]);ax.set_ylim(0,5);ax.set_yticks(range(6));ax.set_xlabel('Дней сверх обещанного срока');ax.set_ylabel('Принятые заказы');ax.set_title('Распределение задержки')
fig.text(.5,.02,'Синтетические данные · 3 исходные строки исключены по контракту очистки',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,1));fig.savefig(out/'delay-distribution.png',dpi=160);plt.close(fig)
fig,ax=plt.subplots(figsize=(9,4.5))
observations=series();dates=[date for date,_ in observations]
ax.plot(range(len(dates)),[value for _,value in observations],color='#414047',linewidth=1.7,label='Фактический учебный ряд')
for method,color,style in [('seasonal',colors[0],'-'),('mean',colors[1],'--'),('linear',colors[2],':')]:
    row=data['backtests'][method]
    ax.plot(range(42,56),row['predictions'],color=color,linestyle=style,linewidth=2,label=f'{method}: MAE={row["mae"]:.2f}')
ax.axvline(41.5,color='#777',linestyle='--',linewidth=1)
ax.set_xticks([0,14,28,42,55],[dates[i] for i in [0,14,28,42,55]])
ax.set_ylabel('Число учебных обращений');ax.set_title('Rolling backtest: прогноз на 7 дней, обновление каждую неделю');ax.legend(fontsize=9,loc='upper left')
fig.text(.5,.02,'Синтетический ряд · первые 42 дня — исходная история · будущие данные не передаются прогнозу',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,1));fig.savefig(out/'backtest.png',dpi=160);plt.close(fig)
fig,ax=plt.subplots(figsize=(8,3.8))
experiment=data['experiment']
center=experiment['difference']*100
ax.errorbar([center],[0],xerr=[[center-experiment['ci95_low']*100],[experiment['ci95_high']*100-center]],fmt='o',color=colors[0],capsize=8,linewidth=3,markersize=8)
ax.axvline(0,color='#555',linestyle='--')
ax.set_xlim(-30,40);ax.set_ylim(-1,1);ax.set_yticks([]);ax.set_xlabel('Разница B − A, процентные пункты');ax.set_title('A/B-пример: +10 п.п. с большой неопределённостью')
fig.text(.5,.04,'Синтетические группы по 50 · приблизительный 95% интервал · независимая нормальная аппроксимация',ha='center',fontsize=8)
fig.tight_layout(rect=(0,.10,1,1));fig.savefig(out/'experiment-ci.png',dpi=160);plt.close(fig)
print(json.dumps({'orders':data['kpis']['orders'],'revenue_kzt':data['kpis']['revenue_kzt'],'plots':4,'backtest_mae':{key:value['mae'] for key,value in data['backtests'].items()}},ensure_ascii=False))
