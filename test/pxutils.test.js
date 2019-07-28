'use strict';

const should = require('should');
const rewire = require('rewire');
const pxutil = require('../lib/pxutil');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');

describe('PX Utils - pxutils.js', () => {
    let pxConfig;
    let params;

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
            enrichCustomParameters: enrichCustomParameters
        };

        const logger = new PxLogger();
        pxConfig = new PxConfig(params, logger);
    });

    it('should generate headers array from headers object', (done) => {
        const formattedHeaders = pxutil.formatHeaders({K: 'v'}, pxConfig.conf.SENSITIVE_HEADERS);
        (Object.prototype.toString.call(formattedHeaders)).should.be.exactly('[object Array]');
        formattedHeaders[0]['name'].should.be.exactly('K');
        formattedHeaders[0]['value'].should.be.exactly('v');
        return done();
    });

    it('should receive custom params function and custom params object and add only 2 of them', (done) => {
        const dict = {};
        pxutil.prepareCustomParams(pxConfig.conf, dict, {uri: '/index.html'});
        dict['custom_param1'].should.be.exactly('1');
        dict['custom_param2'].should.be.exactly('2');
        dict['custom_param10'].should.be.exactly('10');
        should.not.exist(dict['custom_param11']);
        return done();
    });

});

function enrichCustomParameters(params, origReq) {
    params['custom_param1'] = '1';
    params['custom_param2'] = '2';
    params['custom_param10'] = '10';
    params['custom_param11'] = '11';
    params['custom'] = '6';
    if ('/index.html' === origReq.uri) {
        params['custom_param5'] = 'index';
    }
    return params;
}
