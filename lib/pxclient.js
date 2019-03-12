'use strict';
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');
const os = require('os');
class PxClient {
    constructor() {
        this.activitiesBuffer = [];
    }

    init() {
        //stub for overriding
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
        if (activityType === 'page_requested' && !config.SEND_PAGE_ACTIVITIES) {
            return;
        }

        details['cookie_origin'] = ctx.cookieOrigin;
        details['module_version'] = config.MODULE_VERSION;
        if (ctx.blockAction && activityType === 'block') {
            details['block_action'] = ctx.blockAction;
        }

        const pxData = {};
        pxData.type = activityType;
        pxData.headers = ctx.headers;
        pxData.timestamp = Date.now();
        pxData.socket_ip = ctx.ip;
        pxData.px_app_id = config.PX_APP_ID;
        pxData.url = ctx.fullUrl;
        if (ctx.vid) {
            pxData.vid = ctx.vid;
        }
        if (ctx.pxhd && (activityType === 'page_requested') || activityType === 'block') {
            pxData.pxhd = ctx.pxhd;
            pxUtil.prepareCustomParams(config, details);
        }
        pxData.details = details;

        this.activitiesBuffer.push(pxData);
    }

    sendEnforcerTelemetry(updateReason, config) {
        const headers = {
            'Authorization': 'Bearer ' + config.AUTH_TOKEN,
            'Content-Type': 'application/json'
        };

        const details = {
            'enforcer_configs': pxUtil.filterConfig(config),
            'node_name': os.hostname(),
            'os_name': os.platform(),
            'update_reason': updateReason,
            'module_version': config.MODULE_VERSION
        };

        const pxData = {};
        pxData.type = 'enforcer_telemetry';
        pxData.timestamp = Date.now();
        pxData.px_app_id = config.PX_APP_ID;
        pxData.details = details;

        config.logger.debug('Sending telemetry activity to perimeterx servers');

        this.callServer(pxData, config.TELEMETRY_URI, headers, config);
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
