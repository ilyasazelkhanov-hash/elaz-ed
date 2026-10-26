"""Original instructional diagrams and slow step animations; not product screenshots."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent.parent / 'public' / 'learning' / 'ai-practice'
OUT.mkdir(parents=True, exist_ok=True)
FONT = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'
def font(size, bold=False): return ImageFont.truetype(BOLD if bold else FONT, size)
def lines(draw, text, f, width):
    result=[]; current=''
    for word in text.split():
        trial=(current+' '+word).strip()
        if draw.textlength(trial,font=f)>width and current: result.append(current);current=word
        else: current=trial
    return result+[current]
def diagram(item, active=None):
    im=Image.new('RGB',(900,820),'#111521'); d=ImageDraw.Draw(im)
    d.text((48,35),'OG CRE8R²  /  ПРАКТИКА',font=font(23,True),fill='#65e4cc')
    title=lines(d,item['title'],font(39,True),800)
    for i,line in enumerate(title):d.text((48,85+i*48),line,font=font(39,True),fill='#f4f6ff')
    y=215
    for i,label in enumerate(item['diagram']):
        lit=active is None or i==active
        d.rounded_rectangle((48,y,852,y+132),radius=24,fill='#253d43' if lit else '#1b2131',outline='#65e4cc' if lit else '#384055',width=3)
        d.ellipse((70,y+37,122,y+89),fill='#65e4cc' if lit else '#384055')
        d.text((87,y+44),str(i+1),font=font(30,True),fill='#111521' if lit else '#c4cbdd')
        for j,line in enumerate(lines(d,label,font(31,True),650)):d.text((148,y+28+j*39),line,font=font(31,True),fill='#f4f6ff' if lit else '#abb4cb')
        if i<2:d.line((450,y+138,450,y+157),fill='#a995ff',width=5);d.polygon([(439,y+150),(461,y+150),(450,y+161)],fill='#a995ff')
        y+=164
    d.text((48,758),'Схема процесса · повтори шаги на своей задаче',font=font(23),fill='#aab5cc')
    return im
items=json.loads((ROOT/'training-media.json').read_text(encoding='utf8'))
for item in items:
    diagram(item).save(OUT/f"lesson-{item['n']}.png",optimize=True)
    if item.get('gif'):
        frames=[diagram(item,i).resize((630,574)) for i in range(3)]
        frames[0].save(OUT/(item['gif']+'.gif'),save_all=True,append_images=frames[1:],duration=1800,loop=0,optimize=True)
# A real example composition used to explain hierarchy and editable text layers.
im=Image.new('RGB',(900,1100),'#111521');d=ImageDraw.Draw(im)
d.rounded_rectangle((48,48,852,1052),radius=32,fill='#1b2434',outline='#414d66',width=3)
d.text((92,92),'УЧЕБНЫЙ МАКЕТ / ФОКУС',font=font(25,True),fill='#65e4cc')
for i,t in enumerate(['Первая','автоматизация']):d.text((92,180+i*82),t,font=font(67,True),fill='#f4f6ff')
for i,(x,y) in enumerate([(280,490),(410,560),(540,490)]):
    d.rounded_rectangle((x,y,x+130,y+130),radius=28,fill=['#65e4cc','#a995ff','#f7c47e'][i])
d.text((92,760),'7 ноября · 19:00 Алматы',font=font(41,True),fill='#f4f6ff')
d.text((92,825),'45 минут · онлайн · бесплатно',font=font(30),fill='#b8c4d9')
d.rounded_rectangle((92,920,600,994),radius=20,fill='#65e4cc')
d.text((120,937),'Сохрани дату',font=font(34,True),fill='#111521')
im.save(OUT/'layout-example.png',optimize=True)
print(json.dumps({'pictures':len(items)+1,'animations':3,'bytes':sum(p.stat().st_size for p in OUT.iterdir())}))
