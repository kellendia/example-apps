import * as checkoutService from './checkout.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

const orderSchema = z.object({
    orderReference: z.string().optional(),
    customerId: z.string().optional(),
    callbackUrl: z.string().url(),
    customerEmail: z.string().email(),
    amount: z.number().positive(),
    currency: z.enum(['NGN', 'CDF', 'USD', 'EUR', 'GBP']),
    accountId: z.string().optional(),
    allowedPaymentMethods: z.array(z.enum([
        'Card', 'Transfer', 'Nomba QR', 'USSD', 'Buy Now Pay Later', 'MOMO', 'Intl Card', 'Apple Pay', 'Intl Transfer',
    ])).optional(),
    splitRequest: z.object({
        splitType: z.enum(['PERCENTAGE', 'AMOUNT']).optional(),
        splitList: z.array(z.object({
            accountId: z.string().optional(),
            value: z.number().optional(),
        })).optional(),
    }).optional(),
    orderMetaData: z.record(z.string(), z.string()).optional(),
});

const createOrderRequestSchema = z.object({
    order: orderSchema,
    tokenizeCard: z.boolean().optional(),
});

export const createOrder = [
    validateRequest(createOrderRequestSchema),
    async (req: Request, res: Response) => {
        const order = await checkoutService.createOrder(req.body);
        returnSuccessResponse(res, order);
    },
];

export const fetchTransaction = async (req: Request, res: Response) => {
    const idType = req.query.idType ? String(req.query.idType) as 'ORDER_ID' | 'ORDER_REFERENCE' : undefined;
    const id = req.query.id ? String(req.query.id) : undefined;
    const transaction = await checkoutService.fetchTransaction({ idType, id });
    returnSuccessResponse(res, transaction);
}

const cancelOrderRequestSchema = z.object({
    orderReference: z.string().min(1),
});

export const cancelOrder = [
    validateRequest(cancelOrderRequestSchema),
    async (req: Request, res: Response) => {
        const result = await checkoutService.cancelOrder(req.body.orderReference);
        returnSuccessResponse(res, result);
    },
];

const refundRequestSchema = z.object({
    transactionId: z.string().min(1),
    amount: z.number().positive().optional(),
    accountNumber: z.string().length(10).optional(),
    bankCode: z.string().optional(),
});

export const refund = [
    validateRequest(refundRequestSchema),
    async (req: Request, res: Response) => {
        const result = await checkoutService.refund(req.body);
        returnSuccessResponse(res, result);
    },
];

const chargeTokenizedCardRequestSchema = z.object({
    tokenKey: z.string().min(1),
    order: orderSchema.optional(),
});

export const chargeTokenizedCard = [
    validateRequest(chargeTokenizedCardRequestSchema),
    async (req: Request, res: Response) => {
        const result = await checkoutService.chargeTokenizedCard(req.body);
        returnSuccessResponse(res, result);
    },
];
