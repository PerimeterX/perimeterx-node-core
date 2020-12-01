/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

class PxLogger {
  constructor(params) {
    this.debugMode = params.debugMode || false;
    this.appId = params.pxAppId || "PX_APP_ID";
    this.internalLogger = params.customLogger || console;
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
