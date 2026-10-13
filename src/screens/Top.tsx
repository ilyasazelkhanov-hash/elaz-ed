import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { levelOf } from '../lib/game'
import type { TopResult, TopUser } from '../lib/types'
import { useStore } from '../store'
import { Avatar, Emoji } from '../ui'

const PODIUM = [
  { place: 2, height: 78, avatar: 58, delay: 0.15 },
  { place: 1, height: 112, avatar: 74, delay: 0 },
  { place: 3, height: 58, avatar: 58, delay: 0.3 },
]

export function Top() {
  const me = useStore((s) => s.me)!
  const guard = useStore((s) => s.guard)
  const [data, setData] = useState<TopResult | null>(null)

  useEffect(() => {
    let alive = true
    api
      .top()
      .then((d) => alive && setData(d))
      .catch((e) => {
        guard(e)
        if (alive) setData({ top: [], rank: me.rank })
      })
    return () => {
      alive = false
    }
    // Рейтинг запрашиваем один раз при входе на вкладку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const top = data?.top ?? []
  const rest = top.slice(3)
  const myIndex = top.findIndex((u) => u.id === me.id)
  const ahead = myIndex > 0 ? top[myIndex - 1] : undefined
  const hint = ahead
    ? `До ${ahead.name}: ${ahead.xp - me.xp + 1} XP`
    : myIndex === 0
      ? 'Выше только небо'
      : me.xp > 0
        ? 'Топ-50 пока впереди'
        : 'Пройди урок, чтобы попасть в таблицу'

  return (
    <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 18px)', paddingBottom: 'calc(120px + var(--bottom))' }}>
      <div className="px-5">
        <h1 className="font-display text-[26px] font-semibold leading-tight">Рейтинг</h1>
        <p className="mt-1 text-[14px] text-mute">Подписчики канала по XP</p>
      </div>

      <div className="mx-5 mt-5 flex items-center gap-3.5 rounded-[24px] p-[1.5px]" style={{ background: 'var(--aurora)' }}>
        <div className="flex w-full items-center gap-3.5 rounded-[22.5px] bg-card p-3.5">
          <span className="w-9 text-center font-display text-[17px] font-semibold text-aurora">{data?.rank ?? me.rank}</span>
          <Avatar name={me.name} photo={me.photo} id={me.id} size={42} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">Ты</p>
            <p className="truncate text-[12.5px] text-mute">{data ? hint : ' '}</p>
          </div>
          <span className="font-display text-[14px] font-semibold">{me.xp} XP</span>
        </div>
      </div>

      {!data && (
        <div className="mt-6 space-y-2.5 px-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-[66px] rounded-[22px]" />
          ))}
        </div>
      )}

      {data && top.length === 0 && (
        <div className="mx-5 mt-6 rounded-[26px] border border-dashed border-veil/15 px-6 py-10 text-center">
          <Emoji char="🏆" size={48} animated className="mx-auto" />
          <p className="mt-3 font-display text-[15px] font-semibold">Таблица пока пустая</p>
          <p className="mt-1.5 text-[13.5px] text-mute">Забери бонус дня или пройди урок — первое место свободно.</p>
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-8 flex items-end justify-center gap-2.5 px-5">
          {PODIUM.map((p) => {
            const u = top[p.place - 1]
            return (
              <div key={p.place} className="flex w-[31%] flex-col items-center">
                {u ? (
                  <motion.div initial={{ opacity: 0, y: 24, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: p.delay + 0.25, type: 'spring', stiffness: 300, damping: 20 }} className="flex flex-col items-center">
                    {p.place === 1 && <Emoji char="👑" size={34} animated className="-mb-1.5" />}
                    <div className="rounded-full p-[2.5px]" style={{ background: p.place === 1 ? 'var(--aurora)' : 'var(--track-strong)' }}>
                      <div className="rounded-full bg-bg p-[2px]">
                        <Avatar name={u.name} photo={u.photo} id={u.id} size={p.avatar} />
                      </div>
                    </div>
                    <p className="mt-2 max-w-full truncate text-[13.5px] font-semibold">{u.id === me.id ? 'Ты' : u.name}</p>
                    <p className="text-[12px] font-medium text-mute">{u.xp} XP</p>
                  </motion.div>
                ) : (
                  <div className="h-10" />
                )}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: p.height }}
                  transition={{ delay: p.delay, type: 'spring', stiffness: 160, damping: 20 }}
                  className="mt-2.5 flex w-full items-start justify-center overflow-hidden rounded-t-[20px] border border-b-0 border-line pt-3"
                  style={{ background: p.place === 1 ? 'linear-gradient(to bottom, rgb(165 139 255 / 0.38), rgb(165 139 255 / 0.04))' : 'linear-gradient(to bottom, var(--track), transparent)' }}
                >
                  <span className={`font-display text-[22px] font-bold ${p.place === 1 ? 'text-aurora' : 'text-faint'}`}>{p.place}</span>
                </motion.div>
              </div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2 px-5 pt-1">
          {rest.map((u, i) => (
            <Row key={u.id} user={u} place={i + 4} mine={u.id === me.id} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ user, place, mine, index }: { user: TopUser; place: number; mine: boolean; index: number }) {
  const lvl = levelOf(user.xp)
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + Math.min(index, 10) * 0.04 }}
      className={`flex items-center gap-3.5 rounded-[22px] border p-3 ${mine ? 'border-violet/50 bg-violet/10' : 'border-line bg-card/80'}`}
    >
      <span className="w-7 text-center font-display text-[13px] font-semibold text-faint">{place}</span>
      <Avatar name={user.name} photo={user.photo} id={user.id} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{mine ? 'Ты' : user.name}</p>
        <p className="flex items-center gap-1 text-[12.5px] text-mute">
          <Emoji char={lvl.emoji} size={13} /> {lvl.title}
          {user.streak > 1 && <span className="text-faint">· стрик {user.streak}</span>}
        </p>
      </div>
      <span className="font-display text-[13px] font-semibold">{user.xp}</span>
    </motion.div>
  )
}
