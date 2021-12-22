const FieldExtractor = require('./FieldExtractor');
const ExtractionField = require('../models/ExtractionField');
const { CredentialsIntelligenceProtocolFactory } = require('./credentials_intelligence/CredentialsIntelligenceProtocolFactory');
const { CI_USERNAME_FIELD, CI_PASSWORD_FIELD } = require('../utils/constants');

class LoginCredentialsExtractor {
    constructor(logger, version, extractObjects) {
        this.logger = logger;
        this.extractorMap = this._createExtractorsMap(extractObjects);
        this.protocol = CredentialsIntelligenceProtocolFactory.Create(version);
    }

    ExtractLoginCredentials(request) {
        const key = this._generateMapKey(request.path, request.method);
        const extractor = this.extractorMap[key];
        if (!extractor) {
            return null;
        }
        this.logger.debug(`Attempting to extract credentials for ${request.method} ${request.path} request`);
        try {
            const fields = extractor.ExtractFields(request);
            return this._processFields(fields);
        } catch (e) {
            this.logger.debug(`Encountered error extracting credentials: ${e}`);
            return null;
        }
    }

    _generateMapKey(requestPath, requestMethod) {
        return `${requestPath}:${requestMethod}`;
    }

    _createExtractorsMap(extractObjects) {
        const map = {};
        for (const extractFields of extractObjects) {
            const key = this._generateMapKey(extractFields.path, extractFields.method.toUpperCase());
            map[key] = new FieldExtractor(extractFields.sent_through, extractFields.callback, [
                new ExtractionField(extractFields.user_field, CI_USERNAME_FIELD),
                new ExtractionField(extractFields.pass_field, CI_PASSWORD_FIELD)
            ]);
        }
        return map;
    }

    _processFields(fields) {
        if (!fields || !fields[CI_USERNAME_FIELD] || !fields[CI_PASSWORD_FIELD]) {
            this.logger.debug('Failed extracting credentials');
            return null;
        }
        this.logger.debug('Successfully extracted credentials');
        return this.protocol.ProcessCredentials(fields[CI_USERNAME_FIELD], fields[CI_PASSWORD_FIELD]);
    }
}

module.exports = LoginCredentialsExtractor;