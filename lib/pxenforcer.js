'use strict';

const mu = require('mu2');
const ipRangeCheck = require('ip-range-check');

const Constants = require('./utils/constants');

const ScoreEvaluateAction = require('./enums/ScoreEvaluateAction');
const PassReason = require('./enums/PassReason');

const PxClient = require('./pxclient');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const pxProxy = require('./pxproxy');
const pxUtil = require('./pxutil');
const pxApi = require('./pxapi');
const pxCookie = require('./pxcookie');
const PxLogger = require('./pxlogger');
const ConfigLoader = require('./configloader');
const PxDataEnrichment = require('./pxdataenrichment');
const telemetryHandler = require('./telemetry_handler.js');
const FieldExtractorManager = require('./extract_field/FieldExtractorManager');
const { CookieOrigin } = require('./enums/CookieOrigin');

class PxEnforcer {
    constructor(params, client) {
        this.logger = new PxLogger(params);
        this.pxConfig = new PxConfig(params, this.logger);
        this.pxClient = this._initializeClient(this.pxConfig, client);

        const { px_app_id, px_dynamic_configurations_enabled } = this.pxConfig.Config; 

        this.reversePrefix = px_app_id.substring(2);
        this.fieldExtractorManager = this._createFieldExtractorManager(this.logger, this.pxConfig.Config);

        // TODO: Move this to PxConfig constructor
        if (px_dynamic_configurations_enabled) {
            this.config.configLoader = new ConfigLoader(this.pxConfig, this.pxClient);
            this.config.configLoader.init();
        }
    }

    _initializeClient(pxConfig, existingClient) {
        const client = existingClient ? existingClient : new PxClient();
        client.init(pxConfig.Config);
        return client;
    }

    _createFieldExtractorManager(logger, config) {
        const { px_login_credentials_extraction_enabled, px_login_credentials_extraction } = config;
        if (px_login_credentials_extraction_enabled && px_login_credentials_extraction.length > 0) {
            return new FieldExtractorManager(logger, px_login_credentials_extraction);
        }
        return null;
    }

    enforce(req, res, cb) {
        const config = this.pxConfig.Config;
        const requestUrl = req.originalUrl;
        const userAgent = req.get('user-agent') || '';

        const ipAddress = pxUtil.extractIP(req, config.px_ip_headers, config.px_extract_user_ip);

        this.logger.debug('Starting request verification');

        if (requestUrl.startsWith(`/${this.reversePrefix}${Constants.FIRST_PARTY_VENDOR_PATH}`)) {
            // reverse proxy client
            return pxProxy.getClient(req, this.pxConfig, ipAddress, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${Constants.FIRST_PARTY_XHR_PATH}`)) {
            //reverse proxy xhr
            return pxProxy.sendXHR(req, this.pxConfig, ipAddress, this.reversePrefix, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${Constants.FIRST_PARTY_CAPTCHA_PATH}`)) {
            // reverse proxy captcha
            return pxProxy.getCaptcha(req, this.pxConfig, ipAddress, this.reversePrefix, cb);
        }

        if (!config.px_module_enabled) {
            this.logger.debug('Request will not be verified, module is disabled');
            return cb();
        }

        if (config.px_filter_by_http_method.includes(req.method.toUpperCase())) {
            this.logger.debug(`Skipping verification for filtered method ${req.method}`);
            return cb();
        }

        if (userAgent && config.px_filter_by_user_agent && config.px_filter_by_user_agent.length > 0) {
            for (const ua of config.px_filter_by_user_agent) {
                if (pxUtil.isStringMatchWith(userAgent, ua)) {
                    this.logger.debug(`Skipping verification for filtered user agent ${userAgent}`);
                    return cb();
                }
            }
        }

        if (ipAddress && config.px_filter_by_ip.find((range) => ipRangeCheck(ipAddress, range))) {
            // ip is filtered
            this.logger.debug(`Skipping verification for filtered ip address ${ipAddress}`);
            return cb();
        }

        try {
            if (telemetryHandler.isTelemetryCommand(req, config)) {
                this.pxClient.sendEnforcerTelemetry('command', config);
            }
        } catch (err) {
            this.logger.debug('Telemetry command failure. unexpected error. ' + err.message);
        }

        try {
            if (this.shouldFilterRequest(req)) {
                this.logger.debug(`Skipping verification for route ${req.path}`);
                return cb();
            }

            const ctx = new PxContext(this.pxConfig, req, this._getAdditionalFields(req));

            this.logger.debug('Request context created successfully');
            ctx.collectorUrl = `https://collector-${config.px_app_id}.perimeterx.net`;

            PxDataEnrichment.ProcessDataEnrichmentCookie(ctx, config);

            this.verifyUserScore(ctx, () => {
                this.handleVerification(ctx, req, res, cb);
            });
        } catch (err) {
            return cb();
        }
    }

    _getAdditionalFields(req) {
        let additionalFields = {};
        if (this.fieldExtractorManager) {
            additionalFields = this.fieldExtractorManager.ExtractFields(req);
        }
        return additionalFields;
    }

    shouldFilterRequest(req) {
        let shouldFilterRoute = false;
        const { px_filter_by_extension, px_filter_by_route, px_enforced_routes, px_monitored_routes } = this.pxConfig.Config;

        if (pxUtil.checkForStatic(req, px_filter_by_extension)) {
            this.logger.debug(`Found whitelist ext in path: ${req.originalUrl}`);
            return true;
        }

        if (px_filter_by_route && px_filter_by_route.length > 0) {
            for (const whitelistRoute of px_filter_by_route) {
                if (whitelistRoute instanceof RegExp && req.originalUrl.match(whitelistRoute)) {
                    this.logger.debug(`Found whitelist route by Regex ${req.originalUrl}`);
                    return true;
                }

                if (typeof whitelistRoute === 'string' && req.originalUrl.startsWith(whitelistRoute)) {
                    this.logger.debug(`Found whitelist route ${req.originalUrl}`);
                    return true;
                }
            }
        }

        if (px_enforced_routes && px_enforced_routes.length > 0) {
            for (const enforceRoute of px_enforced_routes) {
                if (enforceRoute instanceof RegExp && req.originalUrl.match(enforceRoute)) {
                    return false;
                }
                if (typeof enforceRoute === 'string' && req.originalUrl.startsWith(enforceRoute)) {
                    return false;
                }
            }
            this.logger.debug(`Route ${req.originalUrl} is not listed in specific routes to enforce`);
            shouldFilterRoute = true;
        }

        if (px_monitored_routes && px_monitored_routes.length > 0) {
            for (const monitorRoute of px_monitored_routes) {
                if (monitorRoute instanceof RegExp && req.originalUrl.match(monitorRoute)) {
                    return false;
                }
                if (typeof monitorRoute === 'string' && req.originalUrl.startsWith(monitorRoute)) {
                    return false;
                }
            }
            this.logger.debug(`Route ${req.path} is not listed in specific routes to monitor`);
        }

        return shouldFilterRoute;
    }

    verifyUserScore(ctx, callback) {
        const startRiskRtt = Date.now();
        ctx.riskRtt = 0;

        try {
            if (!ctx.ip || !ctx.uri) {
                this.logger.error('perimeterx score evaluation failed. bad parameters.');
                return callback(ScoreEvaluateAction.COOKIE_PASS_TRAFFIC);
            }

            const action = pxCookie.evalCookie(ctx, this.pxConfig);
            /* score did not cross threshold - pass traffic */
            if (action === ScoreEvaluateAction.GOOD_SCORE) {
                return callback(ScoreEvaluateAction.COOKIE_PASS_TRAFFIC);
            }

            /* score crossed threshold - block traffic */
            if (action === ScoreEvaluateAction.BAD_SCORE) {
                ctx.blockReason = 'cookie_high_score';
                return callback(ScoreEvaluateAction.COOKIE_BLOCK_TRAFFIC);
            }

            /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
            pxApi.evalByServerCall(ctx, this.pxConfig, (action) => {
                ctx.riskRtt = Date.now() - startRiskRtt;
                const { px_blocking_score } = this.pxConfig.Config;

                if (action === ScoreEvaluateAction.UNEXPECTED_RESULT) {
                    this.logger.debug('perimeterx score evaluation failed. unexpected error. passing traffic');
                    return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
                }

                this.logger.debug(
                    `Risk API response returned successfully, risk score: ${ctx.score}, round_trip_time: ${ctx.riskRtt}ms`,
                );

                if (action === ScoreEvaluateAction.GOOD_SCORE) {
                    this.logger.debug(
                        `Risk score is lower than blocking score. score: ${ctx.score} blocking score: ${px_blocking_score}`,
                    );
                    return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
                }

                if (action === ScoreEvaluateAction.BAD_SCORE) {
                    this.logger.debug(
                        `Risk score is higher or equal to blocking score. score: ${ctx.score} blocking score: ${px_blocking_score}`,
                    );
                    switch (ctx.blockAction) {
                        case 'j':
                            ctx.blockReason = 'challenge';
                            break;
                        case 'r':
                            ctx.blockReason = 'exceeded_rate_limit';
                            break;
                        default:
                            ctx.blockReason = 's2s_high_score';
                    }
                    return callback(ScoreEvaluateAction.S2S_BLOCK_TRAFFIC);
                }

                if (action === ScoreEvaluateAction.S2S_TIMEOUT_PASS) {
                    this.logger.debug(`Risk API timed out , round_trip_time: ${ctx.riskRtt}ms`);
                    return callback(ScoreEvaluateAction.S2S_TIMEOUT_PASS);
                }
            });
        } catch (e) {
            this.logger.error('perimeterx score evaluation failed. unexpected error. ' + e.message);
            ctx.riskRtt = Date.now() - startRiskRtt;
            return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
        }
    }

    handleVerification(ctx, req, res, cb) {
        const {
            px_app_id,
            px_blocking_score,
            px_pxhd_secure,
            px_additional_activity_handler,
            px_custom_request_handler,
            px_advanced_blocking_response_enabled
        } = this.pxConfig.Config;

        const verified = ctx.score < px_blocking_score;

        if (res) {
            const setCookie = res.getHeader('Set-Cookie') ? res.getHeader('Set-Cookie') : '';
            const secure = px_pxhd_secure ? '; Secure' : '';
            const pxhdCookie = ctx.pxhdServer ? `_pxhd=${ctx.pxhdServer} ${secure}` : '';
            const setCookieModified = [setCookie, pxhdCookie].filter(Boolean);
            if (setCookieModified.length > 0) {
                const expires = `expires=${new Date(
                    new Date().getTime() + Constants.MILLISECONDS_IN_YEAR,
                ).toUTCString()}`;
                res.setHeader('Set-Cookie', `${setCookieModified}; ${expires}`);
            }
        }
        // Handle async activities
        if (verified) {
            this.pxPass(ctx, req);
        } else {
            this.pxBlock(ctx);
        }

        // check for additional activity handler
        if (px_additional_activity_handler) {
            px_additional_activity_handler(ctx, this.pxConfig.Config);
        }

        if (px_custom_request_handler) {
            if (res) {
                px_custom_request_handler(ctx, this.pxConfig.Config, req, res);
                if (res.headersSent) {
                    return;
                }
            } else {
                const result = px_custom_request_handler(ctx, this.pxConfig.Config, req);
                if (result) {
                    return cb(null, result);
                }
            }
        }

        // If verified, pass the request here
        if (verified || pxUtil.isReqInMonitorMode(this.pxConfig, ctx)) {
            return cb();
        }

        const acceptHeaderValue = req.headers['accept'] || req.headers['content-type'];
        const isJsonResponse =
            px_advanced_blocking_response_enabled &&
            acceptHeaderValue &&
            acceptHeaderValue.split(',').find((value) => value.toLowerCase() === 'application/json') &&
            (ctx.cookieOrigin !== CookieOrigin.HEADER) &&
            ctx.blockAction !== 'r';

        this.logger.debug(
            `Enforcing action: ${pxUtil.parseAction(ctx.blockAction)} page is served ${
                isJsonResponse ? 'using advanced protection mode' : ''
            }`,
        );
        this.generateResponse(ctx, isJsonResponse, function (responseObject) {
            const response = {
                status: '403',
                statusDescription: 'Forbidden',
            };

            if (ctx.blockAction === 'r') {
                response.status = '429';
                response.statusDescription = 'Too Many Requests';
            }

            if (isJsonResponse) {
                response.header = { key: 'Content-Type', value: 'application/json' };
                response.body = {
                    appId: responseObject.appId,
                    jsClientSrc: responseObject.jsClientSrc,
                    firstPartyEnabled: responseObject.firstPartyEnabled,
                    vid: responseObject.vid,
                    uuid: responseObject.uuid,
                    hostUrl: responseObject.hostUrl,
                    blockScript: responseObject.blockScript,
                };
                return cb(null, response);
            }

            response.header = { key: 'Content-Type', value: 'text/html' };
            response.body = responseObject;

            if (ctx.cookieOrigin === CookieOrigin.HEADER) {
                response.header = { key: 'Content-Type', value: 'application/json' };
                response.body = {
                    action: pxUtil.parseAction(ctx.blockAction),
                    uuid: ctx.uuid,
                    vid: ctx.vid,
                    appId: px_app_id,
                    page: Buffer.from(responseObject).toString('base64'),
                    collectorUrl: ctx.collectorUrl,
                };
            }
            cb(null, response);
        });
    }

    get config() {
        return this.pxConfig;
    }

    getActivityDetails(ctx) {
        return {
            client_uuid: ctx.uuid,
            http_version: ctx.httpVersion,
            risk_rtt: ctx.riskRtt,
            module_version: this.pxConfig.ModuleVersion,
        };
    }

    /**
     * pxPass - pass handler, sends page_requested activity and passes the request using next()
     * @param {Object} ctx - current request context.
     * @param {Object} config - perimeterx config.
     */
    pxPass(ctx, req) {
        const { px_external_activities_enabled } = this.pxConfig.Config;

        const details = {
            ...this.getActivityDetails(ctx),
            px_cookie: ctx.decodedCookie,
            pass_reason: ctx.passReason,
            ...ctx.additionalFields,
        };

        if (ctx.passReason === PassReason.S2S_ERROR && ctx.s2sErrorInfo) {
            this.setS2SErrorInfo(details, ctx.s2sErrorInfo);
        }

        if (px_external_activities_enabled && req) {
            req.headers['x-px-pagerequested'] = JSON.stringify(
                this.pxClient.generateActivity('page_requested', details, ctx, this.pxConfig),
            );
        } else {
            this.logger.debug('Sending page requested activity');
            this.pxClient.sendToPerimeterX('page_requested', details, ctx, this.pxConfig);
        }
    }

    setS2SErrorInfo(details, s2sErrorInfo) {
        details['s2s_error_reason'] = s2sErrorInfo.errorReason;
        details['s2s_error_message'] = s2sErrorInfo.errorMessage;
        details['s2s_error_http_status'] = s2sErrorInfo.httpStatus;
        details['s2s_error_http_message'] = s2sErrorInfo.httpMessage;
    }

    /**
     * pxBlock - block handler, send blocking activity to px and render the block html back to screen
     *
     * @param {Object} ctx - current request context.
     * @param config
     */
    pxBlock(ctx) {
        const details = {
            ...this.getActivityDetails(ctx),
            block_reason: ctx.blockReason,
            block_score: ctx.score,
            simulated_block: pxUtil.isReqInMonitorMode(this.pxConfig, ctx),
            ...ctx.additionalFields,
        };

        this.logger.debug(`Sending block activity`);
        this.pxClient.sendToPerimeterX('block', details, ctx, this.pxConfig);
    }

    /**
     * generateResponse - genarating HTML string from ctx in case
     * action was to block the request
     *
     * @param {Object} ctx - current request context.
     * @param {Object} config - current Px configs
     * @param {Function} cb - send the generated html value.
     */
    generateResponse(ctx, jsonResponse, cb) {
        let template;
        switch (ctx.blockAction) {
            case 'j':
                return cb(ctx.blockActionData);
            case 'r':
                return this.compileMustache('ratelimit', {}, cb);
        }

        const props = this.getProps(ctx, template);
        if (jsonResponse) {
            return cb(props);
        } else {
            return this.compileMustache('block_template', props, cb);
        }
    }

    getProps(ctx) {
        const { px_app_id, px_first_party_enabled } = this.pxConfig.Config;
        let jsClientSrc = `//${Constants.DEFAULT_CLIENT_HOST}/${px_app_id}/main.min.js`;
        let captchaSrc = `//${Constants.DEFAULT_CAPTCHA_HOST}/${px_app_id}/captcha.js?a=${ctx.blockAction}&u=${
            ctx.uuid
        }&v=${ctx.vid || ''}&m=${ctx.isMobile() ? '1' : '0'}`;
        let hostUrl = ctx.collectorUrl;

        if (px_first_party_enabled && !ctx.isMobile()) {
            const prefix = px_app_id.substring(2);
            jsClientSrc = `/${prefix}${Constants.FIRST_PARTY_VENDOR_PATH}`;
            captchaSrc = `/${prefix}${Constants.FIRST_PARTY_CAPTCHA_PATH}/captcha.js?a=${ctx.blockAction}&u=${
                ctx.uuid
            }&v=${ctx.vid || ''}&m=${ctx.isMobile() ? '1' : '0'}`;
            hostUrl = `/${prefix}${Constants.FIRST_PARTY_XHR_PATH}`;
        }

        const { px_custom_logo, px_css_ref, px_js_ref, px_custom_template_data } = this.pxConfig.Config;

        return {
            refId: ctx.uuid,
            appId: px_app_id,
            vid: ctx.vid,
            uuid: ctx.uuid,
            customLogo: px_custom_logo,
            cssRef: px_css_ref,
            jsRef: px_js_ref,
            logoVisibility: px_custom_logo ? 'visible' : 'hidden',
            hostUrl: hostUrl,
            jsClientSrc: jsClientSrc,
            firstPartyEnabled: px_first_party_enabled,
            blockScript: captchaSrc,
            customData: px_custom_template_data && JSON.stringify(px_custom_template_data),
        };
    }

    compileMustache(template, props, cb) {
        let htmlTemplate = '';

        const { px_custom_template_root } = this.pxConfig.Config;

        mu.root = px_custom_template_root || `${__dirname}/templates`;
        const compile = mu.compileAndRender(`${template}.mustache`, props);

        // Building html from template into string variable
        compile.on('data', (data) => {
            htmlTemplate = htmlTemplate.concat(data);
        });

        // After stream finished return htmlTemplate to CB
        compile.on('end', () => {
            cb(htmlTemplate);
        });
    }
}

module.exports = PxEnforcer;
