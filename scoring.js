export function scoreToken(token) {
  let score = 50;

  const reasons = [];
  const warnings = [];

  if (token.liquidityUsd >= 15000 && token.liquidityUsd <= 150000) {
    score += 12;
    reasons.push("Liquidity is in the target early-runner range.");
  } else if (token.liquidityUsd < 15000) {
    score -= 15;
    warnings.push("Liquidity is too low.");
  } else if (token.liquidityUsd > 150000) {
    score -= 5;
    warnings.push("Liquidity may be less early-stage.");
  }

  if (token.buyPressure >= 70) {
    score += 15;
    reasons.push("Buy pressure is very strong.");
  } else if (token.buyPressure >= 60) {
    score += 8;
    reasons.push("Buy pressure is positive.");
  } else if (token.buyPressure < 45) {
    score -= 15;
    warnings.push("Sell pressure is too high.");
  }

  if (token.volumeAcceleration >= 3) {
    score += 18;
    reasons.push("Volume is exploding versus recent average.");
  } else if (token.volumeAcceleration >= 2) {
    score += 10;
    reasons.push("Volume is accelerating.");
  } else if (token.volumeAcceleration < 0.75) {
    score -= 8;
    warnings.push("Volume is fading.");
  }

  if (token.txnAcceleration >= 2) {
    score += 10;
    reasons.push("Buy activity is accelerating.");
  } else if (token.txnAcceleration < 0.75) {
    score -= 5;
    warnings.push("Transaction activity is weak.");
  }

  if (token.eliteMomentum) {
    score += 20;
    reasons.push("Elite momentum conditions detected.");
  } else if (token.ignitionSignal) {
    score += 12;
    reasons.push("Ignition signal detected.");
  }

  if (token.earlyRunner) {
    score += 8;
    reasons.push("Market cap is still early-runner sized.");
  }

  if (token.healthyLiquidity) {
    score += 6;
    reasons.push("Liquidity structure is healthy.");
  }

  if (token.overextended) {
    score -= 30;
    warnings.push("Do not chase: chart is overextended.");
  }

  const rugRisk = String(token.rug?.risk || "").toLowerCase();

  if (rugRisk === "high" || rugRisk === "red") {
    score -= 35;
    warnings.push("Rug risk is high.");
  } else if (rugRisk === "medium" || rugRisk === "yellow") {
    score -= 10;
    warnings.push("Rug risk is elevated.");
  } else {
    score += 8;
    reasons.push("Rug risk looks acceptable.");
  }

  if (token.whaleData?.whaleSignal === "DANGEROUS") {
    score -= 25;
    warnings.push("Top holder concentration is dangerous.");
  } else if (token.whaleData?.whaleSignal === "RISKY") {
    score -= 15;
    warnings.push("Top holder concentration is risky.");
  } else if (token.whaleData?.whaleSignal === "WATCH") {
    score -= 5;
    warnings.push("Top holder concentration should be watched.");
  } else if (token.whaleData?.whaleSignal === "HEALTHY") {
    score += 8;
    reasons.push("Top holder concentration looks healthy.");
  }

  if (token.hasTelegram) score += 3;
  if (token.hasTwitter) score += 3;
  if (token.hasWebsite) score += 2;

  score += Number(token.confidenceBoost || 0);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let action = "AVOID";
  let setupType = "NO SETUP";
  let confidence = "LOW";

  if (score >= 90 && token.eliteMomentum && !token.overextended) {
    action = "STARTER / SCALE";
    setupType = "ELITE MOMENTUM";
    confidence = "HIGH";
  } else if (score >= 80 && token.ignitionSignal && !token.overextended) {
    action = "STARTER";
    setupType = "IGNITION";
    confidence = "HIGH";
  } else if (score >= 70) {
    action = "WATCH";
    setupType = "CONTINUATION WATCH";
    confidence = "MEDIUM";
  } else if (score >= 60) {
    action = "WATCH ONLY";
    setupType = "LOW PRIORITY";
    confidence = "LOW";
  }

  if (token.overextended) {
    action = "DO NOT CHASE";
    setupType = "OVEREXTENDED";
  }

  if (
    rugRisk === "high" ||
    rugRisk === "red" ||
    token.whaleData?.whaleSignal === "DANGEROUS"
  ) {
    action = "AVOID";
    setupType = "RUG-RISK AVOID";
  }

  return {
    ...token,
    score,
    action,
    setupType,
    confidence,
    reasons,
    warnings
  };
}