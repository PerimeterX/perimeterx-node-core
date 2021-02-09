const S2SErrorReason = require('../enums/S2SErrorReason');

class S2SErrorInfo {
    constructor(errorReason, errorMessage, httpStatus, httpMessage) {
        this.errorReason = errorReason ? errorReason : S2SErrorReason.NO_ERROR;
        this.errorMessage = errorMessage;
        this.httpStatus = httpStatus;
        this.httpMessage = httpMessage;
    }
}

module.exports = S2SErrorInfo;