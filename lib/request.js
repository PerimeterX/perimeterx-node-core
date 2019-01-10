const pxLogger = require('./pxlogger');
const p = require('agent-phin').unpromisified;
const pxConfig = require('./pxconfig');
const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true });

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
    if (pxConfig.conf.agent) {
        options.agent = pxConfig.conf.agent;
    } else {
        options.agent = keepAliveAgent;
    }

    try {
        p(options, cb);
    } catch (e) {
        pxLogger.error(`Error making request: ${e.message}`);
    }
}

module.exports = request;