'use strict';

const should = require('should');
const rewire = require('rewire');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const fs = require('fs');

describe('PX Configurations - pxconfig.js', () => {
    let params;
    const logger = new PxLogger();

    beforeEach(() => {
        params = {
            pxAppId: 'PX_APP_ID',
            cookieSecretKey: 'PX_COOKIE_SECRET',
            authToken: 'PX_AUTH_TOKEN',
            sendPageActivities: true,
            blockingScore: 60,
            debugMode: true,
            ipHeader: 'x-px-true-ip',
            maxBufferLength: 1,
            customRequestHandler: null,
            moduleMode: 1,
        };

    });

    it('should set baseUrl to sapi-<appid>.perimeterx.net', (done) => {
        params.pxAppId = 'PXJWbMQarF';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.BACKEND_URL.should.be.exactly(`https://sapi-${params.pxAppId.toLowerCase()}.perimeterx.net`);
        done();
    });

    it('blocking score should be 80', (done) => {
        params.blockingScore = 80;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.BLOCKING_SCORE.should.be.exactly(80);
        done();
    });

    it('getUserIp function should be overridden', (done) => {
        params.getUserIp = function () {
            return '1.2.3.4';
        };

        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.GET_USER_IP().should.be.exactly('1.2.3.4');
        done();
    });

    it('requestHandler function should be overridden', (done) => {
        params.customRequestHandler = function () {
            return 'Blocked';
        };

        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CUSTOM_REQUEST_HANDLER().should.be.exactly('Blocked');
        done();
    });

    it('should set enableModule to false', () => {
        params.enableModule = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.ENABLE_MODULE.should.be.exactly(false);
    });

    it('should set sendPageActivities to false', () => {
        params.sendPageActivities = false;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.SEND_PAGE_ACTIVITIES.should.be.exactly(false);
    });

    it('should set debugMode to true', () => {
        params.sendPageActivities = true;
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.DEBUG_MODE.should.be.exactly(true);
    });

    it('customLogo should be overridden', () => {
        params.customLogo = 'http://www.google.com/logo.jpg';
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CUSTOM_LOGO.should.be.exactly('http://www.google.com/logo.jpg');
    });

    it('jsRef should be overridden', () => {
        params.jsRef = ['http://www.google.com/script.js'];
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.JS_REF.should.equal('http://www.google.com/script.js');
    });

    it('cssRef should be overridden', () => {
        params.cssRef = ['http://www.google.com/stylesheet.css'];
        const pxConfig = new PxConfig(params, logger);
        const conf = pxConfig.conf;
        conf.CSS_REF.should.equal('http://www.google.com/stylesheet.css');
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