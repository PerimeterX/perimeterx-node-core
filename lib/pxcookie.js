'use strict';
const pxConfig = require('./pxconfig');
const pxLogger = require('./pxlogger');
const CookieV1 = require('./cookie/cookieV1');
const CookieV3 = require('./cookie/cookieV3');
const TokenV1 = require('./cookie/tokenV1');
const TokenV3 = require('./cookie/tokenV3');

exports.evalCookie = evalCookie;

/**
 * evalCookie - main cookie evaluation function. dectypt, decode and verify cookie content. if score.
 *
 * @param {Object} pxCtx - current request context.
 *
 * @return {Number} evaluation results, derived from configured enum on PX_DEFAULT.COOKIE_EVAL. possible values: (NO_COOKIE, COOKIE_INVALID, COOKIE_EXPIRED, UNEXPECTED_RESULT, BAD_SCORE, GOOD_SCORE).
 *
 */
function evalCookie(pxCtx) {

    const config = pxConfig.conf;
    let pxCookie = pxCtx.getCookie();

    try {
        if (Object.keys(pxCtx.cookies).length === 0) {
            pxLogger.debug('Cookie is missing');
            pxCtx.s2sCallReason = 'no_cookie';
            return config.SCORE_EVALUATE_ACTION.NO_COOKIE;
        }

        if (!config.COOKIE_SECRET_KEY) {
            pxLogger.debug('No cookie key found, pause cookie evaluation');
            return config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT;
        }

        // Mobile SDK traffic
        if (pxCookie && pxCtx.cookieOrigin === "header") {
            switch(pxCookie) {
                case "1":
                    pxCtx.s2sCallReason = 'no_cookie';
                    pxLogger.debug('Mobile invalid token - no token');
                    return config.SCORE_EVALUATE_ACTION.NO_COOKIE;
                case "2":
                    pxCtx.s2sCallReason = 'mobile_sdk_connection_error';
                    pxLogger.debug('Mobile invalid token - connection error');
                    return config.SCORE_EVALUATE_ACTION.MOBILE_CONNECTION_ERROR;
                case "3":
                    pxCtx.s2sCallReason = 'mobile_sdk_pinning_error';
                    pxLogger.debug('Mobile invalid token - pinning issue');
                    return config.SCORE_EVALUATE_ACTION.MOBILE_PINNING_ERROR;
            }
        }

        const cookie = pxCookieFactory(pxCtx, config);
        pxLogger.debug(`Cookie ${getCookieVersion(pxCtx)} found, Evaluating`);
        if (!cookie.deserialize()) {
            pxCtx.s2sCallReason = 'cookie_decryption_failed';
            pxCtx.px_orig_cookie = getPxCookieFromContext(pxCtx);
            pxLogger.debug(`Cookie decryption failed, value: ${pxCtx.px_orig_cookie}`);
            return config.SCORE_EVALUATE_ACTION.COOKIE_INVALID;
        }

        pxCtx.decodedCookie = cookie.decodedCookie;
        pxCtx.score = cookie.getScore();
        pxCtx.vid = cookie.getVid();
        pxCtx.uuid = cookie.getUuid();
        pxCtx.hmac = cookie.getHmac();
        pxCtx.blockAction = parse_action(cookie.getBlockAction());
        pxCtx.fullBlockAction = parse_action(cookie.getBlockAction());


        if (cookie.isExpired()) {
            pxLogger.debug(`Cookie TTL is expired, value: ${JSON.stringify(cookie.decodedCookie)}, age: ${Date.now() - cookie.getTime()}`);
            pxCtx.s2sCallReason = 'cookie_expired';
            return config.SCORE_EVALUATE_ACTION.COOKIE_EXPIRED;
        }

        if (cookie.isHighScore()) {
            pxLogger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
            return config.SCORE_EVALUATE_ACTION.BAD_SCORE;
        }

        if (!cookie.isSecure()) {
            pxLogger.debug(`Cookie HMAC validation failed, value: ${JSON.stringify(cookie.decodedCookie)} user-agent: ${this.pxCtx.userAgent}`);
            pxCtx.s2sCallReason = 'cookie_validation_failed';
            return config.SCORE_EVALUATE_ACTION.COOKIE_INVALID;
        }

        if (pxCtx.sensitiveRoute) {
            pxLogger.debug(`Sensitive route match, sending Risk API. path: ${pxCtx.uri}`);
            pxCtx.s2sCallReason = 'sensitive_route';
            return config.SCORE_EVALUATE_ACTION.SENSITIVE_ROUTE;
        }

        pxCtx.passReason = config.PASS_REASON.COOKIE;
        pxLogger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
        return config.SCORE_EVALUATE_ACTION.GOOD_SCORE;
    } catch (e) {
        pxLogger.error('Error while evaluating perimeterx cookie: ' + e.message);
        pxCtx.s2sCallReason = 'cookie_decryption_failed';
        return config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT;
    }
}

/**
 * Factory method for creating PX Cookie object according to cookie version and type found on the request
 */
function pxCookieFactory(pxCtx, pxConfig) {
   if (pxCtx.cookieOrigin == "cookie") {
        return (pxCtx.cookies['_px3'] ? new CookieV3(pxCtx, pxConfig) : new CookieV1(pxCtx, pxConfig));
    } else {
        return (pxCtx.cookies['_px3'] ? new TokenV3(pxCtx, pxConfig) : new TokenV1(pxCtx, pxConfig));
    }
}

function getCookieVersion(pxCtx) {
    return pxCtx.cookies['_px3'] ? "V3" : "V1";
}

function parse_action(action) {
    switch (action) {
        case 'c':
            return 'captcha';
            break;
        case 'b':
            return 'block';
            break;
        case 'j':
            return 'challenge';
            break;
        default:
            return 'captcha';
    }
}

function getPxCookieFromContext(pxCtx){
    if (Object.keys(pxCtx.cookies).length){
        return pxCtx.cookies["_px3"] ? pxCtx.cookies["_px3"] : pxCtx.cookies["_px"]
    }
}
