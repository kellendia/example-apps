import { type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { Logger } from "./logger.ts";

const logger = new Logger('BillHooks');

// Every biller's payment/purchase result shares this shape (electricity, cable,
// betting, airtime, data), so one set of hooks covers all of them.
type BillResult = { id: string; status: string };

// TODO: replace the logging below with your own business logic
// (e.g. persist the payment, notify a user, schedule a requery job).

export const onSuccessHook = <T extends BillResult>(result: T) => {
    logger.log(`success ${result.id} ${result.status}`);
    return result;
};

export const onPendingHook = <T extends BillResult>(info: PendingInfo<T>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    return info.data;
};

export const onFailedHook = <T extends BillResult>(info: FailedInfo<T>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    return undefined;
};
