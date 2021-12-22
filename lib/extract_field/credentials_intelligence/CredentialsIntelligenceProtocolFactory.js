const { CIVersion } = require('../../enums/CIVersion');
const { V1CredentialsIntelligenceProtocol } = require('./V1CredentialsIntelligenceProtocol');
const { MultistepSSOCredentialsIntelligenceProtocol } = require('./MultistepSSOCredentialsIntelligenceProtocol');

class CredentialsIntelligenceProtocolFactory {
    static Create(protocolVersion) {
        switch (protocolVersion) {
            case CIVersion.V1:
                return new V1CredentialsIntelligenceProtocol();
            case CIVersion.MULTISTEP_SSO:
                return new MultistepSSOCredentialsIntelligenceProtocol();
            default:
                throw new Error(`Unknown CI protocol version '${protocolVersion}', acceptable versions are ${Object.values(CIVersion)}`);
        }
    }
}

module.exports = {
    CredentialsIntelligenceProtocolFactory
};