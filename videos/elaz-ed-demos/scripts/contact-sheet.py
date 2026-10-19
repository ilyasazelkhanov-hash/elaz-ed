from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
frames = [75, 320, 610, 840, 1020, 1280, 1560, 1695]
sheet = Image.new('RGB', (1080, 1024), '#071630')
for i, frame in enumerate(frames):
 image = Image.open(root / 'out' / 'qa' / (str(frame).zfill(4)+'.png')).convert('RGB')
 image.thumbnail((270, 480))
 x,y = (i%4)*270,(i//4)*512
 sheet.paste(image,(x,y))
 ImageDraw.Draw(sheet).text((x+12,y+486),f'{frame/30:.1f}s',fill='#FFD166')
sheet.save(root/'out'/'storyboard-preview.jpg',quality=93)
