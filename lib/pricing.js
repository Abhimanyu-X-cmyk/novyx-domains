// File: lib/pricing.js
const CATALOG = {
  'com': { registerMinor: 99900, renewMinor: 119900, currency: 'INR' },
  'in': { registerMinor: 59900, renewMinor: 69900, currency: 'INR' },
  'co.in': { registerMinor: 49900, renewMinor: 59900, currency: 'INR' },
  'ai': { registerMinor: 749900, renewMinor: 749900, currency: 'INR' }
};

export function getEnabledTlds() { return Object.keys(CATALOG); }

export function getServerDomainPrice(tld, periodYears = 1) {
  const entry = CATALOG[tld] || CATALOG['com'];
  const total = periodYears === 1 ? entry.registerMinor : entry.registerMinor + entry.renewMinor * (periodYears - 1);
  return { currency: entry.currency, unitPriceMinor: entry.registerMinor, totalMinor: total, formattedPrice: `₹${(total / 100).toFixed(2)}` };
}
