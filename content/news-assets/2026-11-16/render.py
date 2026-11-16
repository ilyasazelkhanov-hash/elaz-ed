from PIL import Image, ImageDraw, ImageFont
import math, os, json
P='/workspace/shared/og-news-2026-11-16/assets'
W,H=960,540
BG='#efecf8'; INK='#211638'; V='#6a4df0'; M='#6b6083'; LINE='#d3cbe4'; WHITE='#ffffff'; GREEN='#087552'
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def f(s,b=False):return ImageFont.truetype(bold if b else font,s)
def text(d,xy,s,size=22,color=INK,b=False): d.text(xy,s,font=f(size,b),fill=color)
def box(d,xy,fill=WHITE,outline=None,r=20): d.rounded_rectangle(xy,r,fill=fill,outline=outline,width=2)
def center(d,xy,s,size=20,color=INK,b=False):
 bb=d.textbbox((0,0),s,font=f(size,b));text(d,(xy[0]-(bb[2]-bb[0])/2,xy[1]-(bb[3]-bb[1])/2-4),s,size,color,b)
def flow(d,a,b,t):
 d.line([a,b],fill=LINE,width=3)
 x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
 d.ellipse((x-7,y-7,x+7,y+7),fill=V)
def card(d,xy,title,sub=None,active=False):
 x,y,w,h=xy;box(d,(x,y,x+w,y+h), '#e0d7ff' if active else WHITE)
 center(d,(x+w/2,y+28),title,21,INK,True)
 if sub:center(d,(x+w/2,y+59),sub,16,M)
def base(i,title,kicker,sub):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 text(d,(40,24),'OG CRE8R',18,V,True);text(d,(760,24),'НОВОСТИ / 2026',14,M)
 d.line((40,59,920,59),fill=LINE,width=1)
 text(d,(40,79),kicker.upper(),16,V,True)
 text(d,(38,109),title,43,INK,True);text(d,(40,171),sub,21,M)
 text(d,(40,502),'СХЕМА ВОЗМОЖНОСТЕЙ · НЕ ИНТЕРФЕЙС ПРОДУКТА',12,M)
 text(d,(860,500),f'{i:02d} / 06',14,V,True)
 return im,d
items=[('claude-meetings','Claude Meetings','Встреча → результат','Не только протокол: задачи и материалы во время встречи.'),('chatgpt-wallet','ChatGPT Wallet','Покупка под контролем','Агент готовит оплату. Решение остаётся за человеком.'),('gemini-hydrogen','Gemini 4 Hydrogen','Модель для агентных задач','От запроса к коду, инструментам и проверке результата.'),('gemini-decisions','Gemini Decisions API','Выбор из заданных вариантов','Отдельная модель Gemini Decision 1, не Hydrogen.'),('claude-manufacturing','Claude for Manufacturing','Помощник для производства','Анализ, расчёты и отчёты. Не управление оборудованием.'),('elevenlabs-routines','ElevenLabs Routines','Анонс автоматизации','Сценарии до, во время и после разговора.')]
for idx,(slug,title,kicker,sub) in enumerate(items,1):
 frames=[]
 for n in range(40):
  t=n/40;im,d=base(idx,title,kicker,sub)
  if idx==1:
   box(d,(40,233,322,462));text(d,(64,249),'GOOGLE MEET',15,V,True)
   for j in range(3):
    x=88+j*88;d.ellipse((x-22,295,x+22,339),fill=['#bba8ef','#8b72c4','#c7bdda'][j]);d.arc((x-25,345,x+25,390),180,360,fill=V,width=5)
   for j in range(19):
    h=8+13*(1+math.sin(j*.8+t*math.tau*2));x=65+j*12;d.line((x,427-h/2,x,427+h/2),fill=V,width=3)
   for j,(a,b) in enumerate([('Заметки','Главное из обсуждения'),('Задачи','Следующие шаги'),('Материалы','Документы и доски')]):
    y=233+j*78;flow(d,(322,347),(414,y+34),(t+j/3)%1);box(d,(414,y,920,y+68));text(d,(438,y+20),a,21,INK,True);text(d,(635,y+24),b,16,M)
  elif idx==2:
   for a,b in [((266,331),(357,331)),((601,331),(692,331))]:flow(d,a,b,t)
   card(d,(40,269,226,126),'Покупка','Товар и сумма')
   card(d,(357,254,244,155),'Подтверждение','Человек проверяет',True)
   box(d,(428,352,530,389),V,r=18);center(d,(479,370),'Да',20,WHITE,True)
   card(d,(692,269,228,126),'Оплата','Токен вместо карты')
   text(d,(40,437),'СТАРТ: США · PRO · 18+ · ПОДХОДЯЩИЕ КАРТЫ',18,V,True)
  elif idx==3:
   coords=[(40,277,190,110),(270,277,190,110),(500,277,190,110),(730,277,190,110)]
   for j in range(3):flow(d,(coords[j][0]+190,332),(coords[j+1][0],332),(t*2)%1)
   for j,(title2,sub2) in enumerate([('Запрос','Цель и контекст'),('Код','Решение'),('Инструменты','Действия'),('Проверка','Результат')]):card(d,coords[j],title2,sub2,j==int(t*4))
   d.arc((144,310,811,455),0,180,fill=LINE,width=2);text(d,(357,432),'Цикл агентной работы',18,V)
  elif idx==4:
   card(d,(40,270,242,135),'Один вход','Текст / фото / видео');flow(d,(282,338),(365,338),t)
   box(d,(365,233,920,468));text(d,(390,250),'Заданный выбор',22,INK,True)
   for j,(s,l) in enumerate([('A',.65),('B',.25),('C',.1)]):
    y=300+j*49; text(d,(390,y-4),s,20,V,True);box(d,(438,y,881,y+22),'#eee9f7',r=11);box(d,(438,y,438+443*l,y+22),V if j==0 else '#b7a5eb',r=11)
   x=438+443*(.5+.5*math.sin(t*math.tau));d.ellipse((x-4,446,x+4,454),fill=V)
  elif idx==5:
   card(d,(40,265,230,145),'Данные','Качество / поставки');flow(d,(270,337),(365,337),t)
   card(d,(365,246,230,181),'17 skills','Расчёты и отчёты',True)
   for j in range(3):
    x=395+j*53;y=354;h=21+12*(1+math.sin(t*math.tau+j));box(d,(x,y-h,x+26,y+16),V,r=5)
   flow(d,(595,337),(690,337),t);card(d,(690,265,230,145),'Эксперт','Проверка решения')
   text(d,(40,447),'ПЛАГИН CLAUDE · ЧЕЛОВЕК ОСТАЁТСЯ В КОНТУРЕ',18,V,True)
  else:
   for j,(a,b) in enumerate([('ДО','Подготовка'),('ВО ВРЕМЯ','Разговор'),('ПОСЛЕ','CRM и отчёт')]):
    x=40+j*306;card(d,(x,275,268,136),a,b,int(t*3)==j)
    if j<2:flow(d,(x+268,343),(x+306,343),t)
   for j in range(28):
    x=359+j*8;h=4+7*(1+math.sin(j*.6+t*math.tau));d.line((x,383-h/2,x,383+h/2),fill=V,width=3)
   text(d,(40,446),'АНОНС · ОБЩАЯ ДОСТУПНОСТЬ НЕ ПОДТВЕРЖДЕНА',18,V,True)
  frames.append(im)
 frames[0].save(f'{P}/{slug}.png')
 frames[0].save(f'{P}/{slug}.gif',save_all=True,append_images=frames[1:],duration=80,loop=0,optimize=True,disposal=1)
 print(slug,os.path.getsize(f'{P}/{slug}.gif'))
# QA contact sheet uses first complete frames
sheet=Image.new('RGB',(960,810),BG)
for k,(slug,*_) in enumerate(items):
 im=Image.open(f'{P}/{slug}.png');im.thumbnail((480,270));sheet.paste(im,((k%2)*480,(k//2)*270))
sheet.save(f'{P}/contact-sheet.jpg',quality=92)
