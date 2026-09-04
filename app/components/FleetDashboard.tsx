"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTrend, createLiveEvents, eventsBySecond, fleetAtTime, fleetMetrics, formatTime,
  ingestEvents, needsAttention, parseEventLog, statusLabel,
  type FleetState, type Robot, type RobotEvent, type RobotState, type TrendPoint,
} from "../lib/fleet";

type Mode = "replay" | "live";
type Filter = "all" | "attention" | "picker" | "hauler";

const STATUS_COLORS: Record<string, string> = {
  idle: "#94a3b8", active: "#2dd4bf", on_mission: "#38bdf8", charging: "#a3e635",
  blocked: "#f59e0b", error: "#fb7185", maintenance: "#c084fc", offline: "#64748b",
};

function TrendChart({ data, currentTime, live }: { data: TrendPoint[]; currentTime: number; live: boolean }) {
  const visible = live ? data : data.filter((point) => point.t <= currentTime);
  const chart = visible.length ? visible : data.slice(0, 1);
  const width = 620;
  const height = 150;
  const pathFor = (key: "working" | "attention") => chart.map((point, index) => {
    const x = chart.length === 1 ? 0 : (index / (chart.length - 1)) * width;
    const y = height - (point[key] / 100) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fleet working and attention rates over time">
        {[0, 50, 100].map((value) => <g key={value}>
          <line x1="0" x2={width} y1={height - value * 1.5} y2={height - value * 1.5} className="chart-grid" />
          <text x="4" y={height - value * 1.5 - 5}>{value}%</text>
        </g>)}
        <path d={pathFor("working")} className="chart-line working" />
        <path d={pathFor("attention")} className="chart-line attention" />
      </svg>
      <div className="chart-legend"><span><i className="legend-working" />Working</span><span><i className="legend-attention" />Needs attention</span></div>
    </div>
  );
}

function MapMarker({ robot, selected, dimmed, onSelect }: { robot: RobotState; selected: boolean; dimmed: boolean; onSelect: () => void }) {
  return (
    <button
      className={`robot-marker ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}
      style={{ left: `${robot.x / 9}%`, top: `${robot.y / 5.6}%`, "--status": STATUS_COLORS[robot.status] } as React.CSSProperties}
      onClick={onSelect}
      aria-label={`${robot.robot_id}, ${statusLabel(robot.status)}, ${Math.round(robot.battery)} percent battery`}
    >
      <span className="robot-dot">{robot.robot_id.slice(1)}</span>
      <span className="robot-label">{robot.robot_id}</span>
    </button>
  );
}

export function FleetDashboard() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [events, setEvents] = useState<RobotEvent[]>([]);
  const [fleet, setFleet] = useState<FleetState>({});
  const [mode, setMode] = useState<Mode>("replay");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(8);
  const [selectedId, setSelectedId] = useState("r1");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const liveTick = useRef(0);

  useEffect(() => {
    Promise.all([
      fetch("/data/robots.json").then((response) => {
        if (!response.ok) throw new Error("Could not load robot roster");
        return response.json() as Promise<Robot[]>;
      }),
      fetch("/data/events.jsonl").then((response) => {
        if (!response.ok) throw new Error("Could not load event log");
        return response.text();
      }),
    ]).then(([roster, log]) => {
      const parsed = parseEventLog(log);
      setRobots(roster);
      setEvents(parsed);
      setFleet(fleetAtTime(roster, parsed, 0));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  const timeline = useMemo(() => eventsBySecond(events), [events]);
  const replayTrend = useMemo(() => buildTrend(robots, events), [robots, events]);
  const [liveTrend, setLiveTrend] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (!playing || !events.length) return;
    const interval = window.setInterval(() => {
      if (mode === "replay") {
        setTime((current) => {
          const next = Math.min(900, current + speed);
          setFleet(fleetAtTime(robots, events, next));
          if (next === 900) setPlaying(false);
          return next;
        });
      } else {
        liveTick.current += 1;
        setFleet((current) => {
          const next = ingestEvents(current, createLiveEvents(current, liveTick.current));
          if (liveTick.current % 3 === 0) {
            const metrics = fleetMetrics(next);
            setLiveTrend((points) => [...points.slice(-29), {
              t: next[Object.keys(next)[0]]?.t ?? 0,
              working: metrics.total ? metrics.working / metrics.total * 100 : 0,
              attention: metrics.total ? metrics.attention / metrics.total * 100 : 0,
            }]);
          }
          return next;
        });
      }
    }, mode === "replay" ? 1000 : 650);
    return () => window.clearInterval(interval);
  }, [playing, mode, speed, events, robots, timeline]);

  const switchMode = (nextMode: Mode) => {
    setPlaying(false);
    setMode(nextMode);
    if (nextMode === "replay") {
      setTime(0);
      setFleet(fleetAtTime(robots, events, 0));
    } else {
      setFleet(fleetAtTime(robots, events, 900));
      setLiveTrend([]);
      liveTick.current = 0;
    }
  };

  const seek = (next: number) => {
    setTime(next);
    setFleet(fleetAtTime(robots, events, next));
  };

  const fleetList = Object.values(fleet);
  const metrics = fleetMetrics(fleet);
  const selected = fleet[selectedId];
  const filtered = fleetList.filter((robot) => {
    const matchesQuery = robot.robot_id.includes(query.toLowerCase()) || robot.robot_type.includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "attention" ? needsAttention(robot) : robot.robot_type === filter);
    return matchesQuery && matchesFilter;
  });

  if (error) return <main className="center-state"><p className="eyebrow">Data unavailable</p><h1>We couldn&apos;t start the fleet console.</h1><p>{error}</p></main>;
  if (!robots.length) return <main className="center-state"><div className="loader" /><p>Preparing fleet telemetry…</p></main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><div><strong>Fleet Operations</strong><small>Peppermint Robotics · Pune Site 01</small></div></div>
        <div className="header-status"><span className="pulse" /><span>Telemetry connected</span><span className="header-time">Updated {mode === "live" ? "now" : `at ${formatTime(time)}`}</span></div>
      </header>

      <section className="control-strip">
        <div className="mode-switch" aria-label="Data source">
          <button className={mode === "replay" ? "active" : ""} onClick={() => switchMode("replay")}>Recorded replay</button>
          <button className={mode === "live" ? "active" : ""} onClick={() => switchMode("live")}><span className="live-dot" />Live simulation</button>
        </div>
        <div className="playback">
          <button className="play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
          {mode === "replay" ? <>
            <span className="mono time-readout">{formatTime(time)}</span>
            <input aria-label="Replay time" type="range" min="0" max="900" step="5" value={time} onChange={(event) => seek(Number(event.target.value))} />
            <span className="mono muted">15:00</span>
            <select aria-label="Replay speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {[1, 4, 8, 16, 32].map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </> : <><span className="live-label">Generating updates every 650 ms</span><span className="mono muted">T+{liveTick.current * 2}s</span></>}
        </div>
      </section>

      <section className="metrics-grid" aria-label="Fleet overview">
        <article className="metric"><span>Fleet online</span><strong>{fleetList.filter((robot) => robot.status !== "offline").length}<small> / {metrics.total}</small></strong><em className="good">● Live</em></article>
        <article className="metric"><span>Working now</span><strong>{metrics.working}<small> robots</small></strong><em>{Math.round(metrics.working / metrics.total * 100)}% utilization</em></article>
        <article className="metric"><span>Need attention</span><strong className={metrics.attention ? "warning-text" : ""}>{metrics.attention}<small> robots</small></strong><em>{metrics.attention ? "Review recommended" : "All clear"}</em></article>
        <article className="metric"><span>Average battery</span><strong>{Math.round(metrics.averageBattery)}<small>%</small></strong><div className="battery-bar"><i style={{ width: `${metrics.averageBattery}%` }} /></div></article>
      </section>

      <section className="workspace-grid">
        <article className="panel map-panel">
          <div className="panel-heading"><div><p className="eyebrow">Site overview</p><h1>Live floor map</h1></div><div className="map-key"><span><i className="key-working" />Working</span><span><i className="key-idle" />Idle</span><span><i className="key-alert" />Attention</span></div></div>
          <div className="site-map">
            <img src="/data/layout.png" alt="Pune Site 01 floor layout" />
            {fleetList.map((robot) => <MapMarker key={robot.robot_id} robot={robot} selected={selectedId === robot.robot_id} dimmed={!filtered.some((item) => item.robot_id === robot.robot_id)} onSelect={() => setSelectedId(robot.robot_id)} />)}
            <div className="map-scale">900 × 560 units</div>
          </div>
        </article>

        <aside className="panel roster-panel">
          <div className="panel-heading"><div><p className="eyebrow">Robot directory</p><h2>Fleet roster</h2></div><span className="count-badge">{filtered.length}</span></div>
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find robot or type…" /></label>
          <div className="filter-row">
            {(["all", "attention", "picker", "hauler"] as Filter[]).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "attention" ? "Attention" : `${value}s`}</button>)}
          </div>
          <div className="robot-list">
            {filtered.map((robot) => <button key={robot.robot_id} className={`robot-row ${selectedId === robot.robot_id ? "selected" : ""}`} onClick={() => setSelectedId(robot.robot_id)}>
              <i className="status-ring" style={{ "--status": STATUS_COLORS[robot.status] } as React.CSSProperties}>{robot.robot_id.slice(1)}</i>
              <span><strong>{robot.robot_id.toUpperCase()}</strong><small>{robot.robot_type}</small></span>
              <span className="row-status"><strong>{statusLabel(robot.status)}</strong><small>{Math.round(robot.battery)}% battery</small></span>
            </button>)}
            {!filtered.length && <p className="empty">No robots match these filters.</p>}
          </div>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><p className="eyebrow">Observed window</p><h2>Fleet activity trend</h2></div><span className="trend-note">30-second samples</span></div>
          <TrendChart data={mode === "live" ? liveTrend : replayTrend} currentTime={time} live={mode === "live"} />
        </article>

        <article className="panel inspector-panel">
          {selected ? <>
            <div className="inspector-head"><div className="inspector-id">{selected.robot_id.slice(1)}</div><div><p className="eyebrow">Selected robot</p><h2>{selected.robot_id.toUpperCase()} · {selected.robot_type}</h2></div><span className="status-pill" style={{ "--status": STATUS_COLORS[selected.status] } as React.CSSProperties}>{statusLabel(selected.status)}</span></div>
            <div className="detail-grid"><div><span>Battery</span><strong>{selected.battery.toFixed(1)}%</strong></div><div><span>Position</span><strong>{selected.x.toFixed(1)}, {selected.y.toFixed(1)}</strong></div><div><span>Last report</span><strong>{mode === "live" ? "Just now" : formatTime(selected.t)}</strong></div></div>
            <div className={`recommendation ${needsAttention(selected) ? "alert" : ""}`}><span>{needsAttention(selected) ? "!" : "✓"}</span><p><strong>{needsAttention(selected) ? "Operator review needed" : "No action needed"}</strong><small>{needsAttention(selected) ? "Check status and battery before dispatching." : "Robot is reporting normally within expected thresholds."}</small></p></div>
          </> : <p className="empty">Select a robot to inspect it.</p>}
        </article>
      </section>
    </main>
  );
}
