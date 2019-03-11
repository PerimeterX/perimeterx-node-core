'use strict';
const pxutil = require('../pxutil');
const Payload = require('../pxpayload');

class CookieV1 extends Payload {

    constructor(ctx, config, pxLogger) {
        super(pxLogger);
        this.pxCookie = ctx.cookies['_px'];
        this.config = config;
        this.pxContext = ctx;
        this.cookieSecret = config.COOKIE_SECRET_KEY;
    }

    getScore() {
        return this.decodedCookie.s.b;
    }

    getHmac() {
        return this.decodedCookie.h;
    }

    isCookieFormatValid(cookie) {
        return cookie !== '' && pxutil.verifyDefined(cookie.t, cookie.s, cookie.s.a, cookie.s.b, cookie.u, cookie.v, cookie.h);
    }

    getBlockAction() {
        // v1 cookie will always return captcha action
        return 'c';
    }

    isSecure() {
        const baseHmacStr = '' + this.getTime() + this.decodedCookie.s.a + this.getScore() + this.getUuid() + this.getVid();

        // hmac string with IP - for backward support
        const hmacWithIp = baseHmacStr + this.pxContext.ip + this.pxContext.userAgent;

        // hmac string without IP
        const hmacWithoutIp = baseHmacStr + this.pxContext.userAgent;

        return this.isHmacValid(hmacWithoutIp, this.getHmac()) || this.isHmacValid(hmacWithIp, this.getHmac());
    }
}

module.exports = CookieV1;