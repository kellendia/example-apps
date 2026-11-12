import { type Request as ExpressRequest, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { returnErrorResponse } from './interceptor.response.ts';
import createHttpError from 'http-errors';
const { BadRequest } = createHttpError;

export const validateRequest = (schema: z.ZodType<any, any, any>,) => {
    return async (req: ExpressRequest, res: Response, next: NextFunction) => {
        try {
            const validatedData = await schema.parseAsync(req.body);
            req.body = validatedData;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                returnErrorResponse(res, new BadRequest(error.message), req);
                return;
            }
            returnErrorResponse(res, new BadRequest('Invalid request'), req);
        }
    }
}