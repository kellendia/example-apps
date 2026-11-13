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
                // class-validator style: one message per failed field, e.g. "amount Required".
                const messages = error.issues.map((issue) => `${issue.path.join('.') || 'body'} ${issue.message}`);
                const badRequest = new BadRequest(messages.join(', ')) as InstanceType<typeof BadRequest> & { messages: string[] };
                badRequest.messages = messages;
                returnErrorResponse(res, badRequest, req);
                return;
            }
            returnErrorResponse(res, new BadRequest('Invalid request'), req);
        }
    }
}