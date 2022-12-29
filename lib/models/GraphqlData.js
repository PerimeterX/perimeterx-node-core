class GraphqlData {
    constructor(graphqlOperationType, graphqlOperationName, variables) {
        this.operationType = graphqlOperationType;
        this.operationName = graphqlOperationName;
        this.variables = variables;
    }
}

module.exports = {
    GraphqlData
};