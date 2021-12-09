'use strict';
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');

const S2SErrorInfo = require('./models/S2SErrorInfo');

const PassReason = require('./enums/PassReason');
const ScoreEvaluateAction = require('./enums/ScoreEvaluateAction');
const S2SErrorReason = require('./enums/S2SErrorReason');

exports.evalByServerCall = evalByServerCall;

/**
 * callServer - call the perimeterx api server to receive a score for a given user.
 *
 * @param {Object} ctx - current request context
 * @param {Function} callback - callback function.
 */
function callServer(ctx, config, callback) {
    const data = buildRequestData(ctx, config);

    ctx.riskRttLogs += `buildRequestData:${ctx.riskRtt};`;

    const reqHeaders = {
        Authorization: 'Bearer ' + config.AUTH_TOKEN,
        'Content-Type': 'application/json',
    };

    ctx.hasMadeServerCall = true;
    return pxHttpc.callServer(data, reqHeaders, config.SERVER_TO_SERVER_API_URI, 'query', config, callback, ctx);
}

function buildRequestData(ctx, config) {
    const ip = ctx.ip;
    const fullUrl = ctx.fullUrl;
    const vid = ctx.vid || '';
    const pxhd = ctx.pxhdClient || '';
    const vidSource = ctx.vidSource || '';
    const uuid = ctx.uuid || '';
    const headers = pxUtil.formatHeaders(ctx.headers, config.SENSITIVE_HEADERS);
    const httpVersion = ctx.httpVersion;
    const riskMode =
        (config.MODULE_MODE === config.MONITOR_MODE.MONITOR && !ctx.shouldBypassMonitor) || ctx.monitoredRoute
            ? 'monitor'
            : 'active_blocking';

    const data = {
        request: {
            ip: ip,
            headers: headers,
            url: fullUrl,
        },
        additional: {
            s2s_call_reason: ctx.s2sCallReason,
            http_version: httpVersion,
            http_method: ctx.httpMethod,
            risk_mode: riskMode,
            module_version: config.MODULE_VERSION,
            cookie_origin: ctx.cookieOrigin,
            request_cookie_names: ctx.requestCookieNames,
            ...ctx.additionalFields,
        },
    };

    if (ctx.s2sCallReason === 'cookie_decryption_failed') {
        data.additional.px_orig_cookie = ctx.getCookie(); //No need strigify, already a string
    }

    if (ctx.s2sCallReason === 'cookie_expired' || ctx.s2sCallReason === 'cookie_validation_failed') {
        data.additional.px_cookie = JSON.stringify(ctx.decodedCookie);
    }

    pxUtil.prepareCustomParams(config, data.additional, ctx.originalRequest);

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

    if (ctx.hmac) {
        data.additional['px_cookie_hmac'] = ctx.hmac;
    }
    return data;
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
        return callback(ScoreEvaluateAction.UNEXPECTED_RESULT);
    }
    config.logger.debug(`Evaluating Risk API request, call reason: ${ctx.s2sCallReason}`);
    callServer(ctx, config, (err, res) => {
        if (err) {
            if (err === 'timeout') {
                ctx.passReason = PassReason.S2S_TIMEOUT;
                return callback(ScoreEvaluateAction.S2S_TIMEOUT_PASS);
            }
            config.logger.error(
                `Unexpected exception while evaluating Risk API. ${err.errorReason}:${err.errorMessage}`,
            );
            ctx.passReason = PassReason.S2S_ERROR;
            ctx.s2sErrorInfo = err;
            return callback(ScoreEvaluateAction.UNEXPECTED_RESULT);
        }
        ctx.pxhdServer = res.pxhd;
        if (res.data_enrichment) {
            ctx.pxde = res.data_enrichment;
            ctx.pxdeVerified = true;
        }

        const action = isBadRiskScore(res, ctx, config);
        /* score response invalid - pass traffic */
        if (action === -1) {
            config.logger.error('perimeterx server query response is invalid');
            return callback(ScoreEvaluateAction.UNEXPECTED_RESULT);
        }

        /* score did not cross threshold - pass traffic */
        if (action === 1) {
            return callback(ScoreEvaluateAction.GOOD_SCORE);
        }

        /* score crossed threshold - block traffic */
        if (action === 0) {
            ctx.uuid = res.uuid || '';
            return callback(ScoreEvaluateAction.BAD_SCORE);
        }

        /* This shouldn't be called - if it did - we pass the traffic */
        return callback(ScoreEvaluateAction.UNEXPECTED_RESULT);
    });
}

/**
 * isBadRiskScore - processing response score and return a block indicator.
 *
 * @param {object} riskResponse - perimeterx response object.
 * @param {object} ctx - current request context.
 *
 * @return {Number} indicator to the validity of the cookie.
 *                   -1 response object is not valid
 *                   0 response valid with bad score
 *                   1 response valid with good score
 *
 */
function isBadRiskScore(riskResponse, ctx, config) {
    if (!riskResponse || !pxUtil.verifyDefined(riskResponse.score) || !riskResponse.action) {
        ctx.passReason = PassReason.S2S_ERROR;
        if (!ctx.s2sErrorInfo) {
            ctx.s2sErrorInfo = new S2SErrorInfo(
                S2SErrorReason.INVALID_RESPONSE,
                `Response is ${JSON.stringify(riskResponse)}`,
            );
        }
        return -1;
    }
    const score = riskResponse.score;
    ctx.score = score;
    ctx.uuid = riskResponse.uuid;
    if (score >= config.BLOCKING_SCORE) {
        ctx.blockAction = riskResponse.action;
        if (riskResponse.action === 'j' && riskResponse.action_data && riskResponse.action_data.body) {
            ctx.blockActionData = riskResponse.action_data.body;
        }
        return 0;
    } else {
        ctx.passReason = PassReason.S2S;
        return 1;
    }
}
