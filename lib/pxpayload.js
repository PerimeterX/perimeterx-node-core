'use strict';

const crypto = require('crypto');
class Payload {
    constructor(config) {
        //cookie string
        this.pxCookie = '';

        //decoded cookie string
        this.decodedCookie = '';

        //PerimeterX configuration object
        this.config = config;

        //PerimeterX context
        this.ctx = {};

        //cookie secret string
        this.cookieSecret = '';
    }

    /**
     * Checks if the cookie's score is above the configured blocking score
     * @returns {boolean}
     */
    isHighScore() {
        return this.getScore() >= this.config.BLOCKING_SCORE;
    }

    /**
     * Checks if the cookie has expired
     * @returns {boolean}
     */
    isExpired() {
        return this.getTime() < Date.now();
    }

    /**
     * Checks that the cookie was deserialized successfully, has not expired, and is secure
     * @returns {boolean}
     */
    isValid() {
        return this.deserialize() && !this.isExpired() && this.isSecure();
    }

    getTime() {
        return this.decodedCookie.t;
    }

    getUuid() {
        return this.decodedCookie.u || '';
    }

    getVid() {
        return this.decodedCookie.v || '';
    }

    /**
     * Deserializes an encrypted and/or encoded cookie string.
     *
     * This must be called before using an instance.
     * @returns {boolean}
     */
    deserialize() {
        if (this.decodedCookie) {
            return true;
        }
        let cookie;
        if (this.config.COOKIE_ENCRYPTION) {
            cookie = this.decrypt();
        } else {
            cookie = this.decode();
        }
        if (cookie === '' || !this.isCookieFormatValid(cookie)) {
            return false;
        }

        this.decodedCookie = cookie;
        return true;
    }

    /**
     * Decrypts an encrypted Perimeterx cookie
     * @returns {string}
     */
    decrypt() {
        try {
            const data = this.pxCookie.split(':');
            if (data.length !== 3) {
                this.config.logger.debug('invalid cookie format - wrong number of parts');
                return '';
            }
            const iterations = Number(data[1]);
            const encryptedCookie = data[2];
            /* iterations value is not a number */
            if (!iterations) {
                this.config.logger.debug('invalid cookie format - iterations value is not a number');
                return '';
            }

            /* iterations value is not in the legit range */
            if (iterations > 5000 || iterations < 500) {
                this.config.logger.debug('invalid cookie format - iterations out of bounds');
                return '';
            }

            /* salt value is not as expected */
            if (!data[0] || typeof data[0] !== 'string' || data[0].length > 100) {
                this.config.logger.debug('invalid cookie format - invalid salt value');
                return '';
            }

            /* cookie value is not as expected */
            if (!encryptedCookie || typeof encryptedCookie !== 'string') {
                this.config.logger.debug('invalid cookie format - no cookie value');
                return '';
            }

            const salt = Buffer.from(data[0], 'base64');
            const derivation = crypto.pbkdf2Sync(
                this.cookieSecret,
                salt,
                iterations,
                this.config.CE_KEYLEN + this.config.CE_IVLEN,
                this.config.CE_DIGEST,
            );
            const key = derivation.slice(0, this.config.CE_KEYLEN);
            const iv = derivation.slice(this.config.CE_KEYLEN);

            const cipher = crypto.createDecipheriv(this.config.CE_ALGO, key, iv);
            let decrypted = cipher.update(encryptedCookie, 'base64', 'utf8');
            decrypted += cipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (err) {
            this.config.logger.error('Error while decrypting Perimeterx cookie: ' + err.message);
            return '';
        }
    }

    /**
     * Decodes an unencrypted (base64) Perimeterx cookie
     */
    decode() {
        const decodedStr = new Buffer(this.pxCookie, 'base64').toString('utf8');
        return JSON.parse(decodedStr);
    }

    isHmacValid(hmacStr, cookieHmac) {
        try {
            const hmac = crypto.createHmac(this.config.CE_DIGEST, this.cookieSecret);
            hmac.setEncoding('hex');
            hmac.write(hmacStr);
            hmac.end();
            const h = hmac.read();
            return h === cookieHmac;
        } catch (err) {
            this.config.logger.error('Error while validating Perimeterx cookie: ' + err.stack);
        }
    }
}

module.exports = Payload;
