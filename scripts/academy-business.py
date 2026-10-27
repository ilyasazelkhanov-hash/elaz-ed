"""Rebuild the own business teaching archive and public panel; Python standard library."""
from pathlib import Path
import io, shutil, zipfile
root=Path(__file__).resolve().parents[1]
source=root/'content/ai-academy/projects/business-lab'
public=root/'public/learning/academy'
allow=['index.html','panel.css','panel.mjs','economics.mjs','portfolio.mjs','governance.mjs','pilot.csv','scenario.json','portfolio.json','policy.json','figures/pilot-time.png','figures/cost-scenarios.png']
for name in allow:
    target=public/'business-lab'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source/name,target)
stream=io.BytesIO()
with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as archive:
    for item in sorted(source.rglob('*')):
        if not item.is_file() or any(x in item.parts for x in ['node_modules','__pycache__','.venv']):continue
        entry=zipfile.ZipInfo('business-lab/'+str(item.relative_to(source)),date_time=(2026,10,27,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        archive.writestr(entry,item.read_bytes())
with zipfile.ZipFile(io.BytesIO(stream.getvalue())) as archive:assert archive.testzip() is None
(public/'business-lab.zip').write_bytes(stream.getvalue())
print('Business archive and standalone panel rebuilt from own synthetic fixtures.')
