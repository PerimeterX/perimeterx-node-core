const { TOKEN_SEPARATOR } = require('./utils/constants');

function getJWTPayload(pxConfig, token) {
    try {
        const encodedPayload = token.split(TOKEN_SEPARATOR)[1];
        if (encodedPayload) {
            const base64Payload = encodedPayload.replace('-', '+').replace('_', '/');
            const payload = Buffer.from(base64Payload, 'base64').toString();
            return JSON.parse(payload);
        }
    } catch (e) {
        pxConfig.logger.debug(`Failed to parse JWT token ${token}: ${e.message} `);
    }

    return null;
}

function getJWTData(pxConfig, payload) {
    let additionalFields = null;

    try {
        const userFieldName = pxConfig.JWT_COOKIE_USER_ID_FIELD_NAME || pxConfig.JWT_HEADER_USER_ID_FIELD_NAME;
        const userID = payload[userFieldName];

        const additionalFieldsConfig =
            pxConfig.JWT_COOKIE_ADDITIONAL_FIELD_NAMES.length > 0
                ? pxConfig.JWT_COOKIE_ADDITIONAL_FIELD_NAMES
                : pxConfig.JWT_HEADER_ADDITIONAL_FIELD_NAMES;

        if (additionalFieldsConfig && additionalFieldsConfig.length > 0) {
            additionalFields = additionalFieldsConfig.reduce((matchedFields, fieldName) => {
                if (payload[fieldName]) {
                    matchedFields[fieldName] = payload[fieldName];
                }
                return matchedFields;
            }, {});
        }

        return { userID, additionalFields };
    } catch (e) {
        pxConfig.logger.debug(`Failed to extract JWT token ${payload}: ${e.message} `);
    }

    return null;
}

function extractJWTData(pxConfig, token) {
    const payload = getJWTPayload(pxConfig, token);

    if (!payload) {
        return null;
    }

    return getJWTData(pxConfig, payload);
}

module.exports = {
    extractJWTData,
};
