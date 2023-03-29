'use strict';
const CookieV1 = require('./cookie/cookieV1');
const CookieV3 = require('./cookie/cookieV3');
const TokenV1 = require('./cookie/tokenV1');
const TokenV3 = require('./cookie/tokenV3');
const originalTokenValidator = require('./pxoriginaltoken');
const PassReason = require('./enums/PassReason');
const ScoreEvaluateAction = require('./enums/ScoreEvaluateAction');
const { CookieOrigin } = require('./enums/CookieOrigin');

exports.evalCookie = evalCookie;

/**
 * evalCookie - main cookie evaluation function. decrypt, decode and verify cookie content. if score.
 *
 * @param {Object} ctx - current request context.
 * @param {Object} config - configuration
 * @return {Number} evaluation results, derived from configured enum on PX_DEFAULT.COOKIE_EVAL. possible values: (NO_COOKIE, COOKIE_INVALID, COOKIE_EXPIRED, UNEXPECTED_RESULT, BAD_SCORE, GOOD_SCORE).
 *
 */
function evalCookie(ctx, config) {
    const pxCookie = ctx.getCookie();

    try {
        if (!pxCookie) {
            config.logger.debug('Cookie is missing');
            ctx.s2sCallReason = 'no_cookie';
            ctx.cookieOrigin = CookieOrigin.NONE;
            return ScoreEvaluateAction.NO_COOKIE;
        }

        if (!config.COOKIE_SECRET_KEY) {
            config.logger.debug('No cookie key found, pause cookie evaluation');
            ctx.s2sCallReason = 'no_cookie_key';
            return ScoreEvaluateAction.UNEXPECTED_RESULT;
        }

        // Mobile SDK traffic
        if (pxCookie && ctx.cookieOrigin === CookieOrigin.HEADER) {
            if (pxCookie.match(/^\d+$/)) {
                ctx.s2sCallReason = `mobile_error_${pxCookie}`;
                if (ctx.originalToken) {
                    originalTokenValidator.evalCookie(ctx, config);
                }
                return ScoreEvaluateAction.SPECIAL_TOKEN;
            }
        }

        const cookie = pxCookieFactory(ctx, config);
        config.logger.debug(`Cookie ${getCookieVersion(ctx)} found, Evaluating`);
        if (!cookie.deserialize()) {
            ctx.s2sCallReason = 'cookie_decryption_failed';
            ctx.px_orig_cookie = getPxCookieFromContext(ctx);
            config.logger.debug(`Cookie decryption failed, value: ${ctx.px_orig_cookie}`);
            return ScoreEvaluateAction.COOKIE_INVALID;
        }

        ctx.decodedCookie = cookie.decodedCookie;
        ctx.score = cookie.getScore();
        ctx.vid = cookie.getVid();
        ctx.vidSource = 'risk_cookie';
        ctx.uuid = cookie.getUuid();
        ctx.hmac = cookie.getHmac();
        ctx.blockAction = cookie.getBlockAction();
        ctx.signedFields = getSignedFields(ctx);

        if (cookie.isExpired()) {
            config.logger.debug(`Cookie TTL is expired, value: ${JSON.stringify(cookie.decodedCookie)}, age: ${Date.now() - cookie.getTime()}`);
            ctx.s2sCallReason = 'cookie_expired';
            return ScoreEvaluateAction.COOKIE_EXPIRED;
        }

        if (cookie.isHighScore()) {
            config.logger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
            return ScoreEvaluateAction.BAD_SCORE;
        }

        if (!cookie.isSecure()) {
            config.logger.debug(`Cookie HMAC validation failed, value: ${JSON.stringify(cookie.decodedCookie)} user-agent: ${ctx.userAgent}`);
            ctx.s2sCallReason = 'cookie_validation_failed';
            return ScoreEvaluateAction.COOKIE_INVALID;
        }

        if (ctx.sensitiveRequest()) {
            config.logger.debug(`Sensitive route match, sending Risk API. path: ${ctx.uri}`);
            ctx.s2sCallReason = 'sensitive_route';
            return ScoreEvaluateAction.SENSITIVE_ROUTE;
        }

        if (config.ENABLE_LOGIN_CREDS_EXTRACTION && ctx.additionalFields && ctx.additionalFields.loginCredentials) {
            config.logger.debug('Login credentials extracted successfully, sending Risk API');
            ctx.s2sCallReason = 'sensitive_route';
            return ScoreEvaluateAction.SENSITIVE_ROUTE;
        }

        if (ctx.sensitiveGraphqlOperation) {
            config.logger.debug(`Sensitive graphql operation, sending Risk API. operations: ${JSON.stringify(ctx.graphqlData)}`);
            ctx.s2sCallReason = 'sensitive_route';
            return ScoreEvaluateAction.SENSITIVE_ROUTE;
        }

        ctx.passReason = PassReason.COOKIE;
        config.logger.debug(`Cookie evaluation ended successfully, risk score: ${cookie.getScore()}`);
        return ScoreEvaluateAction.GOOD_SCORE;
    } catch (e) {
        config.logger.error('Error while evaluating perimeterx cookie: ' + e.message);
        ctx.s2sCallReason = 'cookie_decryption_failed';
        return ScoreEvaluateAction.UNEXPECTED_RESULT;
    }
}

/**
 * Factory method for creating PX Cookie object according to cookie version and type found on the request
 */
function pxCookieFactory(ctx, config) {
    if (ctx.cookieOrigin === 'cookie') {
        return ctx.cookies['_px3'] ? new CookieV3(ctx, config, config.logger) : new CookieV1(ctx, config, config.logger);
    } else {
        return ctx.cookies['_px3']
            ? new TokenV3(ctx, config, ctx.cookies['_px3'], config.logger)
            : new TokenV1(ctx, config, ctx.cookies['_px'], config.logger);
    }
}

function getSignedFields(pxCtx) {
    const { decodedCookie } = pxCtx;
    if (typeof decodedCookie.x !== 'string') {
        return pxCtx.signedFields;
    }

    const signedFields = [];
    for (const char of decodedCookie.x) {
        signedFields.push(convertCharToField(char, pxCtx));
    }
    return signedFields;
}

function convertCharToField(char, pxCtx) {
    let field;
    switch (char) {
        case 'u':
            field = pxCtx.userAgent;
            break;
        case 's':
            field = pxCtx.ip;
            break;
        default:
            break;
    }
    return field ? field : '';
}

function getCookieVersion(ctx) {
    return ctx.cookies['_px3'] ? 'V3' : 'V1';
}

function getPxCookieFromContext(ctx) {
    if (Object.keys(ctx.cookies).length) {
        return ctx.cookies['_px3'] ? ctx.cookies['_px3'] : ctx.cookies['_px'];
    }
}
