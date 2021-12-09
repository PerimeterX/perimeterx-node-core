const pxUtil = require('./pxutil');

class PxContext {
    constructor(config, req, additionalFields) {
        const userAgent = req.get('user-agent') || req.get('User-Agent') || 'none';
        const mobileSdkHeader = 'x-px-authorization';
        const mobileSdkOriginalTokenHeader = 'x-px-original-token';
        const vidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

        this.cookies = {};
        this.score = 0;
        this.ip = pxUtil.extractIP(config, req);

        this.riskRttLogs = "";

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
        this.shouldBypassMonitor = config.BYPASS_MONITOR_HEADER && req.headers[config.BYPASS_MONITOR_HEADER] === '1';
        this.cookieOrigin = 'cookie';
        this.additionalFields = additionalFields || {};
        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader !== undefined) {
            this.cookieOrigin = 'header';
            config.logger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            const tokenObject = pxUtil.getTokenObject(mobileHeader);
            this.cookies[tokenObject.key] = tokenObject.value;
        } else {
            let cookies = req.cookies;
            if (config.CUSTOM_COOKIE_HEADER && req.headers[config.CUSTOM_COOKIE_HEADER]) {
                cookies = pxUtil.parseCookieHeader(req.headers[config.CUSTOM_COOKIE_HEADER]);
            }

            this.requestCookieNames = Object.keys(cookies);
            Object.keys(cookies).forEach((key) => {
                if (key === '_pxhd') {
                    this.pxhdClient = cookies[key];
                } else if ((key === '_pxvid' || key === 'pxvid') && vidRegex.test(cookies[key])) {
                    this.vid = cookies[key];
                    this.vidSource = 'vid_cookie';
                } else if (key.match(/^_px.+$/)) {
                    this.cookies[key] = cookies[key];
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
        return Array.isArray(routes) ? routes.some((route) => this.verifyRoute(route, uri)) : false;
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

    isMobile() {
        return this.cookieOrigin === 'header';
    }
}

module.exports = PxContext;
