import nomba from "../nomba.ts";
import {
    type CreateMandateParams,
    type DebitMandateParams,
    type ListMandatesParams,
    type UpdateMandateStatusParams,
} from "@nomba/node-sdk";

export const createMandate = async (params: CreateMandateParams) => {
    return nomba.directDebits.createMandate(params);
}

export const getMandateStatus = async (mandateId: string) => {
    return nomba.directDebits.getMandateStatus(mandateId);
}

// Only mandates that are both ACTIVE and ADVICE_SENT (check via getMandateStatus) can be debited.
export const debitMandate = async (params: DebitMandateParams) => {
    return nomba.directDebits.debitMandate(params);
}

export const updateMandateStatus = async (params: UpdateMandateStatusParams) => {
    return nomba.directDebits.updateMandateStatus(params);
}

export const listMandates = async (params: ListMandatesParams) => {
    return nomba.directDebits.listMandates(params);
}
