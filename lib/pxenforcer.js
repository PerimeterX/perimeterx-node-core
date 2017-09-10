'use strict';

const pxClient = require('./pxclient');
const pxLogger = require('./pxlogger');
const PxContext = require('./pxcontext');
const PxConfig = require('./pxconfig');
const mu = require('mu2');

class PxEnforcer {
    constructor(params) {
        PxConfig.init(params);
    }

    enforce(req, res, cb) {
        const pxconfig = PxConfig.conf;
        const pxutil = require('./pxutil');
        const pxCaptcha = require('./pxcaptcha');

        if (!pxconfig.ENABLE_MODULE || pxutil.checkForStatic(req, pxconfig.STATIC_FILES_EXT)) {
            return cb();
        }
        try {
            const pxCtx = new PxContext(pxconfig, req);
            if (req.cookies && req.cookies['_pxCaptcha']) {
                const pxcptch = req.cookies['_pxCaptcha'];
                if (res && res.clearCookie) {
                    res.clearCookie('_pxCaptcha', {});
                }
                pxCaptcha.verifyCaptcha(pxCtx, pxcptch, (err, result) => {
                    if (err) {
                        if (err === "timeout") {
                            pxLogger.debug('sending page requested activity for captcha timeout');
                            pxCtx.passReason = pxconfig.PASS_REASON.CAPTCHA_TIMEOUT;
                            return pxPass(pxCtx);
                        } else {
                            pxLogger.error('error while evaluation perimeterx captcha');
                            pxCtx.blockReason = 'captcha_verification_failed';
                            return pxBlock(pxCtx);
                        }
                    }

                    if (!result || result.status === -1) {
                        pxLogger.debug('perimeterx captcha verification faild');
                        pxCtx.blockReason = 'captcha_verification_failed';
                        return pxBlock(pxCtx);
                    }

                    pxLogger.debug('sending page requested activity from captcha');
                    pxCtx.passReason = pxconfig.PASS_REASON.CAPTCHA;
                    pxPass(pxCtx);
                    return cb();

                });
            } else {
                pxutil.verifyUserScore(pxCtx, (action) => {
                    pxLogger.debug('score action ' + action);

                    // check for additional activity handler
                    if (pxconfig.ADDITIONAL_ACTIVITY_HANDLER) {
                        pxconfig.ADDITIONAL_ACTIVITY_HANDLER(pxCtx, pxconfig);
                    }

                    if (res && pxconfig.CUSTOM_REQUEST_HANDLER){
                        pxconfig.CUSTOM_REQUEST_HANDLER(pxCtx, pxconfig, req, res);
                        if (res.headersSent) {
                            return;
                        }
                    }
                    if (pxCtx.score < pxconfig.BLOCKING_SCORE || pxconfig.MODULE_MODE === pxconfig.MONITOR_MODE.MONITOR) {
                        pxPass(pxCtx);
                        return cb();
                    } else {
                        pxBlock(pxCtx);

                        generateTemplate(pxCtx, pxconfig, function(htmlTemplate) {
                            const response = {};
                            response.status = '403';
                            response.statusDescription = "Forbidden";
                            response.body = htmlTemplate;
                            cb(response);
                        });
                    }
                });
            }
        } catch (e) {
            return cb();
        }
    }

    get config() {
        return PxConfig
    }
}

/**
 * pxPass - pass handler, sends page_requested activity and passes the request using next()
 * @param {Object} pxCtx - current request context.
 */
function pxPass(pxCtx) {
    let details = {
        'px_cookie': pxCtx.decodedCookie,
        'client_uuid': pxCtx.uuid,
        "pass_reason": pxCtx.passReason,
        'risk_rtt': pxCtx.riskRtt,
        'module_version': PxConfig.conf.MODULE_VERSION
    };
    pxLogger.debug('sending page requested activity');
    pxClient.sendToPerimeterX('page_requested', details, pxCtx);
}

/**
 * pxBlock - block handler, send blocking activity to px and render the block html back to screen
 *
 * @param {Object} pxCtx - current request context.
 */
function pxBlock(pxCtx) {
    pxLogger.debug('sending block activity');
    pxClient.sendToPerimeterX('block', {
            block_reason: pxCtx.blockReason,
            client_uuid: pxCtx.uuid,
            block_module: 'px-node-express',
            block_score: pxCtx.score
        },
        pxCtx
    );
}

/**
 * generateTemplate - genarating HTML string from pxContext and pxConfig in case
 * action was to block the request
 *
 * @param {Object} pxContext - current request context.
 * @param {Object} pxConfig - current Px configs
 * @param {Function} cb - send the generated html value.
 */
function generateTemplate(pxContext, pxConfig, cb){
    let template;
    if (pxContext.blockAction === 'j') {
        template = 'challenge';
    } else if (pxContext === 'b') {
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
    const props = getProps(pxContext, pxConfig);
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

function getProps(pxContext, pxConfig){
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

module.exports = PxEnforcer;