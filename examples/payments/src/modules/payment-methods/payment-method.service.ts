import { eq, sql } from "drizzle-orm";
import nomba from "../nomba.ts";
import { type ListTokenizedCardsParams, type UpdateTokenizedCardParams } from "@nomba/node-sdk";
import { db } from "../../database/client.ts";
import { paymentMethods } from "../../database/schema.ts";

// Upserts every card Nomba returns into our local cache, keyed on tokenKey.
export const listTokenizedCards = async (params?: ListTokenizedCardsParams) => {
    const result = await nomba.checkout.listTokenizedCards(params);

    for (const card of result.tokenizedCardDataList ?? []) {
        if (!card.tokenKey) continue;
        await db
            .insert(paymentMethods)
            .values({
                tokenKey: card.tokenKey,
                customerEmail: card.customerEmail,
                responsePayload: JSON.stringify(card),
            })
            .onConflictDoUpdate({
                target: paymentMethods.tokenKey,
                set: { customerEmail: card.customerEmail, responsePayload: JSON.stringify(card), updatedAt: sql`(current_timestamp)` },
            });
    }

    return result;
}

export const updateTokenizedCard = async (params: UpdateTokenizedCardParams) => {
    const result = await nomba.checkout.updateTokenizedCard(params);

    await db
        .update(paymentMethods)
        .set({ customerEmail: params.newEmailAddress, updatedAt: sql`(current_timestamp)` })
        .where(eq(paymentMethods.tokenKey, params.tokenKey));

    return result;
}

export const deleteTokenizedCard = async (tokenKey: string) => {
    const result = await nomba.checkout.deleteTokenizedCard(tokenKey);
    await db.delete(paymentMethods).where(eq(paymentMethods.tokenKey, tokenKey));
    return result;
}
