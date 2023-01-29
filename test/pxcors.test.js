'use strict';

const should = require('should');
const sinon = require('sinon');

const pxhttpc = require('../lib/pxhttpc');
const proxyquire = require('proxyquire');
const rewire = require('rewire');
const { ModuleMode } = require('../lib/enums/ModuleMode');
const PxEnforcer = require('../lib/pxenforcer');
const PxClient = rewire('../lib/pxclient');

describe('PX Cors - pxCors.js', () => {
    let params, enforcer, req, stub, pxClient, pxLoggerSpy, logger, reqStub;

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
            px_cors_support_enabled: true,
        };

        req = {};
        req.headers = { 'origin': 'test' };
        req.cookies = {};
        req.method = 'OPTIONS';
        req.originalUrl = '/';
        req.path = req.originalUrl.substring(req.originalUrl.lastIndexOf('/'));
        req.protocol = 'http';
        req.ip = '1.2.3.4';
        req.hostname = 'example.com';
        req.get = (key) => {
            return req.headers[key] || '';
        };

        pxLoggerSpy = {
            debug: sinon.spy(),
            error: sinon.spy(),
            init: () => {},
            '@global': true,
        };

        logger = function () {
            return pxLoggerSpy;
        };

        pxClient = new PxClient();
    });

    afterEach(() => {
        stub.restore();
    });

    it('Pass preflight request due to px_cors_preflight_request_filter_enabled', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_cors_preflight_request_filter_enabled: true
            },
            params
        );

        req.headers = Object.assign(req.headers, { 'access-control-request-method': 'get' });

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification due to preflight request').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('handle preflight request with custom handler', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        params.px_cors_custom_preflight_handler = function (req) {
            const response = {
                status: '404',
                statusDescription: 'Test',
            };

            response.headers = {
                'Access-Control-Allow-Origin': req.headers['origin'],
                'Access-Control-Allow-Methods': req.method,
                'Access-Control-Allow-Headers': req.headers['access-control-request-headers'],
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            };

            return response;
        };

        const curParams = Object.assign(
            {
                px_cors_preflight_request_filter_enabled: true
            },
            params
        );

        req.headers = Object.assign(req.headers, { 'access-control-request-method': 'get' });

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification due to preflight request').should.equal(true);
            (response !== undefined).should.equal(true);
            done();
        });
    });

    it('add default proper cors headers to block response', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });

        req.method = 'POST';

        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.headers['Content-Type'], 'text/html');
            should.equal(response.headers['Access-Control-Allow-Credentials'], 'true');
            should.equal(response.headers['Access-Control-Allow-Origin'], 'test');
            reqStub.restore();
            done();
        });
    });

    it('add custom cors headers to block response', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        params.px_cors_create_custom_block_response_headers = function (req) {
            return {
                'Access-Control-Allow-Origin': 'test_custom',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'test_custom'
            };
        };

        reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });

        req.method = 'POST';

        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.headers['Content-Type'], 'text/html');
            should.equal(response.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization');
            should.equal(response.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
            should.equal(response.headers['Access-Control-Allow-Credentials'], 'test_custom');
            should.equal(response.headers['Access-Control-Allow-Origin'], 'test_custom');
            reqStub.restore();
            done();
        });
    });

    it('do not add cors block response if request is not cors request', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });

        req.headers = {};
        req.method = 'POST';

        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.headers['Content-Type'], 'text/html');
            (response.headers['Access-Control-Allow-Credentials'] === undefined).should.equal(true);
            (response.headers['Access-Control-Allow-Origin'] === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
});