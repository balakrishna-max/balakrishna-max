import { useEffect, useMemo, useState } from "react";
import DashboardVisualization from "../components/DashboardVisualization.jsx";
import FYWiseTenders from "../components/reports/FYWiseTenders.jsx";
import {
    getChartAxisFieldOptions,
    getChartTypeOptions,
    getDefaultVisualizationSelection,
    getReportConfig,
    isDepartmentAxisReport,
} from "../utils/dashboardConfig.js";
import {
    getHumanReadableFieldLabel,
    getRevenueDisplayConfig,
    isRevenueField,
    normalizeReportData,
} from "../utils/dashboardData.js";
import "../styles/Reports.css";

const REPORT_CARDS = [
    { id: "tenders", label: "Tenders - FY wise" },
    { id: "td-ecv-summary", label: "Procurement Summary" },
    { id: "dw-tenders", label: "Department-wise Tenders" },
    { id: "tender-analysis", label: "Card 4" },
    { id: "supplier-analysis", label: "Card 5" },
    { id: "bid-analysis", label: "Card 6" },
    { id: "payment", label: "Card 7" },
    { id: "card-8", label: "Card 8" },
    { id: "card-9", label: "Card 9" },
    { id: "card-10", label: "Card 10" },
    { id: "card-11", label: "Card 11" },
];
function getDepartmentNameField(fields = []) {
    const departmentNameAliases = new Set([
        "deptname", "sdeptname", "ndeptname", "departmentname",
        "sdepartmentname", "department", "sdepartment",
    ]);

    return fields.find((field) => departmentNameAliases.has(String(field).toLowerCase().replace(/[^a-z0-9]/g, ""))) || "";
}

function getReportMetrics(data, fieldLabels) {
    if (!data) {
        return [];
    }

    const numericFields = data.fields.filter((field) => data.columnTypes[field] === "number");
    const textFields = data.fields.filter((field) => data.columnTypes[field] === "text");
    const metrics = [{ label: "Total Records", value: data.rows.length, priority: 0 }];

    numericFields.forEach((field) => {
        const total = data.rows.reduce((sum, row) => {
            const value = Number(String(row[field] ?? "").replace(/,/g, ""));
            return Number.isFinite(value) ? sum + value : sum;
        }, 0);

        metrics.push({
            label: `Total ${fieldLabels[field] || field}`, value: total,
            priority: isRevenueField(field) ? 1 : 2, isNumeric: true,
        });
    });

    textFields.forEach((field) => {
        const uniqueCount = new Set(
            data.rows
                .map((row) => String(row[field] ?? "").trim())
                .filter(Boolean)
        ).size;

        metrics.push({
            label: `Unique ${fieldLabels[field] || field}`,
            value: uniqueCount,
            priority: 3,
        });
    });

    metrics.push(
        { label: "Report Fields", value: data.fields.length, priority: 4 },
        { label: "Numeric Fields", value: numericFields.length, priority: 5 },
        { label: "Text Fields", value: textFields.length, priority: 6 },
        {
            label: "Populated Values",
            value: data.fields.reduce(
                (count, field) =>
                    count + data.rows.filter(
                        (row) => row[field] !== null && row[field] !== undefined &&
                            String(row[field]).trim() !== ""
                    ).length,
                0
            ),
            priority: 7,
        }
    );

    return metrics
        .sort((first, second) => first.priority - second.priority)
        .slice(0, 5)
        .map(({ label, value, isNumeric }) => ({
            label,
            value: new Intl.NumberFormat("en-IN", {
                maximumFractionDigits: isNumeric ? 2 : 0,
            }).format(value),
        }));
}

function Reports({ reportId, reportCache, loadReport, onNavigate }) {
    const [reportFailure, setReportFailure] = useState(null);
    const selectedCard = REPORT_CARDS.find((card) => card.id === reportId);
    const hasCachedReport = selectedCard
        ? Object.hasOwn(reportCache, selectedCard.id)
        : false;
    const reportData = hasCachedReport
        ? reportCache[selectedCard.id]
        : null;
    const reportError = reportFailure?.reportId === reportId
        ? reportFailure.error
        : null;
    const normalizedData = useMemo(
        () => reportData ? normalizeReportData(reportData) : null,
        [reportData]
    );

    useEffect(() => {
        if (!selectedCard || hasCachedReport) {
            return undefined;
        }

        let isCancelled = false;

        loadReport(selectedCard.id).catch((error) => {
            console.error(
                `Failed to load report "${selectedCard.id}":`,
                error
            );

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
    }, [hasCachedReport, loadReport, selectedCard]);

    if (!selectedCard) {
        return (
            <main className="reports-page">
                <header className="reports-header">
                    <p className="reports-eyebrow">Analytics</p>
                    <h1>Reports Dashboard</h1>
                    <p>Select a report to view its data and chart.</p>
                </header>

                <section className="reports-card-grid" aria-label="Reports">
                    {REPORT_CARDS.map((card, index) => (
                        <button
                            className="reports-card"
                            type="button"
                            key={card.id}
                            onClick={() =>
                                onNavigate(
                                    `/mis-reports/${encodeURIComponent(card.id)}/`
                                )
                            }
                        >
                            <span className="reports-card-number">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="reports-card-label">
                                {card.label}
                            </span>
                            <span className="reports-card-link">
                                View report <span aria-hidden="true">→</span>
                            </span>
                        </button>
                    ))}

                    <button
                        className="reports-card reports-card-overall"
                        type="button"
                        onClick={() => onNavigate("/dashboard/")}
                    >
                        <span className="reports-card-number">12</span>
                        <span className="reports-card-label">
                            Overall Reports
                        </span>
                        <span className="reports-card-link">
                            Open dashboard <span aria-hidden="true">→</span>
                        </span>
                    </button>
                </section>
            </main>
        );
    }

    if (!normalizedData) {
        return (
            <main className="reports-detail-page">
                <section
                    className="reports-metrics"
                    aria-label={`${selectedCard.label} summary metrics`}
                >
                    {Array.from({ length: 5 }, (_, index) => (
                        <article
                            className="reports-metric-card"
                            key={`loading-metric-${index}`}
                            aria-busy={!reportError}
                        >
                            <h2 className="reports-metric-label">
                                {reportError ? "Metric unavailable" : "Loading metric"}
                            </h2>
                            <p className="reports-metric-value">
                                {reportError ? "—" : "…"}
                            </p>
                        </article>
                    ))}
                </section>
                <DashboardVisualization
                    reportType={selectedCard.id}
                    title={selectedCard.label}
                    data={null}
                    controlData={null}
                    revenueDisplayConfig={{}}
                    fieldLabels={{}}
                    chartType=""
                    xAxisField=""
                    yAxisField=""
                    yAxisFields={[]}
                    xAxisOptions={[]}
                    yAxisOptions={[]}
                    viewMode="split"
                    hasData={false}
                    hasPeriodDateFields={false}
                    filterType="none"
                    filterValue=""
                    reportError={reportError}
                    isReportLoading={!hasCachedReport && !reportError}
                    showControls={false}
                    showHeader={false}
                    showActions={false}
                    visualizationClassName="reports-visualization"
                    onBack={() => onNavigate("/mis-reports/")}
                />
            </main>
        );
    }

    const fieldLabels = Object.fromEntries(
        normalizedData.fields.map((field) => [
            field,
            getHumanReadableFieldLabel(field),
        ])
    );
    const reportMetrics = getReportMetrics(normalizedData, fieldLabels);

    if (selectedCard.id === "tenders") {
        return (
            <FYWiseTenders
                reportData={normalizedData}
                reportMetrics={reportMetrics}
                onNavigate={onNavigate}
            />
        );
    }

    const reportConfig = getReportConfig(selectedCard.id);
    const departmentNameField = isDepartmentAxisReport(selectedCard.id)
        ? getDepartmentNameField(normalizedData?.fields)
        : "";
    const axisData = departmentNameField && reportConfig
        ? {
            ...normalizedData,
            fields: normalizedData.fields.filter(
                (field) => !reportConfig.excludedAxisFields.includes(
                    field.toLowerCase()
                )
            ),
        }
        : normalizedData;
    const chartSourceData = axisData;
    const fixedXAxisField = departmentNameField || null;
    const chartTypeOptions = getChartTypeOptions(chartSourceData, fixedXAxisField);
    const defaultChartType = "bar";
    const chartType = chartTypeOptions.find(
        (option) => option.value === defaultChartType && !option.disabled
    )?.value || chartTypeOptions.find((option) => !option.disabled)?.value || defaultChartType;
    const selection = getDefaultVisualizationSelection(
        chartSourceData,
        chartType,
        fixedXAxisField
    );
    const selectedYAxisFields = selection.yAxisFields.length > 0
        ? selection.yAxisFields
        : selection.yAxisField
          ? [selection.yAxisField]
          : [];
    const xAxisOptions = getChartAxisFieldOptions(
        chartSourceData,
        chartType,
        "x"
    )
        .filter((field) =>
            chartType === "scatter" ||
            fixedXAxisField === null ||
            field === fixedXAxisField
        )
        .map((field) => ({ value: field, label: fieldLabels[field] || field }));
    const yAxisOptions = getChartAxisFieldOptions(
        chartSourceData,
        chartType,
        "y",
        [],
        selectedYAxisFields[0] || ""
    ).map((field) => ({ value: field, label: fieldLabels[field] || field }));

    return (
        <main className="reports-detail-page">
            <section
                className="reports-metrics"
                aria-label={`${selectedCard.label} summary metrics`}
            >
                {reportMetrics.map((metric) => (
                    <article className="reports-metric-card" key={metric.label}>
                        <h2 className="reports-metric-label">{metric.label}</h2>
                        <p className="reports-metric-value">{metric.value}</p>
                    </article>
                ))}
            </section>
            <DashboardVisualization
                reportType={selectedCard.id}
                title={selectedCard.label}
                data={normalizedData}
                controlData={axisData}
                chartSourceData={chartSourceData}
                revenueDisplayConfig={getRevenueDisplayConfig(normalizedData)}
                chartRevenueDisplayConfig={getRevenueDisplayConfig(chartSourceData)}
                fieldLabels={fieldLabels}
                fixedXAxisField={fixedXAxisField}
                chartType={chartType}
                xAxisField={selection.xAxisField}
                yAxisField={selection.yAxisField}
                yAxisFields={selection.yAxisFields}
                xAxisOptions={xAxisOptions}
                yAxisOptions={yAxisOptions}
                viewMode="split"
                hasData
                hasPeriodDateFields={false}
                filterType="none"
                filterValue=""
                isReportLoading={false}
                showControls={false}
                showHeader={false}
                showActions={false}
                visualizationClassName="reports-visualization"
                onBack={() => onNavigate("/mis-reports/")}
            />
        </main>
    );
}

export default Reports;
