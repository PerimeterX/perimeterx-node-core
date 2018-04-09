'use strict';

const pxCookie = require('./pxcookie');
const pxApi = require('./pxapi');
const pxLogger = require('./pxlogger');

/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */
exports.verifyUserScore = verifyUserScore;
exports.filterSensitiveHeaders = filterSensitiveHeaders;
exports.formatHeaders = formatHeaders;
exports.checkForStatic = checkForStatic;
exports.verifyDefined = verifyDefined;
exports.filterConfig = filterConfig;
exports.parseAction = parseAction;


/**
 * verifyUserScore - Verify function, evaluate score by cookie and s2s and make the return an action.
 *
 * @param {Object} pxCtx - current request context.
 *        {string} pxCtx.cookie - user's px cookie.
 *        {string} pxCtx.ip - user's ip address.
 *        {Array} pxCtx.headers - array of user's request headers in a name value format. (example: [{name: 'User-Agent', value: 'PhantomJS'}]
 *        {string} pxCtx.uri - current request uri
 * @param {Function} callback - callback function.
 */
function verifyUserScore(pxCtx, callback) {
    const pxConfig = require('./pxconfig').conf;
    const startRiskRtt = Date.now();
    pxCtx.riskRtt = 0;

    try {
        if (!pxCtx.ip || !pxCtx.uri) {
            pxLogger.error('perimeterx score evaluation failed. bad parameters.');
            return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
        }

        let action = pxCookie.evalCookie(pxCtx);
        /* score did not cross threshold - pass traffic */
        if (action === pxConfig.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
            return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
        }

        /* score crossed threshold - block traffic */
        if (action === pxConfig.SCORE_EVALUATE_ACTION.BAD_SCORE) {
            pxCtx.blockReason = "cookie_high_score";
            return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_BLOCK_TRAFFIC);
        }

        /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
        pxApi.evalByServerCall(pxCtx, (action) => {
            pxCtx.riskRtt = Date.now() - startRiskRtt;

            if (action === pxConfig.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT) {
                pxLogger.error('perimeterx score evaluation failed. unexpected error. passing traffic');
                return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
            }

            pxLogger.debug(`Risk API response returned successfully, risk score: ${pxCtx.score}, round_trip_time: ${pxCtx.riskRtt}ms`);

            if (action === pxConfig.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                pxLogger.debug(`Risk score is lower than blocking score. score: ${pxCtx.score} blocking score: ${pxConfig.BLOCKING_SCORE}`);
                return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
            }

            if (action === pxConfig.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                pxLogger.debug(`Risk score is higher or equal to blocking score. score: ${pxCtx.score} blocking score: ${pxConfig.BLOCKING_SCORE}`);
                switch (pxCtx.blockAction) {
                    case 'j':
                        pxCtx.blockReason = 'challenge';
                        break;
                    case 'r':
                        pxCtx.blockReason = 'exceeded_rate_limit';
                        break;
                    default:
                        pxCtx.blockReason = 's2s_high_score';
                }
                return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_BLOCK_TRAFFIC);
            }

            if(action === pxConfig.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS) {
                pxLogger.debug(`Risk API timed out , round_trip_time: ${pxCtx.riskRtt}ms`);
                return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS);
            }
        });
    } catch (e) {
        pxLogger.error('perimeterx score evaluation failed. unexpected error. ' + e.message);
        pxCtx.riskRtt = Date.now() - startRiskRtt;
        return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
    }
}


/**
 * formatHeaders - Build request headers in the server2server format.
 *
 * @param {Object} headers - request headers in key value format.
 * @return {Array} request headers an array format.
 */
function formatHeaders(headers) {
    const pxConfig = require('./pxconfig').conf;
    const retval = [];
    try {
        if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
            return retval;
        }

        for (let header in headers) {
            if (header && headers[header] && pxConfig.SENSITIVE_HEADERS.indexOf(header) === -1) {
                retval.push({name: header, value: headers[header]});
            }
        }
        return retval;
    } catch (e) {
        return retval;
    }
}


/**
 * checkForStatic - check if the request destination is a static file.
 * @param {object} req - the request object
 * @param {Array} exts - list of static file extensions
 *
 * @return {Boolean} true if the target is ststic file/false otherwise.
 */
function checkForStatic(req, exts) {
    const path = req.path;

    for (let i = 0; i < exts.length; i++) {
        if (path.endsWith(exts[i])) {
            return true;
        }
    }

    return false;
}

/**
 * filterSensitiveHeaders - filter headers before sending to perimeterx servers according to user definition.
 * @param {object} headers - the headers object
 *
 * @return {object} filtered headers.
 */
function filterSensitiveHeaders(headers) {
    try {
        const pxConfig = require('./pxconfig').conf;
        const retval = {};

        const sensitiveKeys = pxConfig.SENSITIVE_HEADERS;
        for (let key in headers) {
            if (sensitiveKeys.findIndex(item => key.toLowerCase() === item.toLowerCase()) === -1) {
                retval[key] = headers[key];
            }
        }
        return retval;
    } catch(e) {
        return headers;
    }
}

function verifyDefined(...values) {
    return values.every(value => value !== undefined && value !== null);
}

function parseAction(action) {
    switch (action) {
        case 'c':
            return 'captcha';
        case 'b':
            return 'block';
        case 'j':
            return 'challenge';
         case 'r':
            return 'ratelimit';
        default:
            return 'captcha';
    }
}

function filterConfig(config) {
    let jsonConfig = {
        PX_APP_ID: config.PX_APP_ID,
        ENABLE_MODULE: config.ENABLE_MODULE,
        API_TIMEOUT_MS: config.API_TIMEOUT_MS,
        BLOCKING_SCORE: config.BLOCKING_SCORE,
        IP_HEADERS: config.IP_HEADERS,
        BLOCK_HTML: config.BLOCK_HTML,
        SENSITIVE_HEADERS: config.SENSITIVE_HEADERS,
        PROXY_URL: config.PROXY_URL,
        SEND_PAGE_ACTIVITIES: config.SEND_PAGE_ACTIVITIES,
        DEBUG_MODE: config.DEBUG_MODE,
        CUSTOM_REQUEST_HANDLER: config.CUSTOM_REQUEST_HANDLER,
        MAX_BUFFER_LEN: config.MAX_BUFFER_LEN,
        GET_USER_IP: config.GET_USER_IP,
        CSS_REF: config.CSS_REF,
        JS_REF: config.JS_REF,
        CUSTOM_LOGO: config.CUSTOM_LOGO,
        TEMPLATE: config.TEMPLATE,
        CAPTCHA_PROVIDER: config.CAPTCHA_PROVIDER,
        LOGO_VISIBILITY: config.LOGO_VISIBILITY,
        SENSITIVE_ROUTES: config.SENSITIVE_ROUTES,
        DYNAMIC_CONFIGURATIONS: config.DYNAMIC_CONFIGURATIONS,
        CONFIGURATION_LOAD_INTERVAL: config.CONFIGURATION_LOAD_INTERVAL,
        MODULE_MODE: config.MODULE_MODE,
        ADDITIONAL_ACTIVITY_HANDLER: config.ADDITIONAL_ACTIVITY_HANDLER
    }

    return jsonConfig;
}
