const pxutil = require('../lib/pxutil');
const { assert } = require('sinon');
const { isSensitiveGraphqlOperation } = require('../lib/pxutil');
const { largeGraphqlObject, largeGraphqlObject2 } = require('./mocks/graphqlQuery');

describe('Graphql Testing', () => {

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
        graphqlData.type.should.be.exactly(GRAPHQL_OPERATION_TYPE);
        graphqlData.name.should.be.exactly(GRAPHQL_OPERATION_NAME);
    });

    it('extract with spaces', () => {
        const gqlObj = {
            query: '\n   query    q1 { \n abc \n }',
            operationName: 'q1',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.name.should.be.exactly('q1');
        graphqlData.type.should.be.exactly('query');
    });

    it('extract with many queries', () => {
        const gqlObj = {
            query: 'query q1 { \n abc \n }\nmutation q2 {\n def\n }',
            operationName: 'q2',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.name.should.be.exactly('q2');
        graphqlData.type.should.be.exactly('mutation');
        assert.match(Object.keys(graphqlData.variables).length === 0, true);
    });

    it('extract with only one query without given operationName', () => {
        const gqlObj = {
            query: 'query q1 { \n abc \n }',
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.name.should.be.exactly('q1');
        graphqlData.type.should.be.exactly('query');
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
            variables: { x: 2, y: 3, z: 4 },
        };
        const graphqlData = pxutil.getGraphqlData(gqlObj);
        graphqlData.name.should.be.exactly('q1');
        graphqlData.type.should.be.exactly('query');
        assert.match(graphqlData.variables.length === 3 &&
            ['x', 'y', 'z'].every((e, i) => e === graphqlData.variables[i]), true);
    });
    it('isSensitive should return false when no graphql operation', () => {
        const sensitiveGraphqlOperation = pxutil.isSensitiveGraphqlOperation(null, {});
        assert.match(sensitiveGraphqlOperation, false);
    });
    it('sensitive information is not present in the graphql data parsing', () => {
        const gqlObj = {
            query: 'query q1(m: $email) { \n abc \n }\nmutation q2 {\n def\n }',
            operationName: 'q1',
            variables: { email: 'test@mail.com', password: 'Password1' },
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        assert.match(!!graphqlData.toString().match(/test@mail\.com/), false);
        assert.match(!!graphqlData.toString().match(/Password1/), false);
    });

    it('nested values should extract keys recursively', () => {
        const gqlObj = {
            query: 'query q1(m: $email) { \n abc \n }\nmutation q2 {\n def\n }',
            operationName: 'q1',
            variables: {
                email: 'test@mail.com', password: 'Password1', data: {
                    key1: 'test',
                    key2: {
                        mostInnerKey: null,
                    },
                    key3: 10,
                    emptyKey: {},
                },
            },
        };

        const graphqlData = pxutil.getGraphqlData(gqlObj);
        assert.match(!!graphqlData.toString().match(/test@mail\.com/), false);
        assert.match(!!graphqlData.toString().match(/Password1/), false);
        assert.match(!!graphqlData.toString().match(/test/), false);
        assert.match(!!graphqlData.toString().match(/10/), false);
        assert.match(!!graphqlData.toString().match(/null/), false);

        const expected = ['email', 'password', 'data.key1', 'data.key2.mostInnerKey', 'data.key3', 'data.emptyKey'];
        assert.match(graphqlData.variables.length === expected.length &&
            expected.every((e, i) => e === graphqlData.variables[i]), true);
    });

    it(`check for sensitive operation`, () => {
        const gqlData = {
            name: 'q1',
            type: 'mutation',
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
            name: 'q2',
        }, config), true);

        assert.match(isSensitiveGraphqlOperation({
            ...gqlData,
            name: 'q2',
        }, {
            ...config,
            SENSITIVE_GRAPHQL_OPERATION_TYPES: ['query'],
        }), false);
    });

    it('should parse correctly large queries', () => {
        const gql1 = largeGraphqlObject;
        const gql2 = largeGraphqlObject2;
        const graphqlData1 = pxutil.getGraphqlData(gql1);
        const graphqlData2 = pxutil.getGraphqlData(gql2);

        assert.match(graphqlData1.name === 'SiteInfo'
            && graphqlData1.type === 'query'
            && Array.isArray(graphqlData1.variables)
            && graphqlData1.variables.length === 0, true);
        assert.match(graphqlData2.name === 'CategoryBrowsePageContent'
            && graphqlData2.type === 'query'
            && graphqlData2.variables[0] === 'categoryId'
            && graphqlData2.variables.length === 1, true);
    });
});