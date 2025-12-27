import { useEffect, useRef, useState } from "react";

type Timer = {
  id: string;
  name: string;
  durationMs: number;
  remainingMs: number;
  isRunning: boolean;
  isSelected: boolean;
};

type PersistedState = {
  timers: Timer[];
  lastUpdatedMs: number;
};

const translations = {
  en: {
    title: "Break Timer",
    subtitle: "Manage multiple countdowns for quiz or event breaks.",
    nameLabel: "Name",
    namePlaceholder: "Person or team",
    durationLabel: "Duration (minutes)",
    addEntry: "Add entry",
    startSelected: "Start selected",
    pauseSelected: "Pause selected",
    resetSelected: "Reset selected",
    removeSelected: "Remove selected",
    startAll: "Start all",
    pauseAll: "Pause all",
    noTimers: "No timers yet. Add a person to get started.",
    select: "Select",
    statusRunning: "Running",
    statusPaused: "Paused",
    start: "Start",
    pause: "Pause",
    remove: "Remove",
    language: "Language",
  },
  zh: {
    title: "休息计时器",
    subtitle: "管理测验或活动休息的多个倒计时。",
    nameLabel: "名称",
    namePlaceholder: "参与者或队伍",
    durationLabel: "时长（分钟）",
    addEntry: "添加计时",
    startSelected: "开始所选",
    pauseSelected: "暂停所选",
    resetSelected: "重置所选",
    removeSelected: "删除所选",
    startAll: "开始全部",
    pauseAll: "暂停全部",
    noTimers: "还没有计时器。添加一个人开始吧。",
    select: "选择",
    statusRunning: "进行中",
    statusPaused: "已暂停",
    start: "开始",
    pause: "暂停",
    remove: "删除",
    language: "语言",
  },
} as const;

type Language = keyof typeof translations;

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const initialDurationMinutes = 60;
const STORAGE_KEY = "multi-break-timers";

function App() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
  const [language, setLanguage] = useState<Language>("en");
  const lastTickRef = useRef(Date.now());
  const [hydrated, setHydrated] = useState(false);
  const t = translations[language];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: PersistedState = JSON.parse(raw);
      const elapsed = Math.max(0, Date.now() - parsed.lastUpdatedMs);
      const adjusted = parsed.timers.map((timer) => {
        if (!timer.isRunning || timer.remainingMs <= 0) return timer;
        const remainingMs = Math.max(0, timer.remainingMs - elapsed);
        return { ...timer, remainingMs, isRunning: remainingMs > 0 };
      });
      setTimers(adjusted);
      lastTickRef.current = Date.now();
    } catch (error) {
      console.error("Failed to load timers from storage", error);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setTimers((prev) =>
        prev.map((timer) => {
          if (!timer.isRunning || timer.remainingMs <= 0) {
            if (timer.remainingMs <= 0 && timer.isRunning) {
              return { ...timer, remainingMs: 0, isRunning: false };
            }
            return timer;
          }
          const remainingMs = Math.max(0, timer.remainingMs - delta);
          return {
            ...timer,
            remainingMs,
            isRunning: remainingMs > 0,
          };
        }),
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      timers,
      lastUpdatedMs: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist timers", error);
    }
  }, [timers, hydrated]);

  const addTimer = () => {
    const cleanName = nameInput.trim();
    if (!cleanName) return;
    const durationMs = Math.max(1, durationMinutes) * 60 * 1000;
    const newTimer: Timer = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
      name: cleanName,
      durationMs,
      remainingMs: durationMs,
      isRunning: false,
      isSelected: false,
    };
    setTimers((prev) => [...prev, newTimer]);
    setNameInput("");
  };

  const toggleSelect = (id: string) => {
    setTimers((prev) =>
      prev.map((timer) =>
        timer.id === id ? { ...timer, isSelected: !timer.isSelected } : timer,
      ),
    );
  };

  const removeTimer = (id: string) => {
    setTimers((prev) => prev.filter((timer) => timer.id !== id));
  };

  const removeSelected = () => {
    setTimers((prev) => prev.filter((timer) => !timer.isSelected));
  };

  const startSelected = () => {
    lastTickRef.current = Date.now();
    setTimers((prev) =>
      prev.map((timer) =>
        timer.isSelected && timer.remainingMs > 0
          ? { ...timer, isRunning: true }
          : timer,
      ),
    );
  };

  const startAll = () => {
    lastTickRef.current = Date.now();
    setTimers((prev) =>
      prev.map((timer) =>
        timer.remainingMs > 0 ? { ...timer, isRunning: true } : timer,
      ),
    );
  };

  const pauseSelected = () => {
    setTimers((prev) =>
      prev.map((timer) =>
        timer.isSelected ? { ...timer, isRunning: false } : timer,
      ),
    );
  };

  const pauseAll = () => {
    setTimers((prev) => prev.map((timer) => ({ ...timer, isRunning: false })));
  };

  const resetSelected = () => {
    setTimers((prev) =>
      prev.map((timer) =>
        timer.isSelected
          ? {
              ...timer,
              remainingMs: timer.durationMs,
              isRunning: false,
            }
          : timer,
      ),
    );
  };

  const hasSelection = timers.some((t) => t.isSelected);

  return (
    <div className="page">
      <header className="panel header-panel">
        <div className="header-top">
          <h1>{t.title}</h1>
          <label className="language-switch" htmlFor="language">
            <span>{t.language}</span>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
        </div>
        <p className="subtitle">{t.subtitle}</p>
      </header>

      <section className="panel form-panel">
        <div className="field">
          <label htmlFor="name">{t.nameLabel}</label>
          <input
            id="name"
            type="text"
            placeholder={t.namePlaceholder}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="duration">{t.durationLabel}</label>
          <input
            id="duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </div>
        <button className="primary" onClick={addTimer}>
          {t.addEntry}
        </button>
      </section>

      <section className="panel controls">
        <div className="controls-group">
          <button onClick={startSelected} disabled={!hasSelection}>
            {t.startSelected}
          </button>
          <button onClick={pauseSelected} disabled={!hasSelection}>
            {t.pauseSelected}
          </button>
          <button onClick={resetSelected} disabled={!hasSelection}>
            {t.resetSelected}
          </button>
          <button onClick={removeSelected} disabled={!hasSelection}>
            {t.removeSelected}
          </button>
        </div>
        <div className="controls-group">
          <button onClick={startAll} disabled={timers.length === 0}>
            {t.startAll}
          </button>
          <button onClick={pauseAll} disabled={timers.length === 0}>
            {t.pauseAll}
          </button>
        </div>
      </section>

      <section className="panel list">
        {timers.length === 0 ? (
          <p className="muted">{t.noTimers}</p>
        ) : (
          timers.map((timer) => (
            <article key={timer.id} className="card">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={timer.isSelected}
                  onChange={() => toggleSelect(timer.id)}
                />
                <span>{t.select}</span>
              </label>
              <div className="card-body">
                <div className="card-header">
                  <h3>{timer.name}</h3>
                  <span
                    className={`pill ${
                      timer.isRunning ? "pill-running" : "pill-paused"
                    }`}
                  >
                    {timer.isRunning ? t.statusRunning : t.statusPaused}
                  </span>
                </div>
                <div className="time">{formatTime(timer.remainingMs)}</div>
                <div className="card-actions">
                  <button
                    onClick={() =>
                      setTimers((prev) =>
                        prev.map((t) =>
                          t.id === timer.id
                            ? { ...t, isRunning: !t.isRunning }
                            : t,
                        ),
                      )
                    }
                    disabled={timer.remainingMs <= 0}
                  >
                    {timer.isRunning ? t.pause : t.start}
                  </button>
                  <button onClick={() => removeTimer(timer.id)}>
                    {t.remove}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default App;

