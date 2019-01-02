'use strict';

/**
 * PerimeterX (http://www.perimeterx.com) NodeJS-Express SDK
 * Version 1.0 Published 12 May 2016
 */

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

        for (const header in headers) {
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
        for (const key in headers) {
            if (sensitiveKeys.findIndex(item => key.toLowerCase() === item.toLowerCase()) === -1) {
                retval[key] = headers[key];
            }
        }
        return retval;
    } catch(e) {
        return headers;
    }
}

function generateProxyHeaders(headers, ip) {
    try {
        const pxConfig = require('./pxconfig').conf;
        const filteredHeaders = filterSensitiveHeaders(headers);
        const xffHeader = Object.keys(filteredHeaders).find(item => item.toLowerCase() === pxConfig.FORWARDED_FOR_HEADER);
        if (xffHeader) {
            filteredHeaders[xffHeader] += `, ${ip}`;
        } else {
            filteredHeaders[pxConfig.FORWARDED_FOR_HEADER] = ip;
        }
        return filteredHeaders;
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
    const jsonConfig = {
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
        LOGO_VISIBILITY: config.LOGO_VISIBILITY,
        SENSITIVE_ROUTES: config.SENSITIVE_ROUTES,
        DYNAMIC_CONFIGURATIONS: config.DYNAMIC_CONFIGURATIONS,
        CONFIGURATION_LOAD_INTERVAL: config.CONFIGURATION_LOAD_INTERVAL,
        MODULE_MODE: config.MODULE_MODE,
        ADDITIONAL_ACTIVITY_HANDLER: config.ADDITIONAL_ACTIVITY_HANDLER
    };

    return jsonConfig;
}

/**
 * prepareCustomParams - if there's a enrich custom params handler configured on startup,
 * it will populate to @dict with the proper custom params
 * @param {pxconfig} config - The config object of the application
 * @param {object} dict - the object that should be populated with the custom params
 * */
function prepareCustomParams(config, dict) {
    const customParams = {
        'custom_param1': '',
        'custom_param2': '',
        'custom_param3': '',
        'custom_param4': '',
        'custom_param5': '',
        'custom_param6': '',
        'custom_param7': '',
        'custom_param8': '',
        'custom_param9': '',
        'custom_param10': ''
    };
    if (config.ENRICH_CUSTOM_PARAMETERS) {
        const enrichedCustomParams = config.ENRICH_CUSTOM_PARAMETERS(customParams);
        for (const param in enrichedCustomParams) {
            if (param.match(/^custom_param([1-9]|10)$/) && enrichedCustomParams[param] !== '') {
                dict[param] = enrichedCustomParams[param];
            }
        }
    }
}


module.exports = {
    formatHeaders,
    filterSensitiveHeaders,
    checkForStatic,
    verifyDefined,
    filterConfig,
    parseAction,
    generateProxyHeaders,
    prepareCustomParams,
};
