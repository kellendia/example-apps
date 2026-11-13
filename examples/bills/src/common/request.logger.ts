import { type Request, type Response, type NextFunction } from 'express';
import { Logger } from './logger.ts';

const logger = new Logger('HTTP');

// Logs every request once it finishes, with how long it took to respond.
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
    });
    next();
};
