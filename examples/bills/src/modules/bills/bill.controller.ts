import * as billService from './bill.service.ts';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../common/validator.request.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';

// -- electricity --

const lookupMeterRequestSchema = z.object({
    disco: z.string().min(1),
    customerId: z.string().min(1),
});

const payElectricityRequestSchema = z.object({
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

export const lookupMeter = [
    validateRequest(lookupMeterRequestSchema),
    async (req: Request, res: Response) => {
        const customer = await billService.lookupMeter(req.body.disco, req.body.customerId);
        returnSuccessResponse(res, customer);
    },
];

export const payElectricityBill = [
    validateRequest(payElectricityRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.payElectricityBill(req.body);
        returnSuccessResponse(res, result);
    },
];

// -- cable TV --

const payCableRequestSchema = z.object({
    cableTvType: z.string().min(1),
    customerId: z.string().min(1),
    amount: z.number().positive(),
    payerName: z.string().min(1),
    merchantTxRef: z.string().min(1),
});

const lookupCableCustomerRequestSchema = z.object({
    cableTvType: z.string().min(1),
    customerId: z.string().min(1),
});

export const listCablePlans = async (req: Request, res: Response) => {
    const plans = await billService.listCablePlans(String(req.query.cableTvType));
    returnSuccessResponse(res, plans);
}

export const lookupCableCustomer = [
    validateRequest(lookupCableCustomerRequestSchema),
    async (req: Request, res: Response) => {
        const customer = await billService.lookupCableCustomer(req.body.cableTvType, req.body.customerId);
        returnSuccessResponse(res, customer);
    },
];

export const payCableBill = [
    validateRequest(payCableRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.payCableBill(req.body);
        returnSuccessResponse(res, result);
    },
];

// -- betting --

const lookupBettingCustomerRequestSchema = z.object({
    bettingProvider: z.string().min(1),
    customerId: z.string().min(1),
});

const payBettingRequestSchema = z.object({
    bettingProvider: z.string().min(1),
    customerId: z.string().min(1),
    phoneNumber: z.string().min(1),
    amount: z.number().positive(),
    payerName: z.string().min(1),
    merchantTxRef: z.string().min(1),
});

export const listBettingProviders = async (req: Request, res: Response) => {
    const providers = await billService.listBettingProviders();
    returnSuccessResponse(res, providers);
}

export const lookupBettingCustomer = [
    validateRequest(lookupBettingCustomerRequestSchema),
    async (req: Request, res: Response) => {
        const customer = await billService.lookupBettingCustomer(req.body.bettingProvider, req.body.customerId);
        returnSuccessResponse(res, customer);
    },
];

export const payBettingBill = [
    validateRequest(payBettingRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.payBettingBill(req.body);
        returnSuccessResponse(res, result);
    },
];

// -- airtime --

const buyAirtimeRequestSchema = z.object({
    phoneNumber: z.string().min(11).max(13),
    network: z.string().min(1),
    amount: z.number().positive(),
    merchantTxRef: z.string().min(1),
    senderName: z.string().optional(),
});

export const buyAirtime = [
    validateRequest(buyAirtimeRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.buyAirtime(req.body);
        returnSuccessResponse(res, result);
    },
];

// -- data --

const buyDataRequestSchema = z.object({
    productId: z.string().min(1),
    phoneNumber: z.string().min(11).max(13),
    network: z.string().min(1),
    merchantTxRef: z.string().min(1),
    senderName: z.string().optional(),
});

export const listDataPlans = async (req: Request, res: Response) => {
    const plans = await billService.listDataPlans(String(req.params.network));
    returnSuccessResponse(res, plans);
}

export const buyData = [
    validateRequest(buyDataRequestSchema),
    async (req: Request, res: Response) => {
        const result = await billService.buyData(req.body);
        returnSuccessResponse(res, result);
    },
];

// -- shared --

export const getBillDetails = async (req: Request, res: Response) => {
    const bill = await billService.getBillDetails(String(req.params.billId));
    returnSuccessResponse(res, bill);
}

export const getCustomerSubscriptionHistory = async (req: Request, res: Response) => {
    const history = await billService.getCustomerSubscriptionHistory(String(req.params.customerId));
    returnSuccessResponse(res, history);
}
