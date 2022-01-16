const request = require('./request');
const pxUtil = require('./pxutil');
const rawBody = require('raw-body');
const contentType = require('content-type');


function handleFirstPartyDisabled(firstPartyConfig, cb) {
    if (!firstPartyConfig) {
        const res = {
            status: 200,
            header: { key: 'Content-Type', value: 'application/javascript' },
            body: ''
        };
        return cb(null, res);
    }
}

/**
 * getClient - process the proxy request to get the captcha script file from PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} config - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {string} reversePrefix - the prefix of the xhr request.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response (captcha file) or error.
 *
 */
function getCaptcha(req, config, ip, reversePrefix, cb) {
    handleFirstPartyDisabled(config.FIRST_PARTY_ENABLED, cb);
    let res = {};
    const searchMask = `/${reversePrefix}${config.FIRST_PARTY_CAPTCHA_PATH}`;
    const regEx = new RegExp(searchMask, 'ig');
    const pxRequestUri =  `/${config.PX_APP_ID}${req.originalUrl.replace(regEx, '')}`;
    config.logger.debug(`Forwarding request from ${req.originalUrl} to xhr at ${config.CAPTCHA_HOST}${pxRequestUri}`);
    const callData = {
        url: `https://${config.CAPTCHA_HOST}${pxRequestUri}`,
        headers: pxUtil.filterSensitiveHeaders(req.headers, config.SENSITIVE_HEADERS),
        timeout: config.API_TIMEOUT_MS
    };
    callData.headers['host'] = config.CAPTCHA_HOST;
    callData.headers[config.ENFORCER_TRUE_IP_HEADER] = ip;
    callData.headers[config.FIRST_PARTY_HEADER] = 1;
    request.get(callData, config, (error, response) => {
        if (error || !response) {
            config.logger.error(`Error while fetching first party captcha: ${error}`);
        }

        response = response || { statusCode: 200, headers: {}};
        res = {
            status: response.statusCode,
            headers: response.headers,
            body: response.body || ''
        };
        return cb(null, res);
    });

    return;
}

/**
 * getClient - process the proxy request to get the client file from PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} config - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response (client file) or error.
 *
 */
function getClient(req, config, ip, cb) {
    handleFirstPartyDisabled(config.FIRST_PARTY_ENABLED, cb);
    let res = {};
    const clientRequestUri = `/${config.PX_APP_ID}/main.min.js`;
    config.logger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to client at ${config.CLIENT_HOST}${clientRequestUri}`);
    const callData = {
        url: `https://${config.CLIENT_HOST}${clientRequestUri}`,
        headers: pxUtil.filterSensitiveHeaders(req.headers, config.SENSITIVE_HEADERS),
        timeout: config.API_TIMEOUT_MS
    };
    callData.headers['host'] = config.CLIENT_HOST;
    callData.headers[config.ENFORCER_TRUE_IP_HEADER] = ip;
    callData.headers[config.FIRST_PARTY_HEADER] = 1;
    request.get(callData, config, (error, response) => {
        if (error || !response) {
            config.logger.error(`Error while fetching first party client: ${error}`);
        }

        response = response || { statusCode: 200, headers: {}};
        res = {
            status: response.statusCode,
            headers: response.headers,
            body: response.body || ''
        };
        return cb(null, res);
    });
    return;
}

function getCDClient(req, config, ip, cb) {
    handleFirstPartyDisabled(config.CD_FIRST_PARTY_ENABLED, cb);
    let res = {};
    const clientRequestUri = `/${config.PX_APP_ID}/api.js`;
    config.logger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to client at ${config.CLIENT_HOST}${clientRequestUri}`);
    const callData = {
        url: `https://${config.CD_CLIENT_HOST}${clientRequestUri}`,
        headers: pxUtil.filterSensitiveHeaders(req.headers, config.SENSITIVE_HEADERS),
        timeout: config.API_TIMEOUT_MS
    };
    callData.headers['host'] = config.CD_CLIENT_HOST;
    callData.headers[config.ENFORCER_TRUE_IP_HEADER] = ip;
    callData.headers[config.FIRST_PARTY_HEADER] = 1;
    request.get(callData, config, (error, response) => {
        if (error || !response) {
            config.logger.error(`Error while fetching first party CD client: ${error}`);
        }

        response = response || { statusCode: 200, headers: {}};
        res = {
            status: response.statusCode,
            headers: response.headers,
            body: response.body || ''
        };
        return cb(null, res);
    });
}

function sendCDXHR(req, config, ip, reversePrefix, cb) {
    handleFirstPartyDisabled(config.CD_FIRST_PARTY_ENABLED, cb);
    let res = {};
    parseBody(req, config.logger).then(() => {
        const searchMask = `/${reversePrefix}${config.FIRST_PARTY_CD_XHR_PATH}`;
        const regEx = new RegExp(searchMask, 'ig');
        const xhrRequestUri = req.originalUrl.replace(regEx, '');
        config.logger.debug(`Forwarding request from ${req.originalUrl} to xhr at ${config.CD_XHR_HOST}${xhrRequestUri}`);

        const callData = {
            url: `https://${config.CD_XHR_HOST}${xhrRequestUri}`,
            headers: pxUtil.generateProxyHeaders(req.headers, req.ip, config.SENSITIVE_HEADERS, config.FORWARDED_FOR_HEADER),
            timeout: config.API_TIMEOUT_MS
        };

        callData.headers['host'] = config.CD_XHR_HOST;
        callData.headers[config.ENFORCER_TRUE_IP_HEADER] = ip;
        callData.headers[config.FIRST_PARTY_HEADER] = 1;
        if (req.rawBody) {
            callData.headers['content-length'] = Buffer.byteLength(req.rawBody);
            callData.data = req.rawBody;
        }

        if (req.method === 'POST') {
            request.post(callData, config, (error, response) => {
                if (error || !response || response.statusCode >= 400) {
                    res = { status: 200, header: { key: 'Content-Type', value: 'application/json' }, body: {} };
                } else {
                    res = { status: response.statusCode, headers: response.headers, body: response.body || '' };
                }
                return cb(null, res);
            });
        } else {
            const res = { status: 200, body: '' };
            return cb(null, res);
        }
    });
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
function sendXHR(req, config, ip, reversePrefix, cb) {
    let res = {};
    let vid;
    if (!config.FIRST_PARTY_ENABLED || !config.FIRST_PARTY_XHR_ENABLED) {
        if (req.originalUrl.toLowerCase().includes('gif')) {
            res = {
                status: 200,
                header: { key: 'Content-Type', value:'image/gif' },
                body: Buffer.from(config.EMPTY_GIF_B64, 'base64')
            };
        } else {
            res = {
                status: 200,
                header: { key: 'Content-Type', value:'application/json' },
                body: {}
            };
        }
        return cb(null, res);
    }

    // handle proxy
    parseBody(req, config.logger).then(() => {
        const searchMask = `/${reversePrefix}${config.FIRST_PARTY_XHR_PATH}`;
        const regEx = new RegExp(searchMask, 'ig');
        const pxRequestUri = req.originalUrl.replace(regEx, '');
        config.logger.debug(`Forwarding request from ${req.originalUrl} to xhr at ${config.COLLECTOR_HOST}${pxRequestUri}`);

        const callData = {
            url: `https://${config.COLLECTOR_HOST}${pxRequestUri}`,
            headers: pxUtil.generateProxyHeaders(req.headers, req.ip, config.SENSITIVE_HEADERS, config.FORWARDED_FOR_HEADER),
            timeout: config.API_TIMEOUT_MS
        };

        callData.headers['host'] = config.COLLECTOR_HOST;
        callData.headers[config.ENFORCER_TRUE_IP_HEADER] = ip;
        callData.headers[config.FIRST_PARTY_HEADER] = 1;
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
            request.post(callData, config, (error, response) => {
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
            request.get(callData, config, (error, response) => {
                if (error || !response || response.statusCode >= 400) {
                    if (req.originalUrl.toLowerCase().includes('.gif')) {
                        res = {
                            status: 200,
                            header: { key: 'Content-Type', value:'image/gif' },
                            body: Buffer.from(config.EMPTY_GIF_B64, 'base64')
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
    getCDClient,
    sendXHR,
    sendCDXHR,
    getCaptcha
};