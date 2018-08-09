const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000 });
const pxLogger = require('./pxlogger');
const p = require('phin');

const request = {
    get: (options, cb) => {
        options.method = 'GET';
        return makeRequest(options, cb);
    },
    post: (options, cb) => {
        options.method = 'POST';
        if (!options.headers['content-type'] && !options.headers['Content-Type']) {
            options.headers['content-type'] = 'application/json';
        }
        return makeRequest(options, cb);
    }
};

function makeRequest(options, cb) {
    options.agent = keepAliveAgent;
    try {
        p(options, cb)
    } catch (e) {
        pxLogger.error(`Error making request: ${e.message}`);
    }
}

module.exports = request;