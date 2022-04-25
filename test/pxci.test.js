const should = require('should');
const { V2CredentialsIntelligenceProtocol } = require('../lib/extract_field/credentials_intelligence/V2CredentialsIntelligenceProtocol');

describe('Check Credentials Intelligent v2 hashing', function() {
    it('Should hash username', (done) => {
        const credentialsBody = { username: 'pxUser', password: '1234' };

        const protocol = new V2CredentialsIntelligenceProtocol();
        const hashedCredentials = protocol.ProcessCredentials(credentialsBody.username, credentialsBody.password);

        (hashedCredentials.username).should.equal('9620f4cab3b3a50b9cbcb9a8d01328874ec33eb6882ae31c022f6986fc516851');
        (hashedCredentials.password).should.equal('c958c33151f273c620ec658ac4de9abd33ad7627df5d8c468224b0bae7173eb4');
        done();
    });

    it('Should normalize and hash gmail', (done) => {
        const credentialsBody = { username: 'pxUser', password: '1234' };

        const protocol = new V2CredentialsIntelligenceProtocol();
        const hashedCredentials = protocol.ProcessCredentials(credentialsBody.username, credentialsBody.password);

        (hashedCredentials.username).should.equal('9620f4cab3b3a50b9cbcb9a8d01328874ec33eb6882ae31c022f6986fc516851');
        (hashedCredentials.password).should.equal('c958c33151f273c620ec658ac4de9abd33ad7627df5d8c468224b0bae7173eb4');
        done();
    });


    it('Should normalize and hash gmail', (done) => {
        const credentialsBody = { username: 'Perimeter.X+001@gmail.com', password: '1234' };

        const protocol = new V2CredentialsIntelligenceProtocol();
        const hashedCredentials = protocol.ProcessCredentials(credentialsBody.username, credentialsBody.password);

        (hashedCredentials.username).should.equal('2bd9bd06f3440c682044a3f1b1fa7a97bd8b568a6e9e7d2cb0c6e858d9c78069');
        (hashedCredentials.password).should.equal('5246d99e5d2506d70db44e8216aecb7be42bf5bf7bc1766a680cbdad2ce046ab');
        done();
    });

    it('Should normalize and hash mail', (done) => {
        const credentialsBody = { username: 'Perimeter.X+001@perimeterx.com', password: '1234' };

        const protocol = new V2CredentialsIntelligenceProtocol();
        const hashedCredentials = protocol.ProcessCredentials(credentialsBody.username, credentialsBody.password);

        (hashedCredentials.username).should.equal('53225d1fa939355031fa2208a44ada1bf9953f0d0daf894baa984a4310df6b48');
        (hashedCredentials.password).should.equal('ddf40c1584801828bda92cc493373d045de593f73c4fb40aab5de7f19aa8df94');
        done();
    });
});