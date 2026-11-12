import { type ElectricityPaymentV2Result, type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { Logger } from "./logger.ts";

const logger = new Logger('BillHooks');

// TODO: replace the logging below with your own business logic
// (e.g. persist the payment, notify a user, schedule a requery job).

export const onSuccessHook = (result: ElectricityPaymentV2Result) => {
    logger.log(`success ${result.id} ${result.status}`);
    return result;
};

export const onPendingHook = (info: PendingInfo<ElectricityPaymentV2Result>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    return info.data;
};

export const onFailedHook = (info: FailedInfo<ElectricityPaymentV2Result>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    return undefined;
};
