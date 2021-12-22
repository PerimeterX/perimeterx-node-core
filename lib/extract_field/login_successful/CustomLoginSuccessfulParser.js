const { ILoginSuccessfulParser } = require('./ILoginSuccessfulParser');

class CustomLoginSuccessfulParser extends ILoginSuccessfulParser {
    constructor(config) {
        super();
        this.callback = config.LOGIN_SUCCESSFUL_CUSTOM_CALLBACK;
    }

    IsLoginSuccessful(response) {
        try {
            return this.callback && this.callback(response);
        } catch (err) {
            return false;
        }
    }
}

module.exports = {
    CustomLoginSuccessfulParser
};