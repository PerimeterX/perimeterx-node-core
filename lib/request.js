const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000 });
const pxLogger = require('./pxlogger');

let openRequests = [];
const request = {
    get: (options, cb) => {
        options.method = 'GET';
        return makeRequest(options, cb);
    },
    post: (options, cb) => {
        options.method = 'POST';
        if (!options.headers['content-type']) {
            options.headers['content-type'] = 'application/json';
        }
        return makeRequest(options, cb);
    },

    abortAll: () => {
        openRequests.forEach(req => req.abort());
        openRequests = [];
    }
};

function makeRequest(options, cb) {
    try {
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
                    const body = options.keepAsBuffer ? Buffer.concat(data) : Buffer.concat(data).toString();
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
    } catch (e) {
        pxLogger.error(`Error making request: ${e.message}`);
    }
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