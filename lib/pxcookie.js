'use strict';
const CookieV1 = require('./cookie/cookieV1');
const CookieV3 = require('./cookie/cookieV3');
const TokenV1 = require('./cookie/tokenV1');
const TokenV3 = require('./cookie/tokenV3');
const originalTokenValidator = require('./pxoriginaltoken');

exports.evalCookie = evalCookie;

/**
 * evalCookie - main cookie evaluation function. dectypt, decode and verify cookie content. if score.
 *
 * @param {Object} ctx - current request context.
 *
 * @return {Number} evaluation results, derived from configured enum on PX_DEFAULT.COOKIE_EVAL. possible values: (NO_COOKIE, COOKIE_INVALID, COOKIE_EXPIRED, UNEXPECTED_RESULT, BAD_SCORE, GOOD_SCORE).
 *
 */
function evalCookie(ctx, config) {
    const pxCookie = ctx.getCookie();

    try {
        if (Object.keys(ctx.cookies).length === 0) {
            config.logger.debug('Cookie is missing');
            ctx.s2sCallReason = 'no_cookie';
            return config.SCORE_EVALUATE_ACTION.NO_COOKIE;
        }

        if (!config.COOKIE_SECRET_KEY) {
            config.logger.debug('No cookie key found, pause cookie evaluation');
            ctx.s2sCallReason = 'no_cookie_key';
            return config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT;
        }

        // Mobile SDK traffic
        if (pxCookie && ctx.cookieOrigin === 'header') {
            if (pxCookie.match(/^\d+$/)) {
                ctx.s2sCallReason = `mobile_error_${pxCookie}`;
                if (ctx.originalToken) {
                    originalTokenValidator.evalCookie(ctx, config);
                }
                return config.SCORE_EVALUATE_ACTION.SPECIAL_TOKEN;
            }
        }

        const cookie = pxCookieFactory(ctx, config);
        config.logger.debug(`Cookie ${getCookieVersion(ctx)} found, Evaluating`);
        if (!cookie.deserialize()) {
            ctx.s2sCallReason = 'cookie_decryption_failed';
            ctx.px_orig_cookie = getPxCookieFromContext(ctx);
            config.logger.debug(`Cookie decryption failed, value: ${ctx.px_orig_cookie}`);
            return config.SCORE_EVALUATE_ACTION.COOKIE_INVALID;
        }

        ctx.decodedCookie = cookie.decodedCookie;
        ctx.score = cookie.getScore();
        ctx.vid = cookie.getVid();
        ctx.vidSource = 'risk_cookie';
        ctx.uuid = cookie.getUuid();
        ctx.hmac = cookie.getHmac();
        ctx.blockAction = cookie.getBlockAction();

        if (cookie.isExpired()) {
            config.logger.debug(`Cookie TTL is expired, value: ${JSON.stringify(cookie.decodedCookie)}, age: ${Date.now() - cookie.getTime()}`);
            ctx.s2sCallReason = 'cookie_expired';
            return config.SCORE_EVALUATE_ACTION.COOKIE_EXPIRED;
        }

        if (cookie.isHighScore()) {
            config.logger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
            return config.SCORE_EVALUATE_ACTION.BAD_SCORE;
        }

        if (!cookie.isSecure()) {
            config.logger.debug(`Cookie HMAC validation failed, value: ${JSON.stringify(cookie.decodedCookie)} user-agent: ${ctx.userAgent}`);
            ctx.s2sCallReason = 'cookie_validation_failed';
            return config.SCORE_EVALUATE_ACTION.COOKIE_INVALID;
        }

        if (ctx.sensitiveRoute) {
            config.logger.debug(`Sensitive route match, sending Risk API. path: ${ctx.uri}`);
            ctx.s2sCallReason = 'sensitive_route';
            return config.SCORE_EVALUATE_ACTION.SENSITIVE_ROUTE;
        }

        ctx.passReason = config.PASS_REASON.COOKIE;
        config.logger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
        return config.SCORE_EVALUATE_ACTION.GOOD_SCORE;
    } catch (e) {
        config.logger.error('Error while evaluating perimeterx cookie: ' + e.message);
        ctx.s2sCallReason = 'cookie_decryption_failed';
        return config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT;
    }
}

/**
 * Factory method for creating PX Cookie object according to cookie version and type found on the request
 */
function pxCookieFactory(ctx, config) {
    if (ctx.cookieOrigin == 'cookie') {
        return (ctx.cookies['_px3'] ? new CookieV3(ctx, config, config.logger) : new CookieV1(ctx, config, config.logger));
    } else {
        return (ctx.cookies['_px3'] ? new TokenV3(ctx, config, ctx.cookies['_px3'], config.logger) : new TokenV1(ctx, config, ctx.cookies['_px'], config.logger));
    }
}

function getCookieVersion(ctx) {
    return ctx.cookies['_px3'] ? 'V3' : 'V1';
}

function getPxCookieFromContext(ctx) {
    if (Object.keys(ctx.cookies).length) {
        return ctx.cookies['_px3'] ? ctx.cookies['_px3'] : ctx.cookies['_px'];
    }
}
