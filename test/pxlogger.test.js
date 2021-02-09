"use strict";

const should = require("should");
const sinon = require("sinon");

const PxLogger = require("../lib/pxlogger");

describe("PX Logger - pxlogger.js", () => {
  let params, logger, consoleInfoStub, consoleErrorStub;

  beforeEach(() => {
    params = {};
    logger = new PxLogger(params);
    consoleInfoStub = sinon.stub(console, "info");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    consoleInfoStub.restore();
    consoleErrorStub.restore();
  });

  it("sets default properties", (done) => {
    logger = new PxLogger(params);

    logger.debugMode.should.equal(false);
    logger.appId.should.equal("PX_APP_ID");
    logger.internalLogger.should.be.exactly(console);
    done();
  });

  it("uses console to log when no custom logger is set", (done) => {
    params.debugMode = true;
    logger = new PxLogger(params);

    logger.internalLogger.should.be.exactly(console);

    logger.error("there was an error");
    console.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.calledOnce.should.equal(true);
    done();
  });

  it("does not call console.info when debugMode is false", (done) => {
    params.debugMode = false;
    logger = new PxLogger(params);

    logger.debugMode.should.equal(false);

    logger.error("there was an error");
    console.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.calledOnce.should.equal(false);

    done();
  });

  it("uses custom logger when it is set", (done) => {
    params.debugMode = true;
    params.customLogger = {
      info: sinon.spy(),
      error: sinon.spy(),
    };
    logger = new PxLogger(params);

    logger.internalLogger.should.be.exactly(params.customLogger);

    logger.error("there was an error");
    console.error.called.should.equal(false);
    params.customLogger.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.called.should.equal(false);
    params.customLogger.info.calledOnce.should.equal(true);
    done();
  });
});
