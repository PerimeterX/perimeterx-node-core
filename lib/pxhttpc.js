'use strict';
const request = require('./request');
const pxConfig = require('./pxconfig');
const pxLogger = require('./pxlogger');

module.exports = {
    callServer,
    getCaptchaScript
}

/**
 * callServer - call the perimeterx servers.
 *
 * @param {Object} data - data object to pass as POST body
 * @param {Object} headers - http request headers
 * @param {string} uri - px servers endpoint uri
 * @param {string} callType - indication for a query or activities sending
 * @param {Function} callback - callback function.
 */
function callServer(data, headers, uri, callType, ignoreResponse, callback) {
    const config = pxConfig.conf;
    const callData = {
        host: config.SERVER_HOST,
        path: uri,
        body: JSON.stringify(data),
        headers: headers
    };

    callData.timeout = callType === 'query' ? config.API_TIMEOUT_MS : config.ACTIVITIES_TIMEOUT;
    callData.ignoreResponse = ignoreResponse;

    try {
        request.post(callData, function (err, response, data) {
            if (err) {
                if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || err.code === 'ECONNRESET') {
                    return callback('timeout');
                } else {
                    return callback('perimeterx server did not return a valid response');
                }
            }
            if (typeof(data) !== "undefined" && data !== null) {
                data = data.toString();
            }
            if (response && response.statusCode === 200) {
                try {
                    if (typeof data === 'object') {
                        return callback(null, data);
                    } else {
                        return callback(null, JSON.parse(data));
                    }
                } catch (e) {
                    return callback('could not parse perimeterx api server response');
                }
            }
            if (data) {
                try {
                    return callback(`perimeterx server query failed. ${JSON.parse(data).message}`);
                } catch (e) {
                }
            }
            return callback('perimeterx server did not return a valid response');
        });
    } catch (e) {
        return callback('error while calling perimeterx servers');
    }
}

function getCaptchaScript(name, callback) {
    const config = pxConfig.conf;
    const captchaUri = `/${name}.js`;
    let callData = {
        path: captchaUri,
        host: config.CAPTCHA_HOST,
        port: 8081
    }
    try {
        request.get(callData, function (error, response, data) {
            if (error || !response) {
                let err = `Error getting captcha file: ${error || response}`;
                pxLogger.debug(err);
                return callback(err);
            }
            return callback(null, data.toString());
        });
    } catch (e) {
        return callback('error while getting captcha scripts');
    }
}