const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000 });
const pxLogger = require('./pxlogger');
const pxConfig = require('./pxconfig').conf;
const requestHandler = require('request');

//const HttpsProxyAgent = require('https-proxy-agent');

const request = {

    get: (options, cb) => {
        try {
            options.agent = keepAliveAgent;
            return requestHandler.get(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    response.body = body;
                    cb(error, response);
                }
            });
        } catch (e) {
            pxLogger.error(`Error making request: ${e.message}`);
        }

    },
    post: (options, cb) => {
        try {
            options.agent = keepAliveAgent;
            return requestHandler.post(options, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    response.body = body;
                    cb(error, response);
                }
            });
        } catch (e) {
            pxLogger.error(`Error making request: ${e.message}`);
        }
    }
};

module.exports = request;