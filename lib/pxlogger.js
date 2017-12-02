/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

module.exports = {
    error: error,
    debug: debug
}

function debug(msg) {
    const pxConfig = require('./pxconfig');
    if (pxConfig.conf.DEBUG_MODE && msg) {
        console.info(`[PerimeterX - DEBUG][${pxConfig.conf.PX_APP_ID}] - ${msg}`);
    }
}

function error(msg) {
    const pxConfig = require('./pxconfig');
    if (typeof msg === 'string') {
        console.error(new Error(`[PerimeterX - ERROR][${pxConfig.conf.PX_APP_ID}] - ${msg}`).stack);
    }
}

