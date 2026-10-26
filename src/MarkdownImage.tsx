import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn } from 'lucide-react'

export function MarkdownImage({ src, alt = '' }: { src?: string; alt?: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  if (!src) return null
  return <>
    <button type="button" className="learning-image" aria-label={`Увеличить изображение: ${alt}`} onClick={() => setOpen(true)}>
      <img src={src} alt={alt} loading="lazy" />
      <span><ZoomIn size={14} /> Нажми, чтобы увеличить</span>
    </button>
    {open && createPortal(<dialog ref={dialog} className="learning-image-dialog" aria-label={alt || 'Увеличенное изображение'} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <button type="button" className="learning-image-close" aria-label="Закрыть изображение" onClick={() => dialog.current?.close()}><X size={22} /></button>
      <div className="learning-image-full"><img src={src} alt={alt} /></div>
      {alt && <p>{alt}</p>}
    </dialog>, document.body)}
  </>
}
