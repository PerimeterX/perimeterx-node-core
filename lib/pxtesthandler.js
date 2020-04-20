
module.exports = {
    testModeRequestHandler: customRequestHandler};

function customRequestHandler(ctx, config, req, res) {
    const result = {
        px_cookies : ctx.cookies,
        uuid: ctx.uuid,
        vid: ctx.vid,
        ip: ctx.ip,
        url: ctx.fullUrl,
        score: ctx.score,
        px_cookie_hmac : ctx.hmac,
        block_action: ctx.blockAction,
        http_method: ctx.httpMethod,
        hostname: ctx.hostname,
        headers: ctx.headers,
        user_agent: ctx.userAgent,
        is_made_s2s_api_call: ctx.hasMadeServerCall || false,
        sensitive_route: ctx.sensitiveRoute,
        sensitive_routes_list: config.SENSITIVE_ROUTES,
        whitelist_routes: config.WHITELIST_ROUTES,
        decoded_px_cookie: ctx.decodedCookie,
        cookie_origin: ctx.cookieOrigin,
        http_version: ctx.httpVersion,
        s2s_call_reason: ctx.s2sCallReason || 'none',
        block_reason: ctx.blockReason || 'none',
        module_mode: config.MODULE_MODE
    };
    if (ctx.originalUuid) {
        result['original_uuid'] = ctx.originalUuid;
    }
    if (ctx.originalTokenError) {
        result['original_token_error'] = ctx.originalTokenError;
    }

    res.json(result);

}
