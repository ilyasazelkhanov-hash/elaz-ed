import { Check, CirclePlay, Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { iconFor } from '../../lib/game'
import type { Card } from '../../lib/types'
import { insetOf, useStore } from '../../store'
import { Emoji, EmojiTile, Spinner, Tap } from '../../ui'
import { SectionTitle } from './parts'

/** Сколько материалов показываем за раз: длинная лента догружается порциями. */
const PAGE = 8

/** Лента материалов: поиск, фильтры и крупные карточки. `scroller` — прокручиваемый контейнер экрана. */
export function Feed({ lessons, scroller }: { lessons: Card[]; scroller: RefObject<HTMLDivElement | null> }) {
  const [cat, setCat] = useState('Все')
  const [query, setQuery] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const filters = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const cats = useMemo(() => ['Все', ...new Set(lessons.map((c) => c.category))], [lessons])
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of lessons) map.set(c.category, (map.get(c.category) ?? 0) + 1)
    return map
  }, [lessons])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lessons.filter((c) => (cat === 'Все' || c.category === cat) && (!onlyNew || !c.completed) && (!q || `${c.title} ${c.subtitle} ${c.category}`.toLowerCase().includes(q)))
  }, [lessons, cat, query, onlyNew])
  const left = lessons.filter((c) => !c.completed).length
  const hasMore = list.length > shown

  // Сменился фильтр — снова показываем первую порцию.
  useEffect(() => setShown(PAGE), [cat, query, onlyNew])

  // Лента догружается сама, когда до конца остаётся пара экранов.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((n) => n + PAGE), { root: scroller.current, rootMargin: '700px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, shown, scroller])

  // Подложка у фильтров появляется, только когда они прилипли: в потоке страницы это просто ряд кнопок.
  useEffect(() => {
    const sc = scroller.current
    const bar = filters.current
    if (!sc || !bar) return
    const sync = () => {
      bar.dataset.stuck = String(bar.getBoundingClientRect().top - sc.getBoundingClientRect().top <= (parseFloat(getComputedStyle(bar).top) || 0) + 1)
    }
    sync()
    sc.addEventListener('scroll', sync, { passive: true })
    return () => sc.removeEventListener('scroll', sync)
  }, [scroller, cats.length])

  // Категорию сменили из середины ленты — возвращаем к её началу, иначе новый список окажется выше экрана.
  const pickCat = (c: string, chip: HTMLElement) => {
    setCat(c)
    chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    requestAnimationFrame(() => {
      const sc = scroller.current
      if (!sc || !anchor.current || !filters.current) return
      const y = sc.scrollTop + anchor.current.getBoundingClientRect().top - sc.getBoundingClientRect().top - (parseFloat(getComputedStyle(filters.current).top) || 0)
      if (sc.scrollTop > y) sc.scrollTo({ top: y })
    })
  }

  return (
    <>
      <SectionTitle count={lessons.length}>Все уроки</SectionTitle>

      {lessons.length > 6 && (
        <div className="mx-5 mb-3 flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-card/80 px-4">
            <Search size={17} className="shrink-0 text-faint" />
            <input id="feed-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти урок" enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
            {query && (
              <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-veil/8 text-mute">
                <X size={14} />
              </button>
            )}
          </label>
          <Tap feedback="select" onClick={() => setOnlyNew((v) => !v)} aria-pressed={onlyNew} className={`tabular h-11 shrink-0 rounded-full border px-4 text-[13.5px] font-semibold ${onlyNew ? 'border-violet/60 bg-violet/15 text-ink' : 'border-line bg-card/80 text-mute'}`}>
            Новые {left}
          </Tap>
        </div>
      )}

      {/* Фильтры прилипают под системной полосой: категорию можно сменить из любого места ленты. */}
      <div ref={anchor} />
      {cats.length > 2 && (
        <div ref={filters} className="glass-stuck sticky z-10 -mt-1 mb-2 py-2" style={{ top: 'var(--top)' }}>
          <div className="no-bar flex gap-2 overflow-x-auto px-5">
            {cats.map((c) => (
              <Tap key={c} feedback="select" onClick={(e) => pickCat(c, e.currentTarget)} className={`relative h-10 shrink-0 rounded-full px-4 text-[13.5px] font-semibold ${cat === c ? 'text-on-inverse' : 'text-mute'}`}>
                {cat === c ? (
                  <motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-inverse" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                ) : (
                  <span className="absolute inset-0 rounded-full border border-line bg-card/70" />
                )}
                <span className="tabular relative">
                  {c} <span className="opacity-55">{c === 'Все' ? lessons.length : counts.get(c)}</span>
                </span>
              </Tap>
            ))}
          </div>
        </div>
      )}

      {lessons.length > 0 && list.length === 0 ? (
        <div className="mx-5 rounded-[24px] border border-dashed border-veil/15 px-6 py-8 text-center">
          <p className="font-display text-[15px] font-semibold">Ничего не нашлось</p>
          <p className="mt-1.5 text-[13.5px] text-mute">Попробуй другое слово или сбрось фильтры.</p>
          <Tap
            onClick={() => {
              setQuery('')
              setCat('Все')
              setOnlyNew(false)
            }}
            className="mt-4 h-10 rounded-full border border-line bg-card px-5 text-[13.5px] font-semibold"
          >
            Сбросить
          </Tap>
        </div>
      ) : lessons.length > 0 ? (
        <>
          <div className="mx-5 flex flex-col gap-3">
            {list.slice(0, shown).map((c) => (
              <PostCard key={c.id} card={c} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinel} className="grid h-16 place-items-center text-faint">
              <Spinner size={20} />
            </div>
          )}
        </>
      ) : (
        <div className="mx-5 rounded-[26px] border border-dashed border-veil/15 px-6 py-10 text-center">
          <Emoji char="🛠️" size={44} className="mx-auto" />
          <p className="mt-3 font-display text-[15px] font-semibold">Первый урок уже в работе</p>
          <p className="mt-1.5 text-[13.5px] text-mute">Он появится здесь сразу после анонса в канале.</p>
        </div>
      )}
    </>
  )
}

type Cover = 'wait' | 'wide' | 'tall' | 'none'

/** Материал в ленте — крупный блок, как пост в канале: тема, заголовок, пара строк и картинка. */
function PostCard({ card }: { card: Card }) {
  const push = useStore((s) => s.push)
  const [cover, setCover] = useState<Cover>(card.cover_url ? 'wait' : 'none')
  return (
    <Tap
      onClick={(e) => push({ type: 'lesson', id: card.id, from: insetOf(e.currentTarget) })}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px 80px 0px' }}
      className="block w-full rounded-[26px] border border-line bg-card/80 p-3.5 text-left"
    >
      <div className="flex items-center gap-3">
        <EmojiTile emoji={iconFor(card)} gradient={card.gradient} size={42} radius={21} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight">{card.category}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] leading-tight text-mute">
            <span className="tabular truncate">
              {card.minutes} мин{card.quiz_count > 0 ? ' · квиз' : ''}
            </span>
            {card.has_video && <CirclePlay size={13} className="shrink-0" />}
          </p>
        </div>
        {card.completed ? (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2.5 text-[12px] font-bold text-mint">
            <Check size={13} strokeWidth={3} /> Пройдено
          </span>
        ) : (
          <span className="tabular flex h-7 shrink-0 items-center rounded-full bg-violet/15 px-2.5 text-[12px] font-bold text-violet">+{card.xp} XP</span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-3 px-0.5 text-[17px] font-semibold leading-[1.28]">{card.title}</h3>
      {card.subtitle && <p className="mt-1.5 line-clamp-3 px-0.5 text-[14.5px] leading-[1.42] text-mute">{card.subtitle}</p>}
      {card.cover_url && cover !== 'none' && (
        <div className={`relative mt-3 overflow-hidden rounded-[18px] border border-line bg-card2 ${cover === 'tall' ? 'aspect-[4/3]' : 'aspect-[2/1]'} ${cover === 'wait' ? 'skeleton' : ''}`}>
          <img
            src={card.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            // Вертикальным скриншотам даём рамку повыше, остальные режем под общий формат.
            onLoad={(e) => setCover(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight < 1.3 ? 'tall' : 'wide')}
            onError={() => setCover('none')}
            className={`h-full w-full object-cover object-top transition-opacity duration-300 ${cover === 'wait' ? 'opacity-0' : ''}`}
          />
        </div>
      )}
    </Tap>
  )
}
