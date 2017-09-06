const https = require('https');
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
    options.agent = keepAliveAgent;
    let data = '';
    const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            if (cb) {
                cb(null, res, data);
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

module.exports = request;