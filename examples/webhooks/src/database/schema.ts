import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// One row per bank transfer. `reference` is the merchantTxRef we chose at creation;
// `transactionId` is Nomba's own id, filled in once we have it, and is what incoming
// webhooks are matched against.
export const transfers = sqliteTable('transfers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reference: text('reference').notNull().unique(),
    transactionId: text('transaction_id'),
    status: text('status').notNull().default('pending'),
    amount: integer('amount'),
    requestPayload: text('request_payload'),
    responsePayload: text('response_payload'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

// One row per webhook delivery, logged regardless of whether the signature was valid or it
// matched a known transfer — an audit trail independent of the `transfers` table, and a hook
// point for a future processor to read unprocessed (`status = 'received'`) deliveries from.
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
