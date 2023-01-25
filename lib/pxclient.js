'use strict';
const os = require('os');
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');
const { ActivityType } = require('./enums/ActivityType');
const { CIVersion } = require('./enums/CIVersion');
const {
    CI_VERSION_FIELD,
    CI_SSO_STEP_FIELD,
    CI_RAW_USERNAME_FIELD,
    CI_CREDENTIALS_COMPROMISED_FIELD,
    GQL_OPERATIONS_FIELD,
    APP_USER_ID_FIELD_NAME,
    JWT_ADDITIONAL_FIELDS_FIELD_NAME,
    CROSS_TAB_SESSION,
} = require('./utils/constants');

class PxClient {
    constructor() {
        this.activitiesBuffer = [];
    }

    init() {
        //stub for overriding
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

        this.addAdditionalFieldsToActivity(details, ctx);
        if (activityType !== ActivityType.ADDITIONAL_S2S) {
            activity.headers = ctx.headers;
            activity.pxhd = ctx.pxhdClient ? ctx.pxhdClient : undefined;
            pxUtil.prepareCustomParams(config, details, ctx.originalRequest);
        }

        activity.details = details;
        return activity;
    }

    addAdditionalFieldsToActivity(details, ctx) {
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
        pxHttpc.callServer(data, this.createHeaders(config, additionalHeaders), path, 'activities', config);
        if (cb) {
            cb();
        }
    }
}
module.exports = PxClient;
