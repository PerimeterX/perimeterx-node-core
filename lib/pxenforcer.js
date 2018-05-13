'use strict';

const PxClient = require('./pxclient');
const pxLogger = require('./pxlogger');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const mu = require('mu2');
const pxProxy = require('./pxproxy');
const pxUtil = require('./pxutil');
const pxApi = require('./pxapi');
const pxCookie = require('./pxcookie');

class PxEnforcer {

    constructor(params, client) {
        if (client) {
            this.pxClient = client;
        } else {
            this.pxClient = new PxClient();
        }
        this.pxClient.init();
        PxConfig.init(params, this.pxClient);
        this.reversePrefix = PxConfig.conf.PX_APP_ID.substring(2).toLowerCase();
    }

    enforce(req, res, cb) {
        const pxConfig = PxConfig.conf;
        const lowerRequestUrl = req.originalUrl.toLowerCase();
        pxLogger.debug("Starting request verification");

        if (lowerRequestUrl.startsWith(`/${this.reversePrefix}${pxConfig.FIRST_PARTY_VENDOR_PATH}`)) {
            // reverse proxy client
            return pxProxy.getClient(req, pxConfig, PxContext.extractIP(pxConfig, req), cb);
        }

        if (lowerRequestUrl.startsWith(`/${this.reversePrefix}${pxConfig.FIRST_PARTY_XHR_PATH}`)) {
            //reverse proxy xhr
            return pxProxy.sendXHR(req, pxConfig, PxContext.extractIP(pxConfig, req), this.reversePrefix, cb);
        }

        if (lowerRequestUrl.startsWith(`/${this.reversePrefix}${pxConfig.FIRST_PARTY_CAPTCHA_PATH}`)) {
            // reverse proxy captcha
            return pxProxy.getCaptcha(req, pxConfig, PxContext.extractIP(pxConfig, req), this.reversePrefix, cb);
        }

        if (!pxConfig.ENABLE_MODULE || pxUtil.checkForStatic(req, pxConfig.STATIC_FILES_EXT)) {
            pxLogger.debug("Request will not be verified, module is disabled");
            return cb();
        }

        try {
            const pxCtx = new PxContext(pxConfig, req);
            pxLogger.debug("Request context created successfully");
            pxCtx.collectorUrl = `https://collector-${pxConfig.PX_APP_ID.toLowerCase()}.perimeterx.net`;

            pxLogger.debug('No Captcha cookie present on the request');
            this.verifyUserScore(pxCtx, pxConfig, (action) => {
                this.handleVerification(pxCtx, pxConfig, req, res, cb)
            });
        } catch (err) {
            return cb();
        }
    }

    verifyUserScore(pxCtx, pxConfig, callback) {
        const startRiskRtt = Date.now();
        pxCtx.riskRtt = 0;

        try {
            if (!pxCtx.ip || !pxCtx.uri) {
                pxLogger.error('perimeterx score evaluation failed. bad parameters.');
                return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            let action = pxCookie.evalCookie(pxCtx);
            /* score did not cross threshold - pass traffic */
            if (action === pxConfig.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_PASS_TRAFFIC);
            }

            /* score crossed threshold - block traffic */
            if (action === pxConfig.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                pxCtx.blockReason = "cookie_high_score";
                return callback(pxConfig.SCORE_EVALUATE_ACTION.COOKIE_BLOCK_TRAFFIC);
            }

            /* when no fallback to s2s call if cookie does not exist or failed on evaluation */
            pxApi.evalByServerCall(pxCtx, (action) => {
                pxCtx.riskRtt = Date.now() - startRiskRtt;

                if (action === pxConfig.SCORE_EVALUATE_ACTION.UNEXPECTED_RESULT) {
                    pxLogger.error('perimeterx score evaluation failed. unexpected error. passing traffic');
                    return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                pxLogger.debug(`Risk API response returned successfully, risk score: ${pxCtx.score}, round_trip_time: ${pxCtx.riskRtt}ms`);

                if (action === pxConfig.SCORE_EVALUATE_ACTION.GOOD_SCORE) {
                    pxLogger.debug(`Risk score is lower than blocking score. score: ${pxCtx.score} blocking score: ${pxConfig.BLOCKING_SCORE}`);
                    return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
                }

                if (action === pxConfig.SCORE_EVALUATE_ACTION.BAD_SCORE) {
                    pxLogger.debug(`Risk score is higher or equal to blocking score. score: ${pxCtx.score} blocking score: ${pxConfig.BLOCKING_SCORE}`);
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
                    return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_BLOCK_TRAFFIC);
                }

                if(action === pxConfig.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS) {
                    pxLogger.debug(`Risk API timed out , round_trip_time: ${pxCtx.riskRtt}ms`);
                    return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_TIMEOUT_PASS);
                }
            });
        } catch (e) {
            pxLogger.error('perimeterx score evaluation failed. unexpected error. ' + e.message);
            pxCtx.riskRtt = Date.now() - startRiskRtt;
            return callback(pxConfig.SCORE_EVALUATE_ACTION.S2S_PASS_TRAFFIC);
        }
    }


    handleVerification(pxCtx, pxConfig, req, res, cb) {
        // check for additional activity handler
        if (pxConfig.ADDITIONAL_ACTIVITY_HANDLER) {
            pxConfig.ADDITIONAL_ACTIVITY_HANDLER(pxCtx, pxConfig);
        }

        if (pxConfig.CUSTOM_REQUEST_HANDLER) {
            if (res) {
                pxConfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxConfig, req, res);
                if (res.headersSent) {
                    return;
                }
            } else {
                pxConfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxConfig, req, (result) => {
                    if (result) {
                        return cb(null, result);
                    }
                });
            }
        }
        if (pxCtx.score < pxConfig.BLOCKING_SCORE) {
            this.pxPass(pxCtx);
            return cb();
        } else {
            this.pxBlock(pxCtx, pxConfig);
            if (pxConfig.MODULE_MODE === pxConfig.MONITOR_MODE.MONITOR) {
                return cb();
            }

            pxLogger.debug(`Enforcing action: ${pxCtx.fullBlockAction} page is served`);
            this.generateTemplate(pxCtx, pxConfig, function (htmlTemplate) {
                const response = {};
                if (pxCtx.blockAction === 'r') {
                    response.status = '429';
                    response.statusDescription = "Too Many Requests";
                } else {
                    response.status = '403';
                    response.statusDescription = "Forbidden";
                }

                if (pxCtx.cookieOrigin === "cookie") {
                    response.header = {key: 'Content-Type', value: 'text/html'};
                    response.body = htmlTemplate;
                } else {
                    response.header = {key: 'Content-Type', value: 'application/json'};
                    response.body = {
                        action: pxCtx.blockAction,
                        uuid: pxCtx.uuid,
                        vid: pxCtx.vid,
                        appId: pxConfig.PX_APP_ID,
                        page: new Buffer(htmlTemplate).toString('base64'),
                        collectorUrl: pxCtx.collectorUrl
                    }
                }
                cb(null, response);
            });
        }
    }

    get config() {
        return PxConfig
    }

    /**
     * pxPass - pass handler, sends page_requested activity and passes the request using next()
     * @param {Object} pxCtx - current request context.
     */
    pxPass(pxCtx) {
        let details = {
            'px_cookie': pxCtx.decodedCookie,
            'client_uuid': pxCtx.uuid,
            "pass_reason": pxCtx.passReason,
            'risk_rtt': pxCtx.riskRtt,
            'module_version': PxConfig.conf.MODULE_VERSION
        };
        pxLogger.debug('Sending page requested activity');
        this.pxClient.sendToPerimeterX('page_requested', details, pxCtx);
    }

    /**
     * pxBlock - block handler, send blocking activity to px and render the block html back to screen
     *
     * @param pxConfig
     * @param {Object} pxCtx - current request context.
     */
    pxBlock(pxCtx, pxConfig) {
        let details = {
            block_reason: pxCtx.blockReason,
            client_uuid: pxCtx.uuid,
            block_module: 'px-node-express',
            block_score: pxCtx.score,
            module_version: PxConfig.conf.MODULE_VERSION
        };

        const activityType = pxConfig.MODULE_MODE === pxConfig.MONITOR_MODE.BLOCK ? "block" : "simulated_block";
        pxLogger.debug(`Sending ${activityType} activity`);
        this.pxClient.sendToPerimeterX(activityType, details, pxCtx);
    }

    /**
     * generateTemplate - genarating HTML string from pxContext and pxConfig in case
     * action was to block the request
     *
     * @param {Object} pxContext - current request context.
     * @param {Object} pxConfig - current Px configs
     * @param {Function} cb - send the generated html value.
     */
    generateTemplate(pxContext, pxConfig, cb) {
        let template;
        switch (pxContext.blockAction) {
            case 'j':
                template = 'challenge';
                break;
            case 'b':
                template = 'block';
                break;
            case 'r':
                template = 'ratelimimt';
                break;
            default:
                template = pxConfig.CAPTCHA_PROVIDER.toLowerCase();
        }

        if (template === 'challenge') {
            return cb(pxContext.blockActionData);
        }

        if (template === 'ratelimit') {
            return this.compileMustache('ratelimit', {}, cb);
        }

        if (pxContext.isMobile()) {
            template = `${template}.mobile`;
        }

        const props = this.getProps(pxContext, pxConfig, template);
        return this.compileMustache('block_template', props, cb);
    }

    getProps(pxContext, pxConfig, template) {
        let jsClientSrc = `//${pxConfig.CLIENT_HOST}/${pxConfig.PX_APP_ID}/main.min.js`;
        let captchaSrc = `//${pxConfig.CAPTCHA_HOST}/${template}.js`;
        let hostUrl = pxContext.collectorUrl;

        if (pxConfig.FIRST_PARTY_ENABLED && !pxContext.isMobile()) {
            const prefix = pxConfig.PX_APP_ID.substring(2).toLowerCase();
            jsClientSrc = `/${prefix}${pxConfig.FIRST_PARTY_VENDOR_PATH}`;
            captchaSrc = `/${prefix}${pxConfig.FIRST_PARTY_CAPTCHA_PATH}/${template}.js`;
            hostUrl = `/${prefix}${pxConfig.FIRST_PARTY_XHR_PATH}`;
        }

        return {
            refId: pxContext.uuid,
            appId: pxConfig.PX_APP_ID,
            vid: pxContext.vid,
            uuid: pxContext.uuid,
            customLogo: pxConfig.CUSTOM_LOGO,
            cssRef: pxConfig.CSS_REF,
            jsRef: pxConfig.JS_REF,
            logoVisibility: pxConfig.CUSTOM_LOGO ? 'visible' : 'hidden',
            hostUrl: hostUrl,
            jsClientSrc: jsClientSrc,
            firstPartyEnabled: pxConfig.FIRST_PARTY_ENABLED,
            captchaType: pxConfig.CAPTCHA_PROVIDER,
            blockScript: captchaSrc
        }
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