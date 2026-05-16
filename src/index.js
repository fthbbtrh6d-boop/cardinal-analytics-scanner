import { getCryptoPrices } from './portfolioApi.js';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import { config } from './config.js';
import { scanOnce } from './scanner.js';
import { readJson, writeJson } from './store.js';
import { sendDiscordAlert } from './alerts.js';
import { evaluatePosition, enhanceTokenForTrade } from './tradeManager.js';

const app = express();

app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'API Online' });
});

let lastRun = null;

function upsert(name, item, matcher = (a, b) => a.id === b.id) {
  const items = readJson(name);
  const incoming = { ...item, updatedAt: new Date().toISOString() };
  const idx = items.findIndex(x => matcher(x, incoming));

  if (idx >= 0) {
    items[idx] = { ...items[idx], ...incoming };
  } else {
    items.unshift({
      id: uuid(),
      createdAt: new Date().toISOString(),
      ...incoming
    });
  }

  writeJson(name, items);
  return idx >= 0 ? items[idx] : items[0];
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'API Online'
  });
});
app.post('/scan', async (req, res) => {
  try {
    res.json({
      success: true,
      results: [
app.post('/api/scan', async (req, res) => {
  try {
    const results = await getLiveScannerResults();
    res.json({ ok: true, results });
  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});app.post('/api/scan', async (req, res) => {
  res.json({
    ok: true,
    results: [
      {
  symbol: 'RVT',
  name: 'Rovetan',
  liquidity: '$24K',
  volume: '$180K',
  score: 91,
  risk: 'Medium',
},
        symbol: 'DAI',
        name: 'DaiDai26',
        liquidity: '$31K',
        volume: '$420K',
        score: 95,
        risk: 'Low'
      }
    ]
  });
});
  res.json({
    ok: true,
    lastRun,
    config: {
      interval: config.scanIntervalMinutes,
      minLiq: config.minLiquidityUsd,
      maxLiq: config.maxLiquidityUsd,
      autoAlerts: config.enableAutoAlerts,
      hasDiscord: Boolean(config.discordWebhookUrl),
      hasHelius: Boolean(config.heliusApiKey)
    }
  });
});

app.get('/api/tokens', (_, res) => {
  const positions = readJson('positions');
  const tokens = readJson('tokens').map(t => enhanceTokenForTrade(t, positions));
  res.json(tokens);
});

app.get('/api/snapshots/:pair', (req, res) => {
  res.json(
    readJson('snapshots')
      .filter(s => s.pairAddress === req.params.pair)
      .slice(0, 150)
  );
});

app.post('/api/scan', async (_, res) => {
  try {
    lastRun = await scanOnce();
    res.json(lastRun);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/test-alert', async (req, res) => {
  res.json(
    await sendDiscordAlert(
      req.body || {
        name: 'Test',
        symbol: 'TEST',
        score: 99,
        riskLevel: 'LOW',
        confidenceLevel: 'HIGH',
        confidence: 95,
        liquidityUsd: 100000,
        volumeH1: 200000,
        buyRatio: 0.7,
        entryChecklist: {
          passed: 8,
          total: 8,
          entryQuality: 'STARTER OK'
        },
        exitPressure: {
          exitPressureLevel: 'LOW',
          exitPressureScore: 10
        },
        positives: [{ text: 'Test alert from V5 works.' }],
        dexUrl: 'https://dexscreener.com'
      }
    )
  );
});

app.get('/api/portfolio-prices', async (_, res) => {
  const prices = await getCryptoPrices([
    'BTC',
    'ETH',
    'XRP',
    'LINK',
    'ARB',
    'RENDER',
    'SUI',
    'AVAX',
    'SOL'
  ]);

  res.json(prices);
});

 

app.get('/api/wallets', (_, res) => res.json(readJson('wallets')));
app.post('/api/wallets', (req, res) => res.json(upsert('wallets', req.body)));
app.delete('/api/wallets/:id', (req, res) => {
  writeJson('wallets', readJson('wallets').filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/journal', (_, res) => res.json(readJson('journal')));
app.post('/api/journal', (req, res) => res.json(upsert('journal', req.body)));
app.delete('/api/journal/:id', (req, res) => {
  writeJson('journal', readJson('journal').filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/positions', (_, res) => {
  const tokens = readJson('tokens');

  const positions = readJson('positions').map(p => {
    const token = tokens.find(
      t =>
        t.tokenAddress === p.tokenAddress ||
        t.pairAddress === p.pairAddress ||
        t.symbol === p.symbol
    );

    return {
      ...p,
      evaluation: token ? evaluatePosition(p, token) : null,
      token
    };
  });

  res.json(positions);
});

app.post('/api/positions', (req, res) => {
  res.json(
    upsert(
      'positions',
      req.body,
      (a, b) =>
        a.id === b.id ||
        (b.tokenAddress && a.tokenAddress === b.tokenAddress) ||
        (b.pairAddress && a.pairAddress === b.pairAddress)
    )
  );
});

app.delete('/api/positions/:id', (req, res) => {
  writeJson('positions', readJson('positions').filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/watchlist', (_, res) => res.json(readJson('watchlist')));
app.post('/api/watchlist', (req, res) => {
  res.json(
    upsert(
      'watchlist',
      req.body,
      (a, b) =>
        a.id === b.id ||
        a.tokenAddress === b.tokenAddress ||
        a.pairAddress === b.pairAddress
    )
  );
});

app.delete('/api/watchlist/:id', (req, res) => {
  writeJson('watchlist', readJson('watchlist').filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/blacklist', (_, res) => res.json(readJson('blacklist')));
app.post('/api/blacklist', (req, res) => {
  res.json(
    upsert(
      'blacklist',
      req.body,
      (a, b) =>
        a.id === b.id ||
        a.tokenAddress === b.tokenAddress ||
        a.pairAddress === b.pairAddress ||
        a.symbol === b.symbol
    )
  );
});

app.delete('/api/blacklist/:id', (req, res) => {
  writeJson('blacklist', readJson('blacklist').filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/alerts', (_, res) => res.json(readJson('alerts')));

app.get('/api/settings', (_, res) => res.json(readJson('settings')));

app.post('/api/settings', (req, res) => {
  writeJson('settings', {
    ...readJson('settings'),
    ...req.body,
    updatedAt: new Date().toISOString()
  });

  res.json(readJson('settings'));
});

cron.schedule(`*/${config.scanIntervalMinutes} * * * *`, async () => {
  try {
    lastRun = await scanOnce();
    console.log('scan complete', lastRun.saved);
  } catch (e) {
    console.error('scan failed', e.message);
  }
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Scanner API running on http://0.0.0.0:${config.port}`);
});
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'API Online'
  });
});

const watchlist = [];
const blacklist = [];
const journal = [];
const positions = [];

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "API Online",
    timestamp: new Date().toISOString(),
  });
});

app.get("/tokens", async (req, res) => {
  res.json([
    {
      symbol: "SOL",
      name: "Solana",
      price: 184.22,
      change24h: 8.4,
      liquidity: 1240000,
      volume24h: 8900000,
      risk: "Low",
      signal: "Bullish",
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: 103240,
      change24h: 3.8,
      liquidity: 90000000,
      volume24h: 42000000000,
      risk: "Low",
      signal: "Hold",
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      price: 3841,
      change24h: 5.1,
      liquidity: 62000000,
      volume24h: 19000000000,
      risk: "Low",
      signal: "Bullish",
    },
  ]);
});

app.get("/positions", (req, res) => {
  res.json(positions);
});

app.get("/journal", (req, res) => {
  res.json(journal);
});

app.get("/watchlist", (req, res) => {
  res.json(watchlist);
});

app.get("/blacklist", (req, res) => {
  res.json(blacklist);
});

app.get("/portfolio-prices", (req, res) => {
  res.json({
    BTC: 103240,
    ETH: 3841,
    XRP: 1.5,
    SOL: 184.22,
    AVAX: 37.41,
    LINK: 16.82,
    ROVETAN: 0.00042,
  });
});

app.post("/scan", async (req, res) => {
  const results = [
    {
      name: "Solana Meme Coin",
      symbol: "SMC",
      chain: "Solana",
      price: "$0.00042",
      liquidity: 24500,
      volume24h: 187000,
      age: "42 min",
      risk: "Medium",
      score: 82,
      signal: "Watch",
      reason: "Liquidity entered target range with rising volume.",
    },
    {
      name: "Pump Token",
      symbol: "PUMP",
      chain: "Solana",
      price: "$0.000018",
      liquidity: 18200,
      volume24h: 94000,
      age: "18 min",
      risk: "High",
      score: 71,
      signal: "High Risk",
      reason: "Early liquidity, strong volume, but very new token.",
    },
    {
      name: "Runner",
      symbol: "RUN",
      chain: "Solana",
      price: "$0.00091",
      liquidity: 32800,
      volume24h: 260000,
      age: "1 hr",
      risk: "Medium",
      score: 86,
      signal: "Momentum",
      reason: "Volume surge with healthier liquidity.",
    },
  ];

  res.json({
    ok: true,
    count: results.length,
    results,
  });
});

app.listen(PORT, () => {
  console.log(`Scanner API running on http://localhost:${PORT}`);
});
