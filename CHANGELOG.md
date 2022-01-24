# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [3.2.0] - 2022-01-24

### Added

- Support for credentials intelligence protocols `v1` and `multistep_sso`
- Support for login successful reporting methods `header`, `status`, and `custom`
- Support for automatic sending of `additional_s2s` activity
- Support for manual sending of `additional_s2s` activity via header or API call
- Support for sending raw username on `additional_s2s` activity
- Support for login credentials extraction via custom callback
- New `request_id` field to all enforcer activities

### Changed

- Login credentials extraction handles body encoding based on `Content-Type` request header
- Successful login credentials extraction automatically triggers risk_api call without needing to enable sensitive routes

### Fixed

- Enforced routes work in monitor mode
- Bypass monitor header works with configured monitored routes

## [3.1.2] - 2022-01-18

### Added

- Code Defender first party XHR and first party Sensor support

## [3.1.1] - 2021-12-29

### Added

- server_info_origin to all Enforcer activities, indicates which CDN POP/Datacenter the request hit
- sensitive route based on GraphQL payload

### Fixed

- Enforced route bugfix

## [3.1.0] - 2021-11-28

### Changed

-   Login credentials extraction sends hashed credentials (`creds`) instead of `pass`
-   Login credentials extraction normalizes username field to lowercase prior to hashing
-   Login credentials extraction fields align with spec (all `snake_case`, not `camelCase`)
-   Login credentials extraction handles body encoding based on `Content-Type` request header

### Added

-   Login credentials extraction paths are added as sensitive routes automatically
-   Added `raw_username` field with default value `null` to `additional_s2s` activity


## [3.0.3] - 2021-11-24

### Added

-   Additional activity header feature support

## [3.0.2] - 2021-11-14

### Added

-   Nonce support in CSP header

## [3.0.1] - 2021-10-25

### Added

-   Compromised credentials header support

## [3.0.0] - 2021-09-26

### Changed

-   Configuration changes to match [Enforcer Spec v1.0.0](https://github.com/PerimeterX/px-enforcer-spec)

## [2.13.1] - 2021-07-04

### Added

-   Bug fix: Cookie decryption fails on mobile sdk error

## [2.13.0] - 2021-06-08

### Added

-   CSP Support.

## [2.12.1] - 2021-05-25

### Fixed

-   Wrong reporting for bypass monitor header.

## [2.12.0] - 2021-04-08

### Added

-   Data Enrichment parsing.

## [2.11.0] - 2021-04-07

### Added

-   Support for regular expressions in filter by user agent

## [2.10.0] - 2021-03-29

### Added

-   Support for login credentials extraction

## [2.9.0] - 2021-02-09

### Added

-   Support for `customCookieHeader`

## [2.8.0] - 2020-11-24

### Added

-   New config to support custom logger

### Changed

-   `telemetry_handler.js` to use the logger in config rather than creating its own
-   `PxLogger` to directly consume user-defined `params` to remove circular dependecy between `PxConfig` and `PxLogger`

### Fixed

-   String interpolation syntax errors in `telemetry_handler.js`
-   Bug where `debug` logs in `PxConfig` never gets called
-   Issue where `debug` does not check `msg` type the same way `error` does

## [2.7.2] - 2020-10-22

### Fixed

-   Support for `ACTIVITIES_TIMEOUT_MS`.

## [2.7.1] - 2020-04-21

### Added

-   New config to support `Secure` flag for pxhd cookie

## [2.7.0] - 2020-03-29

### Added

-   Support for external activities

## [2.6.2] - 2020-02-11

### Fixed

-   Custom parameters for async activities.

## [2.6.1] - 2020-02-11

### Fixed

-   `originalRequest` support for ExpressJS.

## [2.6.0] - 2019-12-08

### Added

-   Support for filtering traffic by http method

## [2.5.0] - 2019-11-26

### Added

-   Support for regex in enforced/whitelisted/monitored specific routes.
-   Support for filtering traffic by IPs/CIDRs.
-   Support for filtering traffic by user agents.

## [2.4.1] - 2019-11-19

### Fixed

-   cssRef, jsRef string values

## [2.4.0] - 2019-10-15

### Added

-   Send HTTP method on async activities
-   Support for specific enforced routes and specific monitored routes

### Fixed

-   Upgraded dependency

## [2.3.2] - 2019-10-02

### Fixed

-   Upgraded dependency

## [2.3.1] - 2019-09-02

### Fixed

-   Upgraded ESLint version

## [2.3.0] - 2019-07-28

### Added

-   Support for custom templates
-   Request object is now passed to `enrichCustomParams` function

### Fixed

-   PXHD cookie will not echo back from client

## [2.2.1] - 2019-05-24

### Added

-   fixed timeout error, lint fixes
-   removed node 11 from tests because it turned EOL

### Fixed

-   pxhd cookie not been sent in block activity
-   Do not echo back pxhd cookie coming from client
-   set pxhd expiration

## [2.2.0] - 2019-05-06

### Added

-   Send telemetry by command

## [2.1.1] - 2019-05-02

### Fixed

-   pxConfig setting for proxy
-   Risk API timeout check

## [2.1.0] - 2019-03-19

### Added

-   Add advanced blocking response configuration

## [2.0.0] - 2019-03-14

### Added

-   Support for multiple instances of PxEnforcer (for multi px-app in same web app)

### Refactored

-   Major parts of the code to inject an instance of PxLogger and PX config.

### Changed

-   Changed PxClient.submitActivities() signature to receive a config object.

## [1.8.0] - 2019-02-25

### Added

-   Support for testing blocking flow in monitor mode

### Fixed

-   VID validity check

## [1.7.0] - 2018-01-11

### Fixed

-   Full refactor of proxy support
-   Lowercasing of json response
-   Various PXHD related issues

## [1.6.1] - 2018-01-06

### Fixed

-   Proxy_url parameter in first-party captcha.js call

## [1.6.0] - 2018-01-02

### Added

-   Added PXHD handling
-   Added async custom params
-   Added data enrichment cookie handling
-   Added Proxy support

## [1.5.0] - 2018-10-29

### Fixed

-   px_cookie_hmac was missing from risk api calls
-   First party captcha fallback

### Added

-   Configurable testing mode
-   New call reason 'no_cookie_key'

## [1.4.2] - 2018-07-30

### Fixed

-   Phin callback related issue
-   Better handling of activities when customRequestHandler is used
-   Better error messages for requests

## [1.4.1] - 2018-07-29

### Fixed

-   Various fixes regarding page_requested and pass_reason

## [1.4.0] - 2018-07-11

### Added

-   Refactored request module to use Phin.js

### Fixed

-   Better handling for custom request handler

## [1.3.2] - 2018-07-09

### Fixed

-   Error handling for non-response requests

## [1.3.1] - 2018-06-19

### Fixed

-   Better error handling

## [1.3.0] - 2018-06-10

### Added

-   Advanced Blocking Response
-   Simulated_block property on Risk API call
-   Enrich Custom Parameters support
-   Captcha v2 support
-   Ratelimit support

### Fixed

-   Empty ipHeaders property handling
-   Various first party fixes

## [1.2.1] - 2018-02-28

### Fixed

-   Sending originial cookie on decryption failed

## [1.2.0] - 2018-02-19

### Added

-   Added funCaptcha support for mobile

### Modified

-   First party mode enabled by default
-   Improved first party mode
-   Update templates to support smart snippet

## [1.1.4] - 2018-02-15

### Fixed

-   FunCaptcha compatibility for mobile
-   Various first party fixes

## [1.1.3] - 2018-01-24

### Modified

-   Stability related fixes

## [1.1.2] - 2018-01-22

### Modified

-   Changed default value for client url

## [1.1.1] - 2018-01-22

### Modified

-   Changed default value for first party

## [1.1.0] - 2018-01-22

### Added

-   First party support

### Modified

-   Handle original token for mobile
