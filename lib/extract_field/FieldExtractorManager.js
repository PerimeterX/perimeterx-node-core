const FieldExtractor = require('./FieldExtractor');
const ExtractionField = require('../models/ExtractionField');

const USERNAME_FIELD = 'user';
const PASSWORD_FIELD = 'pass';

class FieldExtractorManager { 
    constructor(logger, extractObjects) {
        this.logger = logger;
        this.extractorMap = this._createExtractorsMap(extractObjects);
    }

    ExtractFields(request) {
        const key = this._generateMapKey(request.path, request.method);
        const extractor = this.extractorMap[key];
        try {
            return extractor ? extractor.ExtractFields(request) : {};
        } catch (e) {
            this.logger.error(e);
            return {};
        }
    }

    _generateMapKey(requestPath, requestMethod) {
        return `${requestPath}:${requestMethod}`;
    }

    _createExtractorsMap(extractObjects) {
        const map = {};
        for (const extractFields of extractObjects) {
            const key = this._generateMapKey(extractFields.path, extractFields.method.toUpperCase());
            map[key] = new FieldExtractor(extractFields.sentThrough, extractFields.contentType, extractFields.encoding, [
                new ExtractionField(extractFields.userField, USERNAME_FIELD, true),
                new ExtractionField(extractFields.passField, PASSWORD_FIELD, false)
            ]);
        }
        return map;
    }
}

module.exports = FieldExtractorManager;
