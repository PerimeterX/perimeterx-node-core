"use strict";

const should = require("should");
const sinon = require("sinon");

const PxLogger = require("../lib/pxlogger");

describe("PX Logger - pxlogger.js", () => {
  let pxConfig, logger, consoleInfoStub, consoleErrorStub;

  beforeEach(() => {
    pxConfig = {
      conf: {
        DEBUG_MODE: true,
        PX_APP_ID: "PX_APP_ID",
        CUSTOM_LOGGER: null,
      },
    };
    logger = new PxLogger();
    consoleInfoStub = sinon.stub(console, "info");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    consoleInfoStub.restore();
    consoleErrorStub.restore();
  });

  it("sets PX_APP_ID and DEBUG_MODE", (done) => {
    logger.init(pxConfig);

    logger.debugMode.should.equal(true);
    logger.appId.should.equal("PX_APP_ID");
    done();
  });

  it("uses console to log when no custom logger is set", (done) => {
    logger.init(pxConfig);

    logger.internalLogger.should.be.exactly(console);

    logger.error("there was an error");
    console.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.calledOnce.should.equal(true);
    done();
  });

  it("does not call console.info when DEBUG_MODE is false", (done) => {
    pxConfig.conf.DEBUG_MODE = false
    logger.init(pxConfig);

    logger.debugMode.should.equal(false);

    logger.error("there was an error");
    console.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.calledOnce.should.equal(false);

    done();
  });

  it("uses custom logger when it is set", (done) => {
    const customLogger = {
      info: sinon.spy(),
      error: sinon.spy(),
    };
    pxConfig.conf.CUSTOM_LOGGER = customLogger;
    logger.init(pxConfig);

    logger.internalLogger.should.be.exactly(customLogger);

    logger.error("there was an error");
    console.error.called.should.equal(false);
    customLogger.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.called.should.equal(false);
    customLogger.info.calledOnce.should.equal(true);
    done();
  });
});
