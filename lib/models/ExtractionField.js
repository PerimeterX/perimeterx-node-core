class ExtractionField {
    constructor(oldFieldName, newFieldName, shouldNormalize) {
        this.oldFieldName = oldFieldName;
        this.newFieldName = newFieldName;
        this.shouldNormalize = shouldNormalize;
    }
}

module.exports = ExtractionField;