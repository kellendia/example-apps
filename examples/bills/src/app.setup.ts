import express, { type Application, type Request as ExpressRequest, type Response, type NextFunction, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { returnErrorResponse } from './common/interceptor.response.ts';
import { Logger } from './common/logger.ts';
import * as billController from './modules/bills/bill.controller.ts';
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
const routes: { method: 'get' | 'post'; path: string; handler: RequestHandler | RequestHandler[] }[] = [
    // electricity
    { method: 'get', path: '/bills/electricity/providers', handler: billController.listElectricityProviders },
    { method: 'post', path: '/bills/electricity/lookup-meter', handler: billController.lookupMeter },
    { method: 'post', path: '/bills/electricity', handler: billController.payElectricityBill },
    { method: 'get', path: '/bills/electricity/:billId', handler: billController.getBillDetails },

    // cable TV
    { method: 'get', path: '/bills/cable/plans', handler: billController.listCablePlans },
    { method: 'post', path: '/bills/cable/lookup-customer', handler: billController.lookupCableCustomer },
    { method: 'post', path: '/bills/cable', handler: billController.payCableBill },

    // betting
    { method: 'get', path: '/bills/betting/providers', handler: billController.listBettingProviders },
    { method: 'post', path: '/bills/betting/lookup-customer', handler: billController.lookupBettingCustomer },
    { method: 'post', path: '/bills/betting', handler: billController.payBettingBill },

    // airtime
    { method: 'post', path: '/bills/airtime', handler: billController.buyAirtime },

    // data
    { method: 'get', path: '/bills/data/plans/:network', handler: billController.listDataPlans },
    { method: 'post', path: '/bills/data', handler: billController.buyData },

    // shared across billers
    { method: 'get', path: '/bills/customers/:customerId/subscriptions', handler: billController.getCustomerSubscriptionHistory },

    { method: 'post', path: WEBHOOK_PATH, handler: webhookController.handleWebhook },
];

const v1Router = express.Router();
for (const route of routes) {
    v1Router[route.method](route.path, ...[route.handler].flat());
}
app.use(API_PREFIX, v1Router);

export const listRoutes = () => routes.map((route) => `${route.method.toUpperCase()} ${API_PREFIX}${route.path}`);

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
