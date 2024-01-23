class PxExternalLogsParser {
    constructor(appId, remoteConfigId, remoteConfigVersion) {
        this.appId = appId;
        this.remoteConfigId = remoteConfigId;
        this.remoteConfigVersion = remoteConfigVersion;
    }
    enrichLogs(logs) {
        return logs.map((log) => this.enrichLogRecord(log));
    }

    enrichLogRecord(log) {
        Object.assign(log, {
            messageTimestamp: new Date().toISOString(),
            appID: this.appId,
            container: 'enforcer',
            configID: this.remoteConfigId,
            configVersion: this.remoteConfigVersion
        });
    }
}

module.exports = { PxExternalLogsParser };
