// File: api/payments/webhook.js
import { applySecurityHeaders } from '../../lib/security.js';
import { withTransaction } from '../../lib/db.js';
import { verifyAndParseWebhook } from '../../lib/payments.js';

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  applySecurityHeaders(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const rawBody = await readRaw(req);
  const verified = verifyAndParseWebhook({ rawBody, headers: req.headers });
  if (!verified.valid) return res.status(verified.statusCode || 400).json({ error: verified.error });

  await withTransaction(async (client) => {
    await client.query(`INSERT INTO payment_webhook_events (provider, event_id, event_type, order_id, payload_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [verified.provider, verified.eventId, verified.eventType, verified.orderId, 'hash']);
    if (verified.isPaidEvent) {
      await client.query(`UPDATE orders SET payment_status = 'paid', payment_method = $1, payment_reference = $2, fulfillment_status = 'completed' WHERE id = $3`, [verified.paymentMethod, verified.paymentReference, verified.orderId]);
    }
  });
  return res.status(200).json({ status: 'processed' });
}
