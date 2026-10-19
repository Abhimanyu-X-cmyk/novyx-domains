// File: api/domains/search.js
import { applySecurityHeaders, handleOptions, enforceRateLimit, safeLog } from '../../lib/security.js';
import { validateDomainInput } from '../../lib/validation.js';
import { getEnabledTlds, getServerDomainPrice } from '../../lib/pricing.js';

export default async function handler(req, res) {
  applySecurityHeaders(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  if (!enforceRateLimit(req, res, { keyPrefix: 'domain-search', limit: 30, windowMs: 60_000 })) {
    return;
  }

  const rawDomain = req.query?.domain;
  const enabledTlds = getEnabledTlds();

  const validation = validateDomainInput(rawDomain, enabledTlds);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      enabledExtensions: enabledTlds.map((t) => `.${t}`)
    });
  }

  try {
    const price = getServerDomainPrice(validation.tld, 1);

    return res.status(200).json({
      status: 'ok',
      domain: validation.domain,
      tld: validation.tld,
      available: true,
      price
    });
  } catch (error) {
    safeLog('error', 'Domain search error', { domain: validation.domain, error: error.message });
    return res.status(502).json({
      error: 'Unable to check domain availability.',
      details: error.message
    });
  }
}
