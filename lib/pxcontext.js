const net = require('net');

class PxContext {

    constructor(config, request) {
        const userAgent = request.get('user-agent') || request.get('User-Agent') || 'none';
        const mobileSdkHeader = "x-px-authorization";

        this.cookies = {};
        this.score = 0;
        this.ip = PxContext.extractIP(config, request);
        this.headers = request.headers;
        this.hostname = request.hostname || request.get('host');
        this.userAgent = userAgent;
        this.uri = request.originalUrl || '/';
        this.fullUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
        this.httpVersion = request.httpVersion || '';
        this.httpMethod = request.method || '';
        this.sensitiveRoute = this.checkSensitiveRoute(config.SENSITIVE_ROUTES, this.uri);
        this.cookieOrigin = "cookie";

        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader) {
            this.cookieOrigin = "header";
            let explodedTokenObject = this.explodeCookieToVersion(":", mobileHeader);
            this.cookies[explodedTokenObject.key] = explodedTokenObject.value;
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

    explodeCookieToVersion(delimiter, cookie) {
        if (cookie.indexOf(delimiter) > -1) {
            let cookieArray = cookie.split(delimiter);
            if (cookieArray[0] === "3" || cookieArray[0] === "_px3") {
                return {key:"_px3", value: this.rebuildCookie(cookieArray, delimiter)};
            }
            if (cookieArray[0] === "1" || cookieArray[0] === "_px") {
                return {key:"_px", value: this.rebuildCookie(cookieArray, delimiter)};
            }
            if (cookieArray[0] === "_pxCaptcha") {
                return {key: "pxCaptcha", value: this.rebuildCookie(cookieArray, delimiter)};
            }
        } else {
            return {key:"_px3", value: cookie};
        }
    }
    rebuildCookie(cookieArray, delimiter) {
        let splittedCookie = cookieArray.splice(0,2);
        splittedCookie.push(cookieArray.join(delimiter));
        splittedCookie.splice(0,1);
        return splittedCookie.join(delimiter);
    }
}

module.exports = PxContext;