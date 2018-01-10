const request = require('./request');
const pxLogger = require('./pxlogger');

function getClient(req, pxConfig, ip, cb) {
     let response = {};
     if (!pxConfig.FIRST_PARTY_ENABLED) {
        response = {
            status: 200,
            header: {key: 'Content-Type', value:'application/javascript'},
            body: ''
        };
        return cb(response);
    } else {
        const clientRequestUri = `/${pxConfig.PX_APP_ID}/main.min.js`;
        pxLogger.debug(`Forwarding request from ${req.originalUrl.toLowerCase()} to client at ${pxConfig.CLIENT_HOST}${clientRequestUri}`);
        let callData = {
            path: clientRequestUri,
            headers: req.headers,
            host: pxConfig.CLIENT_HOST
        }
        callData.headers['host'] = pxConfig.CLIENT_HOST;
        callData.headers[pxConfig.ENFORCER_TRUE_IP_HEADER] = ip;
        request.get(callData, (error, response, body) => {
            response = {
                status: 200,
                headers: response.headers,
                body: body
            };
            return cb(response);
        });
    }
    return;
}

function postXHR(cb) {

}

module.exports = {
    getClient: getClient,
    postXHR: postXHR
}