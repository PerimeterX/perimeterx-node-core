const querystring = require('querystring');
const { accessNestedObjectValueByStringPath } = require('../pxutil');

const SentThrough = { BODY: 'body', QUERY_PARAM: 'query-param', HEADER: 'header' };
const ContentType = { JSON: 'application/json', URL_ENCODED: 'application/x-www-form-urlencoded', MULTIPART_FORM: 'multipart/form-data' };

class FieldExtractor {
    constructor(sentThrough, fieldsToExtract) {
        this.containerName = this._getContainerName(sentThrough);
        this.fieldsToExtract = fieldsToExtract instanceof Array ? fieldsToExtract : [fieldsToExtract];
    }

    ExtractFields(request) {
        const container = this._getContainer(request);
        if (!container) {
            return {};
        }
        const fields = {};
        this.fieldsToExtract.forEach((desiredField) => {
            let value = accessNestedObjectValueByStringPath(desiredField.oldFieldName, container);
            if (!value || typeof value !== 'string') {
                return;
            }
            value = desiredField.shouldNormalize ? this._normalizeField(value) : value;
            fields[desiredField.newFieldName] = value;
        });
        return fields;
    }

    _normalizeField(fieldValue) {
        return fieldValue.toLowerCase();
    }

    _getContainerName(sentThrough) {
        switch (sentThrough) {
            case SentThrough.QUERY_PARAM:
                return 'query';
            case SentThrough.HEADER:
                return 'headers';
            case SentThrough.BODY:
            default:
                return 'body';
        }
    }

    _getContainer(request) {
        const container = request[this.containerName];
        if (!container) {
            return null;
        }
        
        if (typeof container === 'object') {
            return container;
        }

        const contentType = request.headers['content-type'];
        if (contentType.includes(ContentType.JSON)) {
            return JSON.parse(container);
        } else if (contentType.includes(ContentType.URL_ENCODED)) {
            return querystring.parse(container);
        }
        return null;
    }
}

module.exports = FieldExtractor;