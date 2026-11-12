import express, { type Application, type Request as ExpressRequest, type Response, type NextFunction, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { returnErrorResponse } from './common/interceptor.response.ts';
import { Logger } from './common/logger.ts';
import * as virtualAccountController from './modules/virtual-accounts/virtual-account.controller.ts';
import * as checkoutController from './modules/checkout/checkout.controller.ts';
import * as directDebitController from './modules/direct-debits/direct-debit.controller.ts';
import * as paymentMethodController from './modules/payment-methods/payment-method.controller.ts';
import * as webhookController from './modules/webhooks/webhook.controller.ts';

const logger = new Logger('ExceptionHandler');

const API_PREFIX = '/v1';
const WEBHOOK_PATH = '/webhooks/nomba';

const app: Application = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Must run before express.json(): verifyWebhook needs the raw bytes, not a parsed object.
app.use(`${API_PREFIX}${WEBHOOK_PATH}`, express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(express.urlencoded({ extended: true }));

// Routes go here. Kept as a plain list (not introspected from the router) so we can both
// register them and log them at boot from the same source of truth.
const routes: { method: 'get' | 'post' | 'put' | 'delete'; path: string; handler: RequestHandler | RequestHandler[] }[] = [
    // virtual accounts
    { method: 'post', path: '/virtual-accounts', handler: virtualAccountController.createVirtualAccount },
    { method: 'get', path: '/virtual-accounts/:identifier', handler: virtualAccountController.getVirtualAccount },
    { method: 'put', path: '/virtual-accounts/:identifier', handler: virtualAccountController.updateVirtualAccount },
    { method: 'delete', path: '/virtual-accounts/:identifier', handler: virtualAccountController.expireVirtualAccount },
    { method: 'post', path: '/virtual-accounts/list', handler: virtualAccountController.listVirtualAccounts },

    // checkout
    { method: 'post', path: '/checkout/orders', handler: checkoutController.createOrder },
    { method: 'get', path: '/checkout/transaction', handler: checkoutController.fetchTransaction },
    { method: 'post', path: '/checkout/orders/cancel', handler: checkoutController.cancelOrder },
    { method: 'post', path: '/checkout/refund', handler: checkoutController.refund },
    { method: 'post', path: '/checkout/charge-tokenized-card', handler: checkoutController.chargeTokenizedCard },

    // direct debits
    { method: 'post', path: '/direct-debits', handler: directDebitController.createMandate },
    { method: 'get', path: '/direct-debits/:mandateId', handler: directDebitController.getMandateStatus },
    { method: 'post', path: '/direct-debits/debit', handler: directDebitController.debitMandate },
    { method: 'put', path: '/direct-debits/status', handler: directDebitController.updateMandateStatus },
    { method: 'get', path: '/direct-debits', handler: directDebitController.listMandates },

    // payment methods
    { method: 'get', path: '/payment-methods', handler: paymentMethodController.listTokenizedCards },
    { method: 'put', path: '/payment-methods', handler: paymentMethodController.updateTokenizedCard },
    { method: 'delete', path: '/payment-methods', handler: paymentMethodController.deleteTokenizedCard },

    { method: 'post', path: WEBHOOK_PATH, handler: webhookController.handleWebhook },
];

const v1Router = express.Router();
for (const route of routes) {
    v1Router[route.method](route.path, ...[route.handler].flat());
}
app.use(API_PREFIX, v1Router);

export const listRoutes = () => routes.map((route) => `${route.method.toUpperCase()} ${API_PREFIX}${route.path}`);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Fallback route
app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found',
    });
});

// Error handling middleware
app.use((err: Error, req: ExpressRequest, res: Response, next: NextFunction) => {
    logger.error(`${req.method} ${req.url} - ${err.message}`, err.stack);
    if (res.headersSent) {
        return next(err);
    }
    returnErrorResponse(res, err, req);
});

export default app;
