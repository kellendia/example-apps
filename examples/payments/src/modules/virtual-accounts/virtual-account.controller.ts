import * as virtualAccountService from './virtual-account.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

const createVirtualAccountRequestSchema = z.object({
    accountRef: z.string().min(16).max(64),
    accountName: z.string().min(8).max(64),
    bvn: z.string().optional(),
    nin: z.string().regex(/^\d{11}$/).optional(),
    expiryDate: z.string().optional(),
    expectedAmount: z.number().positive().optional(),
    callbackUrl: z.string().url().optional(),
    restrictInflowToAccountName: z.boolean().optional(),
});

export const createVirtualAccount = [
    validateRequest(createVirtualAccountRequestSchema),
    async (req: Request, res: Response) => {
        const account = await virtualAccountService.createVirtualAccount(req.body);
        returnSuccessResponse(res, account);
    },
];

export const getVirtualAccount = async (req: Request, res: Response) => {
    const account = await virtualAccountService.getVirtualAccount(String(req.params.identifier));
    returnSuccessResponse(res, account);
}

const updateVirtualAccountRequestSchema = z.object({
    newAccountRef: z.string().min(8).max(64).optional(),
    accountName: z.string().min(8).max(64).optional(),
    expectedAmount: z.string().optional(),
});

export const updateVirtualAccount = [
    validateRequest(updateVirtualAccountRequestSchema),
    async (req: Request, res: Response) => {
        const result = await virtualAccountService.updateVirtualAccount(String(req.params.identifier), req.body);
        returnSuccessResponse(res, result);
    },
];

export const expireVirtualAccount = async (req: Request, res: Response) => {
    const result = await virtualAccountService.expireVirtualAccount(String(req.params.identifier));
    returnSuccessResponse(res, result);
}

const filterVirtualAccountsRequestSchema = z.object({
    accountName: z.string().optional(),
    accountRef: z.string().optional(),
    bvn: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    dateCreatedFrom: z.string().optional(),
    dateCreatedTo: z.string().optional(),
    expired: z.boolean().optional(),
    resourceAcquired: z.boolean().optional(),
});

export const listVirtualAccounts = [
    validateRequest(filterVirtualAccountsRequestSchema),
    async (req: Request, res: Response) => {
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const accounts = await virtualAccountService.listVirtualAccounts(req.body, cursor, limit);
        returnSuccessResponse(res, accounts);
    },
];
