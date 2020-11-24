/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

class PxLogger {
    constructor() {
        this.debugMode = false;
        this.appId = '';
        this.logger = console;
    }

    setCustomLogger(customLogger) {
        this.logger = customLogger || this.logger;
    }

    init(pxConfig) {
        this.debugMode = pxConfig.conf.DEBUG_MODE;
        this.appId = pxConfig.conf.PX_APP_ID;
        this.logger = pxConfig.conf.CUSTOM_LOGGER || this.logger;
    }

    debug(msg) {
        if (this.debugMode && msg) {
            this.logger.info(`[PerimeterX - DEBUG][${this.appId}] - ${msg}`);
        }
    }
    
    error(msg) {
        if (typeof msg === 'string') {
            this.logger.error(new Error(`[PerimeterX - ERROR][${this.appId}] - ${msg}`).stack);
        }
    }
}

module.exports = PxLogger;
