import { decryptReportData, getClientPublicKey } from "../security/reportCrypto.js";
import { REPORTS_API_URL } from "../../../../config/commonURLConstants.js";

const BASE_URL = REPORTS_API_URL.replace(/\/+$/, "");

async function fetchReport({
    reportType,
}) {
    const endpoint =
        `${BASE_URL}/api/reports`;

    const clientPublicKey =
        await getClientPublicKey();

    const requestBody = {
        clientPublicKey,
        data: {
            reportType,
        },
    };

    const response = await fetch(
        endpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(
                requestBody
            ),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Report request failed with status ${response.status}.`
        );
    }

    const result =
        await response.json();

    if (!result.success) {
        throw new Error(
            "Report request was unsuccessful."
        );
    }

    if (
        !result.data ||
        !result.data.resourceName ||
        !result.data.generatedAt ||
        !result.data.payload
    ) {
        throw new Error(
            "Report response payload is invalid."
        );
    }

    const decryptedData =
        await decryptReportData({
            encryptedData:
                result.data.payload,
            reportName:
                result.data.resourceName,
            generatedAt:
                result.data.generatedAt,
        });

    return {
        ...result,
        data: decryptedData,
    };
}

/*
 * Department API integration is temporarily disabled.
 *
 * const DEPARTMENT_CACHE_KEY =
 *     "analytics-dashboard-departments";
 *
 * const DEPARTMENT_CACHE_DURATION =
 *     30 * 60 * 1000;
 *
 * async function fetchDeparments() {
 *     const cachedDeparments =
 *         localStorage.getItem(
 *             DEPARTMENT_CACHE_KEY
 *         );
 *
 *     if (cachedDeparments) {
 *         try {
 *             const parsedCache =
 *                 JSON.parse(cachedDeparments);
 *
 *             const isCacheValid =
 *                 Date.now() - parsedCache.timestamp <
 *                 DEPARTMENT_CACHE_DURATION;
 *
 *             if (
 *                 isCacheValid &&
 *                 Array.isArray(parsedCache.data)
 *             ) {
 *                 return parsedCache.data;
 *             }
 *         } catch (error) {
 *             console.error(
 *                 "Failed to read department cache:",
 *                 error
 *             );
 *
 *             localStorage.removeItem(
 *                 DEPARTMENT_CACHE_KEY
 *             );
 *         }
 *     }
 *
 *     const endpoint =
 *         `${BASE_URL}/api/departments`;
 *
 *     const clientPublicKey =
 *         await getClientPublicKey();
 *
 *     const requestBody = {
 *         clientPublicKey,
 *         data: {},
 *     };
 *
 *     const response = await fetch(
 *         endpoint,
 *         {
 *             method: "POST",
 *             headers: {
 *                 "Content-Type": "application/json",
 *             },
 *             body: JSON.stringify(requestBody),
 *         }
 *     );
 *
 *     if (!response.ok) {
 *         throw new Error(
 *             `Deparment request failed with status ${response.status}.`
 *         );
 *     }
 *
 *     const result = await response.json();
 *
 *     if (!result.success) {
 *         throw new Error(
 *             "Deparment request was unsuccessful."
 *         );
 *     }
 *
 *     if (
 *         !result.data
 *         || !result.data.resourceName
 *         || !result.data.generatedAt
 *         || !result.data.payload
 *     ) {
 *         throw new Error(
 *             "Deparment response payload is invalid."
 *         );
 *     }
 *
 *     const departments =
 *         await decryptReportData({
 *             encryptedData:
 *                 result.data.payload,
 *             reportName:
 *                 result.data.resourceName,
 *             generatedAt:
 *                 result.data.generatedAt,
 *         });
 *
 *     if (!Array.isArray(departments)) {
 *         throw new Error(
 *             "Decrypted department data is invalid."
 *         );
 *     }
 *
 *     localStorage.setItem(
 *         DEPARTMENT_CACHE_KEY,
 *         JSON.stringify({
 *             timestamp: Date.now(),
 *             data: departments,
 *         })
 *     );
 *
 *     return departments;
 * }
 */

export {
    fetchReport,
    /*
     * Department API integration temporarily disabled.
     * fetchDeparments,
     */
};
