import { useState } from "react";

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

const defaultForm = { name: "", combined: "", blast: "", air: "", pullAir: "", hardHit: "", stage2: false };

export default function App() {
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [showForm, setShowForm] = useState(false);

  function handleChange(e) {
    const { name, type, value, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  function addPlayer() {
    if (!form.name.trim()) return;
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
    setPlayers(p => [...p, { ...form, total: finalTotal, dq, breakdown, stage2pass, vals, qualifies, qualifyPath }]);
    setForm(defaultForm);
    setShowForm(false);
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

          <p style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", margin: "16px 0 8px" }}>— Stage 2: Propfinder Statcast —</p>

          <div className="checkbox-row" style={{ marginBottom: 16 }}>
            <input type="checkbox" name="stage2" checked={form.stage2} onChange={handleChange} id="s2" />
            <label htmlFor="s2" style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>1+ contact in L7 with 350ft+ AND 20°+ launch angle on Propfinder</label>
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
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#444" }}>
                      <span>L7 350ft+ & 20°+ contact <strong style={{ color: p.stage2pass ? "#00ff88" : "#ff6600" }}>{p.stage2pass ? "YES" : "NO"}</strong></span>
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
                <p key={i} style={{ margin: "4px 0", fontSize: 13, color: "#00ff8899" }}>
                  {p.name} — <strong style={{ color: "#00ff88" }}>{p.total}</strong>/100 &nbsp;
                  <span style={{ color: p.qualifyPath === "D" ? "#ff9900" : "#cc88ff", fontSize: 11 }}>PATH {p.qualifyPath}</span>
                </p>
              ))}
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
