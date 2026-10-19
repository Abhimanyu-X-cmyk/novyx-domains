// File: lib/payments.js
import crypto from 'node:crypto';
import { timingSafeEqualStr } from './security.js';

export function getConfiguredPaymentProvider() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  return {
    provider: 'razorpay',
    configured: Boolean(keyId && keySecret && webhookSecret),
    missingVars: [!keyId && 'RAZORPAY_KEY_ID', !keySecret && 'RAZORPAY_KEY_SECRET', !webhookSecret && 'RAZORPAY_WEBHOOK_SECRET'].filter(Boolean)
  };
}

export async function createPaymentSession({ orderId, orderNumber, amountMinor, currency = 'INR', customerEmail, customerName, customerPhone }) {
  const gateway = getConfiguredPaymentProvider();
  if (!gateway.configured) throw new Error('Razorpay unconfigured.');
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
    body: JSON.stringify({ amount: amountMinor, currency, receipt: orderNumber, notes: { novyx_order_id: orderId } })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.description || 'Razorpay order failed.');
  
  return {
    provider: 'razorpay',
    sessionId: data.id,
    clientConfig: {
      key: process.env.RAZORPAY_KEY_ID,
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      name: 'NOVYX Domains',
      prefill: { name: customerName, email: customerEmail, contact: customerPhone },
      method: { upi: true, emi: true, paylater: true, card: true }
    }
  };
}

export function verifyAndParseWebhook({ rawBody, headers }) {
  const sig = headers['x-razorpay-signature'];
  if (!sig) return { valid: false, statusCode: 400, error: 'Missing signature.' };
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  if (!timingSafeEqualStr(sig, expected)) return { valid: false, statusCode: 400, error: 'Invalid signature.' };
  
  const payload = JSON.parse(rawBody);
  const payment = payload?.payload?.payment?.entity;
  if (!payment) return { valid: false, statusCode: 400, error: 'Invalid payload.' };
  
  return {
    valid: true,
    provider: 'razorpay',
    eventId: payload.id || `evt_${payment.id}`,
    eventType: payload.event,
    isPaidEvent: payload.event === 'payment.captured' || payment.status === 'captured',
    orderId: payment.notes?.novyx_order_id,
    providerSessionId: payment.order_id,
    paymentReference: payment.id,
    paymentMethod: payment.method || 'unknown',
    amountMinor: Number(payment.amount),
    currency: String(payment.currency || 'INR').toUpperCase()
  };
}
