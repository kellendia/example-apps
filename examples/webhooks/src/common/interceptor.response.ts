// This file contains the interceptor response for the application

import { type Response, type Request as ExpressRequest } from 'express';
import { STATUS_CODES } from 'node:http';

export const returnSuccessResponse = (res: Response, data: any, statusCode: number = 200) => {
    res.status(statusCode).json({
        message: 'Request successful',
        timestamp: new Date().toISOString(),
        status: 'success',
        data: data,
    });
};

// Same envelope NestJS's class-validator/HttpException filter produces:
// { statusCode, message, error }, with `message` an array for validation failures.
type HttpLikeError = Error & { statusCode?: number; status?: number; messages?: string[] };

export const returnErrorResponse = (res: Response, error: HttpLikeError, req: ExpressRequest) => {
    const statusCode = error.statusCode ?? error.status ?? 500;
    res.status(statusCode).json({
        statusCode,
        message: error.messages ?? error.message,
        error: STATUS_CODES[statusCode] ?? 'Internal Server Error',
    });
};