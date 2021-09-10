const { LoggerSeverity } = require('./enums/LoggerSeverity');

class PxLogger {
    constructor(appId, loggerSeverity, internalLogger) {
        this.appId = appId || 'PX_APP_ID';
        this.debugMode = loggerSeverity === LoggerSeverity.DEBUG;
        this.internalLogger = internalLogger || console;
    }

    debug(msg) {
        if (this.debugMode && typeof msg === 'string') {
            this.internalLogger.info(`[PerimeterX - DEBUG][${this.appId}] - ${msg}`);
        }
    }

    error(msg) {
        if (typeof msg === 'string') {
            this.internalLogger.error(
                new Error(`[PerimeterX - ERROR][${this.appId}] - ${msg}`).stack
            );
        }
    }
}

module.exports = PxLogger;
