const { v4: uuidv4 } = require('uuid');

const { CookieOrigin } = require('./enums/CookieOrigin');
const pxUtil = require('./pxutil');
const pxJWT = require('./pxjwt');
const constants = require('./utils/constants');

class PxContext {
    constructor(config, req, additionalFields) {
        const userAgent = req.get('user-agent') || req.get('User-Agent') || 'none';
        const mobileSdkHeader = 'x-px-authorization';
        const mobileSdkOriginalTokenHeader = 'x-px-original-token';
        const vidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        this.enforcerStartTime = Date.now();
        this.cookies = {};
        this.score = 0;
        this.ip = pxUtil.extractIP(config, req);
        this.requestId = uuidv4();
        this.headers = pxUtil.filterSensitiveHeaders(req.headers, config.SENSITIVE_HEADERS);
        this.hostname = req.hostname || req.get('host');
        this.userAgent = userAgent;
        this.uri = req.originalUrl || '/';
        this.rawUrl = req.originalFullUrl;
        this.isRawUrlDifferentFromNormalizedUrl = req.originalFullUrl !== req.requestNormalizedUrl;
        this.fullUrl = req.requestNormalizedUrl;
        this.originalRequest = req.originalRequest || req;
        this.httpVersion = req.httpVersion || '';
        this.httpMethod = req.method || '';
        this.sensitiveRequest = () => this.isSensitiveRequest(req, config);
        this.enforcedRoute = this.isSpecialRoute(config.ENFORCED_ROUTES, this.uri);
        this.whitelistRoute = this.isSpecialRoute(config.WHITELIST_ROUTES, this.uri);
        this.monitoredRoute = !this.enforcedRoute && this.isSpecialRoute(config.MONITORED_ROUTES, this.uri);
        this.shouldBypassMonitor = config.BYPASS_MONITOR_HEADER && req.headers[config.BYPASS_MONITOR_HEADER] === '1';
        this.cookieOrigin = CookieOrigin.COOKIE;
        this.additionalFields = additionalFields || {};
        this.signedFields = [this.userAgent];

        const mobileHeader = this.headers[mobileSdkHeader];
        if (mobileHeader !== undefined) {
            this.signedFields = null;
            this.cookieOrigin = CookieOrigin.HEADER;
            config.logger.debug('Mobile SDK token detected');
            this.originalToken = this.headers[mobileSdkOriginalTokenHeader];
            const tokenObject = pxUtil.getTokenObject(mobileHeader);
            this.cookies[tokenObject.key] = tokenObject.value;
        } else {
            let cookies = req.cookies;
            if (config.CUSTOM_COOKIE_HEADER && req.headers[config.CUSTOM_COOKIE_HEADER]) {
                const customCookies = pxUtil.parseCookieHeader(req.headers[config.CUSTOM_COOKIE_HEADER]);
                if (customCookies) {
                    const customCookieString = JSON.stringify(customCookies);
                    const cookiesHeaderString = JSON.stringify(cookies);
                    const cookiesString = [cookiesHeaderString, customCookieString].filter(Boolean).join(constants.COOKIE_SEPARATOR);
                    cookies = this.cookieStringToUniqueObject(cookiesString);
                }
            }

            this.requestCookieNames = Object.keys(cookies);
            Object.keys(cookies).forEach((key) => {
                if (key === '_pxhd') {
                    this.pxhdClient = cookies[key];
                } else if ((key === '_pxvid' || key === 'pxvid') && vidRegex.test(cookies[key])) {
                    this.vid = cookies[key];
                    this.vidSource = 'vid_cookie';
                } else if (key === 'pxcts') {
                    this.cts = cookies[key];
                } else if (key.match(/^_px.+$/)) {
                    this.cookies[key] = cookies[key];
                }
            });
        }
        if (pxUtil.isGraphql(req, config)) {
            config.logger.debug('Graphql route detected');
            this.graphqlData = this.getGraphqlDataFromBody(req.body)
                .filter((x) => x)
                .map(
                    (operation) =>
                        operation && {
                            ...operation,
                            sensitive: pxUtil.isSensitiveGraphqlOperation(operation, config),
                        },
                );
            this.sensitiveGraphqlOperation = this.graphqlData.some((operation) => operation && operation.sensitive);
        }
        if (process.env.AWS_REGION) {
            this.serverInfoRegion = process.env.AWS_REGION;
        }

        if (config.JWT_COOKIE_NAME || config.JWT_HEADER_NAME) {
            const token = req.cookies[config.JWT_COOKIE_NAME] || req.headers[config.JWT_HEADER_NAME];
            if (token) {
                this.jwt = pxJWT.extractJWTData(config, token);
            }
        }
    }

    isSensitiveRequest(request, config) {
        return this.isSpecialRoute(config.SENSITIVE_ROUTES, this.uri) ||
            this.isCustomSensitiveRequest(request, config);
    }

    isCustomSensitiveRequest(request, config) {
        const customIsSensitiveRequest = config.CUSTOM_IS_SENSITIVE_REQUEST;
        try {
            if (customIsSensitiveRequest && customIsSensitiveRequest(request)) {
                config.logger.debug('Custom sensitive request matched');
                return true;
            }
        } catch (err) {
            config.logger.debug(`Caught exception on custom sensitive request function: ${err}`);
        }

        return false;
    }

    getGraphqlDataFromBody(body) {
        let jsonBody = null;
        if (typeof body === 'string') {
            jsonBody = pxUtil.tryOrNull(() => JSON.parse(body));
        } else if (typeof body === 'object') {
            jsonBody = body;
        }
        return Array.isArray(jsonBody) ? jsonBody.map(pxUtil.getGraphqlData) : [pxUtil.getGraphqlData(jsonBody)];
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

    areCredentialsCompromised() {
        // eslint-disable-next-line eqeqeq
        return (this.pxde && this.pxde['breached_account'] && this.pxdeVerified) != null;
    }

    cookieStringToUniqueObject(cookiesString) {
        if (!cookiesString) {
            return {};
        }
        const mergedString = this.mergeCookieStrings(cookiesString);
        return Object.assign({}, ...Object.entries(JSON.parse(mergedString)).map(([key, value]) => ({ [key]: value })));
    }

    mergeCookieStrings(cookieString) {
        const [cookiesHeader, customCookies] = cookieString.split(constants.COOKIE_SEPARATOR).map(JSON.parse);
        return JSON.stringify({ ...cookiesHeader, ...customCookies });
    }
}

module.exports = PxContext;
