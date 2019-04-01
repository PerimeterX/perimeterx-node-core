'use strict';
const pxutil = require('../pxutil');
const Payload = require('../pxpayload');

class CookieV3 extends Payload {
    constructor(ctx, config) {
        super(config);
        const splitCookie = ctx.cookies['_px3'].split(':');
        const hash = splitCookie[0];
        let [, ...cookie] = splitCookie;
        cookie = cookie.join(':');
        this.pxCookie = cookie;
        this.cookieHash = hash;
        this.ctx = ctx;
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
        const hmacStr = this.pxCookie + this.ctx.userAgent;
        return this.isHmacValid(hmacStr, this.getHmac());
    }
}

module.exports = CookieV3;
