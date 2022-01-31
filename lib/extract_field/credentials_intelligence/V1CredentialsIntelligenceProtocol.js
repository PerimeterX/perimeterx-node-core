const { ICredentialsIntelligenceProtocol } = require('./ICredentialsIntelligenceProtocol');
const { LoginCredentialsFields } = require('../../models/LoginCredentialsFields');
const { CIVersion } = require('../../enums/CIVersion');
const { sha256 } = require('../../pxutil');

class V1CredentialsIntelligenceProtocol extends ICredentialsIntelligenceProtocol {
    ProcessCredentials(username, password) {
        return new LoginCredentialsFields(
            sha256(username),
            sha256(password),
            username,
            CIVersion.V1
        );
    }
}

module.exports = {
    V1CredentialsIntelligenceProtocol
};