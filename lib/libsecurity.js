// File: lib/security.js
export function applySecurityHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function enforceRateLimit(req, res) {
  return true; // Simplified for initial setup
}

export function safeLog(level, msg, meta = {}) {
  console.log(JSON.stringify({ level, msg, ...meta }));
}

