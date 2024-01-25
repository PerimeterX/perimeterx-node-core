class PxExternalLogsParser {
    constructor(appId, remoteConfigId, remoteConfigVersion) {
        this.appId = appId;
        this.remoteConfigId = remoteConfigId;
        this.remoteConfigVersion = remoteConfigVersion;
    }
    enrichLogs(logs) {
        const enrichedLogs = logs.map((log) => {
            return this.enrichLogRecord(log);
        });
        return enrichedLogs;
    }

    enrichLogRecord(log) {
        return {...log, ...{
            messageTimestamp: new Date().toISOString(),
            appID: this.appId,
            container: 'enforcer',
            configID: this.remoteConfigId,
            configVersion: this.remoteConfigVersion
        }};
    }
}

module.exports = { PxExternalLogsParser };
