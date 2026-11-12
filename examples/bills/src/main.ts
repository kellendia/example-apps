import { PORT } from './config/env.config.ts';
import app, { listRoutes } from './app.setup.ts';
import { Logger } from './common/logger.ts';

const logger = new Logger('Bootstrap');

const bootstrap = async () => {
    try {
        app.listen(PORT, () => {
            logger.log(`Server is running on port ${PORT}`);
            logger.log('Available routes:');
            for (const route of listRoutes()) {
                logger.log(`  ${route}`);
            }
        });
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined);
        process.exit(1);
    }
};

bootstrap();