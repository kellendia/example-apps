import * as paymentMethodService from './payment-method.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

export const listTokenizedCards = async (req: Request, res: Response) => {
    const customerEmail = req.query.customerEmail ? String(req.query.customerEmail) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const cards = await paymentMethodService.listTokenizedCards({ customerEmail, startDate, endDate, page });
    returnSuccessResponse(res, cards);
}

const updateTokenizedCardRequestSchema = z.object({
    tokenKey: z.string().min(1),
    currentEmailAddress: z.string().email(),
    newEmailAddress: z.string().email(),
});

export const updateTokenizedCard = [
    validateRequest(updateTokenizedCardRequestSchema),
    async (req: Request, res: Response) => {
        const result = await paymentMethodService.updateTokenizedCard(req.body);
        returnSuccessResponse(res, result);
    },
];

const deleteTokenizedCardRequestSchema = z.object({
    tokenKey: z.string().min(1),
});

export const deleteTokenizedCard = [
    validateRequest(deleteTokenizedCardRequestSchema),
    async (req: Request, res: Response) => {
        const result = await paymentMethodService.deleteTokenizedCard(req.body.tokenKey);
        returnSuccessResponse(res, result);
    },
];
