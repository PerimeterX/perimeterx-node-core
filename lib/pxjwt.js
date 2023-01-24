const { TOKEN_SEPARATOR } = require('./utils/constants');

function getJWTDecodedData(pxConfig, token) {
    try {
        const encodedPayload = token.split(TOKEN_SEPARATOR)[1];
        if (encodedPayload) {
            const base64 = encodedPayload.replace('-', '+').replace('_', '/');
            const data = Buffer.from(base64, 'base64').toString();
            return JSON.parse(data);
        }
    } catch (e) {
        pxConfig.logger.debug(`Failed to parse JWT token ${token}: ${e.message} `);
    }

    return null;
}

function extractJWTData(pxConfig, token) {
    let additionalFields = null;
    const data = getJWTDecodedData(pxConfig, token);

    try {
        if (data) {
            const userFieldName = pxConfig.JWT_COOKIE_USER_ID_FIELD_NAME || pxConfig.JWT_HEADER_USER_ID_FIELD_NAME;
            const userID = data[userFieldName];

            const additionalFieldsConfig =
                pxConfig.JWT_COOKIE_ADDITIONAL_FIELD_NAMES.length > 0
                    ? pxConfig.JWT_COOKIE_ADDITIONAL_FIELD_NAMES
                    : pxConfig.JWT_HEADER_ADDITIONAL_FIELD_NAMES;

            if (additionalFieldsConfig && additionalFieldsConfig.length > 0) {
                additionalFields = additionalFieldsConfig.reduce((matchedFields, fieldName) => {
                    if (data[fieldName]) {
                        matchedFields[fieldName] = data[fieldName];
                    }
                    return matchedFields;
                }, {});
            }

            return { userID, additionalFields };
        }
    } catch (e) {
        pxConfig.logger.debug(`Failed to extract JWT token ${token}: ${e.message} `);
    }

    return null;
}

module.exports = {
    extractJWTData,
};
