'use strict';

const should = require('should');
const pxutil = require('../lib/pxutil');
const PxConfig = require('../lib/pxconfig');
const PxLogger = require('../lib/pxlogger');
const { assert } = require('sinon');
const { isSensitiveGraphqlOperation } = require('../lib/pxutil');

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
            px_enrich_custom_parameters: px_enrich_custom_parameters,
        };

        const logger = new PxLogger(params);
        pxConfig = new PxConfig(params, logger);
    });

    it('should generate headers array from headers object', (done) => {
        const formattedHeaders = pxutil.formatHeaders({ K: 'v' }, pxConfig.conf.SENSITIVE_HEADERS);
        (Object.prototype.toString.call(formattedHeaders)).should.be.exactly('[object Array]');
        formattedHeaders[0]['name'].should.be.exactly('K');
        formattedHeaders[0]['value'].should.be.exactly('v');
        return done();
    });

    it('should receive custom params function and custom params object and add only 2 of them', (done) => {
        const dict = {};
        pxutil.prepareCustomParams(pxConfig.conf, dict, { uri: '/index.html' });
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
                query: `${GRAPHQL_OPERATION_TYPE} ${GRAPHQL_OPERATION_NAME} {\n    __typename\n}`,
            },
        };
        const graphqlData = pxutil.getGraphqlData(req.body);
        graphqlData.operationType.should.be.exactly(GRAPHQL_OPERATION_TYPE);
        graphqlData.operationName.should.be.exactly(GRAPHQL_OPERATION_NAME);
    });

    it('extract with spaces', () => {
        const gqlObj = {
            query: '\n   query    q1 { \n abc \n }',
            operationName: 'q1',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.operationName.should.be.exactly('q1');
        graphqlData.operationType.should.be.exactly('query');
    });

    it('extract with many queries', () => {
        const gqlObj = {
            query: 'query q1 { \n abc \n }\nmutation q2 {\n def\n }',
            operationName: 'q2',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.operationName.should.be.exactly('q2');
        graphqlData.operationType.should.be.exactly('mutation');
    });

    it('extract with only one query without given operationName', () => {
        const gqlObj = {
            query: 'query q1 { \n abc \n }',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.operationName.should.be.exactly('q1');
        graphqlData.operationType.should.be.exactly('query');
    });

    it('should return null when multiple operations without explicitly specified', () => {
        const gqlObj = {
            query: 'query q1 { \n abc \n }\nmutation q2 {\n def\n }',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        assert.match(graphqlData, null);
    });

    it('should include variables', () => {
        const gqlObj = {
            query: 'query q1(m: $x) { \n abc \n }\nmutation q2 {\n def\n }',
            operationName: 'q1',
            variables: { x: 2 },
        };
        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.operationName.should.be.exactly('q1');
        graphqlData.operationType.should.be.exactly('query');
        assert.match(Object.keys(graphqlData.variables).length === 1 && graphqlData.variables.x === 2, true);
    });

    it(`check for sensitive operation`, () => {
        const gqlData = {
            operationName: 'q1',
            operationType: 'mutation',
            variables: { x: 2 },
        };
        const config = {
            SENSITIVE_GRAPHQL_OPERATION_TYPES: ['mutation'],
            SENSITIVE_GRAPHQL_OPERATION_NAMES: ['q1'],
        };

        assert.match(isSensitiveGraphqlOperation(gqlData, config), true);
        assert.match(isSensitiveGraphqlOperation(gqlData, {
            ...config,
            SENSITIVE_GRAPHQL_OPERATION_TYPES: ['query'],
        }), true);
        assert.match(isSensitiveGraphqlOperation({
            ...gqlData,
            operationName: 'q2',
        }, config), true);

        assert.match(isSensitiveGraphqlOperation({
            ...gqlData,
            operationName: 'q2',
        }, {
            ...config,
            SENSITIVE_GRAPHQL_OPERATION_TYPES: ['query']
        }), false);
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
