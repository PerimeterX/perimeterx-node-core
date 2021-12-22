const { ILoginSuccessfulParser } = require('./ILoginSuccessfulParser');

class StatusLoginSuccessfulParser extends ILoginSuccessfulParser {
    constructor(config) {
        super();
        this.successfulStatuses = Array.isArray(config.LOGIN_SUCCESSFUL_STATUS) ?
            config.LOGIN_SUCCESSFUL_STATUS : [config.LOGIN_SUCCESSFUL_STATUS];
    }

    IsLoginSuccessful(response) {
        return response && response.statusCode && this.successfulStatuses.includes(response.statusCode);
    }
}

module.exports = {
    StatusLoginSuccessfulParser
};