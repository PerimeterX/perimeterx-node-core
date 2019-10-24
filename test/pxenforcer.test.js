'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require('rewire');
const request = require('../lib/request');
const pxhttpc = require('../lib/pxhttpc');
const PxClient = rewire('../lib/pxclient');
const PxEnforcer = require('../lib/pxenforcer');
const proxyquire = require('proxyquire');

describe('PX Enforcer - pxenforcer.js', () => {
    let params, enforcer, req, stub, pxClient, pxLoggerSpy, logger;

    beforeEach(() => {
        params = {
            pxAppId: 'PX_APP_ID',
            cookieSecretKey: 'kabum',
            authToken: 'PX_AUTH_TOKEN',
            sendPageActivities: true,
            blockingScore: 60,
            debugMode: true,
            ipHeader: 'x-px-true-ip',
            maxBufferLength: 1,
            enableModule: true,
        };

        req = {};
        req.headers = {};
        req.cookies = {};

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
            '@global': true
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
        params.enableModule = false;
        const curParams = Object.assign({
            enableModule: false
        }, params);

        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
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
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy', proxy: ''});
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
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy'});
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
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy'});
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
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy'});
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
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy'});
        });
        req.originalUrl = '/_APP_ID/xhr/something';
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
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
        const curParams = Object.assign({
            moduleMode: 1,
            firstPartyEnabled: true
        }, params);
        const reqStub = sinon.stub(request, 'post').callsFake((data, config, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}, body: 'hello buddy'});
        });
        req.headers = {'x-px-authorization': '3:some-fake-cookie'};
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
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
        const curParams = Object.assign({
            moduleMode: 0,
            bypassMonitorHeader: 'x-px-block'
        }, params);
        req.headers = {
            'x-px-block': '1'
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            (response.body.indexOf('Please verify you are a human') > -1).should.equal(true);
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
        const curParams = Object.assign({
            moduleMode: 0,
            bypassMonitorHeader: 'x-px-block'
        }, params);
        req.headers = {
            'x-px-block': '0'
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
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
        const curParams = Object.assign({
            moduleMode: 0,
            bypassMonitorHeader: 'x-px-block'
        }, params);
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
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
        const curParams = Object.assign({
            moduleMode: 0,
            bypassMonitorHeader: 'x-px-block'
        }, params);
        req.headers = {
            'x-px-block': '1'
        };
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(true);
            reqStub.restore();
            done();
        });
    });
    it('should not return json resposne when advancedBlockingResponse is false', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign({
            moduleMode: 1,
            advancedBlockingResponse: false
        }, params);
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
        req.headers = {'content-type': 'application/json'};
        enforcer = new PxEnforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should.exist(response);
            should.equal(response.header.value, 'text/html');
            reqStub.restore();
            done();
        });
    });
    it('should not return json resposne when advancedBlockingResponse is true (default)', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });
        const curParams = Object.assign({
            moduleMode: 1
        }, params);
        const reqStub = sinon.stub(req, 'post').callsFake((data, callback) => {
            callback(null, {body: 'hello buddy'});
        });
        req.method = 'POST';
        req.body = {key: 'value', anotherKey: 'anotherValue'};
        req.headers = {'content-type': 'application/json'};
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

        params.monitoredRoutes = ['/profile'];
        params.enableModule = false;
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

        const curParams = Object.assign({
            moduleMode: 1,
            whitelistRoutes: ['/profile']
        }, params);

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            pxLoggerSpy.debug.calledWith('Whitelist route match: /profile').should.equal(true);
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

        const curParams = Object.assign({
            moduleMode: 1,
            monitoredRoutes: ['/profile']
        }, params);

        req.originalUrl = '/profile';
        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(true);
            done();
        });
    });
    it('should enforce routes in blocking mode that are not specified in monitoredRoutes', (done) => {
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, config, callback) => {
            data.score = 100;
            data.action = 'c';
            return callback ? callback(null, data) : '';
        });

        const curParams = Object.assign({
            moduleMode: 1,
            monitoredRoutes: ['/profile']
        }, params);

        req.originalUrl = '/admin';
        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
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

        const curParams = Object.assign({
            moduleMode: 1,
            enforcedRoutes: ['/profile', '/login'],
            monitoredRoutes: ['/']
        }, params);

        req.originalUrl = '/';
        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
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

        const curParams = Object.assign({
            moduleMode: 1,
            enforcedRoutes: ['/profile', '/login'],
            monitoredRoutes: ['/']
        }, params);

        req.originalUrl = '/login';
        const pxenforcer = proxyquire('../lib/pxenforcer', {'./pxlogger': logger});
        enforcer = new pxenforcer(curParams, pxClient);
        enforcer.enforce(req, null, (error, response) => {
            should(error).not.be.ok();
            (response === undefined).should.equal(false);
            done();
        });
    });
});
