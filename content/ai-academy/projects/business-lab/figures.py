"""Optional plot generation, Matplotlib 3.10.8; all values are synthetic."""
import json
from pathlib import Path
import os
os.environ.setdefault('MPLCONFIGDIR','/tmp/elaz-business-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent
report=json.loads((root/'report.json').read_text())
output=Path(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else root/'figures'
output.mkdir(parents=True,exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12})
fig,ax=plt.subplots(figsize=(9,5),layout='constrained')
metrics=report['metrics'];values=[metrics['manualMinutes'],metrics['draftMinutes'],metrics['assistedMinutes']]
ax.bar(['Вручную','Только черновик','Черновик + ревью\n+ исправления'],values,color=['#627693','#c5a768','#4a9e91'])
for i,value in enumerate(values):ax.text(i,value+5,str(value),ha='center')
ax.set(ylim=(0,300),ylabel='Минуты, 8 синтетических задач',title='Полный процесс важнее скорости генерации')
fig.supxlabel('Качество AI: 6/8. Это учебный набор, не результат реального пилота.',fontsize=10)
fig.savefig(output/'pilot-time.png',dpi=150);plt.close(fig)
fig,ax=plt.subplots(figsize=(9,5),layout='constrained')
scenarios=report['scenarios'];x=list(range(len(scenarios)))
ax.bar([v-.18 for v in x],[s['totalCapacityValue']/1000 for s in scenarios],width=.36,label='Оценка высвобождённой ёмкости')
ax.bar([v+.18 for v in x],[s['totalCost']/1000 for s in scenarios],width=.36,label='Полная стоимость')
ax.set(xticks=x,xticklabels=['3 мин/задачу','6 мин/задачу','10 мин/задачу'],ylabel='Тысяч ₸ за 3 месяца',title='Сценарии стоимости: исходные допущения вымышлены')
ax.legend(fontsize=10);fig.supxlabel('Оценка времени в деньгах не доказывает денежную экономию.',fontsize=10)
fig.savefig(output/'cost-scenarios.png',dpi=150);plt.close(fig)
