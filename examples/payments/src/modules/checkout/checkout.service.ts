import { eq, sql } from "drizzle-orm";
import nomba from "../nomba.ts";
import {
    type CreateCheckoutOrderParams,
    type FetchCheckoutTransactionParams,
    type RefundCheckoutTransactionParams,
    type ChargeTokenizedCardParams,
} from "@nomba/node-sdk";
import { onSuccessHook, onPendingHook, onFailedHook } from "../../common/checkout.hooks.ts";
import { db } from "../../database/client.ts";
import { checkoutOrders } from "../../database/schema.ts";

export const createOrder = async (params: CreateCheckoutOrderParams) => {
    const result = await nomba.checkout.createOrder(params);
    // `result.orderReference` is Nomba's own generated id — fall back to it if the caller
    // didn't pass their own `order.orderReference`, so there's always a key to persist under.
    const reference = params.order.orderReference ?? result.orderReference;

    await db
        .insert(checkoutOrders)
        .values({
            reference,
            amount: params.order.amount,
            requestPayload: JSON.stringify(params),
            responsePayload: JSON.stringify(result),
        })
        .onConflictDoUpdate({
            target: checkoutOrders.reference,
            set: { responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` },
        });

    return result;
}

export const fetchTransaction = async (params?: FetchCheckoutTransactionParams) => {
    const result = await nomba.checkout.fetchTransaction(params);
    const reference = result.order?.orderReference ?? params?.id;

    if (reference) {
        await db
            .update(checkoutOrders)
            .set({ responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
            .where(eq(checkoutOrders.reference, reference));
    }

    return result;
}

export const cancelOrder = async (orderReference: string) => {
    const result = await nomba.checkout.cancelOrder(orderReference);

    await db
        .update(checkoutOrders)
        .set({ status: 'cancelled', responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(checkoutOrders.reference, orderReference));

    return result;
}

export const refund = async (params: RefundCheckoutTransactionParams) => {
    return nomba.checkout.refund(params, {
        onSuccess: onSuccessHook(params),
        onPending: onPendingHook(params),
        onFailed: onFailedHook(params),
    });
}

// Check `status`/`otpRequired` on the result: a code of "00" does not mean the charge succeeded.
// If otpRequired is true, the charge is pending — submitting the OTP is out of scope for this example
// (that's nomba.charge.submitCardOtp, which belongs to the manual card-entry flow, not tokenized cards).
export const chargeTokenizedCard = async (params: ChargeTokenizedCardParams) => {
    const result = await nomba.checkout.chargeTokenizedCard(params);
    const reference = params.order?.orderReference ?? result.orderReference ?? result.transactionId;

    if (reference) {
        await db
            .insert(checkoutOrders)
            .values({
                reference,
                transactionId: result.transactionId,
                status: result.otpRequired ? 'otp_required' : 'charged',
                amount: params.order?.amount,
                requestPayload: JSON.stringify(params),
                responsePayload: JSON.stringify(result),
            })
            .onConflictDoUpdate({
                target: checkoutOrders.reference,
                set: {
                    transactionId: result.transactionId,
                    status: result.otpRequired ? 'otp_required' : 'charged',
                    responsePayload: JSON.stringify(result),
                    updatedAt: sql`(current_timestamp)`,
                },
            });
    }

    return result;
}
