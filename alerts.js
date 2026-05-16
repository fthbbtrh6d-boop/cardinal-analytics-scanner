import axios from 'axios';
import { config } from './config.js';

function alertText(token) {
  const entry = token.entryChecklist;
  const exit = token.exitPressure;
  const reasons = (token.positives || []).slice(0, 3).map(r => `+ ${r.text}`).join('\n');
  const warns = [...(token.warnings || []), ...(token.blockers || [])].slice(0, 3).map(r => `- ${r.text}`).join('\n');
  return `🔥 **V5 TRADE MANAGER ALERT**\n**${token.name} (${token.symbol})** — Score ${token.score}/100 | Confidence ${token.confidenceLevel} (${token.confidence})\nAction: **${token.overallAction || token.decision}** | Setup: ${token.setupType}\nLiquidity: $${Math.round(token.liquidityUsd || 0).toLocaleString()} | 1h Vol: $${Math.round(token.volumeH1 || 0).toLocaleString()} | Buy Ratio: ${((token.buyRatio || 0)*100).toFixed(1)}%\nEntry Checklist: ${entry?.passed || 0}/${entry?.total || 0} (${entry?.entryQuality || 'n/a'}) | Exit Pressure: ${exit?.exitPressureLevel || 'n/a'} ${exit?.exitPressureScore ?? ''}\n${reasons}\n${warns}\n${token.dexUrl || ''}`;
}

export async function sendDiscordAlert(token) {
  if (!config.discordWebhookUrl) return { sent: false, reason: 'No webhook' };
  try { await axios.post(config.discordWebhookUrl, { content: alertText(token) }, { timeout: 10000 }); return { sent: true }; }
  catch (e) { return { sent: false, reason: e.message }; }
}

export function shouldAlert(token) {
  if (token.score < config.alertMinScore) return false;
  if (token.rugSignal === 'RED' || token.priceOnlyTrap) return false;
  if (token.entryChecklist && token.entryChecklist.score < 75) return false;
  if (token.exitPressure && token.exitPressure.exitPressureLevel === 'HIGH') return false;
  if (config.alertRequireAllGreen && !token.allGreen && token.confidenceLevel !== 'HIGH') return false;
  return true;
}
