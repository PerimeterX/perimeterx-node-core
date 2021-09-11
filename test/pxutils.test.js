'use strict';

const should = require('should');
const rewire = require('rewire');
const pxutil = require('../lib/pxutil');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const { LoggerSeverity } = require('../lib/enums/LoggerSeverity');

describe('PX Utils - pxutils.js', () => {
    let pxConfig;
    let params;

    beforeEach(() => {
        params = {
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'PX_COOKIE_SECRET',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_send_async_activities: true,
            px_blocking_score: 60,
            px_logger_severity: LoggerSeverity.DEBUG,
            px_ip_headers: ['x-px-true-ip'],
            px_max_activity_batch_size: 1,
            px_enrich_custom_parameters: enrichCustomParameters
        };

        const logger = new PxLogger(params.px_app_id, params.px_logger_severity);
        pxConfig = new PxConfig(params, logger);
    });

    it('should generate headers array from headers object', (done) => {
        const formattedHeaders = pxutil.formatHeaders({K: 'v'}, pxConfig.Config.px_sensitive_headers);
        (Object.prototype.toString.call(formattedHeaders)).should.be.exactly('[object Array]');
        formattedHeaders[0]['name'].should.be.exactly('K');
        formattedHeaders[0]['value'].should.be.exactly('v');
        return done();
    });

    it('should receive custom params function and custom params object and add only 2 of them', (done) => {
        const dict = {};
        pxutil.prepareCustomParams(pxConfig.Config, dict, {uri: '/index.html'});
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
