/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

class PxLogger {
    constructor() {
        this.debugMode = false;
        this.appId = '';
    }

    setCustomLogger(customLogger) {
        this.customLogger = customLogger;
    }

    init(pxConfig) {
        this.debugMode = pxConfig.conf.DEBUG_MODE;
        this.appId = pxConfig.conf.PX_APP_ID;
        this.customLogger = pxConfig.conf.CUSTOM_LOGGER;
    }

    debug(msg) {
        if (this.debugMode && msg) {
            (this.customLogger ? this.customLogger : console).info(`[PerimeterX - DEBUG][${this.appId}] - ${msg}`);
        }
    }
    
    error(msg) {
        if (typeof msg === 'string') {
            (this.customLogger ? this.customLogger : console).error(new Error(`[PerimeterX - ERROR][${this.appId}] - ${msg}`).stack);
        }
    }
}

module.exports = PxLogger;
