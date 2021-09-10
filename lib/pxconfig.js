'use strict';
const HttpsProxyAgent = require('https-proxy-agent');
const TestModeRequestHandler = require('./pxtesthandler');
const { ModuleMode } = require("./enums/ModuleMode");
const { LoggerSeverity } = require('./enums/LoggerSeverity');

class PxConfig {
    constructor(params, logger) {
        this.logger = logger;
        this.config = this.initializeConfigs(params);
        this.proxyAgent = this.config.px_proxy_url ? new HttpsProxyAgent(this.config.px_proxy_url) : null;
    }

    initializeConfigs(params) {
        const config = {};
        const defaultConfig = this.getDefaultConfig();

        this.throwIfMissingRequiredFields(params, defaultConfig);

        for (const configKey in defaultConfig) {
            config[configKey] = this.getDefaultConfigValue(params, configKey, defaultConfig);
        }

        for (const configKey in params) {
            if (this.shouldSkipConfig(params, configKey, defaultConfig)) {
                continue;
            }

            config[configKey] = this.getConfigValue(params, configKey);
        }
        return config;
    }

    throwIfMissingRequiredFields(config, defaultConfig) {
        for (const configKey in defaultConfig) {
            if (defaultConfig[configKey].required && !(config[configKey])) {
                throw `Required configuration ${configKey} missing!`;
            }
        }
    }

    shouldSkipConfig(config, configKey, defaultConfig) {
        if (!(configKey in defaultConfig)) {
            this.logger.debug(`Unknown configuration key ${configKey}, ignoring...`);
            return true;
        }

        if (!this.isExpectedType(config, configKey, defaultConfig)) {
            this.logger.debug(`Configuration key ${configKey} is of incorrect type: expected ${defaultConfig[configKey].type}, received ${typeof config[configKey]}, ignoring...`);
            return true;
        }

        return false;
    }

    isExpectedType(config, configKey, defaultConfig) {
        const expectedType = defaultConfig[configKey].type;        
        switch (expectedType) {
            case 'array':
                return Array.isArray(config[configKey]);
            case 'enum':
                return Object.values(defaultConfig[configKey].enum).includes(config[configKey]);
            default:
                return expectedType === typeof config[configKey];
        }
    }

    getConfigValue(config, configKey) {
        switch (configKey) {
            case "px_filter_by_http_method":
                return config[configKey].map(method => method.toUpperCase());
            default:
                return config[configKey];
        }
    }

    getDefaultConfigValue(config, configKey, defaultConfig) {
        switch (configKey) {
            case "px_backend_url":
                return `https://sapi-${config.px_app_id.toLowerCase()}.perimeterx.net`;
            case "px_collector_host":
                return `collector-${config.px_app_id.toLowerCase()}.perimeterx.net`;
            default:
                return defaultConfig[configKey].default;
        }
    }

    getDefaultConfig() {
        return {
            px_app_id: { default: '', type: 'string', required: true },
            px_cookie_secret: { default: '', type: 'string', required: true },
            px_auth_token: { default: '', type: 'string', required: true },
            px_backend_url: { default: '', type: 'string', required: false },
            px_s2s_timeout: { default: 1000, type: 'number', required: false },
            px_blocking_score: { default: 100, type: 'number', required: false },
            px_user_agent_max_length: { default: 8528, type: 'number', required: false },
            px_risk_cookie_max_length: { default: 2048, type: 'number', required: false },
            px_risk_cookie_min_iterations: { default: 500, type: 'number', required: false },
            px_risk_cookie_max_iterations: { default: 5000, type: 'number', required: false },
            px_logger_severity: { default: LoggerSeverity.FATAL, type: 'enum', enum: LoggerSeverity, required: false },
            px_ip_headers: { default: [], type: 'array', required: false },
            px_module_enabled: { default: true, type: 'boolean', required: false },
            px_module_mode: { default: ModuleMode.MONITOR, type: 'enum', enum: ModuleMode, required: false },
            px_advanced_blocking_response_enabled: { default: true, type: 'boolean', required: false },
            px_max_activity_batch_size: { default: 20, type: 'number', required: false },
            px_batch_activities_timeout_ms: { default: 1000, type: 'number', required: false },
            px_enforced_routes: { default: [], type: 'array', required: false },
            px_first_party_enabled: { default: true, type: 'boolean', required: false },
            px_login_credentials_extraction_enabled: { default: false, type: 'boolean', required: false },
            px_login_credentials_extraction: { default: [], type: 'array', required: false },
            px_monitored_routes: { default: [], type: 'array', required: false },
            px_sensitive_headers: { default: ['cookie', 'cookies'], type: 'array', required: false },
            px_sensitive_routes: { default: [], type: 'array', required: false },
            px_filter_by_extension: { default: [], type: 'array', required: false },
            px_filter_by_http_method: { default: [], type: 'array', required: false },
            px_filter_by_ip: { default: [], type: 'array', required: false },
            px_filter_by_route: { default: [], type: 'array', required: false },
            px_filter_by_user_agent: { default: [], type: 'array', required: false },
            px_css_ref: { default: '', type: 'string', required: false },
            px_js_ref: { default: '', type: 'string', required: false },
            px_custom_cookie_header: { default: '', type: 'string', required: false },
            px_custom_logo: { default: '', type: 'string', required: false },
            px_enrich_custom_parameters: { default: null, type: 'function', required: false },
            px_custom_request_handler: { default: null, type: 'function', required: false },
            px_additional_activity_handler: { default: null, type: 'function', required: false },
            px_extract_user_ip: { default: null, type: 'function', required: false },
            px_bypass_monitor_header: { default: '', type: 'string', required: false },
            px_external_activities: { default: false, type: 'boolean', required: false },
            px_proxy_url: { default: '', type: 'string', required: false },
            px_send_page_activities: { default: true, type: 'boolean', required: false },
            px_pxhd_secure: { default: false, type: 'boolean', required: false },
            px_testing_mode: { default: false, type: 'boolean', required: false },
            // BLOCK_HTML: 'BLOCK',
            // DEBUG_MODE: false,
            // LOGO_VISIBILITY: 'hidden',
            // DYNAMIC_CONFIGURATIONS: false,
            // CONFIGURATION_LOAD_INTERVAL: 5000,
            // FIRST_PARTY_XHR_ENABLED: true,
            // CONFIG_PATH: '',
            // CUSTOM_TEMPLATE_ROOT: '',
            // CUSTOM_TEMPLATE_DATA: {},
        };
    }

    get Config() {
        return this.config;
    }

    get Logger() {
        return this.logger;
    }

    get ProxyAgent() {
        return this.proxyAgent;
    }
}

module.exports = PxConfig;
