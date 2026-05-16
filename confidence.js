const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function pushReason(arr, type, text, weight = 1) {
  arr.push({ type, text, weight });
}

export function buildConfidence(t) {
  const positives = [];
  const warnings = [];
  const blockers = [];

  let confidence = 50;

  if (t.liqSignal === 'GREEN') { confidence += 12; pushReason(positives, 'liquidity', 'Liquidity is in the target range and structure looks tradable.', 12); }
  else if (t.liqSignal === 'YELLOW') { confidence += 4; pushReason(warnings, 'liquidity', 'Liquidity is usable but not elite yet.', 4); }
  else { confidence -= 14; pushReason(blockers, 'liquidity', 'Liquidity is weak or outside the preferred range.', -14); }

  if (t.liquidityTrend === 'RISING') { confidence += 10; pushReason(positives, 'liquidity_trend', 'Liquidity is rising, which lowers fake-pump risk.', 10); }
  else if (t.liquidityTrend === 'FALLING') { confidence -= 18; pushReason(blockers, 'liquidity_trend', 'Liquidity is falling. Avoid unless structure recovers.', -18); }
  else { confidence -= 2; pushReason(warnings, 'liquidity_trend', 'Liquidity is not clearly increasing yet.', -2); }

  if (t.volSignal === 'GREEN') { confidence += 11; pushReason(positives, 'volume', 'Volume is healthy relative to liquidity.', 11); }
  else if (t.volSignal === 'YELLOW') { confidence += 3; pushReason(warnings, 'volume', 'Volume is acceptable but not strong.', 3); }
  else { confidence -= 12; pushReason(blockers, 'volume', 'Volume is weak versus liquidity.', -12); }

  if (t.volumeTrend === 'ACCELERATING') { confidence += 10; pushReason(positives, 'volume_trend', 'Volume is accelerating. Momentum is improving.', 10); }
  else if (t.volumeTrend === 'COOLING') { confidence -= 12; pushReason(warnings, 'volume_trend', 'Volume is cooling. Wait for re-acceleration.', -12); }

  if (t.buySignal === 'GREEN') { confidence += 8; pushReason(positives, 'buys', 'Buy pressure is dominant.', 8); }
  else if (t.buySignal === 'YELLOW') { confidence += 2; pushReason(warnings, 'buys', 'Buy pressure is balanced, not dominant.', 2); }
  else { confidence -= 10; pushReason(blockers, 'buys', 'Sell pressure is too high.', -10); }

  if (t.rugSignal === 'GREEN') { confidence += 14; pushReason(positives, 'rug', 'Rug flags are low based on available free checks.', 14); }
  else if (t.rugSignal === 'YELLOW') { confidence -= 5; pushReason(warnings, 'rug', 'Some risk flags exist. Size down or wait.', -5); }
  else { confidence -= 30; pushReason(blockers, 'rug', 'Rug risk is red. Avoid unless you fully understand the risk.', -30); }

  if (t.holderSignal === 'GREEN' || t.holderProxyTrend === 'STRONG') { confidence += 8; pushReason(positives, 'holder_proxy', 'Holder proxy/activity signal is strong.', 8); }
  else if (t.holderSignal === 'YELLOW') { confidence += 1; pushReason(warnings, 'holder_proxy', 'Holder proxy is only moderate.', 1); }
  else { confidence -= 7; pushReason(warnings, 'holder_proxy', 'Holder proxy is weak or unavailable.', -7); }

  if (t.mcLiq <= 10) { confidence += 7; pushReason(positives, 'mc_liq', 'Market cap/liquidity ratio is healthy.', 7); }
  else if (t.mcLiq <= 25) { confidence += 2; pushReason(warnings, 'mc_liq', 'Market cap/liquidity ratio is acceptable.', 2); }
  else { confidence -= 12; pushReason(blockers, 'mc_liq', 'Market cap is fragile relative to liquidity.', -12); }

  if (t.priceOnlyTrap) { confidence -= 28; pushReason(blockers, 'price_only', 'Price is moving without enough structural confirmation. Do not chase.', -28); }
  if (t.overextended) { confidence -= 22; pushReason(blockers, 'overextended', 'Move is overextended. Better entry usually comes after pullback/consolidation.', -22); }

  if (t.penalties?.length) {
    for (const p of t.penalties) pushReason(warnings, 'penalty', `Penalty: ${String(p).replaceAll('_', ' ')}`, -3);
  }

  const finalConfidence = clamp(confidence);
  let confidenceLevel = 'LOW';
  if (finalConfidence >= 82 && blockers.length === 0) confidenceLevel = 'HIGH';
  else if (finalConfidence >= 65 && blockers.length <= 1) confidenceLevel = 'MEDIUM';

  let setupType = 'NO SETUP';
  if (t.priceOnlyTrap) setupType = 'PRICE-ONLY TRAP';
  else if (t.overextended) setupType = 'OVEREXTENDED';
  else if (t.rugSignal === 'RED') setupType = 'RUG-RISK AVOID';
  else if (t.liquidityTrend === 'RISING' && t.volumeTrend === 'ACCELERATING' && t.buySignal === 'GREEN') setupType = 'IGNITION';
  else if (t.score >= 75 && t.volSignal !== 'RED' && t.buySignal !== 'RED') setupType = 'CONTINUATION WATCH';
  else if (t.liqSignal === 'GREEN' && t.rugSignal === 'GREEN' && t.volSignal === 'YELLOW') setupType = 'WAIT FOR VOLUME';

  let decision = 'IGNORE';
  if (confidenceLevel === 'HIGH' && t.score >= 80) decision = 'HIGH PRIORITY WATCH';
  else if (confidenceLevel === 'MEDIUM' && t.score >= 70) decision = 'WATCH / WAIT FOR CONFIRMATION';
  else if (t.overextended || t.priceOnlyTrap || t.rugSignal === 'RED') decision = 'DO NOT CHASE';
  else decision = 'LOW PRIORITY';

  const why = [...positives.slice(0, 4), ...warnings.slice(0, 3), ...blockers.slice(0, 3)];

  return {
    confidence: finalConfidence,
    confidenceLevel,
    setupType,
    decision,
    positives,
    warnings,
    blockers,
    why
  };
}
