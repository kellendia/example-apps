import nomba from "../nomba.ts";
import {
    type CreateVirtualAccountParams,
    type UpdateVirtualAccountParams,
    type FilterVirtualAccountsParams,
} from "@nomba/node-sdk";

export const createVirtualAccount = async (params: CreateVirtualAccountParams) => {
    return nomba.virtualAccounts.create(params);
}

export const getVirtualAccount = async (identifier: string) => {
    return nomba.virtualAccounts.get(identifier);
}

export const updateVirtualAccount = async (identifier: string, params: UpdateVirtualAccountParams) => {
    return nomba.virtualAccounts.update(identifier, params);
}

export const expireVirtualAccount = async (identifier: string) => {
    return nomba.virtualAccounts.expire(identifier);
}

export const listVirtualAccounts = async (filter?: FilterVirtualAccountsParams, cursor?: string, limit?: number) => {
    return nomba.virtualAccounts.list(filter, { cursor, limit });
}
