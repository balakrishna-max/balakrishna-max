import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FYWiseTenders from "../components/reports/FYWiseTenders.jsx";
import DWTenders from "../components/reports/DWTenders.jsx";
import OverallReports from "../components/reports/OverallReports.jsx";
import ProcurementSummary from "../components/reports/ProcurementSummary.jsx";
import CustomReportBuilder from "../components/reports/CustomReportBuilder.jsx";
import { fetchReport } from "../services/api/dashboardApi.js";
import { getApiReportType, getReportConfig, reportCards, REPORT_IDS } from "../utils/dashboardConfig.js";
import { getFieldLabels, getReportMetrics, normalizeReportData } from "../utils/dashboardData.js";
import "../styles/Reports.css";

const REPORT_COMPONENTS = {
    fyWiseTenders: FYWiseTenders,
    dwTenders: DWTenders,
    overallReports: OverallReports,
    procurementSummary: ProcurementSummary,
    customReportBuilder: CustomReportBuilder,
};

function getReportId(pathname) {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
        return REPORT_IDS.OVERALL_REPORTS;
    }

    const match = pathname.match(/^\/mis-reports\/([^/]+)\/?$/);

    if (!match) {
        return null;
    }

    try {
        return decodeURIComponent(match[1]);
    } catch (error) {
        console.error("Invalid report URL:", error);
        return null;
    }
}

function Dashboard() {
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    const [reportCache, setReportCache] = useState({});
    const [reportFailure, setReportFailure] = useState(null);
    const reportCacheRef = useRef(reportCache);
    const pendingReports = useRef(new Map());
    const reportId = getReportId(currentPath);
    const selectedCard = reportCards.find((card) => card.id === reportId);
    const selectedReportConfig = selectedCard ? getReportConfig(selectedCard.id) : null;
    const ReportComponent = selectedReportConfig?.component
        ? REPORT_COMPONENTS[selectedReportConfig.component]
        : null;

    useEffect(() => {
        if (currentPath !== "/dashboard" && currentPath !== "/dashboard/") {
            return;
        }

        const canonicalPath = "/mis-reports/overall-reports/";
        window.history.replaceState({}, "", canonicalPath);
        setCurrentPath(canonicalPath);
    }, [currentPath]);

    useEffect(() => {
        const handlePopState = () => setCurrentPath(window.location.pathname);
        window.addEventListener("popstate", handlePopState);

        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const navigate = useCallback((path) => {
        if (window.location.pathname !== path) {
            window.history.pushState({}, "", path);
        }

        setCurrentPath(window.location.pathname);
    }, []);
    const onBack = useCallback(() => navigate("/mis-reports/"), [navigate]);

    const loadReport = useCallback((requestedReportId) => {
        if (Object.hasOwn(reportCacheRef.current, requestedReportId)) {
            return Promise.resolve(reportCacheRef.current[requestedReportId]);
        }

        const pendingRequest = pendingReports.current.get(requestedReportId);

        if (pendingRequest) {
            return pendingRequest;
        }

        const request = fetchReport({
            reportType: getApiReportType(requestedReportId),
        })
            .then((result) => {
                const nextCache = {
                    ...reportCacheRef.current,
                    [requestedReportId]: result.data,
                };
                reportCacheRef.current = nextCache;
                setReportCache(nextCache);

                return result.data;
            })
            .finally(() => {
                pendingReports.current.delete(requestedReportId);
            });

        pendingReports.current.set(requestedReportId, request);
        return request;
    }, []);

    const hasCachedReport = selectedCard
        ? Object.hasOwn(reportCache, selectedCard.id)
        : false;
    const reportData = hasCachedReport ? reportCache[selectedCard.id] : null;
    const reportError = reportFailure?.reportId === reportId
        ? reportFailure.error
        : null;
    const normalizedData = useMemo(
        () => reportData ? normalizeReportData(reportData) : null,
        [reportData]
    );

    useEffect(() => {
        if (
            !selectedCard ||
            !ReportComponent ||
            ["overallReports", "customReportBuilder"].includes(
                selectedReportConfig.component
            ) ||
            hasCachedReport
        ) {
            return undefined;
        }

        let isCancelled = false;

        loadReport(selectedCard.id).catch((error) => {
            console.error(`Failed to load report "${selectedCard.id}":`, error);

            if (!isCancelled) {
                setReportFailure({
                    reportId: selectedCard.id,
                    error,
                });
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [hasCachedReport, loadReport, ReportComponent, selectedCard, selectedReportConfig]);

    if (!selectedCard) {
        return (
            <main className="reports-page">
                <header className="reports-header">
                    <p className="reports-eyebrow">Analytics</p>
                    <h1>Reports Dashboard</h1>
                    <p>Select a report to view its data and chart.</p>
                </header>

                <section className="reports-card-grid" aria-label="Reports">
                    {reportCards.map((card) => (
                        <button
                            className="reports-card"
                            type="button"
                            key={card.id}
                            onClick={() =>
                                navigate(`/mis-reports/${encodeURIComponent(card.id)}`)
                            }
                        >
                            <span className="reports-card-copy">
                                <span className="reports-card-label">{card.label}</span>
                                <span className="reports-card-description">{card.description}</span>
                            </span>
                            <svg
                                className="reports-card-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                focusable="false"
                            >
                                {card.icon === "document" && <>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6M8 13h8M8 17h8" />
                                </>}
                                {card.icon === "procurement" && <>
                                    <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6" />
                                    <circle cx="10" cy="21" r="1" />
                                    <circle cx="18" cy="21" r="1" />
                                </>}
                                {card.icon === "department" && <>
                                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01" />
                                </>}
                                {card.icon === "analysis" && <>
                                    <path d="M4 19V5M4 19h17" />
                                    <path d="M8 15v-4M12 15V7M16 15v-6M20 15V4" />
                                </>}
                                {card.icon === "suppliers" && <>
                                    <circle cx="9" cy="8" r="3" />
                                    <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20" />
                                </>}
                                {card.icon === "bids" && <>
                                    <path d="m14 6 4 4M4 20l4-.8L20 7.2 16.8 4 4.8 16zM3 21h18" />
                                </>}
                                {card.icon === "payment" && <>
                                    <rect x="2" y="5" width="20" height="14" rx="2" />
                                    <path d="M2 10h20M6 15h4" />
                                </>}
                                {card.icon === "calendar" && <>
                                    <rect x="3" y="5" width="18" height="16" rx="2" />
                                    <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
                                </>}
                                {card.icon === "shield" && <>
                                    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
                                    <path d="m9 12 2 2 4-4" />
                                </>}
                                {card.icon === "pieChart" && <>
                                    <path d="M21.2 15A9 9 0 0 1 9 2.8M22 12A10 10 0 0 0 12 2v10z" />
                                    <path d="M12 12 4.9 19.1A10 10 0 0 0 19.1 19z" />
                                </>}
                                {card.icon === "clipboard" && <>
                                    <rect x="5" y="4" width="14" height="18" rx="2" />
                                    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" />
                                </>}
                                {card.icon === "overview" && <>
                                    <path d="M3 3v18h18M7 14l4-4 4 3 6-7" />
                                    <path d="M16 6h5v5" />
                                </>}
                            </svg>
                        </button>
                    ))}
                </section>
            </main>
        );
    }

    if (!ReportComponent) {
        return (
            <main className="reports-detail-page">
                <h1>{selectedCard.label}</h1>
                <p role="alert">
                    This report does not have a report component configured yet.
                </p>
                <button type="button" onClick={onBack}>
                    Back to reports
                </button>
            </main>
        );
    }

    if (selectedReportConfig.component === "overallReports") {
        return <ReportComponent onBack={onBack} loadReport={loadReport} />;
    }

    if (selectedReportConfig.component === "customReportBuilder") {
        return <ReportComponent onBack={onBack} loadReport={loadReport} />;
    }

    const reportProps = {
        reportId: selectedCard.id,
        title: selectedCard.label,
        data: normalizedData,
        reportError,
        isReportLoading: !hasCachedReport && !reportError,
        onBack,
    };

    if (selectedReportConfig.component === "fyWiseTenders") {
        return (
            <ReportComponent
                reportData={normalizedData}
                reportMetrics={normalizedData ? getReportMetrics(
                    normalizedData,
                    getFieldLabels(normalizedData.fields)
                ) : []}
                reportError={reportError}
                isReportLoading={!hasCachedReport && !reportError}
                onNavigate={navigate}
            />
        );
    }

    return <ReportComponent {...reportProps} />;
}

export default Dashboard;
