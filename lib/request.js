const p = require('agent-phin').unpromisified;
const https = require('https');
const http = require('http');
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true });

exports.get = (options, config, cb) => {
    options.method = 'GET';
    return makeRequest(options, config, cb);
};

exports.post = (options, config, cb, ctx) => {
    if (ctx && ctx.riskRttLogs) {
        ctx.riskRttLogs += `request.post:${Date.now() - ctx.startRiskRtt};`;
    }
    options.method = 'POST';
    if (!options.headers['content-type'] && !options.headers['Content-Type']) {
        options.headers['content-type'] = 'application/json';
    }
    return makeRequest(options, config, cb, ctx);
};

function makeRequest(options, config, cb, ctx) {
    if (ctx && ctx.riskRttLogs) {
        ctx.riskRttLogs += `makeRequest:${Date.now() - ctx.startRiskRtt};`;
    }
    if (options.url && options.url.startsWith('https://')) {
        options.agent = config.agent || httpsKeepAliveAgent;
    } else {
        options.agent = new http.Agent();
    }
    if (ctx && ctx.riskRttLogs) {
        ctx.riskRttLogs += `beforeP:${Date.now() - ctx.startRiskRtt};`;
    }
    p(options, cb);
    if (ctx && ctx.riskRttLogs) {
        ctx.riskRttLogs += `afterP:${Date.now() - ctx.startRiskRtt};`;
    }
}