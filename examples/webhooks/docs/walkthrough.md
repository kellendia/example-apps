# Codebase Walkthrough

This document explains how `webhooks-playground` is put together: the directory
structure, what each file does, and how a single request actually travels
through the app from the socket to the response. It describes the code as it
exists today, not the live-demo build plan in [`spec.md`](./spec.md) (that's a
separate, from-scratch version of this same idea for a 45-minute talk).

## What this app is

A small Express server around the [`@nomba/node-sdk`](https://developer.nomba.com)
that does two things:

1. **Sends money** — looks up a bank account, then initiates a bank transfer.
2. **Receives webhooks** — verifies and handles the asynchronous events Nomba
   sends back about those transfers (success, pending, refund, etc).

It runs directly as TypeScript. There is no build step: Node 24's native
TypeScript support strips the types at run time (see [Why `.ts` imports and
no build step](#why-ts-imports-and-no-build-step) below).

## Directory structure

```
webhooks-playground/
├── .env.example            # template for the env vars the app needs
├── package.json
├── tsconfig.json
├── docs/
│   ├── spec.md              # live-demo build plan (separate doc)
│   └── walkthrough.md       # this file
└── src/
    ├── main.ts               # entry point: boots the HTTP server
    ├── app.setup.ts          # builds the Express app: middleware + routes
    ├── config/
    │   └── env.config.ts     # loads and validates environment variables
    ├── common/                       # cross-cutting, reusable code
    │   ├── interceptor.response.ts   # shared success/error JSON envelopes
    │   ├── validator.request.ts      # generic zod-validation middleware
    │   └── transfer.hooks.ts         # outcome callbacks for bankTransfer()
    └── modules/                      # one folder per domain/feature
        ├── nomba.ts                  # the shared, configured SDK client
        ├── transfer/
        │   ├── transfer.controller.ts  # HTTP layer: req/res, validation
        │   └── transfer.service.ts     # business logic: talks to the SDK
        └── webhooks/
            ├── webhook.controller.ts   # HTTP layer: verify + respond
            └── webhook.service.ts      # business logic: what an event means
```

The pattern repeating under `modules/` is **controller → service**:

- A **controller** only knows about HTTP — it reads `req`, calls a service,
  and shapes `res`. It never talks to the SDK directly.
- A **service** only knows about the domain — it calls `nomba.*` and returns
  plain data or throws. It never touches `req`/`res`.

This split is what lets `transfer.service.ts` be reused from the webhook
dispatch in `transfer.hooks.ts` without dragging Express into it, and it's
what makes each layer independently testable.

## File by file

### `src/main.ts` — entry point

```ts
import { PORT } from './config/env.config.ts';
import app, { listRoutes } from './app.setup.ts';

const bootstrap = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log('Available routes:');
            for (const route of listRoutes()) {
                console.log(`  ${route}`);
            }
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

bootstrap();
```

The only file that's allowed to start the server. It imports the fully
assembled `app` from `app.setup.ts`, starts listening on `PORT` (validated in
`env.config.ts`), and prints every registered route so you can see the API
surface the moment the process boots — no need to grep the route files.

### `src/config/env.config.ts` — environment

```ts
const envSchema = z.object({
  PORT: z.coerce.number().default(43902),
  NOMBA_ACCOUNT_ID: z.string(),
  NOMBA_CLIENT_ID: z.string(),
  NOMBA_CLIENT_SECRET: z.string(),
  NOMBA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  NOMBA_WEBHOOK_SECRET: z.string(),
});

config(); // dotenv: populates process.env from .env

export const { PORT, NOMBA_ACCOUNT_ID, ... } = envSchema.parse(process.env);
```

Every other file imports its config from *here*, never from `process.env`
directly. `envSchema.parse()` means a missing or malformed env var is a loud
crash at boot (`ZodError`), not a silent `undefined` surfacing three layers
deep at request time. `dotenv`'s `config()` is what reads `.env` into
`process.env` in the first place — it's redundant with `--env-file=.env`
(which `npm start`/`npm run dev` already pass to `node`), but keeps this file
self-sufficient if you ever run it another way.

### `src/modules/nomba.ts` — the SDK client

```ts
const nomba = new Nomba({
    accountId: NOMBA_ACCOUNT_ID,
    clientId: NOMBA_CLIENT_ID,
    clientSecret: NOMBA_CLIENT_SECRET,
    environment: NOMBA_ENVIRONMENT,
});

export default nomba;
```

One `Nomba` instance, constructed once, exported as a singleton. It handles
token issuance/refresh internally, so every service just imports this default
export and calls `nomba.transfers.*`, `nomba.requery.*`, etc. — nobody else
constructs a client.

### `src/common/interceptor.response.ts` — response shape

Two small helpers so every endpoint answers in the same envelope:

```ts
returnSuccessResponse(res, data, statusCode = 200)
// -> { message, timestamp, status: 'success', data }

returnErrorResponse(res, error, req)
// -> { message, timestamp, path, method, error: { message, stack } }
```

`returnErrorResponse` reads `error.statusCode ?? error.status ?? 500` — those
are the properties `http-errors` (and the SDK's `NombaError`) set — so a
`BadRequest` genuinely answers `400` and an `Unauthorized` answers `401`,
instead of everything collapsing to `500`.

### `src/common/validator.request.ts` — generic validation middleware

```ts
export const validateRequest = (schema: z.ZodType<any, any, any>) => {
    return async (req, res, next) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            returnErrorResponse(res, new BadRequest(...), req);
        }
    }
}
```

A factory: give it a zod schema, get back an Express middleware. On success it
*replaces* `req.body` with the parsed/coerced value and calls `next()`. On
failure it writes the 400 itself and does **not** call `next()`, so the route
handler after it never runs with bad data.

Note the import style:

```ts
import createHttpError from 'http-errors';
const { BadRequest } = createHttpError;
```

`http-errors` is a CommonJS package that builds its named error classes
(`BadRequest`, `Unauthorized`, …) dynamically at runtime rather than as
static `module.exports.X = …` assignments. Node's CJS/ESM interop can't see
those as "named exports" statically, so `import { BadRequest } from
'http-errors'` fails at runtime with "does not provide an export named
`BadRequest`". Importing the default and destructuring at runtime sidesteps
that.

### `src/common/transfer.hooks.ts` — outcome handlers

The Nomba SDK forces every money-moving call to resolve to exactly one of
three outcomes — `success`, `pending`, `failed` — via closures you pass in.
This file is where this app's answers to "what do we do for each outcome"
live, decoupled from the service that triggers the transfer:

```ts
export const onSuccessHook = (result: BankTransferResult) => { ...; return result; };
export const onPendingHook = (info: PendingInfo<BankTransferResult>) => { ...; return info.data; };
export const onFailedHook  = (info: FailedInfo<BankTransferResult>) => { ...; return undefined; };
```

Right now they log and return. The real business logic (persist the
transfer, notify someone, schedule a requery) is marked `TODO` — this is the
one place in the app where there's a genuine product decision to make, not a
plumbing bug to fix.

### `src/modules/transfer/transfer.service.ts` — transfer business logic

```ts
export const listAvailableBanks = async () => { ... }         // nomba.transfers.listBanks()
export const lookupBankAccount = async (accountNumber, bankCode) => { ... } // nomba.transfers.lookupBankAccount()

export const initiateTransfer = async (transferData: BankTransferParams) => {
    return nomba.transfers.bankTransfer(transferData, {
        onSuccess: onSuccessHook,
        onPending: onPendingHook,
        onFailed: onFailedHook,
    });
}

export const getTransferDetails = async (transferId: string) => {
    return nomba.requery.fetchParentTransaction({ merchantTxRef: transferId });
}
```

`initiateTransfer` is where `transfer.hooks.ts` gets wired in. `getTransferDetails`
goes through `nomba.requery` (not `nomba.transfers`, which has no "get one
transfer" or "list transfers" method) keyed on `merchantTxRef` — the
reference *this app* chose when it initiated the transfer, so it's the one
identifier guaranteed to be on hand later.

### `src/modules/transfer/transfer.controller.ts` — transfer HTTP layer

```ts
export const listBanks = async (req, res) => { ... }

export const lookupBankAccount = [
    validateRequest(lookupCustomerRequestSchema),
    async (req, res) => { ...; returnSuccessResponse(res, customer); },
];

export const initiateTransfer = [
    validateRequest(initiateTransferRequestSchema),
    async (req, res) => { ...; returnSuccessResponse(res, result); },
];

export const getTransferDetails = async (req, res) => { ... }
```

`lookupBankAccount` and `initiateTransfer` are exported as **arrays** of
middleware: `[validateRequest(schema), handler]`. That's deliberate — it's
how a route gets validation *and* a handler as two composable steps, instead
of the validation and the handling being tangled into one function (which is
what caused the "runs regardless of whether validation failed" bug this app
originally had — see [the request walkthrough](#request-walkthrough-post-v1transfers-lookup-bank-account)
below for why that matters).

### `src/modules/webhooks/webhook.service.ts` — what an event means

```ts
export const handleWebhookEvent = async (event: WebhookEvent) => {
    switch (event.event_type) {
        case 'payment_success':
        case 'payout_success': console.log(...); break;
        case 'payment_failed':
        case 'payout_refund': console.warn(...); break;
        default: console.log(`unhandled event_type: ${event.event_type}`);
    }
}
```

Pure dispatch on `event_type`, no HTTP concerns. This is the other spot
marked `TODO` for real business logic — and the comment on it calls out
something important: **Nomba can re-send the same event** (via its own
retries, or `repush`/`replay`), so whatever replaces the `console.log` here
needs to be idempotent, e.g. keyed off `event.requestId` or
`data.transaction.transactionId`.

### `src/modules/webhooks/webhook.controller.ts` — verify, then dispatch

```ts
export const handleWebhook = async (req, res) => {
    const signature = req.header('nomba-signature');
    const timestamp = req.header('nomba-timestamp') ?? '';
    const rawBody = req.body as Buffer;

    const isValid = verifyWebhook(rawBody, signature, timestamp, NOMBA_WEBHOOK_SECRET);
    if (!isValid) {
        throw new Unauthorized('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf-8')) as WebhookEvent;
    await handleWebhookEvent(event);

    returnSuccessResponse(res, { received: true });
}
```

The one load-bearing comment here matters: `req.body` is a **raw `Buffer`**,
not a parsed object, because this route is mounted behind `express.raw()`
instead of `express.json()` (see `app.setup.ts` below). `verifyWebhook` needs
the exact raw bytes Nomba signed — a round-tripped `JSON.stringify(JSON.parse(buf))`
is not guaranteed to produce byte-identical output (key order, whitespace,
number formatting), so signature verification would be unreliable against a
re-serialized body. Only *after* the signature checks out does the controller
parse the buffer into JSON and hand it to the service.

### `src/app.setup.ts` — wiring it all together

This is the one file that knows about every route, in the order middleware
actually has to run:

```ts
const API_PREFIX = '/v1';
const WEBHOOK_PATH = '/webhooks/nomba';

const app = express();
app.use(cors({ ... }));

// Must run before express.json(): verifyWebhook needs the raw bytes.
app.use(`${API_PREFIX}${WEBHOOK_PATH}`, express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));

const routes = [
    { method: 'get',  path: '/transfers/banks', handler: transferController.listBanks },
    { method: 'post', path: '/transfers/lookup-bank-account', handler: transferController.lookupBankAccount },
    { method: 'post', path: '/transfers', handler: transferController.initiateTransfer },
    { method: 'get',  path: '/transfers/:transferId', handler: transferController.getTransferDetails },
    { method: 'post', path: WEBHOOK_PATH, handler: webhookController.handleWebhook },
];

const v1Router = express.Router();
for (const route of routes) {
    v1Router[route.method](route.path, ...[route.handler].flat());
}
app.use(API_PREFIX, v1Router);

export const listRoutes = () => routes.map(r => `${r.method.toUpperCase()} ${API_PREFIX}${r.path}`);

app.use((req, res) => res.status(404).json({ message: 'Route not found' })); // fallback
app.use((err, req, res, next) => { ... returnErrorResponse(res, err, req); }); // error handler
```

Three things worth noticing about the ordering and structure:

1. **The webhook route gets `express.raw()` scoped to its own path, mounted
   before the global `express.json()`.** Body-parsers check whether the body
   has already been parsed and skip if so, so once `express.raw()` has
   turned the webhook request's body into a `Buffer`, the later
   `express.json()` call leaves it alone. Every other route still gets JSON
   parsing as normal.
2. **`routes` is a plain array, not something read back out of Express's
   internal router.** Express doesn't expose a clean, stable public API for
   listing registered routes, and its internal `app._router.stack` structure
   is undocumented and has changed across major versions. Keeping one array
   that's both looped over to *register* routes and mapped over to *list*
   them (`listRoutes`, used by `main.ts`) means the printed list can never
   drift out of sync with what's actually registered, without relying on
   Express internals.
3. **Error-handling middleware is last, and checks `res.headersSent`.** An
   Express error handler is recognized by its arity (4 params:
   `(err, req, res, next)`); if a response was already sent before the error
   middleware runs, calling `res.status(...).json(...)` again would throw.

## Why `.ts` imports and no build step

Two unusual-looking details tie together:

- Every internal relative import ends in `.ts` (e.g. `from './app.setup.ts'`),
  not the more common `.js`.
- `tsconfig.json` has `"noEmit": true` and `"allowImportingTsExtensions": true`.

This project is never compiled. Node 24 strips TypeScript syntax and runs the
file directly (`node src/main.ts` just works), but Node's own ESM resolver
requires the import specifier to match a file that actually exists on disk —
it does **not** map a `./foo.js` specifier onto an existing `./foo.ts` file
the way a bundler or `ts-node` would. So imports have to say `.ts`, and
`allowImportingTsExtensions` is what tells `tsc` (used only for `npm run
typecheck`, never to emit files) that this is intentional rather than a
mistake.

`package.json`'s `start`/`dev` scripts reflect this directly:

```json
"start": "node --env-file=.env src/main.ts",
"dev":   "node --env-file=.env --watch src/main.ts"
```

No `ts-node`, no `tsx`, no `dist/` folder — just `node` and a flag to read
`.env`.

## Request walkthrough: `POST /v1/transfers/lookup-bank-account`

This traces one concrete request end to end, through every file it touches,
in order.

**Scenario:** a client sends

```
POST /v1/transfers/lookup-bank-account
Content-Type: application/json

{ "accountNumber": "1234567890", "bankCode": "044" }
```

### 1. Socket → Express middleware chain (`app.setup.ts`)

The request enters the single `http.Server` created by `app.listen()` in
`main.ts`, and Express runs its middleware stack in registration order:

1. **`cors(...)`** — adds CORS headers. Doesn't touch the body.
2. **The webhook-only `express.raw()`** — mounted at
   `/v1/webhooks/nomba`; this request's path doesn't match, so it's skipped.
3. **`express.json()`** — path *does* match (everything does, no path
   filter), content-type is `application/json`, so the body is parsed and
   `req.body` becomes `{ accountNumber: "1234567890", bankCode: "044" }`.
4. **`helmet(...)`** — sets security headers.
5. **`express.urlencoded(...)`** — no-op for a JSON body.

### 2. Router dispatch (`v1Router` in `app.setup.ts`)

`app.use('/v1', v1Router)` strips the `/v1` prefix and hands the remaining
path, `/transfers/lookup-bank-account`, to `v1Router`. It was registered as:

```ts
v1Router.post('/transfers/lookup-bank-account', validateRequest(lookupCustomerRequestSchema), handler);
```

(the `...[route.handler].flat()` spread is what turns the controller's
`[validateRequest(...), handler]` array into two separate middleware
arguments to `.post()`). Both functions now run in sequence for this one
route.

### 3. Validation (`validator.request.ts` + the schema in `transfer.controller.ts`)

```ts
const lookupCustomerRequestSchema = z.object({
    accountNumber: z.string().min(10).max(10),
    bankCode: z.string().min(3).max(6),
});
```

`validateRequest(lookupCustomerRequestSchema)` runs `schema.parseAsync(req.body)`.
`"1234567890"` is a 10-character string and `"044"` is 3 characters — both
pass. `req.body` is reassigned to the parsed (here, unchanged) value, and
`next()` is called, handing control to the actual route handler.

*(If validation had failed — say a 9-digit account number — `validateRequest`
would call `returnErrorResponse(res, new BadRequest(...), req)` itself,
write a `400` with the zod error message, and never call `next()`. The
handler and the service below would never run.)*

### 4. Controller (`transfer.controller.ts`)

```ts
async (req, res) => {
    const customer = await transferService.lookupBankAccount(req.body.accountNumber, req.body.bankCode);
    returnSuccessResponse(res, customer);
}
```

Pulls the two validated fields out of `req.body` and calls into the service
layer — no SDK knowledge here, just HTTP plumbing.

### 5. Service (`transfer.service.ts`)

```ts
export const lookupBankAccount = async (accountNumber, bankCode) => {
    const customer = await nomba.transfers.lookupBankAccount({ accountNumber, bankCode });
    return { ...customer };
}
```

Calls the shared `nomba` client (from `modules/nomba.ts`) — which transparently
handles getting/refreshing an access token if needed — and awaits the SDK's
HTTP call out to Nomba's API. The SDK resolves `{ accountNumber, accountName }`
on success, or throws a `NombaError` (4xx) on a rejection.

### 6a. Happy path — back out through the layers

The service's return value flows back up to the controller, which calls
`returnSuccessResponse(res, customer)` (`interceptor.response.ts`):

```json
{
  "message": "Request successful",
  "timestamp": "...",
  "status": "success",
  "data": { "accountNumber": "1234567890", "accountName": "JANE DOE" }
}
```

Express serializes it and the socket writes the `200` response.

### 6b. Error path — Express 5's automatic promise handling

If `nomba.transfers.lookupBankAccount(...)` throws (invalid account, bad
credentials, network failure), the `async` controller function returns a
rejected promise. **Express 5** (unlike Express 4) automatically forwards a
rejected promise from an async handler into the error-handling middleware —
no manual `try/catch`/`next(error)` needed anywhere in the controller or
service.

That error lands in the last middleware registered in `app.setup.ts`:

```ts
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    returnErrorResponse(res, err, req);
});
```

which reads `err.statusCode ?? err.status ?? 500` (a `NombaError` carries its
own `status`) and writes the matching status code with the standard error
envelope.

### Summary diagram

```
client
  │ POST /v1/transfers/lookup-bank-account
  ▼
http.Server (main.ts: app.listen)
  ▼
cors() → raw() [skipped, wrong path] → json() → helmet() → urlencoded()      (app.setup.ts)
  ▼
v1Router  (strips /v1 prefix)                                                (app.setup.ts)
  ▼
validateRequest(lookupCustomerRequestSchema)                                 (validator.request.ts)
  │   fail → returnErrorResponse(400) → client, stops here
  ▼ pass
lookupBankAccount handler                                                   (transfer.controller.ts)
  ▼
transferService.lookupBankAccount()                                         (transfer.service.ts)
  ▼
nomba.transfers.lookupBankAccount()  (SDK: token handling + HTTP call out)   (modules/nomba.ts)
  │
  ├─ success ─► controller: returnSuccessResponse(200)                      (interceptor.response.ts)
  │
  └─ throws ──► Express 5 auto-forwards rejected promise
                   ▼
                error middleware: returnErrorResponse(statusCode)            (app.setup.ts / interceptor.response.ts)
  ▼
client receives JSON response
```

The webhook route (`POST /v1/webhooks/nomba`) follows the same shape, with
one structural difference worth remembering: it's the signature check inside
`webhook.controller.ts` itself (not a separate `validateRequest` middleware)
that gates whether `webhook.service.ts` ever runs — because what's being
validated is a cryptographic signature over the raw body, not a shape zod
can describe.
