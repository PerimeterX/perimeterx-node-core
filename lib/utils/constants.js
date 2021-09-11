const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const DAYS_IN_YEAR = 365;
const MILLISECONDS_IN_YEAR = MILLISECONDS_IN_SECOND * SECONDS_IN_MINUTE * MINUTES_IN_HOUR * HOURS_IN_DAY * DAYS_IN_YEAR;

const EMPTY_GIF_B64 = 'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

const RISK_API_URI = '/api/v3/risk';
const CAPTCHA_URI = '/api/v2/risk/captcha';
const ACTIVITIES_URI = '/api/v1/collector/s2s';
const CONFIGURATIONS_URI = '/api/v1/enforcer';
const TELEMETRY_URI = '/api/v2/risk/telemetry';

const TELEMETRY_COMMAND_HEADER = 'x-px-enforcer-telemetry';
const ENFORCER_TRUE_IP_HEADER = 'x-px-enforcer-true-ip';
const FIRST_PARTY_HEADER = 'x-px-first-party';

const FORWARDED_FOR_HEADER = 'x-forwarded-for';
const FIRST_PARTY_VENDOR_PATH = '/init.js';
const FIRST_PARTY_XHR_PATH = '/xhr';
const FIRST_PARTY_CAPTCHA_PATH = '/captcha';

const DEFAULT_COLLECTOR_HOST = 'collector.perimeterx.net';
const DEFAULT_CAPTCHA_HOST = 'captcha.px-cdn.net';
const DEFAULT_CLIENT_HOST = 'client.perimeterx.net';
const DEFAULT_CONFIGURATIONS_HOST = 'px-conf.perimeterx.net';
const DEFAULT_BACKEND_URL = 'https://sapi.perimeterx.net';

const DEFAULT_SENSITIVE_HEADERS = ['cookie', 'cookies'];
const DEFAULT_FILTER_BY_EXTENSIONS = [
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
];

const DEFAULT_COOKIE_ENCRYPTION_KEYLEN = 32;
const DEFAULT_COOKIE_ENCRYPTION_IVLEN = 16;
const DEFAULT_COOKIE_ENCRYPTION_ITERATIONS = 1000;
const DEFAULT_COOKIE_ENCRYPTION_DIGEST = 'sha256';
const DEFAULT_COOKIE_ENCRYPTION_ALGO = 'aes-256-cbc';

const DEFAULT_MODULE_VERSION = 'NodeJS Core v2.13.1';

module.exports = {
    MILLISECONDS_IN_SECOND,
    SECONDS_IN_MINUTE,
    MINUTES_IN_HOUR,
    HOURS_IN_DAY,
    DAYS_IN_YEAR,
    MILLISECONDS_IN_YEAR,
    EMPTY_GIF_B64,
    RISK_API_URI,
    CAPTCHA_URI,
    ACTIVITIES_URI,
    CONFIGURATIONS_URI,
    TELEMETRY_URI,
    TELEMETRY_COMMAND_HEADER,
    ENFORCER_TRUE_IP_HEADER,
    FIRST_PARTY_HEADER,
    FORWARDED_FOR_HEADER,
    FIRST_PARTY_VENDOR_PATH,
    FIRST_PARTY_XHR_PATH,
    FIRST_PARTY_CAPTCHA_PATH,
    DEFAULT_COLLECTOR_HOST,
    DEFAULT_CAPTCHA_HOST,
    DEFAULT_CLIENT_HOST,
    DEFAULT_CONFIGURATIONS_HOST,
    DEFAULT_BACKEND_URL,
    DEFAULT_SENSITIVE_HEADERS,
    DEFAULT_FILTER_BY_EXTENSIONS,
    DEFAULT_COOKIE_ENCRYPTION_KEYLEN,
    DEFAULT_COOKIE_ENCRYPTION_IVLEN,
    DEFAULT_COOKIE_ENCRYPTION_ITERATIONS,
    DEFAULT_COOKIE_ENCRYPTION_DIGEST,
    DEFAULT_COOKIE_ENCRYPTION_ALGO,
    DEFAULT_MODULE_VERSION,
};