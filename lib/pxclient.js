'use strict';
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');
const os = require('os');

const { TELEMETRY_URI } = require('./utils/constants');

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
     * @param  {object} pxConfig - perimeterx config
     * @return {object} JSON representing the activity.
     */
    generateActivity(activityType, details, ctx, pxConfig) {
        const config = pxConfig.Config;

        details['cookie_origin'] = ctx.cookieOrigin;
        details['module_version'] = pxConfig.ModuleVersion;
        details['http_method'] = ctx.httpMethod;
        if (ctx.blockAction && activityType === 'block') {
            details['block_action'] = ctx.blockAction;
        }

        const pxData = {};
        pxData.type = activityType;
        pxData.headers = ctx.headers;
        pxData.timestamp = Date.now();
        pxData.socket_ip = ctx.ip;
        pxData.px_app_id = config.px_app_id;
        pxData.url = ctx.fullUrl;
        if (ctx.vid) {
            pxData.vid = ctx.vid;
        }
        if (ctx.pxhdClient && (activityType === 'page_requested' || activityType === 'block')) {
            pxData.pxhd = ctx.pxhdClient;
        }

        pxUtil.prepareCustomParams(config, details, ctx.originalRequest);
        pxData.details = details;

        return pxData;
    }

    /**
     * sendToPerimeterX - batching the activities on the activities buffer and flash it if reached threshold
     *
     * @param {string} activityType - name of the activity
     * @param {object} details - activities details in key-val format
     * @param {object} ctx - request context
     * @param {object} config - perimeterx config
     */
    sendToPerimeterX(activityType, details, ctx, pxConfig) {
        if (activityType === 'page_requested' && !pxConfig.Config.px_send_async_activities) {
            return;
        }

        const activity = this.generateActivity(activityType, details, ctx, pxConfig);
        this.activitiesBuffer.push(activity);
    }

    sendEnforcerTelemetry(updateReason, pxConfig) {
        const headers = {
            'Authorization': 'Bearer ' + pxConfig.Config.px_auth_token,
            'Content-Type': 'application/json'
        };

        const details = {
            'enforcer_configs': pxConfig.Config,
            'node_name': os.hostname(),
            'os_name': os.platform(),
            'update_reason': updateReason,
            'module_version': pxConfig.ModuleVersion
        };

        const pxData = {};
        pxData.type = 'enforcer_telemetry';
        pxData.timestamp = Date.now();
        pxData.px_app_id = pxConfig.Config.px_app_id;
        pxData.details = details;

        pxConfig.Logger.debug('Sending telemetry activity to perimeterx servers');

        this.callServer(pxData, TELEMETRY_URI, headers, pxConfig);
    }

    /**
     * submitActivities - flash activities buffer and send to px servers for processing
     *
     */
    submitActivities(config, cb) {
        if (this.activitiesBuffer.length > 0) {
            const headers = {
                'Content-Type': 'application/json'
            };

            config.logger.debug('Sending activities to perimeterx servers');

            const tempActivities = this.activitiesBuffer.concat(); //duplicate
            this.activitiesBuffer.splice(0, tempActivities.length);
            this.callServer(tempActivities, config.SERVER_COLLECT_URI, headers, config, cb);
        }
    }

    callServer(data, path, headers, config, cb) {
        pxHttpc.callServer(data, headers, path, 'activities', config);
        if (cb) {
            cb();
        }
    }
}
module.exports = PxClient;
