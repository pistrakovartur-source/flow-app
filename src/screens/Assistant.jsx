import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from '../components/Icons'
import { Store, uid, useStore } from '../store'
import { speak as ttsspeak, getRuVoices, cancel as ttsCancel } from '../services/tts'

// ── Локальные команды (push-to-talk) ──────────────────────────────────────
const NAV_CMDS = [
  { rx: /задач/,                nav: 'tasks',     say: 'Открываю задачи' },
  { rx: /календар/,             nav: 'calendar',  say: 'Открываю календарь' },
  { rx: /фокус|помодор|таймер/, nav: 'focus',     say: 'Открываю фокус' },
  { rx: /привычк/,              nav: 'habits',    say: 'Открываю привычки' },
  { rx: /бюджет/,               nav: 'budget',    say: 'Открываю бюджет' },
  { rx: /заметк/,               nav: 'notes',     say: 'Открываю заметки' },
  { rx: /музык/,                nav: 'music',     say: 'Открываю музыку' },
  { rx: /активност/,            nav: 'activity',  say: 'Открываю активность' },
  { rx: /настройк/,             nav: 'settings',  say: 'Открываю настройки' },
  { rx: /главн|домой|дашборд/,  nav: 'dashboard', say: 'Открываю главную' },
  { rx: /новост/,               nav: 'news',      say: 'Открываю новости' },
]

function processLocal(text, onNavigate) {
  const t = text.toLowerCase().trim()
  if (/открой|перейди|покажи|переключ|иди/.test(t)) {
    for (const cmd of NAV_CMDS) {
      if (cmd.rx.test(t)) { onNavigate(cmd.nav); return cmd.say }
    }
  }
  const taskM = t.match(/добавь?\s+задачу?\s+(.+)/)
  if (taskM) {
    const title = taskM[1].trim()
    Store.set('tasks', [...Store.get('tasks', []), { id: uid(), text: title, tag: 'Личное', priority: 'mid', done: false, created: Date.now() }])
    return `Задача "${title}" добавлена`
  }
  if (/который час|сколько времени|время/.test(t))
    return `Сейчас ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  if (/какой день|какая дата|число/.test(t))
    return `Сегодня ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (/сколько задач|мои задач/.test(t)) {
    const n = Store.get('tasks', []).filter(x => !x.done).length
    return `У тебя ${n} активных задач`
  }
  if (/запуст|начн/.test(t) && /фокус|таймер|работ/.test(t)) {
    onNavigate('focus'); return 'Запускаю фокус'
  }
  return null
}

function speak(text) {
  const s = Store.get('tts_settings', {})
  ttsspeak(text, { rate: s.rate, pitch: s.pitch, voiceName: s.voiceName })
}

// ── Главный экран ──────────────────────────────────────────────────────────
export function Assistant({ onNavigate }) {
  const [alwaysListen, setAlwaysListen] = useStore('always_listen', false)
  const [wakeWord,     setWakeWord]     = useStore('wake_word', 'джарвис')
  const [wakeLast]                      = useStore('wake_last', null)

  const [ttsSettings, setTtsSettings] = useStore('tts_settings', { voiceName: null, rate: 0.92, pitch: 1.0, engine: 'web' })

  const [status,       setStatus]       = useState('idle')
  const [transcript,   setTranscript]   = useState('')
  const [reply,        setReply]        = useState('')
  const [history,      setHistory]      = useState([])
  const [textInput,    setTextInput]    = useState('')
  const [speechErr,    setSpeechErr]    = useState('')
  const [whisperReady, setWhisperReady] = useState(null)
  const [setupMsg,     setSetupMsg]     = useState('')
  const [editingWake,  setEditingWake]  = useState(false)
  const [wakeInput,    setWakeInput]    = useState(wakeWord)
  const [webVoices,    setWebVoices]    = useState([])
  const [sapiVoices,   setSapiVoices]   = useState([])
  const [voiceTab,     setVoiceTab]     = useState('web') // 'web' | 'sapi'
  const [testPlaying,  setTestPlaying]  = useState(false)

  const listeningRef  = useRef(false)
  const audioCtxRef   = useRef(null)
  const streamRef     = useRef(null)
  const processorRef  = useRef(null)
  const chunksRef     = useRef([])
  const onNavigateRef = useRef(onNavigate)
  useEffect(() => { onNavigateRef.current = onNavigate }, [onNavigate])

  useEffect(() => {
    window.jarvis?.speech?.getStatus().then(s => setWhisperReady(s?.ready ?? false))
    window.jarvis?.speech?.onProgress(msg => {
      if (msg === 'done')              { setWhisperReady(true); setSetupMsg('') }
      else if (msg?.startsWith('error:')) setSetupMsg('Ошибка: ' + msg.slice(6))
      else                                setSetupMsg(msg)
    })
    // Загружаем доступные голоса
    const loadVoices = () => setWebVoices(getRuVoices())
    loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices)
    window.jarvis?.tts?.getVoices?.().then(v => setSapiVoices(v || []))
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const startSetup = async () => {
    setSetupMsg('Запускаю загрузку…')
    const res = await window.jarvis?.speech?.setup()
    if (!res?.ok) setSetupMsg('Ошибка: ' + (res?.error || 'неизвестно'))
  }

  const handleCommand = useCallback(async (text) => {
    if (!text.trim()) return
    setStatus('thinking')
    setTranscript(text)

    const local = processLocal(text, onNavigateRef.current)
    if (local) {
      setReply(local)
      setHistory(h => [{ text, reply: local, ts: Date.now() }, ...h].slice(0, 30))
      speak(local)
      setStatus('speaking')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    if (window.jarvis?.web?.search) {
      const data = await window.jarvis.web.search({ query: text, maxResults: 1 }).catch(() => null)
      const r = data?.results?.[0]
      if (r?.snippet) {
        const ans = r.snippet.slice(0, 200)
        setReply(ans)
        setHistory(h => [{ text, reply: ans, ts: Date.now() }, ...h].slice(0, 30))
        speak(ans)
        setStatus('speaking')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }
    }

    setReply('Не знаю ответа.')
    setStatus('idle')
  }, [])

  const submitText = useCallback(() => {
    const t = textInput.trim()
    if (!t) return
    setTextInput('')
    handleCommand(t)
  }, [textInput, handleCommand])

  const startListening = useCallback(async () => {
    if (!whisperReady) { setSpeechErr('Сначала установи Whisper (кнопка ниже)'); return }

    if (listeningRef.current) {
      listeningRef.current = false
      processorRef.current?.disconnect()
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      const chunks = chunksRef.current
      chunksRef.current = []
      if (chunks.length < 4) { setStatus('idle'); setTranscript(''); return }

      const total = chunks.reduce((s, c) => s + c.length, 0)
      const pcm = new Int16Array(total)
      let off = 0
      for (const c of chunks) { pcm.set(c, off); off += c.length }

      setStatus('thinking')
      setTranscript('Распознаю…')
      const res = await window.jarvis?.speech?.recognize(pcm.buffer).catch(() => null)
      if (!res?.ok || !res.text) {
        setSpeechErr(res?.error || 'Речь не распознана')
        setStatus('idle'); setTranscript(''); return
      }
      setSpeechErr('')
      const clean = res.text.replace(/^(джарвис|flow|флоу)[,!.\s]*/i, '').trim()
      handleCommand(clean || res.text)
      return
    }

    setSpeechErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      })
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []
      processor.onaudioprocess = e => {
        if (!listeningRef.current) return
        const float = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float.length)
        for (let i = 0; i < float.length; i++)
          int16[i] = Math.max(-32768, Math.min(32767, float[i] * 32768))
        chunksRef.current.push(int16)
      }
      source.connect(processor)
      processor.connect(ctx.destination)
      listeningRef.current = true
      setStatus('listening')
      setTranscript('Говори… нажми снова чтобы остановить')
    } catch {
      setSpeechErr('Нет доступа к микрофону')
      setStatus('error')
    }
  }, [handleCommand, whisperReady])

  useEffect(() => {
    return () => {
      listeningRef.current = false
      processorRef.current?.disconnect()
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      window.speechSynthesis?.cancel()
    }
  }, [])

  const saveWakeWord = () => {
    const w = wakeInput.trim().toLowerCase()
    if (w) setWakeWord(w)
    setEditingWake(false)
  }

  const setTts = (key, val) => setTtsSettings(s => ({ ...s, [key]: val }))

  const testVoice = async () => {
    if (testPlaying) return
    setTestPlaying(true)
    const sample = 'Привет! Это тестовый голос. Как звучит?'
    if (ttsSettings.engine === 'sapi') {
      const res = await window.jarvis?.tts?.speak({ text: sample, voiceName: ttsSettings.voiceName, rate: Math.round((ttsSettings.rate - 1) * 5) }).catch(() => null)
      if (res?.ok && res.audio) {
        const audio = new Audio(`data:${res.mimeType};base64,${res.audio}`)
        audio.onended = () => setTestPlaying(false)
        audio.play()
        return
      }
    }
    ttsspeak(sample, { rate: ttsSettings.rate, pitch: ttsSettings.pitch, voiceName: ttsSettings.voiceName })
    setTimeout(() => setTestPlaying(false), 3000)
  }

  const statusMeta = {
    idle:      { label: 'Нажми для записи',                  color: 'var(--text-mute)', glow: false },
    listening: { label: 'Говори… нажми снова чтобы остановить', color: 'var(--accent)',    glow: true  },
    thinking:  { label: 'Распознаю…',                        color: '#fbbf24',           glow: false },
    speaking:  { label: 'Говорю…',                           color: 'var(--ok)',          glow: false },
    error:     { label: 'Ошибка',                            color: '#f87171',           glow: false },
  }
  const sm = statusMeta[status] || statusMeta.idle

  return (
    <div className="page" style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Заголовок */}
      <div style={{ marginBottom:20 }}>
        <div className="page-kicker">Голосовое управление</div>
        <div className="page-title">Ассистент</div>
      </div>

      {/* ── Режим постоянного прослушивания ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
        borderRadius:'var(--r-lg)', background: alwaysListen ? 'rgba(34,197,94,.08)' : 'var(--surface-1)',
        border: `1px solid ${alwaysListen ? 'rgba(34,197,94,.3)' : 'var(--line)'}`,
        marginBottom:16, transition:'all .2s',
      }}>
        {/* Иконка + статус */}
        <div style={{ position:'relative', flexShrink:0 }}>
          {alwaysListen && (
            <>
              <div style={{ position:'absolute', inset:-8, borderRadius:'50%', background:'#22c55e', opacity:.12, animation:'orbPulse 2s ease-in-out infinite' }}/>
              <div style={{ position:'absolute', inset:-4, borderRadius:'50%', background:'#22c55e', opacity:.18, animation:'orbPulse 2s ease-in-out infinite .4s' }}/>
            </>
          )}
          <div style={{
            width:44, height:44, borderRadius:'50%',
            background: alwaysListen ? 'rgba(34,197,94,.15)' : 'var(--surface-2)',
            border: `2px solid ${alwaysListen ? '#22c55e' : 'var(--line)'}`,
            display:'grid', placeItems:'center', position:'relative', zIndex:1, transition:'all .2s',
          }}>
            <Icon name="mic" size={20} style={{ color: alwaysListen ? '#22c55e' : 'var(--text-mute)' }} />
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:3 }}>
            Всегда слушать
          </div>
          <div style={{ fontSize:12, color:'var(--text-mute)', lineHeight:1.4 }}>
            {alwaysListen
              ? <>Активно · скажи <span style={{ color:'#22c55e', fontFamily:'var(--font-mono)', fontWeight:600 }}>«{wakeWord}»</span> + команда</>
              : 'Микрофон в фоне · срабатывает на пробуждающее слово'
            }
          </div>
        </div>

        {/* Wake-word настройка */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {editingWake ? (
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input
                autoFocus
                value={wakeInput}
                onChange={e => setWakeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveWakeWord(); if (e.key === 'Escape') setEditingWake(false) }}
                placeholder="джарвис"
                style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--accent)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, outline:'none', width:100 }}
              />
              <button className="btn btn-primary" style={{ padding:'5px 10px', fontSize:12 }} onClick={saveWakeWord}>ОК</button>
            </div>
          ) : (
            <button
              onClick={() => { setWakeInput(wakeWord); setEditingWake(true) }}
              style={{ padding:'4px 10px', borderRadius:8, border:'1px solid var(--line)', background:'var(--surface-2)', color:'var(--text-mute)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-mono)' }}
            >
              «{wakeWord}»
            </button>
          )}

          {/* Toggle */}
          <div
            onClick={() => {
              if (!whisperReady && !alwaysListen) { setSpeechErr('Сначала установи Whisper'); return }
              setAlwaysListen(!alwaysListen)
            }}
            title={alwaysListen ? 'Выключить постоянное прослушивание' : 'Включить постоянное прослушивание'}
            style={{
              width:48, height:26, borderRadius:99, cursor:'pointer', position:'relative',
              background: alwaysListen ? '#22c55e' : 'var(--surface-3)',
              border:`1px solid ${alwaysListen ? '#22c55e' : 'var(--line)'}`,
              transition:'all .2s', flexShrink:0,
            }}
          >
            <div style={{
              position:'absolute', top:3,
              left: alwaysListen ? 'calc(100% - 22px)' : 3,
              width:18, height:18, borderRadius:'50%',
              background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.2)',
              transition:'left .2s',
            }} />
          </div>
        </div>
      </div>

      {/* Последняя wake-команда */}
      {wakeLast && alwaysListen && (
        <div style={{
          display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px',
          borderRadius:12, background:'rgba(34,197,94,.06)', border:'1px solid rgba(34,197,94,.2)',
          marginBottom:14, fontSize:12,
        }}>
          <span style={{ fontSize:16, marginTop:-1 }}>🎙</span>
          <div>
            <div style={{ color:'var(--text-mute)', marginBottom:2 }}>
              {new Date(wakeLast.ts).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </div>
            <div style={{ color:'var(--text)', fontStyle:'italic' }}>«{wakeLast.raw}»</div>
            {wakeLast.cmd && <div style={{ color:'#22c55e', marginTop:2, fontWeight:600 }}>→ {wakeLast.cmd}</div>}
          </div>
        </div>
      )}

      {/* ── Настройки голоса ── */}
      <VoiceSettings
        settings={ttsSettings}
        onChange={setTts}
        webVoices={webVoices}
        sapiVoices={sapiVoices}
        voiceTab={voiceTab}
        setVoiceTab={setVoiceTab}
        onTest={testVoice}
        testPlaying={testPlaying}
      />

      {/* Установка Whisper */}
      {whisperReady === false && (
        <div style={{ maxWidth:520, margin:'0 auto 16px', padding:'16px', borderRadius:14, background:'color-mix(in oklch,var(--accent) 8%,transparent)', border:'1px solid var(--line-accent)' }}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>Нужна установка Whisper</div>
          <div style={{ fontSize:12.5, color:'var(--text-mute)', marginBottom:12, lineHeight:1.5 }}>
            Загрузит бинарник whisper.cpp (~10MB) и модель tiny (~75MB). Один раз, потом офлайн.
          </div>
          {setupMsg ? (
            <div style={{ fontSize:12, color:'var(--accent-soft)', fontFamily:'var(--font-mono)' }}>{setupMsg}</div>
          ) : (
            <button onClick={startSetup} style={{ padding:'8px 18px', borderRadius:9, border:'1px solid var(--line-accent)', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              Установить (~85MB)
            </button>
          )}
        </div>
      )}

      {/* Кнопка push-to-talk */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'20px 0' }}>
        <div style={{ position:'relative' }}>
          {status === 'listening' && (
            <>
              <div style={{ position:'absolute', inset:-16, borderRadius:'50%', background:'var(--accent)', opacity:.12, animation:'orbPulse 1.2s ease-in-out infinite' }}/>
              <div style={{ position:'absolute', inset:-8,  borderRadius:'50%', background:'var(--accent)', opacity:.18, animation:'orbPulse 1.2s ease-in-out infinite .3s' }}/>
            </>
          )}
          <button
            onClick={startListening}
            disabled={status === 'thinking'}
            title="Нажми и говори"
            style={{
              width:88, height:88, borderRadius:'50%',
              border:`2px solid ${sm.color}`,
              background: status === 'listening' ? 'color-mix(in oklch,var(--accent) 18%,transparent)' : 'var(--surface-2)',
              cursor:'pointer', display:'grid', placeItems:'center', transition:'all .2s',
              boxShadow: sm.glow ? `0 0 28px var(--accent-glow)` : 'none',
              position:'relative', zIndex:1,
            }}>
            <Icon name="mic" size={32} style={{ color: sm.color }}/>
          </button>
        </div>

        <div style={{ fontSize:12.5, color: sm.color, fontFamily:'var(--font-mono)', letterSpacing:'.06em', fontWeight:600 }}>
          {sm.label}
        </div>

        {(transcript || reply) && (
          <div style={{ maxWidth:500, textAlign:'center', display:'flex', flexDirection:'column', gap:8 }}>
            {transcript && (
              <div style={{ fontSize:13, color:'var(--text-mute)', fontStyle:'italic', background:'var(--surface-2)', padding:'8px 14px', borderRadius:10, border:'1px solid var(--line)' }}>
                «{transcript}»
              </div>
            )}
            {reply && (
              <div style={{ fontSize:14, color:'var(--text)', background:'color-mix(in oklch,var(--accent) 8%,transparent)', padding:'10px 16px', borderRadius:12, border:'1px solid var(--line-accent)', lineHeight:1.5 }}>
                {reply}
              </div>
            )}
          </div>
        )}
      </div>

      {speechErr && (
        <div style={{ maxWidth:500, margin:'-8px auto 14px', padding:'9px 14px', borderRadius:10, background:'color-mix(in oklch,#f87171 8%,transparent)', border:'1px solid rgba(248,113,113,.25)', fontSize:12, color:'#f87171', textAlign:'center' }}>
          {speechErr}
        </div>
      )}

      {/* Текстовый ввод */}
      <div style={{ display:'flex', gap:8, maxWidth:540, margin:'0 auto 18px', width:'100%' }}>
        <input
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitText()}
          placeholder="Введи команду или вопрос…"
          style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'var(--font-body)' }}
        />
        <button
          onClick={submitText}
          disabled={!textInput.trim() || status === 'thinking'}
          style={{ padding:'10px 16px', borderRadius:10, border:'1px solid var(--line-accent)', background:'color-mix(in oklch,var(--accent) 16%,transparent)', color:'var(--accent-soft)', cursor:'pointer', fontSize:13, fontWeight:500, opacity:(!textInput.trim() || status === 'thinking') ? .4 : 1 }}
        >
          Отправить
        </button>
      </div>

      {/* Нижняя сетка */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, flex:1 }}>

        {/* Команды */}
        <div className="card card-pad" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:11, color:'var(--text-mute)', fontFamily:'var(--font-mono)', letterSpacing:'.04em' }}>КОМАНДЫ</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[
              [`${wakeWord}, открой задачи`,        'Переход в Задачи'],
              [`${wakeWord}, открой фокус`,         'Переход в Фокус'],
              [`${wakeWord}, открой новости`,       'Переход в Новости'],
              [`${wakeWord}, добавь задачу [текст]`,'Создать задачу'],
              [`${wakeWord}, который час`,          'Сказать время'],
              [`${wakeWord}, сколько задач`,        'Число активных задач'],
            ].map(([cmd, desc]) => (
              <div key={cmd} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--line)' }}>
                <span style={{ fontSize:11.5, fontFamily:'var(--font-mono)', color:'var(--accent-soft)' }}>«{cmd}»</span>
                <span style={{ fontSize:11, color:'var(--text-mute)', marginLeft:8, textAlign:'right', flexShrink:0 }}>{desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:4, fontSize:11, color:'var(--text-faint)', lineHeight:1.5 }}>
            В режиме «Всегда слушать» просто говори — приложение реагирует на ключевое слово в фоне
          </div>
        </div>

        {/* История */}
        <div className="card card-pad" style={{ display:'flex', flexDirection:'column', gap:10, minHeight:160 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text-mute)', fontFamily:'var(--font-mono)', letterSpacing:'.04em' }}>ИСТОРИЯ</span>
            {history.length > 0 && (
              <button onClick={() => setHistory([])} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text-faint)', padding:'2px 6px' }}>
                Очистить
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-faint)', fontSize:12, flexDirection:'column', gap:8, opacity:.5 }}>
              <Icon name="mic" size={26}/>
              Попробуй сказать команду
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto', flex:1 }}>
              {history.map((h, i) => (
                <div key={i} style={{ padding:'8px 11px', borderRadius:10, background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                  <div style={{ fontSize:11, color:'var(--text-mute)', fontStyle:'italic', marginBottom:4 }}>«{h.text}»</div>
                  <div style={{ fontSize:12.5, color:'var(--text)', lineHeight:1.4 }}>{h.reply}</div>
                  <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:4, fontFamily:'var(--font-mono)' }}>
                    {new Date(h.ts).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Настройки голоса ───────────────────────────────────────────────────────
function VoiceSettings({ settings, onChange, webVoices, sapiVoices, voiceTab, setVoiceTab, onTest, testPlaying }) {
  const [open, setOpen] = useState(false)
  const voices = voiceTab === 'web' ? webVoices : sapiVoices.filter(v => /ru/i.test(v.culture))
  const allSapi = sapiVoices.filter(v => /ru/i.test(v.culture))

  return (
    <div style={{ marginBottom:16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', padding:'11px 16px', borderRadius:'var(--r-lg)',
          background:'var(--surface-1)', border:'1px solid var(--line)',
          display:'flex', alignItems:'center', gap:10, cursor:'pointer',
          fontSize:13, color:'var(--text)', textAlign:'left', transition:'border-color .15s',
        }}
      >
        <Icon name="waveform" size={16} style={{ color:'var(--text-mute)', flexShrink:0 }} />
        <span style={{ flex:1, fontWeight:500 }}>Голос</span>
        {settings.voiceName && (
          <span style={{ fontSize:11, color:'var(--accent-soft)', fontFamily:'var(--font-mono)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {settings.voiceName}
          </span>
        )}
        <span style={{ fontSize:11, color:'var(--text-faint)', transform: open ? 'rotate(90deg)' : 'none', transition:'transform .15s' }}>›</span>
      </button>

      {open && (
        <div style={{ marginTop:8, padding:'14px 16px', borderRadius:'var(--r-lg)', background:'var(--surface-1)', border:'1px solid var(--line)', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Движок */}
          <div style={{ display:'flex', gap:6 }}>
            {[['web', 'Браузер (Web Speech)'], ['sapi', 'Windows SAPI']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setVoiceTab(id); onChange('engine', id); onChange('voiceName', null) }}
                style={{
                  flex:1, padding:'7px 0', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer',
                  border: settings.engine === id ? 'none' : '1px solid var(--line)',
                  background: settings.engine === id ? 'var(--accent)' : 'var(--surface-2)',
                  color: settings.engine === id ? '#fff' : 'var(--text-mute)',
                  transition:'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Список голосов */}
          {voices.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:180, overflowY:'auto' }}>
              <div style={{ fontSize:11, color:'var(--text-mute)', marginBottom:4, fontFamily:'var(--font-mono)' }}>
                ДОСТУПНЫЕ ГОЛОСА {voiceTab === 'web' ? '(браузер)' : '(Windows)'}
              </div>
              {/* Авто */}
              <VoiceRow
                name="— Авто (лучший)"
                selected={!settings.voiceName}
                badge={null}
                onClick={() => onChange('voiceName', null)}
              />
              {voices.map((v, i) => {
                const name = typeof v === 'string' ? v : v.name
                const badge = typeof v === 'object' && /natural/i.test(name) ? 'нейронный' : typeof v === 'object' && /online/i.test(name) ? 'онлайн' : null
                return (
                  <VoiceRow
                    key={i}
                    name={name}
                    selected={settings.voiceName === name}
                    badge={badge}
                    onClick={() => onChange('voiceName', name)}
                  />
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize:12, color:'var(--text-faint)', textAlign:'center', padding:'8px 0' }}>
              {voiceTab === 'sapi'
                ? 'Голоса не найдены — проверь языковые пакеты Windows'
                : 'Голоса загружаются…'}
            </div>
          )}

          {/* Скорость */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:12, color:'var(--text-mute)' }}>Скорость речи</span>
              <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--accent-soft)' }}>
                {settings.engine === 'web' ? `×${settings.rate?.toFixed(2)}` : `${Math.round((settings.rate - 1) * 5)} (SAPI)`}
              </span>
            </div>
            <input
              type="range" min="0.6" max="1.4" step="0.02"
              value={settings.rate ?? 0.92}
              onChange={e => onChange('rate', parseFloat(e.target.value))}
              style={{ width:'100%', accentColor:'var(--accent)' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-faint)', marginTop:2 }}>
              <span>Медленно</span><span>Нормально</span><span>Быстро</span>
            </div>
          </div>

          {/* Тон (только для Web Speech) */}
          {settings.engine === 'web' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, color:'var(--text-mute)' }}>Тон голоса</span>
                <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--accent-soft)' }}>
                  ×{settings.pitch?.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min="0.7" max="1.3" step="0.02"
                value={settings.pitch ?? 1.0}
                onChange={e => onChange('pitch', parseFloat(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent)' }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-faint)', marginTop:2 }}>
                <span>Низкий</span><span>Нормальный</span><span>Высокий</span>
              </div>
            </div>
          )}

          {/* Тест */}
          <button
            onClick={onTest}
            disabled={testPlaying}
            style={{
              padding:'8px 0', borderRadius:10, border:'1px solid var(--line-accent)',
              background:'color-mix(in oklch,var(--accent) 12%,transparent)',
              color:'var(--accent-soft)', fontSize:13, fontWeight:500, cursor:'pointer',
              opacity: testPlaying ? .5 : 1,
            }}
          >
            {testPlaying ? '▶ Воспроизведение…' : '▶ Тест голоса'}
          </button>
        </div>
      )}
    </div>
  )
}

function VoiceRow({ name, selected, badge, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
        borderRadius:9, cursor:'pointer', transition:'background .12s',
        background: selected ? 'color-mix(in oklch,var(--accent) 14%,transparent)' : 'transparent',
        border: `1px solid ${selected ? 'var(--line-accent)' : 'transparent'}`,
      }}
    >
      <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${selected ? 'var(--accent)' : 'var(--line)'}`, background: selected ? 'var(--accent)' : 'transparent', flexShrink:0, transition:'all .12s' }} />
      <span style={{ fontSize:12.5, color: selected ? 'var(--text)' : 'var(--text-mute)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
      {badge && (
        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'rgba(34,197,94,.15)', color:'#22c55e', fontWeight:600, flexShrink:0 }}>{badge}</span>
      )}
    </div>
  )
}
