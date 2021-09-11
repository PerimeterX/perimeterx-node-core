'use strict';

const crypto = require('crypto');

const {
    DEFAULT_COOKIE_ENCRYPTION_KEYLEN,
    DEFAULT_COOKIE_ENCRYPTION_DIGEST,
    DEFAULT_COOKIE_ENCRYPTION_ALGO,
    DEFAULT_COOKIE_ENCRYPTION_IVLEN
} = require('./utils/constants');

class Payload {
    constructor(pxConfig) {
        this.pxCookie = '';
        this.decodedCookie = '';
        this.config = pxConfig.Config;
        this.logger = pxConfig.Logger;
        this.ctx = {};
        this.cookieSecret = '';
    }

    /**
     * Checks if the cookie's score is above the configured blocking score
     * @returns {boolean}
     */
    isHighScore() {
        return this.getScore() >= this.config.px_blocking_score;
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
        const cookie = this.decrypt();
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
                this.logger.debug('invalid cookie format - wrong number of parts');
                return '';
            }
            const iterations = Number(data[1]);
            const encryptedCookie = data[2];
            /* iterations value is not a number */
            if (!iterations) {
                this.logger.debug('invalid cookie format - iterations value is not a number');
                return '';
            }

            /* iterations value is not in the legit range */
            if (iterations > 5000 || iterations < 500) {
                this.logger.debug('invalid cookie format - iterations out of bounds');
                return '';
            }

            /* salt value is not as expected */
            if (!data[0] || typeof data[0] !== 'string' || data[0].length > 100) {
                this.logger.debug('invalid cookie format - invalid salt value');
                return '';
            }

            /* cookie value is not as expected */
            if (!encryptedCookie || typeof encryptedCookie !== 'string') {
                this.logger.debug('invalid cookie format - no cookie value');
                return '';
            }

            const salt = Buffer.from(data[0], 'base64');
            const derivation = crypto.pbkdf2Sync(
                this.cookieSecret,
                salt,
                iterations,
                DEFAULT_COOKIE_ENCRYPTION_KEYLEN + DEFAULT_COOKIE_ENCRYPTION_IVLEN,
                DEFAULT_COOKIE_ENCRYPTION_DIGEST,
            );
            const key = derivation.slice(0, DEFAULT_COOKIE_ENCRYPTION_KEYLEN);
            const iv = derivation.slice(DEFAULT_COOKIE_ENCRYPTION_KEYLEN);

            const cipher = crypto.createDecipheriv(DEFAULT_COOKIE_ENCRYPTION_ALGO, key, iv);
            let decrypted = cipher.update(encryptedCookie, 'base64', 'utf8');
            decrypted += cipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (err) {
            this.logger.error('Error while decrypting Perimeterx cookie: ' + err.message);
            return '';
        }
    }

    /**
     * Decodes an unencrypted (base64) Perimeterx cookie
     */
    decode() {
        const decodedStr = Buffer.from(this.pxCookie, 'base64').toString('utf8');
        return JSON.parse(decodedStr);
    }

    isHmacValid(hmacStr, cookieHmac) {
        try {
            const hmac = crypto.createHmac(DEFAULT_COOKIE_ENCRYPTION_DIGEST, this.cookieSecret);
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
