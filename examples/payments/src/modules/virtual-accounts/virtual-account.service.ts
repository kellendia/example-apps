import { eq, sql } from "drizzle-orm";
import nomba from "../nomba.ts";
import {
    type CreateVirtualAccountParams,
    type UpdateVirtualAccountParams,
    type FilterVirtualAccountsParams,
} from "@nomba/node-sdk";
import { db } from "../../database/client.ts";
import { virtualAccounts } from "../../database/schema.ts";

export const createVirtualAccount = async (params: CreateVirtualAccountParams) => {
    const result = await nomba.virtualAccounts.create(params);
    await db
        .insert(virtualAccounts)
        .values({
            reference: params.accountRef,
            requestPayload: JSON.stringify(params),
            responsePayload: JSON.stringify(result),
        })
        .onConflictDoUpdate({
            target: virtualAccounts.reference,
            set: { responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` },
        });
    return result;
}

export const getVirtualAccount = async (identifier: string) => {
    const result = await nomba.virtualAccounts.get(identifier);

    // Refresh our local copy with whatever Nomba says now, if we have a row for it.
    await db
        .update(virtualAccounts)
        .set({ responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(virtualAccounts.reference, identifier));

    return result;
}

export const updateVirtualAccount = async (identifier: string, params: UpdateVirtualAccountParams) => {
    const result = await nomba.virtualAccounts.update(identifier, params);

    // newAccountRef renames the account going forward, so follow it in our local copy too.
    await db
        .update(virtualAccounts)
        .set({ reference: params.newAccountRef ?? identifier, responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(virtualAccounts.reference, identifier));

    return result;
}

export const expireVirtualAccount = async (identifier: string) => {
    const result = await nomba.virtualAccounts.expire(identifier);

    await db
        .update(virtualAccounts)
        .set({ status: 'expired', responsePayload: JSON.stringify(result), updatedAt: sql`(current_timestamp)` })
        .where(eq(virtualAccounts.reference, identifier));

    return result;
}

export const listVirtualAccounts = async (filter?: FilterVirtualAccountsParams, cursor?: string, limit?: number) => {
    return nomba.virtualAccounts.list(filter, { cursor, limit });
}
