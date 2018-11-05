const net = require('net');
const pxLogger = require('./pxlogger');
const pxUtil = require('./pxutil');

class PxContext {

    constructor(config, request) {
        const userAgent = request.get('user-agent') || request.get('User-Agent') || 'none';
        const mobileSdkHeader = 'x-px-authorization';
        const mobileSdkOriginalTokenHeader = 'x-px-original-token';

        this.cookies = {};
        this.score = 0;
        this.ip = PxContext.extractIP(config, request);
        if (request.headers['cookie']) {
            const cookies = request.headers['cookie'].split(';');
            this.requestCookieNames = pxUtil.extractCookieNames(cookies);
            this.pxhd = pxUtil.extractCookieValue('_pxhd', cookies);
            this.vid = pxUtil.extractCookieValue('_pxvid', cookies);
            this.vidSource = 'vid_cookie';
        }
        this.headers = pxUtil.filterSensitiveHeaders(request.headers);
        this.hostname = request.hostname || request.get('host');
        this.userAgent = userAgent;
        this.uri = request.originalUrl || '/';
        this.fullUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
        this.httpVersion = request.httpVersion || '';
        this.httpMethod = request.method || '';
        this.sensitiveRoute = this.isSpecialRoute(config.SENSITIVE_ROUTES, this.uri);
        this.whitelistRoute = this.isSpecialRoute(config.WHITELIST_ROUTES, this.uri);
        this.cookieOrigin = 'cookie';
        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader !== undefined) {
            this.cookieOrigin = 'header';
            pxLogger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            const tokenObject = this.getTokenObject(mobileHeader);
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
                try {
                    const headerValue = request.get(ipHeader);
                    if (headerValue) {
                        ip = headerValue;
                        return true;
                    }
                } catch (e) {
                    pxLogger.debug('Failed to use IP_HEADERS from config.');
                }
            });
        } else {
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
     * isSpecialRoute - checks whether or not the current uri is part of the routes collection passed.
     * @param {array} routes - array of routes defined by the user
     * @param {string} uri - current uri, taken from request
     *
     * @return {boolean} flag special route as true/false.
     */
    isSpecialRoute(routes, uri) {
        return routes.some(route => uri.startsWith(route));
    }

    getTokenObject(cookie, delimiter = ':') {
        if (cookie.indexOf(delimiter) > -1) {
            const [version, ...extractedCookie] = cookie.split(delimiter);
            if (version === '3') {
                return {key: '_px3', value: extractedCookie.join(delimiter)};
            }
            if (version === '1') {
                return {key: '_px', value: extractedCookie.join(delimiter)};
            }
        }
        return {key: '_px3', value: cookie};
    }

    isMobile() {
        return (this.cookieOrigin === 'header');
    }
}

module.exports = PxContext;
