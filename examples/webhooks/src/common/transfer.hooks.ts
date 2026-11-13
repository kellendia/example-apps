import { type BankTransferParams, type BankTransferResult, type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { sql } from "drizzle-orm";
import { Logger } from "./logger.ts";
import { db } from "../database/client.ts";
import { transfers } from "../database/schema.ts";

const logger = new Logger('TransferHooks');

const upsertTransfer = async (params: BankTransferParams, fields: { transactionId?: string; status: string; responsePayload?: unknown }) => {
    await db
        .insert(transfers)
        .values({
            reference: params.merchantTxRef,
            transactionId: fields.transactionId,
            status: fields.status,
            amount: params.amount,
            requestPayload: JSON.stringify(params),
            responsePayload: fields.responsePayload ? JSON.stringify(fields.responsePayload) : null,
        })
        .onConflictDoUpdate({
            target: transfers.reference,
            set: {
                transactionId: fields.transactionId,
                status: fields.status,
                responsePayload: fields.responsePayload ? JSON.stringify(fields.responsePayload) : null,
                updatedAt: sql`(current_timestamp)`,
            },
        });
};

// Persists the transfer locally (src/database/schema.ts's `transfers` table) so this app has its
// own record of what it asked Nomba to do, independent of Nomba's own transaction history.
export const onSuccessHook = (params: BankTransferParams) => async (result: BankTransferResult) => {
    logger.log(`success ${result.id} ${result.status}`);
    await upsertTransfer(params, { transactionId: result.id, status: 'success', responsePayload: result });
    return result;
};

export const onPendingHook = (params: BankTransferParams) => async (info: PendingInfo<BankTransferResult>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    // info.data.id is usually absent here (Nomba only returns `status` for a 201/pending response) —
    // captured anyway in case a future response does include it, so the later webhook can match by it too.
    await upsertTransfer(params, { transactionId: info.data?.id, status: 'pending', responsePayload: info.data });
    return info.data;
};

export const onFailedHook = (params: BankTransferParams) => async (info: FailedInfo<BankTransferResult>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    await upsertTransfer(params, { status: 'failed', responsePayload: { code: info.code, message: info.error.message } });
    return undefined;
};
