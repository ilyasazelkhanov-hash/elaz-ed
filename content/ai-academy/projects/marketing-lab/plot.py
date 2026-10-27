import os,json
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR','/tmp/academy-marketing-mpl')
os.environ.setdefault('XDG_CACHE_HOME','/tmp/academy-marketing-fonts')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent;data=json.loads((root/'report.json').read_text());out=root/'plots';out.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(figsize=(8,4.5));values=[data['campaign']['uniqueRevenue'],data['campaign']['platformReportedRevenue']];bars=ax.bar(['Уникальные заказы','Сумма платформенных кредитов'],values,color=['#63418d','#b15f43'])
for bar,value in zip(bars,values):ax.text(bar.get_x()+bar.get_width()/2,value+1200,f'{value:,} ₸',ha='center')
ax.set_ylim(0,90000);ax.set_ylabel('Учебная выручка, ₸');ax.set_title('Пересечение атрибуции не создаёт новые продажи')
fig.text(.5,.02,'Синтетические данные · 8 уникальных заказов · платформы суммарно заявляют 11',ha='center',fontsize=9);fig.tight_layout(rect=(0,.06,1,1));fig.savefig(out/'attribution.png',dpi=160);plt.close(fig)
row=data['experiment'];center=row['difference']*100
fig,ax=plt.subplots(figsize=(8,3.8));ax.errorbar([center],[0],xerr=[[center-row['ci95Low']*100],[row['ci95High']*100-center]],fmt='o',color='#63418d',capsize=8,linewidth=3);ax.axvline(0,color='#666',linestyle='--');ax.set_xlim(-10,30);ax.set_ylim(-1,1);ax.set_yticks([]);ax.set_xlabel('Разница treatment − control, процентные пункты');ax.set_title('Наблюдаемые +10 п.п. не устраняют неопределённость')
fig.text(.5,.03,'Синтетические группы по 100 · приблизительный 95% интервал · допущение независимости',ha='center',fontsize=8);fig.tight_layout(rect=(0,.10,1,1));fig.savefig(out/'incrementality.png',dpi=160);plt.close(fig)
print('Rendered two figures from the synthetic report.')
