// File: lib/registrar.js
import { getServerDomainPrice } from './pricing.js';

export function getConfiguredRegistrar() { return { provider: 'none', configured: false }; }

export async function checkDomainAvailability(domain, tld) {
  return { domain, tld, mode: 'unconfigured', available: true, price: getServerDomainPrice(tld) };
}

export async function executeDomainRegistration() {
  return { success: false, status: 'manual_intervention_required' };
}
