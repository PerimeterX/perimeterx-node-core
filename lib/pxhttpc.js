'use strict';

const request = require('./request');
const S2SErrorReason = require('./enums/S2SErrorReason');
const S2SErrorInfo = require('./models/S2SErrorInfo');

module.exports = {
    callServer,
};

/**
 * callServer - call the perimeterx servers.
 *
 * @param {Object} data - data object to pass as POST body
 * @param {Object} headers - http request headers
 * @param {string} uri - px servers endpoint uri
 * @param {string} callType - indication for a query or activities sending
 * @param {Function} callback - callback function.
 */
function callServer(data, headers, uri, callType, config, callback) {
    callback =
        callback ||
        ((err) => {
            err && config.logger.debug(`callServer default callback. Error: ${JSON.stringify(err)}`);
        });
    const callData = {
        url: `${config.BACKEND_URL}${uri}`,
        data: JSON.stringify(data),
        headers: headers,
    };

    callData.timeout = callType === 'query' ? config.API_TIMEOUT_MS : config.ACTIVITIES_TIMEOUT_MS;

    try {
        request.post(callData, config, function (err, response) {
            if (err) {
                if (err.toString().toLowerCase().includes('timeout')) {
                    return callback('timeout');
                } else {
                    return handleError(callback, S2SErrorReason.UNKNOWN_ERROR, `encountered error with risk api call: ${err}`, response);
                }
            }

            if (!response) {
                return handleError(
                    callback,
                    S2SErrorReason.UNKNOWN_ERROR,
                    `call to perimeterx server returned null or empty response: ${response}`,
                    response
                );
            }

            if (response.statusCode === 200) {
                return handleOkResponse(callback, response);
            }

            return handleUnexpectedHttpResponse(callback, response);
        });
    } catch (e) {
        const s2sErrorReason = S2SErrorReason.UNABLE_TO_SEND_REQUEST;
        return handleError(callback, s2sErrorReason, `error while calling perimeterx servers: ${e}`, null);
    }
}

const handleOkResponse = (callback, response) => {
    let data = getDataFromResponse(response);

    if (!data) {
        return handleError(callback, S2SErrorReason.INVALID_RESPONSE, `unable to get data from response body: ${response.body}`, response);
    }

    if (typeof data !== 'object') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            return handleError(callback, S2SErrorReason.INVALID_RESPONSE, `error parsing response body - ${data}: ${e}`, response);
        }
    }

    if (data.status && data.status !== 0) {
        return handleError((err) => callback(err, data), S2SErrorReason.REQUEST_FAILED_ON_SERVER, data.message, response);
    }

    return callback(null, data);
};

const getDataFromResponse = (res) => {
    if (!res || !res.body) {
        return null;
    }

    const data = res.body.toString();
    if (!data || data.length === 0 || data === '{}' || data === 'null') {
        return null;
    }

    return data;
};

const handleUnexpectedHttpResponse = (callback, response) => {
    let errorReason = S2SErrorReason.UNKNOWN_ERROR;
    let errorMessage = 'unexpected http status code received from perimeterx server';
    const resBody = response.body ? response.body.toString() : '';

    if (response.statusCode >= 500 && response.statusCode < 600) {
        errorReason = S2SErrorReason.SERVER_ERROR;
        errorMessage = `perimeterx server error ${resBody}`;
    } else if (response.statusCode >= 400 && response.statusCode < 500) {
        errorReason = S2SErrorReason.BAD_REQUEST;
        errorMessage = `perimeterx server received bad risk api call ${resBody}`;
    }

    return handleError(callback, errorReason, errorMessage, response);
};

const handleError = (callback, errorReason, errorMessage, response) => {
    const s2sError = response
        ? new S2SErrorInfo(errorReason, errorMessage, response.statusCode, response.statusMessage)
        : new S2SErrorInfo(errorReason, errorMessage);
    return callback(s2sError);
};
