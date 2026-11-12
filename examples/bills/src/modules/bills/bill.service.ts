import nomba from "../nomba.ts";
import { type ElectricityPaymentParams } from "@nomba/node-sdk";
import { onSuccessHook, onPendingHook, onFailedHook } from "../../common/bill.hooks.ts";

export const listElectricityProviders = async () => {
    return nomba.billElectricity.getElectricityProviders();
}

export const lookupMeter = async (disco: string, customerId: string) => {
    return nomba.electricity.lookupMeter({ disco, customerId });
}

export const payElectricityBill = async (paymentData: ElectricityPaymentParams) => {
    return nomba.electricity.payElectricity(paymentData, {
        onSuccess: onSuccessHook,
        onPending: onPendingHook,
        onFailed: onFailedHook,
    });
}

// Same shortcut as the transfer example: no dedicated "get one bill payment" endpoint,
// so this goes through the requery service, keyed on the merchantTxRef the caller chose.
export const getBillDetails = async (billId: string) => {
    return nomba.requery.fetchParentTransaction({ merchantTxRef: billId });
}
