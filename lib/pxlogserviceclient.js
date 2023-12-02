const { EXTERNAL_LOGGER_SERVICE_PATH } = require('./utils/constants');

class LogServiceClient {
    constructor(config, pxClient) {
        this.config = config;
        this.appId = config.PX_APP_ID;
        this.pxClient = pxClient;
    }

    sendLogs(pxCtx, logs, req) {
        try {
            const enrichedLogs = logs.map((log) => this.enrichLogRecord(pxCtx, log, req));
            this.postLogs(enrichedLogs);
        } catch (e) {
            this.config.logger.error(`unable to send logs: + ${e}`);
        }
    }

    enrichLogRecord(pxCtx, logs, req) {
        const logMetadata = {
            container: 'enforcer',
            appID: this.appId,
            method: pxCtx ? pxCtx.httpMethod : req.method || '',
            host: pxCtx ? pxCtx.hostname : req.hostname || req.get('host'),
            path: pxCtx ? pxCtx.uri : req.originalUrl || '/',
            requestId: pxCtx ? pxCtx.requestId : ''
        };

        return { ... logMetadata, ...logs };
    }

    postLogs(enrichLogs) {
        const reqHeaders = {
            Authorization: 'Bearer ' + this.config.LOGGER_AUTH_TOKEN
        };

        this.pxClient.callServer(enrichLogs, EXTERNAL_LOGGER_SERVICE_PATH, reqHeaders, this.config);
    }
}

module.exports = { LogServiceClient };