// Builds a sample payment_success event, signs it the way Nomba does, and POSTs it to the
// locally-running server — so you can see verifyWebhook() accept a real signature without
// waiting for Nomba to actually send one.
//
// Usage: npm run test:webhook                    (valid signature, expect 200)
//        npm run test:webhook -- --bad-signature (tampered signature, expect 401)
// (server must already be running via `npm run dev`)
const useBadSignature = process.argv.includes('--bad-signature');
import { createHmac } from 'node:crypto';
import { NOMBA_WEBHOOK_SECRET } from '../src/config/env.config.ts';

const PORT = process.env.PORT ?? '43902';
const URL = `http://localhost:${PORT}/v1/webhooks/nomba`;

const event = {
    event_type: 'payment_success',
    requestId: `test-${Date.now()}`,
    data: {
        merchant: { userId: 'test-user', walletId: 'test-wallet' },
        transaction: {
            transactionId: `txn-${Date.now()}`,
            type: 'bank_transfer',
            time: new Date().toISOString(),
            responseCode: '00',
        },
    },
};

// Same signing string verifyWebhook() checks against: see @nomba/node-sdk's lib/webhooks.js.
const timestamp = String(Date.now());
const merchant = event.data.merchant;
const tx = event.data.transaction;
const signed = [
    event.event_type,
    event.requestId,
    merchant.userId,
    merchant.walletId,
    tx.transactionId,
    tx.type,
    tx.time,
    tx.responseCode,
    timestamp,
].join(':');
const validSignature = createHmac('sha256', NOMBA_WEBHOOK_SECRET).update(signed).digest('base64');
// Flip a character so it's the right shape but won't match — same as a wrong/rotated secret would produce.
const signature = useBadSignature ? validSignature.slice(0, -1) + (validSignature.at(-1) === 'A' ? 'B' : 'A') : validSignature;

if (useBadSignature) {
    console.log('Sending with a tampered signature — expect a 401.');
}

const body = JSON.stringify(event);
const response = await fetch(URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'nomba-signature': signature,
        'nomba-timestamp': timestamp,
    },
    body,
});

console.log(`${response.status} ${response.statusText}`);
console.log(await response.text());
