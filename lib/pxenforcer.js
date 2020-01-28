'use strict';

const mu = require('mu2');
const PxClient = require('./pxclient');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const pxProxy = require('./pxproxy');
const pxUtil = require('./pxutil');
const pxApi = require('./pxapi');
const pxCookie = require('./pxcookie');
const PxLogger = require('./pxlogger');
const ConfigLoader = require('./configloader');
const telemetryHandler = require('./telemetry_handler.js');
const ipRangeCheck = require('ip-range-check');

class PxEnforcer {
    constructor(params, client) {
        this.logger = new PxLogger();

        this.pxConfig = new PxConfig(params, this.logger);
        this._config = this.pxConfig.conf;

        this.logger.init(this.pxConfig);

        this.pxClient = (client) ? client : new PxClient();
        this.pxClient.init(this._config);
        if (this._config.DYNAMIC_CONFIGURATIONS) {
            this.config.configLoader = new ConfigLoader(this.pxConfig, this.pxClient);
            this.config.configLoader.init();
        }

        this.reversePrefix = this.pxConfig.conf.PX_APP_ID.substring(2);
    }

    enforce(req, res, cb) {
        const requestUrl = req.originalUrl;
        let userAgent = '';
        if (req.get('user-agent')) {
            userAgent = req.get('user-agent').toLowerCase();
        }
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

        if (userAgent && this._config.FILTER_BY_USERAGENT.includes(userAgent)) {
            // user agent is filtered
            this.logger.debug(`Skipping verification for filtered user agent ${userAgent}`);
            return cb();
        }

        if (ipAddress && this._config.FILTER_BY_IP.find(range => ipRangeCheck(ipAddress, range))) {
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

            const ctx = new PxContext(this._config, req, this.logger);

            this.logger.debug('Request context created successfully');
            ctx.collectorUrl = `https://collector-${this._config.PX_APP_ID}.perimeterx.net`;

            this.verifyUserScore(ctx, () => {
                this.handleVerification(ctx, req, res, cb);
            });
        } catch (err) {
            return cb();
        }
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
        const startRiskRtt = Date.now();
        ctx.riskRtt = 0;

        try {
            if (!ctx.ip || !ctx.uri) {
                this.logger.error('perimeterx score evaluation failed. bad parameters.');
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            const action = pxCookie.evalCookie(ctx, this._config);
            /* score did not cross threshold - pass traffic */
            if (action === this._config.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            /* score crossed threshold - block traffic */
            if (action === this._config.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                ctx.blockReason = 'cookie_high_score';
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_BLOCK_TRAFFIC);
            }

            /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
            pxApi.evalByServerCall(ctx, this._config, (action) => {
                ctx.riskRtt = Date.now() - startRiskRtt;

                if (action === this._config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT) {
                    this.logger.debug('perimeterx score evaluation failed. unexpected error. passing traffic');
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                this.logger.debug(`Risk API response returned successfully, risk score: ${ctx.score}, round_trip_time: ${ctx.riskRtt}ms`);

                if (action === this._config.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                    this.logger.debug(`Risk score is lower than blocking score. score: ${ctx.score} blocking score: ${this._config.BLOCKING_SCORE}`);
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                if (action === this._config.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                    this.logger.debug(`Risk score is higher or equal to blocking score. score: ${ctx.score} blocking score: ${this._config.BLOCKING_SCORE}`);
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
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_BLOCK_TRAFFIC);
                }

                if (action === this._config.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS) {
                    this.logger.debug(`Risk API timed out , round_trip_time: ${ctx.riskRtt}ms`);
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS);
                }
            });
        } catch (e) {
            this.logger.error('perimeterx score evaluation failed. unexpected error. ' + e.message);
            ctx.riskRtt = Date.now() - startRiskRtt;
            return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
        }
    }

    handleVerification(ctx, req, res, cb) {
        const verified = ctx.score < this._config.BLOCKING_SCORE;
        if (res) {
            const setCookie = res.getHeader('Set-Cookie') ? res.getHeader('Set-Cookie') : '';
            const pxhdCookie = ctx.pxhdServer ? '_pxhd=' + ctx.pxhdServer : '';
            const setCookieModified = [setCookie, pxhdCookie].filter(Boolean);
            if (setCookieModified.length > 0) {
                res.setHeader('Set-Cookie', setCookieModified + ';expires=' + (new Date(new Date().setFullYear(new Date().getFullYear() + 1))));
            }
        }
        // Handle async activities
        if (verified) {
            this.pxPass(ctx);
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
        const shouldBypassMonitor = this._config.BYPASS_MONITOR_HEADER && req.headers[this._config.BYPASS_MONITOR_HEADER] === '1';
        if (verified || ctx.monitoredRoute || (this._config.MODULE_MODE === this._config.MONITOR_MODE.MONITOR && !shouldBypassMonitor)) {
            return cb();
        }

        const acceptHeaderValue = req.headers['accept'] || req.headers['content-type'];
        const isJsonResponse = (this._config.ADVANCED_BLOCKING_RESPONSE &&
            acceptHeaderValue &&
            acceptHeaderValue.split(',').find((value) => value.toLowerCase() === 'application/json') &&
            ctx.cookieOrigin === 'cookie' && ctx.blockAction !== 'r');

        this.logger.debug(`Enforcing action: ${pxUtil.parseAction(ctx.blockAction)} page is served ${isJsonResponse ? 'using advanced protection mode' : ''}`);
        const config = this._config;
        this.generateResponse(ctx, isJsonResponse, function (responseObject) {
            const response = {
                status: '403',
                statusDescription: 'Forbidden'
            };

            if (ctx.blockAction === 'r') {
                response.status = '429';
                response.statusDescription = 'Too Many Requests';
            }

            if (isJsonResponse) {
                response.header = {key: 'Content-Type', value: 'application/json'};
                response.body = {
                    appId: responseObject.appId,
                    jsClientSrc: responseObject.jsClientSrc,
                    firstPartyEnabled: responseObject.firstPartyEnabled,
                    vid: responseObject.vid,
                    uuid: responseObject.uuid,
                    hostUrl: responseObject.hostUrl,
                    blockScript: responseObject.blockScript
                };
                return cb(null, response);
            }

            response.header = {key: 'Content-Type', value: 'text/html'};
            response.body = responseObject;

            if (ctx.cookieOrigin !== 'cookie') {
                response.header = {key: 'Content-Type', value: 'application/json'};
                response.body = {
                    action: pxUtil.parseAction(ctx.blockAction),
                    uuid: ctx.uuid,
                    vid: ctx.vid,
                    appId: config.PX_APP_ID,
                    page: new Buffer(responseObject).toString('base64'),
                    collectorUrl: ctx.collectorUrl
                };
            }
            cb(null, response);
        });
    }

    get config() {
        return this.pxConfig;
    }

    /**
     * pxPass - pass handler, sends page_requested activity and passes the request using next()
     * @param {Object} ctx - current request context.
     * @param {Object} config - perimeterx config.
     */
    pxPass(ctx) {
        const details = {
            'px_cookie': ctx.decodedCookie,
            'client_uuid': ctx.uuid,
            'pass_reason': ctx.passReason,
            'risk_rtt': ctx.riskRtt,
            'module_version': this.pxConfig.conf.MODULE_VERSION
        };
        this.logger.debug('Sending page requested activity');
        this.pxClient.sendToPerimeterX('page_requested', details, ctx, this._config);
    }

    /**
     * pxBlock - block handler, send blocking activity to px and render the block html back to screen
     *
     * @param {Object} ctx - current request context.
     * @param config
     */
    pxBlock(ctx) {
        const details = {
            block_reason: ctx.blockReason,
            client_uuid: ctx.uuid,
            block_module: 'px-node-express',
            block_score: ctx.score,
            module_version: this.pxConfig.conf.MODULE_VERSION,
            simulated_block: this._config.MODULE_MODE === this._config.MONITOR_MODE.MONITOR || ctx.monitoredRoute
        };

        this.logger.debug(`Sending block activity`);
        this.pxClient.sendToPerimeterX('block', details, ctx, this._config);
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
        let captchaSrc = `//${this._config.CAPTCHA_HOST}/${this._config.PX_APP_ID}/captcha.js?a=${ctx.blockAction}&u=${ctx.uuid}&v=${ctx.vid || ''}&m=${ctx.isMobile() ? '1' : '0'}`;
        let hostUrl = ctx.collectorUrl;

        if (this._config.FIRST_PARTY_ENABLED && !ctx.isMobile()) {
            const prefix = this._config.PX_APP_ID.substring(2);
            jsClientSrc = `/${prefix}${this._config.FIRST_PARTY_VENDOR_PATH}`;
            captchaSrc = `/${prefix}${this._config.FIRST_PARTY_CAPTCHA_PATH}/captcha.js?a=${ctx.blockAction}&u=${ctx.uuid}&v=${ctx.vid || ''}&m=${ctx.isMobile() ? '1' : '0'}`;
            hostUrl = `/${prefix}${this._config.FIRST_PARTY_XHR_PATH}`;
        }

        return {
            refId: ctx.uuid,
            appId: this._config.PX_APP_ID,
            vid: ctx.vid,
            uuid: ctx.uuid,
            customLogo: this._config.CUSTOM_LOGO,
            cssRef: this._config.CSS_REF,
            jsRef: this._config.JS_REF,
            logoVisibility: this._config.CUSTOM_LOGO ? 'visible' : 'hidden',
            hostUrl: hostUrl,
            jsClientSrc: jsClientSrc,
            firstPartyEnabled: this._config.FIRST_PARTY_ENABLED,
            blockScript: captchaSrc,
            customData: this._config.CUSTOM_TEMPLATE_DATA && JSON.stringify(this._config.CUSTOM_TEMPLATE_DATA)
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
