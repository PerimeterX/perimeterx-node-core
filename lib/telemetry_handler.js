const crypto = require('crypto');
const PxLogger = require('./pxlogger');

module.exports = {
    isTelemetryCommand
};

function isTelemetryCommand(req, config) {

    const logger = new PxLogger();
    const headerVal = req.headers[config.TELEMETRY_COMMAND_HEADER];

    if(!headerVal) {
        return false;
    }

    logger.debug('Received command to send enforcer telemetry');

    // base 64 decode
    const decodedString = Buffer.from(headerVal, 'base64').toString();

    // value is in the form of timestamp:hmac_val
    const splittedValue = decodedString.split(':');

    if(splittedValue.length !== 2) {
        logger.debug('Malformed header value - ${config.TELEMETRY_COMMAND_HEADER} = ${headerVal}');
        return false;
    }

    const [timestamp, hmac] = splittedValue;

    // timestamp
    if(Number(timestamp) < new Date().getTime()) {
        logger.debug('Telemetry command has expired');
        return false;
    }

    // check hmac integrity
    const hmacCreator = crypto.createHmac('sha256', config.COOKIE_SECRET_KEY);
    hmacCreator.setEncoding('hex');
    hmacCreator.write(timestamp);
    hmacCreator.end();
    const generatedHmac = hmacCreator.read();

    if (generatedHmac !== hmac) {
        logger.debug('hmac validation failed. original = ${hmac}, generated = ${generatedHmac}');
        return false;
    }

    return true;
}

