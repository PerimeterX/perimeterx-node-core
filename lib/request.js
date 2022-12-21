
const axios = require('axios');

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

async function makeRequest(options, config, cb) {
    try {
        const response = await axios.request(options);
        cb(null, convertResponse(response));
    } catch (e) {
        if (e.response) {
            cb(null, convertResponse(e.response));
        } else {
            cb(e, null);
        }
    }
}

function convertResponse(response) {
    return {
        ...response,
        statusCode: response.status,
        // Check about data type.
        body: response.data && (typeof response.data === 'object' ? JSON.stringify(response.data) : response.data.toString())
    };
}