/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

class PxLogger {
  constructor() {
    this.debugMode = false;
    this.appId = "";
    this.internalLogger = console;
  }

  setCustomLogger(customLogger) {
    this.internalLogger = customLogger || this.internalLogger;
  }

  init(pxConfig) {
    this.debugMode = pxConfig.conf.DEBUG_MODE;
    this.appId = pxConfig.conf.PX_APP_ID;
    this.internalLogger = pxConfig.conf.CUSTOM_LOGGER || this.internalLogger;
  }

  debug(msg) {
    if (this.debugMode && msg) {
      this.internalLogger.info(`[PerimeterX - DEBUG][${this.appId}] - ${msg}`);
    }
  }

  error(msg) {
    if (typeof msg === "string") {
      this.internalLogger.error(
        new Error(`[PerimeterX - ERROR][${this.appId}] - ${msg}`).stack
      );
    }
  }
}

module.exports = PxLogger;
