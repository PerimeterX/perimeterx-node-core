'use strict';

const PxClient = require('./pxclient');
const pxLogger = require('./pxlogger');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const mu = require('mu2');

class PxEnforcer {
    constructor(params, client) {
        PxConfig.init(params);
        if (client) {
            this.pxClient = client;
        } else {
            this.pxClient = new PxClient();
        }
        this.pxClient.init();
    }

    enforce(req, res, cb) {
        const pxConfig = PxConfig.conf;
        const pxUtil = require('./pxutil');
        const pxCaptcha = require('./pxcaptcha');

        if (!pxConfig.ENABLE_MODULE || pxUtil.checkForStatic(req, pxConfig.STATIC_FILES_EXT)) {
            return cb();
        }

        try {
            const pxCtx = new PxContext(pxConfig, req);
            pxCtx.collectorUrl = `https://collector-${pxConfig.PX_APP_ID.toLowerCase()}.perimeterx.net`;
            if (req.cookies && req.cookies['_pxCaptcha']) { // handle captcha validation
                const captchaCookie = req.cookies['_pxCaptcha'];
                res.cookie('_pxCaptcha', '-', {maxAge: 0}); // remove pxCaptcha cookie to prevert reuse
                pxCaptcha.verifyCaptcha(pxCtx, captchaCookie, (err, result) => {
                    if (err) {
                        if (err === "timeout") {
                            pxLogger.debug('sending page requested activity for captcha timeout');
                            pxCtx.passReason = pxConfig.PASS_REASON.CAPTCHA_TIMEOUT;
                            this.pxPass(pxCtx);
                        } else {
                            pxLogger.error('error while evaluation perimeterx captcha');
                            pxCtx.blockReason = 'captcha_verification_failed';
                            this.pxBlock(pxCtx);
                        }
                    } else {
                        if (!result || result.status === -1) {
                            pxLogger.debug('perimeterx captcha verification faild');
                            pxCtx.blockReason = 'captcha_verification_failed';
                            this.pxBlock(pxCtx);
                        } else {
                            pxLogger.debug('sending page requested activity from captcha');
                            pxCtx.passReason = pxConfig.PASS_REASON.CAPTCHA;
                            this.pxPass(pxCtx);
                        }
                    }
                    return this.handleVerification(pxCtx, pxConfig, cb);
                });
            } else { // handle cookie validation
                pxUtil.verifyUserScore(pxCtx, (action) => {
                    pxLogger.debug('score action ' + action);
                    // check for additional activity handler
                    if (pxConfig.ADDITIONAL_ACTIVITY_HANDLER) {
                        pxConfig.ADDITIONAL_ACTIVITY_HANDLER(pxCtx, pxConfig);
                    }

                    if (res && pxConfig.CUSTOM_REQUEST_HANDLER){
                        pxConfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxConfig, req, res);
                        if (res.headersSent) {
                            return;
                        }
                    }
                    this.handleVerification(pxCtx, pxConfig, cb)
                });
            }
        } catch (err) {
            return cb();
        }
    }

    handleVerification(pxCtx, pxConfig, cb) {
        if (pxCtx.score < pxConfig.BLOCKING_SCORE || pxConfig.MODULE_MODE === pxConfig.MONITOR_MODE.MONITOR) {
            this.pxPass(pxCtx);
            return cb();
        } else {
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
            logoVisibility: pxConfig.CUSTOM_LOGO ? 'visible' : 'hidden'
        }
    }
}



module.exports = PxEnforcer;