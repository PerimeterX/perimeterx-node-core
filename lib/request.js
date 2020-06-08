const p = require('agent-phin').unpromisified;
const https = require('https');
const httpsKeepAliveAgent = new https.Agent({keepAlive: true});
const http = require('http');
const httpKeepAliveAgent = new http.Agent({keepAlive: true});

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
    if (options.url && options.url.startsWith('http://'))
        options.agent = httpKeepAliveAgent
    else
        options.agent = config.agent || httpsKeepAliveAgent;
    p(options, cb);
}