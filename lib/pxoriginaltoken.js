const TokenV3 = require('./cookie/tokenV3');
const pxLogger = require('./pxlogger');

function evalCookie(pxCtx, pxConfig) {
    try {
        const cookie = new TokenV3(pxCtx, pxConfig, pxCtx.originalToken)
        pxLogger.debug('Original token found, Evaluating');

        if (!cookie.deserialize()) {
            pxLogger.debug(`Original token decryption failed, value: ${pxCtx.originalToken}`);
            pxCtx.originalTokenError = 'decryption_failed';
            return;
        }

        pxCtx.vid = cookie.getVid();
        pxCtx.originalUuid = cookie.getUuid();

        if (!cookie.isSecure()) {
            pxLogger.debug(`Original token HMAC validation failed, value: ${JSON.stringify(cookie.decodedCookie)} user-agent: ${pxCtx.userAgent}`);
            pxCtx.originalTokenError = 'validation_failed';
            return;
        }

        return;


    } catch (e) {
        pxLogger.error(`Error while evaluating perimeterx original token: ${e.message}`);
        pxCtx.originalTokenError = 'decryption_failed';
        return;
    }
}

exports.evalCookie = evalCookie;