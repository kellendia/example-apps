import { type CheckoutResult, type FailedInfo, type PendingInfo, type RefundCheckoutTransactionParams } from "@nomba/node-sdk";
import { eq, sql } from "drizzle-orm";
import { Logger } from "./logger.ts";
import { db } from "../database/client.ts";
import { checkoutOrders } from "../database/schema.ts";

const logger = new Logger('CheckoutHooks');

// Only checkout.refund takes these outcome hooks (the other checkout/virtual-account/direct-debit
// calls throw NombaError/OutcomeUnknownError directly instead of accepting onSuccess/onPending/onFailed).

// Refunds are keyed by transactionId, not orderReference, so this updates/inserts the matching
// checkout_orders row by transactionId — same pattern webhook.service.ts uses.
const upsertByTransactionId = async (transactionId: string, fields: { status: string; responsePayload?: unknown }) => {
    const [existing] = await db.select().from(checkoutOrders).where(eq(checkoutOrders.transactionId, transactionId));
    if (existing) {
        await db
            .update(checkoutOrders)
            .set({ status: fields.status, responsePayload: JSON.stringify(fields.responsePayload), updatedAt: sql`(current_timestamp)` })
            .where(eq(checkoutOrders.transactionId, transactionId));
    } else {
        await db.insert(checkoutOrders).values({
            reference: transactionId,
            transactionId,
            status: fields.status,
            responsePayload: JSON.stringify(fields.responsePayload),
        });
    }
};

export const onSuccessHook = (params: RefundCheckoutTransactionParams) => async (result: CheckoutResult) => {
    logger.log(`success ${result.message}`);
    await upsertByTransactionId(params.transactionId, { status: 'refunded', responsePayload: result });
    return result;
};

export const onPendingHook = (params: RefundCheckoutTransactionParams) => async (info: PendingInfo<CheckoutResult>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    await upsertByTransactionId(params.transactionId, { status: 'refund_pending', responsePayload: info.data });
    return info.data;
};

export const onFailedHook = (params: RefundCheckoutTransactionParams) => async (info: FailedInfo<CheckoutResult>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    await upsertByTransactionId(params.transactionId, { status: 'refund_failed', responsePayload: { code: info.code, message: info.error.message } });
    return undefined;
};
