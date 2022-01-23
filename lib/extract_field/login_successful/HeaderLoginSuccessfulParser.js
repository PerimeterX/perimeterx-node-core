const { ILoginSuccessfulParser } = require('./ILoginSuccessfulParser');
const { DEFAULT_LOGIN_SUCCESSFUL_HEADER_NAME, DEFAULT_LOGIN_SUCCESSFUL_HEADER_VALUE } = require('../../utils/constants');

class HeaderLoginSuccessfulParser extends ILoginSuccessfulParser {
    constructor(config) {
        super();
        this.headerName = config.LOGIN_SUCCESSFUL_HEADER_NAME || DEFAULT_LOGIN_SUCCESSFUL_HEADER_NAME;
        this.successfulHeaderValue = config.LOGIN_SUCCESSFUL_HEADER_VALUE || DEFAULT_LOGIN_SUCCESSFUL_HEADER_VALUE;
    }

    IsLoginSuccessful(response) {
        return response && response.getHeader && response.getHeader(this.headerName) === this.successfulHeaderValue;
    }
}

module.exports = {
    HeaderLoginSuccessfulParser
};