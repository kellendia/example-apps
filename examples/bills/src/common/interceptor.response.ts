// This file contains the interceptor response for the application

import { type Response, type Request as ExpressRequest } from 'express';

export const returnSuccessResponse = (res: Response, data: any, statusCode: number = 200) => {
    res.status(statusCode).json({
        message: 'Request successful',
        timestamp: new Date().toISOString(),
        status: 'success',
        data: data,
    });
};

type HttpLikeError = Error & { statusCode?: number; status?: number };

export const returnErrorResponse = (res: Response, error: HttpLikeError, req: ExpressRequest) => {
    const statusCode = error.statusCode ?? error.status ?? 500;
    res.status(statusCode).json({
        message: 'Something went wrong',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        error: {
            message: error.message,
            stack: error.stack,
        },
    });
};