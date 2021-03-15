const { sha256, accessNestedObjectValueByStringPath } = require("../pxutil");

class FieldExtractor {
    static SENT_THROUGH = { BODY: "body", QUERY_PARAMS: "query-param", HEADERS: "header" };
    static CONTENT_TYPE = { JSON: "json", XML: "xml", FORM_DATA: "form-data"};
    static CONTAINER = { "body": "body", "query-param": "query", "header": "headers"};
    static ENCODING = { CLEAR_TEXT: "clear-text", URL_ENCODE: "url-encode", BASE64: "base64", CUSTOM: "custom" };

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
            return fields
        }
        this.fieldsToExtract.forEach((desiredField) => {
            const value = accessNestedObjectValueByStringPath(desiredField.bodyFieldName, container);
            if (!value || typeof value !== "string") {
                return;
            }
            fields[desiredField.activityFieldName] = sha256(value);
        })
        return fields;
    }

    _getContainerName(sentThrough) {
        const containerNameFromSentThrough = FieldExtractor.CONTAINER[sentThrough];
        if (containerNameFromSentThrough) {
            return containerNameFromSentThrough;
        }
        const CONTAINER_NAME_DEFAULT_VALUE = "body";
        return CONTAINER_NAME_DEFAULT_VALUE;
    }
}

module.exports = FieldExtractor;