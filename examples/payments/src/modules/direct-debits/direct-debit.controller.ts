import * as directDebitService from './direct-debit.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

const FREQUENCIES = [
    'VARIABLE', 'WEEKLY', 'EVERY_TWO_WEEKS', 'MONTHLY', 'EVERY_TWO_MONTHS', 'EVERY_THREE_MONTHS',
    'EVERY_FOUR_MONTHS', 'EVERY_FIVE_MONTHS', 'EVERY_SIX_MONTHS', 'EVERY_SEVEN_MONTHS',
    'EVERY_EIGHT_MONTHS', 'EVERY_NINE_MONTHS', 'EVERY_TEN_MONTHS', 'EVERY_ELEVEN_MONTHS', 'EVERY_TWELVE_MONTHS',
] as const;

const createMandateRequestSchema = z.object({
    customerAccountNumber: z.string().min(1),
    bankCode: z.string().min(1),
    customerName: z.string().min(1),
    customerAddress: z.string().optional(),
    customerAccountName: z.string().min(1),
    amount: z.number().positive(),
    frequency: z.enum(FREQUENCIES),
    narration: z.string().optional(),
    customerPhoneNumber: z.string().optional(),
    merchantReference: z.string().regex(/^\d+$/),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    customerEmail: z.string().email(),
    startImmediately: z.boolean().optional(),
});

export const createMandate = [
    validateRequest(createMandateRequestSchema),
    async (req: Request, res: Response) => {
        const mandate = await directDebitService.createMandate(req.body);
        returnSuccessResponse(res, mandate);
    },
];

export const getMandateStatus = async (req: Request, res: Response) => {
    const status = await directDebitService.getMandateStatus(String(req.params.mandateId));
    returnSuccessResponse(res, status);
}

const debitMandateRequestSchema = z.object({
    mandateId: z.string().min(1),
    amount: z.string().min(1),
});

export const debitMandate = [
    validateRequest(debitMandateRequestSchema),
    async (req: Request, res: Response) => {
        const result = await directDebitService.debitMandate(req.body);
        returnSuccessResponse(res, result);
    },
];

const updateMandateStatusRequestSchema = z.object({
    mandateId: z.string().min(1),
    status: z.enum(['SUSPEND', 'ACTIVE', 'DELETE']),
});

export const updateMandateStatus = [
    validateRequest(updateMandateStatusRequestSchema),
    async (req: Request, res: Response) => {
        const result = await directDebitService.updateMandateStatus(req.body);
        returnSuccessResponse(res, result);
    },
];

export const listMandates = async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 0);
    const pageSize = Number(req.query.pageSize ?? 20);
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const mandates = await directDebitService.listMandates({ page, pageSize, from, to, status });
    returnSuccessResponse(res, mandates);
}
