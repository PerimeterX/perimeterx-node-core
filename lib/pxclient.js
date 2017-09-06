'use strict';
const pxLogger = require('./pxlogger');
const pxConfig = require('./pxconfig');
const pxUtil = require('./pxutil');
const pxHttpc = require('./pxhttpc');

module.exports = {
    sendToPerimeterX,
    submitActivities
};

let activitiesBuffer = [];

/**
 * sendToPerimeterX - batching the activities on the activities buffer and flash it if reached threshold
 *
 * @param {string} activityType - name of the activity
 * @param {object} details - activities details in key-val format
 * @param {object} pxCtx - request context
 */
function sendToPerimeterX(activityType, details, pxCtx) {
    const config = pxConfig.conf;
    if (activityType === 'page_requested' && !config.SEND_PAGE_ACTIVITIES) {
        return;
    }

    const pxData = {};
    pxData.type = activityType;
    pxData.headers = pxUtil.filterSensitiveHeaders(pxCtx.headers);
    pxData.timestamp = Date.now();
    pxData.socket_ip = pxCtx.ip;
    pxData.px_app_id = config.PX_APP_ID;
    pxData.url = pxCtx.fullUrl;
    if (pxCtx.vid) {
        pxData.vid = pxCtx.vid;
    }
    pxData.details = details;

    activitiesBuffer.push(pxData);
}

/**
 * submitActivities - flash activities buffer and send to px servers for processing
 *
 */
function submitActivities() {
    if (activitiesBuffer.length > 0) {
        pxLogger.debug('Sending activities to perimeterx servers');

        const tempActivities = activitiesBuffer.concat(); //duplicate
        activitiesBuffer.splice(0, tempActivities.length);
        const headers = {
            'Content-Type': 'application/json'
        };
        pxHttpc.callServer(tempActivities, headers, pxConfig.conf.SERVER_COLLECT_URI, 'activities', (err) => {
            if (err) {
                pxLogger.error(`failed to post activities to perimeterx servers`);
            }
        });
    }
}
