const { CIVersion } = require('../enums/CIVersion');
const { SSOStep } = require('../enums/SSOStep');

class LoginCredentialsFields {
    constructor(username, password, rawUsername, version) {
        this.username = username;
        this.password = password;
        this.rawUsername = rawUsername;
        this.version = version;
        if (this.version === CIVersion.MULTISTEP_SSO) {
            if (this.username) {
                this.ssoStep = SSOStep.USER;
            } else if (this.password) {
                this.ssoStep = SSOStep.PASS;
            }
        }
    }
}

module.exports = {
    LoginCredentialsFields
};