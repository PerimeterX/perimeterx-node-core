


module.exports = {
    customRequestHandler: customRequestHandler}


function customRequestHandler(pxCtx, pxconfig, req, res) {
    let result = {
        px_cookies : pxCtx.cookies,
        uuid: pxCtx.uuid,
        vid: pxCtx.vid,
        ip: pxCtx.ip,
        full_url: pxCtx.fullUrl,
        score: pxCtx.score,
        px_cookie_hmac : pxCtx.hmac,
        block_action: pxCtx.blockAction,
        http_method: pxCtx.httpMethod,
        hostname: pxCtx.hostname,
        headers: pxCtx.headers,
        user_agent: pxCtx.userAgent,
        uri: pxCtx.uri,
        is_made_s2s_api_call: pxCtx.hasMadeServerCall || false,
        sensitive_route: pxCtx.sensitiveRoute,
        sensitive_routes_list: pxconfig.SENSITIVE_ROUTES,
        whitelist_routes: pxconfig.WHITELIST_ROUTES,
        decoded_px_cookie: pxCtx.decodedCookie,
        cookie_origin: pxCtx.cookieOrigin,
        http_version: pxCtx.httpVersion,
        s2s_call_reason: pxCtx.s2sCallReason || "none",
        block_reason: pxCtx.blockReason || "none",
        module_mode: pxconfig.MODULE_MODE
    }
    if (pxCtx.originalUuid) {
        result['original_uuid'] = pxCtx.originalUuid;
    }
    if (pxCtx.originalTokenError) {
        result["original_token_error"] = pxCtx.originalTokenError;
    }

    console.log(`Result is: ${result}`);
    res.json(result);

}
