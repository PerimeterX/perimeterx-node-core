const querystring = require('querystring');
const { sha256, accessNestedObjectValueByStringPath } = require('../pxutil');

const SENT_THROUGH = { BODY: 'body', QUERY_PARAM: 'query-param', HEADER: 'header' };
const ENCODING_TYPE = { URL_ENCODE: 'url-encode', CLEAR_TEXT: 'clear-text', BASE64: 'base64', CUSTOM: 'custom' };

class FieldExtractor {
    constructor(sentThrough, contentType, encoding, fieldsToExtract) {
        this.containerName = this._getContainerName(sentThrough);
        this.contentType = contentType;
        this._decode = this._getDecodeFunction(encoding);
        this.fieldsToExtract = fieldsToExtract;
    }

    ExtractFields(request) {
        const fields = {};
        const container = this._getContainer(request);
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
        switch (sentThrough) {
            case SENT_THROUGH.QUERY_PARAM:
                return 'query';
            case SENT_THROUGH.HEADER:
                return 'headers';
            case SENT_THROUGH.BODY:
            default:
                return 'body';
        }
    }

    _getDecodeFunction(encoding) {
        switch (encoding) {
            case ENCODING_TYPE.URL_ENCODE:
                return (string) => querystring.parse(string);
            case ENCODING_TYPE.CLEAR_TEXT:
            default:
                return (string) => JSON.parse(string);
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
        return this._decode(container);
    }
}

module.exports = FieldExtractor;