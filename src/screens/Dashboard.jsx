import { useState, useEffect, useMemo } from 'react'
import { useStore, uid, musicPollStart, musicPollStop } from '../store'
import { Icon } from '../components/Icons'
import { Card, CardHead } from '../components/UIKit'
import { Ring, Sparkline, Bars, Heatmap, AnimatedNumber, MoodDots } from '../components/Viz'
import { getWeather } from '../integrations/weather'

const fmt = (n) => Number(n).toLocaleString('ru-RU')
const PRIO_COLOR = { high: 'var(--c-warm)', mid: 'var(--acc)', low: 'var(--c-cool)' }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function autoPhase(h) {
  if (h < 6) return 'ночь'
  if (h < 11) return 'утро'
  if (h < 18) return 'день'
  return 'вечер'
}

export function Dashboard({ onNavigate }) {
  const [profile]         = useStore('profile',   {})
  const [tasks, setTasks] = useStore('tasks',    [])
  const [reminders]       = useStore('reminders',[])
  const [habits]          = useStore('habits_v2', [])
  const [transactions]    = useStore('budget_txns', [])
  const [calEvents]       = useStore('calendar_events', [])
  const [focusStats]      = useStore('focus_stats', {})
  const [focusHistory]    = useStore('focus_history', {})
  const [diaryEntries]    = useStore('diary_entries', [])
  const [musicTrack]      = useStore('music_track', null)

  const [weather, setWeather] = useState(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    const city = profile?.city || 'Москва'
    getWeather(city).then(w => setWeather(w)).catch(() => {})
  }, [profile?.city])

  useEffect(() => { musicPollStart(); return () => musicPollStop() }, [])

  const h = now.getHours()
  const greeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  const phaseName = autoPhase(h)
  const today = todayStr()
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const todayTasks   = useMemo(() => (tasks||[]).filter(t => t.date === today || !t.date).slice(0, 6), [tasks, today])
  const doneTasks    = todayTasks.filter(t => t.done).length
  const taskPct      = todayTasks.length ? doneTasks / todayTasks.length : 0

  const todayHabits  = useMemo(() => (habits||[]).filter(h => !(h.log||[]).includes(today)).length, [habits, today])
  const habitsTotal  = (habits||[]).length

  const todayMinutes = focusStats?.todayMinutes || 0
  const focusGoal    = 120
  const focusPct     = Math.min(1, todayMinutes / focusGoal)

  // focus week bars
  const focusWeek = useMemo(() => {
    const d = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(d); dt.setDate(d.getDate() - (6 - i))
      const k = dt.toISOString().slice(0, 10)
      return (focusHistory[k]?.minutes || 0)
    })
  }, [focusHistory])

  // budget this month
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTxns = useMemo(() => (transactions||[]).filter(t => t.month === monthKey), [transactions, monthKey])
  const monthSpent = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
  const monthIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)

  // budget 7-day sparkline
  const budgetWeek = useMemo(() => {
    const d = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(d); dt.setDate(d.getDate() - (6 - i))
      const k = dt.toISOString().slice(0, 10)
      return (transactions||[]).filter(t => t.date === k && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    })
  }, [transactions])

  // today events
  const todayEvents = useMemo(() => (calEvents||[]).filter(e => e.date === today).slice(0, 4), [calEvents, today])

  // diary today / mood
  const lastDiary = useMemo(() => (diaryEntries||[]).find(e => e.date === today) || (diaryEntries||[]).slice(-1)[0], [diaryEntries, today])
  const moodWeek = useMemo(() => {
    const d = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(d); dt.setDate(d.getDate() - (6 - i))
      const k = dt.toISOString().slice(0, 10)
      const e = (diaryEntries||[]).find(x => x.date === k)
      return e?.mood || 0
    })
  }, [diaryEntries])

  // habits heatmap (18 недель)
  const heatGrid = useMemo(() => {
    const h0 = (habits||[])[0]
    if (!h0) return []
    const log = h0.log || []
    const d = new Date()
    const weeks = []
    for (let w = 17; w >= 0; w--) {
      const week = []
      for (let day = 6; day >= 0; day--) {
        const dt = new Date(d)
        dt.setDate(d.getDate() - (w * 7 + day))
        const k = dt.toISOString().slice(0, 10)
        week.push(log.includes(k) ? 3 : 0)
      }
      weeks.push(week)
    }
    return weeks
  }, [habits])

  const toggle = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))

  return (
    <div className="dash">
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <div className="hero-eyebrow mono">
            <span>{dateStr.toUpperCase()}</span>
            <span className="dot-sep">·</span>
            <span className="hero-phase">{phaseName}</span>
          </div>
          <h1 className="hero-h1">{greeting}, <span className="hero-name">{profile?.name || 'Дмитрий'}</span></h1>
          <p className="hero-sub">Сегодня отличный день, чтобы сделать что-то важное.</p>
          <div className="hero-stats">
            <div className="hstat">
              <span className="hstat-n mono">{doneTasks}<span style={{ color: 'var(--t-dim)' }}>/{todayTasks.length}</span></span>
              <span className="hstat-l">задач</span>
            </div>
            <span className="hstat-div" />
            <div className="hstat">
              <span className="hstat-n mono">{todayMinutes}<span className="hstat-u">м</span></span>
              <span className="hstat-l">фокус</span>
            </div>
            <span className="hstat-div" />
            <div className="hstat">
              <span className="hstat-n mono">{fmt(Math.round(monthSpent))}<span className="hstat-u">₽</span></span>
              <span className="hstat-l">месяц</span>
            </div>
          </div>
        </div>
        <div className="hero-r">
          <Ring value={taskPct} size={130} stroke={9}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono lvl-num" style={{ fontSize: 28 }}>{Math.round(taskPct * 100)}</div>
              <div className="lvl-cap">%</div>
            </div>
          </Ring>
          <div className="hero-r-meta">
            <div className="lvl-title">Прогресс дня</div>
            <div className="xp-line mono">{doneTasks} из {todayTasks.length} задач</div>
            {habitsTotal > 0 && (
              <div className="streak-chip">
                <span className="flame"><Icon name="flame" size={14} /></span>
                <span className="mono">{habitsTotal - todayHabits}</span>
                <span className="streak-cap">привычек выполнено</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bento */}
      <div className="bento">
        {/* Tasks */}
        <Card className="tasks-card" hover={false}>
          <CardHead icon="check" title="Задачи на сегодня" action={
            <div className="mini-ring-wrap">
              <Ring value={taskPct} size={42} stroke={5}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{Math.round(taskPct * 100)}<span style={{ fontSize: 8 }}>%</span></span>
              </Ring>
            </div>
          } />
          <div className="task-list">
            {todayTasks.map(t => (
              <button key={t.id} className={`task ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)}>
                <span className="task-box" style={{ '--pc': PRIO_COLOR[t.priority] || PRIO_COLOR.mid }}>
                  {t.done && <Icon name="check" size={12} />}
                </span>
                <span className="task-main">
                  <span className="task-title">{t.text}</span>
                  <span className="task-meta mono">
                    {t.time && <span className="task-time">{t.time}</span>}
                    <span className="task-tag">{t.tag || 'Личное'}</span>
                  </span>
                </span>
                <span className="task-prio" style={{ background: PRIO_COLOR[t.priority] || PRIO_COLOR.mid }} />
              </button>
            ))}
            {todayTasks.length === 0 && <div style={{ padding: '16px 10px', color: 'var(--t-mute)', fontSize: 13 }}>Нет задач на сегодня</div>}
          </div>
          <button className="task-add" onClick={() => onNavigate('tasks')}>
            <Icon name="plus" size={15} /> Добавить задачу
          </button>
        </Card>

        {/* Focus */}
        <Card area="focus" onClick={() => onNavigate('focus')}>
          <CardHead icon="timer" title="Фокус" action={<span className="card-act mono">{focusStats?.todaySessions || 0} сессии</span>} />
          <div className="focus-body">
            <Ring value={focusPct} size={104} stroke={9}>
              <div style={{ textAlign: 'center' }}>
                <div className="mono focus-num">{todayMinutes}<span className="focus-unit">м</span></div>
                <div className="focus-goal mono">/ {focusGoal}м</div>
              </div>
            </Ring>
            <div className="focus-week">
              <div className="focus-week-lab mono">неделя</div>
              <Bars data={focusWeek} h={48} labels={['пн','вт','ср','чт','пт','сб','вс']} highlight={6} />
            </div>
          </div>
        </Card>

        {/* Budget */}
        <Card area="budget" onClick={() => onNavigate('budget')}>
          <CardHead icon="wallet" title="Бюджет · месяц"
            action={<span className="card-act mono" style={{ color: monthIncome - monthSpent >= 0 ? 'var(--c-cool)' : 'var(--c-warm)' }}>
              {monthIncome - monthSpent >= 0 ? '+' : ''}{fmt(Math.round(monthIncome - monthSpent))}₽
            </span>} />
          <div className="budget-top">
            <div>
              <div className="budget-big mono">{fmt(Math.round(monthSpent))}₽</div>
              <div className="budget-cap mono">расходы</div>
            </div>
          </div>
          <Sparkline data={budgetWeek.length ? budgetWeek : [0]} h={50} />
        </Card>

        {/* Habits */}
        <Card className="habits-card" hover={false}>
          <CardHead icon="repeat" title="Привычки"
            action={<span className="card-act mono">{habitsTotal - todayHabits}/{habitsTotal}</span>} />
          <div className="habit-rows">
            {(habits||[]).slice(0, 4).map(h => {
              const done = (h.log||[]).includes(today)
              const streak = (() => {
                let s = 0, d = new Date()
                for (let i = 0; i < 200; i++) {
                  const k = d.toISOString().slice(0, 10)
                  if (k === today && !done) { d.setDate(d.getDate() - 1); continue }
                  if (!(h.log||[]).includes(k)) break
                  s++; d.setDate(d.getDate() - 1)
                }
                return s
              })()
              return (
                <div key={h.id} className={`habit ${done ? 'full' : ''}`}>
                  <span className="habit-ico">{h.icon || <Icon name="check" size={15} />}</span>
                  <span className="habit-main">
                    <span className="habit-name">{h.name}</span>
                    <span className="habit-bar"><span className="habit-fill" style={{ width: done ? '100%' : '0%' }} /></span>
                  </span>
                  <span className="habit-streak"><Icon name="flame" size={11} />{streak}</span>
                </div>
              )
            })}
          </div>
          {heatGrid.length > 0 && (
            <div className="habit-heat">
              <div className="heat-head mono"><span>18 недель</span><span>отметки</span></div>
              <Heatmap grid={heatGrid} cell={9} gap={3} />
            </div>
          )}
        </Card>

        {/* Weather */}
        <Card area="weather" className="weather-card" hover={false}>
          <CardHead icon="pin" title={`Погода · ${profile?.city || 'Москва'}`} />
          {weather ? (
            <>
              <div className="wx-main">
                <span className="wx-ico"><Icon name="sun" size={40} /></span>
                <div>
                  <div className="wx-temp mono">{Math.round(weather.temp)}°</div>
                  <div className="wx-cond">{weather.condition}</div>
                </div>
              </div>
              {weather.hourly?.length > 0 && <Sparkline data={weather.hourly.slice(0, 12)} h={36} color="var(--c-warm)" dot={false} />}
              <div className="wx-grid mono">
                <span><Icon name="drop" size={12} /> {weather.humidity}%</span>
                <span><Icon name="wind" size={12} /> {weather.wind} м/с</span>
                <span>ощущ. {Math.round(weather.feelsLike)}°</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--t-mute)', fontSize: 13, padding: '12px 0' }}>Загрузка…</div>
          )}
        </Card>

        {/* Events */}
        <Card area="events" onClick={() => onNavigate('calendar')}>
          <CardHead icon="calendar" title="События"
            action={<span className="card-act mono">{todayEvents.length}</span>} />
          <div className="ev-list">
            {todayEvents.length === 0 && <div style={{ color: 'var(--t-mute)', fontSize: 13, padding: '8px 0' }}>Событий нет</div>}
            {todayEvents.map((e, i) => (
              <div key={i} className="ev">
                <span className="ev-bar" style={{ background: e.color || 'var(--acc)' }} />
                <div className="ev-main">
                  <div className="ev-title">{e.title}</div>
                  {e.location && <div className="ev-where mono">{e.location}</div>}
                </div>
                {e.time && <div className="ev-time mono">{e.time}</div>}
              </div>
            ))}
          </div>
        </Card>

        {/* Diary */}
        <Card area="diary" onClick={() => onNavigate('diary')}>
          <CardHead icon="feather" title="Дневник" action={<span className="card-act mono">сегодня</span>} />
          <div style={{ marginBottom: 14 }}>
            <div className="dm-lab mono">настроение недели</div>
            <MoodDots data={moodWeek} />
          </div>
          {lastDiary?.mood && (
            <div className="diary-now">
              <div className="dn-row">
                <span className="dn-lab">Настроение</span>
                <div className="dn-track"><span className="dn-fill" style={{ width: `${lastDiary.mood / 8 * 100}%`, background: 'var(--acc)' }} /></div>
              </div>
            </div>
          )}
          {lastDiary?.body && (
            <p className="diary-note">«{lastDiary.body.slice(0, 120)}{lastDiary.body.length > 120 ? '…' : ''}»</p>
          )}
        </Card>

        {/* Music */}
        <Card area="music" className="music-card" onClick={() => onNavigate('music')}>
          <CardHead icon="music" title="Сейчас играет" />
          {musicTrack ? (
            <>
              <div className="mus-body">
                <div className="mus-art">
                  <span className="mus-art-glow" />
                  <Icon name="music" size={22} />
                  {musicTrack.playing && (
                    <span className="mus-eq"><i/><i/><i/></span>
                  )}
                </div>
                <div className="mus-meta">
                  <div className="mus-track">{musicTrack.title || 'Неизвестно'}</div>
                  <div className="mus-artist mono">{musicTrack.artist || '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--t-mute)', fontSize: 13, padding: '8px 0' }}>
              Откройте вкладку Музыка, чтобы начать воспроизведение
            </div>
          )}
        </Card>

        {/* Reminders */}
        <Card area="ach" hover={false}>
          <CardHead icon="bell" title="Напоминания"
            action={<span className="card-act mono">{(reminders||[]).length}</span>} />
          <div className="rem-list">
            {(reminders||[]).slice(0, 4).map((r, i) => (
              <div key={i} className="rem">
                <span className="rem-dot" style={{ background: 'var(--acc)' }} />
                <span className="rem-title">{r.title}</span>
              </div>
            ))}
            {(reminders||[]).length === 0 && (
              <div className="rem-tip"><Icon name="bulb" size={14} /> Начни с малого, но начни прямо сейчас.</div>
            )}
          </div>
        </Card>

        {/* Today schedule */}
        <Card area="rem" hover={false}>
          <CardHead icon="pulse" title="Расписание дня"
            action={<span className="card-act mono">сегодня</span>} />
          <div className="rem-list">
            {todayEvents.slice(0, 3).map((e, i) => (
              <div key={i} className="rem">
                <span className="rem-dot" style={{ background: e.color || 'var(--acc)' }} />
                <span className="rem-title">{e.title}</span>
                {e.time && <span className="rem-time mono">{e.time}</span>}
              </div>
            ))}
            {todayEvents.length === 0 && (
              <div className="rem-tip"><Icon name="bulb" size={14} /> Нет событий на сегодня.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
