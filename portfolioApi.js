async function getStockPrices() {
  try {
    const symbols = ['VOO', 'VB', 'VXUS'];
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;

    const res = await fetch(url);
    const data = await res.json();

    const out = {};

    for (const q of data.quoteResponse?.result || []) {
      out[q.symbol] = q.regularMarketPrice || 0;
    }

    return out;
  } catch (err) {
    console.error('Stock price fetch failed:', err);
    return {
      VOO: 687.73,
      VB: 287.01,
      VXUS: 85.02
    };
  }
}

export async function getCryptoPrices(symbols = []) {
  try {
    const ids = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      XRP: 'ripple',
      LINK: 'chainlink',
      ARB: 'arbitrum',
      RENDER: 'render-token',
      SUI: 'sui',
      AVAX: 'avalanche-2',
      SOL: 'solana'
    };

    const coinIds = symbols
      .map(s => ids[s])
      .filter(Boolean)
      .join(',');

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`
    );

    const data = await res.json();
    const stocks = await getStockPrices();

    return {
      BTC: data.bitcoin?.usd || 0,
      ETH: data.ethereum?.usd || 0,
      XRP: data.ripple?.usd || 0,
      LINK: data.chainlink?.usd || 0,
      ARB: data.arbitrum?.usd || 0,
      RENDER: data['render-token']?.usd || 0,
      SUI: data.sui?.usd || 0,
      AVAX: data['avalanche-2']?.usd || 0,
      SOL: data.solana?.usd || 0,
      ...stocks,
      CASH: 212.50
    };
  } catch (err) {
    console.error('Portfolio price fetch failed:', err);
    return {};
  }
}