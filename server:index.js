import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 5050;
const DEX = "https://api.dexscreener.com";

app.use(cors());
app.use(express.json());

const alerted = new Set();

function envNum(name, fallback) {
  return Number(process.env[name] || fallback);
}

const SETTINGS = {
  alertScore: envNum("ALERT_SCORE", 85),
  minLiquidity: envNum("MIN_LIQUIDITY", 15000),
  maxLiquidity: envNum("MAX_LIQUIDITY", 150000),
  maxAgeMinutes: envNum("MAX_AGE_MINUTES", 360),
  minVolumeLiquidityRatio: envNum("MIN_VOLUME_LIQUIDITY_RATIO", 1.5)
};

async function sendTelegramAlert(token) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("Telegram missing bot token or chat ID.");
    return false;
  }

  const text = `🚨 CARDINAL SCANNER ALERT 🚨

${token.symbol} - ${token.name}

Score: ${token.score}
Action: ${token.action}
Signal: ${token.rugSignal}

Liquidity: $${Number(token.liquidity || 0).toLocaleString()}
24h Volume: $${Number(token.volume24h || 0).toLocaleString()}
Volume/Liq: ${token.volumeLiquidityRatio}x
Age: ${token.age}
24h Change: ${token.priceChange}%

Reason:
${token.reason}

Dex:
${token.dexUrl}`;

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: false
      })
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.log("Telegram error:", data);
    return false;
  }

  console.log("Telegram sent:", token.symbol, token.score);
  return true;
}

function ageMinutes(pair) {
  if (!pair?.pairCreatedAt) return 999999;
  return Math.max(1, Math.floor((Date.now() - pair.pairCreatedAt) / 60000));
}

function scorePair(pair) {
  const liquidity = Number(pair?.liquidity?.usd || 0);
  const volume = Number(pair?.volume?.h24 || 0);
  const buys = Number(pair?.txns?.h24?.buys || 0);
  const sells = Number(pair?.txns?.h24?.sells || 0);
  const txns = buys + sells;
  const change = Number(pair?.priceChange?.h24 || 0);
  const age = ageMinutes(pair);
  const volumeLiquidityRatio = liquidity > 0 ? volume / liquidity : 0;

  let score = 0;

  if (age <= 30) score += 25;
  else if (age <= 120) score += 18;
  else if (age <= 360) score += 10;
  else score -= 15;

  if (liquidity >= 15000 && liquidity <= 150000) score += 25;
  else if (liquidity >= 5000 && liquidity <= 300000) score += 12;

  if (volumeLiquidityRatio >= 3) score += 25;
  else if (volumeLiquidityRatio >= 1.5) score += 18;
  else if (volumeLiquidityRatio >= 1) score += 10;

  if (txns >= 250) score += 15;
  else if (txns >= 100) score += 10;
  else if (txns >= 50) score += 5;

  if (change > 10 && change < 250) score += 15;
  else if (change > 0 && change < 400) score += 8;
  else if (change >= 400) score -= 15;
  else if (change <= -25) score -= 25;

  if (buys > sells && buys + sells > 25) score += 5;

  return Math.max(0, Math.min(score, 100));
}

function normalizePair(pair) {
  const liquidity = Number(pair?.liquidity?.usd || 0);
  const volume24h = Number(pair?.volume?.h24 || 0);
  const priceChange = Number(pair?.priceChange?.h24 || 0);
  const age = ageMinutes(pair);
  const score = scorePair(pair);
  const volumeLiquidityRatio =
    liquidity > 0 ? Number((volume24h / liquidity).toFixed(2)) : 0;

  return {
    id: pair?.pairAddress || pair?.baseToken?.address || Math.random().toString(),
    symbol: pair?.baseToken?.symbol || "UNKNOWN",
    name: pair?.baseToken?.name || "Unknown Token",
    chain: pair?.chainId || "unknown",
    priceUsd: Number(pair?.priceUsd || 0),
    liquidity,
    volume24h,
    volumeLiquidityRatio,
    priceChange,
    ageMinutes: age,
    age: age === 999999 ? "Unknown" : `${age} min`,
    score,
    action: score >= 85 ? "STARTER" : score >= 60 ? "WATCH" : "AVOID",
    confidence: score >= 85 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW",
    rugSignal:
      liquidity < 5000 || priceChange < -25 || priceChange > 500
        ? "RED"
        : score >= 75
        ? "GREEN"
        : "YELLOW",
    setupType:
      score >= 85
        ? "Early Momentum"
        : score >= 60
        ? "Watchlist"
        : "Avoid",
    reason: `Liquidity $${Math.round(liquidity).toLocaleString()}, 24h volume $${Math.round(volume24h).toLocaleString()}, volume/liquidity ${volumeLiquidityRatio}x, age ${age} min, 24h change ${priceChange}%.`,
    dexUrl: pair?.url || "https://dexscreener.com",
    tokenAddress: pair?.baseToken?.address || null,
    pairAddress: pair?.pairAddress || null
  };
}

function shouldAlert(token) {
  if (alerted.has(token.id)) return false;

  return (
    token.score >= SETTINGS.alertScore &&
    token.liquidity >= SETTINGS.minLiquidity &&
    token.liquidity <= SETTINGS.maxLiquidity &&
    token.ageMinutes <= SETTINGS.maxAgeMinutes &&
    token.volumeLiquidityRatio >= SETTINGS.minVolumeLiquidityRatio &&
    token.rugSignal !== "RED"
  );
}

async function getLiveScannerResults() {
  const searches = [
    "pump",
    "moon",
    "solana meme",
    "baby",
    "dog",
    "cat",
    "ai",
    "goat"
  ];

  const allPairs = [];

  for (const q of searches) {
    try {
      const res = await fetch(
        `${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (Array.isArray(data?.pairs)) allPairs.push(...data.pairs);
    } catch (err) {
      console.log("Dex search failed:", q, err.message);
    }
  }

  const unique = new Map();

  for (const pair of allPairs) {
    if (pair?.chainId !== "solana") continue;
    if (!pair?.pairAddress) continue;
    unique.set(pair.pairAddress, pair);
  }

  return [...unique.values()]
    .map(normalizePair)
    .filter(t => t.liquidity >= 5000)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "API Online", settings: SETTINGS });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "API Online", settings: SETTINGS });
});

app.get("/test-telegram", async (req, res) => {
  try {
    const sent = await sendTelegramAlert({
      id: "test",
      symbol: "TEST",
      name: "Telegram Test",
      score: 99,
      action: "TEST",
      rugSignal: "GREEN",
      liquidity: 25000,
      volume24h: 100000,
      volumeLiquidityRatio: 4,
      priceChange: 50,
      age: "1 min",
      reason: "Testing Telegram direct route.",
      dexUrl: "https://dexscreener.com"
    });

    res.json({ ok: sent, message: sent ? "Telegram sent" : "Telegram failed" });
  } catch (err) {
    console.log("Test Telegram error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function scanHandler(req, res) {
  try {
    const results = await getLiveScannerResults();

    console.log("SCAN RESULTS:", results.length);
    console.log("TOP:", results[0]?.symbol, results[0]?.score);

    const alerts = [];

    for (const token of results) {
      if (shouldAlert(token)) {
        const sent = await sendTelegramAlert(token);
        if (sent) {
          alerted.add(token.id);
          alerts.push(token.symbol);
        }
      }
    }

    res.json({
      ok: true,
      count: results.length,
      alertsSent: alerts,
      results
    });
  } catch (err) {
    console.log("Scan error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

app.post("/scan", scanHandler);
app.post("/api/scan", scanHandler);

app.get("/tokens", async (req, res) => {
  const results = await getLiveScannerResults();
  res.json(results);
});

app.get("/api/tokens", async (req, res) => {
  const results = await getLiveScannerResults();
  res.json(results);
});

app.get("/positions", (req, res) => res.json([]));
app.get("/api/positions", (req, res) => res.json([]));
app.get("/journal", (req, res) => res.json([]));
app.get("/api/journal", (req, res) => res.json([]));
app.get("/watchlist", (req, res) => res.json([]));
app.get("/api/watchlist", (req, res) => res.json([]));
app.get("/blacklist", (req, res) => res.json([]));
app.get("/api/blacklist", (req, res) => res.json([]));
app.get("/portfolio-prices", (req, res) => res.json({}));
app.get("/api/portfolio-prices", (req, res) => res.json({}));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Scanner API running on http://localhost:${PORT}`);
});
setInterval(async () => {
  console.log("AUTO SCAN RUNNING...");
  await scanHandler({}, {
    json: () => {}
  });
}, 60000);