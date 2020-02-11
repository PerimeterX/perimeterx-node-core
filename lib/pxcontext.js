const pxUtil = require('./pxutil');

class PxContext {
    constructor(config, req) {
        const userAgent = req.get('user-agent') || req.get('User-Agent') || 'none';
        const mobileSdkHeader = 'x-px-authorization';
        const mobileSdkOriginalTokenHeader = 'x-px-original-token';
        const vidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

        this.cookies = {};
        this.score = 0;
        this.ip = pxUtil.extractIP(config, req);

        this.headers = pxUtil.filterSensitiveHeaders(req.headers, config.SENSITIVE_HEADERS);
        this.hostname = req.hostname || req.get('host');
        this.userAgent = userAgent;
        this.uri = req.originalUrl || '/';
        this.fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        this.originalRequest = req.originalRequest || req;
        this.httpVersion = req.httpVersion || '';
        this.httpMethod = req.method || '';
        this.sensitiveRoute = this.isSpecialRoute(config.SENSITIVE_ROUTES, this.uri);
        this.enforcedRoute = this.isSpecialRoute(config.ENFORCED_ROUTES, this.uri);
        this.whitelistRoute = this.isSpecialRoute(config.WHITELIST_ROUTES, this.uri);
        this.monitoredRoute = !this.enforcedRoute && this.isSpecialRoute(config.MONITORED_ROUTES, this.uri);
        this.cookieOrigin = 'cookie';
        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader !== undefined) {
            this.cookieOrigin = 'header';
            config.logger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            const tokenObject = this.getTokenObject(mobileHeader);
            this.cookies[tokenObject.key] = tokenObject.value;
        } else {
            this.requestCookieNames = Object.keys(req.cookies);
            Object.keys(req.cookies).forEach(key => {
                if (key.match(/^_px\d?$/)) {
                    this.cookies[key] = req.cookies[key];
                } else if (key === '_pxhd') {
                    this.pxhdClient = req.cookies[key];
                } else if ((key === '_pxvid' || key === 'pxvid') && vidRegex.test(req.cookies[key])) {
                    this.vid = req.cookies[key];
                    this.vidSource = 'vid_cookie';
                }
            });
        }
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
        return Array.isArray(routes) ? routes.some(route => this.verifyRoute(route, uri)) : false;
    }

    verifyRoute(pattern, uri) {
        if (pattern instanceof RegExp && uri.match(pattern)) {
            return true;
        }
        if (typeof pattern === 'string' && uri.startsWith(pattern)) {
            return true;
        }
        return false;
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
