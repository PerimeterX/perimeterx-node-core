'use strict';

const fs = require('fs');
const should = require('should');
const rewire = require('rewire');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const { LoggerSeverity } = require('../lib/enums/LoggerSeverity');
const { ModuleMode } = require('../lib/enums/ModuleMode');

describe('PX Configurations - pxconfig.js', () => {
    let params, logger;

    beforeEach(() => {
        params = {
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'PX_COOKIE_SECRET',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_blocking_score: 60,
            px_logger_severity: LoggerSeverity.FATAL,
            px_ip_headers: ['x-px-true-ip'],
            px_max_activity_batch_size: 1,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
        };
        logger = new PxLogger(params);
    });

    it('should set baseUrl to sapi-<appid>.perimeterx.net', () => {
        params.px_app_id = 'PXJWbMQarF';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_backend_url.should.be.exactly(`https://sapi-${params.px_app_id.toLowerCase()}.perimeterx.net`);
    });

    it('blocking score should be 80', () => {
        params.px_blocking_score = 80;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_blocking_score.should.be.exactly(80);
    });

    it('px_extract_user_ip function should be overridden', () => {
        params.px_extract_user_ip = () => '1.2.3.4';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_extract_user_ip().should.be.exactly('1.2.3.4');
    });

    it('px_custom_request_handler function should be overridden', () => {
        params.px_custom_request_handler = () => 'Blocked';

        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_custom_request_handler().should.be.exactly('Blocked');
    });

    it('should set px_module_enabled to false', () => {
        params.px_module_enabled = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_module_enabled.should.be.exactly(false);
    });

    it('should set px_send_page_activities to false', () => {
        params.px_send_page_activities = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_send_page_activities.should.be.exactly(false);
    });

    it('should set px_logger_severity to debug', () => {
        params.px_logger_severity = LoggerSeverity.DEBUG;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_logger_severity.should.be.exactly(LoggerSeverity.DEBUG);
    });

    it('px_custom_logo should be overridden', () => {
        params.px_custom_logo = 'http://www.google.com/logo.jpg';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_custom_logo.should.be.exactly('http://www.google.com/logo.jpg');
    });

    it('px_js_ref should be overridden', () => {
        params.px_js_ref = 'http://www.google.com/script.js';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_js_ref.should.equal('http://www.google.com/script.js');
    });

    it('px_css_ref should be overridden', () => {
        params.px_css_ref = 'http://www.google.com/stylesheet.css';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.px_css_ref.should.equal('http://www.google.com/stylesheet.css');
    });

    it('should use custom logger', () => {
        const customLogger = {
            info() {},
            error() {}
        }
        const pxLogger = new PxLogger(params.px_app_id, params.px_logger_severity, customLogger);
        const pxConfig = new PxConfig(params, pxLogger);
        const logger = pxConfig.Logger;
        logger.internalLogger.should.be.exactly(customLogger);
    });

    it('Load Existing Config file', () => {
        params.configFilePath = './test/files/config-1.json';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.MODULE_MODE.should.equal(0);
    });

    it('Load Non-Existing Config file', () => {
        params.configFilePath = './test/files/config-notexist.json';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.Config;
        conf.MODULE_MODE.should.equal(1);
    });
});