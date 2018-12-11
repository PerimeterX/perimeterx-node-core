# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.5.0] - 2018-10-29
### Fixed
- px_cookie_hmac was missing from risk api calls
- First party captcha fallback

### Added
- Configurable testing mode
- New call reason 'no_cookie_key'

## [1.4.2] - 2018-07-30
### Fixed
- Phin callback related issue
- Better handling of activities when customRequestHandler is used
- Better error messages for requests

## [1.4.1] - 2018-07-29
### Fixed
- Various fixes regarding page_requested and pass_reason

## [1.4.0] - 2018-07-11
### Added
- Refactored request module to use Phin.js

### Fixed
- Better handling for custom request handler

## [1.3.2] - 2018-07-09
### Fixed
- Error handling for non-response requests

## [1.3.1] - 2018-06-19
### Fixed
- Better error handling

## [1.3.0] - 2018-06-10
### Added
- Advanced Blocking Response
- Simulated_block property on Risk API call
- Enrich Custom Parameters support
- Captcha v2 support
- Ratelimit support

### Fixed
- Empty ipHeaders property handling
- Various first party fixes

## [1.2.1] - 2018-02-28
### Fixed
- Sending originial cookie on decryption failed

## [1.2.0] - 2018-02-19
### Added
- Added funCaptcha support for mobile
### Modified
- First party mode enabled by default
- Improved first party mode
- Update templates to support smart snippet

## [1.1.4] - 2018-02-15
### Fixed
- FunCaptcha compatibility for mobile
- Various first party fixes

## [1.1.3] - 2018-01-24
### Modified
- Stability related fixes

## [1.1.2] - 2018-01-22
### Modified
- Changed default value for client url

## [1.1.1] - 2018-01-22
### Modified
- Changed default value for first party

## [1.1.0] - 2018-01-22
### Added
- First party support
### Modified
- Handle original token for mobile
