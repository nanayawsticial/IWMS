function getSecret(name, fallback) {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }

  return fallback;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return Boolean(value);
}

function currentTimeHHMM() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function diffHoursHHMM(start, end) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return parseFloat((diff / 60).toFixed(2));
}

function toMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const crypto = require('crypto');

/**
 * Hash a plain-text device API key with SHA-256.
 * @param {string} apiKey
 * @returns {string} hex digest
 */
function hashDeviceApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Timing-safe comparison of an incoming plain-text key against the stored hash.
 * @param {string|undefined} apiKey   raw key from the X-Device-Key header
 * @param {string|null}      storedHash  SHA-256 hex stored on the device record
 * @returns {boolean}
 */
function isValidDeviceApiKey(apiKey, storedHash) {
  if (!apiKey || !storedHash) return false;
  const incomingHash = hashDeviceApiKey(apiKey);
  const incoming = Buffer.from(incomingHash, 'hex');
  const stored   = Buffer.from(storedHash,   'hex');
  if (incoming.length !== stored.length) return false;
  return crypto.timingSafeEqual(incoming, stored);
}

module.exports = { getSecret, parseBoolean, currentTimeHHMM, diffHoursHHMM, hashDeviceApiKey, isValidDeviceApiKey };

