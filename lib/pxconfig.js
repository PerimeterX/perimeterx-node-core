'use strict';
const ConfigLoader = require('./configloader');
const TestModeRequestHandler = require('./pxtesthandler');
const HttpsProxyAgent = require('https-proxy-agent');
let config = {};
let configLoader = null;
const PX_DEFAULT = {};
const PX_INTERNAL = {};

PX_INTERNAL.MODULE_VERSION = 'NodeJS Module';
/* internal configurations */
PX_INTERNAL.SERVER_HOST = 'sapi.perimeterx.net';
PX_INTERNAL.COLLECTOR_HOST = 'collector.perimeterx.net';
PX_INTERNAL.CAPTCHA_HOST = 'captcha.px-cdn.net';
PX_INTERNAL.CLIENT_HOST = 'client.perimeterx.net';
PX_INTERNAL.CONFIGURATIONS_HOST = 'px-conf.perimeterx.net';
PX_INTERNAL.SERVER_TO_SERVER_API_URI = '/api/v3/risk';
PX_INTERNAL.SERVER_CAPTCHA_URI = '/api/v2/risk/captcha';
PX_INTERNAL.SERVER_COLLECT_URI = '/api/v1/collector/s2s';
PX_INTERNAL.CONFIGURATIONS_URI = '/api/v1/enforcer';
PX_INTERNAL.TELEMETRY_URI = '/api/v2/risk/telemetry';
PX_INTERNAL.ENFORCER_TRUE_IP_HEADER = 'x-px-enforcer-true-ip';
PX_INTERNAL.FIRST_PARTY_HEADER = 'x-px-first-party';
PX_INTERNAL.FORWARDED_FOR_HEADER = 'x-forwarded-for';
PX_INTERNAL.FIRST_PARTY_VENDOR_PATH = '/init.js';
PX_INTERNAL.FIRST_PARTY_XHR_PATH = '/xhr';
PX_INTERNAL.FIRST_PARTY_CAPTCHA_PATH = '/captcha';
PX_INTERNAL.EMPTY_GIF_B64 = 'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

// Cookie encryption configurations
PX_INTERNAL.COOKIE_ENCRYPTION = true;
PX_INTERNAL.CE_KEYLEN = 32;
PX_INTERNAL.CE_IVLEN = 16;
PX_INTERNAL.CE_ITERATIONS = 1000;
PX_INTERNAL.CE_DIGEST = 'sha256';
PX_INTERNAL.CE_ALGO = 'aes-256-cbc';

PX_INTERNAL.STATIC_FILES_EXT = ['.css', '.bmp', '.tif', '.ttf', '.docx', '.woff2', '.js', '.pict', '.tiff', '.eot', '.xlsx', '.jpg', '.csv', '.eps', '.woff', '.xls', '.jpeg', '.doc', '.ejs', '.otf', '.pptx', '.gif', '.pdf', '.swf', '.svg', '.ps', '.ico', '.pls', '.midi', '.svgz', '.class', '.png', '.ppt', '.mid', 'webp', '.jar'];

/* actions */
PX_INTERNAL.SCORE_EVALUATE_ACTION = {
    SPECIAL_TOKEN: -6,
    SENSITIVE_ROUTE: -5,
    UNEXPECTED_RESULT: -4,
    NO_COOKIE: -3,
    COOKIE_INVALID: -2,
    COOKIE_EXPIRED: -1,

    S2S_PASS_TRAFFIC: 11,
    COOKIE_PASS_TRAFFIC: 10,
    S2S_TIMEOUT_PASS: 9,
    COOKIE_BLOCK_TRAFFIC: -10,
    S2S_BLOCK_TRAFFIC: -11,
    CAPTCHA_BLOCK_TRAFFIC: -12,
    CHALLENGE_BLOCK_TRAFFIC: -13,

    CAPTCHA_PASS: 0,
    CAPTCHA_BLOCK: 1,

    GOOD_SCORE: 1,
    BAD_SCORE: 0
};

PX_INTERNAL.PASS_REASON = {
    CAPTCHA_TIMEOUT: 'captcha_timeout',
    CAPTCHA: 'captcha',
    COOKIE: 'cookie',
    S2S: 's2s',
    S2S_TIMEOUT: 's2s_timeout',
    MONITOR_MODE: 'monitor_mode',
    INVALID_RESPONSE: 'invalid_response',
    REQUEST_FAILED: 'request_failed'
};

PX_INTERNAL.MONITOR_MODE = {
    MONITOR: 0,
    BLOCK: 1
};

/* to be defined by the initiating user or dynamically via configuration service */
PX_DEFAULT.PX_APP_ID = 'PX_APP_ID';
PX_DEFAULT.ENABLE_MODULE = true;
PX_DEFAULT.API_TIMEOUT_MS = 1000;
PX_DEFAULT.BLOCKING_SCORE = 100;
PX_DEFAULT.COOKIE_SECRET_KEY = 'cookie_secret_key';
PX_DEFAULT.AUTH_TOKEN = 'auth_token';
PX_DEFAULT.IP_HEADERS = [];
PX_DEFAULT.BLOCK_HTML = 'BLOCK';
PX_DEFAULT.SENSITIVE_HEADERS = ['cookie', 'cookies'];
PX_DEFAULT.PROXY_URL = '';
PX_DEFAULT.SEND_PAGE_ACTIVITIES = true;
PX_DEFAULT.DEBUG_MODE = false;
PX_DEFAULT.CUSTOM_REQUEST_HANDLER = '';
PX_DEFAULT.MAX_BUFFER_LEN = 30;
PX_DEFAULT.GET_USER_IP = '';
PX_DEFAULT.CSS_REF = [];
PX_DEFAULT.JS_REF = [];
PX_DEFAULT.CUSTOM_LOGO = '';
PX_DEFAULT.LOGO_VISIBILITY = 'hidden';
PX_DEFAULT.SENSITIVE_ROUTES = [];
PX_DEFAULT.WHITELIST_ROUTES = [];
PX_DEFAULT.DYNAMIC_CONFIGURATIONS = false;
PX_DEFAULT.CONFIGURATION_LOAD_INTERVAL = 5000;
PX_DEFAULT.MODULE_MODE = PX_INTERNAL.MONITOR_MODE.MONITOR;
PX_DEFAULT.ADDITIONAL_ACTIVITY_HANDLER = '';
PX_DEFAULT.ENRICH_CUSTOM_PARAMETERS = '';
PX_DEFAULT.FIRST_PARTY_ENABLED = true;
PX_DEFAULT.FIRST_PARTY_XHR_ENABLED = true;
PX_DEFAULT.TESTING_MODE = false;
PX_DEFAULT.WHITELIST_EXT = [];
PX_DEFAULT.BYPASS_MONITOR_HEADER = '';

class PxConfig {
    static init(params, pxClient) {
        config = PxConfig.mergeDefaults(params);
        config.WHITELIST_EXT = [...PX_INTERNAL.STATIC_FILES_EXT, ...PX_DEFAULT.WHITELIST_EXT];
        if (PX_DEFAULT.TESTING_MODE) {
            PX_DEFAULT.CUSTOM_REQUEST_HANDLER = TestModeRequestHandler.testModeRequestHandler;
        }
        if (config.PROXY_URL) {
            config.agent = new HttpsProxyAgent(config.PROXY_URL);
        }
        pxClient.sendEnforcerTelemetry('initial_config');
        if (PX_DEFAULT.DYNAMIC_CONFIGURATIONS) {
            configLoader = new ConfigLoader(config, pxClient);
            configLoader.init();
        }
    }

    static mergeDefaults(params) {
        PX_DEFAULT.ENABLE_MODULE = this.configurationsOverriding(PX_DEFAULT, params, 'ENABLE_MODULE', 'enableModule');
        PX_DEFAULT.PX_APP_ID = this.configurationsOverriding(PX_DEFAULT, params, 'PX_APP_ID', 'pxAppId');
        //Set SEVER_HOST if app_id is set.
        PX_INTERNAL.SERVER_HOST = PX_DEFAULT.PX_APP_ID !== 'PX_APP_ID' ? PX_INTERNAL.SERVER_HOST = 'sapi-' + PX_DEFAULT.PX_APP_ID.toLowerCase() + '.perimeterx.net' : 'sapi.perimeterx.net';
        PX_INTERNAL.COLLECTOR_HOST = PX_DEFAULT.PX_APP_ID !== 'PX_APP_ID' ? PX_INTERNAL.COLLECTOR_HOST = 'collector-' + PX_DEFAULT.PX_APP_ID.toLowerCase() + '.perimeterx.net' : 'collector.perimeterx.net';
        PX_DEFAULT.COOKIE_SECRET_KEY = this.configurationsOverriding(PX_DEFAULT, params, 'COOKIE_SECRET_KEY', 'cookieSecretKey');
        PX_DEFAULT.AUTH_TOKEN = this.configurationsOverriding(PX_DEFAULT, params, 'AUTH_TOKEN', 'authToken');
        PX_DEFAULT.PROXY_URL = this.configurationsOverriding(PX_DEFAULT, params, 'PROXY_URL', 'proxy');
        PX_DEFAULT.API_TIMEOUT_MS = this.configurationsOverriding(PX_DEFAULT, params, 'API_TIMEOUT_MS', 'apiTimeoutMS');
        PX_DEFAULT.CUSTOM_REQUEST_HANDLER = this.configurationsOverriding(PX_DEFAULT, params, 'CUSTOM_REQUEST_HANDLER', 'customRequestHandler');
        PX_DEFAULT.GET_USER_IP = this.configurationsOverriding(PX_DEFAULT, params, 'GET_USER_IP', 'getUserIp');
        PX_DEFAULT.BLOCKING_SCORE = this.configurationsOverriding(PX_DEFAULT, params, 'BLOCKING_SCORE', 'blockingScore');
        PX_DEFAULT.IP_HEADERS = this.configurationsOverriding(PX_DEFAULT, params, 'IP_HEADERS', 'ipHeaders');
        PX_DEFAULT.SEND_PAGE_ACTIVITIES = this.configurationsOverriding(PX_DEFAULT, params, 'SEND_PAGE_ACTIVITIES', 'sendPageActivities');
        PX_DEFAULT.SENSITIVE_HEADERS = this.configurationsOverriding(PX_DEFAULT, params, 'SENSITIVE_HEADERS', 'sensitiveHeaders');
        PX_DEFAULT.DEBUG_MODE = this.configurationsOverriding(PX_DEFAULT, params, 'DEBUG_MODE', 'debugMode');
        PX_DEFAULT.MAX_BUFFER_LEN = this.configurationsOverriding(PX_DEFAULT, params, 'MAX_BUFFER_LEN', 'maxBufferLength');
        PX_DEFAULT.JS_REF = this.configurationsOverriding(PX_DEFAULT, params, 'JS_REF', 'jsRef');
        PX_DEFAULT.CSS_REF = this.configurationsOverriding(PX_DEFAULT, params, 'CSS_REF', 'cssRef');
        PX_DEFAULT.CUSTOM_LOGO = this.configurationsOverriding(PX_DEFAULT, params, 'CUSTOM_LOGO', 'customLogo');
        PX_DEFAULT.SENSITIVE_ROUTES = this.configurationsOverriding(PX_DEFAULT, params, 'SENSITIVE_ROUTES', 'sensitiveRoutes');
        PX_DEFAULT.WHITELIST_ROUTES = this.configurationsOverriding(PX_DEFAULT, params, 'WHITELIST_ROUTES', 'whitelistRoutes');
        PX_DEFAULT.DYNAMIC_CONFIGURATIONS = this.configurationsOverriding(PX_DEFAULT, params, 'DYNAMIC_CONFIGURATIONS', 'dynamicConfigurations');
        PX_DEFAULT.MODULE_MODE = this.configurationsOverriding(PX_DEFAULT, params, 'MODULE_MODE', 'moduleMode');
        PX_DEFAULT.FIRST_PARTY_ENABLED = this.configurationsOverriding(PX_DEFAULT, params, 'FIRST_PARTY_ENABLED', 'firstPartyEnabled');
        PX_INTERNAL.MODULE_VERSION = this.configurationsOverriding(PX_INTERNAL, params, 'MODULE_VERSION', 'moduleVersion');
        PX_DEFAULT.ADDITIONAL_ACTIVITY_HANDLER = this.configurationsOverriding(PX_DEFAULT, params, 'ADDITIONAL_ACTIVITY_HANDLER', 'additionalActivityHandler');
        PX_DEFAULT.ENRICH_CUSTOM_PARAMETERS = this.configurationsOverriding(PX_DEFAULT, params, 'ENRICH_CUSTOM_PARAMETERS', 'enrichCustomParameters');
        PX_DEFAULT.TESTING_MODE = this.configurationsOverriding(PX_DEFAULT, params, 'TESTING_MODE', 'testingMode');
        PX_DEFAULT.WHITELIST_EXT = this.configurationsOverriding(PX_DEFAULT, params, 'WHITELIST_EXT', 'whitelistExt');
        PX_DEFAULT.BYPASS_MONITOR_HEADER = this.configurationsOverriding(PX_DEFAULT, params, 'BYPASS_MONITOR_HEADER', 'bypassMonitorHeader');
        return Object.assign(PX_DEFAULT, PX_INTERNAL);
    }

    static configurationsOverriding(conf, params, defaultName, userInput) {
        /* user did not override configuration */
        if (!(userInput in params)) {
            return conf[defaultName];
        }

        /* handling block handler overriding */
        if (userInput === 'getUserIp' || userInput === 'additionalActivityHandler' || userInput === 'customRequestHandler' || userInput === 'enrichCustomParameters') {
            if (typeof params[userInput] === 'function') {
                return params[userInput];
            }
            return '';
        }

        /* for type mismatch, we'll use the default */
        if (typeof conf[defaultName] !== typeof params[userInput]) {
            return conf[defaultName];
        }

        return params[userInput];
    }

    static get conf() {
        return config;
    }

    static get confManager() {
        return configLoader;
    }
}

module.exports = PxConfig;

