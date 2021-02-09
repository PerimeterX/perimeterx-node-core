const p = require('agent-phin').unpromisified;
const https = require('https');
const http = require('http');
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true });

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
    if (options.url && options.url.startsWith('https://')) {
        options.agent = config.agent || httpsKeepAliveAgent;
    } else {
        options.agent = new http.Agent();
    }
    p(options, cb);
}