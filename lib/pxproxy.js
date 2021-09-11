const rawBody = require('raw-body');
const contentType = require('content-type');
const request = require('./request');
const pxUtil = require('./pxutil');
const { 
    FIRST_PARTY_XHR_PATH,
    FIRST_PARTY_CAPTCHA_PATH,
    DEFAULT_CAPTCHA_HOST,
    FIRST_PARTY_HEADER,
    ENFORCER_TRUE_IP_HEADER,
    DEFAULT_CLIENT_HOST,
    EMPTY_GIF_B64,
    FORWARDED_FOR_HEADER,
    DEFAULT_COLLECTOR_HOST
} = require('./utils/constants');

function handleFirstPartyDisabled(callback, responseStatus = 200, contentType = 'application/javascript', responseBody = '') {
    const res = {
        status: responseStatus,
        header: { key: 'Content-Type', value: contentType },
        body: responseBody
    };
    return callback(null, res);
}

function createFirstPartyCallData(headers, s2sTimeoutMs, host, uri, ip) {
    const callData = {
        url: `https://${host}${uri}`,
        headers: headers,
        timeout: s2sTimeoutMs
    };
    callData.headers['host'] = host;
    callData.headers[ENFORCER_TRUE_IP_HEADER] = ip;
    callData.headers[FIRST_PARTY_HEADER] = 1;
    return callData;
}

function executeFirstPartyRequest(callData, pxConfig, callback) {
    request.get(callData, pxConfig.ProxyAgent, (error, response) => {
        if (error || !response) {
            pxConfig.Logger.error(`Error while fetching first party request: ${error}`);
        }

        response = response || { statusCode: 200, headers: {}};
        const res = {
            status: response.statusCode,
            headers: response.headers,
            body: response.body || ''
        };
        return callback(null, res);
    });
}

/**
 * getClient - process the proxy request to get the captcha script file from PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} pxConfig - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {string} reversePrefix - the prefix of the xhr request.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response (captcha file) or error.
 *
 */
function getCaptcha(req, pxConfig, ip, reversePrefix, cb) {
    const {
        px_app_id,
        px_s2s_timeout,
        px_first_party_enabled,
        px_sensitive_headers
    } = pxConfig.Config;

    if (!px_first_party_enabled) {
        return handleFirstPartyDisabled(cb);
    } else {
        const searchMask = `/${reversePrefix}${FIRST_PARTY_CAPTCHA_PATH}`;
        const regEx = new RegExp(searchMask, 'ig');
        const pxRequestUri =  `/${px_app_id}${req.originalUrl.replace(regEx, '')}`;

        pxConfig.Logger.debug(`Forwarding request from ${req.originalUrl} to xhr at ${DEFAULT_CAPTCHA_HOST}${pxRequestUri}`);
        const headers = pxUtil.filterSensitiveHeaders(req.headers, px_sensitive_headers);
        const callData = createFirstPartyCallData(headers, px_s2s_timeout, DEFAULT_CAPTCHA_HOST, pxRequestUri, ip);
        executeFirstPartyRequest(callData, pxConfig, cb);
    }
}

/**
 * getClient - process the proxy request to get the client file from PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} pxConfig - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response (client file) or error.
 *
 */
function getClient(req, pxConfig, ip, cb) {
    const {
        px_app_id,
        px_s2s_timeout,
        px_first_party_enabled,
        px_sensitive_headers
    } = pxConfig.Config;
    if (!px_first_party_enabled) {
        return handleFirstPartyDisabled(cb);
    } else {
        const clientRequestUri = `/${px_app_id}/main.min.js`;

        pxConfig.Logger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to client at ${DEFAULT_CLIENT_HOST}${clientRequestUri}`);
        const headers = pxUtil.filterSensitiveHeaders(req.headers, px_sensitive_headers);
        const callData = createFirstPartyCallData(headers, px_s2s_timeout, DEFAULT_CLIENT_HOST, clientRequestUri, ip);
        executeFirstPartyRequest(callData, pxConfig, cb);
    }
}

/**
 * sendXHR - process the proxy request for sending activities to PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} config - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {string} reversePrefix - the prefix of the xhr request.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response or error.
 *
 */
function sendXHR(req, pxConfig, ip, reversePrefix, cb) {
    let vid;
    const {
        px_s2s_timeout,
        px_first_party_enabled,
        px_sensitive_headers
    } = pxConfig.Config;
    if (!px_first_party_enabled) {
        if (req.originalUrl.toLowerCase().includes('gif')) {
            return handleFirstPartyDisabled(cb, 200, 'image/gif', Buffer.from(EMPTY_GIF_B64, 'base64'));
        } else {
            return handleFirstPartyDisabled(cb, 200, 'application/json', {});
        }
    }

    // handle proxy
    parseBody(req, pxConfig.Logger).then(() => {
        const searchMask = `/${reversePrefix}${FIRST_PARTY_XHR_PATH}`;
        const regEx = new RegExp(searchMask, 'ig');
        const pxRequestUri = req.originalUrl.replace(regEx, '');
        pxConfig.Logger.debug(`Forwarding request from ${req.originalUrl} to xhr at ${DEFAULT_COLLECTOR_HOST}${pxRequestUri}`);
        const headers = pxUtil.generateProxyHeaders(req.headers, req.ip, px_sensitive_headers, FORWARDED_FOR_HEADER);
        const callData = createFirstPartyCallData(headers, px_s2s_timeout, DEFAULT_COLLECTOR_HOST, pxRequestUri, ip);

        if (req.rawBody) {
            callData.headers['content-length'] = Buffer.byteLength(req.rawBody); // makes sure the length of the body is correct, as the body might go trough different body parsers.
            callData.data = req.rawBody;
        }

        // handle vid cookies
        if (req.cookies) {
            if (req.cookies['_pxvid']) {
                vid = req.cookies['_pxvid'];
            } else if (req.cookies['pxvid']) {
                vid = req.cookies['pxvid'];
            }

            if (vid) {
                if (callData.headers['cookie']) {
                    callData.headers['cookie'] += `; pxvid=${vid}`;
                } else {
                    callData.headers['cookie'] = `pxvid=${vid}`;
                }
            }
        }

        if (req.method === 'POST') {
            request.post(callData, pxConfig.ProxyAgent, (error, response) => {
                let res;
                if (error || !response || response.statusCode >= 400) {
                    if (req.originalUrl.toLowerCase().includes('/beacon')) {
                        res = {
                            status: 200,
                            body: ''
                        };
                    } else {
                        res = {
                            status: 200,
                            header: { key: 'Content-Type', value:'application/json' },
                            body: {}
                        };
                    }
                } else {
                    res = {
                        status: response.statusCode,
                        headers: response.headers,
                        body: response.body || ''
                    };
                }
                return cb(null, res);
            });
        } else if (req.method === 'GET') {
            request.get(callData, pxConfig.ProxyAgent, (error, response) => {
                let res;
                if (error || !response || response.statusCode >= 400) {
                    if (req.originalUrl.toLowerCase().includes('.gif')) {
                        res = {
                            status: 200,
                            header: { key: 'Content-Type', value:'image/gif' },
                            body: Buffer.from(EMPTY_GIF_B64, 'base64')
                        };
                    } else {
                        res = {
                            status: 200,
                            body: ''
                        };
                    }
                } else {
                    res = {
                        status: response.statusCode,
                        headers: response.headers,
                        body: response.body || ''
                    };
                }
                return cb(null, res);
            });
        }
        return;
    });
}

function parseBody(req, pxLogger) {
    return new Promise((resolve) => {
        try {
            if (req.method === 'GET') {
                return resolve();
            }
            if (!req.body) {
                rawBody(req, {
                    length: req.headers['content-length'],
                    limit: '1mb',
                    encoding: contentType.parse(req).parameters.charset
                }, function (err, string) {
                    if (err) {
                        pxLogger.debug(`Could not parse raw request body. limit: ${err.limit} encoding: ${err.encoding} status: ${err.status} error type: ${err.type}`);
                        return resolve();
                    }
                    req.rawBody = string.toString();
                    resolve();
                });
            } else {
                if (typeof(req.body) === 'object') {
                    if (req.headers['content-type'] === 'application/json') {
                        req.rawBody = JSON.stringify(req.body);
                    } else {
                        const result = [];
                        for (const key in req.body) {
                            result.push(`${key}=${req.body[key]}`);
                        }
                        req.rawBody = result.join('&');
                    }
                    resolve();
                } else {
                    req.rawBody = req.body;
                    resolve();
                }
            }
        } catch (e) {
            pxLogger.debug(`Error parsing request body: ${e.message}, ${e.stack}`);
            resolve();
        }
    });
}

module.exports = {
    getClient,
    sendXHR,
    getCaptcha
};
