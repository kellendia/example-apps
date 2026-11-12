import { type WebhookEvent } from "@nomba/node-sdk";
import { Logger } from "../../common/logger.ts";

const logger = new Logger('WebhookService');

// TODO: replace this with your own business logic (persist the event, notify a user,
// update an order, etc). Nomba can repush/replay events, so keep this idempotent,
// e.g. by keying off event.requestId or data.transaction.transactionId.
export const handleWebhookEvent = async (event: WebhookEvent) => {
    switch (event.event_type) {
        case 'payment_success':
            logger.log(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            break;
        case 'payment_failed':
            logger.warn(`${event.event_type} - ${event.data?.transaction?.transactionId}`);
            break;
        default:
            logger.log(`unhandled event_type: ${event.event_type}`);
    }
}
