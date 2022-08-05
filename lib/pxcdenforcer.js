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
const CD_COOCKIE = '__pxvid';
const { CSP_HEADER, CSPRO_HEADER } = require('./utils/constants');

function CdEnforce (cspData, req, res) {
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
            response.setHeader(CSP_HEADER, csp);
        }

        let cspReportOnly = getCSPROHeader(cspData, CSP_DATA.CSPRO_EXPOSURE, CSP_DATA.CSPRO, rand, sessionId, vid);
        if (cspReportOnly) {
            response.setHeader(CSPRO_HEADER, cspReportOnly);
        } else {
            cspReportOnly = getCSPROHeader(cspData, CSP_DATA.CSPRO_2_EXPOSURE, CSP_DATA.CSPRO_2, rand, sessionId, vid);
            if (cspReportOnly) {
                response.setHeader(CSPRO_HEADER, cspReportOnly);
            }
        }
    } catch (e) {
        // CSP couldn't be read, continue without it
        console.log(`Exception Caught in HandleCSP. error: ${e}`);
    }
}

function getCSPROHeader(cspData, exposureKey, policyKey, rand, sessionId, vid) {
    const percentage = parseInt(cspData[exposureKey]);
    if (rand <= percentage) {
        let cspReportOnly = cspData[policyKey];
        if (cspReportOnly) {
            cspReportOnly = updateCspReportUri(cspReportOnly, sessionId, vid);
            return cspReportOnly;
        }
    }
}

function updateCspReportUri(policy, sessionId, vid) {
    const matches = policy.match(/report-uri ([^ ;]+)/);
    if (matches && matches.length > 1) {
        const reportUrl = new URL(matches[1]);
        reportUrl.searchParams.append(CSP_DATA.SESSION_ID_QUERY_PARAM, sessionId);
        if (vid) {
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
    if (cookies && cookies[CD_COOCKIE]) {
        return cookies[CD_COOCKIE];
    }
}

module.exports = CdEnforce;