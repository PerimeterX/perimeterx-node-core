const { LoginSuccessfulReportingMethod } = require('../../enums/LoginSuccessfulReportingMethod');
const { BodyLoginSuccessfulParser } = require('./BodyLoginSuccessfulParser');
const { HeaderLoginSuccessfulParser } = require('./HeaderLoginSuccessfulParser');
const { StatusLoginSuccessfulParser } = require('./StatusLoginSuccessfulParser');
const { CustomLoginSuccessfulParser } = require('./CustomLoginSuccessfulParser');

class LoginSuccessfulParserFactory {
    static Create(config) {
        switch (config.LOGIN_SUCCESSFUL_REPORTING_METHOD) {
            case LoginSuccessfulReportingMethod.BODY:
                return new BodyLoginSuccessfulParser(config);
            case LoginSuccessfulReportingMethod.HEADER:
                return new HeaderLoginSuccessfulParser(config);
            case LoginSuccessfulReportingMethod.STATUS:
                return new StatusLoginSuccessfulParser(config);
            case LoginSuccessfulReportingMethod.CUSTOM:
                return new CustomLoginSuccessfulParser(config);
            case LoginSuccessfulReportingMethod.NONE:
            default:
                return null;
        }
    }
}

module.exports = {
    LoginSuccessfulParserFactory
};