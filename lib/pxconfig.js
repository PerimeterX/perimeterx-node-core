'use strict';
const TestModeRequestHandler = require('./pxtesthandler');
const HttpsProxyAgent = require('https-proxy-agent');
const pxutil = require('./pxutil');

class PxConfig {
    constructor(params, logger) {
        this.PX_INTERNAL = pxInternalConfig();
        this.PX_DEFAULT = pxDefaultConfig(this.PX_INTERNAL);
        this.logger = logger;
        this.config = this.mergeParams(params);
        this.config.logger = this.logger;

        this.config.WHITELIST_EXT = [...this.PX_INTERNAL.STATIC_FILES_EXT, ...this.PX_DEFAULT.WHITELIST_EXT];

        if (this.PX_DEFAULT.TESTING_MODE) {
            this.PX_DEFAULT.CUSTOM_REQUEST_HANDLER = TestModeRequestHandler.testModeRequestHandler;
        }

        if (this.config.PROXY_URL) {
            this.config.agent = new HttpsProxyAgent(this.config.PROXY_URL);
        }

        this.configLoader = null;
    }

    mergeParams(params) {
        params = this.mergeConfigFileParams(params);
        
        const configKeyMapping = [['ENABLE_MODULE', 'enableModule'], ['PX_APP_ID', 'pxAppId'], ['COOKIE_SECRET_KEY', 'cookieSecretKey'], ['AUTH_TOKEN', 'authToken'], ['PROXY_URL', 'proxy'], 
            ['API_TIMEOUT_MS', 'apiTimeoutMS'], ['CUSTOM_REQUEST_HANDLER', 'customRequestHandler'], ['GET_USER_IP', 'getUserIp'], ['BLOCKING_SCORE', 'blockingScore'], ['IP_HEADERS', 'ipHeaders'], 
            ['SEND_PAGE_ACTIVITIES', 'sendPageActivities'], ['SENSITIVE_HEADERS', 'sensitiveHeaders'], ['DEBUG_MODE', 'debugMode'], ['MAX_BUFFER_LEN', 'maxBufferLength'], ['JS_REF', 'jsRef'], 
            ['CSS_REF', 'cssRef'], ['CUSTOM_LOGO', 'customLogo'], ['SENSITIVE_ROUTES', 'sensitiveRoutes'], ['WHITELIST_ROUTES', 'whitelistRoutes'], ['DYNAMIC_CONFIGURATIONS', 'dynamicConfigurations'], 
            ['MODULE_MODE', 'moduleMode'], ['FIRST_PARTY_ENABLED', 'firstPartyEnabled'], ['ADDITIONAL_ACTIVITY_HANDLER', 'additionalActivityHandler'], ['ENRICH_CUSTOM_PARAMETERS', 'enrichCustomParameters'], 
            ['TESTING_MODE', 'testingMode'], ['WHITELIST_EXT', 'whitelistExt'], ['BYPASS_MONITOR_HEADER', 'bypassMonitorHeader'], ['ADVANCED_BLOCKING_RESPONSE', 'advancedBlockingResponse'],
            ['TELEMETRY_COMMAND_HEADER', 'telemetryCommandHeader'], ['CUSTOM_TEMPLATE_ROOT', 'customTemplateRoot'], ['CUSTOM_TEMPLATE_DATA', 'customTemplateData']];

        configKeyMapping.forEach(([targetKey, sourceKey]) => {
            this.PX_DEFAULT[targetKey] = PxConfig.configurationsOverriding(this.PX_DEFAULT, params, targetKey, sourceKey);
        });

        this.PX_INTERNAL.SERVER_HOST = this.PX_DEFAULT.PX_APP_ID !== 'PX_APP_ID' ? this.PX_INTERNAL.SERVER_HOST = 'sapi-' + this.PX_DEFAULT.PX_APP_ID.toLowerCase() + '.perimeterx.net' : 'sapi.perimeterx.net';
        this.PX_INTERNAL.COLLECTOR_HOST = this.PX_DEFAULT.PX_APP_ID !== 'PX_APP_ID' ? this.PX_INTERNAL.COLLECTOR_HOST = 'collector-' + this.PX_DEFAULT.PX_APP_ID.toLowerCase() + '.perimeterx.net' : 'collector.perimeterx.net';
        this.PX_INTERNAL.MODULE_VERSION = PxConfig.configurationsOverriding(this.PX_INTERNAL, params, 'MODULE_VERSION', 'moduleVersion');

        return Object.assign(this.PX_DEFAULT, this.PX_INTERNAL);
    }

    mergeConfigFileParams(configParams) {
        let mergedParams = configParams;
        try {
            let fileConfig = {};
            const filepath = configParams.configFilePath;
            if (filepath) {
                fileConfig = pxutil.readJsonFile(filepath);
            }
            const fileMappedConfig = {};
            for (const key in fileConfig) {
                if (configSchemaMapper.hasOwnProperty(key)) {
                    fileMappedConfig[configSchemaMapper[key]] = fileConfig[key];
                } else {
                    this.logger.debug(`config key ${key} is not mapped, ignoring it`);
                }
            }
            mergedParams = Object.assign(configParams, fileMappedConfig);
        } catch (err) {
            this.logger.error('Failed while trying to read the config json file, ' + err);
        }
        return mergedParams;
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

    get conf() {
        return this.config;
    }

    get confManager() {
        return this.configLoader;
    }
}

function pxInternalConfig() {
    return {
        MODULE_VERSION: 'NodeJS Module',
        SERVER_HOST: 'sapi.perimeterx.net',
        COLLECTOR_HOST: 'collector.perimeterx.net',
        CAPTCHA_HOST: 'captcha.px-cdn.net',
        CLIENT_HOST: 'client.perimeterx.net',
        CONFIGURATIONS_HOST: 'px-conf.perimeterx.net',
        SERVER_TO_SERVER_API_URI: '/api/v3/risk',
        SERVER_CAPTCHA_URI: '/api/v2/risk/captcha',
        SERVER_COLLECT_URI: '/api/v1/collector/s2s',
        CONFIGURATIONS_URI: '/api/v1/enforcer',
        TELEMETRY_URI: '/api/v2/risk/telemetry',
        TELEMETRY_COMMAND_HEADER: 'x-px-enforcer-telemetry',
        ENFORCER_TRUE_IP_HEADER: 'x-px-enforcer-true-ip',
        FIRST_PARTY_HEADER: 'x-px-first-party',
        FORWARDED_FOR_HEADER: 'x-forwarded-for',
        FIRST_PARTY_VENDOR_PATH: '/init.js',
        FIRST_PARTY_XHR_PATH: '/xhr',
        FIRST_PARTY_CAPTCHA_PATH: '/captcha',
        EMPTY_GIF_B64: 'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        // Cookie encryption configurations
        COOKIE_ENCRYPTION: true,
        CE_KEYLEN: 32,
        CE_IVLEN: 16,
        CE_ITERATIONS: 1000,
        CE_DIGEST: 'sha256',
        CE_ALGO: 'aes-256-cbc',
        
        STATIC_FILES_EXT: ['.css', '.bmp', '.tif', '.ttf', '.docx', '.woff2', '.js', '.pict', '.tiff', '.eot', '.xlsx', '.jpg', '.csv', '.eps', '.woff', '.xls', '.jpeg', '.doc', '.ejs', '.otf', '.pptx', '.gif', '.pdf', '.swf', '.svg', '.ps', '.ico', '.pls', '.midi', '.svgz', '.class', '.png', '.ppt', '.mid', 'webp', '.jar'],
        
        /* actions */
        SCORE_EVALUATE_ACTION: {
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
        },
        
        PASS_REASON: {
            CAPTCHA_TIMEOUT: 'captcha_timeout',
            CAPTCHA: 'captcha',
            COOKIE: 'cookie',
            S2S: 's2s',
            S2S_TIMEOUT: 's2s_timeout',
            MONITOR_MODE: 'monitor_mode',
            INVALID_RESPONSE: 'invalid_response',
            REQUEST_FAILED: 'request_failed'
        },
        
        MONITOR_MODE: {
            MONITOR: 0,
            BLOCK: 1
        },
    };
}

/* to be defined by the initiating user or dynamically via configuration service */
function pxDefaultConfig(PX_INTERNAL) {
    return {
        PX_APP_ID: 'PX_APP_ID',
        ENABLE_MODULE: true,
        API_TIMEOUT_MS: 1000,
        BLOCKING_SCORE: 100,
        COOKIE_SECRET_KEY: 'cookie_secret_key',
        AUTH_TOKEN: 'auth_token',
        IP_HEADERS: [],
        BLOCK_HTML: 'BLOCK',
        SENSITIVE_HEADERS: ['cookie', 'cookies'],
        PROXY_URL: '',
        SEND_PAGE_ACTIVITIES: true,
        DEBUG_MODE: false,
        CUSTOM_REQUEST_HANDLER: '',
        MAX_BUFFER_LEN: 30,
        GET_USER_IP: '',
        CSS_REF: [],
        JS_REF: [],
        CUSTOM_LOGO: '',
        LOGO_VISIBILITY: 'hidden',
        SENSITIVE_ROUTES: [],
        WHITELIST_ROUTES: [],
        DYNAMIC_CONFIGURATIONS: false,
        CONFIGURATION_LOAD_INTERVAL: 5000,
        MODULE_MODE: PX_INTERNAL.MONITOR_MODE.MONITOR,
        ADDITIONAL_ACTIVITY_HANDLER: '',
        ENRICH_CUSTOM_PARAMETERS: '',
        FIRST_PARTY_ENABLED: true,
        FIRST_PARTY_XHR_ENABLED: true,
        TESTING_MODE: false,
        WHITELIST_EXT: [],
        BYPASS_MONITOR_HEADER: '',
        CONFIG_PATH: '',
        ADVANCED_BLOCKING_RESPONSE: true,
        CUSTOM_TEMPLATE_ROOT: '',
        CUSTOM_TEMPLATE_DATA: {}
    };
}

const configSchemaMapper = {
    px_enable_module: 'enableModule', 
    px_app_id: 'pxAppId', 
    px_cookie_secret: 'cookieSecretKey', 
    px_auth_token: 'authToken', 
    px_proxy_url: 'proxy', 
    px_sync_request_timeout_ms: 'apiTimeoutMS',
    px_custom_request_handler: 'customRequestHandler', 
    px_get_user_ip: 'getUserIp', 
    px_blocking_score: 'blockingScore', 
    px_ip_headers: 'ipHeaders', 
    px_send_async_activities: 'sendPageActivities',
    px_sensitive_headers: 'sensitiveHeaders', 
    px_debug_mode: 'debugMode',
    px_max_buffer_length: 'maxBufferLength',
    px_js_ref: 'jsRef', 
    px_css_ref: 'cssRef', 
    px_custom_logo: 'customLogo', 
    px_sensitive_routes: 'sensitiveRoutes', 
    px_whitelist_uri_full: 'whitelistRoutes', 
    px_dynamic_configurations: 'dynamicConfigurations', 
    px_module_mode: 'moduleMode', 
    px_first_party_enabled: 'firstPartyEnabled', 
    px_additional_activity_handler: 'additionalActivityHandler', 
    px_enrich_custom_parameters: 'enrichCustomParameters', 
    px_test_mode: 'testingMode', 
    px_whitelist_extensions: 'whitelistExt', 
    px_bypass_monitor_header: 'bypassMonitorHeader',
    px_advanced_blocking_response: 'advancedBlockingResponse',
    px_telemetry_command: 'telemetryCommandHeader'
};

module.exports = PxConfig;