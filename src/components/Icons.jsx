// Icons.jsx — все иконки приложения (SVG inline)
import { cloneElement } from 'react'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONS = {
  // ── новые из нового дизайна ──
  bolt:    <svg viewBox="0 0 24 24" {...stroke}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>,
  flame:   <svg viewBox="0 0 24 24" {...stroke}><path d="M12 22c4 0 6.5-2.7 6.5-6 0-3.6-3-5.6-3.5-9-2 2-2.5 3.5-2.5 5 0 0-1.5-1-1.5-4C8 5 5.5 8 5.5 12c0 4 3 10 6.5 10Z"/></svg>,
  moon:    <svg viewBox="0 0 24 24" {...stroke}><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z"/></svg>,
  sunrise: <svg viewBox="0 0 24 24" {...stroke}><path d="M12 3v5M5 11h14M3 19h18M8 8l4-4 4 4M7.5 15a4.5 4.5 0 0 1 9 0"/></svg>,
  bulb:    <svg viewBox="0 0 24 24" {...stroke}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0 0 12 3Z"/></svg>,
  arrow:   <svg viewBox="0 0 24 24" {...stroke}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  feather: <svg viewBox="0 0 24 24" {...stroke}><path d="M20 4c-6 0-11 5-13 11l-3 3 3 .5C13 17 19 12 20 4Z"/><path d="M12.5 11.5 5 19M16 8h-4"/></svg>,
  pulse:   <svg viewBox="0 0 24 24" {...stroke}><path d="M3 12h4l2.5-7 4 14L17 12h4"/></svg>,
  drop:    <svg viewBox="0 0 24 24" {...stroke}><path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10Z"/></svg>,
  wind:    <svg viewBox="0 0 24 24" {...stroke}><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h9a2.5 2.5 0 1 1-2.5 2.5"/></svg>,
  wallet:  <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 14.5h1.5"/></svg>,
  pin:     <svg viewBox="0 0 24 24" {...stroke}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  target:  <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>,
  play:    <svg viewBox="0 0 24 24" {...stroke}><path d="M7 4.5 19 12 7 19.5Z"/></svg>,
  pause:   <svg viewBox="0 0 24 24" {...stroke}><path d="M8 4.5v15M16 4.5v15"/></svg>,
  gear:    <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.5M12 19v2.5M4.2 7l2.2 1.3M17.6 15.7l2.2 1.3M19.8 7l-2.2 1.3M6.4 15.7 4.2 17M2.5 12H5M19 12h2.5"/></svg>,
  grid:     <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  mic:      <svg viewBox="0 0 24 24" {...stroke}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>,
  'mic-off':<svg viewBox="0 0 24 24" {...stroke}><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 10v-1m14 0v1a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>,
  brain:    <svg viewBox="0 0 24 24" {...stroke}><path d="M9.5 2a2.5 2.5 0 0 1 5 0c2.8.5 4.5 2.8 4.5 5.5 0 1-.3 2-.8 2.8.5.7.8 1.6.8 2.7 0 2.7-1.7 5-4.5 5.5a2.5 2.5 0 0 1-5 0C6.7 18 5 15.7 5 13c0-1.1.3-2 .8-2.7C5.3 9.5 5 8.5 5 7.5c0-2.7 1.7-5 4.5-5.5z"/></svg>,
  history:  <svg viewBox="0 0 24 24" {...stroke}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/><polyline points="12 7 12 12 15 15"/></svg>,
  settings: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  check:    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><polyline points="20 6 9 17 4 12"/></svg>,
  plus:     <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  minus:    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2}><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  square:   <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="18" height="18" rx="3"/></svg>,
  x:        <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bell:     <svg viewBox="0 0 24 24" {...stroke}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  calendar: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  spark:    <svg viewBox="0 0 24 24" {...stroke}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  waveform: <svg viewBox="0 0 24 24" {...stroke}><line x1="2" y1="12" x2="2" y2="12"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="10" y1="5" x2="10" y2="19"/><line x1="14" y1="8" x2="14" y2="16"/><line x1="18" y1="10" x2="18" y2="14"/><line x1="22" y1="12" x2="22" y2="12"/></svg>,
  chevron:  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>,
  search:   <svg viewBox="0 0 24 24" {...stroke}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link:     <svg viewBox="0 0 24 24" {...stroke}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  shield:   <svg viewBox="0 0 24 24" {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  location: <svg viewBox="0 0 24 24" {...stroke}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock:    <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  heart:    <svg viewBox="0 0 24 24" {...stroke}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  trash:    <svg viewBox="0 0 24 24" {...stroke}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  coffee:   <svg viewBox="0 0 24 24" {...stroke}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>,
  book:     <svg viewBox="0 0 24 24" {...stroke}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  run:      <svg viewBox="0 0 24 24" {...stroke}><circle cx="13" cy="4" r="1.5"/><path d="M8 17.5l1.5-4.5 2.5 2 3-4.5"/><path d="M5 20l3.5-5 2 2 1-4 3.5 1 2-3"/></svg>,
  note:     <svg viewBox="0 0 24 24" {...stroke}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  mail:     <svg viewBox="0 0 24 24" {...stroke}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  music:    <svg viewBox="0 0 24 24" {...stroke}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  home:     <svg viewBox="0 0 24 24" {...stroke}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  map:      <svg viewBox="0 0 24 24" {...stroke}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  google:   <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/></svg>,
  warn:     <svg viewBox="0 0 24 24" {...stroke}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  timer:    <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 15.5"/><path d="M9 2h6"/><path d="M12 2v3"/></svg>,
  edit:     <svg viewBox="0 0 24 24" {...stroke}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  tag:      <svg viewBox="0 0 24 24" {...stroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  zap:       <svg viewBox="0 0 24 24" {...stroke}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  filter:    <svg viewBox="0 0 24 24" {...stroke}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  repeat:    <svg viewBox="0 0 24 24" {...stroke}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  newspaper: <svg viewBox="0 0 24 24" {...stroke}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5"/><rect x="10" y="6" width="8" height="4" rx="1"/></svg>,
  diary:     <svg viewBox="0 0 24 24" {...stroke}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>,
  refresh:   <svg viewBox="0 0 24 24" {...stroke}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  sun:      <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
}

export function Icon({ name, size = 20, style = {} }) {
  const svg = ICONS[name]
  if (!svg) return null
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
      {cloneElement(svg, { style: { width: '100%', height: '100%' } })}
    </span>
  )
}
