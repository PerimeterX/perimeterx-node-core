[![Build Status](https://travis-ci.org/PerimeterX/perimeterx-node-core.svg?branch=master)](https://travis-ci.org/PerimeterX/perimeterx-node-core)
[![Known Vulnerabilities](https://snyk.io/test/github/PerimeterX/perimeterx-node-core/badge.svg?targetFile=package.json)](https://snyk.io/test/github/PerimeterX/perimeterx-node-core?targetFile=package.json)

![image](https://storage.googleapis.com/perimeterx-logos/primary_logo_red_cropped.png)

[PerimeterX](http://www.perimeterx.com) Shared base for NodeJS enforcers
=============================================================

> Latest stable version: [v3.0.2](https://www.npmjs.com/package/perimeterx-node-core)

This is a shared base implementation for PerimeterX Express enforcer and future NodeJS enforcers. For a fully functioning implementation example, see the [Node-Express enforcer](https://github.com/PerimeterX/perimeterx-node-express/) implementation.

Table of Contents
-----------------

- [Usage](#usage)
    * [Installation](#installation)
    *  [Basic Usage Example](#basic-usage)
- [Contributing](#contributing)
    *  [Tests](#tests)

<a name="Usage"></a>

<a name="installation"></a> Installation
----------------------------------------

`$ npm install --save perimeterx-node-core`

### <a name="basic-usage"></a> Basic Usage Example
To integrate this module into an enforcer, users should initialize the enforcer.
```javascript
function initPXModule(params, client) {
    params.px_module_version = '<your module version>';
    enforcer = new PxEnforcer(params, client);
    //if dynamic configurations is configured
    if (enforcer.config.conf.DYNAMIC_CONFIGURATIONS) {
        setInterval(enforcer.config.confManager.loadData.bind(enforcer.config.confManager), enforcer.config.conf.CONFIGURATION_LOAD_INTERVAL);
    }
}
```

On every request, call `enforce`.
```javascript
/**
 * pxMiddleware - middleware wrapper to score verification.
 *
 * @param {Object} req - HTTP Request.
 * @param {Object} res - HTTP Response.
 * @param {Function} next - callback function.
 */
function pxMiddleware(req, res, next) {
    enforcer.enforce(req, res, (response) => {
        if (response) { //block
            res.status(response.status);
            res.setHeader(response.header.key, response.header.value);
            res.send(response.body);
        } else { //pass
            next();
        }
    });
}
```

Extend the `PxClient` class to send activities to PerimeterX.
```javascript
const { PxClient } = require('perimeterx-node-core');

class MyClient extends PxClient {
    init(config) {
        setInterval(() => {
            this.submitActivities(config);
        }, 1000);
    }
}

module.exports = { MyClient };
```

Make sure to pass the client instance when initializing the enforcer.
```javascript
function initPXModule(params) {
    params.px_module_version = '<your module version>';
    const pxClient = new MyClient();
    enforcer = new PxEnforcer(params, pxClient);
    //if dynamic configurations is configured
    if (enforcer.config.conf.DYNAMIC_CONFIGURATIONS) {
        setInterval(enforcer.config.confManager.loadData.bind(enforcer.config.confManager), enforcer.config.conf.CONFIGURATION_LOAD_INTERVAL);
    }
}
```

<a name="contributing"></a> Contributing
----------------------------------------

The following steps are welcome when contributing to our project:
### Fork/Clone
First and foremost, [Create a fork](https://guides.github.com/activities/forking/) of the repository, and clone it locally.
Create a branch on your fork, preferably using a self descriptive branch name.

### Code/Run
Help improve our project by implementing missing features, adding capabilites or fixing bugs.

To run the code, simply follow the steps in the [installation guide](#installation). Grab the keys from the PerimeterX Portal, and try refreshing your page several times continously. If no default behaviours have been overriden, you should see the PerimeterX block page. Solve the CAPTCHA to clean yourself and start fresh again.

### Test
> Tests for this project are written using [Mocha](https://mochajs.org/).

**Dont forget to test**. The project relies heavily on tests, thus ensuring each user has the same experience, and no new features break the code.
Before you create any pull request, make sure your project has passed all tests, and if any new features require it, write your own.


##### <a name="tests"></a> Running tests

```bash
$ npm test
```

> Note: running tests without a valid PerimeterX app id, auth token and
> cookie key will not work.

### Pull Request
After you have completed the process, create a pull request to the Upstream repository. Please provide a complete and thorough description explaining the changes. Remember this code has to be read by our maintainers, so keep it simple, smart and accurate.

