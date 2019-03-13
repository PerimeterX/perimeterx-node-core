'use strict';
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');

exports.evalByServerCall = evalByServerCall;

/**
 * callServer - call the perimeterx api server to receive a score for a given user.
 *
 * @param {Object} ctx - current request context
 * @param {Function} callback - callback function.
 */
function callServer(ctx, config, callback) {
    const ip = ctx.ip;
    const fullUrl = ctx.fullUrl;
    const vid = ctx.vid || '';
    const pxhd = ctx.pxhd || '';
    const vidSource = ctx.vidSource || '';
    const uuid = ctx.uuid || '';
    const uri = ctx.uri || '/';
    const headers = pxUtil.formatHeaders(ctx.headers, config.SENSITIVE_HEADERS);
    const httpVersion = ctx.httpVersion;
    const riskMode = config.MODULE_MODE === config.MONITOR_MODE.MONITOR ? 'monitor' : 'active_blocking';

    const data = {
        request: {
            ip: ip,
            headers: headers,
            url: fullUrl,
            uri: uri,
            firstParty: config.FIRST_PARTY_ENABLED
        },
        additional: {
            s2s_call_reason: ctx.s2sCallReason,
            http_version: httpVersion,
            http_method: ctx.httpMethod,
            risk_mode: riskMode,
            module_version: config.MODULE_VERSION,
            cookie_origin: ctx.cookieOrigin,
            request_cookie_names: ctx.requestCookieNames
        }
    };

    if (ctx.s2sCallReason === 'cookie_decryption_failed') {
        data.additional.px_orig_cookie = ctx.getCookie(); //No need strigify, already a string
    }

    if (ctx.s2sCallReason === 'cookie_expired' || ctx.s2sCallReason === 'cookie_validation_failed') {
        data.additional.px_cookie = JSON.stringify(ctx.decodedCookie);
    }

    pxUtil.prepareCustomParams(config, data.additional);

    const reqHeaders = {
        Authorization: 'Bearer ' + config.AUTH_TOKEN,
        'Content-Type': 'application/json'
    };

    if (vid) {
        data.vid = vid;
    }
    if (uuid) {
        data.uuid = uuid;
    }
    if (pxhd) {
        data.pxhd = pxhd;
    }
    if (vidSource) {
        data.vid_source = vidSource;
    }
    if (pxhd && data.additional.s2s_call_reason === 'no_cookie') {
        data.additional.s2s_call_reason = 'no_cookie_w_vid';
    }
    if (ctx.originalUuid) {
        data.additional['original_uuid'] = ctx.originalUuid;
    }

    if (ctx.originalTokenError) {
        data.additional['original_token_error'] = ctx.originalTokenError;
    }

    if (ctx.originalToken) {
        data.additional['original_token'] = ctx.originalToken;
    }

    if (ctx.decodedOriginalToken) {
        data.additional['px_decoded_original_token'] = ctx.decodedOriginalToken;
    }

    if(ctx.hmac) {
        data.additional['px_cookie_hmac'] = ctx.hmac;
    }

    ctx.hasMadeServerCall = true;
    return pxHttpc.callServer(data, reqHeaders, config.SERVER_TO_SERVER_API_URI, 'query', config, callback);
}

/**
 * evalByServerCall - main server to server function, execute a server call for score and process its value to make blocking decisions.
 * '
 * @param {Object} ctx - current request context.
 * @param {Function} callback - callback function.
 */
function evalByServerCall(ctx, config, callback) {
    if (!ctx.ip || !ctx.headers) {
        config.logger.error('perimeterx score evaluation failed. bad parameters.');
        return callback(config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT);
    }
    config.logger.debug(`Evaluating Risk API request, call reason: ${ctx.s2sCallReason}`);
    callServer(ctx, config, (err, res) => {
        if (err) {
            if (err === 'timeout') {
                ctx.passReason = config.PASS_REASON.S2S_TIMEOUT;
                return callback(config.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS);
            }
            config.logger.error(`Unexpected exception while evaluating Risk cookie. ${err}`);
            ctx.passReason = config.PASS_REASON.REQUEST_FAILED;
            return callback(config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT);
        }
        ctx.pxhd = res.pxhd;
        const action = isBadRiskScore(res, ctx, config);
        /* score response invalid - pass traffic */
        if (action === -1) {
            config.logger.error('perimeterx server query response is invalid');
            return callback(config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT);
        }

        /* score did not cross threshold - pass traffic */
        if (action === 1) {
            return callback(config.SCORE_EVALUATE_ACTION.GOOD_SCORE);
        }

        /* score crossed threshold - block traffic */
        if (action === 0) {
            ctx.uuid = res.uuid || '';
            return callback(config.SCORE_EVALUATE_ACTION.BAD_SCORE);
        }

        /* This shouldn't be called - if it did - we pass the traffic */
        return callback(config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT);
    });
}

/**
 * isBadRiskScore - processing response score and return a block indicator.
 *
 * @param {object} res - perimeterx response object.
 * @param {object} ctx - current request context.
 *
 * @return {Number} indicator to the validity of the cookie.
 *                   -1 response object is not valid
 *                   0 response valid with bad score
 *                   1 response valid with good score
 *
 */
function isBadRiskScore(res, ctx, config) {
    if (!res || !pxUtil.verifyDefined(res.score) || !res.action) {
        ctx.passReason = config.PASS_REASON.INVALID_RESPONSE;
        return -1;
    }
    const score = res.score;
    ctx.score = score;
    ctx.uuid = res.uuid;
    if (score >= config.BLOCKING_SCORE) {
        ctx.blockAction = res.action;
        if (res.action === 'j' && res.action_data && res.action_data.body) {
            ctx.blockActionData = res.action_data.body;
        }
        return 0;
    } else {
        ctx.passReason =  config.PASS_REASON.S2S;
        return 1;
    }
}
