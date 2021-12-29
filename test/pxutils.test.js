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
            px_app_id: 'PX_APP_ID',
            px_cookie_secret: 'PX_COOKIE_SECRET',
            px_auth_token: 'PX_AUTH_TOKEN',
            px_send_async_activities_enabled: true,
            px_blocking_score: 60,
            px_logger_severity: true,
            px_ip_headers: '',
            px_max_activity_batch_size: 1,
            px_enrich_custom_parameters: px_enrich_custom_parameters
        };

        const logger = new PxLogger(params);
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

    it('should extract graphql data from the request body properly', () => {
        const GRAPHQL_OPERATION_NAME = 'OperationName';
        const GRAPHQL_OPERATION_TYPE = 'mutation';
        const req = {
            path: '/some/path/with/graphql',
            body: {
                query: `${GRAPHQL_OPERATION_TYPE} ${GRAPHQL_OPERATION_NAME} {\n    __typename\n}`
            }
        }
        const graphqlData = pxutil.getGraphqlData(req);
        graphqlData.operationType.should.be.exactly(GRAPHQL_OPERATION_TYPE);
        graphqlData.operationName.should.be.exactly(GRAPHQL_OPERATION_NAME);
    });
});

function px_enrich_custom_parameters(params, origReq) {
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
