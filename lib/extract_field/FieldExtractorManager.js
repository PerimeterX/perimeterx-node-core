const FieldExtractor = require('./FieldExtractor');
const ExtractionField = require('../models/ExtractionField');

const USERNAME_FIELD = 'user';
const PASSWORD_FIELD = 'pass';

class FieldExtractorManager { 
    constructor(extractObjects) {
        this.extractorMap = this._createExtractorsMap(extractObjects);
    }

    ExtractFields(request) {
        const key = this._getMapKey(request.path, request.method);
        const extractor = this.extractorMap[key];
        try {
            return extractor ? extractor.ExtractFields(request) : {};
        } catch (e) {
            console.error(e);
            return {};
        }
    }

    _getMapKey(requestPath, requestMethod) {
        return `${requestPath}:${requestMethod}`;
    }

    _createExtractorsMap(extractObjects) {
        const map = {};
        for (const extractFields of extractObjects) {
            const key = this._getMapKey(extractFields.path, extractFields.method.toUpperCase());
            map[key] = new FieldExtractor(extractFields.sentThrough, extractFields.contentType, extractFields.encoding, [
                new ExtractionField(extractFields.userField, USERNAME_FIELD), 
                new ExtractionField(extractFields.passField, PASSWORD_FIELD)
            ]);
        }
        return map;
    }
}

module.exports = FieldExtractorManager;