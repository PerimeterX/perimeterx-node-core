const { ICredentialsIntelligenceProtocol } = require('./ICredentialsIntelligenceProtocol');
const { LoginCredentialsFields } = require('../../models/LoginCredentialsFields');
const { CIVersion } = require('../../enums/CIVersion');
const { sha256 } = require('../../pxutil');

class MultistepSSOCredentialsIntelligenceProtocol extends ICredentialsIntelligenceProtocol {
    constructor() {
        super();
    }

    ProcessCredentials(username, password) {
        const rawUsername = username || null;

        return new LoginCredentialsFields(
            rawUsername,
            password ? sha256(password) : null,
            rawUsername,
            CIVersion.MULTISTEP_SSO
        );
    }
}

module.exports = {
    MultistepSSOCredentialsIntelligenceProtocol
};