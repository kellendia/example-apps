import { type Request, type Response } from 'express';
import createHttpError from 'http-errors';
const { Unauthorized } = createHttpError;
import { verifyWebhook, type WebhookEvent } from '@nomba/node-sdk';
import { NOMBA_WEBHOOK_SECRET } from '../../config/env.config.ts';
import { returnSuccessResponse } from '../../common/interceptor.response.ts';
import { Logger } from '../../common/logger.ts';
import { handleWebhookEvent, logDelivery, markDeliveryProcessed, markDeliveryFailed } from './webhook.service.ts';

const logger = new Logger('Webhook');

// Mounted behind express.raw() in app.setup.ts, so req.body here is the raw Buffer
// verifyWebhook needs — by the time express.json() would run, the body is already consumed.
export const handleWebhook = async (req: Request, res: Response) => {
    const signature = req.header('nomba-signature');
    const timestamp = req.header('nomba-timestamp') ?? '';
    const rawBody = req.body as Buffer;
    const bodyText = rawBody.toString('utf-8');

    // Logged before verification too, so a rejected delivery still leaves a record of what was sent.
    logger.log(`payload: ${bodyText}`);

    const isValid = verifyWebhook(rawBody, signature, timestamp, NOMBA_WEBHOOK_SECRET);
    const event = isValid ? (JSON.parse(bodyText) as WebhookEvent) : undefined;
    // Logged regardless of outcome — src/database/schema.ts's `webhook_deliveries` table is the
    // durable audit trail this console log alone can't provide (it's lost on restart).
    const deliveryId = await logDelivery(event, bodyText, isValid);

    if (!isValid) {
        throw new Unauthorized('Invalid webhook signature');
    }

    try {
        await handleWebhookEvent(event!);
        await markDeliveryProcessed(deliveryId);
    } catch (err) {
        await markDeliveryFailed(deliveryId, err);
        throw err;
    }

    returnSuccessResponse(res, { received: true });
}
