import { type CheckoutResult, type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { Logger } from "./logger.ts";

const logger = new Logger('CheckoutHooks');

// Only checkout.refund takes these outcome hooks (the other checkout/virtual-account/direct-debit
// calls throw NombaError/OutcomeUnknownError directly instead of accepting onSuccess/onPending/onFailed).
// TODO: replace the logging below with your own business logic
// (e.g. persist the refund, notify a user, schedule a requery job).

export const onSuccessHook = (result: CheckoutResult) => {
    logger.log(`success ${result.message}`);
    return result;
};

export const onPendingHook = (info: PendingInfo<CheckoutResult>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    return info.data;
};

export const onFailedHook = (info: FailedInfo<CheckoutResult>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    return undefined;
};
