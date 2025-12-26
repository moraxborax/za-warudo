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
  const lastTickRef = useRef(Date.now());
  const [hydrated, setHydrated] = useState(false);

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
      <header className="panel">
        <h1>Break Timer</h1>
        <p className="subtitle">
          Manage multiple countdowns for quiz or event breaks.
        </p>
      </header>

      <section className="panel form-panel">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            placeholder="Person or team"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="duration">Duration (minutes)</label>
          <input
            id="duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </div>
        <button className="primary" onClick={addTimer}>
          Add entry
        </button>
      </section>

      <section className="panel controls">
        <div className="controls-group">
          <button onClick={startSelected} disabled={!hasSelection}>
            Start selected
          </button>
          <button onClick={pauseSelected} disabled={!hasSelection}>
            Pause selected
          </button>
          <button onClick={resetSelected} disabled={!hasSelection}>
            Reset selected
          </button>
          <button onClick={removeSelected} disabled={!hasSelection}>
            Remove selected
          </button>
        </div>
        <div className="controls-group">
          <button onClick={startAll} disabled={timers.length === 0}>
            Start all
          </button>
          <button onClick={pauseAll} disabled={timers.length === 0}>
            Pause all
          </button>
        </div>
      </section>

      <section className="panel list">
        {timers.length === 0 ? (
          <p className="muted">No timers yet. Add a person to get started.</p>
        ) : (
          timers.map((timer) => (
            <article key={timer.id} className="card">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={timer.isSelected}
                  onChange={() => toggleSelect(timer.id)}
                />
                <span>Select</span>
              </label>
              <div className="card-body">
                <div className="card-header">
                  <h3>{timer.name}</h3>
                  <span
                    className={`pill ${
                      timer.isRunning ? "pill-running" : "pill-paused"
                    }`}
                  >
                    {timer.isRunning ? "Running" : "Paused"}
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
                    {timer.isRunning ? "Pause" : "Start"}
                  </button>
                  <button onClick={() => removeTimer(timer.id)}>Remove</button>
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

