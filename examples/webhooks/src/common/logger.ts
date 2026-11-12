// Minimal NestJS-style console logger: `[Nest] <pid>  - <timestamp>     LOG [Context] message`,
// colored per level. No dependency — just ANSI escape codes.

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

const LEVEL_COLOR: Record<LogLevel, string> = {
    log: '\x1b[32m',     // green
    error: '\x1b[31m',   // red
    warn: '\x1b[33m',    // yellow
    debug: '\x1b[35m',   // magenta
    verbose: '\x1b[36m', // cyan
};
const RESET = '\x1b[39m';
const BOLD = '\x1b[1m\x1b[39m';
const CONTEXT_COLOR = '\x1b[33m'; // yellow

const write = (level: LogLevel, message: unknown, context?: string) => {
    const stream = level === 'error' ? console.error : console.log;
    const label = `${LEVEL_COLOR[level]}${level.toUpperCase().padStart(7)}${RESET}`;
    const ctx = context ? `${CONTEXT_COLOR}[${context}]${RESET} ` : '';
    stream(`${BOLD}[ExampleServer]${RESET} ${process.pid}  - ${new Date().toLocaleString()}     ${label} ${ctx}${message}`);
};

export class Logger {
    private readonly context?: string;

    constructor(context?: string) {
        this.context = context;
    }

    log(message: unknown, context: string | undefined = this.context) {
        write('log', message, context);
    }

    error(message: unknown, trace?: string, context: string | undefined = this.context) {
        write('error', message, context);
        if (trace) console.error(trace);
    }

    warn(message: unknown, context: string | undefined = this.context) {
        write('warn', message, context);
    }

    debug(message: unknown, context: string | undefined = this.context) {
        write('debug', message, context);
    }

    verbose(message: unknown, context: string | undefined = this.context) {
        write('verbose', message, context);
    }
}
