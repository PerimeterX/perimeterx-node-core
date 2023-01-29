'use strict';

const net = require('net');
const fs = require('fs');
const crypto = require('crypto');

const { ModuleMode } = require('./enums/ModuleMode');
const { GraphqlData } = require('./models/GraphqlData');
const { EMAIL_ADDRESS_REGEX, HASH_ALGORITHM } = require('./utils/constants');

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
function formatHeaders(headers, sensitiveHeaders) {
    const retval = [];
    try {
        if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
            return retval;
        }

        for (const header in headers) {
            if (header && headers[header] && sensitiveHeaders.indexOf(header) === -1) {
                retval.push({ name: header, value: headers[header] });
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
function filterSensitiveHeaders(headers, sensitiveKeys) {
    try {
        const retval = {};
        for (const key in headers) {
            if (sensitiveKeys.findIndex((item) => key.toLowerCase() === item.toLowerCase()) === -1) {
                retval[key] = headers[key];
            }
        }
        return retval;
    } catch (e) {
        return headers;
    }
}

function generateProxyHeaders(headers, ip, sensitiveHeaders, forwardedForHeader) {
    try {
        const filteredHeaders = filterSensitiveHeaders(headers, sensitiveHeaders);
        const xffHeader = Object.keys(filteredHeaders).find((item) => item.toLowerCase() === forwardedForHeader);
        if (xffHeader) {
            filteredHeaders[xffHeader] += `, ${ip}`;
        } else {
            filteredHeaders[forwardedForHeader] = ip;
        }
        return filteredHeaders;
    } catch (e) {
        return headers;
    }
}

function verifyDefined(...values) {
    return values.every((value) => value !== undefined && value !== null);
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
        LOGGER_SEVERITY: config.LOGGER_SEVERITY,
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
        ADDITIONAL_ACTIVITY_HANDLER: config.ADDITIONAL_ACTIVITY_HANDLER,
    };

    return jsonConfig;
}

/**
 * prepareCustomParams - if there's a enrich custom params handler configured on startup,
 * it will populate to @dict with the proper custom params
 * @param {pxconfig} config - The config object of the application
 * @param {object} dict - the object that should be populated with the custom params
 * @param {object} originalRequest - (optional) original request based on the calling framework
 * */
function prepareCustomParams(config, dict, originalRequest) {
    const customParams = {
        custom_param1: '',
        custom_param2: '',
        custom_param3: '',
        custom_param4: '',
        custom_param5: '',
        custom_param6: '',
        custom_param7: '',
        custom_param8: '',
        custom_param9: '',
        custom_param10: '',
    };
    if (config.ENRICH_CUSTOM_PARAMETERS) {
        const enrichedCustomParams = config.ENRICH_CUSTOM_PARAMETERS(customParams, originalRequest);
        for (const param in enrichedCustomParams) {
            if (param.match(/^custom_param([1-9]|10)$/) && enrichedCustomParams[param] !== '') {
                dict[param] = enrichedCustomParams[param];
            }
        }
    }
}

function extractIP(config, req) {
    let ip;
    if (Array.isArray(config.IP_HEADERS)) {
        config.IP_HEADERS.some((ipHeader) => {
            try {
                const headerValue = req.get(ipHeader);
                if (headerValue) {
                    ip = headerValue;
                    return true;
                }
            } catch (e) {
                config.logger.debug('Failed to use IP_HEADERS from config.');
            }
        });
    } else {
        ip = typeof config.GET_USER_IP === 'function' && config.GET_USER_IP(req);
    }
    if (ip && net.isIP(ip) > 0) {
        return ip;
    }
    return req.ip;
}

function readJsonFile(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function parseCookieHeader(headerValue) {
    const res = {};
    const cookies = headerValue.split(/;\s?/);
    for (const cookie of cookies) {
        const eqIndex = cookie.indexOf('=');
        const key = cookie.substring(0, eqIndex);
        const value = cookie.substring(eqIndex + 1);
        if (key && value) {
            res[key] = value;
        }
    }
    return res;
}

function accessNestedObjectValueByStringPath(path, obj, separator = '.') {
    const properties = Array.isArray(path) ? path : path.split(separator);
    return properties.reduce((prev, curr) => prev && prev[curr], obj);
}

function _hashString(string, hashType) {
    try {
        return crypto.createHash(hashType).update(string).digest('hex');
    } catch (e) {
        return '';
    }
}

function sha256(string) {
    return _hashString(string, HASH_ALGORITHM.SHA256);
}

function isStringMatchWith(string, match) {
    if (match instanceof RegExp) {
        return string.match(match);
    }

    if (typeof match === 'string') {
        return string.toLowerCase() === match.toLowerCase();
    }

    return false;
}

function generateHMAC(cookieSecret, payload) {
    const hmacCreator = crypto.createHmac('sha256', cookieSecret);
    hmacCreator.setEncoding('hex');
    hmacCreator.write(payload);
    hmacCreator.end();
    return hmacCreator.read();
}

function isReqInMonitorMode(pxConfig, pxCtx) {
    return (
        (pxConfig.MODULE_MODE === ModuleMode.MONITOR && !pxCtx.shouldBypassMonitor && !pxCtx.enforcedRoute) ||
        (pxCtx.monitoredRoute && !pxCtx.shouldBypassMonitor)
    );
}

function getTokenObject(cookie, delimiter = ':') {
    if (cookie.indexOf(delimiter) > -1) {
        const [version, ...extractedCookie] = cookie.split(delimiter);
        if (version === '3') {
            return { key: '_px3', value: extractedCookie.join(delimiter) };
        }
        if (version === '1') {
            return { key: '_px', value: extractedCookie.join(delimiter) };
        }
    }
    return { key: '_px3', value: cookie };
}

function isGraphql(req, config) {
    if (req.method.toLowerCase() !== 'post') {
        return false;
    }

    const routes = config['GRAPHQL_ROUTES'];
    if (!Array.isArray(routes)) {
        config.logger.error('Invalid configuration px_graphql_routes');
        return false;
    }
    try {
        return routes.some((r) => new RegExp(r).test(req.baseUrl || '' + req.path));
    } catch (e) {
        config.logger.error(`Failed to process graphql routes. exception: ${e}`);
        return false;
    }
}

// query: string (not null)
// output: Record [ OperationName -> OperationType ]
function parseGraphqlBody(query) {
    const pattern = /\s*(query|mutation|subscription)\s+(\w+)/gm;
    let match;
    const ret = {};
    while ((match = pattern.exec(query)) !== null) {
        const operationName = match[2];
        const operationType = match[1];

        // if two operations have the same name, the query is illegal.
        if (ret[operationName]) {
            return null;
        } else {
            ret[operationName] = operationType;
        }
    }

    return ret;
}

// graphqlData: GraphqlData
// output: boolean
function isSensitiveGraphqlOperation(graphqlData, config) {
    if (!graphqlData) {
        return false;
    } else {
        return (
            config.SENSITIVE_GRAPHQL_OPERATION_TYPES.includes(graphqlData.type) ||
            config.SENSITIVE_GRAPHQL_OPERATION_NAMES.includes(graphqlData.name)
        );
    }
}

// graphqlBodyObject: {query: string?, operationName: string?, variables: any[]?}
// output: GraphqlData?
function getGraphqlData(graphqlBodyObject) {
    if (!graphqlBodyObject || !graphqlBodyObject.query) {
        return null;
    }

    const parsedData = parseGraphqlBody(graphqlBodyObject.query);
    if (!parsedData) {
        return null;
    }

    const selectedOperationName =
        graphqlBodyObject['operationName'] || (Object.keys(parsedData).length === 1 && Object.keys(parsedData)[0]);

    if (!selectedOperationName || !parsedData[selectedOperationName]) {
        return null;
    }

    const variables = extractVariables(graphqlBodyObject.variables);

    return new GraphqlData(parsedData[selectedOperationName], selectedOperationName, variables);
}

// input: object representing variables
// output: list of keys recursively like property file.
function extractVariables(variables) {
    function go(variables, prefix) {
        return Object.entries(variables).reduce((total, [key, value]) => {
            if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
                total.push(prefix + key);
                return total;
            } else {
                return total.concat(go(value, prefix + key + '.'));
            }
        }, []);
    }

    if (!variables || typeof variables !== 'object') {
        return [];
    } else {
        return go(variables, '');
    }
}

function isEmailAddress(str) {
    return EMAIL_ADDRESS_REGEX.test(str);
}

function tryOrNull(fn, exceptionHandler) {
    try {
        return fn();
    } catch (e) {
        if (exceptionHandler) {
            exceptionHandler(e);
        }
        return null;
    }
}

function appendContentType(response, contentTypeValue) {
    response.headers = Object.assign(response.headers || {}, { 'Content-Type': contentTypeValue });
}

module.exports = {
    isSensitiveGraphqlOperation,
    formatHeaders,
    filterSensitiveHeaders,
    checkForStatic,
    verifyDefined,
    filterConfig,
    parseAction,
    generateProxyHeaders,
    prepareCustomParams,
    extractIP,
    readJsonFile,
    parseCookieHeader,
    accessNestedObjectValueByStringPath,
    sha256,
    isStringMatchWith,
    generateHMAC,
    isReqInMonitorMode,
    getTokenObject,
    getGraphqlData,
    isEmailAddress,
    isGraphql,
    tryOrNull,
    appendContentType
};
