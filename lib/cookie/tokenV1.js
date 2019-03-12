'use strict';
const pxutil = require('../pxutil');
const Payload = require('../pxpayload');

class TokenV1 extends Payload {

    constructor(ctx, config, token) {
        super(config);
        this.pxCookie = token;
        this.ctx = ctx;
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
        const hmacWithIp = baseHmacStr + this.ctx.ip;

        // hmac string without IP
        const hmacWithoutIp = baseHmacStr;

        return this.isHmacValid(hmacWithoutIp, this.getHmac()) || this.isHmacValid(hmacWithIp, this.getHmac());
    }
}

module.exports = TokenV1;