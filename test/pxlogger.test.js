"use strict";

const should = require("should");
const sinon = require("sinon");
const { LoggerSeverity } = require("../lib/enums/LoggerSeverity");

const PxLogger = require("../lib/pxlogger");

describe("PX Logger - pxlogger.js", () => {
  let params, logger, consoleInfoStub, consoleErrorStub;

  beforeEach(() => {
    params = {};
    logger = new PxLogger('', '');
    consoleInfoStub = sinon.stub(console, "info");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    consoleInfoStub.restore();
    consoleErrorStub.restore();
  });

  it("sets default properties", (done) => {
    logger = new PxLogger('PX_APP_ID', '');

    logger.appId.should.equal("PX_APP_ID");
    logger.debugMode.should.equal(false);
    logger.internalLogger.should.be.exactly(console);
    done();
  });

  it("uses console to log when no custom logger is set", (done) => {
    logger = new PxLogger('PX_APP_ID', LoggerSeverity.DEBUG);

    logger.internalLogger.should.be.exactly(console);

    logger.error("there was an error");
    console.error.calledOnce.should.equal(true);

    logger.debug("debug message");
    console.info.calledOnce.should.equal(true);
    done();
  });

  it("does not call console.info when debugMode is false", (done) => {
    logger = new PxLogger('PX_APP_ID', LoggerSeverity.FATAL);

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
    logger = new PxLogger('PX_APP_ID', LoggerSeverity.DEBUG, customLogger);

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
