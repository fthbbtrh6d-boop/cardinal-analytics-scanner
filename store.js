import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), '../data');
const defaults = {
  tokens: [],
  snapshots: [],
  wallets: [],
  journal: [],
  positions: [],
  watchlist: [],
  blacklist: [],
  alerts: [],
  settings: {
    profitPlan: [
      { gainPct: 50, sellPct: 25, note: 'Lock partial profit.' },
      { gainPct: 100, sellPct: 50, note: 'Recover original investment.' },
      { gainPct: 200, sellPct: 25, note: 'Trim another piece.' }
    ],
    maxLossPct: -25,
    defaultRiskUsd: 100
  }
};

const files = {
  tokens: path.join(dataDir, 'tokens.json'),
  snapshots: path.join(dataDir, 'snapshots.json'),
  wallets: path.join(dataDir, 'smart_wallets.json'),
  journal: path.join(dataDir, 'trade_journal.json'),
  positions: path.join(dataDir, 'positions.json'),
  watchlist: path.join(dataDir, 'watchlist.json'),
  blacklist: path.join(dataDir, 'blacklist.json'),
  alerts: path.join(dataDir, 'alerts.json'),
  settings: path.join(dataDir, 'settings.json')
};

function ensure() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  for (const [name, file] of Object.entries(files)) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaults[name] ?? [], null, 2));
  }
}
ensure();

export function readJson(name) {
  ensure();
  try { return JSON.parse(fs.readFileSync(files[name], 'utf8') || JSON.stringify(defaults[name] ?? [])); }
  catch { return defaults[name] ?? []; }
}

export function writeJson(name, data) {
  ensure();
  fs.writeFileSync(files[name], JSON.stringify(data, null, 2));
}

export function upsertToken(token) {
  const tokens = readJson('tokens');
  const idx = tokens.findIndex(t => t.pairAddress === token.pairAddress || t.tokenAddress === token.tokenAddress);
  const merged = { ...(idx >= 0 ? tokens[idx] : {}), ...token, updatedAt: new Date().toISOString() };
  if (idx >= 0) tokens[idx] = merged; else tokens.unshift({ ...merged, firstSeenAt: new Date().toISOString() });
  writeJson('tokens', tokens.slice(0, 800));
  return merged;
}

export function addSnapshot(snapshot) {
  const snapshots = readJson('snapshots');
  snapshots.unshift({ ...snapshot, ts: Date.now(), iso: new Date().toISOString() });
  writeJson('snapshots', snapshots.slice(0, 12000));
}

export function getSnapshotsFor(pairAddress, limit = 100) {
  return readJson('snapshots').filter(s => s.pairAddress === pairAddress).slice(0, limit);
}

export function addAlert(alert) {
  const alerts = readJson('alerts');
  alerts.unshift({ id: alert.id || cryptoId(), ...alert, createdAt: new Date().toISOString() });
  writeJson('alerts', alerts.slice(0, 1000));
}

function cryptoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
