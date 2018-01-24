const request = require('./request');
const pxLogger = require('./pxlogger');
const pxUtil = require('./pxutil');
const rawBody = require('raw-body');
const contentType = require('content-type');

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
     let res = {};
     if (!pxConfig.FIRST_PARTY_ENABLED) {
        res = {
            status: 200,
            header: {key: 'Content-Type', value:'application/javascript'},
            body: ''
        };
        return cb(null, res);
    } else {
        const clientRequestUri = `/${pxConfig.PX_APP_ID}/main.min.js`;
        pxLogger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to client at ${pxConfig.CLIENT_HOST}${clientRequestUri}`);
        let callData = {
            path: clientRequestUri,
            headers: pxUtil.filterSensitiveHeaders(req.headers),
            host: pxConfig.CLIENT_HOST
        }
        callData.headers['host'] = pxConfig.CLIENT_HOST;
        callData.headers[pxConfig.ENFORCER_TRUE_IP_HEADER] = ip;
        callData.headers[pxConfig.FIRST_PARTY_HEADER] = 1;
        callData.keepAsBuffer = true;
        request.get(callData, (error, response, body) => {
            try {
                res = {
                    status: 200,
                    headers: response.headers,
                    body: body
                };
                return cb(null, res);
            } catch (e) {
                pxLogger.debug(`Error getting client file: ${e.message}`);
                return cb(e);
            }
        });
    }
    return;
}

/**
 * sendXHR - process the proxy request for sending activities to PX servers.
 *
 * @param {object} req - the request object.
 * @param {object} pxConfig - the PerimeterX config object.
 * @param {string} ip - the ip that initiated the call.
 * @param {string} reversePrefix - the prefix of the xhr requests.
 * @param {function} cb - the callback function to call at the end of the process.
 *
 * @return {function} the callback function passed as param with the server response or error.
 *
 */
function sendXHR(req, pxConfig, ip, reversePrefix, cb) {
    let res = {};
    let vid;
    if (!pxConfig.FIRST_PARTY_ENABLED || !pxConfig.FIRST_PARTY_XHR_ENABLED) {
        if (req.originalUrl.toLowerCase().includes('gif')) {
            res = {
                status: 200,
                header: {key: 'Content-Type', value:'image/gif'},
                body: Buffer.from(pxConfig.EMPTY_GIF_B64, 'base64')
            }
        } else {
            res = {
                status: 200,
                header: {key: 'Content-Type', value:'application/javascript'},
                body: ''
            }
        }
        return cb(null, res);
    }

    // handle proxy
    parseBody(req).then(() => {
        let pxRequestUri = req.originalUrl.toLowerCase().replace(`/${reversePrefix}${pxConfig.FIRST_PARTY_XHR_PATH}`, '');
        pxLogger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to xhr at ${pxConfig.COLLECTOR_HOST}${pxRequestUri}`);

        let callData = {
            path: pxRequestUri,
            headers: pxUtil.filterSensitiveHeaders(req.headers),
            host: pxConfig.COLLECTOR_HOST
        }
        callData.headers['host'] = pxConfig.COLLECTOR_HOST;
        callData.headers['content-length'] = Buffer.byteLength(req.rawBody);
        callData.headers[pxConfig.ENFORCER_TRUE_IP_HEADER] = ip;
        callData.headers[pxConfig.FIRST_PARTY_HEADER] = 1;
        callData.body = req.rawBody;

        // handle vid cookies
        if (req.cookies) {
            if (req.cookies['_pxvid']) {
                vid = req.cookies['_pxvid'];
            } else if (req.cookies['vid']) {
                vid = req.cookies['vid'];
            }

            if (vid) {
                if (callData.headers['cookie']) {
                    callData.headers['cookie'] += `; vid=${vid}`;
                } else {
                    callData.headers['cookie'] = `vid=${vid}`;
                }
            }
        }
        if (req.method === "POST") {
            request.post(callData, (error, response, body) => {
               try {
                    res = {
                        status: 200,
                        headers: response.headers,
                        body: body
                    }
                    return cb(null, res);
               } catch (e) {
                    pxLogger.debug(`Error posting XHR requests: ${e.message}`);
                    return cb(e)
               }
            });
        } else if (req.method === "GET") {
            request.get(callData, (error, response, body) => {
                try {
                    res = {
                        status: 200,
                        headers: response.headers,
                        body: body
                    }
                    return cb(null, res);
                } catch (e) {
                    pxLogger.debug(`Error posting XHR requests: ${e.message}`);
                    return cb(e);
                }
            });
        }
        return;
    })
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        try {
            if (!req.body) {
                rawBody(req, {
                    length: req.headers['content-length'],
                    limit: '1mb',
                    encoding: contentType.parse(req).parameters.charset
                  }, function (err, string) {
                    req.rawBody = string.toString();
                    resolve();
                })
            }
            else {
                if (typeof(req.body) === "object") {
                    let result = [];
                    for (key in req.body) {
                        result.push(`${key}=${req.body[key]}`);
                    }
                    req.rawBody = result.join('&');
                    resolve();
                } else {
                    req.rawBody = req.body;
                    resolve();
                }
            }
        } catch (e) {
            pxLogger.debug(`Error parsing request body: ${e.message}`);
            resolve();
        }
    });
}

module.exports = {
    getClient,
    sendXHR
}
