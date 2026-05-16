export function enhanceTokenForTrade(token, positions = []) {
  const entrySignals = [];
  const exitSignals = [];

  let entryRating = "WAIT";
  let exitRating = "HOLD";

  const buyPressure = token.buyPressure || 0;
  const volumeAcceleration = token.volumeAcceleration || 0;
  const txnAcceleration = token.txnAcceleration || 0;

  const marketCap = token.marketCap || 0;
  const liquidity = token.liquidityUsd || 0;

  const mcToLiq =
    liquidity > 0
      ? marketCap / liquidity
      : 999;

  const shortMomentum = token.shortMomentum || 0;
  const mediumMomentum = token.mediumMomentum || 0;

  const whaleDanger =
    token.whaleData?.whaleSignal === "DANGEROUS";

  const rugDanger =
    token.rug?.risk === "high" ||
    token.rug?.risk === "red";

  const overextended =
    shortMomentum > 80 ||
    mediumMomentum > 200;

  const idealEntry =
    buyPressure >= 60 &&
    volumeAcceleration >= 2 &&
    txnAcceleration >= 1.5 &&
    mcToLiq <= 6 &&
    !overextended &&
    !rugDanger &&
    !whaleDanger;

  const eliteEntry =
    buyPressure >= 75 &&
    volumeAcceleration >= 3 &&
    txnAcceleration >= 2 &&
    mcToLiq <= 5 &&
    marketCap <= 500000 &&
    !overextended &&
    !rugDanger &&
    !whaleDanger;

  if (eliteEntry) {
    entryRating = "ELITE ENTRY";
    entrySignals.push(
      "Strong buy pressure",
      "Explosive volume acceleration",
      "Transaction acceleration confirmed",
      "Market cap still early",
      "Liquidity structure healthy"
    );
  } else if (idealEntry) {
    entryRating = "GOOD ENTRY";
    entrySignals.push(
      "Momentum building",
      "Volume trend positive",
      "Healthy liquidity ratio"
    );
  } else {
    entryRating = "WAIT";

    if (buyPressure < 55)
      exitSignals.push("Buy pressure weak");

    if (volumeAcceleration < 1.5)
      exitSignals.push("Volume not expanding");

    if (txnAcceleration < 1)
      exitSignals.push("Transaction growth weak");

    if (mcToLiq > 8)
      exitSignals.push("Market cap overheated");

    if (overextended)
      exitSignals.push("Chart extended");

    if (rugDanger)
      exitSignals.push("Rug danger");

    if (whaleDanger)
      exitSignals.push("Whale concentration dangerous");
  }

  if (overextended) {
    exitRating = "TAKE PROFITS";
  }

  if (rugDanger || whaleDanger) {
    exitRating = "AVOID";
  }

  const existingPosition = positions.find(
    p =>
      p.tokenAddress === token.tokenAddress
  );

  return {
    ...token,

    entryRating,
    exitRating,

    entrySignals,
    exitSignals,

    mcToLiq: Number(mcToLiq.toFixed(2)),

    alreadyPositioned: !!existingPosition
  };
}
export function evaluatePosition(position, token) {
  const entryPrice = Number(position.entryPrice || 0);
  const currentPrice = Number(token?.priceUsd || position.currentPrice || 0);
  const amountInvested = Number(position.amountInvested || 0);
  const maxLoss = Number(position.maxLoss || 25);

  const pnlPercent =
    entryPrice > 0 && currentPrice > 0
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : 0;

  let recommendation = "HOLD";

  if (pnlPercent >= 200) recommendation = "SELL 25% AND KEEP MOON BAG";
  else if (pnlPercent >= 100) recommendation = "SELL ORIGINAL INVESTMENT";
  else if (pnlPercent >= 50) recommendation = "SELL 25%";
  else if (pnlPercent <= -maxLoss) recommendation = "CUT LOSS";

  return {
    ...position,
    currentPrice,
    amountInvested,
    pnlPercent: Number(pnlPercent.toFixed(2)),
    recommendation
  };
}