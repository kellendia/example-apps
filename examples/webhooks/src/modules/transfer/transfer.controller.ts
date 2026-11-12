import * as transferService from './transfer.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

// request validation schemas
const lookupCustomerRequestSchema = z.object({
    accountNumber: z.string().min(10).max(10),
    bankCode: z.string().min(3).max(6),
});

const initiateTransferRequestSchema = z.object({
    amount: z.number().positive(),
    accountNumber: z.string().min(10).max(10),
    accountName: z.string().min(1),
    bankCode: z.string().min(3).max(6),
    merchantTxRef: z.string().min(1),
    senderName: z.string().optional(),
    narration: z.string().optional(),
});

export const listBanks = async (req: Request, res: Response) => {
    const banks = await transferService.listAvailableBanks();
    returnSuccessResponse(res, banks);
}

// We will always lookup the bank account before initiating a transfer so we confirm that the bank account exists and is valid.
export const lookupBankAccount = [
    validateRequest(lookupCustomerRequestSchema),
    async (req: Request, res: Response) => {
        const customer = await transferService.lookupBankAccount(req.body.accountNumber, req.body.bankCode);
        returnSuccessResponse(res, customer);
    },
];

export const initiateTransfer = [
    validateRequest(initiateTransferRequestSchema),
    async (req: Request, res: Response) => {
        const result = await transferService.initiateTransfer(req.body);
        returnSuccessResponse(res, result);
    },
];

export const getTransferDetails = async (req: Request, res: Response) => {
    const transfer = await transferService.getTransferDetails(String(req.params.transferId));
    returnSuccessResponse(res, transfer);
}
