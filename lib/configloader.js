const request = require('./request');
const logger = require('./pxlogger');

class ConfigLoader {

    constructor(config, pxClient) {
        this.config = config;
        this.pxClient = pxClient;
    }

    init() {
        this.loadData();
    }

    loadData() {
        const checksum = this.config.checksum;
        const callData = {
            url: `https://${this.config.CONFIGURATIONS_HOST}${this.config.CONFIGURATIONS_URI + (checksum ? `?checksum=${checksum}` : '')}`,
            headers: {Authorization: 'Bearer ' + this.config.AUTH_TOKEN}
        };
        request.get(callData, (error, response) => {
            if (error || !response || !(response.statusCode === 200 || response.statusCode === 204)) {
                logger.error(`Failed to get configurations: ${error}`);
                if (!checksum) { //no configuration loaded and we can't get configuration - disable module
                    logger.debug('Failed to pull initial config, switching module to disable until remote configuration found');
                    this.config.ENABLE_MODULE = false;
                }
                return;
            }

            // new configuration available
            if (response.statusCode === 200) {
                const body = JSON.parse(response.body);
                logger.debug(`Found new configuration - checksum: ${body.checksum}, new configuration: ${JSON.stringify(body)}`);
                this.config.checksum = body.checksum;
                this.config.COOKIE_SECRET_KEY = body.cookieKey;
                this.config.PX_APP_ID = body.appId;
                this.config.BLOCKING_SCORE = body.blockingScore;
                this.config.DEBUG_MODE = body.debugMode;
                this.config.ENABLE_MODULE = body.moduleEnabled;
                this.config.SENSITIVE_HEADERS = body.sensitiveHeaders;
                this.config.IP_HEADERS = body.ipHeaders;
                this.config.ACTIVITIES_TIMEOUT = body.connectTimeout;
                this.config.API_TIMEOUT_MS = body.riskTimeout;
                this.config.MODULE_MODE = body.moduleMode === "blocking" ? this.config.MONITOR_MODE.BLOCK : this.config.MONITOR_MODE.MONITOR;
                this.config.FIRST_PARTY_ENABLED = body.firstPartyEnabled;
                this.config.FIRST_PARTY_XHR_ENABLED = body.firstPartyXhrEnabled;
                this.pxClient.sendEnforcerTelemetry("remote_config");
            }
        });
    }
}

module.exports = ConfigLoader;