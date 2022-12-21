const { CIVersion } = require('../../enums/CIVersion');
const { V1CredentialsIntelligenceProtocol } = require('./V1CredentialsIntelligenceProtocol');
const { MultistepSSOCredentialsIntelligenceProtocol } = require('./MultistepSSOCredentialsIntelligenceProtocol');
const { V2CredentialsIntelligenceProtocol } = require('./V2CredentialsIntelligenceProtocol');
const { ObjectValues } = require('../../pxutil');
class CredentialsIntelligenceProtocolFactory {
    static Create(protocolVersion) {
        switch (protocolVersion) {
            case CIVersion.V1:
                return new V1CredentialsIntelligenceProtocol();
            case CIVersion.V2:
                return new V2CredentialsIntelligenceProtocol();
            case CIVersion.MULTISTEP_SSO:
                return new MultistepSSOCredentialsIntelligenceProtocol();
            default:
                throw new Error(`Unknown CI protocol version '${protocolVersion}', acceptable versions are ${ObjectValues(CIVersion)}`);
        }
    }
}

module.exports = {
    CredentialsIntelligenceProtocolFactory
};