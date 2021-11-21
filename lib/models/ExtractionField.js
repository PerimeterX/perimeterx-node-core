class ExtractionField {
    constructor(origRequestFieldName, resultActivityFieldName, isUsername) {
        this.origRequestFieldName = origRequestFieldName;
        this.resultActivityFieldName = resultActivityFieldName;
        this.isUsername = isUsername;
    }
}

module.exports = ExtractionField;
