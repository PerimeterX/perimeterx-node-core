'use strict';

const mu = require('mu2');
const ipRangeCheck = require('ip-range-check');

const Constants = require('./utils/constants');

const ScoreEvaluateAction = require('./enums/ScoreEvaluateAction');
const PassReason = require('./enums/PassReason');
const { CookieOrigin } = require('./enums/CookieOrigin');
const { ActivityType } = require('./enums/ActivityType');

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
const LoginCredentialsExtractor = require('./extract_field/LoginCredentialsExtractor');
const { LoginSuccessfulParserFactory } = require('./extract_field/login_successful/LoginSuccessfulParserFactory');
const { CI_RAW_USERNAME_FIELD, CI_VERSION_FIELD, CI_SSO_STEP_FIELD, CI_CREDENTIALS_COMPROMISED_FIELD } = require('./utils/constants');

class PxEnforcer {
    constructor(params, client) {
        this.logger = new PxLogger(params);

        this.pxConfig = new PxConfig(params, this.logger);
        this._config = this.pxConfig.conf;

        this.pxClient = client ? client : new PxClient();
        this.pxClient.init(this._config);
        if (this._config.DYNAMIC_CONFIGURATIONS) {
            this.config.configLoader = new ConfigLoader(this.pxConfig, this.pxClient);
            this.config.configLoader.init();
        }
        this.reversePrefix = this.pxConfig.conf.PX_APP_ID.substring(2);
        this.initializeCredentialsIntelligence(this.logger, this._config);

    }

    initializeCredentialsIntelligence(logger, config) {
        if (config.ENABLE_LOGIN_CREDS_EXTRACTION && config.LOGIN_CREDS_EXTRACTION.length > 0) {
            this.loginCredentialsExtractor = new LoginCredentialsExtractor(logger, config.CREDENTIALS_INTELLIGENCE_VERSION, config.LOGIN_CREDS_EXTRACTION);
            this.loginSuccessfulParser = LoginSuccessfulParserFactory.Create(config);
        }
    }

    enforce(req, res, cb) {
        const requestUrl = req.originalUrl;
        const userAgent = req.get('user-agent') || '';
        const ipAddress = pxUtil.extractIP(this._config, req);

        this.logger.debug('Starting request verification');

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_VENDOR_PATH}`)) {
            // reverse proxy client
            return pxProxy.getClient(req, this._config, ipAddress, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_XHR_PATH}`)) {
            //reverse proxy xhr
            return pxProxy.sendXHR(req, this._config, ipAddress, this.reversePrefix, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_CAPTCHA_PATH}`)) {
            // reverse proxy captcha
            return pxProxy.getCaptcha(req, this._config, ipAddress, this.reversePrefix, cb);
        }

        if (!this._config.ENABLE_MODULE) {
            this.logger.debug('Request will not be verified, module is disabled');
            return cb();
        }

        if (this._config.FILTER_BY_METHOD.includes(req.method.toUpperCase())) {
            this.logger.debug(`Skipping verification for filtered method ${req.method}`);
            return cb();
        }

        if (userAgent && this._config.FILTER_BY_USERAGENT && this._config.FILTER_BY_USERAGENT.length > 0) {
            for (const ua of this._config.FILTER_BY_USERAGENT) {
                if (pxUtil.isStringMatchWith(userAgent, ua)) {
                    this.logger.debug(`Skipping verification for filtered user agent ${userAgent}`);
                    return cb();
                }
            }
        }

        if (ipAddress && this._config.FILTER_BY_IP.find((range) => ipRangeCheck(ipAddress, range))) {
            // ip is filtered
            this.logger.debug(`Skipping verification for filtered ip address ${ipAddress}`);
            return cb();
        }

        try {
            if (telemetryHandler.isTelemetryCommand(req, this._config)) {
                this.pxClient.sendEnforcerTelemetry('command', this._config);
            }
        } catch (err) {
            this.logger.debug('Telemetry command failure. unexpected error. ' + err.message);
        }

        try {
            if (this.shouldFilterRequest(req)) {
                this.logger.debug(`Skipping verification for route ${req.path}`);
                return cb();
            }

            const ctx = new PxContext(this._config, req, this._getAdditionalFields(req));
            this._tryModifyContext(ctx);
            req.locals = { ...req.locals, pxCtx: ctx };


            this.logger.debug('Request context created successfully');
            ctx.collectorUrl = `https://collector-${this._config.PX_APP_ID}.perimeterx.net`;

            PxDataEnrichment.ProcessDataEnrichmentCookie(ctx, this._config);

            this.verifyUserScore(ctx, () => {
                this.handleVerification(ctx, req, res, cb);
            });
        } catch (err) {
            return cb();
        }
    }

    _tryModifyContext(ctx) {
        if (this._config.MODIFY_CONTEXT && typeof this._config.MODIFY_CONTEXT === 'function') {
            try {
                this._config.MODIFY_CONTEXT(ctx);
            } catch (e) {
                this.logger.debug(`error modifying context: ${e}`);
            }
        }
    }

    _getAdditionalFields(req) {
        const additionalFields = {};
        if (this.loginCredentialsExtractor) {
            additionalFields.loginCredentials = this.loginCredentialsExtractor.ExtractLoginCredentials(req);
        }
        return additionalFields;
    }

    shouldFilterRequest(req) {
        let shouldFilterRoute = false;

        if (pxUtil.checkForStatic(req, this._config.STATIC_FILES_EXT)) {
            this.logger.debug(`Found whitelist ext in path: ${req.originalUrl}`);
            return true;
        }

        if (this._config.WHITELIST_ROUTES && this._config.WHITELIST_ROUTES.length > 0) {
            for (const whitelistRoute of this._config.WHITELIST_ROUTES) {
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

        if (this._config.ENFORCED_ROUTES && this._config.ENFORCED_ROUTES.length > 0) {
            for (const enforceRoute of this._config.ENFORCED_ROUTES) {
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

        if (this._config.MONITORED_ROUTES && this._config.MONITORED_ROUTES.length > 0) {
            for (const monitorRoute of this._config.MONITORED_ROUTES) {
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
        let startRiskRtt;
        ctx.riskRtt = 0;
        try {
            if (!ctx.ip || !ctx.uri) {
                this.logger.error('perimeterx score evaluation failed. bad parameters.');
                return callback(ScoreEvaluateAction.COOKIE_PASS_TRAFFIC);
            }

            const action = pxCookie.evalCookie(ctx, this._config);
            /* score did not cross threshold - pass traffic */
            if (action === ScoreEvaluateAction.GOOD_SCORE) {
                return callback(ScoreEvaluateAction.COOKIE_PASS_TRAFFIC);
            }

            /* score crossed threshold - block traffic */
            if (action === ScoreEvaluateAction.BAD_SCORE) {
                ctx.blockReason = 'cookie_high_score';
                return callback(ScoreEvaluateAction.COOKIE_BLOCK_TRAFFIC);
            }
            startRiskRtt = Date.now();

            /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
            pxApi.evalByServerCall(ctx, this._config, (action) => {
                ctx.riskRtt = Date.now() - startRiskRtt;

                if (action === ScoreEvaluateAction.UNEXPECTED_RESULT) {
                    this.logger.debug('perimeterx score evaluation failed. unexpected error. passing traffic');
                    return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
                }

                this.logger.debug(
                    `Risk API response returned successfully, risk score: ${ctx.score}, round_trip_time: ${ctx.riskRtt}ms`,
                );

                if (action === ScoreEvaluateAction.GOOD_SCORE) {
                    this.logger.debug(
                        `Risk score is lower than blocking score. score: ${ctx.score} blocking score: ${this._config.BLOCKING_SCORE}`,
                    );
                    return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
                }

                if (action === ScoreEvaluateAction.BAD_SCORE) {
                    this.logger.debug(
                        `Risk score is higher or equal to blocking score. score: ${ctx.score} blocking score: ${this._config.BLOCKING_SCORE}`,
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
            ctx.riskRtt = startRiskRtt ? Date.now() - startRiskRtt : 0;
            return callback(ScoreEvaluateAction.S2S_PASS_TRAFFIC);
        }
    }

    handleVerification(ctx, req, res, cb) {
        const verified = ctx.score < this._config.BLOCKING_SCORE;

        if (res) {
            const setCookie = res.getHeader('Set-Cookie') ? res.getHeader('Set-Cookie') : '';
            const secure = this._config.PXHD_SECURE ? '; Secure' : '';
            const pxhdCookie = ctx.pxhdServer ? `_pxhd=${ctx.pxhdServer} ${secure}; SameSite=Lax` : '';
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
        if (this._config.ADDITIONAL_ACTIVITY_HANDLER) {
            this._config.ADDITIONAL_ACTIVITY_HANDLER(ctx, this._config);
        }

        if (this._config.CUSTOM_REQUEST_HANDLER) {
            if (res) {
                this._config.CUSTOM_REQUEST_HANDLER(ctx, this._config, req, res);
                if (res.headersSent) {
                    return;
                }
            } else {
                const result = this._config.CUSTOM_REQUEST_HANDLER(ctx, this._config, req);
                if (result) {
                    return cb(null, result);
                }
            }
        }

        // If verified, pass the request here
        if (verified || pxUtil.isReqInMonitorMode(this._config, ctx)) {
            return cb();
        }

        const acceptHeaderValue = req.headers['accept'] || req.headers['content-type'];
        const isJsonResponse =
            this._config.ADVANCED_BLOCKING_RESPONSE &&
            acceptHeaderValue &&
            acceptHeaderValue.split(',').find((value) => value.toLowerCase() === 'application/json') &&
            (ctx.cookieOrigin !== CookieOrigin.HEADER) &&
            ctx.blockAction !== 'r';

        this.logger.debug(
            `Enforcing action: ${pxUtil.parseAction(ctx.blockAction)} page is served ${
                isJsonResponse ? 'using advanced protection mode' : ''
            }`,
        );
        const config = this._config;
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
                    altBlockScript: responseObject.altBlockScript,
                    customLogo: responseObject.customLogo
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
                    appId: config.PX_APP_ID,
                    page: new Buffer(responseObject).toString('base64'),
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
            module_version: this.pxConfig.conf.MODULE_VERSION,
            cookie_origin: ctx.cookieOrigin,
            http_method: ctx.httpMethod,
            request_cookie_names: ctx.requestCookieNames,
        };
    }

    /**
     * pxPass - pass handler, sends page_requested activity and passes the request using next()
     * @param {Object} ctx - current request context.
     * @param {Object} req - HTTP request.
     */
    pxPass(ctx, req) {
        const details = {
            ...this.getActivityDetails(ctx),
            px_cookie: ctx.decodedCookie,
            pass_reason: ctx.passReason
        };
        if (ctx.serverInfoRegion) {
            details['server_info_region'] = ctx.serverInfoRegion;
        }

        if (ctx.passReason === PassReason.S2S_ERROR && ctx.s2sErrorInfo) {
            this.setS2SErrorInfo(details, ctx.s2sErrorInfo);
        }

        if (this._config.ENABLE_LOGIN_CREDS_EXTRACTION && ctx.additionalFields && ctx.additionalFields.loginCredentials) {
            this.handleCredentialsIntelligenceInPageRequestedActivity(ctx, req, details);
        }

        this.logger.debug('Sending page requested activity');
        this.pxClient.sendToPerimeterX(ActivityType.PAGE_REQUESTED, details, ctx, this._config);
    }

    handleCredentialsIntelligenceInPageRequestedActivity(ctx, req, details) {
        details[CI_VERSION_FIELD] = ctx.additionalFields.loginCredentials.version;
        details[CI_SSO_STEP_FIELD] = ctx.additionalFields.loginCredentials.ssoStep || undefined;
        details[CI_CREDENTIALS_COMPROMISED_FIELD] = ctx.areCredentialsCompromised();

        if (details[CI_CREDENTIALS_COMPROMISED_FIELD]) {
            req.headers[this._config.COMPROMISED_CREDENTIALS_HEADER] = JSON.stringify(ctx.pxde['breached_account']);
        }

        if (this._config.ENABLE_ADDITIONAL_S2S_ACTIVITY_HEADER) {
            req.headers[Constants.DEFAULT_ADDITIONAL_ACTIVITY_HEADER_NAME] = JSON.stringify(
                this.pxClient.generateAdditionalS2SActivity(ctx, this._config)
            );
            req.headers[Constants.DEFAULT_ADDITIONAL_ACTIVITY_URL_HEADER_NAME] = `${this._config.BACKEND_URL}${this._config.SERVER_COLLECT_URI}`;
        }
    }

    setS2SErrorInfo(details, s2sErrorInfo) {
        details['s2s_error_reason'] = s2sErrorInfo.errorReason;
        details['s2s_error_message'] = s2sErrorInfo.errorMessage;
        details['s2s_error_http_status'] = s2sErrorInfo.httpStatus;
        details['s2s_error_http_message'] = s2sErrorInfo.httpMessage;
    }

    /**
     * handleAdditionalS2SActivity - parses response and sends additional_s2s activity
     *
     * @param {Object} pxCtx - PerimeterX Context
     * @param {Object} res - HTTP response
     */
    handleAdditionalS2SActivity(pxCtx, res) {
        const responseStatusCode = res.statusCode;
        const isLoginSuccessful = this.parseLoginSuccessful(res);
        this.sendAdditionalS2SActivity(pxCtx, responseStatusCode, isLoginSuccessful);
    }

    parseLoginSuccessful(res) {
        try {
            return this.loginSuccessfulParser ? this.loginSuccessfulParser.IsLoginSuccessful(res) : false;
        } catch (err) {
            this.logger.debug(`Error determining login status: ${err}`);
            return false;
        }
    }

    /**
     * sendAdditionalS2SActivity - sends additional_s2s activity to PerimeterX
     *
     * @param {Object} pxCtx
     * @param {number} responseStatusCode
     * @param {boolean} isLoginSuccessful
     */
    sendAdditionalS2SActivity(pxCtx, responseStatusCode, isLoginSuccessful) {
        if (!pxCtx || !pxCtx.additionalFields || !pxCtx.additionalFields.loginCredentials) {
            this.logger.debug('No login credentials extracted, no need to send additional_s2s activity');
            return;
        }

        const details = {
            http_status_code: responseStatusCode,
            login_successful: !!isLoginSuccessful,
        };

        if (!isLoginSuccessful) {
            details[CI_RAW_USERNAME_FIELD] = undefined;
        }
        const activity = this.pxClient.generateAdditionalS2SActivity(pxCtx, this._config, details);

        this.logger.debug('Sending additional_s2s activity');
        this.pxClient.callServer(activity, this._config.SERVER_COLLECT_URI, {}, this._config);
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
            block_action: ctx.blockAction,
            simulated_block: pxUtil.isReqInMonitorMode(this._config, ctx),
        };
        if (ctx.serverInfoRegion) {
            details['server_info_region'] = ctx.serverInfoRegion;
        }

        this.logger.debug(`Sending block activity`);
        this.pxClient.sendToPerimeterX(ActivityType.BLOCK, details, ctx, this._config);
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
        let jsClientSrc = `//${this._config.CLIENT_HOST}/${this._config.PX_APP_ID}/main.min.js`;
        const captchaParams = `/captcha.js?a=${ctx.blockAction}&u=${
            ctx.uuid
        }&v=${ctx.vid || ''}&m=${ctx.isMobile() ? '1' : '0'}`;
        let captchaSrc = `//${this._config.CAPTCHA_HOST}/${this._config.PX_APP_ID}${captchaParams}`;
        let hostUrl = ctx.collectorUrl;

        if (this._config.FIRST_PARTY_ENABLED && !ctx.isMobile()) {
            const prefix = this._config.PX_CUSTOM_FIRST_PARTY_PATH || `/${this._config.PX_APP_ID.substring(2)}`;
            jsClientSrc = `${prefix}${this._config.FIRST_PARTY_VENDOR_PATH}`;
            captchaSrc = `${prefix}${this._config.FIRST_PARTY_CAPTCHA_PATH}${captchaParams}`;
            hostUrl = `${prefix}${this._config.FIRST_PARTY_XHR_PATH}`;
        }

        return {
            appId: this._config.PX_APP_ID,
            vid: ctx.vid,
            uuid: ctx.uuid,
            customLogo: this._config.CUSTOM_LOGO,
            cssRef: this._config.CSS_REF,
            jsRef: this._config.JS_REF,
            hostUrl: hostUrl,
            jsClientSrc: jsClientSrc,
            firstPartyEnabled: this._config.FIRST_PARTY_ENABLED,
            isMobile: ctx.isMobile(),
            blockScript: captchaSrc,
            altBlockScript: `${this._config.BACKUP_CAPTCHA_HOST}/${this._config.PX_APP_ID}${captchaParams}`
        };
    }

    compileMustache(template, props, cb) {
        let htmlTemplate = '';

        mu.root = this._config.CUSTOM_TEMPLATE_ROOT || `${__dirname}/templates`;
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
