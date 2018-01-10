'use strict';

const PxClient = require('./pxclient');
const pxLogger = require('./pxlogger');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const mu = require('mu2');
const pxProxy = require('./pxproxy');

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
        const pxUtil = require('./pxutil');
        const pxCaptcha = require('./pxcaptcha');
        const lowerRequestUrl = req.originalUrl.toLowerCase();
        pxLogger.debug("Starting request verification");

        if (lowerRequestUrl.includes(`/${this.reversePrefix}${pxConfig.FIRST_PARTY_VENDOR_PATH}`)) {
            // reverse proxy client
            return pxProxy.getClient(req, pxConfig, PxContext.extractIP(pxConfig, req), cb);
        }

        if (lowerRequestUrl.includes(`/${this.reversePrefix}${pxConfig.FIRST_PARTY_XHR_PATH}`)) {
            //reverse proxy xhr
        }

        if (!pxConfig.ENABLE_MODULE || pxUtil.checkForStatic(req, pxConfig.STATIC_FILES_EXT)) {
            pxLogger.debug("Request will not be verified, module is disabled");
            return cb();
        }

        try {
            const pxCtx = new PxContext(pxConfig, req);
            pxLogger.debug("Request context created successfully");
            pxCtx.collectorUrl = `https://collector-${pxConfig.PX_APP_ID.toLowerCase()}.perimeterx.net`;
            if (req.cookies && req.cookies['_pxCaptcha']) { // handle captcha validation
                pxLogger.debug('Captcha cookie found, evaluating');
                const captchaCookie = req.cookies['_pxCaptcha'];
                if (res && res.clearCookie) {
                    res.clearCookie('_pxCaptcha', {});
                }
                pxCaptcha.verifyCaptcha(pxCtx, captchaCookie, (err, result) => {
                    if (err) {
                        if (err === "timeout") {
                            pxLogger.debug('Captcha response timeout - passing request');
                            pxCtx.passReason = pxConfig.PASS_REASON.CAPTCHA_TIMEOUT;
                            this.pxPass(pxCtx);
                        } else {
                            pxLogger.error(`Unexpected exception while evaluating Captcha cookie: ${err.message}`);
                            pxCtx.blockReason = 'captcha_verification_failed';
                            this.pxBlock(pxCtx);
                        }
                    } else {
                        if (!result || result.status === -1) {
                            pxLogger.debug('Captcha API response validation status: failed');
                            pxCtx.blockReason = 'captcha_verification_failed';
                            pxUtil.verifyUserScore(pxCtx, (action) => { // if capcha failed, check for cookie
                                return this.handleVerification(pxCtx, pxConfig, req, res, cb)
                            });
                        } else {
                            pxLogger.debug('Captcha API response validation status: passed');
                            pxCtx.passReason = pxConfig.PASS_REASON.CAPTCHA;
                            this.pxPass(pxCtx);
                            return this.handleVerification(pxCtx, pxConfig, req, res, cb);
                        }
                    }
                });
            } else { // handle cookie validation
                pxLogger.debug('No Captcha cookie present on the request');
                pxUtil.verifyUserScore(pxCtx, (action) => {
                    this.handleVerification(pxCtx, pxConfig, req, res, cb)
                });
            }
        } catch (err) {
            return cb();
        }
    }

    handleVerification(pxCtx, pxConfig, req, res, cb) {
        // check for additional activity handler
        if (pxConfig.ADDITIONAL_ACTIVITY_HANDLER) {
            pxConfig.ADDITIONAL_ACTIVITY_HANDLER(pxCtx, pxConfig);
        }

        if (pxConfig.CUSTOM_REQUEST_HANDLER){
            if (res) {
                pxConfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxConfig, req, res);
                if (res.headersSent) {
                    return;
                }
            } else {
                pxConfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxConfig, req, (result) => {
                    if (result) {
                        return cb(result);
                    }
                });
            }
        }
        if (pxCtx.score < pxConfig.BLOCKING_SCORE || pxConfig.MODULE_MODE === pxConfig.MONITOR_MODE.MONITOR) {
            this.pxPass(pxCtx);
            return cb();
        } else {
            pxLogger.debug(`Enforcing action: ${pxCtx.fullBlockAction} page is served`);
            this.pxBlock(pxCtx);
            this.generateTemplate(pxCtx, pxConfig, function(htmlTemplate) {
                const response = {};
                response.status = '403';
                response.statusDescription = "Forbidden";

                if (pxCtx.cookieOrigin == "cookie") {
                    response.header = {key: 'Content-Type', value:'text/html'};
                    response.body = htmlTemplate;
                } else {
                    response.header = {key: 'Content-Type', value:'application/json'};
                    response.body = {
                        action: pxCtx.blockAction,
                        uuid: pxCtx.uuid,
                        vid: pxCtx.vid,
                        appId: pxConfig.PX_APP_ID,
                        page: new Buffer(htmlTemplate).toString('base64'),
                        collectorUrl: pxCtx.collectorUrl
                    }
                }
                cb(response);
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
        pxLogger.debug('sending page requested activity');
        this.pxClient.sendToPerimeterX('page_requested', details, pxCtx);
    }

    /**
     * pxBlock - block handler, send blocking activity to px and render the block html back to screen
     *
     * @param {Object} pxCtx - current request context.
     */
    pxBlock(pxCtx) {
        let details = {
            block_reason: pxCtx.blockReason,
            client_uuid: pxCtx.uuid,
            block_module: 'px-node-express',
            block_score: pxCtx.score,
            module_version: PxConfig.conf.MODULE_VERSION
        };
        pxLogger.debug('sending block activity');
        this.pxClient.sendToPerimeterX('block', details, pxCtx);
    }

    /**
     * generateTemplate - genarating HTML string from pxContext and pxConfig in case
     * action was to block the request
     *
     * @param {Object} pxContext - current request context.
     * @param {Object} pxConfig - current Px configs
     * @param {Function} cb - send the generated html value.
     */
    generateTemplate(pxContext, pxConfig, cb){
        let template;
        if (pxContext.blockAction === 'j') {
            template = 'challenge';
        } else if (pxContext.blockAction === 'b') {
            template = 'block';
        } else {
            template = pxConfig.CAPTCHA_PROVIDER.toLowerCase();
        }

        if (pxContext.cookieOrigin == 'header') {
            template = `${template}.mobile`;
        }

        if (template === 'challenge') {
            return cb(pxContext.blockActionData);
        }

        const templatesPath = `${__dirname}/templates`;
        let htmlTemplate = '';

        // Mustache preparations
        mu.root = templatesPath;
        const props = this.getProps(pxContext, pxConfig);
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

    getProps(pxContext, pxConfig){
        return {
            refId: pxContext.uuid,
            appId: pxConfig.PX_APP_ID,
            vid: pxContext.vid,
            uuid: pxContext.uuid,
            customLogo: pxConfig.CUSTOM_LOGO,
            cssRef: pxConfig.CSS_REF,
            jsRef: pxConfig.JS_REF,
            logoVisibility: pxConfig.CUSTOM_LOGO ? 'visible' : 'hidden',
            hostUrl: pxContext.collectorUrl
        }
    }
}



module.exports = PxEnforcer;