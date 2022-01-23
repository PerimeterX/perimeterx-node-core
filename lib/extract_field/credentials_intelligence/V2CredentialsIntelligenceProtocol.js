const { ICredentialsIntelligenceProtocol } = require('./ICredentialsIntelligenceProtocol');
const { LoginCredentialsFields } = require('../../models/LoginCredentialsFields');
const { CIVersion } = require('../../enums/CIVersion');
const { sha256 } = require('../../pxutil');

class V2CredentialsIntelligenceProtocol extends ICredentialsIntelligenceProtocol {
    constructor() {
        super();
    }

    ProcessCredentials(username, password) {
        const hashedUsername = sha256(this.normalizeUsername(username));
        return new LoginCredentialsFields(
            hashedUsername,
            sha256(hashedUsername + sha256(password)),
            username,
            CIVersion.V2
        );
    }

    normalizeUsername(username) {
        return username.toLowerCase().replace(/\./g, '');
    }
}

module.exports = {
    V2CredentialsIntelligenceProtocol
};