const status=document.getElementById('status')
try{
 const response=await fetch('manifest.json');if(!response.ok)throw Error('missing_manifest')
 const manifest=await response.json(),gallery=document.getElementById('gallery')
 for(const asset of manifest.assets.filter(a=>a.file.endsWith('.png'))){
  if(!/^assets\/[a-z0-9-]+\.png$/.test(asset.file))throw Error('invalid_asset_path')
  const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption')
  image.src=asset.file;image.alt=asset.alt;image.width=asset.width;image.height=asset.height;image.loading='lazy';caption.textContent=asset.alt;figure.append(image,caption);gallery.append(figure)
 }
 status.textContent=`В манифесте ${manifest.assets.length} материалов. Учебный бюджет: цена ${manifest.budget.price} ₸; он не является рыночной оценкой.`
}catch{status.setAttribute('role','alert');status.textContent='Не удалось прочитать манифест. Восстанови файлы из архива и открой папку через локальный HTTP-сервер.'}
