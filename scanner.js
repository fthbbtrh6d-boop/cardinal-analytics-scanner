import { config } from './config.js';
import { fetchLatestSolanaPairs } from './dexscreener.js';
import { getRugReport } from './rugcheck.js';
import { getHeliusDistribution, buildFreeHolderProxy } from './enrich.js';
import { addSnapshot, upsertToken, readJson } from './store.js';
import { computeTrends } from './signals.js';
import { scoreToken } from './scoring.js';
import { sendDiscordAlert, shouldAlert } from './alerts.js';
import { enhanceTokenForTrade } from './tradeManager.js';

async function sendTelegramAlert(token) {
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text:
`🚨 ELITE MEME COIN ALERT 🚨

${token.symbol} - ${token.name}

Score: ${token.score}

Liquidity: $${Number(token.liquidity).toLocaleString()}
24h Volume: $${Number(token.volume24h).toLocaleString()}

Signal: ${token.signal}

Reason:
${token.reason}`
        })
      }
    );
  } catch (err) {
    console.log('Telegram failed');
  }
}

function ageMinutes(pairCreatedAt) {
  return pairCreatedAt
    ? Math.max(0, (Date.now() - pairCreatedAt) / 60000)
    : 999999;
}

function links(pair) {
  const info = pair.info || {};
  const socials = info.socials || [];

  return {
    hasTelegram: socials.some(s => /telegram/i.test(s.type || s.url || '')),
    hasTwitter: socials.some(s => /twitter|x.com/i.test(s.type || s.url || '')),
    hasWebsite: Boolean(info.websites?.length)
  };
}

async function fetchDexTrending() {
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=solana'
    );
    const data = await res.json();
    return data.pairs || [];
  } catch {
    return [];
  }
}

function buildWhaleDataFromHelius(heliusDist) {
  const top10 = heliusDist?.top10Pct ?? null;

  if (top10 === null || top10 === undefined) {
    return {
      whaleSignal: 'UNKNOWN',
      whaleScore: 50,
      whaleSummary: 'Holder concentration unavailable'
    };
  }

  return {
    whaleSignal:
      top10 > 50 ? 'DANGEROUS' :
      top10 > 35 ? 'RISKY' :
      top10 > 25 ? 'WATCH' :
      'HEALTHY',

    whaleScore:
      top10 > 50 ? 20 :
      top10 > 35 ? 45 :
      top10 > 25 ? 65 :
      80,

    whaleSummary: `Top 10 holders own ${top10.toFixed(1)}%`
  };
}

function dedupePairs(pairs) {
  const unique = [];
  const seen = new Set();

  for (const pair of pairs) {
    const address = pair.baseToken?.address || pair.pairAddress;
    if (!address) continue;

    const key = String(address).toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(pair);
    }
  }

  return unique;
}

function buildBaseRawPair(p) {
  return {
    chainId: p.chainId,
    dexId: p.dexId,
    pairAddress: p.pairAddress,
    tokenAddress: p.baseToken?.address,

    name: p.baseToken?.name || 'Unknown',
    symbol: p.baseToken?.symbol || '',

    liquidityUsd: Number(p.liquidity?.usd || 0),

    volumeH1: Number(p.volume?.h1 || 0),
    volumeH6: Number(p.volume?.h6 || 0),
    volumeH24: Number(p.volume?.h24 || 0),

    buysH1: Number(p.txns?.h1?.buys || 0),
    sellsH1: Number(p.txns?.h1?.sells || 0),

    buysH6: Number(p.txns?.h6?.buys || 0),
    sellsH6: Number(p.txns?.h6?.sells || 0),

    buysH24: Number(p.txns?.h24?.buys || 0),
    sellsH24: Number(p.txns?.h24?.sells || 0),

    priceUsd: Number(p.priceUsd || 0),

    priceChangeH1: Number(p.priceChange?.h1 || 0),
    priceChangeH6: Number(p.priceChange?.h6 || 0),
    priceChangeH24: Number(p.priceChange?.h24 || 0),

    marketCap: Number(p.marketCap || p.fdv || 0),

    ageMinutes: ageMinutes(p.pairCreatedAt),

    dexUrl: p.url,

    ...links(p)
  };
}

export async function scanOnce() {
  const latestPairs = await fetchLatestSolanaPairs();
  const dexTrending = await fetchDexTrending();

  const combined = [
    ...latestPairs,
    ...dexTrending
  ];

  const unique = dedupePairs(combined);

  const candidates = unique.filter(p => {
    const liq = Number(p.liquidity?.usd || 0);
    const age = ageMinutes(p.pairCreatedAt);

    return (
      liq >= config.minLiquidityUsd &&
      liq <= config.maxLiquidityUsd &&
      age >= config.minTokenAgeMinutes &&
      age <= config.maxTokenAgeHours * 60
    );
  });

  const results = [];
  const positions = readJson('positions');
  const blacklist = readJson('blacklist');

  const blacklisted = new Set(
    blacklist
      .map(b =>
        String(b.tokenAddress || b.pairAddress || b.symbol || '').toLowerCase()
      )
      .filter(Boolean)
  );

  for (const p of candidates.slice(0, 150)) {
    const tokenAddress = p.baseToken?.address;

    if (!tokenAddress) continue;

    const symbolKey = String(p.baseToken?.symbol || '').toLowerCase();

    if (
      blacklisted.has(String(tokenAddress).toLowerCase()) ||
      blacklisted.has(String(p.pairAddress).toLowerCase()) ||
      blacklisted.has(symbolKey)
    ) {
      continue;
    }

    const baseRaw = buildBaseRawPair(p);

    const [rug, heliusDist] = await Promise.all([
      getRugReport(tokenAddress),
      getHeliusDistribution(tokenAddress)
    ]);

    const holderProxy = buildFreeHolderProxy(baseRaw, heliusDist);
    const whaleData = buildWhaleDataFromHelius(heliusDist);

    const withFreeData = {
      ...baseRaw,
      ...holderProxy,

      whaleData,

      heliusTop10Pct: heliusDist?.top10Pct ?? null,
      heliusTop1Pct: heliusDist?.top1Pct ?? null,
      heliusDistributionAvailable: !!heliusDist?.available,

      rug
    };

    const trends = computeTrends(p.pairAddress, withFreeData);

    const scored = enhanceTokenForTrade(
      scoreToken({
        ...withFreeData,
        ...trends
      }),
      positions
    );

    addSnapshot(scored);

    const saved = upsertToken(scored);

    if (config.enableAutoAlerts && shouldAlert(saved)) {
      await sendDiscordAlert(saved);
    }


    results.push(saved);
  }
if (saved.score >= 25) {
console.log("SENDING TELEGRAM ALERT", saved.symbol, saved.score);
  await sendTelegramAlert(saved);
}


  return {
    scanned: unique.length,
    matched: candidates.length,
    saved: results.length,
    results: results.sort((a, b) => b.score - a.score),
    ts: new Date().toISOString()
  };
}