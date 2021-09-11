const p = require('agent-phin').unpromisified;
const https = require('https');
const http = require('http');
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true });

exports.get = (options, agent, cb) => {
    options.method = 'GET';
    return makeRequest(options, agent, cb);
};

exports.post = (options, agent, cb) => {
    options.method = 'POST';
    if (!options.headers['content-type'] && !options.headers['Content-Type']) {
        options.headers['content-type'] = 'application/json';
    }
    return makeRequest(options, agent, cb);
};

function makeRequest(options, agent, cb) {
    if (options.url && options.url.startsWith('https://')) {
        options.agent = agent || httpsKeepAliveAgent;
    } else {
        options.agent = new http.Agent();
    }
    p(options, cb);
}