import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./pages/Dashboard.jsx";
import Reports from "./pages/Reports.jsx";
import { fetchMisReport } from "./services/api/dashboardApi.js";
import "./reports-embed.css";

const roots = new WeakMap();

const MIS_REPORT_TYPES = {
    tenders: "tcc",
};

function getReportId(pathname) {
    const match = pathname.match(
        /^\/(?:mis-reports|reports-dashboard)\/([^/]+)\/?$/
    );

    return match ? decodeURIComponent(match[1]) : null;
}

function ReportsApp() {
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    const [reportCache, setReportCache] = useState({});
    const pendingReports = useRef(new Map());

    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    const navigate = useCallback((path) => {
        if (window.location.pathname !== path) {
            window.history.pushState({}, "", path);
        }

        setCurrentPath(window.location.pathname);
    }, []);

    const loadReport = useCallback((reportType) => {
        if (Object.hasOwn(reportCache, reportType)) {
            return Promise.resolve(reportCache[reportType]);
        }

        const pendingRequest = pendingReports.current.get(reportType);

        if (pendingRequest) {
            return pendingRequest;
        }

        const request = fetchMisReport({
            reportType: MIS_REPORT_TYPES[reportType] || reportType,
        })
            .then((result) => {
                setReportCache((currentCache) => ({
                    ...currentCache,
                    [reportType]: result.data,
                }));

                return result.data;
            })
            .finally(() => {
                pendingReports.current.delete(reportType);
            });

        pendingReports.current.set(reportType, request);

        return request;
    }, [reportCache]);

    if (currentPath.startsWith("/dashboard")) {
        return <Dashboard />;
    }

    return (
        <Reports
            reportId={getReportId(currentPath)}
            reportCache={reportCache}
            loadReport={loadReport}
            onNavigate={navigate}
        />
    );
}

function mount(container, extraConfig) {
    container = container || document.getElementById("a2z-reports-root");

    if (!(container instanceof Element)) {
        throw new TypeError("Reports: a valid DOM element is required.");
    }

    if (roots.has(container)) {
        return roots.get(container);
    }

    const config = {
        height: container.dataset.height || "",
        ...(extraConfig || {}),
    };

    container.textContent = "";
    container.classList.add("a2z-reports", "analytics-dashboard-embed");

    if (config.height) {
        container.style.height = config.height;
    }

    const root = createRoot(container);
    roots.set(container, root);
    root.render(<ReportsApp />);

    return root;
}

function unmount(container) {
    container = container || document.getElementById("a2z-reports-root");

    const root = container && roots.get(container);

    if (!root) {
        return;
    }

    root.unmount();
    roots.delete(container);
}

function open(config) {
    return mount(null, config);
}

const close = unmount;

window.ReportDashboard = { mount, unmount };

export { mount, unmount, open, close };
