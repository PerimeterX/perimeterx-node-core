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
            let serverResponse;
            let body = Buffer.from('');
            requestHandler(options).on('response', function(response) {
                if (response.statusCode === 200) {
                    serverResponse = response;
                    //cb('', response);
                }
            }).on('error', function(error) {
                cb(error, null);
            }).on('data', function(data) {
                body = Buffer.concat([body, data]);
            }).on('end', function() {
                serverResponse.body = body;
                cb(null, serverResponse);
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