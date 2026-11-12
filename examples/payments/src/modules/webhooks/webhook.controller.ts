import { type Request, type Response } from 'express';
import createHttpError from 'http-errors';
const { Unauthorized } = createHttpError;
import { verifyWebhook, type WebhookEvent } from '@nomba/node-sdk';
import { NOMBA_WEBHOOK_SECRET } from '../../config/env.config.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';
import { handleWebhookEvent } from './webhook.service.ts';

// Mounted behind express.raw() in app.setup.ts, so req.body here is the raw Buffer
// verifyWebhook needs — by the time express.json() would run, the body is already consumed.
export const handleWebhook = async (req: Request, res: Response) => {
    const signature = req.header('nomba-signature');
    const timestamp = req.header('nomba-timestamp') ?? '';
    const rawBody = req.body as Buffer;

    const isValid = verifyWebhook(rawBody, signature, timestamp, NOMBA_WEBHOOK_SECRET);
    if (!isValid) {
        throw new Unauthorized('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf-8')) as WebhookEvent;
    await handleWebhookEvent(event);

    returnSuccessResponse(res, { received: true });
}
