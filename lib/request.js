const p = require('agent-phin').unpromisified;
const https = require('https');
const keepAliveAgent = new https.Agent({keepAlive: true});

exports.get = (options, config, cb) => {
    options.method = 'GET';
    return makeRequest(options, config, cb);
};

exports.post = (options, config, cb) => {
    options.method = 'POST';
    if (!options.headers['content-type'] && !options.headers['Content-Type']) {
        options.headers['content-type'] = 'application/json';
    }
    return makeRequest(options, config, cb);
};

function makeRequest(options, config, cb) {
    options.agent = config.agent || keepAliveAgent;
    p(options, cb);
}