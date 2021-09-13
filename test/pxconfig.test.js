'use strict';

const should = require('should');
const rewire = require('rewire');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const fs = require('fs');

describe('PX Configurations - pxconfig.js', () => {
    let params, logger;

    beforeEach(() => {
        params = {
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'PX_COOKIE_SECRET',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_send_async_activities_enabled: true,
            px_blocking_score: 60,
            px_logger_severity: true,
            px_ip_headers: ['x-px-true-ip'],
            px_max_activity_batch_size: 1,
            px_custom_request_handler: null,
            px_module_mode: 1,
        };
        logger = new PxLogger(params);
    });

    it('should set baseUrl to sapi-<appid>.perimeterx.net', (done) => {
        params.px_app_id = 'PXJWbMQarF';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.BACKEND_URL.should.be.exactly(`https://sapi-${params.px_app_id.toLowerCase()}.perimeterx.net`);
        done();
    });

    it('blocking score should be 80', (done) => {
        params.px_blocking_score = 80;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.BLOCKING_SCORE.should.be.exactly(80);
        done();
    });

    it('px_extract_user_ip function should be overridden', (done) => {
        params.px_extract_user_ip = function () {
            return '1.2.3.4';
        };

        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.GET_USER_IP().should.be.exactly('1.2.3.4');
        done();
    });

    it('requestHandler function should be overridden', (done) => {
        params.px_custom_request_handler = function () {
            return 'Blocked';
        };

        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CUSTOM_REQUEST_HANDLER().should.be.exactly('Blocked');
        done();
    });

    it('should set px_module_enabled to false', () => {
        params.px_module_enabled = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.ENABLE_MODULE.should.be.exactly(false);
    });

    it('should set px_send_async_activities to false', () => {
        params.px_send_async_activities_enabled = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.SEND_PAGE_ACTIVITIES.should.be.exactly(false);
    });

    it('should set px_logger_severity to true', () => {
        params.px_logger_severity = true;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.DEBUG_MODE.should.be.exactly(true);
    });

    it('px_custom_logo should be overridden', () => {
        params.px_custom_logo = 'http://www.google.com/logo.jpg';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CUSTOM_LOGO.should.be.exactly('http://www.google.com/logo.jpg');
    });

    it('px_js_ref should be overridden', () => {
        params.px_js_ref = ['http://www.google.com/script.js'];
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.JS_REF.should.equal('http://www.google.com/script.js');
    });

    it('px_css_ref should be overridden', () => {
        params.px_css_ref = ['http://www.google.com/stylesheet.css'];
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CSS_REF.should.equal('http://www.google.com/stylesheet.css');
    });

    it('should use custom logger', () => {
        params.customLogger = {
            info() {},
            error() {}
        }
        const pxLogger = new PxLogger(params);
        const pxConfig = new PxConfig(params, pxLogger);
        const conf = pxConfig.conf;
        conf.logger.internalLogger.should.be.exactly(params.customLogger);
    });

    it('Load Existing Config file', () => {
        params.configFilePath = './test/files/config-1.json';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.MODULE_MODE.should.equal(0);
    });

    it('Load Non-Existing Config file', () => {
        params.configFilePath = './test/files/config-notexist.json';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.MODULE_MODE.should.equal(1);
    });
});