'use strict';
const pxLogger = require('./pxlogger');
const pxConfig = require('./pxconfig');
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
     * @param {object} pxCtx - request context
     */
    sendToPerimeterX(activityType, details, pxCtx) {
        const config = pxConfig.conf;
        if (activityType === 'page_requested' && !config.SEND_PAGE_ACTIVITIES) {
            return;
        }

        details['cookie_origin'] = pxCtx.cookieOrigin;
        details['module_version'] = config.MODULE_VERSION;

        const pxData = {};
        pxData.type = activityType;
        pxData.headers = pxCtx.headers;
        pxData.timestamp = Date.now();
        pxData.socket_ip = pxCtx.ip;
        pxData.px_app_id = config.PX_APP_ID;
        pxData.url = pxCtx.fullUrl;
        if (pxCtx.vid) {
            pxData.vid = pxCtx.vid;
        }
        pxData.details = details;

        this.activitiesBuffer.push(pxData);
    }

    sendEnforcerTelemetry(updateReason) {
        const config = pxConfig.conf;
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

        pxLogger.debug('Sending telemetry activity to perimeterx servers');

        this.callServer(pxData, pxConfig.conf.TELEMETRY_URI, headers);
    }

    /**
     * submitActivities - flash activities buffer and send to px servers for processing
     *
     */
    submitActivities(cb) {
        if (this.activitiesBuffer.length > 0) {
            const headers = {
                'Content-Type': 'application/json'
            };

            pxLogger.debug('Sending activities to perimeterx servers');

            const tempActivities = this.activitiesBuffer.concat(); //duplicate
            this.activitiesBuffer.splice(0, tempActivities.length);
            this.callServer(tempActivities, pxConfig.conf.SERVER_COLLECT_URI, headers, cb);
        }
    }

    callServer(data, path, headers, cb) {
        pxHttpc.callServer(data, headers, path, 'activities');
        if (cb) {
            cb();
        }
    }
}
module.exports = PxClient;
