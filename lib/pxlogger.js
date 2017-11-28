/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

const pxConfig = require('./pxconfig');

exports.debug = debug;
exports.error = error;

function debug(msg) {
    if (pxConfig.conf.DEBUG_MODE && msg) {
        console.info(`[PerimeterX - DEBUG][${pxConfig.conf.PX_APP_ID}] - ${msg}`);
    }
}

function error(msg) {
    if (typeof msg === 'string') {
        console.error(new Error(`[PerimeterX - ERROR][${pxConfig.conf.PX_APP_ID}] - ${msg}`).stack);
    }
}

