class Response {
    constructor(headers) {
        this.headers = headers;
    }

    getHeader(headerName) {
        return this.headers[headerName];
    }

    setHeader(headerName, headerValue) {
        this.headers[headerName] = headerValue;
    }
}

module.exports = Response;