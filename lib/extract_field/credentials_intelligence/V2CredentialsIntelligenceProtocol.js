const { ICredentialsIntelligenceProtocol } = require('./ICredentialsIntelligenceProtocol');
const { LoginCredentialsFields } = require('../../models/LoginCredentialsFields');
const pxUtil = require('../../pxutil');
const pxConstants = require('../../utils/constants')
const { CIVersion } = require('../../enums/CIVersion');

class V2CredentialsIntelligenceProtocol extends ICredentialsIntelligenceProtocol {
    ProcessCredentials(username, password) {
        const normalizedUsername = pxUtil.isEmailAddress(username) ? this.normalizeEmailAddress(username) : username;
        const hashedUsername = pxUtil._hashString(normalizedUsername, pxConstants.HASH_ALGORITHM.SHA256);
        const hashedPassword = this.hashPassword(hashedUsername, password);

        return new LoginCredentialsFields(
            hashedUsername,
            hashedPassword,
            username,
            CIVersion.V2
        );
    }

    normalizeEmailAddress(emailAddress) {
        const lowercaseEmail = emailAddress.trim().toLowerCase();
        const atIndex = lowercaseEmail.indexOf('@');
        let normalizedUsername = lowercaseEmail.substring(0, atIndex);
        const plusIndex = normalizedUsername.indexOf('+');

        if (plusIndex > -1) {
            normalizedUsername = normalizedUsername.substring(0, plusIndex);
        }
        
        const domain = lowercaseEmail.substring(atIndex);
        const GMAIL_DOMAIN = '@gmail.com';
        
        if (domain === GMAIL_DOMAIN) {
            normalizedUsername = normalizedUsername.replace('.', '');
        }

        return `${normalizedUsername}${domain}`;
    }

    hashPassword(salt, password) {
        const hashedPassword = pxUtil._hashString(password, pxConstants.HASH_ALGORITHM.SHA256);
        return pxUtil._hashString(salt + hashedPassword, pxConstants.HASH_ALGORITHM.SHA256);
    }
}


module.exports = {
    V2CredentialsIntelligenceProtocol
};