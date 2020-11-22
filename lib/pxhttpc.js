'use strict';

const request = require('./request');

module.exports = {
    callServer
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
    callback = callback || ((err) => { err && config.logger.debug(`callServer default callback. Error: ${err}`); });
    const callData = {
        'url': `${config.BACKEND_URL}${uri}`,
        'data': JSON.stringify(data),
        'headers': headers
    };

    callData.timeout = callType === 'query' ? config.API_TIMEOUT_MS : config.ACTIVITIES_TIMEOUT_MS;

    try {
        request.post(callData, config, function (err, response) {
            console.log(`collector: ${callData.url}`);
            let data;
            if (err) {
                if (err.toString().toLowerCase().includes('timeout')) {
                    return callback('timeout');
                } else {
                    return callback(`perimeterx server did not return a valid response. Error: ${err}`);
                }
            }
            if (typeof(response.body) !== 'undefined' && response.body !== null) {
                data = response.body.toString();
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
