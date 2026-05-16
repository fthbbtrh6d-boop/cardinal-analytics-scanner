import React, { useEffect, useMemo, useState } from "react";
import "./style.css";

const API = "http://localhost:5050";

export default function App() {
  const [health, setHealth] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [filter, setFilter] = useState("all");
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("Ready.");

  async function api(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function refresh() {
    try {
      const h = await api("/health");
      setHealth(h);
      setMsg("API connected.");
    } catch (e) {
      setHealth(null);
      setMsg("API offline.");
    }
  }

  async function scan() {
    setLoading(true);
    setMsg("Scanning...");
    try {
      const res = await api("/scan", { method: "POST" });
      setTokens(res.results || []);
      setMsg(`Scan complete. ${res.results?.length || 0} tokens found.`);
      setTab("scanner");
    } catch (e) {
      setMsg("Scan failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const shown = useMemo(() => {
    if (filter === "elite") return tokens.filter(t => Number(t.score || 0) >= 85);
    if (filter === "starter") return tokens.filter(t => String(t.action || "").includes("STARTER"));
    if (filter === "ignition") return tokens.filter(t => Number(t.score || 0) >= 75);
    if (filter === "avoid") return tokens.filter(t => String(t.action || "").includes("AVOID"));
    return tokens;
  }, [tokens, filter]);

  const apiOnline = Boolean(health?.ok);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">◆</div>
          <div>
            <h1>CARDINAL<br />ANALYTICS</h1>
            <p>SCANNER</p>
          </div>
        </div>

        <p className="sideLabel">MAIN</p>

        {[
          ["dashboard", "Dashboard"],
          ["scanner", "Scanner"],
          ["positions", "Positions"],
          ["portfolio", "Portfolio"],
          ["watchlist", "Watchlist"],
          ["blacklist", "Blacklist"],
          ["journal", "Journal"],
          ["rules", "Rules"]
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}

        <div className="syncCard">
          <span className={`pill ${apiOnline ? "green" : "red"}`}>
            {apiOnline ? "API Online" : "API Offline"}
          </span>
          <p>Updates every 60s</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>Welcome back.</h2>
            <p>Cardinal Analytics Scanner market overview and scanner dashboard.</p>
          </div>

          <div className="topActions">
            <span className={`pill ${apiOnline ? "green" : "red"}`}>
              {apiOnline ? "API Online" : "API Offline"}
            </span>
            <button onClick={refresh}>Refresh</button>
            <button onClick={scan}>{loading ? "Scanning..." : "Scan now"}</button>
          </div>
        </header>

        {tab === "dashboard" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">TOTAL PORTFOLIO VALUE</p>
                <h3>$40,229.63</h3>
                <p>Crypto + stocks + cash in one place</p>
              </div>
              <div className="sparkline">▰▰▰▰▰▰▰</div>
            </section>

            <section className="grid4">
              <Stat label="Crypto" value="$840.63" sub="2.1%" />
              <Stat label="Stocks" value="$39,176.50" sub="97.4%" />
              <Stat label="Cash" value="$212.50" sub="0.5%" />
              <Stat label="Total Assets" value="14" sub="positions" />
            </section>

            <section className="panel">
              <h3>Status</h3>
              <p>{msg}</p>
              <p>Scanner: {apiOnline ? "Online" : "Offline"}</p>
            </section>
          </>
        )}

        {tab === "scanner" && (
          <>
            <div className="filters">
              {[
                ["all", "All"],
                ["elite", "Elite"],
                ["starter", "Starter/Scale"],
                ["ignition", "Ignition"],
                ["avoid", "Avoid/Sell"]
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="panel">
              {shown.length === 0 ? (
                <div className="empty">
                  <h3>No data yet</h3>
                  <p>Click Scan now.</p>
                </div>
              ) : (
                <div className="cards">
                  {shown.map(t => (
                    <div className="scannerCard" key={t.id}>
                      <div className="tokenHead">
                        <div>
                          <h3>{t.symbol}</h3>
                          <p>{t.name}</p>
                        </div>
                        <strong>{t.score}</strong>
                      </div>

                      <div className="pillRow">
                        <span className="pill green">{t.action}</span>
                        <span className="pill">{t.confidence}</span>
                        <span className={t.rugSignal === "RED" ? "pill red" : "pill green"}>
                          {t.rugSignal}
                        </span>
                      </div>

                      <p><b>Liquidity:</b> ${Number(t.liquidity).toLocaleString()}</p>
                      <p><b>Volume:</b> ${Number(t.volume24h).toLocaleString()}</p>
                      <p><b>Age:</b> {t.age}</p>
                      <p><b>Reason:</b> {t.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab !== "dashboard" && tab !== "scanner" && (
          <section className="panel">
            <h3>{tab}</h3>
            <p>This section is ready to connect next.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}