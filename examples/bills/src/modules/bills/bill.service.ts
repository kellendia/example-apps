import { eq, sql } from "drizzle-orm";
import nomba from "../nomba.ts";
import {
    type ElectricityPaymentParams,
    type CableTvSubscriptionParams,
    type BettingPaymentParams,
    type AirtimePurchaseParams,
    type DataPurchaseParams,
    type Transaction,
} from "@nomba/node-sdk";
import { onSuccessHook, onPendingHook, onFailedHook } from "../../common/bill.hooks.ts";
import { db } from "../../database/client.ts";
import { billPayments } from "../../database/schema.ts";

// -- electricity --

export const listElectricityProviders = async () => {
    return nomba.billElectricity.getElectricityProviders();
}

export const lookupMeter = async (disco: string, customerId: string) => {
    return nomba.electricity.lookupMeter({ disco, customerId });
}

export const payElectricityBill = async (paymentData: ElectricityPaymentParams) => {
    return nomba.electricity.payElectricity(paymentData, {
        onSuccess: onSuccessHook('electricity', paymentData),
        onPending: onPendingHook('electricity', paymentData),
        onFailed: onFailedHook('electricity', paymentData),
    });
}

// -- cable TV --

export const listCablePlans = async (cableTvType: string) => {
    return nomba.billCable.getCablePlans({ cableTvType });
}

export const lookupCableCustomer = async (cableTvType: string, customerId: string) => {
    return nomba.billCable.lookupCustomer({ cableTvType, customerId });
}

export const payCableBill = async (paymentData: CableTvSubscriptionParams) => {
    return nomba.cable.subscribeCableTv(paymentData, {
        onSuccess: onSuccessHook('cable', paymentData),
        onPending: onPendingHook('cable', paymentData),
        onFailed: onFailedHook('cable', paymentData),
    });
}

// -- betting --

export const listBettingProviders = async () => {
    return nomba.billBetting.getBettingProviders();
}

export const lookupBettingCustomer = async (bettingProvider: string, customerId: string) => {
    return nomba.billBetting.lookupCustomer({ bettingProvider, customerId });
}

export const payBettingBill = async (paymentData: BettingPaymentParams) => {
    return nomba.betting.payBetting(paymentData, {
        onSuccess: onSuccessHook('betting', paymentData),
        onPending: onPendingHook('betting', paymentData),
        onFailed: onFailedHook('betting', paymentData),
    });
}

// -- airtime --
// No lookup/validate step here: airtime tops up a phone number directly, there's
// nothing to confirm beforehand the way a meter or smartcard number is confirmed.

export const buyAirtime = async (purchaseData: AirtimePurchaseParams) => {
    return nomba.airtime.buyAirtime(purchaseData, {
        onSuccess: onSuccessHook('airtime', purchaseData),
        onPending: onPendingHook('airtime', purchaseData),
        onFailed: onFailedHook('airtime', purchaseData),
    });
}

// -- data --

export const listDataPlans = async (network: string) => {
    return nomba.billData.getDataPlans(network);
}

export const buyData = async (purchaseData: DataPurchaseParams) => {
    return nomba.data.buyData(purchaseData, {
        onSuccess: onSuccessHook('data', purchaseData),
        onPending: onPendingHook('data', purchaseData),
        onFailed: onFailedHook('data', purchaseData),
    });
}

// -- shared: requery by merchantTxRef --
// No dedicated "get one bill payment" endpoint on any biller service, so this goes
// through the requery service, keyed on the merchantTxRef the caller chose.

export const getBillDetails = async (billId: string) => {
    const result = await nomba.requery.fetchParentTransaction({ merchantTxRef: billId });

    // Refresh our local copy with whatever Nomba says now, if we have a row for it.
    await db
        .update(billPayments)
        .set({ responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(billPayments.reference, billId));

    return result;
}

// -- customer subscription history --
// There's no server-side "list this customer's past bills" endpoint either, so we scan
// recent parent-account transactions and match on customerBillerId (the meter, smartcard,
// betting account or phone number the payment went to).
// ponytail: client-side scan capped at SCAN_LIMIT transactions, not indexed by customer.
// Swap for a real lookup (e.g. your own DB of past payments) if this needs to be fast or complete.
const SCAN_LIMIT = 500;

export const getCustomerSubscriptionHistory = async (customerId: string, maxResults = 5): Promise<Transaction[]> => {
    const matches: Transaction[] = [];
    let scanned = 0;

    for await (const txn of nomba.transactions.iterateParentTransactions()) {
        scanned += 1;
        if (txn.customerBillerId === customerId) {
            matches.push(txn);
            if (matches.length >= maxResults) break;
        }
        if (scanned >= SCAN_LIMIT) break;
    }

    return matches;
}
