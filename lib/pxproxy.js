const request = require('./request');
const pxLogger = require('./pxlogger');
const pxUtil = require('./pxutil');
const rawBody = require('raw-body');
const contentType = require('content-type');

function getClient(req, pxConfig, ip, cb) {
     let response = {};
     if (!pxConfig.FIRST_PARTY_ENABLED) {
        response = {
            status: 200,
            header: {key: 'Content-Type', value:'application/javascript'},
            body: ''
        };
        return cb(response);
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
            response = {
                status: 200,
                headers: response.headers,
                body: body
            };
            return cb(response);
        });
    }
    return;
}

function sendXHR(req, pxConfig, ip, reversePrefix, cb) {
    let response = {};
    let vid;
    if (!pxConfig.FIRST_PARTY_ENABLED || !pxConfig.FIRST_PARTY_XHR_ENABLED) {
        if (req.originalUrl.toLowerCase().includes('gif')) {
            response = {
                status: 200,
                header: {key: 'Content-Type', value:'image/gif'},
                body: Buffer.from(pxConfig.EMPTY_GIF_B64, 'base64')
            }
        } else {
            response = {
                status: 200,
                header: {key: 'Content-Type', value:'application/javascript'},
                body: ''
            }
        }
        return cb(response);
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
                response = {
                    status: 200,
                    headers: response.headers,
                    body: body
                }
                return cb(response);
            });
        } else if (req.method === "GET") {
            request.get(callData, (error, response, body) => {
                response = {
                    status: 200,
                    headers: response.headers,
                    body: body
                }
                return cb(response);
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
            resolve();
        }
    });
}

module.exports = {
    getClient,
    sendXHR
}