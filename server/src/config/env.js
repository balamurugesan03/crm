import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5730').replace(/\/$/, '');

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crm_saas',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  portalSecret: process.env.PORTAL_SECRET || `${process.env.JWT_ACCESS_SECRET}::portal`,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  // Full public URL of the app, including any sub-path: https://unizova.com/crm
  clientUrl,
  // Browsers send Origin as scheme + host only, so CORS must compare against that.
  corsOrigin: new URL(clientUrl).origin,
  // Public sub-path the API sits under ('' or '/crm'); cookie paths must match what the browser sees.
  basePath: new URL(clientUrl).pathname.replace(/\/$/, ''),
  // Number of reverse proxies in front of Node (Nginx = 1) so req.ip / rate limits use the real client IP.
  trustProxy: Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'claude-opus-5-5',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER || '',
    pro: process.env.STRIPE_PRICE_PRO || '',
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
  },
};

export const isStripeConfigured = Boolean(env.stripeSecretKey && env.stripePrices.starter && env.stripePrices.pro);

// Refuse to boot production with missing or placeholder secrets.
export function assertProductionConfig() {
  if (env.nodeEnv !== 'production') return;
  const problems = [];
  const weak = (v) => !v || v.length < 32 || /change_this|secret|example/i.test(v);
  if (weak(env.jwtAccessSecret)) problems.push('JWT_ACCESS_SECRET must be a random string of 32+ characters');
  if (weak(env.jwtRefreshSecret)) problems.push('JWT_REFRESH_SECRET must be a random string of 32+ characters');
  if (env.jwtAccessSecret && env.jwtAccessSecret === env.jwtRefreshSecret) problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  if (process.env.PORTAL_SECRET && weak(process.env.PORTAL_SECRET)) problems.push('PORTAL_SECRET must be a random string of 32+ characters');
  if (!clientUrl.startsWith('https://')) problems.push('CLIENT_URL must be the public https:// URL, e.g. https://unizova.com/crm');
  if (problems.length) {
    console.error(`[config] Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
}
