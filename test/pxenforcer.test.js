'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');
const request = require('../lib/request');
const pxhttpc = require('../lib/pxhttpc');
const PxClient = rewire('../lib/pxclient');
const PxEnforcer = require('../lib/pxenforcer');
const proxyquire = require('proxyquire');
const { ModuleMode } = require('../lib/enums/ModuleMode');
const { ActivityType } = require('../lib/enums/ActivityType');
const Response = require('./mocks/response');
const addNonce = require('../lib/nonce');
const { CSP_HEADER, CSPRO_HEADER, DEFAULT_ADDITIONAL_ACTIVITY_HEADER_NAME, DEFAULT_ADDITIONAL_ACTIVITY_URL_HEADER_NAME } = require('../lib/utils/constants');

describe('PX Enforcer - pxenforcer.js', () => {
    let params, enforcer, req, stub, pxClient, pxLoggerSpy, logger;

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
        };

        req = {};
        req.headers = {};
        req.cookies = {};
        req.method = 'GET';
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

    it('enforces a call in a disabled module', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        params.px_module_enabled = false;
        const curParams = Object.assign(
            {
                px_module_enabled: false,
            },
            params
        );

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Request will not be verified, module is disabled').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('enforces a call in an enabled module', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('uses first party to get client', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'get').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy', proxy: '' });
        });
        req.originalUrl = '/_APP_ID/init.js';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr post request', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr get request', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'get').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'GET';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party with pxvid cookie', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.cookies['_pxvid'] = 'abab-123';
        req.body = 'test';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('uses first party for xhr and passed trough bodyParser', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal('hello buddy');
            response.headers['x-px-johnny'].should.equal('1');
            reqStub.restore();
            done();
        });
    });

    it('should not use first party paths if originated from mobile', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_first_party_enabled: true,
            },
            params
        );
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, { headers: { 'x-px-johnny': '1' }, body: 'hello buddy' });
        });
        req.headers = { 'x-px-authorization': '3:some-fake-cookie' };
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.action.should.equal('block');
            reqStub.restore();
            done();
        });
    });
    it('should bypass monitor mode by header', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.MONITOR,
                px_bypass_monitor_header: 'x-px-block',
            },
            params
        );
        req.headers = {
            'x-px-block': '1',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            (response.body.indexOf('Press & Hold to confirm') > -1).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should ignore bypass monitor mode by header', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.MONITOR,
                px_bypass_monitor_header: 'x-px-block',
            },
            params
        );
        req.headers = {
            'x-px-block': '0',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should ignore bypass monitor header as its not present', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.MONITOR,
                px_bypass_monitor_header: 'x-px-block',
            },
            params
        );
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should ignore bypass monitor header as cookie is valid', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 0;
            data.action = 'b';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.MONITOR,
                px_bypass_monitor_header: 'x-px-block',
            },
            params
        );
        req.headers = {
            'x-px-block': '1',
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should not return json response when px_advanced_blocking_response_enabled is false', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_advanced_blocking_response_enabled: false,
            },
            params
        );
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        req.headers = { 'content-type': 'application/json' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.header.value, 'text/html');
            reqStub.restore();
            done();
        });
    });
    it('should return json response when px_advanced_blocking_response_enabled is true (default)', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
            },
            params
        );
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, { body: 'hello buddy' });
        });
        req.method = 'POST';
        req.body = { key: 'value', anotherKey: 'anotherValue' };
        req.headers = { 'content-type': 'application/json' };
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.header.value, 'application/json');
            reqStub.restore();
            done();
        });
    });

    it('should not monitor specific route when enforcer is disabled', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        params.px_monitored_routes = ['/profile'];
        params.px_module_enabled = false;
        req.originalUrl = '/profile';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should not monitor specific route regex when enforcer is disabled', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        params.px_monitored_routes = [new RegExp(/\/profile/)];
        params.px_module_enabled = false;
        req.originalUrl = '/profile';
        enforcer = new PxEnforcer(params, pxClient);
        enforcer.enforce(req, null, (response) => {
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should whitelist specific routes in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_filter_by_route: ['/profile'],
            },
            params
        );

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            pxLoggerSpy.debug.calledWith('Found whitelist route /profile').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should whitelist specific routes regex in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_filter_by_route: [/\/profile/],
            },
            params
        );

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            pxLoggerSpy.debug.calledWith('Found whitelist route by Regex /profile').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_monitored_routes: ['/profile'],
            },
            params
        );

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes regex in blocking mode', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_monitored_routes: [/\/profile/],
            },
            params
        );

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should enforce routes in blocking mode that are not specified in px_monitored_routes', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_monitored_routes: ['/profile'],
            },
            params
        );

        req.originalUrl = '/admin';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should enforce routes in blocking mode that are not specified in px_monitored_routes regex', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_monitored_routes: [/\/profile/],
            },
            params
        );

        req.originalUrl = '/admin';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should monitor specific routes with enforced specific routes not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: ['/profile', '/login'],
                px_monitored_routes: ['/'],
            },
            params
        );

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should monitor specific routes regex with enforced specific routes regex not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: [/\/profile/, /\/login/],
                px_monitored_routes: [new RegExp(/^\/$/)],
            },
            params
        );

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should enforce specific routes with enforced specific routes not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: ['/profile', '/login'],
                px_monitored_routes: ['/'],
            },
            params
        );

        req.originalUrl = '/login';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should enforce specific routes regex with enforced specific routes regex not in monitor', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: [/\/profile/, /\/login/],
                px_monitored_routes: [new RegExp(/^\/$/)],
            },
            params
        );

        req.originalUrl = '/login';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });

    it('should not enforce a route not specified in enforced specific routes', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: ['/profile', '/login'],
            },
            params
        );

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('should not enforce a route not specified in enforced specific routes regex', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_module_mode: ModuleMode.ACTIVE_BLOCKING,
                px_enforced_routes: [[/\/profile/, /\/login/]],
            },
            params
        );

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because user agent is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_filter_by_user_agent: ['testme/v1.0'],
            },
            params
        );

        req.headers = { 'user-agent': 'TestME/v1.0' };
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug
                .calledWith('Skipping verification for filtered user agent TestME/v1.0')
                .should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because user agent regex is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_filter_by_user_agent: [/test/i],
            },
            params
        );

        req.headers = { 'user-agent': 'TestME/v1.0' };
        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug
                .calledWith('Skipping verification for filtered user agent TestME/v1.0')
                .should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because ip is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_filter_by_ip: ['1.2.0.0/16'],
            },
            params
        );

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification for filtered ip address 1.2.3.4').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should skip verification because method is whitelisted', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign(
            {
                px_filter_by_http_method: ['get'],
            },
            params
        );

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (response) => {
            pxLoggerSpy.debug.calledWith('Skipping verification for filtered method GET').should.equal(true);
            (response === undefined).should.equal(true);
            done();
        });
    });

    it('Should add necessary headers to original request when px_additional_s2s_activity_header_enabled is true', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign({
            px_additional_s2s_activity_header_enabled: true,
            px_login_credentials_extraction_enabled: true,
            px_login_credentials_extraction: [{
                path: '/login',
                method: 'post',
                sent_through: 'body',
                user_field: 'username',
                pass_field: 'password'
            }]
        }, params);

        req.method = 'POST';
        req.originalUrl = '/login';
        req.path = req.originalUrl.substring(req.originalUrl.lastIndexOf('/'));
        req.body = { username: 'pxUser', password: '1234' };

        const pxenforcer = proxyquire('../lib/pxenforcer', { './pxlogger': logger });
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            const additionalActivity = JSON.parse(req.headers[DEFAULT_ADDITIONAL_ACTIVITY_HEADER_NAME]);
            const additionalActivityUrl = new URL(req.headers[DEFAULT_ADDITIONAL_ACTIVITY_URL_HEADER_NAME]);
            (additionalActivity.type).should.equal(ActivityType.ADDITIONAL_S2S);
            (additionalActivityUrl != null).should.equal(true);
            done();
        });
    })

    it('Should add Nonce to CSP header (script-src directive exists)', (done) => {
        const nonce = 'ImN0nc3Value';
        const headerWithoutNonce = 'connect-src \'self\' *.bazaarvoice.com *.google.com *.googleapis.com *.perimeterx.net *.px-cdn.net *.px-client.net; script-src \'self\' \'unsafe-eval\' \'unsafe-inline\' *.bazaarvoice.com *.forter.com *.google-analytics.com report-uri https://csp.px-cloud.net/report?report=1&id=8a3a7c5242c0e7646bd7d86284f408f6&app_id=PXFF0j69T5&p=d767ae06-b964-4b42-96a2-6d4089aab525';
        const headerWithNonce = 'connect-src \'self\' *.bazaarvoice.com *.google.com *.googleapis.com *.perimeterx.net *.px-cdn.net *.px-client.net; script-src \'nonce-ImN0nc3Value\' \'self\' \'unsafe-eval\' \'unsafe-inline\' *.bazaarvoice.com *.forter.com *.google-analytics.com report-uri https://csp.px-cloud.net/report?report=1&id=8a3a7c5242c0e7646bd7d86284f408f6&app_id=PXFF0j69T5&p=d767ae06-b964-4b42-96a2-6d4089aab525';
        nonceTestUtil(headerWithoutNonce, headerWithNonce);
        done();
    });

    it('Should add Nonce to CSP header (script-src directive does not exists)', (done) => {
        const headerWithoutNonce = 'connect-src \'self\' https://collector-px8u0i7rwc.px-cdn.net https://collector-px8u0i7rwc.px-cloud.net; report-uri https://csp.px-cloud.net/report?report=1&id=4bd43ac663997dde7c6a84abd14fdd7a&app_id=PX8U0i7rwC&p=70bb7c94-4807-4090-bea4-ffd1f7645126';
        const headerWithNonce = 'connect-src \'self\' https://collector-px8u0i7rwc.px-cdn.net https://collector-px8u0i7rwc.px-cloud.net; script-src \'nonce-ImN0nc3Value\'; report-uri https://csp.px-cloud.net/report?report=1&id=4bd43ac663997dde7c6a84abd14fdd7a&app_id=PX8U0i7rwC&p=70bb7c94-4807-4090-bea4-ffd1f7645126';
        nonceTestUtil(headerWithoutNonce, headerWithNonce);
        done();
    });

    it('Should add Nonce to CSP header, CSP header empty', (done) => {
        const headerWithoutNonce = ';';
        const headerWithNonce = '; script-src \'nonce-ImN0nc3Value\';';
        nonceTestUtil(headerWithoutNonce, headerWithNonce);
        done();
    });
});

const nonceTestUtil = (headerWithoutNonce, headerWithNonce) => {
    const nonce = 'ImN0nc3Value';
    const headers = { [CSP_HEADER]: headerWithoutNonce, [CSPRO_HEADER]: headerWithoutNonce };
    const response = new Response(headers);
    addNonce(response, nonce);

    (response.getHeader(CSP_HEADER) === headerWithNonce).should.equal(true);
    (response.getHeader(CSPRO_HEADER) === headerWithNonce).should.equal(true);
};
