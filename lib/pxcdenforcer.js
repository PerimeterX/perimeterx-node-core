const { v4: uuidv4 } = require('uuid');
const CSP_DATA = {
    CSP: 'csp',
    CSPRO: 'cspro',
    CSPRO_EXPOSURE: 'cspro_exposure',
    CSPRO_2: 'cspro_p2',
    CSPRO_2_EXPOSURE: 'cspro_p2_exposure',
    SESSION_ID_QUERY_PARAM: 'p',
    VID_QUERY_PARAM: 'v',
    REPORT_URI_STRING_LENGTH: 11
};

function CdEnforce (cspData, req, res){
    const cdVid = getCdCookie(req);
    handleCSP(res, cspData, cdVid);

}

function handleCSP(response, cspData, vid) {
    const rand = Math.floor(Math.random() * 100) + 1; //random number between 1-100 include
    try {
        let csp = cspData[CSP_DATA.CSP];
        const sessionId = uuidv4();
        if (csp) {
            csp = updateCspReportUri(csp, sessionId, vid);
            response.setHeader('Content-Security-Policy', csp);
        }
        const percentage = parseInt(cspData[CSP_DATA.CSPRO_EXPOSURE]);
        if (rand <= percentage) {
            let cspReportOnly = cspData[CSP_DATA.CSPRO];
            if (cspReportOnly) {
                cspReportOnly = updateCspReportUri(cspReportOnly, sessionId, vid);
                response.setHeader('Content-Security-Policy-Report-Only', cspReportOnly);
            }
        }
        else {
            const percentageP2 = parseInt(cspData[CSP_DATA.CSPRO_2_EXPOSURE]);
            if (rand <= percentageP2) {
                let cspReportOnly = cspData[CSP_DATA.CSPRO_2];
                if (cspReportOnly) {
                    cspReportOnly = updateCspReportUri(cspReportOnly, sessionId, vid);
                    response.setHeader('Content-Security-Policy-Report-Only', cspReportOnly);
                }
            }
        }
    } catch (e) {
        // CSP couldnt be read, continue without it
        console.log(`Exception Caught in HandleCSP. error: ${e}`);
    }
}

function updateCspReportUri(policy, sessionId, vid) {
    const matches = policy.match(/report-uri ([^ ;]+)/);
    if (matches && matches.length > 1) {
        const reportUrl = new URL(matches[1]);
        reportUrl.searchParams.append(CSP_DATA.SESSION_ID_QUERY_PARAM, sessionId);
        if (vid){
            reportUrl.searchParams.append(CSP_DATA.VID_QUERY_PARAM, vid);
        }
        const result = reportUrl.toString();
        const index = matches.index + matches[0].length;
        policy = policy.slice(0, matches.index + CSP_DATA.REPORT_URI_STRING_LENGTH) + result + policy.slice(index);
    }

    return policy;
}

function getCdCookie(req) {
    const cookies = req.cookies;
    if (cookies && cookies['__pxvid']) {
        return cookies['__pxvid'];
    }
}

module.exports = CdEnforce;