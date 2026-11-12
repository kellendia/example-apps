import nomba from "../nomba.ts";
import { type BankTransferParams } from "@nomba/node-sdk";
import { onSuccessHook, onPendingHook, onFailedHook } from "../../common/transfer.hooks.ts";

export const listAvailableBanks = async () => {
    const banks = await nomba.transfers.listBanks();

    return {
        ...banks
    }
}

export const lookupBankAccount = async (accountNumber: string, bankCode: string) => {
    const customer = await nomba.transfers.lookupBankAccount({
        accountNumber,
        bankCode,
    });
    return {
        ...customer,
    };
}

export const initiateTransfer = async (transferData: BankTransferParams) => {
    return nomba.transfers.bankTransfer(transferData, {
        onSuccess: onSuccessHook,
        onPending: onPendingHook,
        onFailed: onFailedHook,
    });
}

// No list/requery-by-merchantTxRef shortcut exists on nomba.transfers, so this goes through
// the requery service, keyed on the merchantTxRef the caller chose when initiating the transfer.
export const getTransferDetails = async (transferId: string) => {
    return nomba.requery.fetchParentTransaction({ merchantTxRef: transferId });
}
