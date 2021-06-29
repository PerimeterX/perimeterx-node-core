const TokenV3 = require('./cookie/tokenV3');
const TokenV1 = require('./cookie/tokenV1');
const pxUtil = require('./pxutil');

function evalCookie(ctx, config) {
    try {
        const noVersionOriginalToken = pxUtil.getTokenObject(ctx.originalToken).value;
        const cookie = (ctx.cookies['_px3'] ? new TokenV3(ctx, config, noVersionOriginalToken) : new TokenV1(ctx, config, noVersionOriginalToken));
        config.logger.debug('Original token found, Evaluating');

        if (!cookie.deserialize()) {
            config.logger.debug(`Original token decryption failed, value: ${ctx.originalToken}`);
            ctx.originalTokenError = 'decryption_failed';
            return;
        }

        ctx.decodedOriginalToken = cookie.decodedCookie;
        ctx.vid = cookie.getVid();
        ctx.originalUuid = cookie.getUuid();

        if (!cookie.isSecure()) {
            config.logger.debug(`Original token HMAC validation failed, value: ${JSON.stringify(cookie.decodedCookie)} user-agent: ${ctx.userAgent}`);
            ctx.originalTokenError = 'validation_failed';
            return;
        }

        return;
    } catch (e) {
        config.logger.error(`Error while evaluating perimeterx original token: ${e.message}`);
        ctx.originalTokenError = 'decryption_failed';
        return;
    }
}

exports.evalCookie = evalCookie;
