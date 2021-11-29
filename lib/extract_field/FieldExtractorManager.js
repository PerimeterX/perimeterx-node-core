const FieldExtractor = require('./FieldExtractor');
const ExtractionField = require('../models/ExtractionField');
const { sha256 } = require('../pxutil');

const USERNAME_FIELD = 'user';
const PASSWORD_FIELD = 'pass';
const CREDENTIALS_FIELD = 'creds';

class FieldExtractorManager { 
    constructor(logger, extractObjects) {
        this.logger = logger;
        this.extractorMap = this._createExtractorsMap(extractObjects);
    }

    ExtractFields(request) {
        const key = this._generateMapKey(request.path, request.method);
        const extractor = this.extractorMap[key];
        if (!extractor) {
            return {};
        }
        this.logger.debug(`Attempting to extract credentials for ${request.method} ${request.path} request`);
        try {
            const fields = extractor.ExtractFields(request);
            return this._processFields(fields);
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
            map[key] = new FieldExtractor(extractFields.sent_through, [
                new ExtractionField(extractFields.user_field, USERNAME_FIELD, true),
                new ExtractionField(extractFields.pass_field, PASSWORD_FIELD, false)
            ]);
        }
        return map;
    }

    _processFields(fields) {
        if (!fields || !fields[USERNAME_FIELD] || !fields[PASSWORD_FIELD]) {
            this.logger.debug('Failed extracting credentials');
            return {};
        }
        this.logger.debug('Successfully extracted credentials')
        return {
            [USERNAME_FIELD]: sha256(fields[USERNAME_FIELD]),
            [CREDENTIALS_FIELD]: sha256(fields[USERNAME_FIELD] + fields[PASSWORD_FIELD])
        };
    }
}

module.exports = FieldExtractorManager;