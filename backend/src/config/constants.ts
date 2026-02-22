export const PORT = parseInt(process.env.PORT || '3001', 10);
export const DATA_SOURCE_PRIORITY = (process.env.DATA_SOURCE_PRIORITY || 'onchain').split(',');

export const NONCE_EXPIRY_MS = 5 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
