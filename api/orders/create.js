// File: api/orders/create.js
import crypto from 'node:crypto';
import { applySecurityHeaders, handleOptions, enforceRateLimit, generateSecureToken, hashToken } from '../../lib/security.js';
import { validateCustomerInput, validateOrderItemsInput } from '../../lib/validation.js';
import { getEnabledTlds, getServerDomainPrice, formatMinorCurrency } from '../../lib/pricing.js';
import { withTransaction } from '../../lib/db.js';

export default async function handler(req, res) {
  applySecurityHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!enforceRateLimit(req, res)) return;

  const body = req.body || {};
  const customerVal = validateCustomerInput(body.customer);
  if (!customerVal.valid) return res.status(400).json({ error: customerVal.error });

  const itemsVal = validateOrderItemsInput(body.items, getEnabledTlds());
  if (!itemsVal.valid) return res.status(400).json({ error: itemsVal.error });

  let subtotalMinor = 0;
  const pricedItems = [];
  for (const item of itemsVal.items) {
    const priceCalc = getServerDomainPrice(item.tld, item.periodYears);
    subtotalMinor += priceCalc.totalMinor;
    pricedItems.push({ ...item, unitPriceMinor: priceCalc.totalMinor, currency: priceCalc.currency });
  }

  let totalMinor = subtotalMinor;
  const coupon = String(body.couponCode || '').trim().toUpperCase();
  let appliedCoupon = null;

  if (coupon === 'NOVYX150' && totalMinor >= 190000) { totalMinor -= 15000; appliedCoupon = 'NOVYX150'; }
  else if (coupon === 'BUY3GET1' && pricedItems.length >= 4) {
    pricedItems.sort((a, b) => a.unitPriceMinor - b.unitPriceMinor);
    totalMinor -= Math.round(pricedItems[0].unitPriceMinor * 0.50);
    appliedCoupon = 'BUY3GET1';
  } else if (coupon === 'FREESSL50' && totalMinor >= 99900) { totalMinor -= 5000; appliedCoupon = 'FREESSL50'; }
  else if (coupon === 'FAST20') { totalMinor -= Math.min(10000, Math.round(totalMinor * 0.20)); appliedCoupon = 'FAST20'; }

  const orderNumber = `NVX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const orderAccessToken = generateSecureToken(24);
  const accessTokenHash = hashToken(orderAccessToken);

  const createdOrder = await withTransaction(async (client) => {
    const oRes = await client.query(
      `INSERT INTO orders (order_number, access_token_hash, customer_name, customer_email, customer_phone, customer_address, subtotal_minor, total_minor, payment_status, fulfillment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', 'unfulfilled') RETURNING id, order_number, total_minor, created_at`,
      [orderNumber, accessTokenHash, customerVal.customer.name, customerVal.customer.email, customerVal.customer.phone, JSON.stringify(customerVal.customer.address), subtotalMinor, totalMinor]
    );
    const orderRow = oRes.rows[0];
    for (const p of pricedItems) {
      const iRes = await client.query(
        `INSERT INTO order_items (order_id, item_type, item_identifier, period_years, unit_price_minor, currency, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [orderRow.id, p.itemType, p.itemIdentifier, p.periodYears, p.unitPriceMinor, p.currency, JSON.stringify({ coupon: appliedCoupon })]
      );
      await client.query(`INSERT INTO domain_registrations (order_id, order_item_id, domain_name, registrar_provider, registration_status) VALUES ($1, $2, $3, 'none', 'pending_payment')`, [orderRow.id, iRes.rows[0].id, p.itemIdentifier]);
    }
    return orderRow;
  });

  return res.status(201).json({ status: 'created', order: { id: createdOrder.id, orderNumber, orderAccessToken, totalMinor, formattedTotal: formatMinorCurrency(totalMinor), appliedCoupon, items: pricedItems } });
}
