const { ORIGIN_HEADER, ACCESS_CONTROL_REQUEST_METHOD_HEADER } = require('./utils/constants');

function isPreflightRequest(request) {
    return request.method.toUpperCase() === 'OPTIONS' && request.get(ORIGIN_HEADER) && request.get(ACCESS_CONTROL_REQUEST_METHOD_HEADER);
}

function runPreflightCustomHandler(pxConfig, request) {
    const corsCustomPreflightFunction = pxConfig.CORS_CUSTOM_PREFLIGHT_HANDLER;

    if (corsCustomPreflightFunction) {
        try {
            return corsCustomPreflightFunction(request);
        } catch (e) {
            pxConfig.logger.debug(`Error while executing custom preflight handler: ${e}`);
        }
    }

    return null;
}

function isCorsRequest(request, pxConfig) {
    return request.get(ORIGIN_HEADER) && pxConfig.CORS_SUPPORT_ENABLED;
}

function setCorsBlockHeaders(request, pxConfig, pxCtx) {
    let corsHeaders = getDefaultCorsHeaders(request);
    const createCustomCorsHeaders = pxConfig.CORS_CREATE_CUSTOM_BLOCK_RESPONSE_HEADERS;

    if (createCustomCorsHeaders) {
        try {
            corsHeaders = createCustomCorsHeaders(pxCtx, request);
        } catch (e) {
            pxConfig.logger.debug(`Caught error in px_cors_create_custom_block_response_headers custom function: ${e}`);
        }
    }

    return corsHeaders;
}

function getDefaultCorsHeaders(request) {
    const originHeader = request.get(ORIGIN_HEADER);

    if (!originHeader) {
        return {};
    }

    return { 'Access-Control-Allow-Origin': originHeader, 'Access-Control-Allow-Credentials': 'true' };
}

module.exports = {
    isPreflightRequest,
    runPreflightCustomHandler,
    isCorsRequest,
    setCorsBlockHeaders: setCorsBlockHeaders,
};