const PxLogger = require('./pxlogger');
const p = require('agent-phin').unpromisified;
const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true });
let activeAgent = null;

//TODO: This module is a singleton

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
    },
    setAgent: (agent) => activeAgent = agent
};

function makeRequest(options, cb) {
    options.agent = keepAliveAgent;
    if (activeAgent) {
        options.agent = activeAgent;
    }

    try {
        p(options, cb);
    } catch (e) {
        new PxLogger().error(`Error making request: ${e.message}`);
    }
}

module.exports = request;