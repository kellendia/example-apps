import { type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { sql } from "drizzle-orm";
import { Logger } from "./logger.ts";
import { db } from "../database/client.ts";
import { billPayments } from "../database/schema.ts";

const logger = new Logger('BillHooks');

// Every biller's payment/purchase result shares this shape (electricity, cable,
// betting, airtime, data), so one set of hooks covers all of them.
type BillResult = { id: string; status: string };
type BillParams = { merchantTxRef: string; amount?: number };

const upsertBillPayment = async (billerType: string, params: BillParams, fields: { transactionId?: string; status: string; responsePayload?: unknown }) => {
    await db
        .insert(billPayments)
        .values({
            billerType,
            reference: params.merchantTxRef,
            transactionId: fields.transactionId,
            status: fields.status,
            amount: params.amount,
            requestPayload: JSON.stringify(params),
            responsePayload: fields.responsePayload ? JSON.stringify(fields.responsePayload) : null,
        })
        .onConflictDoUpdate({
            target: billPayments.reference,
            set: {
                transactionId: fields.transactionId,
                status: fields.status,
                responsePayload: fields.responsePayload ? JSON.stringify(fields.responsePayload) : null,
                updatedAt: sql`(current_timestamp)`,
            },
        });
};

// Persists the payment locally (src/database/schema.ts's `bill_payments` table), discriminated
// by `billerType` (electricity/cable/betting/airtime/data — whatever the service passes in).
export const onSuccessHook = <T extends BillResult>(billerType: string, params: BillParams) => async (result: T) => {
    logger.log(`success ${result.id} ${result.status}`);
    await upsertBillPayment(billerType, params, { transactionId: result.id, status: 'success', responsePayload: result });
    return result;
};

export const onPendingHook = <T extends BillResult>(billerType: string, params: BillParams) => async (info: PendingInfo<T>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    // Unlike a bank transfer, every biller's result type always includes `id`, even when the
    // status is PENDING_BILLING — so capture it now. Skipping this left the row with a null
    // transactionId, which the later webhook (matched only by transactionId) couldn't find,
    // inserting a duplicate row instead of updating this one.
    await upsertBillPayment(billerType, params, { transactionId: info.data?.id, status: 'pending', responsePayload: info.data });
    return info.data;
};

export const onFailedHook = <T extends BillResult>(billerType: string, params: BillParams) => async (info: FailedInfo<T>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    await upsertBillPayment(billerType, params, { status: 'failed', responsePayload: { code: info.code, message: info.error.message } });
    return undefined;
};
