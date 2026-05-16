import axios from 'axios';
import { config } from './config.js';

export async function getHeliusDistribution(tokenAddress) {
  if (!config.heliusApiKey) return { available: false, reason: 'No HELIUS_API_KEY' };
  try {
    const [supplyRes, largestRes] = await Promise.all([
      axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`, {
        jsonrpc: '2.0', id: 'supply', method: 'getTokenSupply', params: [tokenAddress]
      }, { timeout: 12000 }),
      axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`, {
        jsonrpc: '2.0', id: 'largest', method: 'getTokenLargestAccounts', params: [tokenAddress]
      }, { timeout: 12000 })
    ]);

    const supply = Number(supplyRes.data?.result?.value?.uiAmount || 0);
    const largestAccounts = largestRes.data?.result?.value || [];
    const top10Amount = largestAccounts.slice(0, 10).reduce((sum, a) => sum + Number(a.uiAmount || 0), 0);
    const top1Amount = Number(largestAccounts[0]?.uiAmount || 0);
    const top10Pct = supply > 0 ? (top10Amount / supply) * 100 : null;
    const top1Pct = supply > 0 ? (top1Amount / supply) * 100 : null;

    return {
      available: true,
      supply,
      top10Pct,
      top1Pct,
      largestAccounts: largestAccounts.slice(0, 10)
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

// Free holder proxy. This does NOT claim exact holder count.
// It estimates distribution/activity using free DexScreener txns + Helius top-holder concentration.
export function buildFreeHolderProxy(raw, heliusDistribution) {
  const totalH1Tx = (raw.buysH1 || 0) + (raw.sellsH1 || 0);
  const totalH24Tx = (raw.buysH24 || 0) + (raw.sellsH24 || 0);
  const buyRatio = totalH1Tx > 0 ? raw.buysH1 / totalH1Tx : 0;

  let proxyScore = 50;
  if (totalH1Tx >= 500) proxyScore += 20;
  else if (totalH1Tx >= 150) proxyScore += 12;
  else if (totalH1Tx >= 50) proxyScore += 5;
  else proxyScore -= 10;

  if (buyRatio >= 0.62) proxyScore += 10;
  else if (buyRatio < 0.48) proxyScore -= 12;

  if (heliusDistribution?.available) {
    if (heliusDistribution.top10Pct !== null && heliusDistribution.top10Pct <= 35) proxyScore += 15;
    else if (heliusDistribution.top10Pct > 50) proxyScore -= 25;
    if (heliusDistribution.top1Pct !== null && heliusDistribution.top1Pct > 15) proxyScore -= 15;
  }

  proxyScore = Math.max(0, Math.min(100, Math.round(proxyScore)));
  return {
    holderProxyAvailable: true,
    holderProxyScore: proxyScore,
    holderProxyLabel: proxyScore >= 75 ? 'STRONG PROXY' : proxyScore >= 50 ? 'NEUTRAL PROXY' : 'WEAK PROXY',
    holderCount: null,
    uniqueWallet24h: null
  };
}
