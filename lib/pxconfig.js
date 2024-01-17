'use strict';
const TestModeRequestHandler = require('./pxtesthandler');
const HttpsProxyAgent = require('https-proxy-agent');
const pxutil = require('./pxutil');
const { ModuleMode } = require('./enums/ModuleMode');
const { LoggerSeverity } = require('./enums/LoggerSeverity');
const { DEFAULT_COMPROMISED_CREDENTIALS_HEADER_NAME } = require('./utils/constants');
const { CIVersion } = require('./enums/CIVersion');
const { LoginSuccessfulReportingMethod } = require('./enums/LoginSuccessfulReportingMethod');
const { INVALID_VERSION_NUMBER } = require('./utils/constants');
class PxConfig {
    constructor(params, logger) {
        this.PX_INTERNAL = pxInternalConfig();
        this.PX_DEFAULT = pxDefaultConfig();
        this.logger = logger;
        this.config = this.mergeParams(params);
        this._remoteConfigOutdated = false;
        this.config.FILTER_BY_METHOD = this.config.FILTER_BY_METHOD.map((v) => v.toUpperCase());
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

    get remoteConfigVersion() {
        return this.config.px_remote_config_version || INVALID_VERSION_NUMBER;
    }

    get isRemoteConfigOutdated() {
        return this._remoteConfigOutdated;
    }
    set isRemoteConfigOutdated(value) {
        this._remoteConfigOutdated = value;
    }

    mergeParams(params) {
        params = this.mergeConfigFileParams(params);

        const configKeyMapping = [
            ['ENABLE_MODULE', 'px_module_enabled'],
            ['PX_APP_ID', 'px_app_id'],
            ['COOKIE_SECRET_KEY', 'px_cookie_secret'],
            ['AUTH_TOKEN', 'px_auth_token'],
            ['PROXY_URL', 'px_proxy_url'],
            ['API_TIMEOUT_MS', 'px_s2s_timeout'],
            ['ACTIVITIES_TIMEOUT_MS', 'px_batch_activities_timeout_ms'],
            ['CUSTOM_REQUEST_HANDLER', 'px_custom_request_handler'],
            ['GET_USER_IP', 'px_extract_user_ip'],
            ['BLOCKING_SCORE', 'px_blocking_score'],
            ['IP_HEADERS', 'px_ip_headers'],
            ['SEND_PAGE_ACTIVITIES', 'px_send_async_activities_enabled'],
            ['SENSITIVE_HEADERS', 'px_sensitive_headers'],
            ['LOGGER_SEVERITY', 'px_logger_severity'],
            ['MAX_BUFFER_LEN', 'px_max_activity_batch_size'],
            ['JS_REF', 'px_js_ref'],
            ['CSS_REF', 'px_css_ref'],
            ['CUSTOM_LOGO', 'px_custom_logo'],
            ['SENSITIVE_ROUTES', 'px_sensitive_routes'],
            ['WHITELIST_ROUTES', 'px_filter_by_route'],
            ['ENFORCED_ROUTES', 'px_enforced_routes'],
            ['MONITORED_ROUTES', 'px_monitored_routes'],
            ['DYNAMIC_CONFIGURATIONS', 'px_dynamic_configuration_enabled'],
            ['MODULE_MODE', 'px_module_mode'],
            ['FIRST_PARTY_ENABLED', 'px_first_party_enabled'],
            ['CD_FIRST_PARTY_ENABLED', 'px_cd_first_party_enabled'],
            ['ADDITIONAL_ACTIVITY_HANDLER', 'px_additional_activity_handler'],
            ['ENRICH_CUSTOM_PARAMETERS', 'px_enrich_custom_parameters'],
            ['TESTING_MODE', 'px_testing_mode_enabled'],
            ['WHITELIST_EXT', 'px_filter_by_extension'],
            ['BYPASS_MONITOR_HEADER', 'px_bypass_monitor_header'],
            ['ADVANCED_BLOCKING_RESPONSE', 'px_advanced_blocking_response_enabled'],
            ['TELEMETRY_COMMAND_HEADER', 'px_telemetry_header'],
            ['CUSTOM_TEMPLATE_ROOT', 'px_custom_template_root'],
            ['FILTER_BY_IP', 'px_filter_by_ip'],
            ['FILTER_BY_USERAGENT', 'px_filter_by_user_agent'],
            ['FILTER_BY_METHOD', 'px_filter_by_http_method'],
            ['PX_CUSTOM_FIRST_PARTY_PATH', 'px_custom_first_party_path'],
            ['PXHD_SECURE', 'px_pxhd_secure_enabled'],
            ['BACKEND_URL', 'px_backend_url'],
            ['CUSTOM_COOKIE_HEADER', 'px_custom_cookie_header'],
            ['ENABLE_LOGIN_CREDS_EXTRACTION', 'px_login_credentials_extraction_enabled'],
            ['LOGIN_CREDS_EXTRACTION', 'px_login_credentials_extraction'],
            ['CREDENTIALS_INTELLIGENCE_VERSION', 'px_credentials_intelligence_version'],
            ['COMPROMISED_CREDENTIALS_HEADER', 'px_compromised_credentials_header'],
            ['ENABLE_ADDITIONAL_S2S_ACTIVITY_HEADER', 'px_additional_s2s_activity_header_enabled'],
            ['SENSITIVE_GRAPHQL_OPERATION_TYPES', 'px_sensitive_graphql_operation_types'],
            ['GRAPHQL_ROUTES', 'px_graphql_routes'],
            ['SENSITIVE_GRAPHQL_OPERATION_NAMES', 'px_sensitive_graphql_operation_names'],
            ['SEND_RAW_USERNAME_ON_ADDITIONAL_S2S_ACTIVITY', 'px_send_raw_username_on_additional_s2s_activity'],
            ['AUTOMATIC_ADDITIONAL_S2S_ACTIVITY_ENABLED', 'px_automatic_additional_s2s_activity_enabled'],
            ['LOGIN_SUCCESSFUL_REPORTING_METHOD', 'px_login_successful_reporting_method'],
            ['LOGIN_SUCCESSFUL_HEADER_NAME', 'px_login_successful_header_name'],
            ['LOGIN_SUCCESSFUL_HEADER_VALUE', 'px_login_successful_header_value'],
            ['LOGIN_SUCCESSFUL_STATUS', 'px_login_successful_status'],
            ['LOGIN_SUCCESSFUL_BODY_REGEX', 'px_login_successful_body_regex'],
            ['LOGIN_SUCCESSFUL_CUSTOM_CALLBACK', 'px_login_successful_custom_callback'],
            ['MODIFY_CONTEXT', 'px_modify_context'],
            ['CORS_SUPPORT_ENABLED', 'px_cors_support_enabled'],
            ['CORS_CREATE_CUSTOM_BLOCK_RESPONSE_HEADERS', 'px_cors_create_custom_block_response_headers'],
            ['CORS_CUSTOM_PREFLIGHT_HANDLER', 'px_cors_custom_preflight_handler'],
            ['CORS_PREFLIGHT_REQUEST_FILTER_ENABLED', 'px_cors_preflight_request_filter_enabled'],
            ['JWT_COOKIE_NAME', 'px_jwt_cookie_name'],
            ['JWT_COOKIE_USER_ID_FIELD_NAME', 'px_jwt_cookie_user_id_field_name'],
            ['JWT_COOKIE_ADDITIONAL_FIELD_NAMES', 'px_jwt_cookie_additional_field_names'],
            ['JWT_HEADER_NAME', 'px_jwt_header_name'],
            ['JWT_HEADER_USER_ID_FIELD_NAME', 'px_jwt_header_user_id_field_name'],
            ['JWT_HEADER_ADDITIONAL_FIELD_NAMES', 'px_jwt_header_additional_field_names'],
            ['CUSTOM_IS_SENSITIVE_REQUEST', 'px_custom_is_sensitive_request'],
            ['LOGGER_AUTH_TOKEN', 'px_logger_auth_token'],
            ['FIRST_PARTY_TIMEOUT_MS', 'px_first_party_timeout_ms'],
            ['URL_DECODE_RESERVED_CHARACTERS', 'px_url_decode_reserved_characters'],
            ['REMOTE_CONFIG_ENABLED', 'px_remote_config_enabled'],
            ['REMOTE_CONFIG_AUTH_TOKEN', 'px_remote_config_auth_token'],
            ['REMOTE_CONFIG_ID', 'px_remote_config_id'],
            ['REMOTE_CONFIG_VERSION', 'px_remote_config_version']
        ];

        configKeyMapping.forEach(([targetKey, sourceKey]) => {
            this.PX_DEFAULT[targetKey] = PxConfig.configurationsOverriding(
                this.PX_DEFAULT,
                params,
                targetKey,
                sourceKey,
            );
        });

        // validate that app_id is configured
        if (this.PX_DEFAULT.PX_APP_ID !== 'PX_APP_ID') {
            // set backend url
            if (this.PX_DEFAULT.BACKEND_URL === '') {
                this.PX_DEFAULT.BACKEND_URL = `https://sapi-${this.PX_DEFAULT.PX_APP_ID.toLowerCase()}.perimeterx.net`;
            }
            // set collector host
            this.PX_INTERNAL.COLLECTOR_HOST = `collector-${this.PX_DEFAULT.PX_APP_ID.toLowerCase()}.perimeterx.net`;
        } else {
            //set default BACKEND_URL and COLLECTOR_HOST
            this.PX_DEFAULT.BACKEND_URL = 'https://sapi.perimeterx.net';
            this.PX_INTERNAL.COLLECTOR_HOST = 'collector.perimeterx.net';
        }
        //set module version
        this.PX_INTERNAL.MODULE_VERSION = PxConfig.configurationsOverriding(
            this.PX_INTERNAL,
            params,
            'MODULE_VERSION',
            'px_module_version',
        );

        //update config
        return Object.assign(this.PX_DEFAULT, this.PX_INTERNAL);
    }

    mergeConfigFileParams(configParams) {
        let mergedParams = configParams;
        try {
            let fileConfig = {};
            const filepath = configParams.px_config_file_path;
            if (filepath) {
                fileConfig = pxutil.readJsonFile(filepath);
            }
            const fileMappedConfig = {};
            for (const key in fileConfig) {
                if (allowedConfigKeys.includes(key)) {
                    fileMappedConfig[key] = fileConfig[key];
                } else {
                    this.logger.debug(`ignoring unknown config key "${key}"`);
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
        if (
            userInput === 'px_extract_user_ip' ||
            userInput === 'px_additional_activity_handler' ||
            userInput === 'px_custom_request_handler' ||
            userInput === 'px_enrich_custom_parameters' ||
            userInput === 'px_login_successful_custom_callback' ||
            userInput === 'px_modify_context' ||
            userInput === 'px_cors_create_custom_block_response_headers' ||
            userInput === 'px_cors_custom_preflight_handler' ||
            userInput === 'px_custom_is_sensitive_request'
        ) {
            if (typeof params[userInput] === 'function') {
                return params[userInput];
            }
            return '';
        }

        /* handling px_js_ref and px_css_ref */
        if (userInput === 'px_js_ref' || userInput === 'px_css_ref') {
            if (typeof params[userInput] === 'string') {
                return params[userInput];
            }
            if (Array.isArray(params[userInput])) {
                return params[userInput][0];
            }

            return conf[defaultName];
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
        COLLECTOR_HOST: 'collector.perimeterx.net',
        CAPTCHA_HOST: 'captcha.px-cdn.net',
        BACKUP_CAPTCHA_HOST: 'https://captcha.px-cloud.net',
        CLIENT_HOST: 'client.perimeterx.net',
        CD_XHR_HOST: 'b.px-cdn.net',
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
        FIRST_PARTY_CD_XHR_PATH: '/reports',
        EMPTY_GIF_B64: 'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        // Cookie encryption configurations
        COOKIE_ENCRYPTION: true,
        CE_KEYLEN: 32,
        CE_IVLEN: 16,
        CE_ITERATIONS: 1000,
        CE_DIGEST: 'sha256',
        CE_ALGO: 'aes-256-cbc',

        STATIC_FILES_EXT: [
            '.css',
            '.bmp',
            '.tif',
            '.ttf',
            '.docx',
            '.woff2',
            '.js',
            '.pict',
            '.tiff',
            '.eot',
            '.xlsx',
            '.jpg',
            '.csv',
            '.eps',
            '.woff',
            '.xls',
            '.jpeg',
            '.doc',
            '.ejs',
            '.otf',
            '.pptx',
            '.gif',
            '.pdf',
            '.swf',
            '.svg',
            '.ps',
            '.ico',
            '.pls',
            '.midi',
            '.svgz',
            '.class',
            '.png',
            '.ppt',
            '.mid',
            'webp',
            '.jar',
        ],
    };
}

/* to be defined by the initiating user or dynamically via configuration service */
function pxDefaultConfig() {
    return {
        PX_APP_ID: 'PX_APP_ID',
        ENABLE_MODULE: true,
        API_TIMEOUT_MS: 1000,
        ACTIVITIES_TIMEOUT_MS: 1000,
        BLOCKING_SCORE: 100,
        COOKIE_SECRET_KEY: 'cookie_secret_key',
        AUTH_TOKEN: 'auth_token',
        IP_HEADERS: [],
        BLOCK_HTML: 'BLOCK',
        SENSITIVE_HEADERS: ['cookie', 'cookies'],
        PROXY_URL: '',
        SEND_PAGE_ACTIVITIES: true,
        LOGGER_SEVERITY: LoggerSeverity.ERROR,
        CUSTOM_REQUEST_HANDLER: '',
        MAX_BUFFER_LEN: 30,
        GET_USER_IP: '',
        CSS_REF: '',
        JS_REF: '',
        CUSTOM_LOGO: '',
        SENSITIVE_ROUTES: [],
        WHITELIST_ROUTES: [],
        MONITORED_ROUTES: [],
        ENFORCED_ROUTES: [],
        DYNAMIC_CONFIGURATIONS: false,
        CONFIGURATION_LOAD_INTERVAL: 5000,
        MODULE_MODE: ModuleMode.MONITOR,
        ADDITIONAL_ACTIVITY_HANDLER: '',
        ENRICH_CUSTOM_PARAMETERS: '',
        FIRST_PARTY_ENABLED: true,
        CD_FIRST_PARTY_ENABLED: false,
        FIRST_PARTY_XHR_ENABLED: true,
        TESTING_MODE: false,
        WHITELIST_EXT: [],
        BYPASS_MONITOR_HEADER: '',
        CONFIG_PATH: '',
        ADVANCED_BLOCKING_RESPONSE: true,
        CUSTOM_TEMPLATE_ROOT: '',
        FILTER_BY_IP: [],
        FILTER_BY_USERAGENT: [],
        FILTER_BY_METHOD: [],
        PXHD_SECURE: false,
        BACKEND_URL: '',
        CUSTOM_COOKIE_HEADER: '',
        PX_CUSTOM_FIRST_PARTY_PATH: '',
        ENABLE_LOGIN_CREDS_EXTRACTION: false,
        LOGIN_CREDS_EXTRACTION: [],
        CREDENTIALS_INTELLIGENCE_VERSION: CIVersion.V2,
        COMPROMISED_CREDENTIALS_HEADER: DEFAULT_COMPROMISED_CREDENTIALS_HEADER_NAME,
        ENABLE_ADDITIONAL_S2S_ACTIVITY_HEADER: false,
        SENSITIVE_GRAPHQL_OPERATION_TYPES: [],
        SENSITIVE_GRAPHQL_OPERATION_NAMES: [],
        SEND_RAW_USERNAME_ON_ADDITIONAL_S2S_ACTIVITY: false,
        AUTOMATIC_ADDITIONAL_S2S_ACTIVITY_ENABLED: true,
        LOGIN_SUCCESSFUL_REPORTING_METHOD: LoginSuccessfulReportingMethod.NONE,
        LOGIN_SUCCESSFUL_HEADER_NAME: '',
        LOGIN_SUCCESSFUL_HEADER_VALUE: '',
        LOGIN_SUCCESSFUL_STATUS: 200,
        LOGIN_SUCCESSFUL_BODY_REGEX: '',
        LOGIN_SUCCESSFUL_CUSTOM_CALLBACK: null,
        MODIFY_CONTEXT: null,
        GRAPHQL_ROUTES: ['^/graphql$'],
        CORS_CUSTOM_PREFLIGHT_HANDLER: null,
        CORS_CREATE_CUSTOM_BLOCK_RESPONSE_HEADERS: null,
        CORS_PREFLIGHT_REQUEST_FILTER_ENABLED: false,
        CORS_SUPPORT_ENABLED: false,
        JWT_COOKIE_NAME: '',
        JWT_COOKIE_USER_ID_FIELD_NAME: '',
        JWT_COOKIE_ADDITIONAL_FIELD_NAMES: [],
        JWT_HEADER_NAME: '',
        JWT_HEADER_USER_ID_FIELD_NAME: '',
        JWT_HEADER_ADDITIONAL_FIELD_NAMES: [],
        CUSTOM_IS_SENSITIVE_REQUEST: '',
        LOGGER_AUTH_TOKEN: '',
        FIRST_PARTY_TIMEOUT_MS: 4000,
        URL_DECODE_RESERVED_CHARACTERS: false,
        REMOTE_CONFIG_ENABLED: false,
        REMOTE_CONFIG_AUTH_TOKEN: '',
        REMOTE_CONFIG_ID: '',
        REMOTE_CONFIG_VERSION: INVALID_VERSION_NUMBER
    };
}

const allowedConfigKeys = [
    'px_module_enabled',
    'px_app_id',
    'px_cookie_secret',
    'px_auth_token',
    'px_proxy_url',
    'px_s2s_timeout',
    'px_batch_activities_timeout_ms',
    'px_custom_request_handler',
    'px_extract_user_ip',
    'px_blocking_score',
    'px_ip_headers',
    'px_send_async_activities_enabled',
    'px_sensitive_headers',
    'px_logger_severity',
    'px_max_activity_batch_size',
    'px_js_ref',
    'px_css_ref',
    'px_custom_logo',
    'px_sensitive_routes',
    'px_filter_by_route',
    'px_enforced_routes',
    'px_monitored_routes',
    'px_dynamic_configuration_enabled',
    'px_module_mode',
    'px_first_party_enabled',
    'px_cd_first_party_enabled',
    'px_additional_activity_handler',
    'px_enrich_custom_parameters',
    'px_testing_mode_enabled',
    'px_filter_by_extension',
    'px_bypass_monitor_header',
    'px_advanced_blocking_response_enabled',
    'px_telemetry_header',
    'px_custom_template_root',
    'px_filter_by_ip',
    'px_filter_by_user_agent',
    'px_filter_by_http_method',
    'px_pxhd_secure_enabled',
    'px_backend_url',
    'px_custom_cookie_header',
    'px_custom_first_party_path',
    'px_login_credentials_extraction_enabled',
    'px_login_credentials_extraction',
    'px_credentials_intelligence_version',
    'px_compromised_credentials_header',
    'px_sensitive_graphql_operation_types',
    'px_sensitive_graphql_operation_names',
    'px_additional_s2s_activity_header_enabled',
    'px_send_raw_username_on_additional_s2s_activity',
    'px_automatic_additional_s2s_activity_enabled',
    'px_login_successful_reporting_method',
    'px_login_successful_header_name',
    'px_login_successful_header_value',
    'px_login_successful_status',
    'px_login_successful_body_regex',
    'px_login_successful_custom_callback',
    'px_modify_context',
    'px_graphql_routes',
    'px_cors_support_enabled',
    'px_cors_preflight_request_filter_enabled',
    'px_cors_create_custom_block_response_headers',
    'px_cors_custom_preflight_handler',
    'px_jwt_cookie_name',
    'px_jwt_cookie_user_id_field_name',
    'px_jwt_cookie_additional_field_names',
    'px_jwt_header_name',
    'px_jwt_header_user_id_field_name',
    'px_jwt_header_additional_field_names',
    'px_custom_is_sensitive_request',
    'px_logger_auth_token',
    'px_first_party_timeout_ms'
];

module.exports = PxConfig;
