const { ILoginSuccessfulParser } = require('./ILoginSuccessfulParser');

class BodyLoginSuccessfulParser extends ILoginSuccessfulParser {
    constructor(config) {
        super();
        this.bodyRegex = config.LOGIN_SUCCESSFUL_BODY_REGEX;
    }

    IsLoginSuccessful(response) {
        return response && response.locals && response.locals.body && !!response.locals.body.match(this.bodyRegex);
    }
}

module.exports = {
    BodyLoginSuccessfulParser
};