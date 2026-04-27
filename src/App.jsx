import { useState, useEffect } from "react";

const WEIGHTS = {
  combined: { max: 35, tiers: [{ min: 6, pts: 35 }, { min: 5, pts: 28 }, { min: 4, pts: 20 }, { min: 0, pts: 0, dq: true }] },
  blast:    { max: 10, tiers: [{ min: 75, pts: 10 }, { min: 50, pts: 6 }, { min: 0, pts: 3 }] },
  air:      { max: 20, tiers: [{ min: 75, pts: 20 }, { min: 60, pts: 15 }, { min: 45, pts: 8 }, { min: 0, pts: 0 }] },
  pullAir:  { max: 15 },
  hardHit:  { max: 20, tiers: [{ min: 65, pts: 20 }, { min: 50, pts: 14 }, { min: 0, pts: 5 }] },
};

function scoreMetric(key, value) {
  if (key === "combined") {
    const tier = WEIGHTS.combined.tiers.find(t => value >= t.min);
    return { pts: tier?.pts ?? 0, dq: tier?.dq ?? false };
  }
  if (key === "pullAir") {
    if (value >= 25 && value <= 35) return { pts: 15, dq: false };
    if (value >= 20 && value <= 40) return { pts: 10, dq: false };
    if (value > 0) return { pts: 5, dq: false };
    return { pts: 3, dq: false };
  }
  const cfg = WEIGHTS[key];
  const tier = cfg.tiers.find(t => value >= t.min);
  return { pts: tier?.pts ?? 0, dq: false };
}

function getGrade(score, dq) {
  if (dq)          return { label: "DQ",    color: "#ff3b3b", bg: "#2a0a0a" };
  if (score >= 85) return { label: "ELITE", color: "#00ff88", bg: "#001a0f" };
  if (score >= 75) return { label: "PLAY",  color: "#00d4ff", bg: "#001a22" };
  if (score >= 65) return { label: "WATCH", color: "#ffaa00", bg: "#1a1000" };
  return             { label: "SKIP",  color: "#888",    bg: "#111"    };
}

const defaultForm = { name: "", combined: "", blast: "", air: "", pullAir: "", hardHit: "", hrL10: "", stage2: false, due: false };

export default function App() {
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("scorer"); // "scorer" | "history"
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ltt-history") || "[]"); } catch { return []; }
  });
  const [slateDate, setSlateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slateNote, setSlateNote] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [slateResults, setSlateResults] = useState({});
  const [editingSlate, setEditingSlate] = useState(null); // slate id being edited
  const [expandedBatter, setExpandedBatter] = useState(null);

  function handleChange(e) {
    const { name, type, value, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  function addPlayer() {
    if (!form.name.trim()) return;
    const hrL10raw = parseFloat(form.hrL10) || 0;
    const vals = {
      combined: parseFloat(form.combined) || 0,
      blast:    parseFloat(form.blast)    || 0,
      air:      parseFloat(form.air)      || 0,
      pullAir:  parseFloat(form.pullAir)  || 0,
      hardHit:  parseFloat(form.hardHit)  || 0,
    };
    let total = 0, dq = false;
    const breakdown = {};
    for (const [key, val] of Object.entries(vals)) {
      const result = scoreMetric(key, val);
      breakdown[key] = result.pts;
      total += result.pts;
      if (result.dq) dq = true;
    }
    const finalTotal = dq ? 0 : total;
    const stage2pass = form.stage2;
    const pathA = finalTotal >= 75 && stage2pass;
    const pathB = finalTotal >= 65 && finalTotal < 75 && stage2pass && vals.combined >= 5;
    const pathC = vals.hardHit >= 70 && vals.combined >= 7 && stage2pass;
    const pathD = breakdown.combined === 35 && finalTotal >= 65;
    const qualifies   = pathA || pathB || pathC || pathD;
    const qualifyPath = pathA ? "A" : pathB ? "B" : pathC ? "C" : pathD ? "D" : null;
    const powerOverload = hrL10raw >= 5;
    const peakMode     = hrL10raw >= 4 && vals.combined >= 6;
    const primed       = hrL10raw >= 2 && hrL10raw <= 3 && vals.combined >= 7;
    const loading      = hrL10raw <= 1 && vals.combined >= 7;
    const powerStatus  = powerOverload ? "POWER OVERLOAD" : peakMode ? "PEAK MODE" : primed ? "PRIMED" : loading ? "LOADING" : null;
    setPlayers(p => [...p, { ...form, total: finalTotal, dq, breakdown, stage2pass, vals, qualifies, qualifyPath, hrL10: hrL10raw, powerStatus, due: form.due }]);
    setForm(defaultForm);
    setShowForm(false);
  }

  function saveSlate(results) {
    const plays = sorted.filter(p => p.qualifies);
    const slate = {
      id: Date.now(),
      date: slateDate,
      note: slateNote,
      players: sorted.map(p => ({
        name: p.name,
        total: p.total,
        qualifyPath: p.qualifyPath,
        powerStatus: p.powerStatus,
        qualifies: p.qualifies,
        hrL10: p.hrL10,
        dq: p.dq,
      })),
      results, // array of { name, homered: bool }
      plays: plays.map(p => p.name),
    };
    const updated = [slate, ...history];
    setHistory(updated);
    localStorage.setItem("ltt-history", JSON.stringify(updated));
    setShowSaveModal(false);
    setSlateNote("");
    setPlayers([]);
  }

  function deleteSlate(id) {
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    localStorage.setItem("ltt-history", JSON.stringify(updated));
  }

  function updateSlateResults(slateId, updatedResults, updatedNote) {
    const updated = history.map(s => s.id === slateId ? { ...s, results: updatedResults, note: updatedNote } : s);
    setHistory(updated);
    localStorage.setItem("ltt-history", JSON.stringify(updated));
    setEditingSlate(null);
  }

  function removePlayer(idx) {
    setPlayers(p => p.filter((_, i) => i !== idx));
  }

  function composite(p) {
    let c = 0;
    if (p.vals?.pullAir >= 25 && p.vals?.pullAir <= 35) c += 3;
    if (p.vals?.hardHit >= 65) c += 3;
    if (p.vals?.air >= 75) c += 2;
    if (p.vals?.blast >= 75) c += 2;
    return c;
  }

  const sorted = [...players].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return composite(b) - composite(a);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e8e8", fontFamily: "'Courier New', monospace", padding: "24px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        .title { font-family: 'Bebas Neue', sans-serif; font-size: 42px; letter-spacing: 4px; background: linear-gradient(135deg, #00ff88, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; line-height: 1; }
        .sub { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #444; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
        .btn { background: #00ff88; color: #000; border: none; padding: 10px 20px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; cursor: pointer; border-radius: 2px; transition: all 0.15s; }
        .btn:hover { background: #00d4ff; transform: translateY(-1px); }
        .btn-danger { background: transparent; color: #ff3b3b; border: 1px solid #ff3b3b; padding: 4px 10px; font-size: 11px; cursor: pointer; border-radius: 2px; font-family: 'IBM Plex Mono', monospace; }
        .btn-danger:hover { background: #ff3b3b; color: #000; }
        .card { background: #0f0f0f; border: 1px solid #1a1a1a; border-radius: 4px; padding: 16px; margin-bottom: 12px; position: relative; transition: border-color 0.2s; }
        .card:hover { border-color: #2a2a2a; }
        .input { background: #111; border: 1px solid #222; color: #e8e8e8; padding: 8px 12px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; border-radius: 2px; width: 100%; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: #00ff88; }
        .label { font-size: 10px; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .bar-bg { background: #1a1a1a; border-radius: 2px; height: 4px; margin-top: 4px; }
        .bar-fill { height: 4px; border-radius: 2px; transition: width 0.4s ease; }
        .score-ring { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; border: 2px solid; flex-shrink: 0; }
        .divider { border: none; border-top: 1px solid #1a1a1a; margin: 16px 0; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 2px; font-size: 10px; letter-spacing: 2px; font-weight: 600; }
        .stage2-badge { padding: 3px 8px; border-radius: 2px; font-size: 10px; letter-spacing: 1px; font-family: 'IBM Plex Mono', monospace; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .checkbox-row input { width: auto; accent-color: #00ff88; }
        .empty { text-align: center; padding: 60px 20px; color: #333; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; }
        .metric-pts { font-family: 'Bebas Neue', sans-serif; font-size: 16px; }
      `}</style>

      {/* Nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setView("scorer")} style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, padding: "6px 16px", borderRadius: 2, border: "none", cursor: "pointer", background: view === "scorer" ? "#00ff88" : "#1a1a1a", color: view === "scorer" ? "#000" : "#555" }}>SCORER</button>
        <button onClick={() => setView("history")} style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, padding: "6px 16px", borderRadius: 2, border: "none", cursor: "pointer", background: view === "history" ? "#00ff88" : "#1a1a1a", color: view === "history" ? "#000" : "#555" }}>
          HISTORY {history.length > 0 && <span style={{ fontSize: 12 }}>({history.length})</span>}
        </button>
        <button onClick={() => setView("trending")} style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, padding: "6px 16px", borderRadius: 2, border: "none", cursor: "pointer", background: view === "trending" ? "#00ff88" : "#1a1a1a", color: view === "trending" ? "#000" : "#555" }}>
          TRENDING
        </button>
        <button onClick={() => setView("results")} style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, padding: "6px 16px", borderRadius: 2, border: "none", cursor: "pointer", background: view === "results" ? "#00ff88" : "#1a1a1a", color: view === "results" ? "#000" : "#555" }}>
          RESULTS
        </button>
        <button onClick={() => setView("leaderboard")} style={{ fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2, padding: "6px 16px", borderRadius: 2, border: "none", cursor: "pointer", background: view === "leaderboard" ? "#00ff88" : "#1a1a1a", color: view === "leaderboard" ? "#000" : "#555" }}>
          LEADERS
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p className="title">LOAD THE TRUCK</p>
        <p className="sub">HR Prop Scoring System — v2.0</p>
      </div>

      {/* Stage Legend */}
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 16px", marginBottom: 20, fontSize: 11, color: "#444", lineHeight: 1.8 }}>
        <span style={{ color: "#00ff88", fontWeight: 600 }}>STAGE 1</span> — Blast Report Score 75+ (unfiltered L7 combined events) &nbsp;|&nbsp;
        <span style={{ color: "#00d4ff", fontWeight: 600 }}>STAGE 2</span> — 1+ Propfinder contact in L7 with 350ft+ & 20°+ LA
      </div>

      {/* Add Player */}
      {!showForm ? (
        <button className="btn" onClick={() => setShowForm(true)} style={{ marginBottom: 20, width: "100%" }}>
          + ADD PLAYER
        </button>
      ) : (
        <div className="card" style={{ borderColor: "#00ff8833", marginBottom: 20 }}>
          <p style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 2, color: "#00ff88", margin: "0 0 16px" }}>NEW PLAYER</p>

          <div style={{ marginBottom: 12 }}>
            <label className="label">Player Name</label>
            <input className="input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Nick Kurtz" />
          </div>

          <p style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", margin: "16px 0 8px" }}>— Stage 1: Blast Report —</p>

          <div className="grid2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Combined 100EV / 350ft Events</label>
              <input className="input" name="combined" type="number" value={form.combined} onChange={handleChange} placeholder="e.g. 5" />
            </div>
            <div>
              <label className="label">Blast %</label>
              <input className="input" name="blast" type="number" value={form.blast} onChange={handleChange} placeholder="e.g. 80" />
            </div>
          </div>

          <div className="grid3" style={{ marginBottom: 16 }}>
            <div>
              <label className="label">Air %</label>
              <input className="input" name="air" type="number" value={form.air} onChange={handleChange} placeholder="e.g. 65" />
            </div>
            <div>
              <label className="label">Pull Air %</label>
              <input className="input" name="pullAir" type="number" value={form.pullAir} onChange={handleChange} placeholder="e.g. 28" />
            </div>
            <div>
              <label className="label">Hard Hit %</label>
              <input className="input" name="hardHit" type="number" value={form.hardHit} onChange={handleChange} placeholder="e.g. 55" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">HRs in Last 10 Games</label>
            <input className="input" name="hrL10" type="number" value={form.hrL10} onChange={handleChange} placeholder="e.g. 2" />
          </div>

          <p style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", margin: "16px 0 8px" }}>— Stage 2: Propfinder Statcast —</p>

          <div className="checkbox-row" style={{ marginBottom: 16 }}>
            <input type="checkbox" name="stage2" checked={form.stage2} onChange={handleChange} id="s2" />
            <label htmlFor="s2" style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>1+ contact in L7 with 350ft+ AND 20°+ launch angle on Propfinder</label>
          </div>

          <div className="checkbox-row" style={{ marginBottom: 16 }}>
            <input type="checkbox" name="due" checked={form.due} onChange={handleChange} id="due" />
            <label htmlFor="due" style={{ fontSize: 12, color: "#ffaa00", cursor: "pointer" }}>🎯 Flag as DUE — elite profile, temporarily suppressed</label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={addPlayer} style={{ flex: 1 }}>SCORE PLAYER</button>
            <button className="btn-danger" onClick={() => setShowForm(false)} style={{ padding: "10px 16px" }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Player Cards */}
      {players.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⚾</div>
          <p style={{ fontSize: 12, letterSpacing: 2 }}>NO PLAYERS SCORED YET</p>
          <p style={{ fontSize: 11, color: "#222", marginTop: 8 }}>Add players from today's slate to get started</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 10, color: "#333", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
            {sorted.length} player{sorted.length !== 1 ? "s" : ""} — sorted by score
          </p>
          {sorted.map((p, i) => {
            const grade = getGrade(p.total, p.dq);
            const pct = p.total;
            const originalIdx = players.indexOf(p);
            return (
              <div key={i} className="card" style={{ borderColor: p.dq ? "#2a0a0a" : p.total >= 75 ? grade.color + "22" : "#1a1a1a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div className="score-ring" style={{ borderColor: grade.color, background: grade.bg }}>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: grade.color, lineHeight: 1 }}>{p.dq ? "DQ" : p.total}</span>
                    <span style={{ fontSize: 9, color: grade.color, opacity: 0.6, letterSpacing: 1 }}>/100</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: 24, letterSpacing: 2, margin: 0, color: "#fff" }}>{p.name}</p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                      <span className="tag" style={{ background: grade.bg, color: grade.color, border: `1px solid ${grade.color}44` }}>{grade.label}</span>
                      {!p.dq && (
                        <span className="stage2-badge" style={{
                          background: p.stage2pass ? "#001a0f" : "#1a0a00",
                          color: p.stage2pass ? "#00ff88" : "#ff6600",
                          border: `1px solid ${p.stage2pass ? "#00ff8844" : "#ff660044"}`
                        }}>
                          S2: {p.stage2pass ? "✓ CONFIRMED" : "✗ FAILS"}
                        </span>
                      )}
                      {p.qualifies && (
                        <span className="stage2-badge" style={{
                          background: p.qualifyPath === "D" ? "#1a0800" : "#0a001a",
                          color: p.qualifyPath === "D" ? "#ff9900" : "#cc88ff",
                          border: `1px solid ${p.qualifyPath === "D" ? "#ff990044" : "#cc88ff44"}`
                        }}>
                          PATH {p.qualifyPath}
                        </span>
                      )}
                      {!p.dq && sorted.filter(x => x.total === p.total).length > 1 && (
                        <span className="stage2-badge" style={{ background: "#111", color: "#555", border: "1px solid #2a2a2a" }}>
                          TIE · CPX {composite(p)}
                        </span>
                      )}
                      {p.powerStatus === "POWER OVERLOAD" && (
                        <span className="stage2-badge" style={{ background: "#2a0a0a", color: "#ff3b3b", border: "1px solid #ff3b3b44" }}>💀 OVERLOAD</span>
                      )}
                      {p.powerStatus === "PEAK MODE" && (
                        <span className="stage2-badge" style={{ background: "#1a0e00", color: "#ff9900", border: "1px solid #ff990044" }}>🔥 PEAK</span>
                      )}
                      {p.powerStatus === "PRIMED" && (
                        <span className="stage2-badge" style={{ background: "#0a1400", color: "#88ff44", border: "1px solid #88ff4444" }}>⚡ PRIMED</span>
                      )}
                      {p.powerStatus === "LOADING" && (
                        <span className="stage2-badge" style={{ background: "#001a22", color: "#00d4ff", border: "1px solid #00d4ff44" }}>🔄 LOADING</span>
                      )}
                      {p.due && (
                        <span className="stage2-badge" style={{ background: "#1a1400", color: "#ffaa00", border: "1px solid #ffaa0044" }}>🎯 DUE</span>
                      )}
                    </div>
                  </div>
                  <button className="btn-danger" onClick={() => removePlayer(originalIdx)}>✕</button>
                </div>

                {!p.dq && (
                  <>
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${grade.color}88, ${grade.color})` }} />
                    </div>
                    <hr className="divider" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
                      {[
                        ["Combined Events", p.vals.combined, p.breakdown.combined, 35, `${p.vals.combined} events`],
                        ["Blast %",         p.vals.blast,    p.breakdown.blast,    10, `${p.vals.blast}%`],
                        ["Air %",           p.vals.air,      p.breakdown.air,      20, `${p.vals.air}%`],
                        ["Pull Air %",      p.vals.pullAir,  p.breakdown.pullAir,  15, `${p.vals.pullAir}%`],
                        ["Hard Hit %",      p.vals.hardHit,  p.breakdown.hardHit,  20, `${p.vals.hardHit}%`],
                      ].map(([label, , pts, max, display]) => (
                        <div key={label} className="metric-row">
                          <span style={{ color: "#555" }}>{label}</span>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ color: "#888", fontSize: 11, marginRight: 6 }}>{display}</span>
                            <span className="metric-pts" style={{ color: pts === max ? "#00ff88" : pts > 0 ? "#ffaa00" : "#ff3b3b" }}>{pts}</span>
                            <span style={{ color: "#333", fontSize: 11 }}>/{max}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <hr className="divider" />
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#444", flexWrap: "wrap", alignItems: "center" }}>
                      <span>L7 350ft+ & 20°+ contact <strong style={{ color: p.stage2pass ? "#00ff88" : "#ff6600" }}>{p.stage2pass ? "YES" : "NO"}</strong></span>
                      <span style={{ color: "#333" }}>|</span>
                      <span>HR L10: <strong style={{ color: p.powerStatus === "POWER OVERLOAD" ? "#ff3b3b" : p.powerStatus === "PEAK MODE" ? "#ff9900" : p.powerStatus === "LOADING" ? "#00d4ff" : "#888" }}>{p.hrL10}</strong></span>

                    </div>
                  </>
                )}

                {p.dq && (
                  <p style={{ color: "#ff3b3b", fontSize: 11, margin: 0 }}>
                    Disqualified — Combined events below minimum threshold (4+)
                  </p>
                )}
              </div>
            );
          })}

          {/* Plays Today */}
          {sorted.filter(p => p.qualifies).length > 0 && (
            <div style={{ background: "#001a0f", border: "1px solid #00ff8833", borderRadius: 4, padding: "14px 16px", marginTop: 8 }}>
              <p style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: "#00ff88", letterSpacing: 3, margin: "0 0 8px" }}>✓ PLAYS TODAY</p>
              {sorted.filter(p => p.qualifies).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "5px 0" }}>
                  <span style={{ fontSize: 13, color: "#00ff8899" }}>
                    {p.name} — <strong style={{ color: "#00ff88" }}>{p.total}</strong>/100
                  </span>
                  <span style={{ color: p.qualifyPath === "D" ? "#ff9900" : "#cc88ff", fontSize: 10, background: p.qualifyPath === "D" ? "#1a0800" : "#0a001a", border: `1px solid ${p.qualifyPath === "D" ? "#ff990044" : "#cc88ff44"}`, padding: "1px 6px", borderRadius: 2 }}>PATH {p.qualifyPath}</span>
                  {p.powerStatus === "POWER OVERLOAD" && <span style={{ fontSize: 10, background: "#2a0a0a", color: "#ff3b3b", border: "1px solid #ff3b3b44", padding: "1px 6px", borderRadius: 2 }}>💀 OVERLOAD</span>}
                  {p.powerStatus === "PEAK MODE" && <span style={{ fontSize: 10, background: "#1a0e00", color: "#ff9900", border: "1px solid #ff990044", padding: "1px 6px", borderRadius: 2 }}>🔥 PEAK</span>}
                  {p.powerStatus === "PRIMED" && <span style={{ fontSize: 10, background: "#0a1400", color: "#88ff44", border: "1px solid #88ff4444", padding: "1px 6px", borderRadius: 2 }}>⚡ PRIMED</span>}
                  {p.powerStatus === "LOADING" && <span style={{ fontSize: 10, background: "#001a22", color: "#00d4ff", border: "1px solid #00d4ff44", padding: "1px 6px", borderRadius: 2 }}>🔄 LOADING</span>}
                  {p.due && <span style={{ fontSize: 10, background: "#1a1400", color: "#ffaa00", border: "1px solid #ffaa0044", padding: "1px 6px", borderRadius: 2 }}>🎯 DUE</span>}
                </div>
              ))}
            </div>
          )}

          {/* Power Pairing Suggestions */}
          {(() => {
            const plays = sorted.filter(p => p.qualifies);
            if (plays.length < 2) return null;

            const overloads = plays.filter(p => p.powerStatus === "POWER OVERLOAD");
            const peaks     = plays.filter(p => p.powerStatus === "PEAK MODE");
            const primeds   = plays.filter(p => p.powerStatus === "PRIMED");
            const loadings  = plays.filter(p => p.powerStatus === "LOADING");

            const suggestions = [];

            // Loading + Primed pairings
            loadings.forEach(l => {
              primeds.forEach(pr => {
                suggestions.push({
                  type: "MOMENTUM PARLAY",
                  color: "#00d4ff",
                  bg: "#001a22",
                  border: "#00d4ff33",
                  emoji: "🔄⚡",
                  players: [l, pr],
                  note: "Both building — contact quality is there, conversion is coming."
                });
              });
            });

            // Peak + Primed pairings
            peaks.forEach(pk => {
              primeds.forEach(pr => {
                suggestions.push({
                  type: "HOT + HEATING",
                  color: "#ff9900",
                  bg: "#1a0e00",
                  border: "#ff990033",
                  emoji: "🔥⚡",
                  players: [pk, pr],
                  note: "Peak could sustain or cool — Primed provides the upside hedge."
                });
              });
            });

            // Primed + Primed pairings
            for (let i = 0; i < primeds.length; i++) {
              for (let j = i + 1; j < primeds.length; j++) {
                suggestions.push({
                  type: "DOUBLE PRIMED",
                  color: "#88ff44",
                  bg: "#0a1400",
                  border: "#88ff4433",
                  emoji: "⚡⚡",
                  players: [primeds[i], primeds[j]],
                  note: "Two players building simultaneously — high upside parlay with contact quality behind both."
                });
              }
            }

            // Overload warnings
            overloads.forEach(o => {
              suggestions.push({
                type: "REGRESSION RISK",
                color: "#ff3b3b",
                bg: "#2a0a0a",
                border: "#ff3b3b33",
                emoji: "💀",
                players: [o],
                note: `${o.name} is in unsustainable territory. Straight bet only — avoid parlaying.`
              });
            });

            // DUE player callouts
            const duePlayers = plays.filter(p => p.due);
            duePlayers.forEach(d => {
              suggestions.push({
                type: "DUE — WATCH THIS",
                color: "#ffaa00",
                bg: "#1a1400",
                border: "#ffaa0033",
                emoji: "🎯",
                players: [d],
                note: `${d.name} flagged as due — elite profile temporarily suppressed. Score doesn't reflect true upside.`
              });
            });

            // Peak-only warning if no primed to pair with
            if (peaks.length > 0 && primeds.length === 0) {
              peaks.forEach(pk => {
                suggestions.push({
                  type: "PEAK WATCH",
                  color: "#ff9900",
                  bg: "#1a0e00",
                  border: "#ff990033",
                  emoji: "🔥",
                  players: [pk],
                  note: `${pk.name} is running hot — could keep going or stall. No Primed pair available to hedge.`
                });
              });
            }

            if (suggestions.length === 0) return null;

            return (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, padding: "14px 16px", marginTop: 10 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: "#888", letterSpacing: 3, margin: "0 0 12px" }}>🧠 POWER PAIRING SUGGESTIONS</p>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 3, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: s.color, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{s.emoji} {s.type}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      {s.players.map((pl, j) => (
                        <span key={j} style={{ fontSize: 13, color: "#fff" }}>
                          {pl.name} <span style={{ color: s.color, fontFamily: "'Bebas Neue'", fontSize: 15 }}>{pl.total}</span>
                          {j < s.players.length - 1 && <span style={{ color: "#333", marginLeft: 8 }}>+</span>}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "#555", margin: 0, lineHeight: 1.5 }}>{s.note}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Pairing Engine */}
          {(() => {
            const plays = sorted.filter(p => p.qualifies);
            if (plays.length === 0) return null;

            const top = plays[0];
            const isStraightBet = top.total >= 90;
            const withoutTop = plays.slice(1);
            const p2score = withoutTop[0]?.total;
            const p3score = withoutTop[1]?.total;
            const p4score = withoutTop[2]?.total;

            // 2-man: #2 + #3, expand if tied
            const parlay2 = withoutTop.filter((p, i) => {
              if (i < 2) return true;
              if (p.total === p2score) return true;
              if (p.total === p3score && p3score !== undefined) return true;
              return false;
            }).slice(0, 4);

            // 3-man: #2 + #3 + #4, expand if tied
            const parlay3 = withoutTop.filter((p, i) => {
              if (i < 3) return true;
              if (p.total === p4score && p4score !== undefined) return true;
              return false;
            }).slice(0, 5);

            return (
              <div style={{ background: "#0a0a14", border: "1px solid #ffffff11", borderRadius: 4, padding: "14px 16px", marginTop: 10 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: "#00d4ff", letterSpacing: 3, margin: "0 0 12px" }}>⚡ PAIRING ENGINE</p>

                {/* Straight Bet */}
                <div style={{ marginBottom: 12, padding: "10px 12px", background: "#001a22", border: "1px solid #00d4ff33", borderRadius: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#00d4ff", letterSpacing: 2, textTransform: "uppercase" }}>Straight Bet — hits ~25% of slates</span>
                    {isStraightBet && <span style={{ fontSize: 10, color: "#ffaa00", background: "#1a1000", border: "1px solid #ffaa0044", padding: "1px 6px", borderRadius: 2 }}>⚠ 90+ CHECK PARK OVERLAY</span>}
                  </div>
                  <p style={{ fontSize: 14, color: "#fff", margin: 0 }}>
                    {top.name} <span style={{ color: "#00d4ff", fontFamily: "'Bebas Neue'", fontSize: 18 }}>{top.total}</span>
                    <span style={{ color: "#444", fontSize: 11 }}>/100</span>
                    {isStraightBet && <span style={{ color: "#ffaa00", fontSize: 11, marginLeft: 8 }}>— treat as straight bet default</span>}
                  </p>
                </div>

                {/* 2-Man Parlay */}
                {plays.length >= 3 ? (
                  <div style={{ marginBottom: 12, padding: "10px 12px", background: "#14001a", border: "1px solid #cc88ff33", borderRadius: 3 }}>
                    <span style={{ fontSize: 10, color: "#cc88ff", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>2-Man Parlay</span>
                    {parlay2.map((p, i) => (
                      <p key={i} style={{ fontSize: 13, color: "#cc88ff99", margin: "2px 0" }}>
                        {p.name} <span style={{ color: "#cc88ff", fontFamily: "'Bebas Neue'", fontSize: 16 }}>{p.total}</span>
                        <span style={{ color: "#444", fontSize: 11 }}>/100</span>
                        {plays.filter(x => x.total === p.total).length > 1 && <span style={{ fontSize: 10, color: "#ffaa00", marginLeft: 6 }}>tied</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginBottom: 12, padding: "10px 12px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 3 }}>
                    <span style={{ fontSize: 10, color: "#333", letterSpacing: 2, textTransform: "uppercase" }}>2-Man Parlay — need 3+ qualifying plays</span>
                  </div>
                )}

                {/* 3-Man Parlay */}
                {plays.length >= 4 ? (
                  <div style={{ padding: "10px 12px", background: "#0a1400", border: "1px solid #00ff8833", borderRadius: 3 }}>
                    <span style={{ fontSize: 10, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 4 }}>3-Man Parlay</span>
                    {parlay3.map((p, i) => (
                      <p key={i} style={{ fontSize: 13, color: "#00ff8899", margin: "2px 0" }}>
                        {p.name} <span style={{ color: "#00ff88", fontFamily: "'Bebas Neue'", fontSize: 16 }}>{p.total}</span>
                        <span style={{ color: "#444", fontSize: 11 }}>/100</span>
                        {plays.filter(x => x.total === p.total).length > 1 && <span style={{ fontSize: 10, color: "#ffaa00", marginLeft: 6 }}>tied</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "10px 12px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 3 }}>
                    <span style={{ fontSize: 10, color: "#333", letterSpacing: 2, textTransform: "uppercase" }}>3-Man Parlay — need 4+ qualifying plays</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ marginTop: 12, padding: "10px 14px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, fontSize: 10, color: "#444", lineHeight: 2 }}>
            <span style={{ color: "#cc88ff" }}>PATH A</span> — Score 75+ & S2 confirmed &nbsp;|&nbsp;
            <span style={{ color: "#cc88ff" }}>PATH B</span> — Score 65-74 & S2 confirmed & 5+ events &nbsp;|&nbsp;
            <span style={{ color: "#cc88ff" }}>PATH C</span> — HH 70%+ & 7+ events & S2 confirmed &nbsp;|&nbsp;
            <span style={{ color: "#ff9900" }}>PATH D</span> — Maximum Power: 35/35 combined & score 65+
          </div>

          {/* Save Slate */}
          {sorted.length > 0 && (
            <button className="btn" onClick={() => setShowSaveModal(true)} style={{ width: "100%", marginTop: 16, background: "#1a1a1a", color: "#00ff88", border: "1px solid #00ff8833" }}>
              💾 SAVE SLATE TO HISTORY
            </button>
          )}
        </>
      )}
      {/* Save Modal */}
      {showSaveModal && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid #00ff8833", borderRadius: 4, padding: 24, width: "100%", maxWidth: 420, marginTop: 16, marginBottom: 16 }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: "#00ff88", letterSpacing: 3, margin: "0 0 16px" }}>SAVE SLATE</p>
            <label className="label">Date</label>
            <input className="input" type="date" value={slateDate} onChange={e => setSlateDate(e.target.value)} style={{ marginBottom: 12 }} />
            <label className="label">Notes (optional)</label>
            <input className="input" placeholder="e.g. Wind blowing out at Wrigley" value={slateNote} onChange={e => setSlateNote(e.target.value)} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Mark who homered</p>
            {sorted.filter(p => p.qualifies).map((p, i) => (
              <div key={i} className="checkbox-row" style={{ marginBottom: 6 }}>
                <input type="checkbox" checked={!!slateResults[p.name]} onChange={e => setSlateResults(r => ({ ...r, [p.name]: e.target.checked }))} id={"hr-"+i} />
                <label htmlFor={"hr-"+i} style={{ fontSize: 12, color: slateResults[p.name] ? "#00ff88" : "#888", cursor: "pointer" }}>
                  {p.name} <span style={{ color: "#444" }}>{p.total}/100</span>
                </label>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={() => {
                const results = sorted.filter(p => p.qualifies).map(p => ({ name: p.name, homered: !!slateResults[p.name] }));
                saveSlate(results);
                setSlateResults({});
              }} style={{ flex: 1 }}>SAVE & CLEAR SLATE</button>
              <button className="btn-danger" onClick={() => setShowSaveModal(false)} style={{ padding: "10px 16px" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Trending View */}
      {view === "trending" && (
        <div>
          {history.length < 2 ? (
            <div className="empty">
              <div className="empty-icon">📈</div>
              <p style={{ fontSize: 12, letterSpacing: 2 }}>NEED 2+ SLATES</p>
              <p style={{ fontSize: 11, color: "#222", marginTop: 8 }}>Save more slates to track score trends over time</p>
            </div>
          ) : (() => {
            // Build per-player score history across slates (sorted oldest first)
            const slatesSorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
            const playerMap = {};
            slatesSorted.forEach(slate => {
              (slate.players || []).forEach(p => {
                if (!playerMap[p.name]) playerMap[p.name] = [];
                playerMap[p.name].push({ date: slate.date, score: p.total, homered: (slate.results || []).find(r => r.name === p.name)?.homered || false });
              });
            });
            // Only show players who appear in 2+ slates
            const tracked = Object.entries(playerMap).filter(([, entries]) => entries.length >= 2);
            if (tracked.length === 0) return (
              <div className="empty"><p style={{ fontSize: 12, letterSpacing: 2, color: "#333" }}>No players appear in multiple slates yet</p></div>
            );
            // Sort by trend direction: biggest movers first
            const withTrend = tracked.map(([name, entries]) => {
              const last = entries[entries.length - 1].score;
              const prev = entries[entries.length - 2].score;
              const delta = last - prev;
              const allDelta = last - entries[0].score;
              return { name, entries, delta, allDelta, last };
            }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

            const rising  = withTrend.filter(p => p.delta > 0);
            const falling = withTrend.filter(p => p.delta < 0);
            const flat    = withTrend.filter(p => p.delta === 0);

            const PlayerTrendCard = ({ p }) => {
              const maxScore = Math.max(...p.entries.map(e => e.score));
              return (
                <div className="card" style={{ marginBottom: 10, borderColor: p.delta > 0 ? "#00ff8822" : p.delta < 0 ? "#ff3b3b22" : "#1a1a1a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2, color: "#fff", margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: 10, color: "#444", margin: 0 }}>{p.entries.length} slates tracked</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: p.delta > 0 ? "#00ff88" : p.delta < 0 ? "#ff3b3b" : "#555", margin: 0, lineHeight: 1 }}>
                        {p.delta > 0 ? "↑" : p.delta < 0 ? "↓" : "→"}{Math.abs(p.delta)}
                      </p>
                      <p style={{ fontSize: 10, color: "#444", margin: 0 }}>vs prev slate</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40, marginBottom: 6 }}>
                    {p.entries.map((e, i) => {
                      const h = maxScore > 0 ? Math.round((e.score / maxScore) * 36) + 4 : 4;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <div style={{ width: "100%", height: h, background: e.homered ? "#00ff88" : i === p.entries.length - 1 ? (p.delta >= 0 ? "#00ff8866" : "#ff3b3b66") : "#2a2a2a", borderRadius: 1 }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {p.entries.map((e, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center" }}>
                        <p style={{ fontSize: 9, color: "#333", margin: 0 }}>{e.score}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: "#333", margin: "4px 0 0" }}>
                    Overall: <span style={{ color: p.allDelta > 0 ? "#00ff88" : p.allDelta < 0 ? "#ff3b3b" : "#555" }}>{p.allDelta > 0 ? "+" : ""}{p.allDelta} pts</span> from first slate · ⚾ homered on {p.entries.filter(e => e.homered).length}/{p.entries.length} tracked
                  </p>
                </div>
              );
            };

            return (
              <div>
                {rising.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: "#00ff88", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>↑ Trending Up ({rising.length})</p>
                    {rising.map((p, i) => <PlayerTrendCard key={i} p={p} />)}
                  </>
                )}
                {falling.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: "#ff3b3b", letterSpacing: 3, textTransform: "uppercase", margin: "16px 0 10px" }}>↓ Trending Down ({falling.length})</p>
                    {falling.map((p, i) => <PlayerTrendCard key={i} p={p} />)}
                  </>
                )}
                {flat.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: "#555", letterSpacing: 3, textTransform: "uppercase", margin: "16px 0 10px" }}>→ Flat ({flat.length})</p>
                    {flat.map((p, i) => <PlayerTrendCard key={i} p={p} />)}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Results View */}
      {view === "results" && (
        <div>
          {history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⚾</div>
              <p style={{ fontSize: 12, letterSpacing: 2 }}>NO RESULTS YET</p>
              <p style={{ fontSize: 11, color: "#222", marginTop: 8 }}>Save slates with HR results to see them here</p>
            </div>
          ) : (() => {
            const slatesSorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

            // Overall HR stats by power status
            const allHomers = slatesSorted.flatMap(s =>
              (s.results || []).filter(r => r.homered).map(r => {
                const playerData = (s.players || []).find(p => p.name === r.name);
                return { ...r, ...playerData, date: s.date };
              })
            );

            const statsByStatus = {};
            ["POWER OVERLOAD", "PEAK MODE", "PRIMED", "LOADING", null].forEach(status => {
              const group = allHomers.filter(p => (p.powerStatus || null) === status);
              const totalPlays = slatesSorted.flatMap(s =>
                (s.players || []).filter(p => (p.powerStatus || null) === status && p.qualifies)
              ).length;
              statsByStatus[status || "NONE"] = { hrs: group.length, plays: totalPlays };
            });

            const statusLabel = s => s === "POWER OVERLOAD" ? "💀 OVERLOAD" : s === "PEAK MODE" ? "🔥 PEAK" : s === "PRIMED" ? "⚡ PRIMED" : s === "LOADING" ? "🔄 LOADING" : "—";
            const statusColor = s => s === "POWER OVERLOAD" ? "#ff3b3b" : s === "PEAK MODE" ? "#ff9900" : s === "PRIMED" ? "#88ff44" : s === "LOADING" ? "#00d4ff" : "#555";
            const statusBg    = s => s === "POWER OVERLOAD" ? "#2a0a0a" : s === "PEAK MODE" ? "#1a0e00" : s === "PRIMED" ? "#0a1400" : s === "LOADING" ? "#001a22" : "#111";
            const statusBorder= s => s === "POWER OVERLOAD" ? "#ff3b3b44" : s === "PEAK MODE" ? "#ff990044" : s === "PRIMED" ? "#88ff4444" : s === "LOADING" ? "#00d4ff44" : "#1a1a1a";
            const pathColor   = path => path === "D" ? "#ff9900" : "#cc88ff";
            const pathBg      = path => path === "D" ? "#1a0800" : "#0a001a";
            const pathBorder  = path => path === "D" ? "#ff990044" : "#cc88ff44";

            return (
              <div>
                {/* Badge hit rate summary */}
                <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 16px", marginBottom: 16 }}>
                  <p style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: "#888", letterSpacing: 3, margin: "0 0 10px" }}>HR RATE BY POWER BADGE</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["POWER OVERLOAD", "PEAK MODE", "PRIMED", "LOADING"].map(status => {
                      const { hrs, plays } = statsByStatus[status] || { hrs: 0, plays: 0 };
                      const rate = plays > 0 ? Math.round((hrs / plays) * 100) : 0;
                      return (
                        <div key={status} style={{ background: statusBg(status), border: `1px solid ${statusBorder(status)}`, borderRadius: 3, padding: "8px 12px", minWidth: 90 }}>
                          <p style={{ fontSize: 10, color: statusColor(status), margin: "0 0 4px", letterSpacing: 1 }}>{statusLabel(status)}</p>
                          <p style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: statusColor(status), margin: 0, lineHeight: 1 }}>{rate}%</p>
                          <p style={{ fontSize: 10, color: "#333", margin: "2px 0 0" }}>{hrs}/{plays} plays</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Slates with HRs */}
                {slatesSorted.map((slate, si) => {
                  const homers = (slate.results || []).filter(r => r.homered).map(r => {
                    const pd = (slate.players || []).find(p => p.name === r.name);
                    return { name: r.name, ...pd };
                  });
                  const misses = (slate.results || []).filter(r => !r.homered).map(r => {
                    const pd = (slate.players || []).find(p => p.name === r.name);
                    return { name: r.name, ...pd };
                  });
                  if ((slate.results || []).length === 0) return null;
                  return (
                    <div key={slate.id} className="card" style={{ marginBottom: 12 }}>
                      {/* Slate header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                          <p style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 2, color: "#fff", margin: 0 }}>{slate.date}</p>
                          {slate.note && <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{slate.note}</p>}
                        </div>
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: homers.length > 0 ? "#00ff88" : "#333" }}>
                          {homers.length}/{(slate.results || []).length} HR
                        </span>
                      </div>

                      {/* Homers */}
                      {homers.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 10, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 6px" }}>⚾ Went Yard</p>
                          {homers.map((p, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6, padding: "6px 10px", background: "#001a0f", borderRadius: 2, border: "1px solid #00ff8822" }}>
                              <span style={{ fontSize: 13, color: "#00ff88", fontFamily: "'Bebas Neue'", letterSpacing: 1 }}>{p.name}</span>
                              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, color: "#fff" }}>{p.total}<span style={{ color: "#333", fontSize: 11 }}>/100</span></span>
                              {p.qualifyPath && (
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: pathBg(p.qualifyPath), color: pathColor(p.qualifyPath), border: `1px solid ${pathBorder(p.qualifyPath)}` }}>PATH {p.qualifyPath}</span>
                              )}
                              {p.powerStatus && (
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: statusBg(p.powerStatus), color: statusColor(p.powerStatus), border: `1px solid ${statusBorder(p.powerStatus)}` }}>{statusLabel(p.powerStatus)}</span>
                              )}
                              {p.due && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#1a1400", color: "#ffaa00", border: "1px solid #ffaa0044" }}>🎯 DUE</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Misses */}
                      {misses.length > 0 && (
                        <details>
                          <summary style={{ fontSize: 10, color: "#333", letterSpacing: 2, cursor: "pointer", textTransform: "uppercase", marginBottom: 6 }}>✗ Didn't Go Yard ({misses.length})</summary>
                          <div style={{ marginTop: 8 }}>
                            {misses.map((p, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6, padding: "6px 10px", background: "#0a0a0a", borderRadius: 2, border: "1px solid #1a1a1a" }}>
                                <span style={{ fontSize: 13, color: "#444", fontFamily: "'Bebas Neue'", letterSpacing: 1 }}>{p.name}</span>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, color: "#333" }}>{p.total}<span style={{ color: "#222", fontSize: 11 }}>/100</span></span>
                                {p.qualifyPath && (
                                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#111", color: "#444", border: "1px solid #1a1a1a" }}>PATH {p.qualifyPath}</span>
                                )}
                                {p.powerStatus && (
                                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#111", color: "#444", border: "1px solid #1a1a1a" }}>{statusLabel(p.powerStatus)}</span>
                                )}
                                {p.due && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#111", color: "#555", border: "1px solid #1a1a1a" }}>🎯 DUE</span>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Leaderboard View */}
      {view === "leaderboard" && (() => {
        // Derive all leaders from history — anyone marked as homered
        const batterMap = {};
        [...history].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(slate => {
          (slate.results || []).filter(r => r.homered).forEach(r => {
            const pd = (slate.players || []).find(p => p.name === r.name) || {};
            if (!batterMap[r.name]) batterMap[r.name] = { name: r.name, hrs: [], slates: [] };
            batterMap[r.name].hrs.push(slate.date);
            batterMap[r.name].slates.push({ date: slate.date, score: pd.total, path: pd.qualifyPath, powerStatus: pd.powerStatus, due: pd.due });
          });
        });

        const sorted = Object.values(batterMap).sort((a, b) => b.hrs.length - a.hrs.length);
        const maxHRs = sorted[0]?.hrs.length || 1;

        const statusColor = s => s === "POWER OVERLOAD" ? "#ff3b3b" : s === "PEAK MODE" ? "#ff9900" : s === "PRIMED" ? "#88ff44" : s === "LOADING" ? "#00d4ff" : "#555";
        const statusLabel = s => s === "POWER OVERLOAD" ? "💀 OVERLOAD" : s === "PEAK MODE" ? "🔥 PEAK" : s === "PRIMED" ? "⚡ PRIMED" : s === "LOADING" ? "🔄 LOADING" : null;
        const pathColor   = p => p === "D" ? "#ff9900" : "#cc88ff";

        function getL10(batter) {
          const counts = {};
          batter.hrs.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 10);
        }

        return (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#fff", letterSpacing: 3, margin: 0, lineHeight: 1 }}>LTT MODEL HR LEADERS</p>
              <p style={{ fontSize: 10, color: "#444", letterSpacing: 2, margin: "4px 0 0" }}>AUTO-POPULATED FROM SAVED SLATES · TAP TO EXPAND L10</p>
            </div>

            {sorted.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🏆</div>
                <p style={{ fontSize: 12, letterSpacing: 2 }}>NO HRs RECORDED YET</p>
                <p style={{ fontSize: 11, color: "#222", marginTop: 8 }}>Save slates and mark who homered — they'll appear here automatically</p>
              </div>
            ) : sorted.map((batter, i) => {
              const isExpanded = expandedBatter === batter.name;
              const l10 = getL10(batter);
              const l10total = l10.reduce((s, [, c]) => s + c, 0);
              const barWidth = Math.round((batter.hrs.length / maxHRs) * 100);
              const rank = i + 1;
              const rankColor = rank === 1 ? "#ffd700" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "#555";
              const recentSlate = batter.slates[batter.slates.length - 1];

              return (
                <div key={batter.name} style={{ marginBottom: 8 }}>
                  {/* Main row */}
                  <div onClick={() => setExpandedBatter(isExpanded ? null : batter.name)}
                    style={{ background: "#0f0f0f", border: `1px solid ${isExpanded ? "#00ff8833" : "#1a1a1a"}`, borderRadius: isExpanded ? "4px 4px 0 0" : 4, padding: "12px 14px", cursor: "pointer", userSelect: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: rankColor, width: 28, flexShrink: 0 }}>#{rank}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 1, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{batter.name}</span>
                            {recentSlate?.powerStatus && <span style={{ fontSize: 10, color: statusColor(recentSlate.powerStatus), flexShrink: 0 }}>{statusLabel(recentSlate.powerStatus)}</span>}
                            {recentSlate?.due && <span style={{ fontSize: 10, color: "#ffaa00", flexShrink: 0 }}>🎯</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "#00ff88", lineHeight: 1 }}>{batter.hrs.length}</span>
                            <span style={{ fontSize: 10, color: "#444" }}>HR</span>
                            <span style={{ fontSize: 14, color: "#333" }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        <div className="bar-bg">
                          <div className="bar-fill" style={{ width: `${barWidth}%`, background: rank === 1 ? "linear-gradient(90deg, #ffd70066, #ffd700)" : "linear-gradient(90deg, #00ff8833, #00ff88)" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* L10 Dropdown */}
                  {isExpanded && (
                    <div style={{ background: "#0a0a0a", border: "1px solid #00ff8822", borderTop: "none", borderRadius: "0 0 4px 4px", padding: "12px 14px" }}>
                      <p style={{ fontSize: 10, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 10px" }}>L10 SLATES · {l10total} HR</p>
                      {/* L10 bar chart by date */}
                      {l10.map(([date, count]) => (
                        <div key={date} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#444", width: 90, flexShrink: 0 }}>{date}</span>
                          <div style={{ flex: 1, display: "flex", gap: 4 }}>
                            {Array.from({ length: count }).map((_, ci) => (
                              <div key={ci} style={{ width: 22, height: 22, background: "#001a0f", border: "1px solid #00ff8844", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚾</div>
                            ))}
                          </div>
                          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: "#00ff88", flexShrink: 0 }}>{count} HR</span>
                        </div>
                      ))}
                      <hr style={{ border: "none", borderTop: "1px solid #1a1a1a", margin: "10px 0" }} />
                      {/* All slates they hit in */}
                      <p style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", margin: "0 0 8px" }}>All {batter.slates.length} HR Slates</p>
                      {[...batter.slates].reverse().map((s, si) => (
                        <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5, padding: "5px 8px", background: "#0f0f0f", borderRadius: 2 }}>
                          <span style={{ fontSize: 11, color: "#444", width: 90, flexShrink: 0 }}>{s.date}</span>
                          {s.score != null && <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, color: "#fff" }}>{s.score}<span style={{ color: "#333", fontSize: 10 }}>/100</span></span>}
                          {s.path && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#0a001a", color: pathColor(s.path), border: `1px solid ${pathColor(s.path)}44` }}>PATH {s.path}</span>}
                          {s.powerStatus && <span style={{ fontSize: 10, color: statusColor(s.powerStatus) }}>{statusLabel(s.powerStatus)}</span>}
                          {s.due && <span style={{ fontSize: 10, color: "#ffaa00" }}>🎯 DUE</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* History View */}
      {view === "history" && (
        <div>
          {history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <p style={{ fontSize: 12, letterSpacing: 2 }}>NO SLATES SAVED YET</p>
              <p style={{ fontSize: 11, color: "#222", marginTop: 8 }}>Score a slate and save it to build your history</p>
            </div>
          ) : (
            <>
              {/* Win rate summary */}
              {(() => {
                const allPlays = history.flatMap(s => s.results || []);
                const hits = allPlays.filter(r => r.homered).length;
                const pct = allPlays.length > 0 ? Math.round((hits / allPlays.length) * 100) : 0;
                return (
                  <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24 }}>
                    <div>
                      <p className="label">Slates Tracked</p>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#00ff88", lineHeight: 1 }}>{history.length}</p>
                    </div>
                    <div>
                      <p className="label">Plays Tracked</p>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#00d4ff", lineHeight: 1 }}>{allPlays.length}</p>
                    </div>
                    <div>
                      <p className="label">HR Hit Rate</p>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: pct >= 30 ? "#00ff88" : pct >= 20 ? "#ffaa00" : "#ff3b3b", lineHeight: 1 }}>{pct}%</p>
                    </div>
                    <div>
                      <p className="label">Total HRs</p>
                      <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: "#888", lineHeight: 1 }}>{hits}</p>
                    </div>
                  </div>
                );
              })()}

              {history.map((slate, si) => {
                const hits = (slate.results || []).filter(r => r.homered).length;
                const total = (slate.results || []).length;
                const isEditing = editingSlate === slate.id;
                return (
                  <div key={slate.id} className="card" style={{ marginBottom: 12, borderColor: isEditing ? "#00ff8833" : "#1a1a1a" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 2, color: "#fff", margin: 0 }}>{slate.date}</p>
                        {isEditing ? (
                          <input className="input" defaultValue={slate.note || ""} id={"note-"+slate.id} placeholder="Add notes..." style={{ marginTop: 4, fontSize: 11 }} />
                        ) : (
                          slate.note && <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{slate.note}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: hits > 0 ? "#00ff88" : "#444" }}>{hits}/{total} HR</span>
                        <button onClick={() => setEditingSlate(isEditing ? null : slate.id)} style={{ background: "transparent", color: isEditing ? "#00ff88" : "#555", border: `1px solid ${isEditing ? "#00ff8844" : "#2a2a2a"}`, padding: "3px 8px", fontSize: 11, cursor: "pointer", borderRadius: 2, fontFamily: "monospace" }}>{isEditing ? "DONE" : "EDIT"}</button>
                        <button className="btn-danger" onClick={() => deleteSlate(slate.id)}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(slate.results || []).map((r, ri) => (
                        isEditing ? (
                          <label key={ri} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 2, background: r.homered ? "#001a0f" : "#111", color: r.homered ? "#00ff88" : "#666", border: `1px solid ${r.homered ? "#00ff8844" : "#1a1a1a"}`, cursor: "pointer" }}>
                            <input type="checkbox" defaultChecked={r.homered} id={"edit-"+slate.id+"-"+ri} style={{ accentColor: "#00ff88" }} onChange={() => {
                              const updated = slate.results.map((x, xi) => xi === ri ? { ...x, homered: !x.homered } : x);
                              updateSlateResults(slate.id, updated, document.getElementById("note-"+slate.id)?.value || slate.note);
                            }} />
                            {r.name}
                          </label>
                        ) : (
                          <span key={ri} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 2, background: r.homered ? "#001a0f" : "#111", color: r.homered ? "#00ff88" : "#444", border: `1px solid ${r.homered ? "#00ff8844" : "#1a1a1a"}` }}>
                            {r.homered ? "⚾ " : ""}{r.name}
                          </span>
                        )
                      ))}
                    </div>
                    {slate.players && slate.players.length > 0 && (
                      <details style={{ marginTop: 10 }}>
                        <summary style={{ fontSize: 10, color: "#333", letterSpacing: 2, cursor: "pointer", textTransform: "uppercase" }}>View full slate scores</summary>
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {slate.players.map((p, pi) => (
                            <span key={pi} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 2, background: "#0a0a0a", color: p.qualifies ? "#00ff88" : "#444", border: "1px solid #1a1a1a" }}>
                              {p.name} {p.total}
                              {p.powerStatus && <span style={{ marginLeft: 4, color: p.powerStatus === "POWER OVERLOAD" ? "#ff3b3b" : p.powerStatus === "PEAK MODE" ? "#ff9900" : p.powerStatus === "PRIMED" ? "#88ff44" : "#00d4ff" }}>· {p.powerStatus}</span>}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

