// Voice.jsx — голосовой режим с диалогом
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { Orb  } from '../components/Orb'

const suggestions = [
  'Что у меня сегодня?',
  'Какая погода?',
  'Запиши идею',
  'Напомни выпить воды',
]

export function Voice({
  assistant,
  // Распознавание речи
  isListening, isSpeaking, isTranscribing,
  transcript, audioLevel = 0, hasMic,
  srWorking, modelStatus = 'idle', modelProgress = 0,
  micActive, onToggleMic,
  // AI диалог
  messages = [], responding = false, streamText = '', aiSpeaking = false,
  learning = false, learnedFacts = [], searching = false,
  onRespond, onClear,
}) {
  const speaking  = isSpeaking || audioLevel > 0.05
  const hasChat   = messages.length > 0
  const chatRef   = useRef(null)
  const inputRef  = useRef(null)
  const [inputText, setInputText] = useState('')
  const [elapsed,   setElapsed]   = useState(0)
  const elapsedRef = useRef(null)

  // Таймер ожидания ответа
  useEffect(() => {
    if (responding) {
      setElapsed(0)
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(elapsedRef.current)
      setElapsed(0)
    }
    return () => clearInterval(elapsedRef.current)
  }, [responding])

  // Авто-скролл к последнему сообщению
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, streamText])

  const sendText = () => {
    const t = inputText.trim()
    if (!t || responding) return
    setInputText('')
    onRespond?.(t)
  }

  // Состояние орба
  const orbState = !micActive       ? 'idle'
    : aiSpeaking                    ? 'thinking'
    : isTranscribing                ? 'thinking'
    : speaking                      ? 'listening'
    : 'idle'

  // Подпись статуса
  const statusLabel = !micActive      ? 'Микрофон выключен'
    : !hasMic                         ? 'Нет доступа к микрофону'
    : aiSpeaking                      ? `${assistant} говорит…`
    : responding                      ? 'Думаю…'
    : isTranscribing                  ? 'Распознаю речь…'
    : isSpeaking                      ? 'Слушаю…'
    : modelStatus === 'loading'       ? `Загрузка модели ${modelProgress > 0 ? `${modelProgress}%` : ''}…`
    : modelStatus === 'error'         ? 'Ошибка модели'
    : modelStatus === 'ready'         ? (hasChat ? 'Готов' : 'Говори — я слушаю')
    : 'Инициализация…'

  // Цвет индикаторного кружка
  const dotBg = aiSpeaking || responding ? 'var(--accent-soft)'
    : speaking || isTranscribing         ? 'var(--accent)'
    : modelStatus === 'ready'            ? 'var(--ok)'
    : modelStatus === 'error'            ? '#f87171'
    : 'var(--accent-soft)'

  // ── Размеры — компактный режим когда есть чат ──────────────────────────
  const orbSize = hasChat ? 52 : 200

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>

      {/* ── Шапка: орб + статус + визуализация ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: hasChat ? '18px 38px 14px' : '0 38px',
        paddingTop: hasChat ? 18 : '6%',
        flexDirection: hasChat ? 'row' : 'column',
        textAlign: hasChat ? 'left' : 'center',
        borderBottom: hasChat ? '1px solid var(--line)' : 'none',
        flexShrink: 0,
      }}>

        {/* Лейбл (только без чата) */}
        {!hasChat && (
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--accent-soft)', marginBottom:20 }}>
            Голосовой режим
          </div>
        )}

        {/* Орб */}
        <div onClick={onToggleMic} style={{ cursor:'pointer', flexShrink:0 }} title={micActive ? 'Выключить' : 'Включить'}>
          <Orb size={orbSize} state={orbState} wave={!!micActive} />
        </div>

        {/* Статус рядом с орбом (компактный режим) */}
        {hasChat && (
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:600, color:'var(--text)' }}>{assistant}</div>
            <div style={{ fontSize:12.5, color:'var(--text-mute)', display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:dotBg, flexShrink:0, display:'inline-block',
                animation: (speaking || isTranscribing || aiSpeaking || responding) ? 'blink 0.6s ease infinite' : 'none' }}/>
              {statusLabel}
            </div>
          </div>
        )}

        {/* Визуализация звука (компактная) */}
        {micActive && hasMic && hasChat && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:20 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const peak = Math.sin((i / 11) * Math.PI)
              const h = Math.max(2, Math.round(20 * peak * Math.max(audioLevel * 2.5, 0.07)))
              return (
                <div key={i} style={{
                  width: 2, height: h, borderRadius: 2,
                  background: speaking ? 'var(--accent)' : 'var(--surface-3)',
                  transition: 'height 0.06s ease',
                }} />
              )
            })}
          </div>
        )}

        {/* Кнопки шапки в чат-режиме */}
        {hasChat && (
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button className="btn btn-ghost" style={{ fontSize:12, padding:'5px 10px' }}
              onClick={onClear}>
              <Icon name="trash" size={13}/> Очистить
            </button>
            <button className={micActive ? 'btn btn-ghost' : 'btn btn-primary'}
              style={{ fontSize:12, padding:'5px 10px' }} onClick={onToggleMic}>
              <Icon name={micActive ? 'mic-off' : 'mic'} size={13}/>
              {micActive ? 'Выкл.' : 'Вкл.'}
            </button>
          </div>
        )}
      </div>

      {/* ── Без чата: большой орб, визуализация, подсказки ── */}
      {!hasChat && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 38px 32px' }}>

          {/* Визуализация уровня звука */}
          {micActive && hasMic && (
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:28, marginTop:16 }}>
              {Array.from({ length: 20 }).map((_, i) => {
                const peak = Math.sin((i / 19) * Math.PI)
                const h = isTranscribing
                  ? Math.max(3, Math.round(28 * peak * 0.4))
                  : Math.max(2, Math.round(28 * peak * Math.max(audioLevel * 2.5, 0.08)))
                return (
                  <div key={i} style={{
                    width:3, height:h, borderRadius:2,
                    background: aiSpeaking ? 'var(--accent-soft)'
                      : speaking          ? 'var(--accent)'
                      : 'var(--surface-3)',
                    transition: 'height 0.06s ease, background 0.3s',
                    boxShadow: (speaking || aiSpeaking) && peak > 0.7 ? '0 0 6px var(--accent-glow)' : 'none',
                  }} />
                )
              })}
            </div>
          )}

          {/* Статус */}
          <div style={{ marginTop: hasMic ? 16 : 28, fontFamily:'var(--font-display)', fontSize:17, fontWeight:500, color:'var(--text-dim)', display:'flex', alignItems:'center', gap:9 }}>
            {micActive && hasMic && (
              <span style={{ width:7, height:7, borderRadius:'50%', background:dotBg, display:'inline-block', flexShrink:0,
                animation: (speaking || isTranscribing || aiSpeaking) ? 'blink 0.5s ease infinite' : 'none' }}/>
            )}
            {statusLabel}
          </div>

          {/* Прогресс загрузки модели */}
          {micActive && hasMic && modelStatus === 'loading' && (
            <div style={{ width:220, marginTop:12 }}>
              <div style={{ height:3, borderRadius:3, background:'var(--surface-3)', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg,var(--accent),var(--accent-soft))', width:`${modelProgress}%`, transition:'width .4s' }}/>
              </div>
              <div style={{ fontSize:11, color:'var(--text-mute)', marginTop:4, fontFamily:'var(--font-mono)', textAlign:'center' }}>
                Первый запуск — скачиваем Whisper (~40 МБ)
              </div>
            </div>
          )}

          {/* Живой транскрипт */}
          {transcript && micActive && (
            <div style={{ maxWidth:500, marginTop:16, fontFamily:'var(--font-display)', fontSize:20, fontWeight:500, lineHeight:1.4, color:'var(--text)', textAlign:'center' }}>
              {transcript}<span style={{ color:'var(--accent-soft)', animation:'blink 1s step-end infinite' }}>|</span>
            </div>
          )}

          {/* Подсказки */}
          {!transcript && !isTranscribing && modelStatus === 'ready' && micActive && hasMic && (
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8, marginTop:20, maxWidth:460 }}>
              {suggestions.map((s, i) => (
                <span key={i} className="pill" style={{ padding:'8px 14px', fontSize:13, fontFamily:'var(--font-body)', cursor:'pointer' }}
                  onClick={() => onRespond?.(s)}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Кнопка вкл/выкл */}
          <button className={micActive ? 'btn btn-ghost' : 'btn btn-primary'}
            style={{ marginTop:24, gap:8 }} onClick={onToggleMic}>
            <Icon name={micActive ? 'mic-off' : 'mic'} size={15}/>
            {micActive ? 'Выключить микрофон' : 'Включить микрофон'}
          </button>
        </div>
      )}

      {/* ── Чат-тред ── */}
      {hasChat && (
        <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'16px 38px 8px', display:'flex', flexDirection:'column', gap:14 }}>

          {messages.map((m) => (
            m.role === 'user' ? (
              <div key={m.id} style={{ alignSelf:'flex-end', maxWidth:'78%' }}>
                <div className="msg-me">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} style={{ display:'flex', gap:10, alignItems:'flex-start', maxWidth:'84%' }}>
                <div style={{ flexShrink:0, marginTop:2 }}>
                  <Orb size={28} state="idle" wave={false}/>
                </div>
                <div className="msg-ai" style={{ lineHeight:1.6 }}>{m.content}</div>
              </div>
            )
          ))}

          {/* Стриминг ответа */}
          {(responding || streamText) && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', maxWidth:'84%' }}>
              <div style={{ flexShrink:0, marginTop:2 }}>
                <Orb size={28} state="thinking" wave={true}/>
              </div>
              <div className="msg-ai" style={{ lineHeight:1.6 }}>
                {streamText
                  ? <>{streamText}<span style={{ color:'var(--accent-soft)', animation:'blink 0.8s step-end infinite' }}>▌</span></>
                  : searching
                    ? <span style={{ color:'var(--accent-soft)', fontStyle:'italic', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ animation:'blink 0.5s ease infinite', display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--accent-soft)', flexShrink:0 }}/>
                        🔍 Ищу в интернете…
                      </span>
                    : <span style={{ color:'var(--text-mute)', fontStyle:'italic' }}>
                        Думаю{elapsed > 3 ? `… ${elapsed}с` : '…'}
                        {elapsed > 20 && <span style={{ display:'block', fontSize:11, marginTop:3, color:'var(--text-faint)' }}>Первый ответ медленнее — модель загружается в память</span>}
                      </span>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Индикатор автообучения ── */}
      {hasChat && (learning || learnedFacts.length > 0) && (
        <div style={{ padding:'7px 38px', display:'flex', alignItems:'center', gap:8, flexShrink:0,
          background:'color-mix(in oklch,var(--accent) 8%,transparent)',
          borderTop:'1px solid var(--line-accent)' }}>
          {learning ? (
            <>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent-soft)', display:'inline-block', animation:'blink 0.6s ease infinite' }}/>
              <span style={{ fontSize:12, color:'var(--accent-soft)', fontFamily:'var(--font-mono)' }}>
                Jarvis запоминает разговор…
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize:13 }}>🧠</span>
              <span style={{ fontSize:12, color:'var(--ok)', fontFamily:'var(--font-mono)' }}>
                Запомнил: {learnedFacts.map(f => f.text).join(' · ')}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Живой транскрипт в чат-режиме ── */}
      {hasChat && transcript && micActive && (
        <div style={{ padding:'8px 38px', borderTop:'1px solid var(--line)', fontSize:14, color:'var(--text-mute)', fontStyle:'italic', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block', animation:'blink 0.5s ease infinite' }}/>
          {transcript}
        </div>
      )}

      {/* ── Поле ввода текста (альтернатива голосу) ── */}
      {hasChat && (
        <div style={{ padding:'10px 38px 14px', borderTop:'1px solid var(--line)', flexShrink:0, display:'flex', gap:8, alignItems:'center' }}>
          <input
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
            placeholder="Напиши вопрос или говори голосом…"
            disabled={responding}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
              outline: 'none', opacity: responding ? 0.5 : 1,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--line-accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--line)'}
          />
          <button
            onClick={sendText}
            disabled={!inputText.trim() || responding}
            className="btn btn-primary"
            style={{ flexShrink:0, padding:'10px 16px' }}
          >
            <Icon name="spark" size={15}/>
          </button>
        </div>
      )}

    </div>
  )
}
