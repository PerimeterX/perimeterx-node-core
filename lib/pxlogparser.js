const PxConfig = require('./pxconfig');

class PxLogsParser {
    constructor(config) {
        this.config = new PxConfig(config, null);

    }
    enrichLogs(logs) {
        return logs.map((log) => this.enrichLogRecord(log));
    }

    enrichLogRecord(log) {
        log.message = log.message.substring(0, this.config.px_external_logger_max_message_size || log.message.length);
        Object.assign(log, {
            messageTimestamp: new Date().toISOString(),
            appID: this.config.config.PX_APP_ID,
            container: 'enforcer',
            configID: this.config.config.REMOTE_CONFIG_ID,
            configVersion: this.config.config.REMOTE_CONFIG_VERSION
        });
    }
}

module.exports = { PxLogsParser };
