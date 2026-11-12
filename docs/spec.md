# Live Build Practice Plan: Nomba Webhooks with the Node SDK

Nov 12, 2026 · @Favour

## What you're building

On Friday 13 November at 4 pm WAT you build one Express server, about 70 lines, that sends sandbox transfers with the Nomba Node SDK and receives their webhooks safely. Each part of the build ends in a moment the audience can see:

1. **Setup:** three lines create the SDK client, and token handling disappears.
2. **Pending, then paid:** a transfer to `0000000201` lands in `onPending`, then a `payout_success` webhook marks it paid.
3. **Refund:** a transfer to `0000000202` gets a `payout_refund`, and you retry with a new `merchantTxRef`.
4. **Fake webhook:** a forged event with a made-up signature gets a `401`.
5. **Missed webhook:** an outage switch makes deliveries fail, then `eventLogs()` and `repush()` recover them, and a second repush is ignored.

**Use Express.** Two things decide it. Nomba's SDK readme shows its webhook example in Express, so what you type matches what attendees will read afterwards. And Express is the framework most Node developers have already used, so nobody has to learn a framework while learning webhooks. Fastify would work just as well: `verifyWebhook` accepts the parsed body, so neither framework needs raw-body handling.

I ran the webhook half of this server on Node 22 with a self-signed test event. The forged event got a `401`, the signed one a `200`, the duplicate was ignored, and the outage switch returned `503`. The transfer half needs your sandbox keys, so your first rehearsal is its first real test.

## Before the day

Do all of this before your first rehearsal, so the live session starts from an empty `server.js` and never waits on an install.

- [ ] **Node 22 or later.** Run `node -v`. The SDK requires 22, and you'll use two of its built-in flags: `--env-file` and `--watch`.
- [ ] **Project folder.** Run these once, off stream:

```bash
mkdir nomba-webhooks && cd nomba-webhooks
npm init -y
npm pkg set type=module
npm install express @nomba/node-sdk
```

- [ ] **Sandbox credentials.** From the dashboard, copy the sandbox client ID, client secret and account ID. Production keys fail against the sandbox.
- [ ] **`.env` file** in the project folder. Never open it on screen:

```bash
NOMBA_CLIENT_ID=...
NOMBA_CLIENT_SECRET=...
NOMBA_ACCOUNT_ID=...
NOMBA_WEBHOOK_SECRET=...
```

- [ ] **Tunnel.** Nomba can't reach `localhost`. Install ngrok (or cloudflared) and run `ngrok http 3000`. Use a fixed domain if your plan offers one, so the dashboard URL survives restarts.
- [ ] **Dashboard webhook.** Under Developer, then Webhook Setup, set the URL to `https://<your-tunnel>/nomba/webhook`, set the signature key (the same value as `NOMBA_WEBHOOK_SECRET`), and subscribe to `payout_success`, `payout_failed` and `payout_refund`. Check whether the sandbox has its own webhook settings.
- [ ] **Bank code for the test accounts.** The transfer docs list the test account numbers. Confirm which bank code goes with them; the plan uses `058` as a placeholder.
- [ ] **Commands file.** Put the `curl` commands from the build steps in `commands.sh` in a second window. Pasting a request is fine; the server code is what you type live.
- [ ] **Forged event file.** Save `fake-event.json` with any made-up `payout_success` body for moment 4.
- [ ] **Screen layout.** Editor on the left at 18 pt or larger. Two terminals on the right: one for server logs, one for `curl`. Keep ngrok's terminal and `.env` on another desktop.

## The build, step by step

Seven steps, each ending in a check you run before moving on. Type the code; paste the `curl` commands from `commands.sh`. Each step adds to the same `server.js`.

### Step 1: a server that answers (3 min)

Start the server in terminal 1 with `node --env-file=.env --watch server.js`. `--watch` restarts it every time you save, so you never restart by hand.

```js
import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("ok"));

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

**Say:** we're using Express 5, which passes errors from `async` routes to its error handler, so we don't need try/catch everywhere.

**Check:** `curl localhost:3000` returns `ok`.

### Step 2: the SDK client (4 min)

Add the import at the top and the client under it, then a route that proves the keys work.

```js
import { Nomba } from "@nomba/node-sdk";

const nomba = new Nomba({
  clientId: process.env.NOMBA_CLIENT_ID,
  clientSecret: process.env.NOMBA_CLIENT_SECRET,
  accountId: process.env.NOMBA_ACCOUNT_ID,
  environment: "sandbox",
});

app.get("/banks", async (req, res) => {
  const banks = await nomba.transfers.listBanks();
  res.json(banks.slice(0, 5));
});
```

**Say:** this call needs an access token, and we never asked for one. The SDK issues it and refreshes it before the 30 minutes run out. That was step 1 of the transfer series, and it's gone. Also point at `environment: "sandbox"`: the default is production.

**Check:** `curl localhost:3000/banks` returns five banks with a `code` each.

### Step 3: send a transfer (7 min)

```js
import { randomUUID } from "node:crypto";

const transfers = {}; // merchantTxRef -> status

app.get("/transfers", (req, res) => res.json(transfers));

app.post("/transfers", async (req, res) => {
  const merchantTxRef = randomUUID();

  const status = await nomba.transfers.bankTransfer(
    {
      amount: 1000,
      accountNumber: req.body.accountNumber,
      accountName: "Test Account",
      bankCode: "058",
      merchantTxRef,
    },
    {
      onSuccess: () => "paid",
      onPending: () => "pending",
      onFailed: ({ code }) => `failed (${code})`,
    },
  );

  transfers[merchantTxRef] = status;
  res.json({ merchantTxRef, status });
});
```

**Say:** three outcomes, and the SDK makes you decide what each one means. The call returns whatever the matching closure returns. Leave out `onPending` and a `201` throws, so a pending transfer can never pass as paid. That's Tuesday's tip, built in.

**Check:** `curl -X POST localhost:3000/transfers -H "content-type: application/json" -d '{"accountNumber":"0123456789"}'` returns `paid` (any number other than the test accounts succeeds in the sandbox).

**Optional, 1 min:** delete the `merchantTxRef,` line, save, and send again. The SDK throws `IdempotencyKeyAbsentError` and refuses to send. Put the line back.

### Step 4: receive and verify webhooks (6 min)

Add `verifyWebhook` to the SDK import, then the route.

```js
import { Nomba, verifyWebhook } from "@nomba/node-sdk";

app.post("/nomba/webhook", (req, res) => {
  const ok = verifyWebhook(
    req.body,
    req.header("nomba-signature"),
    req.header("nomba-timestamp"),
    process.env.NOMBA_WEBHOOK_SECRET,
  );
  if (!ok) {
    console.log("rejected: bad signature");
    return res.sendStatus(401);
  }

  console.log("webhook:", req.body.event_type);
  res.sendStatus(200);
});
```

**Say:** anyone who finds this URL can post to it. The signature is an HMAC of fields in the event plus the timestamp header, made with a key only you and Nomba know. Part 5 of the series took 20 lines to check it; here it's one call.

**Check (moment 4, the fake webhook):** `curl -i -X POST localhost:3000/nomba/webhook -H "content-type: application/json" -H "nomba-signature: fake" -H "nomba-timestamp: 123" -d @fake-event.json` returns `401`, and the log says `rejected`.

### Step 5: act on the event, once (7 min)

Replace the last two lines of the webhook route (the `console.log` and `res.sendStatus(200)`) with this, and add `handle` below the route.

```js
const seen = new Set(); // put this next to `transfers`

  // inside the route, after the signature check:
  const event = req.body;
  const id = `${event.event_type}:${event.data?.transaction?.transactionId}`;
  if (seen.has(id)) {
    console.log("duplicate ignored:", id);
    return res.sendStatus(200);
  }
  seen.add(id);
  res.sendStatus(200);
  handle(event);

function handle(event) {
  const ref = event.data?.transaction?.merchantTxRef;
  console.log(event.event_type, ref);
  if (event.event_type === "payout_success") transfers[ref] = "paid";
  if (event.event_type === "payout_refund") transfers[ref] = "refunded";
}
```

**Say:** answer with a 2XX fast, then do the work. Nomba retries anything else, so the same event can arrive more than once, and `seen` makes sure we act on it once.

**Check (moment 2, pending then paid):** send to `0000000201`. The response says `pending`. About 5 seconds later the log shows `payout_success`, and `curl localhost:3000/transfers` shows it as `paid`.

**Rehearsal note:** I don't know for certain where `merchantTxRef` sits in a real payout webhook. In your first rehearsal, add `console.log(JSON.stringify(event, null, 2))` to `handle`, find the reference, and fix the `ref` line to match.

### Step 6: a refund (4 min)

No new code.

**Check (moment 3):** send to `0000000202`. It goes `pending`, then `payout_refund` arrives and it shows `refunded`. Send the transfer again: the route makes a fresh `merchantTxRef`, which is correct now.

**Say:** only a verified `payout_refund` means the money came back. Never refund your customer on `payout_failed`. And a new reference is safe only after a refund; while a transfer is pending, keep the old one.

### Step 7: recover a missed webhook (8 min)

Add an outage switch and two troubleshooting routes.

```js
let outage = false;

app.post("/outage", (req, res) => {
  outage = !outage;
  res.json({ outage });
});

  // first lines inside the webhook route:
  if (outage) {
    console.log("outage: webhook refused");
    return res.sendStatus(503);
  }

app.get("/webhook-logs", async (req, res) => {
  const logs = await nomba.webhooks.eventLogs({ limit: 5 });
  res.json(logs.list);
});

app.post("/webhook-logs/:id/repush", async (req, res) => {
  await nomba.webhooks.repush(req.params.id);
  res.json({ repushed: req.params.id });
});
```

**Check (moment 5):**

1. `curl -X POST localhost:3000/outage` turns the outage on.
2. Send to `0000000201`. The log shows `outage: webhook refused`.
3. Turn the outage off the same way.
4. `curl localhost:3000/webhook-logs` shows the failed delivery with `responseHttpStatus: 503` and a `hookRequestId`.
5. `curl -X POST localhost:3000/webhook-logs/<hookRequestId>/repush`. The webhook arrives and the transfer shows `paid`.
6. Repush the same ID again. The log says `duplicate ignored`.

**Say:** servers go down. Nomba retries on its own, starting after about 2 minutes, and these two calls let you check and resend without waiting. If Nomba's own retry lands during the demo, point it out: it's the dedupe working.

## Run of show

The build takes about 39 minutes of the 45, leaving 6 for welcome and questions. If you fall behind, skip the optional `merchantTxRef` demo in step 3 first, then step 6.

| Clock | Step | What the audience sees |
| --- | --- | --- |
| 0:00 | Welcome | Who's here, by name; what you'll build; everything runs in the sandbox |
| 0:03 | 1. Server | `ok` in the browser |
| 0:06 | 2. SDK client | Banks listed, no token code written |
| 0:10 | 3. Transfer | A transfer comes back `paid` |
| 0:17 | 4. Verify | A fake webhook gets `401` |
| 0:23 | 5. Act once | `0000000201` goes pending, then paid |
| 0:30 | 6. Refund | `0000000202` comes back refunded |
| 0:34 | 7. Recovery | A missed webhook is repushed; the second repush is ignored |
| 0:42 | Close | Questions; the code goes in the thread; Monday's poll for next week |

## If something breaks live

Say what happened out loud. Debugging in front of people is part of what they came to see.

| What breaks | What you'll see | What to do |
| --- | --- | --- |
| Typo in your code | `--watch` prints a stack trace and waits | Read the line number aloud, fix it, save |
| Wrong or production keys | A `TokenError` on `/banks` | Check `environment: "sandbox"` and that `.env` holds the sandbox pair |
| Webhook never arrives | Transfer stays `pending`; no log line | Check the ngrok terminal for a request. None: the dashboard URL is wrong or the tunnel restarted. Then use the fallback below |
| Every webhook gets `401` | `rejected` on real events | The dashboard signature key and `NOMBA_WEBHOOK_SECRET` differ. Copy it again, then stop and restart the server so it reads `.env` again |
| `ref` is `undefined` in `handle` | Log shows the event but `/transfers` doesn't change | The reference sits elsewhere in the payload. Log the whole event and fix the path |
| `eventLogs` or `repush` fails in the sandbox | An error on `/webhook-logs` | Skip step 7. Say Nomba also retries on its own, and show the code anyway |
| Sandbox is down | Errors on every call | Switch to the saved-payload fallback |

**Saved-payload fallback.** In rehearsal, log one real signed webhook with its headers and save it as `real-event.json`. If Nomba's side fails live, replay it with `curl` and the saved `nomba-signature` and `nomba-timestamp`. It still passes verification, and a second replay still shows the dedupe. Tell the audience it's a recorded event.

## Practice schedule

Three rehearsals between now and Friday afternoon. Each one starts from an empty `server.js`.

- [ ] **Rehearsal 1, Thursday evening: make it work (about 90 min).** Follow this doc line by line against the real sandbox. Settle the open points as you go:
  - [ ] Where `merchantTxRef` sits in a real payout webhook; fix the `ref` line
  - [ ] Which bank code goes with the test account numbers
  - [ ] Whether `eventLogs` and `repush` work in the sandbox, and the order `eventLogs` lists events in
  - [ ] Save `real-event.json` with its headers for the fallback
  - [ ] Send the same `merchantTxRef` twice and note the response. The SDK readme says it's a suspected duplicate; if the sandbox agrees, that answers the transfer series' open question on stream
- [ ] **Rehearsal 2, Friday morning: from memory (about 45 min).** Build it without this doc open, with a timer running. Note where you stalled. Most people stall on the closures in step 3 and the routes in step 7, so type those twice more afterwards.
- [ ] **Rehearsal 3, Friday around 1 pm: dress rehearsal (45 min).** Screen share to yourself or a colleague and record it. Talk through every step as if people were there. Watch the recording once for font size and anything secret on screen.
- [ ] **Friday 3:30 pm: set up.** Tunnel running, dashboard URL checked, empty `server.js` open, `commands.sh` in its window, `.env` closed, sandbox balance checked, recording ready.

## Finished code

Check your rehearsal against this after you finish, not during. It's the whole of `server.js` at the end of step 7, with routes in a tidier order than you'll type them. It ran on Node 22 with Express 5.3 and SDK 0.6.0: the webhook routes passed with a self-signed event, and the transfer route reached the SDK, which could only fail at the token step because my test machine can't reach Nomba.

```js
import express from "express";
import { randomUUID } from "node:crypto";
import { Nomba, verifyWebhook } from "@nomba/node-sdk";

const nomba = new Nomba({
  clientId: process.env.NOMBA_CLIENT_ID,
  clientSecret: process.env.NOMBA_CLIENT_SECRET,
  accountId: process.env.NOMBA_ACCOUNT_ID,
  environment: "sandbox",
});

const app = express();
app.use(express.json());

const transfers = {}; // merchantTxRef -> status
const seen = new Set(); // webhook events already handled
let outage = false;

app.get("/", (req, res) => res.send("ok"));

app.get("/banks", async (req, res) => {
  const banks = await nomba.transfers.listBanks();
  res.json(banks.slice(0, 5));
});

app.get("/transfers", (req, res) => res.json(transfers));

app.post("/transfers", async (req, res) => {
  const merchantTxRef = randomUUID();

  const status = await nomba.transfers.bankTransfer(
    {
      amount: 1000,
      accountNumber: req.body.accountNumber,
      accountName: "Test Account",
      bankCode: "058",
      merchantTxRef,
    },
    {
      onSuccess: () => "paid",
      onPending: () => "pending",
      onFailed: ({ code }) => `failed (${code})`,
    },
  );

  transfers[merchantTxRef] = status;
  res.json({ merchantTxRef, status });
});

app.post("/nomba/webhook", (req, res) => {
  if (outage) {
    console.log("outage: webhook refused");
    return res.sendStatus(503);
  }

  const ok = verifyWebhook(
    req.body,
    req.header("nomba-signature"),
    req.header("nomba-timestamp"),
    process.env.NOMBA_WEBHOOK_SECRET,
  );
  if (!ok) {
    console.log("rejected: bad signature");
    return res.sendStatus(401);
  }

  const event = req.body;
  const id = `${event.event_type}:${event.data?.transaction?.transactionId}`;
  if (seen.has(id)) {
    console.log("duplicate ignored:", id);
    return res.sendStatus(200);
  }
  seen.add(id);
  res.sendStatus(200);
  handle(event);
});

function handle(event) {
  const ref = event.data?.transaction?.merchantTxRef; // confirm this path in rehearsal 1
  console.log(event.event_type, ref);
  if (event.event_type === "payout_success") transfers[ref] = "paid";
  if (event.event_type === "payout_refund") transfers[ref] = "refunded";
}

app.post("/outage", (req, res) => {
  outage = !outage;
  res.json({ outage });
});

app.get("/webhook-logs", async (req, res) => {
  const logs = await nomba.webhooks.eventLogs({ limit: 5 });
  res.json(logs.list);
});

app.post("/webhook-logs/:id/repush", async (req, res) => {
  await nomba.webhooks.repush(req.params.id);
  res.json({ repushed: req.params.id });
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
```

## Sources

- `@nomba/node-sdk` 0.6.0: its README and the type definitions for transfers, outcomes and webhooks, read from the package on npm ([npm page](https://www.npmjs.com/package/@nomba/node-sdk))
- [Nomba transfer-to-banks docs](https://developer.nomba.com/docs/products/transfers/transfer-to-banks): sandbox test accounts and statuses
- [Nomba webhook docs](https://developer.nomba.com/docs/api-basics/webhook): events, signature headers and retries