import { type WebhookEvent } from "@nomba/node-sdk";
import { eq, sql } from "drizzle-orm";
import { Logger } from "../../common/logger.ts";
import { db } from "../../database/client.ts";
import { transfers, webhookDeliveries } from "../../database/schema.ts";
import nomba from "../nomba.ts";

const logger = new Logger('WebhookService');

// hookRequestId comes from nomba.webhooks.eventLogs() — each log entry carries the id to repush.
export const repushEvent = async (hookRequestId: string) => nomba.webhooks.repush(hookRequestId);

// Logs every delivery — valid or not — as its own durable record, independent of whether it
// matched a known transfer. A future processor could read status = 'received' rows from here
// instead of (or alongside) the inline handleWebhookEvent call below.
export const logDelivery = async (event: WebhookEvent | undefined, rawBody: string, signatureValid: boolean) => {
    const [row] = await db
        .insert(webhookDeliveries)
        .values({
            eventType: event?.event_type,
            transactionId: event?.data?.transaction?.transactionId,
            signatureValid,
            payload: rawBody,
            status: signatureValid ? 'received' : 'rejected',
        })
        .returning({ id: webhookDeliveries.id });
    return row.id;
};

export const markDeliveryProcessed = async (id: number) =>
    db.update(webhookDeliveries).set({ status: 'processed' }).where(eq(webhookDeliveries.id, id));

export const markDeliveryFailed = async (id: number, error: unknown) =>
    db.update(webhookDeliveries).set({ status: 'failed', error: String(error) }).where(eq(webhookDeliveries.id, id));

// Updates the matching local transfer row if initiateTransfer already inserted one, otherwise
// inserts one (e.g. a payout event with no prior local row).
//
// A bank transfer that comes back PENDING from initiateTransfer has no `id` yet (Nomba only
// returns `status` for that case — see BankTransferResult's doc comment), so the pending row is
// inserted with `transactionId: null`. Matching only on `transactionId` here would then miss
// that row and insert a duplicate once the real transactionId shows up. payout_success/
// payout_refund events carry the original `merchantTxRef` in `data.transaction`, so match on
// that first — it's always known, since it's the row's `reference` — and fall back to
// `transactionId` for events that don't carry it (payment_success/payment_failed don't).
const upsertFromWebhook = async (event: WebhookEvent, status: string) => {
    const transactionId = event.data?.transaction?.transactionId;
    const merchantTxRef = event.data?.transaction?.merchantTxRef as string | undefined;

    const matchOn = merchantTxRef
        ? eq(transfers.reference, merchantTxRef)
        : transactionId
        ? eq(transfers.transactionId, transactionId)
        : undefined;
    if (!matchOn) return;

    const [existing] = await db.select().from(transfers).where(matchOn);
    if (existing) {
        await db
            .update(transfers)
            .set({
                status,
                transactionId: transactionId ?? existing.transactionId,
                responsePayload: JSON.stringify(event),
                updatedAt: sql`(current_timestamp)`,
            })
            .where(eq(transfers.id, existing.id));
    } else if (transactionId) {
        await db.insert(transfers).values({
            reference: merchantTxRef ?? transactionId,
            transactionId,
            status,
            responsePayload: JSON.stringify(event),
        });
    }
};

// TODO: replace the logging below with more of your own business logic (notify a user, etc).
// Nomba can repush/replay events, so this stays idempotent by keying off data.transaction.transactionId.
export const handleWebhookEvent = async (event: WebhookEvent) => {
    switch (event.event_type) {
        case 'payment_success':
        case 'payout_success':
            logger.log(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            await upsertFromWebhook(event, 'success');
            break;
        case 'payment_failed':
        case 'payout_refund':
            logger.warn(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            await upsertFromWebhook(event, 'failed');
            break;
        default:
            logger.log(`unhandled event_type: ${event.event_type}`);
    }
}
