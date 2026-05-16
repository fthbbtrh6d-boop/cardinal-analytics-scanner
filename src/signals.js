import { getSnapshotsFor } from './store.js';

function color(value, green, yellow) {
  if (value >= green) return 'GREEN';
  if (value >= yellow) return 'YELLOW';
  return 'RED';
}

function pct(now, old) { return old > 0 ? ((now - old) / old) * 100 : 0; }

export function computeTrends(pairAddress, current) {
  const snaps = getSnapshotsFor(pairAddress, 20);
  const prev = snaps[0];
  const prev2 = snaps[1];

  if (!prev) return {
    liquidityTrendPct: 0, volumeTrendPct: 0, activityTrendPct: 0,
    liquidityTrend: 'UNKNOWN', volumeTrend: 'UNKNOWN', holderProxyTrend: 'UNKNOWN',
    velocitySignal: 'YELLOW', scoreDirection: 'NEW'
  };

  const liquidityTrendPct = pct(current.liquidityUsd, prev.liquidityUsd);
  const volumeTrendPct = pct(current.volumeH1, prev.volumeH1);
  const currentActivity = (current.buysH1 || 0) + (current.sellsH1 || 0);
  const prevActivity = (prev.buysH1 || 0) + (prev.sellsH1 || 0);
  const activityTrendPct = pct(currentActivity, prevActivity);
  const priorVolTrendPct = prev2 ? pct(prev.volumeH1, prev2.volumeH1) : 0;
  const volumeAcceleration = volumeTrendPct - priorVolTrendPct;

  const liquidityTrend = liquidityTrendPct > 8 ? 'RISING' : liquidityTrendPct < -8 ? 'FALLING' : 'FLAT';
  const volumeTrend = volumeTrendPct > 15 ? 'ACCELERATING' : volumeTrendPct < -20 ? 'COOLING' : 'STABLE';
  const holderProxyTrend = activityTrendPct > 12 ? 'RISING' : activityTrendPct < -15 ? 'FALLING' : 'STABLE';

  let velocitySignal = 'YELLOW';
  if (volumeTrend === 'ACCELERATING' && liquidityTrend !== 'FALLING' && activityTrendPct > 0) velocitySignal = 'GREEN';
  if (volumeTrend === 'COOLING' || liquidityTrend === 'FALLING') velocitySignal = 'RED';

  return {
    liquidityTrendPct, volumeTrendPct, activityTrendPct, volumeAcceleration,
    liquidityTrend, volumeTrend, holderProxyTrend, velocitySignal,
    scoreDirection: 'TRACKING'
  };
}

export function computeSignals(raw) {
  const totalTxH1 = raw.buysH1 + raw.sellsH1;
  const buyRatio = totalTxH1 > 0 ? raw.buysH1 / totalTxH1 : 0;
  const volLiqRatio = raw.liquidityUsd > 0 ? raw.volumeH1 / raw.liquidityUsd : 0;
  const mcLiq = raw.liquidityUsd > 0 ? raw.marketCap / raw.liquidityUsd : 999;

  const liqSignal = raw.liquidityTrend === 'RISING' || raw.liquidityUsd >= 50000 ? 'GREEN' : raw.liquidityUsd >= 15000 ? 'YELLOW' : 'RED';
  const volSignal = volLiqRatio >= 1.4 && raw.volumeTrend !== 'COOLING' ? 'GREEN' : volLiqRatio >= 0.35 ? 'YELLOW' : 'RED';
  const buySignal = color(buyRatio, 0.60, 0.52);
  const holderSignal = raw.holderProxyScore >= 75 || raw.holderProxyTrend === 'RISING' ? 'GREEN' : raw.holderProxyScore >= 45 ? 'YELLOW' : 'RED';

  let rugSignal = 'YELLOW';
  if (raw.rug?.riskLevel === 'LOW' || (raw.rug?.available && raw.rug?.score < 35)) rugSignal = 'GREEN';
  if (raw.rug?.riskLevel === 'HIGH' || raw.rug?.mintAuthority || raw.rug?.freezeAuthority || raw.rug?.top10Pct > 50 || raw.heliusTop10Pct > 50 || raw.heliusTop1Pct > 15) rugSignal = 'RED';

  const priceOnlyTrap = Math.abs(raw.priceChangeH1 || 0) > 50 && volSignal !== 'GREEN' && liqSignal !== 'GREEN';
  const overextended = (raw.priceChangeH1 || 0) > 150 && raw.liquidityTrend !== 'RISING';
  const allGreen = liqSignal === 'GREEN' && volSignal === 'GREEN' && buySignal === 'GREEN' && holderSignal !== 'RED' && rugSignal === 'GREEN' && !overextended;

  return { buyRatio, volLiqRatio, mcLiq, liqSignal, volSignal, buySignal, holderSignal, rugSignal, priceOnlyTrap, overextended, allGreen };
}
