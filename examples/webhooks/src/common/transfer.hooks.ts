import { type BankTransferResult, type FailedInfo, type PendingInfo } from "@nomba/node-sdk";
import { Logger } from "./logger.ts";

const logger = new Logger('TransferHooks');

// TODO: replace the logging below with your own business logic
// (e.g. persist the transfer, notify a user, schedule a requery job).

export const onSuccessHook = (result: BankTransferResult) => {
    logger.log(`success ${result.id} ${result.status}`);
    return result;
};

export const onPendingHook = (info: PendingInfo<BankTransferResult>) => {
    logger.log(`pending, requery later - ref: ${info.idempotencyKey} status: ${info.status}`);
    return info.data;
};

export const onFailedHook = (info: FailedInfo<BankTransferResult>) => {
    logger.warn(`failed ${info.code} - ${info.error.message}`);
    return undefined;
};