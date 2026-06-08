/* Voice.jsx — экран голосового режима */

function Voice({ assistant }) {
  const { useState, useRef, useEffect } = React;

  // Состояния: idle | listening | thinking | speaking
  const [state, setState]         = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply]         = useState('');

  const timers = useRef([]);

  // Демо-диалог для показа анимации
  const DEMO = {
    q: `${assistant}, что у меня важного завтра и когда лучше выйти на пробежку?`,
    a: `Завтра в 10:00 — презентация проекта, это главное. После 17:00 свободно и обещают +12° без дождя — идеальное окно для пробежки. Поставить напоминание на 17:30?`,
  };

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clear(), []);

  // Посимвольный ввод текста
  const typeText = (full, setter, speed, done) => {
    let i = 0;
    const step = () => {
      setter(full.slice(0, i));
      i++;
      if (i <= full.length) timers.current.push(setTimeout(step, speed));
      else if (done)         timers.current.push(setTimeout(done, 400));
    };
    step();
  };

  // Запуск демо
  const run = () => {
    clear();
    setReply('');
    setTranscript('');
    setState('listening');

    typeText(DEMO.q, setTranscript, 30, () => {
      setState('thinking');
      timers.current.push(setTimeout(() => {
        setState('speaking');
        typeText(DEMO.a, setReply, 22, () => setState('idle'));
      }, 1100));
    });
  };

  const stop = () => { clear(); setState('idle'); };

  const label = {
    idle:      'Нажми, чтобы говорить',
    listening: 'Слушаю…',
    thinking:  'Думаю…',
    speaking:  `${assistant} отвечает`,
  }[state];

  const suggestions = [
    'Какие планы на завтра?',
    'Запиши идею',
    'Сколько я сегодня сделал?',
    'Напомни выпить воды',
  ];

  return (
    <div className="page" style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      paddingTop: 8,
    }}>

      {/* Заголовок */}
      <div className="page-kicker" style={{ marginBottom: 30 }}>Голосовой режим</div>

      {/* Орб — кликабельный */}
      <div onClick={() => state === 'idle' ? run() : stop()} style={{ cursor: 'pointer' }}>
        <Orb size={300} state={state} wave />
      </div>

      {/* Статус */}
      <div style={{
        marginTop: 34,
        fontFamily: 'var(--font-display)',
        fontSize: 17,
        fontWeight: 500,
        color: 'var(--text-dim)',
        letterSpacing: '0.01em',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          {state !== 'idle' && <span className="dot-pulse" />}
          {label}
        </span>
      </div>

      {/* Текст диалога */}
      <div style={{ maxWidth: 620, marginTop: 22, minHeight: 96 }}>
        {transcript && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.45 }}>
            {transcript}
            {state === 'listening' && <span className="caret">|</span>}
          </div>
        )}
        {reply && (
          <div className="row gap-m" style={{ marginTop: 20, textAlign: 'left', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 30px' }}>
              <Orb size={30} state="idle" wave={false} />
            </div>
            <div style={{ flex: 1, color: 'var(--text-dim)', fontSize: 15.5, lineHeight: 1.6 }}>
              {reply}
              {state === 'speaking' && <span className="caret">|</span>}
            </div>
          </div>
        )}
      </div>

      {/* Подсказки (только в idle без ответа) */}
      {state === 'idle' && !reply && (
        <div className="row gap-s" style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 30, maxWidth: 560 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="pill"
              style={{ padding: '9px 15px', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}
              onClick={run}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Кнопка "спросить ещё" после ответа */}
      {reply && state === 'idle' && (
        <button className="btn btn-ghost" style={{ marginTop: 26 }} onClick={run}>
          <Icon name="mic" size={16}/> Спросить ещё
        </button>
      )}
    </div>
  );
}

window.Voice = Voice;
