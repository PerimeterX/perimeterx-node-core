'use strict';
const os = require('os');
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');
const { ActivityType } = require('./enums/ActivityType');
const { CIVersion } = require('./enums/CIVersion');
const { makeAsyncRequest } = require('./request');
const { LoggerSeverity } = require('./enums/LoggerSeverity');
const { PxExternalLogsParser } = require('./pxexternallogparser');
const PxConfig = require('./pxconfig');
const {
    CI_VERSION_FIELD,
    CI_SSO_STEP_FIELD,
    CI_RAW_USERNAME_FIELD,
    CI_CREDENTIALS_COMPROMISED_FIELD,
    GQL_OPERATIONS_FIELD,
    APP_USER_ID_FIELD_NAME,
    JWT_ADDITIONAL_FIELDS_FIELD_NAME,
    CROSS_TAB_SESSION, HOST_NAME, EXTERNAL_LOGGER_SERVICE_PATH, INVALID_VERSION_NUMBER,
} = require('./utils/constants');
const { ErrorType } = require('./enums/ErrorType');

class PxClient {
    constructor() {
        this.activitiesBuffer = [];
        this._remoteConfigLatestVersion = INVALID_VERSION_NUMBER;
    }

    init() {
        //stub for overriding
    }
    get remoteConfigLatestVersion() {
        return this._remoteConfigLatestVersion;
    }

    set remoteConfigLatestVersion(value) {
        this._remoteConfigLatestVersion = value;
    }
    /**
     * generateActivity - returns a JSON representing the activity.
     * @param  {string} activityType - name of the activity
     * @param  {object} details - activities details in key-val format
     * @param  {object} ctx - request context
     * @param  {object} config - perimeterx config
     * @return {object} JSON representing the activity.
     */
    generateActivity(activityType, details, ctx, config) {
        const activity = {
            type: activityType,
            timestamp: Date.now(),
            socket_ip: ctx.ip,
            px_app_id: config.PX_APP_ID,
            url: ctx.fullUrl,
            vid: ctx.vid ? ctx.vid : undefined,
        };
        details['request_id'] = ctx.requestId;

        this.addAdditionalFieldsToActivity(details, ctx, config);
        if (activityType !== ActivityType.ADDITIONAL_S2S) {
            activity.headers = pxUtil.formatHeaders(ctx.headers, config.SENSITIVE_HEADERS);
            activity.pxhd = (ctx.pxhdServer ? ctx.pxhdServer : ctx.pxhdClient) || undefined;
            pxUtil.prepareCustomParams(config, details, ctx.originalRequest);

            if (ctx.riskStartTime) {
                details['risk_start_time'] = ctx.riskStartTime;
            }
        }

        activity.details = details;
        return activity;
    }

    async fetchRemoteConfig(configParams) {
        const { config, logger } = new PxConfig(configParams);
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            try {

                const { id, version, configValue } = await this.getRemoteConfigObject(config);
                const response =  {
                    px_remote_config_id: id,
                    px_remote_config_version: version,
                    ...configValue
                };
                logger.debug(`Successfully fetch remote config in ${i} try, appID :: ${config.PX_APP_ID}, configID :: ${id}, version :: ${version}`);
                return response;
            } catch (e) {
                const message = `Error fetching remote configurations: ${e.message}`;
                this.sendRemoteLog(message, LoggerSeverity.DEBUG, ErrorType.WRITE_REMOTE_CONFIG, config);
                if (i < maxRetries - 1) { // if it's not the last retry
                    await new Promise(resolve => setTimeout(resolve, 1000)); // wait for 1 second before retrying
                } else {
                    config.logger.error('Failed to fetch remote configuration after 5 attempts');
                }
            }
        }
    }

    async getRemoteConfigObject(config) {
        const callData = {
            url: `https://sapi-${config.PX_APP_ID}.perimeterx.net/config/`,
            headers: { 'Authorization': `Bearer ${config.REMOTE_CONFIG_AUTH_TOKEN}`, 'Accept-Encoding': '' },
            timeout: 20000,
        };
        const res = await makeAsyncRequest({ url: callData.url, headers: callData.headers, timeout: callData.timeout, method: 'GET' }, config);
        const remoteConfig = JSON.parse(res.body);
        if (remoteConfig.id !== config.REMOTE_CONFIG_ID) {
            throw new Error(`Remote configuration id mismatch. Expected: ${config.REMOTE_CONFIG_ID}, Actual: ${remoteConfig.id}`);
        }
        if (this._remoteConfigLatestVersion !== INVALID_VERSION_NUMBER && remoteConfig.version !== this._remoteConfigLatestVersion) {
            throw new Error(`Remote configuration version mismatch. Expected: ${this._remoteConfigLatestVersion}, Actual: ${remoteConfig.version}`);
        }
        return remoteConfig;
    }

    addAdditionalFieldsToActivity(details, ctx, config) {
        if (ctx.additionalFields && ctx.additionalFields.loginCredentials) {
            const { loginCredentials } = ctx.additionalFields;
            details[CI_VERSION_FIELD] = loginCredentials.version;
            details[CI_CREDENTIALS_COMPROMISED_FIELD] = ctx.areCredentialsCompromised();
            if (loginCredentials.version === CIVersion.MULTISTEP_SSO) {
                details[CI_SSO_STEP_FIELD] = loginCredentials.ssoStep;
            }
        }

        if (ctx.graphqlData) {
            details[GQL_OPERATIONS_FIELD] = ctx.graphqlData;
        }

        if (ctx.jwt) {
            const { userID, additionalFields } = ctx.jwt;

            if (userID) {
                details[APP_USER_ID_FIELD_NAME] = userID;
            }

            if (additionalFields) {
                details[JWT_ADDITIONAL_FIELDS_FIELD_NAME] = additionalFields;
            }
        }

        if (config.remoteConfigVersion !== INVALID_VERSION_NUMBER) {
            details['px_remote_config_version'] = config.remoteConfigVersion;
        }

        details[HOST_NAME] = os.hostname();

        if (ctx.cts) {
            details[CROSS_TAB_SESSION] = ctx.cts;
        }
    }

    /**
     * sendToPerimeterX - batching the activities on the activities buffer and flash it if reached threshold
     *
     * @param {string} activityType - name of the activity
     * @param {object} details - activities details in key-val format
     * @param {object} ctx - request context
     * @param {object} config - perimeterx config
     */
    sendToPerimeterX(activityType, details, ctx, config) {
        if (activityType === ActivityType.PAGE_REQUESTED && !config.SEND_PAGE_ACTIVITIES) {
            return;
        }

        const activity = this.generateActivity(activityType, details, ctx, config);
        this.activitiesBuffer.push(activity);
    }

    sendEnforcerTelemetry(updateReason, config) {
        const details = {
            enforcer_configs: pxUtil.filterConfig(config),
            node_name: os.hostname(),
            os_name: os.platform(),
            update_reason: updateReason,
            module_version: config.MODULE_VERSION,
        };

        const pxData = {};
        pxData.type = ActivityType.ENFORCER_TELEMETRY;
        pxData.timestamp = Date.now();
        pxData.px_app_id = config.PX_APP_ID;
        pxData.details = details;

        config.logger.debug('Sending telemetry activity to perimeterx servers');

        this.callServer(pxData, config.TELEMETRY_URI, {}, config);
    }

    /**
     * submitActivities - flash activities buffer and send to px servers for processing
     *
     */
    submitActivities(config, cb) {
        if (this.activitiesBuffer.length > 0) {
            config.logger.debug('Sending activities to perimeterx servers');

            const tempActivities = this.activitiesBuffer.concat(); //duplicate
            this.activitiesBuffer.splice(0, tempActivities.length);
            this.callServer(tempActivities, config.SERVER_COLLECT_URI, {}, config, cb);
        }
    }

    createHeaders(config, additionalHeaders = {}) {
        return {
            Authorization: 'Bearer ' + config.AUTH_TOKEN,
            'Content-Type': 'application/json',
            ...additionalHeaders,
        };
    }

    generateAdditionalS2SActivity(ctx, config, additionalDetails = {}) {
        const { loginCredentials } = ctx.additionalFields;
        const details = {
            client_uuid: ctx.uuid,
            http_status_code: null,
            login_successful: null,
            [CI_CREDENTIALS_COMPROMISED_FIELD]: ctx.areCredentialsCompromised(),
            [CI_VERSION_FIELD]: loginCredentials && loginCredentials.version,
            [CI_RAW_USERNAME_FIELD]: loginCredentials && loginCredentials.rawUsername,
            [CI_SSO_STEP_FIELD]: loginCredentials && loginCredentials.ssoStep,
            ...additionalDetails,
        };

        if (!config.SEND_RAW_USERNAME_ON_ADDITIONAL_S2S_ACTIVITY || !details.credentials_compromised) {
            // purposefully not regarding login_successful since it may still be unknown
            delete details[CI_RAW_USERNAME_FIELD];
        }
        return this.generateActivity(ActivityType.ADDITIONAL_S2S, details, ctx, config);
    }

    callServer(data, path, additionalHeaders, config, cb) {
        pxHttpc.callServer(
            data,
            this.createHeaders(config, additionalHeaders),
            path,
            'activities',
            config,
            null,
            false,
        );
        if (cb) {
            cb();
        }
    }

    sendRemoteLog(message, severity, errorType, configParams) {
        let config;
        try {
            config = new PxConfig(configParams).conf;
            const reqHeaders = {
                'Authorization': 'Bearer ' + config.LOGGER_AUTH_TOKEN,
                'Content-Type': 'application/json',
            };
            const logParser = new PxExternalLogsParser( { appId: config.PX_APP_ID, remoteConfigId: config.REMOTE_CONFIG_ID, remoteConfigVersion: config.REMOTE_CONFIG_VERSION });
            const logs = [{ message, severity, errorType }];
            const enrichedLogs = logParser.enrichLogs(logs);
            pxHttpc.callServer(
                enrichedLogs,
                reqHeaders,
                EXTERNAL_LOGGER_SERVICE_PATH,
                'remote-log',
                config,
                null,
                false,
            );
            config.logger.debug(`successfully sent log of error type :: ${errorType} for appID :: ${config.px_app_id}`);
        } catch (e) {
            if (config.logger) {
                config.logger.error(`sendRemoteLog - unable to send logs :: ${e}`);
            }
        }
    }
}
module.exports = PxClient;
