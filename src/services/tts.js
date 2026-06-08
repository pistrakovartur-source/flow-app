// tts.js — централизованный TTS с умным выбором голоса
import { Store } from '../store'

let _bestVoice = null
let _voicesReady = false

// Ожидаем загрузку голосов (Chrome/Electron грузит их асинхронно)
function waitVoices() {
  return new Promise(resolve => {
    const v = window.speechSynthesis?.getVoices() || []
    if (v.length) { resolve(v); return }
    const onChanged = () => { resolve(window.speechSynthesis.getVoices()); window.speechSynthesis.removeEventListener('voiceschanged', onChanged) }
    window.speechSynthesis?.addEventListener('voiceschanged', onChanged)
    setTimeout(() => resolve(window.speechSynthesis?.getVoices() || []), 3000)
  })
}

// Рейтинг голоса — выше лучше
function voiceScore(v) {
  if (!v.lang.toLowerCase().startsWith('ru')) return -1
  let s = 10
  if (/natural/i.test(v.name))  s += 50  // нейронный (лучший)
  if (/online/i.test(v.name))   s += 30  // онлайн (хороший)
  if (/irina/i.test(v.name))    s += 10
  if (/svetlan/i.test(v.name))  s += 8
  if (/dmitri/i.test(v.name))   s += 5
  if (v.localService)            s += 3   // доступен офлайн
  return s
}

export async function initTTS() {
  const voices = await waitVoices()
  _voicesReady = true
  const ruVoices = voices.filter(v => voiceScore(v) > 0).sort((a, b) => voiceScore(b) - voiceScore(a))
  _bestVoice = ruVoices[0] || null
  return ruVoices
}

export function getRuVoices() {
  const voices = window.speechSynthesis?.getVoices() || []
  return voices.filter(v => v.lang.toLowerCase().startsWith('ru')).sort((a, b) => voiceScore(b) - voiceScore(a))
}

export function speak(text, overrides = {}) {
  if (!window.speechSynthesis) return

  const settings = Store.get('tts_settings', {})
  const voiceName = overrides.voiceName ?? settings.voiceName ?? null
  const rate      = overrides.rate  ?? settings.rate  ?? 0.92
  const pitch     = overrides.pitch ?? settings.pitch ?? 1.0

  window.speechSynthesis.cancel()

  // Разбиваем на предложения для более естественных пауз
  const sentences = text.slice(0, 500).match(/[^.!?]+[.!?]*/g) || [text]

  function speakChain(idx) {
    if (idx >= sentences.length) return
    const utt = new SpeechSynthesisUtterance(sentences[idx].trim())
    utt.lang   = 'ru-RU'
    utt.rate   = rate
    utt.pitch  = pitch
    utt.volume = 1.0

    // Выбор голоса
    const allVoices = window.speechSynthesis.getVoices()
    let voice = null
    if (voiceName) {
      voice = allVoices.find(v => v.name === voiceName) || null
    }
    if (!voice && _bestVoice) {
      // Перепроверим что объект голоса ещё валиден
      voice = allVoices.find(v => v.name === _bestVoice.name) || _bestVoice
    }
    if (voice) utt.voice = voice

    utt.onend = () => speakChain(idx + 1)
    window.speechSynthesis.speak(utt)
  }

  speakChain(0)
}

export function cancel() {
  window.speechSynthesis?.cancel()
}
