'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');
const pxhttpc = require('../lib/pxhttpc');
const pxapi = rewire('../lib/pxapi');
const originalTokenValidator = require('../lib/pxoriginaltoken');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const { ModuleMode } = require('../lib/enums/ModuleMode');

describe('PX API - pxapi.js', () => {
    let params;
    let config;
    let pxConfig;
    let logger;
    let stub;

    beforeEach(() => {
        params = {
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'kabum',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_send_async_activities_enabled: true,
            px_blocking_score: 60,
            px_logger_severity: true,
            px_ip_headers: ['x-px-true-ip'],
            px_max_activity_batch_size: 1,
            px_module_enabled: true,
            px_module_mode: ModuleMode.ACTIVE_BLOCKING,
        };

        logger = new PxLogger(params);
        pxConfig = new PxConfig(params, logger);
        config = pxConfig.conf;
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback(data);
        });
    });

    afterEach(() => {
        stub.restore();
    });

    it('should add px_orig_cookie to risk_api when decryption fails', (done) => {
        //Stubbing the pxhttpc callServer functions

        //Using rewire to get callServer function
        const pxApiCallServerFunc = pxapi.__get__('callServer');

        // Prepare ctx
        const ctx = {
            ip: '1.2.3.4',
            fullUrl: 'stub',
            vid: 'stub',
            uuid: 'stub',
            uri: 'stub',
            headers: 'stub',
            httpVersion: 'stub',
            s2sCallReason: 'cookie_decryption_failed',
            httpMethod: 'stub',
            getCookie: () => {
                return 'abc';
            }
        };

        pxApiCallServerFunc(ctx, config, data => {
            data.additional.px_orig_cookie.should.equal('abc');
            done();
        });
    });

    it('token v3 - should add originalUuid, vid and decodedOriginalToken to ctx when original token decryption succeeds', (done) => {
        const ctx = {
            cookies: {
                _px3: 'aaaa'
            },
            originalToken: '68a1bf96ab3af2e0683a377d332b125dda3e195ee56cf3ce4d61b99cd0860dc6:xTMRZvJnzxM=:1000:0pjajaPCjssb2HjG2436zyFXIvIEbE87nFBrHEQPDRT7fqiQ5RA05+njsLUVpOtdJjLvWNNAlSG70DW2wqWM5VmF9UR420/wxPkx6Ebyz/L9q7Mxk5fcdF8p+dGcMc3uD7Qh8y3WiPSN389cXhfKfMttUABQYvRpOxo7rMC+ngpHEVYg+lfBZCliHB1PZKLy'
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        ctx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        JSON.stringify(ctx.decodedOriginalToken).should.equal('{"a":"c","s":0,"u":"09ade30a-f08b-11e7-8c3f-9a214cf093ae","t":1830515445000,"v":"0290edec-f08b-11e7-8c3f-9a214cf093ae"}');
        done();
    });
    it('token v3 - should set originalTokenError to decryption_failed on original token decryption fail', (done) => {
        const ctx = {
            cookies: {
                _px3: 'aaaa'
            },
            originalToken: 'aaaaa:bbbbb:cccc:ddddd'
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalTokenError.should.equal('decryption_failed');
        done();
    });
    it('token v3 - should set originalTokenError to validation_failed on original token validation fail', (done) => {
        const ctx = {
            cookies: {
                _px3: 'aaaa'
            },
            originalToken: '68a1bf96ab3af2e0683a377d332b125dda3e195ee56cf3ce4d61b99cd0860dc:xTMRZvJnzxM=:1000:0pjajaPCjssb2HjG2436zyFXIvIEbE87nFBrHEQPDRT7fqiQ5RA05+njsLUVpOtdJjLvWNNAlSG70DW2wqWM5VmF9UR420/wxPkx6Ebyz/L9q7Mxk5fcdF8p+dGcMc3uD7Qh8y3WiPSN389cXhfKfMttUABQYvRpOxo7rMC+ngpHEVYg+lfBZCliHB1PZKLy'
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        ctx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        ctx.originalTokenError.should.equal('validation_failed');
        done();
    });
    it('token v1 - should add originalUuid, vid and decodedOriginalToken to ctx when original token decryption succeeds', (done) => {
        const ctx = {
            cookies: {
                _px: 'aaaa'
            },
            originalToken: 'Gy9z3mQPYNE=:1000:I7A44BXmO5IlgqhXLM5Mmuq4/jESNgse51Zj/l4bpkAaymDQzcrUMHBofVQ8Q9IYfon3bVQn7gHA124xunjlSlPMlj133wuFBzt7r/yJKpcTEex5WBxynCQAXXx8tymeO1gWXLmPchrV93ysxPl/AeV2/ofVN3YzUR/0PQbXB2fzxkPc5bMPdxLMJCrgLtR4msoMGvg9qaiufMFDWWzah1kvUq1Kvrlk3UQm0y6UU1j6GoLHkTSnDBTg3GexETotOoUkM5FYMPZm8TxK0as+mg=='
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        ctx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        JSON.stringify(ctx.decodedOriginalToken).should.equal('{"h":"aa2341380b7c67ee0ed5c2f7d4facf03847d7dcb4540aab021654361d3dcade4","s":{"a":0,"b":0},"u":"09ade30a-f08b-11e7-8c3f-9a214cf093ae","t":1830515445000,"v":"0290edec-f08b-11e7-8c3f-9a214cf093ae"}');
        done();
    });
    it('token v1 - should set originalTokenError to decryption_failed on original token decryption fail', (done) => {
        const ctx = {
            cookies: {
                _px: 'aaaa'
            },
            originalToken: 'aaaaa:bbbbb:cccc:ddddd'
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalTokenError.should.equal('decryption_failed');
        done();
    });
    it('should fail with exception and set originalTokenError to decryption_failed', (done) => {
        const ctx = {
            cookies: {
                _px: 'aaaaa'
            },
            originalToken: ''
        };

        originalTokenValidator.evalCookie(ctx, config);
        ctx.originalTokenError.should.equal('decryption_failed');
        done();
    });
});