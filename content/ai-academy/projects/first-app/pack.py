"""Developer-only rebuild; Python standard library. Does not start the app or publish externally."""
from pathlib import Path
import io,shutil,zipfile
source=Path(__file__).resolve().parent
root=source.parents[3]
public=root/'public/learning/academy'
for name in ['index.html','style.css','app.mjs','request.mjs']:
 target=public/'first-app'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/name,target)
stream=io.BytesIO()
with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED)as archive:
 files=['README.md','index.html','style.css','app.mjs','request.mjs','server.mjs','request.test.mjs','capture.cjs','pack.py']
 files+=['react-starter/'+name for name in ['README.md','package.json','package-lock.json','vite.config.js','index.html','src/App.jsx','src/main.jsx','src/style.css']]
 for name in files:
  item=source/name
  if item.is_symlink() or not item.is_file():raise ValueError('Expected own regular file: '+name)
  entry=zipfile.ZipInfo('first-app/'+name,date_time=(2026,10,27,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(entry,item.read_bytes())
with zipfile.ZipFile(io.BytesIO(stream.getvalue()))as archive:assert archive.testzip()is None
(public/'first-app.zip').write_bytes(stream.getvalue())
print('Explicit static copy and first-app.zip rebuilt.')
