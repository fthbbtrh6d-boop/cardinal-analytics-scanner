import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8787),
  scanIntervalMinutes: Number(process.env.SCAN_INTERVAL_MINUTES || 5),
  minLiquidityUsd: Number(process.env.MIN_LIQUIDITY_USD || 15000),
  maxLiquidityUsd: Number(process.env.MAX_LIQUIDITY_USD || 100000),
  maxTokenAgeHours: Number(process.env.MAX_TOKEN_AGE_HOURS || 72),
  minTokenAgeMinutes: Number(process.env.MIN_TOKEN_AGE_MINUTES || 5),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  heliusApiKey: process.env.HELIUS_API_KEY || '',
  birdeyeApiKey: process.env.BIRDEYE_API_KEY || '',
  enableAutoAlerts: String(process.env.ENABLE_AUTO_ALERTS || 'false') === 'true',
  alertMinScore: Number(process.env.ALERT_MIN_SCORE || 85),
  alertRequireAllGreen: String(process.env.ALERT_REQUIRE_ALL_GREEN || 'true') === 'true'
};
