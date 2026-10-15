import { decryptReportData, getClientPublicKey } from "../security/reportCrypto.js";
import { REPORTS_API_URL } from "../../../../config/commonURLConstants.js";

const BASE_URL = REPORTS_API_URL;
const REPORTS_ENDPOINT = "/api/reports";

async function fetchReport({reportType}) {
    const endpoint = `${BASE_URL}${REPORTS_ENDPOINT}`;
    const clientPublicKey = await getClientPublicKey();
    const requestBody = {clientPublicKey, data: {reportType}};
    const response = await fetch(endpoint,
        {method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(requestBody),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Report request to "${REPORTS_ENDPOINT}" failed with status ${response.status}.`
        );
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error("Report request was unsuccessful.");
    }

    if (!result.data || !result.data.resourceName || !result.data.generatedAt || !result.data.payload) {
        throw new Error("Report response payload is invalid.");
    }

    const decryptedData = await decryptReportData({
            encryptedData: result.data.payload,
            reportName: result.data.resourceName,
            generatedAt: result.data.generatedAt
        });

    return {...result, data: decryptedData};
}

export {fetchReport};
