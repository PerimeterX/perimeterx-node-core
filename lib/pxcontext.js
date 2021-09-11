const { CookieOrigin } = require('./enums/CookieOrigin');
const pxUtil = require('./pxutil');

class PxContext {
    constructor(pxConfig, req, additionalFields) {
        const config = pxConfig.Config;
        const userAgent = req.get('user-agent') || req.get('User-Agent') || 'none';
        const mobileSdkHeader = 'x-px-authorization';
        const mobileSdkOriginalTokenHeader = 'x-px-original-token';
        const vidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

        this.cookies = {};
        this.score = 0;
        this.ip = pxUtil.extractIP(req, config.px_ip_headers, config.px_extract_user_ip );

        this.headers = pxUtil.filterSensitiveHeaders(req.headers, config.px_sensitive_headers);
        this.hostname = req.hostname || req.get('host');
        this.userAgent = userAgent;
        this.uri = req.originalUrl || '/';
        this.fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        this.originalRequest = req.originalRequest || req;
        this.httpVersion = req.httpVersion || '';
        this.httpMethod = req.method || '';
        this.sensitiveRoute = this.isSpecialRoute(config.px_sensitive_routes, this.uri);
        this.enforcedRoute = this.isSpecialRoute(config.px_enforced_routes, this.uri);
        this.whitelistRoute = this.isSpecialRoute(config.px_filter_by_route, this.uri);
        this.monitoredRoute = !this.enforcedRoute && this.isSpecialRoute(config.px_monitored_routes, this.uri);
        this.shouldBypassMonitor = config.px_bypass_monitor_header && req.headers[config.px_bypass_monitor_header] === '1';
        this.cookieOrigin = CookieOrigin.COOKIE;
        this.additionalFields = additionalFields || {};
        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader !== undefined) {
            this.cookieOrigin = CookieOrigin.HEADER;
            pxConfig.Logger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            const tokenObject = pxUtil.getTokenObject(mobileHeader);
            this.cookies[tokenObject.key] = tokenObject.value;
        } else {
            let cookies = req.cookies;
            if (config.px_custom_cookie_header && req.headers[config.px_custom_cookie_header]) {
                cookies = pxUtil.parseCookieHeader(req.headers[config.px_custom_cookie_header]);
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
        return this.cookieOrigin === CookieOrigin.HEADER;
    }
}

module.exports = PxContext;
