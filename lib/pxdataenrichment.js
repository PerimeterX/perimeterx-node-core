const pxUtil = require('./pxutil');

function ProcessDataEnrichmentCookie(ctx, config) {
    const pxde = ctx.cookies['_pxde'];
    if (!pxde) {
        return;
    }
    const [hmac, encodedPayload] = pxde.split(':');
    if (!hmac || !encodedPayload) {
        return;
    }
    let verified;
    try {
        const generatedHmac = pxUtil.generateHMAC(config.COOKIE_SECRET_KEY, encodedPayload);
        verified = generatedHmac === hmac;
    } catch (e) {
        config.logger.debug(`pxde hmac validation failed: ${e.message}`);
        return;
    }
    ctx.pxdeVerified = verified;
    config.logger.debug('pxde hmac verified: ' + verified);
    try {
        const decodedPayload = Buffer.from(encodedPayload, 'base64');
        ctx.pxde = JSON.parse(decodedPayload);
    } catch (e) {
        config.logger.debug(`error while decoding pxde: ${e}`);
        return;
    }
}

module.exports = {
    ProcessDataEnrichmentCookie,
};
