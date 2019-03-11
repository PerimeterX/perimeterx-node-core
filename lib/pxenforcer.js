'use strict';

const PxClient = require('./pxclient');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const mu = require('mu2');
const pxProxy = require('./pxproxy');
const pxUtil = require('./pxutil');
const pxApi = require('./pxapi');
const pxCookie = require('./pxcookie');

class PxEnforcer {
    constructor(params, client, logger) {
        this.pxLogger = logger;
        if (client) {
            this.pxClient = client;
        } else {
            this.pxClient = new PxClient(this.pxLogger);
        }
        this.pxConfig = new PxConfig(params, this.pxClient, this.pxLogger);
        this._config = this.pxConfig.conf;
        this.pxClient.init(this._config);
        this.pxLogger.init(this.pxConfig);
        this.reversePrefix = this.pxConfig.conf.PX_APP_ID.substring(2);
    }

    enforce(req, res, cb) {
        const requestUrl = req.originalUrl;
        this.pxLogger.debug('Starting request verification');

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_VENDOR_PATH}`)) {
            // reverse proxy client
            return pxProxy.getClient(req, this._config, pxUtil.extractIP(this._config, req, this.pxLogger), this.pxLogger, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_XHR_PATH}`)) {
            //reverse proxy xhr
            return pxProxy.sendXHR(req, this._config, pxUtil.extractIP(this._config, req, this.pxLogger), this.reversePrefix, this.pxLogger, cb);
        }

        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_CAPTCHA_PATH}`)) {
            // reverse proxy captcha
            return pxProxy.getCaptcha(req, this._config, pxUtil.extractIP(this._config, req, this.pxLogger), this.reversePrefix, this.pxLogger, cb);
        }

        if (!this._config.ENABLE_MODULE || pxUtil.checkForStatic(req, this._config.STATIC_FILES_EXT)) {
            this.pxLogger.debug('Request will not be verified, module is disabled');
            return cb();
        }

        try {
            const pxCtx = new PxContext(this._config, req, this.pxLogger);
            this.pxLogger.debug('Request context created successfully');
            pxCtx.collectorUrl = `https://collector-${this._config.PX_APP_ID}.perimeterx.net`;

            if (pxCtx.whitelistRoute) {
                this.pxLogger.debug(`Whitelist route match: ${pxCtx.uri}`);
                return cb();
            }

            this.verifyUserScore(pxCtx, () => {
                this.handleVerification(pxCtx, req, res, cb);
            });
        } catch (err) {
            return cb();
        }
    }

    verifyUserScore(pxCtx, callback) {
        const startRiskRtt = Date.now();
        pxCtx.riskRtt = 0;

        try {
            if (!pxCtx.ip || !pxCtx.uri) {
                this.pxLogger.error('perimeterx score evaluation failed. bad parameters.');
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            const action = pxCookie.evalCookie(pxCtx, this._config, this.pxLogger);
            /* score did not cross threshold - pass traffic */
            if (action === this._config.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            /* score crossed threshold - block traffic */
            if (action === this._config.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                pxCtx.blockReason = 'cookie_high_score';
                return callback(this._config.SCORE_EVALUATE_ACTION.COOKIE_BLOCK_TRAFFIC);
            }

            /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
            pxApi.evalByServerCall(pxCtx, this._config, this.pxLogger, (action) => {
                pxCtx.riskRtt = Date.now() - startRiskRtt;

                if (action === this._config.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT) {
                    this.pxLogger.error('perimeterx score evaluation failed. unexpected error. passing traffic');
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                this.pxLogger.debug(`Risk API response returned successfully, risk score: ${pxCtx.score}, round_trip_time: ${pxCtx.riskRtt}ms`);

                if (action === this._config.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                    this.pxLogger.debug(`Risk score is lower than blocking score. score: ${pxCtx.score} blocking score: ${this._config.BLOCKING_SCORE}`);
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                if (action === this._config.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                    this.pxLogger.debug(`Risk score is higher or equal to blocking score. score: ${pxCtx.score} blocking score: ${this._config.BLOCKING_SCORE}`);
                    switch (pxCtx.blockAction) {
                        case 'j':
                            pxCtx.blockReason = 'challenge';
                            break;
                        case 'r':
                            pxCtx.blockReason = 'exceeded_rate_limit';
                            break;
                        default:
                            pxCtx.blockReason = 's2s_high_score';
                    }
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_BLOCK_TRAFFIC);
                }

                if(action === this._config.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS) {
                    this.pxLogger.debug(`Risk API timed out , round_trip_time: ${pxCtx.riskRtt}ms`);
                    return callback(this._config.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS);
                }
            });
        } catch (e) {
            this.pxLogger.error('perimeterx score evaluation failed. unexpected error. ' + e.message);
            pxCtx.riskRtt = Date.now() - startRiskRtt;
            return callback(this._config.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
        }
    }

    handleVerification(pxCtx, req, res, cb) {
        const verified = pxCtx.score < this._config.BLOCKING_SCORE;
        if (res) {
            const setCookie = res.getHeader('Set-Cookie') ? res.getHeader('Set-Cookie') : '';
            const pxhdCookie = pxCtx.pxhd ? '_pxhd=' + pxCtx.pxhd : '';
            const setCookieModified = [setCookie, pxhdCookie].filter(Boolean);
            if (setCookieModified.length > 0) {
                res.setHeader('Set-Cookie', setCookieModified);
            }
        }
        // Handle async activities
        if (verified) {
            this.pxPass(pxCtx);
        } else {
            this.pxBlock(pxCtx);
        }

        // check for additional activity handler
        if (this._config.ADDITIONAL_ACTIVITY_HANDLER) {
            this._config.ADDITIONAL_ACTIVITY_HANDLER(pxCtx, this._config);
        }

        if (this._config.CUSTOM_REQUEST_HANDLER) {
            if (res) {
                this._config.CUSTOM_REQUEST_HANDLER(pxCtx, this._config, req, res);
                if (res.headersSent) {
                    return;
                }
            } else {
                const result = this._config.CUSTOM_REQUEST_HANDLER(pxCtx, this._config, req);
                if (result) {
                    return cb(null, result);
                }
            }
        }

        // If verified, pass the request here
        const shouldBypassMonitor = this._config.BYPASS_MONITOR_HEADER && req.headers[this._config.BYPASS_MONITOR_HEADER] === '1';
        if (verified || (this._config.MODULE_MODE === this._config.MONITOR_MODE.MONITOR && !shouldBypassMonitor)) {
            return cb();
        }

        const acceptHeaderValue = req.headers['accept'] || req.headers['content-type'];
        const isJsonResponse = acceptHeaderValue && acceptHeaderValue.split(',').find((value) => value.toLowerCase() === 'application/json') && pxCtx.cookieOrigin === 'cookie' && pxCtx.blockAction !== 'r';

        this.pxLogger.debug(`Enforcing action:  ${pxUtil.parseAction(pxCtx.blockAction)} page is served ${isJsonResponse ? 'using advanced protection mode' : ''}`);
        const config = this._config;
        this.generateResponse(pxCtx, isJsonResponse, function (responseObject) {
            const response = {
                status: '403',
                statusDescription: 'Forbidden'
            };

            if (pxCtx.blockAction === 'r') {
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

            if (pxCtx.cookieOrigin !== 'cookie') {
                response.header = {key: 'Content-Type', value: 'application/json'};
                response.body = {
                    action: pxUtil.parseAction(pxCtx.blockAction),
                    uuid: pxCtx.uuid,
                    vid: pxCtx.vid,
                    appId: config.PX_APP_ID,
                    page: new Buffer(responseObject).toString('base64'),
                    collectorUrl: pxCtx.collectorUrl
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
     * @param {Object} pxCtx - current request context.
     * @param {Object} config - perimeterx config.
     */
    pxPass(pxCtx) {
        const details = {
            'px_cookie': pxCtx.decodedCookie,
            'client_uuid': pxCtx.uuid,
            'pass_reason': pxCtx.passReason,
            'risk_rtt': pxCtx.riskRtt,
            'module_version': this.pxConfig.conf.MODULE_VERSION
        };
        this.pxLogger.debug('Sending page requested activity');
        this.pxClient.sendToPerimeterX('page_requested', details, pxCtx, this._config);
    }

    /**
     * pxBlock - block handler, send blocking activity to px and render the block html back to screen
     *
     * @param {Object} pxCtx - current request context.
     * @param config
     */
    pxBlock(pxCtx) {
        const details = {
            block_reason: pxCtx.blockReason,
            client_uuid: pxCtx.uuid,
            block_module: 'px-node-express',
            block_score: pxCtx.score,
            module_version: this.pxConfig.conf.MODULE_VERSION,
            simulated_block: this._config.MODULE_MODE === this._config.MONITOR_MODE.MONITOR
        };

        this.pxLogger.debug(`Sending block activity`);
        this.pxClient.sendToPerimeterX('block', details, pxCtx, this._config);
    }

    /**
     * generateResponse - genarating HTML string from pxContext and pxConfig in case
     * action was to block the request
     *
     * @param {Object} pxContext - current request context.
     * @param {Object} config - current Px configs
     * @param {Function} cb - send the generated html value.
     */
    generateResponse(pxContext, jsonResponse, cb) {
        let template;
        switch (pxContext.blockAction) {
            case 'j':
                return cb(pxContext.blockActionData);
            case 'r':
                return this.compileMustache('ratelimit', {}, cb);
        }

        const props = this.getProps(pxContext, template);
        if (jsonResponse) {
            return cb(props);
        } else {
            return this.compileMustache('block_template', props, cb);
        }
    }

    getProps(pxContext) {
        let jsClientSrc = `//${this._config.CLIENT_HOST}/${this._config.PX_APP_ID}/main.min.js`;
        let captchaSrc = `//${this._config.CAPTCHA_HOST}/${this._config.PX_APP_ID}/captcha.js?a=${pxContext.blockAction}&u=${pxContext.uuid}&v=${pxContext.vid || ''}&m=${pxContext.isMobile() ? '1' :'0'}`;
        let hostUrl = pxContext.collectorUrl;

        if (this._config.FIRST_PARTY_ENABLED && !pxContext.isMobile()) {
            const prefix = this._config.PX_APP_ID.substring(2);
            jsClientSrc = `/${prefix}${this._config.FIRST_PARTY_VENDOR_PATH}`;
            captchaSrc = `/${prefix}${this._config.FIRST_PARTY_CAPTCHA_PATH}/captcha.js?a=${pxContext.blockAction}&u=${pxContext.uuid}&v=${pxContext.vid || ''}&m=${pxContext.isMobile() ? '1' :'0'}`;
            hostUrl = `/${prefix}${this._config.FIRST_PARTY_XHR_PATH}`;
        }

        return {
            refId: pxContext.uuid,
            appId: this._config.PX_APP_ID,
            vid: pxContext.vid,
            uuid: pxContext.uuid,
            customLogo: this._config.CUSTOM_LOGO,
            cssRef: this._config.CSS_REF,
            jsRef: this._config.JS_REF,
            logoVisibility: this._config.CUSTOM_LOGO ? 'visible' : 'hidden',
            hostUrl: hostUrl,
            jsClientSrc: jsClientSrc,
            firstPartyEnabled: this._config.FIRST_PARTY_ENABLED,
            blockScript: captchaSrc
        };
    }

    compileMustache(template, props, cb) {
        let htmlTemplate = '';

        mu.root = `${__dirname}/templates`;
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
