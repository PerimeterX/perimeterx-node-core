/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

const { LoggerSeverity } = require('./enums/LoggerSeverity');

class PxLogger {
    constructor(params) {
        this.debugMode = params.px_logger_severity === LoggerSeverity.DEBUG;
        this.loggerSeverity = params.px_logger_severity;
        this.appId = params.px_app_id || 'PX_APP_ID';
        this.internalLogger = params.customLogger || console;
        this.logs = [];
    }

    debug(msg) {
        if (this.debugMode && typeof msg === 'string') {
            this.internalLogger.info(`[PerimeterX - DEBUG][${this.appId}] - ${msg}`);
        }
    }

    error(msg) {
        if (this.loggerSeverity !== LoggerSeverity.NONE && typeof msg === 'string') {
            this.internalLogger.error(
                new Error(`[PerimeterX - ERROR][${this.appId}] - ${msg}`).stack
            );
        }
    }
}

module.exports = PxLogger;
