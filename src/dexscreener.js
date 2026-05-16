import axios from 'axios';

const api = axios.create({ baseURL: 'https://api.dexscreener.com', timeout: 15000 });

export async function fetchLatestSolanaPairs() {
  // DexScreener public API does not expose a perfect new-pair firehose.
  // These searches broaden coverage so the dashboard shows more than 1-2 names.
  const queries = [
    'solana','pump','raydium','meteora','orca','meme','memecoin','pepe','dog','cat','kitty',
    'bonk','wif','ai','agent','trump','moon','cto','wojak','troll','coin','new'
  ];
  const all = [];
  for (const q of queries) {
    try {
      const res = await api.get(`/latest/dex/search?q=${encodeURIComponent(q)}`);
      all.push(...(res.data?.pairs || []).filter(p => p.chainId === 'solana'));
    } catch (e) {
      console.warn('DexScreener search failed', q, e.message);
    }
  }
  const seen = new Set();
  return all.filter(p => {
    const key = p.pairAddress || `${p.baseToken?.address}:${p.dexId}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
