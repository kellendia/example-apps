import nomba from "../nomba.ts";
import {
    type CreateCheckoutOrderParams,
    type FetchCheckoutTransactionParams,
    type RefundCheckoutTransactionParams,
    type ChargeTokenizedCardParams,
} from "@nomba/node-sdk";
import { onSuccessHook, onPendingHook, onFailedHook } from "../../common/checkout.hooks.ts";

export const createOrder = async (params: CreateCheckoutOrderParams) => {
    return nomba.checkout.createOrder(params);
}

export const fetchTransaction = async (params?: FetchCheckoutTransactionParams) => {
    return nomba.checkout.fetchTransaction(params);
}

export const cancelOrder = async (orderReference: string) => {
    return nomba.checkout.cancelOrder(orderReference);
}

export const refund = async (params: RefundCheckoutTransactionParams) => {
    return nomba.checkout.refund(params, {
        onSuccess: onSuccessHook,
        onPending: onPendingHook,
        onFailed: onFailedHook,
    });
}

// Check `status`/`otpRequired` on the result: a code of "00" does not mean the charge succeeded.
// If otpRequired is true, the charge is pending — submitting the OTP is out of scope for this example
// (that's nomba.charge.submitCardOtp, which belongs to the manual card-entry flow, not tokenized cards).
export const chargeTokenizedCard = async (params: ChargeTokenizedCardParams) => {
    return nomba.checkout.chargeTokenizedCard(params);
}
