'use strict';
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');

exports.verifyCaptcha = verifyCaptcha;

/**
 * verifyCaptcha - Verify function, evaluate ca.
 *
 * @param {Object} pxCtx - captcha value.
 * @param {string} pxCaptcha - captcha value.
 * @param {Function} callback - callback function.
 */
function verifyCaptcha(pxCtx, pxCaptcha, callback) {
    const pxConfig = require('./pxconfig').conf;
    if (!pxCaptcha || typeof pxCaptcha !== 'string') {
        return callback('perimeterx captcha is missing');
    }
    const data = {
        request: {
            ip: pxCtx.ip,
            headers: pxUtil.formatHeaders(pxCtx.headers),
            uri: pxCtx.uri,
            captchaType: pxConfig.CAPTCHA_PROVIDER
        },
        additional: {
            module_version: pxConfig.MODULE_VERSION
        },
        pxCaptcha: pxCaptcha,
        hostname: pxCtx.hostname
    };

    const headers = {
        Authorization: 'Bearer ' + pxConfig.AUTH_TOKEN,
        'Content-Type': 'application/json'
    };

    const startRiskRtt = Date.now();
    pxHttpc.callServer(data, headers, pxConfig.SERVER_CAPTCHA_URI, 'query', (err, res) => {
        pxCtx.riskRtt = Date.now() - startRiskRtt;
        if (err) {
            return callback(err, res);
        }
        return callback(null, res);
    });
}


