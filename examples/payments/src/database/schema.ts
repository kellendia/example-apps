import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
};

// `reference` is the accountRef chosen at creation.
export const virtualAccounts = sqliteTable('virtual_accounts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reference: text('reference').notNull().unique(),
    status: text('status').notNull().default('active'),
    requestPayload: text('request_payload'),
    responsePayload: text('response_payload'),
    ...timestamps,
});

// `reference` is the orderReference we chose (or, if none was given, the one Nomba generated
// in its createOrder response). `transactionId` is filled in once payment completes — the
// field incoming webhooks and checkout.refund are matched against.
export const checkoutOrders = sqliteTable('checkout_orders', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reference: text('reference').notNull().unique(),
    transactionId: text('transaction_id'),
    status: text('status').notNull().default('pending'),
    amount: integer('amount'),
    requestPayload: text('request_payload'),
    responsePayload: text('response_payload'),
    ...timestamps,
});

// `reference` is the merchantReference chosen at creation; `mandateId` is Nomba's own id,
// needed for every subsequent call (getMandateStatus/debitMandate/updateMandateStatus).
export const directDebitMandates = sqliteTable('direct_debit_mandates', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reference: text('reference').notNull().unique(),
    mandateId: text('mandate_id'),
    status: text('status').notNull().default('pending'),
    amount: integer('amount'),
    requestPayload: text('request_payload'),
    responsePayload: text('response_payload'),
    ...timestamps,
});

// One row per debit attempt against a mandate (a mandate can be debited many times).
export const directDebitDebits = sqliteTable('direct_debit_debits', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mandateId: text('mandate_id').notNull(),
    // Decimal string, as the API itself takes/returns it (e.g. "110.00") — kept as text to avoid precision loss.
    amount: text('amount'),
    status: text('status').notNull().default('pending'),
    responsePayload: text('response_payload'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});

// A local cache of tokenized (saved) cards, refreshed whenever listTokenizedCards is called.
export const paymentMethods = sqliteTable('payment_methods', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tokenKey: text('token_key').notNull().unique(),
    customerEmail: text('customer_email'),
    responsePayload: text('response_payload'),
    ...timestamps,
});

// One row per webhook delivery, logged regardless of whether the signature was valid or it
// matched a known checkout order — an audit trail independent of the `checkout_orders` table,
// and a hook point for a future processor to read unprocessed (`status = 'received'`) deliveries from.
export const webhookDeliveries = sqliteTable('webhook_deliveries', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventType: text('event_type'),
    transactionId: text('transaction_id'),
    signatureValid: integer('signature_valid', { mode: 'boolean' }).notNull(),
    payload: text('payload').notNull(),
    // received: logged, not yet handled. processed: handleWebhookEvent ran without error.
    // failed: handleWebhookEvent threw. rejected: signature was invalid, never handled.
    status: text('status').notNull().default('received'),
    error: text('error'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});
