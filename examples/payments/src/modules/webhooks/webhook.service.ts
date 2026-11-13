import { type WebhookEvent } from "@nomba/node-sdk";
import { eq, sql } from "drizzle-orm";
import { Logger } from "../../common/logger.ts";
import { db } from "../../database/client.ts";
import { checkoutOrders, webhookDeliveries } from "../../database/schema.ts";

const logger = new Logger('WebhookService');

// Logs every delivery — valid or not — as its own durable record, independent of whether it
// matched a known checkout order. A future processor could read status = 'received' rows from
// here instead of (or alongside) the inline handleWebhookEvent call below.
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

// Updates the matching local checkout_orders row (by transactionId) if createOrder/chargeTokenizedCard
// already inserted one; otherwise inserts one, so nothing delivered is ever dropped.
const upsertFromWebhook = async (event: WebhookEvent, status: string) => {
    const transactionId = event.data?.transaction?.transactionId;
    if (!transactionId) return;

    const [existing] = await db.select().from(checkoutOrders).where(eq(checkoutOrders.transactionId, transactionId));
    if (existing) {
        await db
            .update(checkoutOrders)
            .set({ status, responsePayload: JSON.stringify(event), updatedAt: sql`(current_timestamp)` })
            .where(eq(checkoutOrders.transactionId, transactionId));
    } else {
        await db.insert(checkoutOrders).values({
            reference: transactionId,
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
            logger.log(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            await upsertFromWebhook(event, 'success');
            break;
        case 'payment_failed':
            logger.warn(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            await upsertFromWebhook(event, 'failed');
            break;
        default:
            logger.log(`unhandled event_type: ${event.event_type}`);
    }
}
