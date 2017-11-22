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
            if (req.cookies && req.cookies['_pxCaptcha']) { // handle captcha validation

            } else { // handle cookie validation

            }

        } catch (err) {

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