const pxUtil = require('./pxutil');
const PxConfig = require('./pxconfig');
const PxLogger = require('./pxlogger');
const PxClient = require('./pxclient');
const pxProxy = require('./pxproxy');

class PxCdFirstParty {
    constructor(params, client) {
        this.logger = new PxLogger(params);
        const config = new PxConfig(params, this.logger);
        this._config = config.conf;

        this.pxClient = client ? client : new PxClient();
        this.pxClient.init(this._config);
        this.reversePrefix = this._config.PX_APP_ID.substring(2);
    }

    handleFirstPartyRequest(req, res, cb) {
        const requestUrl = req.originalUrl;
        const ipAddress = pxUtil.extractIP(this._config, req);

        //regular sensor endpoint
        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_VENDOR_PATH}`)) {
            return pxProxy.getClient(req, this._config, ipAddress, cb);
        }
        if (requestUrl.startsWith(`/${this.reversePrefix}${this._config.FIRST_PARTY_CD_XHR_PATH}`)) {
            return pxProxy.sendCDXHR(req, this._config, ipAddress, this.reversePrefix, cb);
        }
        return cb();
    }
}

module.exports = PxCdFirstParty;