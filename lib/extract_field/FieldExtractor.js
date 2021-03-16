const { sha256, accessNestedObjectValueByStringPath } = require('../pxutil');

const SENT_THROUGH_TO_CONTAINER = { 'body': 'body', 'query-param': 'query', 'header': 'headers' };

class FieldExtractor {
    constructor(sentThrough, contentType, encoding, fieldsToExtract) {
        this.containerName = this._getContainerName(sentThrough);
        this.contentType = contentType;
        this.encoding = encoding;
        this.fieldsToExtract = fieldsToExtract;
    }

    ExtractFields(request) {
        const fields = {};
        const container = request[this.containerName];
        if (!container) {
            return fields;
        }
        this.fieldsToExtract.forEach((desiredField) => {
            const value = accessNestedObjectValueByStringPath(desiredField.bodyFieldName, container);
            if (!value || typeof value !== 'string') {
                return;
            }
            fields[desiredField.activityFieldName] = sha256(value);
        });
        return fields;
    }

    _getContainerName(sentThrough) {
        const containerName = SENT_THROUGH_TO_CONTAINER[sentThrough];
        if (containerName) {
            return containerName;
        }
        const CONTAINER_NAME_DEFAULT_VALUE = 'body';
        return CONTAINER_NAME_DEFAULT_VALUE;
    }
}

module.exports = FieldExtractor;