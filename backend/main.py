from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, Session, SQLModel, create_engine, select
from pydantic import ConfigDict


DATABASE_URL = "sqlite:///./timers.db"


class Timer(SQLModel, table=True):
  id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
  name: str
  duration_ms: int
  remaining_ms: int
  is_running: bool = False
  last_started_at: Optional[datetime] = None
  created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
  updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TimerCreate(SQLModel):
  name: str
  duration_ms: int


class TimerOut(SQLModel):
  model_config = ConfigDict(from_attributes=True)

  id: str
  name: str
  duration_ms: int
  remaining_ms: int
  is_running: bool


class ActionRequest(SQLModel):
  action: Literal["start", "pause", "reset", "delete"]
  ids: Optional[List[str]] = None


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
  SQLModel.metadata.create_all(engine)


def now_utc() -> datetime:
  return datetime.now(timezone.utc)


def refresh_timer_state(timer: Timer, *, stamp: datetime) -> None:
  """Update timer.remaining_ms based on elapsed time if running."""
  if timer.is_running and timer.last_started_at:
    elapsed_ms = int((stamp - timer.last_started_at).total_seconds() * 1000)
    if elapsed_ms > 0:
      timer.remaining_ms = max(0, timer.remaining_ms - elapsed_ms)
      if timer.remaining_ms == 0:
        timer.is_running = False
        timer.last_started_at = None
      else:
        timer.last_started_at = stamp
      timer.updated_at = stamp


def get_timers(session: Session, ids: Optional[List[str]]) -> List[Timer]:
  query = select(Timer)
  if ids:
    query = query.where(Timer.id.in_(ids))
  timers = session.exec(query).all()
  if ids and len(timers) != len(ids):
    raise HTTPException(status_code=404, detail="One or more timers not found")
  return timers


app = FastAPI(title="Break Timer API")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
  init_db()


@app.get("/timers", response_model=List[TimerOut])
def list_timers() -> List[Timer]:
  stamp = now_utc()
  with Session(engine) as session:
    timers = session.exec(select(Timer).order_by(Timer.created_at)).all()
    for timer in timers:
      refresh_timer_state(timer, stamp=stamp)
    session.commit()
    for timer in timers:
      session.refresh(timer)
    return timers


@app.post("/timers", response_model=TimerOut, status_code=201)
def create_timer(payload: TimerCreate) -> Timer:
  stamp = now_utc()
  timer = Timer(
    name=payload.name,
    duration_ms=payload.duration_ms,
    remaining_ms=payload.duration_ms,
    is_running=False,
    last_started_at=None,
    created_at=stamp,
    updated_at=stamp,
  )
  with Session(engine) as session:
    session.add(timer)
    session.commit()
    session.refresh(timer)
    return timer


@app.post("/timers/actions", response_model=List[TimerOut])
def timer_actions(request: ActionRequest) -> List[Timer]:
  stamp = now_utc()
  with Session(engine) as session:
    timers = get_timers(session, request.ids)
    if request.action == "delete":
      for timer in timers:
        session.delete(timer)
      session.commit()
      return []

    for timer in timers:
      refresh_timer_state(timer, stamp=stamp)
      if request.action == "start":
        if timer.remaining_ms > 0:
          timer.is_running = True
          timer.last_started_at = stamp
      elif request.action == "pause":
        timer.is_running = False
        timer.last_started_at = None
      elif request.action == "reset":
        timer.remaining_ms = timer.duration_ms
        timer.is_running = False
        timer.last_started_at = None
      timer.updated_at = stamp

    session.commit()
    for timer in timers:
      session.refresh(timer)
    return timers


@app.delete("/timers/{timer_id}", status_code=204)
def delete_timer(timer_id: str) -> None:
  with Session(engine) as session:
    timer = session.get(Timer, timer_id)
    if not timer:
      raise HTTPException(status_code=404, detail="Timer not found")
    session.delete(timer)
    session.commit()

