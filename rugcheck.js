import axios from 'axios';

export async function getRugReport(tokenAddress) {
  try {
    const url = `https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`;
    const res = await axios.get(url, { timeout: 12000 });
    const r = res.data || {};
    const risks = Array.isArray(r.risks) ? r.risks : [];
    const topPct = Number(r.topHolders?.reduce?.((a, h) => a + Number(h.pct || 0), 0) || r.top10HoldersPct || 0);
    const flags = risks.map(x => x.name || x.description || String(x)).slice(0, 8);
    const score = Math.min(100, Number(r.score_normalised ?? r.score ?? 50));
    return {
      available: true,
      score,
      riskLevel: score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW',
      top10Pct: topPct,
      lpLockedPct: Number(r.markets?.[0]?.lp?.lpLockedPct || r.lpLockedPct || 0),
      mintAuthority: Boolean(r.mintAuthority),
      freezeAuthority: Boolean(r.freezeAuthority),
      flags
    };
  } catch (e) {
    return { available: false, score: 50, riskLevel: 'UNKNOWN', top10Pct: null, lpLockedPct: null, flags: ['RugCheck unavailable'] };
  }
}
