const { CSP_HEADER, CSPRO_HEADER } = require('./utils/constants');
const SCRIPT_SRC_STRING = 'script-src ';

function addNonce(response, nonce) {
    if (validateNonce(nonce)) {
        addNonceToHeader(response, CSP_HEADER, nonce);
        addNonceToHeader(response, CSPRO_HEADER, nonce);
    } else {
        console.error('nonce value is not valid, will not be added to CSP header');
    }
}

function addNonceToHeader(response, headerName, nonce) {
    let headerValue = response.getHeader(headerName);
    if (headerValue) {
        const matches = headerValue.match(/script-src ([^ ;]+)/);
        if (matches && matches.length > 1) {
            const updatedScriptSrc = `'nonce-${nonce}' ` + matches[1];
            const index = matches.index + matches[0].length;
            headerValue = headerValue.slice(0, matches.index + SCRIPT_SRC_STRING.length) + updatedScriptSrc + headerValue.slice(index);
            response.setHeader(headerName, headerValue);
        } else {
            //add script-src
            const index = headerValue.indexOf(';') + 1;
            headerValue = headerValue.slice(0, index) + ` ${SCRIPT_SRC_STRING}'nonce-${nonce}';` + headerValue.slice(index);
            response.setHeader(headerName, headerValue);
        }
    }
}

function validateNonce(nonce) {
    const re = /^[A-Za-z0-9=]+$/;
    return re.test(nonce);
}

module.exports = addNonce;
