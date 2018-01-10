const https = require('http');
const keepAliveAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000 });
let openRequests = [];
const request = {
    get: (options, cb) => {
        options.method = 'GET';
        return makeRequest(options, cb);
    },
    post: (options, cb) => {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/json';
        return makeRequest(options, cb);
    },

    abortAll: () => {
        openRequests.forEach(req => req.abort());
        openRequests = [];
    }
};

function makeRequest(options, cb) {
    if (options.ignoreResponse) {
        return makeRequestWithNoResponse(options);
    }
    options.agent = keepAliveAgent;
    options.encoding = null;
    let data = [];

    const req = https.request(options, (res) => {
        res.on('data', (chunk) => {
            data.push(Buffer.from(chunk));
        });
        res.on('end', () => {
            if (cb) {
                const body = Buffer.concat(data);
                cb(null, res, body);
            }
            let index = openRequests.indexOf(req);
            if (index > -1) {
                openRequests.splice(index, 1);
            }
        });
    });

    req.on('error', (e) => {
        cb(e)
    });
    openRequests.push(req);
    // write data to request body
    if (options.method === 'POST') {
        req.write(options.body);
    }
    req.end();
}

function makeRequestWithNoResponse(options) {
    options.agent = keepAliveAgent;
    const req = https.request(options);
    if (options.method === 'POST') {
        req.write(options.body);
    }
    req.end();
}

module.exports = request;