'use strict';
const pxutil = require('../pxutil');
const Payload = require('../pxpayload');

class CookieV3 extends Payload {
    constructor(ctx, config, pxLogger) {
        super(pxLogger);
        let [hash, ...cookie] = ctx.cookies['_px3'].split(':');
        cookie = cookie.join(':');
        this.pxCookie = cookie;
        this.cookieHash = hash;
        this.config = config;
        this.pxContext = ctx;
        this.cookieSecret = config.COOKIE_SECRET_KEY;
    }

    getScore() {
        return this.decodedCookie.s;
    }

    getHmac() {
        return this.cookieHash;
    }

    isCookieFormatValid(cookie) {
        return cookie !== '' && pxutil.verifyDefined(cookie.t, cookie.s, cookie.u, cookie.v, cookie.a);
    }

    getBlockAction() {
        return this.decodedCookie.a;
    }

    isSecure() {
        const hmacStr = this.pxCookie + this.pxContext.userAgent;
        return this.isHmacValid(hmacStr, this.getHmac());
    }
}

module.exports = CookieV3;
