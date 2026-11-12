import * as billService from './bill.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

// request validation schemas
const lookupMeterRequestSchema = z.object({
    disco: z.string().min(1),
    customerId: z.string().min(1),
});

const payBillRequestSchema = z.object({
    disco: z.string().min(1),
    customerId: z.string().min(1),
    amount: z.number().positive(),
    payerName: z.string().min(1),
    meterType: z.string().min(1),
    merchantTxRef: z.string().min(1),
});

export const listElectricityProviders = async (req: Request, res: Response) => {
    const providers = await billService.listElectricityProviders();
    returnSuccessResponse(res, providers);
}

// We will always look up the meter before paying a bill, so we confirm the customer exists and is valid.
export const lookupMeter = [
    validateRequest(lookupMeterRequestSchema),
    async (req: Request, res: Response) => {
        const customer = await billService.lookupMeter(req.body.disco, req.body.customerId);
        returnSuccessResponse(res, customer);
    },
];

export const payElectricityBill = [
    validateRequest(payBillRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.payElectricityBill(req.body);
        returnSuccessResponse(res, result);
    },
];

export const getBillDetails = async (req: Request, res: Response) => {
    const bill = await billService.getBillDetails(String(req.params.billId));
    returnSuccessResponse(res, bill);
}
