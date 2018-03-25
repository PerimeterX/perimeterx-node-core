const net = require('net');
const pxLogger = require('./pxlogger');
const pxUtil = require('./pxutil');

class PxContext {

    constructor(config, request) {
        const userAgent = request.get('user-agent') || request.get('User-Agent') || 'none';
        const mobileSdkHeader = "x-px-authorization";
        const mobileSdkOriginalTokenHeader = "x-px-original-token";

        this.cookies = {};
        this.score = 0;
        this.ip = PxContext.extractIP(config, request);
        this.headers = pxUtil.filterSensitiveHeaders(request.headers);
        this.hostname = request.hostname || request.get('host');
        this.userAgent = userAgent;
        this.uri = request.originalUrl || '/';
        this.fullUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
        this.httpVersion = request.httpVersion || '';
        this.httpMethod = request.method || '';
        this.sensitiveRoute = this.checkSensitiveRoute(config.SENSITIVE_ROUTES, this.uri);
        this.cookieOrigin = "cookie";

        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader != undefined) {
            this.cookieOrigin = "header";
            pxLogger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            let tokenObject = this.getTokenObject(mobileHeader);
            this.cookies[tokenObject.key] = tokenObject.value;
        } else {
            Object.keys(request.cookies).forEach(key => {
                if (key.match(/^_px\d?$/)) {
                    this.cookies[key] = request.cookies[key];
                }
            });
        }
    }

    static extractIP(config, request) {
        let ip;
        if (Array.isArray(config.IP_HEADERS)) {
            config.IP_HEADERS.some(ipHeader => {
                let headerValue = request.get(ipHeader);
                if (headerValue) {
                    ip = headerValue;
                    return true;
                }
            });
        }
        else {
            ip = typeof config.GET_USER_IP === 'function' && config.GET_USER_IP(request);
        }
        if (ip && net.isIP(ip) > 0) {
            return ip;
        }
        return request.ip;
    }

    getCookie() {
        return this.cookies['_px3'] ? this.cookies['_px3'] : this.cookies['_px'];
    }

    /**
     * checkSensitiveRoute - checks whether or not the current uri is a sensitive_route.
     * @param {array} sensitiveRoutes - array of sensitive routes defined by the user, default value in pxconfig: []
     * @param {string} uri - current uri, taken from request
     *
     * @return {boolean} flag sensitive_route true/false.
     */
    checkSensitiveRoute(sensitiveRoutes, uri) {
        return sensitiveRoutes.some(sensitiveRoute => uri.startsWith(sensitiveRoute) );
    }

    getTokenObject(cookie, delimiter = ":") {
        if (cookie.indexOf(delimiter) > -1) {
            let [version, ...extractedCookie] = cookie.split(delimiter);
            if (version === "3") {
                return {key:"_px3", value: extractedCookie.join(delimiter)};
            }
            if (version === "1") {
                return {key:"_px", value: extractedCookie.join(delimiter)};
            }
        }
        return {key:"_px3", value: cookie};
    }
}

module.exports = PxContext;
