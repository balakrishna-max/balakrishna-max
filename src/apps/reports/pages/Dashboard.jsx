import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FYWiseTenders from "../components/reports/FYWiseTenders.jsx";
import DWTenders from "../components/reports/DWTenders.jsx";
import OverallReports from "../components/reports/OverallReports.jsx";
import ProcurementSummary from "../components/reports/ProcurementSummary.jsx";
import { fetchReport } from "../services/api/dashboardApi.js";
import { getApiReportType, getReportConfig, reportCards, REPORT_IDS } from "../utils/dashboardConfig.js";
import { getFieldLabels, getReportMetrics, normalizeReportData } from "../utils/dashboardData.js";
import "../styles/Reports.css";

const REPORT_COMPONENTS = {
    fyWiseTenders: FYWiseTenders,
    dwTenders: DWTenders,
    overallReports: OverallReports,
    procurementSummary: ProcurementSummary,
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
            selectedReportConfig.component === "overallReports" ||
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
                    {reportCards.map((card, index) => (
                        <button
                            className={`reports-card ${getReportConfig(card.id)?.component === "overallReports" ? "reports-card-overall" : ""}`}
                            type="button"
                            key={card.id}
                            onClick={() =>
                                navigate(`/mis-reports/${encodeURIComponent(card.id)}`)
                            }
                        >
                            <span className="reports-card-number">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="reports-card-label">{card.label}</span>
                            <span className="reports-card-link">
                                {getReportConfig(card.id)?.component === "overallReports" ? "Open dashboard" : "View report"}
                                <span aria-hidden="true"> →</span>
                            </span>
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
