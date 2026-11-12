import nomba from "../nomba.ts";
import { type ListTokenizedCardsParams, type UpdateTokenizedCardParams } from "@nomba/node-sdk";

export const listTokenizedCards = async (params?: ListTokenizedCardsParams) => {
    return nomba.checkout.listTokenizedCards(params);
}

export const updateTokenizedCard = async (params: UpdateTokenizedCardParams) => {
    return nomba.checkout.updateTokenizedCard(params);
}

export const deleteTokenizedCard = async (tokenKey: string) => {
    return nomba.checkout.deleteTokenizedCard(tokenKey);
}
