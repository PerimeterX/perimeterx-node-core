class GraphqlData {
    constructor(graphqlOperationType, graphqlOperationName, variables) {
        this.type = graphqlOperationType;
        this.name = graphqlOperationName;
        this.variables = variables;
    }
}

module.exports = {
    GraphqlData
};