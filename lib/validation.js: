// File: lib/validation.js
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateDomainInput(rawDomain, allowedTlds = ['com', 'in', 'co.in', 'ai']) {
  if (typeof rawDomain !== 'string') return { valid: false, error: 'Domain must be a string.' };
  const cleaned = rawDomain.trim().toLowerCase();
  const parts = cleaned.split('.');
  if (parts.length < 2) return { valid: false, error: 'Domain must include an extension (e.g., example.com).' };
  const [sld, tld] = parts.length === 2 ? parts : [parts[0], 'co.in'];
  if (!LABEL_REGEX.test(sld)) return { valid: false, error: 'Invalid domain label format.' };
  if (!allowedTlds.includes(tld)) return { valid: false, error: `Extension .${tld} is not supported.` };
  return { valid: true, domain: `${sld}.${tld}`, sld, tld };
}
