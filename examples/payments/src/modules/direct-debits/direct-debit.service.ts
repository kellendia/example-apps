import { eq, sql } from "drizzle-orm";
import nomba from "../nomba.ts";
import {
    type CreateMandateParams,
    type DebitMandateParams,
    type ListMandatesParams,
    type UpdateMandateStatusParams,
} from "@nomba/node-sdk";
import { db } from "../../database/client.ts";
import { directDebitMandates, directDebitDebits } from "../../database/schema.ts";

export const createMandate = async (params: CreateMandateParams) => {
    const result = await nomba.directDebits.createMandate(params);

    await db
        .insert(directDebitMandates)
        .values({
            reference: params.merchantReference,
            mandateId: result.mandateId,
            amount: params.amount,
            requestPayload: JSON.stringify(params),
            responsePayload: JSON.stringify(result),
        })
        .onConflictDoUpdate({
            target: directDebitMandates.reference,
            set: { mandateId: result.mandateId, responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` },
        });

    return result;
}

export const getMandateStatus = async (mandateId: string) => {
    const result = await nomba.directDebits.getMandateStatus(mandateId);

    await db
        .update(directDebitMandates)
        .set({ responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(directDebitMandates.mandateId, mandateId));

    return result;
}

// Only mandates that are both ACTIVE and ADVICE_SENT (check via getMandateStatus) can be debited.
export const debitMandate = async (params: DebitMandateParams) => {
    const result = await nomba.directDebits.debitMandate(params);

    await db.insert(directDebitDebits).values({
        mandateId: params.mandateId,
        amount: params.amount,
        status: result.status ?? 'submitted',
        responsePayload: JSON.stringify(result),
    });

    return result;
}

export const updateMandateStatus = async (params: UpdateMandateStatusParams) => {
    const result = await nomba.directDebits.updateMandateStatus(params);

    await db
        .update(directDebitMandates)
        .set({ status: result.mandateStatus ?? params.status, responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(directDebitMandates.mandateId, params.mandateId));

    return result;
}

export const listMandates = async (params: ListMandatesParams) => {
    return nomba.directDebits.listMandates(params);
}
