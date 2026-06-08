// diaryAnalysis.js — локальный анализ дневника без внешних AI
// Всё работает офлайн, никаких API

// ── Стоп-слова (русский + английский) ─────────────────────────────────────
const STOP = new Set([
  'и','в','на','с','по','не','для','от','до','за','из','или','но','а','то','же',
  'так','как','что','это','все','был','была','было','будет','быть','есть','я',
  'ты','он','она','мы','вы','они','его','её','их','им','нас','вас','мне','мой',
  'моя','моё','мои','нет','да','если','когда','уже','ещё','только','всё','очень',
  'самый','этот','эта','эти','того','тем','тех','тот','при','без','со','бы','ли',
  'вот','там','здесь','теперь','потом','после','перед','через','под','над','между',
  'меня','тебя','себя','сам','сама','само','который','которая','которое','которые',
  'можно','надо','нужно','хочу','хочет','могу','могут','стал','стала','стало',
  'стали','тоже','просто','один','одна','одно','два','три','четыре','пять',
  'the','and','of','to','in','a','is','it','that','was','he','she','for',
  'on','are','as','with','his','they','at','be','this','have','from','or',
  'had','not','but','what','all','were','we','when','your','can','said',
  'each','which','she','do','how','their','if','will','up','other','about',
])

// ── Тональность — список корней ───────────────────────────────────────────
const POS_ROOTS = [
  'счастл','радост','отличн','хорош','здоров','весел','успех','справил',
  'благодар','любов','восторг','прекрасн','замечател','довол','мотивац',
  'вдохновен','энерги','уверен','гордост','смеял','улыбал','интересн',
  'помог','победил','получилос','спокойн','отдохн','продуктивн','вкусн',
  'приятн','пятниц','весел','творч','разгов','встрет','удалос','повезл',
]

const NEG_ROOTS = [
  'плох','грустн','устал','трево','стресс','злост','обидн','расстро',
  'разочаров','скучн','одинок','проблем','провал','тяжел','болн','страх',
  'беспокой','ненавиж','раздраж','ужасн','паник','тревожн','устала',
  'срочн','опазд','потерял','не успел','забыл','обид','одиноч',
]

export function getSentiment(text) {
  const lower = text.toLowerCase()
  const words = lower.split(/[\s,\.!?;:]+/).filter(w => w.length > 2)
  let pos = 0, neg = 0
  words.forEach(w => {
    if (POS_ROOTS.some(r => w.includes(r))) pos++
    if (NEG_ROOTS.some(r => w.includes(r))) neg++
  })
  const total = pos + neg || 1
  const score = (pos - neg) / total
  return { score, pos, neg, label: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral' }
}

// ── Токенизация ───────────────────────────────────────────────────────────
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^а-яёa-z\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w))
}

// ── TF-IDF ключевые слова ─────────────────────────────────────────────────
export function extractKeywords(entries, topN = 25) {
  if (!entries.length) return []
  const N = entries.length
  const df = {}
  const tfTotal = {}

  entries.forEach(e => {
    const words = tokenize(e.body || '')
    const seen = new Set()
    words.forEach(w => {
      tfTotal[w] = (tfTotal[w] || 0) + 1
      if (!seen.has(w)) { df[w] = (df[w] || 0) + 1; seen.add(w) }
    })
  })

  return Object.entries(tfTotal)
    .map(([word, freq]) => ({
      word,
      freq,
      score: freq * Math.log((N + 1) / ((df[word] || 0) + 1)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

// ── Паттерн настроения по дням недели ─────────────────────────────────────
export function getMoodByDow(entries) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i], moods: {}, total: 0 }))
  entries.forEach(e => {
    if (!e.mood || !e.date) return
    const dow = (new Date(e.date + 'T12:00').getDay() + 6) % 7
    days[dow].moods[e.mood] = (days[dow].moods[e.mood] || 0) + 1
    days[dow].total++
  })
  return days.map(d => ({
    ...d,
    topMood: d.total ? Object.entries(d.moods).sort((a,b)=>b[1]-a[1])[0]?.[0] : null,
    score: d.total ? Object.entries(d.moods).reduce((s,[m,c]) => {
      const w = { great:2, happy:1, neutral:0, tired:-0.5, sad:-1, anxious:-1, angry:-1.5, love:1.5 }
      return s + (w[m]||0) * c
    }, 0) / d.total : 0,
  }))
}

// ── Тренд настроения (последние N дней) ───────────────────────────────────
export function getMoodTrend(entries, days = 14) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const entry = entries.find(e => e.date === date)
    result.push({ date, mood: entry?.mood || null, haEntry: !!entry })
  }
  return result
}

// ── Корреляция настроения с привычками ────────────────────────────────────
export function getMoodHabitCorr(entries, habits) {
  if (!habits?.length || entries.length < 7) return null
  const moodScore = { great:2, happy:1, love:1.5, neutral:0, tired:-0.5, sad:-1, anxious:-1, angry:-1.5 }

  let withHabits = [], withoutHabits = []

  entries.slice(0, 30).forEach(e => {
    if (!e.mood) return
    const score = moodScore[e.mood] ?? 0
    const habitsDone = habits.filter(h => (h.log || []).includes(e.date)).length
    const total = habits.length
    const ratio = total > 0 ? habitsDone / total : 0
    if (ratio >= 0.5) withHabits.push(score)
    else withoutHabits.push(score)
  })

  if (withHabits.length < 3 || withoutHabits.length < 3) return null
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
  const diff = avg(withHabits) - avg(withoutHabits)

  if (Math.abs(diff) < 0.3) return null
  return {
    diff,
    better: diff > 0 ? 'with' : 'without',
    withScore: avg(withHabits),
    withoutScore: avg(withoutHabits),
  }
}

// ── Повторяющиеся темы ────────────────────────────────────────────────────
const THEMES = [
  { id:'work',     words:['работ','проект','задач','дедлайн','офис','коллег','начальник','коллег'],    label:'Работа',       emoji:'💼' },
  { id:'health',   words:['здоровь','спорт','трениров','бег','устал','болит','болен','болен','врач'], label:'Здоровье',     emoji:'💪' },
  { id:'relations',words:['друг','семья','мама','папа','брат','сестр','парень','девушк','любовь'],    label:'Отношения',    emoji:'❤️' },
  { id:'study',    words:['учёба','учёб','книг','читал','курс','учился','экзамен','знани'],           label:'Учёба',        emoji:'📚' },
  { id:'rest',     words:['отдыхал','прогулк','кино','музык','игр','отдых','выходн','развлечен'],     label:'Отдых',        emoji:'🎮' },
  { id:'money',    words:['деньги','зарплат','расход','бюджет','куп','потратил','дорог','цен'],       label:'Финансы',      emoji:'💰' },
  { id:'mood',     words:['настроени','чувству','ощущени','эмоц','переживан'],                        label:'Эмоции',       emoji:'🌀' },
  { id:'future',   words:['план','мечт','цел','будущ','надежд','хочу','когда-нибудь'],               label:'Планы',        emoji:'🎯' },
]

export function detectThemes(text) {
  const lower = text.toLowerCase()
  return THEMES.filter(t => t.words.some(w => lower.includes(w)))
}

// ── Генерация инсайтов ────────────────────────────────────────────────────
export function generateInsights(entries, habits, tasks) {
  const insights = []
  if (entries.length < 2) return insights

  const today = new Date().toISOString().slice(0, 10)
  const recent = entries.slice(0, 14)
  const moodScore = { great:2, happy:1, love:1.5, neutral:0, tired:-0.5, sad:-1, anxious:-1, angry:-1.5 }
  const negMoods = new Set(['sad','angry','anxious','tired'])
  const posMoods = new Set(['great','happy','love'])

  // 1. Серия негативных настроений
  const last5moods = recent.slice(0, 5).map(e => e.mood).filter(Boolean)
  const negStreak = last5moods.filter(m => negMoods.has(m)).length
  if (negStreak >= 3) {
    insights.push({
      id: 'neg_streak', priority: 3, icon: '💙', type: 'care',
      title: 'Сложный период',
      text: `${negStreak} из последних 5 дней с тяжёлым настроением. Позаботься о себе — это важно.`,
      tip: 'Попробуй: 10 минут прогулки, разговор с близким, горячий чай без телефона.',
    })
  }

  // 2. Лучший день недели
  const dowData = getMoodByDow(recent)
  const bestDow = [...dowData].filter(d => d.total > 0).sort((a,b) => b.score - a.score)[0]
  const worstDow = [...dowData].filter(d => d.total > 0).sort((a,b) => a.score - b.score)[0]
  if (bestDow && bestDow.score > 0.5) {
    insights.push({
      id: 'best_day', priority: 1, icon: '📅', type: 'pattern',
      title: 'Твой лучший день',
      text: `По паттерну записей ты чаще всего чувствуешь себя хорошо в ${bestDow.day}.${worstDow && worstDow.score < -0.3 ? ` А труднее всего даётся ${worstDow.day}.` : ''}`,
    })
  }

  // 3. Корреляция с привычками
  const habCorr = getMoodHabitCorr(entries, habits)
  if (habCorr && habCorr.better === 'with') {
    insights.push({
      id: 'habit_corr', priority: 2, icon: '🔗', type: 'correlation',
      title: 'Привычки → настроение',
      text: `В дни когда ты выполнял больше привычек, настроение было заметно лучше. Это видно в твоих записях.`,
      action: { label: 'Открыть привычки', screen: 'habits' },
    })
  }

  // 4. Рост числа слов = улучшение настроения?
  if (recent.length >= 7) {
    const withLong  = recent.filter(e => e.body.split(/\s+/).length > 100)
    const withShort = recent.filter(e => e.body.split(/\s+/).length <= 100)
    const avgLong  = withLong.length  ? withLong .reduce((s,e)=>s+(moodScore[e.mood]??0),0)/withLong.length  : null
    const avgShort = withShort.length ? withShort.reduce((s,e)=>s+(moodScore[e.mood]??0),0)/withShort.length : null
    if (avgLong !== null && avgShort !== null && avgLong - avgShort > 0.4) {
      insights.push({
        id: 'long_write', priority: 1, icon: '✍️', type: 'pattern',
        title: 'Письмо помогает',
        text: `В дни когда ты пишешь больше 100 слов, настроение в среднем лучше. Писать — это работать с мыслями.`,
      })
    }
  }

  // 5. Частая тема
  const keywords = extractKeywords(recent.slice(0, 10), 5)
  if (keywords[0]) {
    insights.push({
      id: 'top_keyword', priority: 0, icon: '🔍', type: 'keywords',
      title: 'Что тебя занимает',
      text: `Последние 10 записей часто возвращаются к «${keywords[0].word}»${keywords[1] ? ` и «${keywords[1].word}»` : ''}.`,
    })
  }

  // 6. Задачи с высоким приоритетом при плохом настроении
  const todayEntry = entries.find(e => e.date === today)
  if (todayEntry && negMoods.has(todayEntry.mood)) {
    const highTasks = (tasks || []).filter(t => !t.done && t.priority === 'high')
    if (highTasks.length > 0) {
      insights.push({
        id: 'tasks_mood', priority: 2, icon: '✅', type: 'action',
        title: 'Маленькая победа',
        text: `Даже в трудный день одна выполненная задача меняет настроение. У тебя ${highTasks.length} важных задач.`,
        action: { label: 'Открыть задачи', screen: 'tasks' },
      })
    }
  }

  return insights.sort((a, b) => b.priority - a.priority)
}

// ── Персональные советы для текущей записи ────────────────────────────────
export function getSuggestions(entry, allEntries, habits, tasks) {
  if (!entry) return []
  const { mood, body = '', date } = entry
  const lower = body.toLowerCase()
  const sugg = []

  // По настроению
  if (mood === 'anxious' || mood === 'sad') {
    sugg.push({ icon:'🌬️', text:'Попробуй технику 4-7-8: вдох 4с → задержка 7с → выдох 8с. Снижает тревогу за 2 минуты.' })
  }
  if (mood === 'tired') {
    sugg.push({ icon:'☕', text:'20-минутный power nap (или просто закрыть глаза) восстанавливает лучше, чем ещё один кофе.' })
  }
  if (mood === 'angry') {
    sugg.push({ icon:'🏃', text:'5 минут физической активности — прогулка, отжимания — хорошо снимают эмоциональное напряжение.' })
  }
  if (mood === 'great' || mood === 'happy' || mood === 'love') {
    const highTasks = (tasks || []).filter(t => !t.done && t.priority === 'high').slice(0, 1)
    if (highTasks.length) {
      sugg.push({ icon:'⚡', text:`Отличный настрой — хорошее время для важного: «${highTasks[0].text.slice(0, 50)}»`, action:'tasks' })
    }
  }

  // По контенту — работа
  if (/работ|проект|дедлайн|задач/.test(lower)) {
    const pendWork = (tasks||[]).filter(t => !t.done && (t.tag==='Работа'||t.tag==='Проект'))
    if (pendWork.length > 0) {
      sugg.push({ icon:'📋', text:`${pendWork.length} рабочих задач ещё в списке. Может закрыть что-то сейчас?`, action:'tasks' })
    }
  }

  // По контенту — здоровье/спорт
  if (/спорт|трениров|бег|фитнес|здоровь/.test(lower)) {
    const sportHabit = (habits||[]).find(h => /спорт|бег|трениров|фитнес/i.test(h.name))
    if (sportHabit && !(sportHabit.log||[]).includes(date)) {
      sugg.push({ icon:'💪', text:`Отмечено в дневнике — не забудь пометить привычку «${sportHabit.name}»`, action:'habits' })
    }
  }

  // По контенту — деньги
  if (/купил|потратил|деньги|зарплат|расход/.test(lower)) {
    sugg.push({ icon:'💰', text:'Хочешь зафиксировать трату? Открой бюджет и добавь транзакцию.', action:'budget' })
  }

  // Похожий момент в прошлом (по настроению + теме)
  if (allEntries.length > 20 && mood) {
    const themes = detectThemes(body)
    const similar = allEntries
      .filter(e => e.date !== date && e.mood === mood && detectThemes(e.body).some(t => themes.find(th => th.id === t.id)))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 1)[0]
    if (similar) {
      sugg.push({
        icon:'🕰️',
        text:`Похожее было ${new Date(similar.date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}: «${similar.body.slice(0,60)}…»`,
        date: similar.date,
      })
    }
  }

  return sugg.slice(0, 3)
}

// ── Оценка записи (чтобы показывать прогресс) ───────────────────────────
export function scoreEntry(body) {
  const wc = body.trim().split(/\s+/).filter(Boolean).length
  const sent = getSentiment(body)
  const themes = detectThemes(body)
  return {
    wordCount: wc,
    sentiment: sent,
    themes,
    depth: wc < 30 ? 'shallow' : wc < 100 ? 'medium' : 'deep',
  }
}
