'use strict';

const should = require('should');
const sinon = require('sinon');
const rewire = require("rewire");
const pxutil = require('../lib/pxutil');
const request = require('../lib/request');
const pxhttpc = require('../lib/pxhttpc');
const pxapi = rewire('../lib/pxapi');
const PxClient = rewire('../lib/pxclient');
const PxEnforcer = require('../lib/pxenforcer')
const originalTokenValidator = require('../lib/pxoriginaltoken');

describe('PX Utils - pxutils.js', () => {
    let pxconfig;
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
            maxBufferLength: 1
        };

        pxconfig = require('../lib/pxconfig');
        pxconfig.init(params, new PxClient());
    });

    it('should generate headers array from headers object', (done) => {
        const formattedHeaders = pxutil.formatHeaders({K: 'v'});
        (Object.prototype.toString.call(formattedHeaders)).should.be.exactly('[object Array]');
        formattedHeaders[0]['name'].should.be.exactly('K');
        formattedHeaders[0]['value'].should.be.exactly('v');
        return done();
    });
});

describe('PX Configurations - pxconfig.js', () => {
    let pxconfig;
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
            maxBufferLength: 1
        };

        pxconfig = require('../lib/pxconfig');
    });

    it('should set baseUrl to sapi-<appid>.perimeterx.net', (done) => {
        params.pxAppId = 'PXJWbMQarF';
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.SERVER_HOST.should.be.exactly(`sapi-${params.pxAppId.toLowerCase()}.perimeterx.net`)
        done();
    });

    it('blocking score should be 80', (done) => {
        params.blockingScore = 80;
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.BLOCKING_SCORE.should.be.exactly(80);
        done();
    });

    it('getUserIp function should be overridden', (done) => {
        params.getUserIp = function () {
            return '1.2.3.4';
        };

        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.GET_USER_IP().should.be.exactly('1.2.3.4');
        done();
    });

    it('requestHandler function should be overridden', (done) => {
        params.customRequestHandler = function () {
            return 'Blocked';
        };

        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.CUSTOM_REQUEST_HANDLER().should.be.exactly('Blocked');
        done();
    });

    it('should set enableModule to false', () => {
        params.enableModule = false;
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.ENABLE_MODULE.should.be.exactly(false);
    });

    it('should set sendPageActivities to false', () => {
        params.sendPageActivities = false;
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.SEND_PAGE_ACTIVITIES.should.be.exactly(false);
    });

    it('should set debugMode to true', () => {
        params.sendPageActivities = true;
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.DEBUG_MODE.should.be.exactly(true);
    });

    it('customLogo should be overridden', () => {
        params.customLogo = 'http://www.google.com/logo.jpg';
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.CUSTOM_LOGO.should.be.exactly('http://www.google.com/logo.jpg');
    });

    it('jsRef should be overridden', () => {
        params.jsRef = ['http://www.google.com/script.js'];
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.JS_REF[0].should.equal('http://www.google.com/script.js');
    });

    it('cssRef should be overridden', () => {
        params.cssRef = ['http://www.google.com/stylesheet.css'];
        pxconfig.init(params, new PxClient());
        const conf = pxconfig.conf;
        conf.CSS_REF[0].should.equal('http://www.google.com/stylesheet.css');
    });
});

describe('PX API - pxapi.js', () => {
    let params;
    let config;
    let stub;
    beforeEach(() => {
        params = {
            pxAppId: 'PX_APP_ID',
            cookieSecretKey: 'kabum',
            authToken: 'PX_AUTH_TOKEN',
            sendPageActivities: true,
            blockingScore: 60,
            debugMode: true,
            ipHeader: 'x-px-true-ip',
            maxBufferLength: 1
        };

        let pxconfig = require('../lib/pxconfig');
        config = pxconfig.mergeDefaults(params);
        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, ignore, callback) => {
            return callback(data)
        });
    });

    afterEach(() => {
        stub.restore();
    });
    it('should add px_orig_cookie to risk_api when decryption fails', (done) => {
        //Stubbing the pxhttpc callServer functions


        //Using rewire to get callServer function
        const pxApiCallServerFunc = pxapi.__get__('callServer');

        // Prepare pxCtx
        const pxCtx = {
            ip: '1.2.3.4',
            fullUrl: 'stub',
            vid: 'stub',
            uuid: 'stub',
            uri: 'stub',
            headers: 'stub',
            httpVersion: 'stub',
            s2sCallReason: 'cookie_decryption_failed',
            httpMethod: 'stub',
            getCookie: () => { return 'abc'}
        }

        pxApiCallServerFunc(pxCtx, data => {
            data.additional.px_orig_cookie.should.equal('abc')
            done();
        });
    });

    it('token v3 - should add originalUuid, vid and decodedOriginalToken to pxCtx when original token decryption succeeds', (done) => {
        const pxCtx = {
            cookies:{
                _px3:'aaaa'
            },
            originalToken: '68a1bf96ab3af2e0683a377d332b125dda3e195ee56cf3ce4d61b99cd0860dc6:xTMRZvJnzxM=:1000:0pjajaPCjssb2HjG2436zyFXIvIEbE87nFBrHEQPDRT7fqiQ5RA05+njsLUVpOtdJjLvWNNAlSG70DW2wqWM5VmF9UR420/wxPkx6Ebyz/L9q7Mxk5fcdF8p+dGcMc3uD7Qh8y3WiPSN389cXhfKfMttUABQYvRpOxo7rMC+ngpHEVYg+lfBZCliHB1PZKLy'
        }

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        pxCtx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        JSON.stringify(pxCtx.decodedOriginalToken).should.equal('{"a":"c","s":0,"u":"09ade30a-f08b-11e7-8c3f-9a214cf093ae","t":1830515445000,"v":"0290edec-f08b-11e7-8c3f-9a214cf093ae"}');
        done();
    })
    it('token v3 - should set originalTokenError to decryption_failed on original token decryption fail', (done) => {
        const pxCtx = {
            cookies:{
                _px3:'aaaa'
            },
            originalToken: 'aaaaa:bbbbb:cccc:ddddd'
        }

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalTokenError.should.equal('decryption_failed');
        done();
    })
    it('token v3 - should set originalTokenError to validation_failed on original token validation fail', (done) => {
        const pxCtx = {
            cookies:{
                _px3:'aaaa'
            },
            originalToken: '68a1bf96ab3af2e0683a377d332b125dda3e195ee56cf3ce4d61b99cd0860dc:xTMRZvJnzxM=:1000:0pjajaPCjssb2HjG2436zyFXIvIEbE87nFBrHEQPDRT7fqiQ5RA05+njsLUVpOtdJjLvWNNAlSG70DW2wqWM5VmF9UR420/wxPkx6Ebyz/L9q7Mxk5fcdF8p+dGcMc3uD7Qh8y3WiPSN389cXhfKfMttUABQYvRpOxo7rMC+ngpHEVYg+lfBZCliHB1PZKLy'
        }

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        pxCtx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        pxCtx.originalTokenError.should.equal('validation_failed');
        done();
    })
    it('token v1 - should add originalUuid, vid and decodedOriginalToken to pxCtx when original token decryption succeeds', (done) => {
        const pxCtx = {
            cookies:{
                _px:'aaaa'
            },
            originalToken: 'Gy9z3mQPYNE=:1000:I7A44BXmO5IlgqhXLM5Mmuq4/jESNgse51Zj/l4bpkAaymDQzcrUMHBofVQ8Q9IYfon3bVQn7gHA124xunjlSlPMlj133wuFBzt7r/yJKpcTEex5WBxynCQAXXx8tymeO1gWXLmPchrV93ysxPl/AeV2/ofVN3YzUR/0PQbXB2fzxkPc5bMPdxLMJCrgLtR4msoMGvg9qaiufMFDWWzah1kvUq1Kvrlk3UQm0y6UU1j6GoLHkTSnDBTg3GexETotOoUkM5FYMPZm8TxK0as+mg=='
        }

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalUuid.should.equal('09ade30a-f08b-11e7-8c3f-9a214cf093ae');
        pxCtx.vid.should.equal('0290edec-f08b-11e7-8c3f-9a214cf093ae');
        JSON.stringify(pxCtx.decodedOriginalToken).should.equal('{"h":"aa2341380b7c67ee0ed5c2f7d4facf03847d7dcb4540aab021654361d3dcade4","s":{"a":0,"b":0},"u":"09ade30a-f08b-11e7-8c3f-9a214cf093ae","t":1830515445000,"v":"0290edec-f08b-11e7-8c3f-9a214cf093ae"}');
        done();
    })
    it('token v1 - should set originalTokenError to decryption_failed on original token decryption fail', (done) => {
        const pxCtx = {
            cookies:{
                _px:'aaaa'
            },
            originalToken: 'aaaaa:bbbbb:cccc:ddddd'
        }

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalTokenError.should.equal('decryption_failed');
        done();
    })
    it('should fail with exception and set originalTokenError to decryption_failed', (done) => {
        const pxCtx = {
            cookies: {
                _px: 'aaaaa'
            },
            originalToken:''
        };

        originalTokenValidator.evalCookie(pxCtx, config);
        pxCtx.originalTokenError.should.equal('decryption_failed');
        done();
    })
});

describe('PX Enforcer - pxenforcer.js', () => {
    let params, enforcer, req, stub;
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
            moduleMode: 1,
            firstPartyEnabled: true
        };

        req = {};
        req.headers = {};
        req.cookies = {};

        req.originalUrl = "/";
        req.path = req.originalUrl.substring(req.originalUrl.lastIndexOf('/'));
        req.protocol = 'http';
        req.ip = '1.2.3.4';
        req.hostname = 'example.com'
        req.get = (key) => {
            return req.headers[key] || '';
        };

        stub = sinon.stub(pxhttpc, 'callServer').callsFake((data, headers, uri, callType, ignore, callback) => {
            return callback ? callback(data) : '';
        });
    });

    afterEach(() => {
        stub.restore();
    });

    it ('enforces a call in a disabled module', (done) => {
        params.enableModule = false;
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (response) => {

            (response === undefined).should.equal(true);
            done();
        });
    });

    it ('enforces a call in an enabled module', (done) => {
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (response) => {

            (response === undefined).should.equal(true);
            done();
        });
    });
    it('uses first party to get client', (done) => {
        let reqStub = sinon.stub(request, 'get').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/init.js";
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    });
    it('uses first party for xhr post request', (done) => {
        let reqStub = sinon.stub(request, 'post').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/xhr/something";
        req.method = "POST";
        req.body = "test";
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    });
    it('uses first party for xhr get request', (done) => {
        let reqStub = sinon.stub(request, 'get').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/xhr/something";
        req.method = "GET";
        req.body = "test";
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    });
    it ('uses first party with pxvid cookie', (done) => {
        let reqStub = sinon.stub(request, 'post').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/xhr/something";
        req.method = "POST";
        req.cookies['_pxvid'] = "abab-123";
        req.body = "test";
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    })
    it('uses first party for xhr and passed trough bodyParser', (done) => {
        let reqStub = sinon.stub(request, 'post').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/xhr/something";
        req.method = "POST";
        req.body={key: 'value', anotherKey:'anotherValue'};
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    })
    it('uses upper case for xhr', (done) => {
        let reqStub = sinon.stub(request, 'post').callsFake((data, callback) => {
            callback(null, {headers: {'x-px-johnny': '1'}}, "hello buddy");
        })
        req.originalUrl = "/_APP_ID/XHR/something";
        req.method = "POST";
        req.body={key: 'value', anotherKey:'anotherValue'};
        enforcer = new PxEnforcer(params, new PxClient());
        enforcer.enforce(req, null, (error, response) => {
            (response === undefined).should.equal(false);
            response.body.should.equal("hello buddy");
            response.headers['x-px-johnny'].should.equal('1')
            reqStub.restore();
            done();
        });
    })
});


