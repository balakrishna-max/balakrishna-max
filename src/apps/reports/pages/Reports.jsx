import { useEffect, useMemo, useState } from "react";
import DashboardVisualization from "../components/DashboardVisualization.jsx";
import {
    getChartAxisFieldOptions,
    getChartTypeOptions,
    getDefaultVisualizationSelection,
    getReportConfig,
    isDepartmentAxisReport,
} from "../utils/dashboardConfig.js";
import {
    COLUMN_TYPES,
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
const MAX_TENDER_FINANCIAL_YEARS = 8;
const TENDER_CATEGORIES = [
    { label: "Goods", category: 102 },
    { label: "Works", category: 101 },
    { label: "Services", category: 104 },
];

function getNormalizedField(fields, target) {
    return fields.find(
        (field) =>
            field.toLowerCase().replace(/[^a-z0-9]/g, "") === target
    ) || "";
}

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

function getFinancialYearStart(value, isDateField) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
        return null;
    }

    if (!isDateField) {
        const yearMatch = normalizedValue.match(/(?:^|\D)(\d{4})(?:\D|$)/);
        return yearMatch ? Number(yearMatch[1]) : null;
    }

    const isoDateMatch = normalizedValue.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
    const dayFirstDateMatch = normalizedValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    let year;
    let month;

    if (isoDateMatch) {
        [, year, month] = isoDateMatch;
        year = Number(year);
        month = Number(month);
    } else if (dayFirstDateMatch) {
        year = Number(dayFirstDateMatch[3]);
        month = Number(dayFirstDateMatch[2]);
    } else {
        const date = new Date(normalizedValue);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        year = date.getFullYear();
        month = date.getMonth() + 1;
    }

    if (month < 1 || month > 12) {
        return null;
    }

    return month >= 4 ? year : year - 1;
}

function buildTenderFinancialYearData(data, metric, revenueField = "") {
    if (!data) {
        return null;
    }

    const categoryField = getNormalizedField(data.fields, "ntendercategory");
    const financialYearField = getNormalizedField(data.fields, "sfinyear");
    const series = TENDER_CATEGORIES.map(({ label, category }) => ({
        field: metric === "revenue" ? `${label} Revenue` : label,
        category,
    }));

    if (
        !categoryField ||
        !financialYearField ||
        (metric === "revenue" && !revenueField)
    ) {
        return null;
    }

    const totalsByYear = new Map();

    data.rows.forEach((row) => {
        const category = Number(String(row[categoryField] ?? "").trim());
        const financialYear = String(row[financialYearField] ?? "").trim();
        const yearStart = getFinancialYearStart(financialYear, false);

        if (
            !Number.isInteger(category) ||
            !series.some((item) => item.category === category) ||
            yearStart === null ||
            !financialYear
        ) {
            return;
        }

        if (!totalsByYear.has(yearStart)) {
            totalsByYear.set(yearStart, {
                "Financial Year": financialYear,
                ...Object.fromEntries(series.map(({ field }) => [field, 0])),
            });
        }

        const seriesField = series.find(
            (item) => item.category === category
        ).field;
        const rawAmount = row[revenueField];
        const amount = metric === "revenue"
            ? rawAmount === null || rawAmount === undefined || String(rawAmount).trim() === ""
                ? null
                : Number(String(rawAmount).replace(/,/g, "").trim())
            : 1;

        if (amount !== null && Number.isFinite(amount)) {
            totalsByYear.get(yearStart)[seriesField] += amount;
        }
    });

    const fields = ["Financial Year", ...series.map((item) => item.field)];
    const fieldDataType = metric === "revenue" ? "DECIMAL" : "INTEGER";

    return {
        fields,
        rows: Array.from(totalsByYear.entries())
            .sort(([firstYear], [secondYear]) => firstYear - secondYear)
            .slice(-MAX_TENDER_FINANCIAL_YEARS)
            .map(([, row]) => row),
        columnTypes: {
            "Financial Year": COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                series.map(({ field }) => [field, COLUMN_TYPES.NUMBER])
            ),
        },
        dataTypes: {
            "Financial Year": "STRING",
            ...Object.fromEntries(
                series.map(({ field }) => [field, fieldDataType])
            ),
        },
    };
}

function buildTenderPieData(data, metric, revenueField = "") {
    if (!data) {
        return null;
    }

    const categoryField = getNormalizedField(data.fields, "ntendercategory");
    if (!categoryField || (metric === "revenue" && !revenueField)) {
        return null;
    }

    const valueField = metric === "revenue" ? "Total Revenue" : "Tender Count";
    const totals = new Map(
        TENDER_CATEGORIES.map(({ label, category }) => [
            category,
            { "Tender Category": label, [valueField]: 0 },
        ])
    );

    data.rows.forEach((row) => {
        const category = Number(String(row[categoryField] ?? "").trim());
        const total = totals.get(category);
        if (!total) {
            return;
        }

        if (metric === "count") {
            total[valueField] += 1;
            return;
        }

        const rawAmount = row[revenueField];
        if (rawAmount === null || rawAmount === undefined || String(rawAmount).trim() === "") {
            return;
        }

        const amount = Number(String(rawAmount).replace(/,/g, "").trim());
        if (Number.isFinite(amount)) {
            total[valueField] += amount;
        }
    });

    return {
        fields: ["Tender Category", valueField],
        rows: Array.from(totals.values()),
        columnTypes: {
            "Tender Category": COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            "Tender Category": "STRING",
            [valueField]: metric === "revenue" ? "DECIMAL" : "INTEGER",
        },
    };
}

function Reports({ reportId, reportCache, loadReport, onNavigate }) {
    const [reportFailure, setReportFailure] = useState(null);
    const [tenderChartMetric, setTenderChartMetric] = useState("count");
    const [tenderChartStyle, setTenderChartStyle] = useState("bar");
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
                                    `/reports-dashboard/${encodeURIComponent(card.id)}/`
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
                    onBack={() => onNavigate("/reports-dashboard/")}
                />
            </main>
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
    const revenueField = normalizedData?.fields.find(
        (field) => field.toLowerCase().replace(/[^a-z0-9]/g, "") === "secv"
    ) || "";
    const tenderFinancialYearData = selectedCard.id === "tenders"
        ? buildTenderFinancialYearData(
            normalizedData,
            tenderChartMetric,
            revenueField
        )
        : null;
    const tenderPieData = selectedCard.id === "tenders"
        ? buildTenderPieData(normalizedData, tenderChartMetric, revenueField)
        : null;
    const activeTenderChartData = tenderChartStyle === "pie"
        ? tenderPieData
        : tenderFinancialYearData;
    const hasTenderRevenueData =
        selectedCard.id !== "tenders" ||
        tenderChartMetric !== "revenue" ||
        Boolean(activeTenderChartData);
    const emptyTenderRevenueData = tenderChartStyle === "pie"
        ? {
            fields: ["Tender Category", "Total Revenue"],
            rows: [],
            columnTypes: {
                "Tender Category": COLUMN_TYPES.TEXT,
                "Total Revenue": COLUMN_TYPES.NUMBER,
            },
            dataTypes: {
                "Tender Category": "STRING",
                "Total Revenue": "DECIMAL",
            },
        }
        : {
            fields: [
                "Financial Year",
                ...TENDER_CATEGORIES.map(({ label }) => `${label} Revenue`),
            ],
            rows: [],
            columnTypes: {
                "Financial Year": COLUMN_TYPES.TEXT,
                ...Object.fromEntries(
                    TENDER_CATEGORIES.map(({ label }) => [
                        `${label} Revenue`,
                        COLUMN_TYPES.NUMBER,
                    ])
                ),
            },
            dataTypes: {
                "Financial Year": "STRING",
                ...Object.fromEntries(
                    TENDER_CATEGORIES.map(({ label }) => [
                        `${label} Revenue`,
                        "DECIMAL",
                    ])
                ),
            },
        };
    const chartSourceData = selectedCard.id === "tenders"
        ? activeTenderChartData || (
            hasTenderRevenueData ? axisData : emptyTenderRevenueData
        )
        : axisData;
    const fixedXAxisField = departmentNameField || null;
    const chartTypeOptions = getChartTypeOptions(chartSourceData, fixedXAxisField);
    const defaultChartType = selectedCard.id === "tenders"
        ? tenderChartStyle === "pie" ? "pie" : "grouped-bar"
        : "bar";
    const chartType = chartTypeOptions.find(
        (option) => option.value === defaultChartType && !option.disabled
    )?.value || chartTypeOptions.find((option) => !option.disabled)?.value || defaultChartType;
    const selection = getDefaultVisualizationSelection(
        chartSourceData,
        chartType,
        fixedXAxisField
    );
    const fieldLabels = Object.fromEntries(
        (normalizedData?.fields || []).map((field) => [
            field,
            getHumanReadableFieldLabel(field),
        ])
    );
    if (tenderChartStyle === "pie" && selectedCard.id === "tenders") {
        fieldLabels["Tender Category"] = "Tender Category";
        fieldLabels[tenderChartMetric === "revenue" ? "Total Revenue" : "Tender Count"] =
            tenderChartMetric === "revenue" ? "Total Revenue" : "Tender Count";
    } else if (tenderFinancialYearData && tenderChartMetric === "revenue") {
        TENDER_CATEGORIES.forEach(({ label }) => {
            fieldLabels[`${label} Revenue`] = `${label} Revenue`;
        });
    }
    const reportMetrics = getReportMetrics(normalizedData, fieldLabels);
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
            {selectedCard.id === "tenders" && (
                <div className="reports-chart-toggle-row">
                    <div
                        className="reports-chart-toggle-group"
                        role="group"
                        aria-label="Chart type"
                    >
                        <div className="reports-chart-toggle reports-chart-type-toggle">
                            <span
                                className={`reports-chart-toggle-indicator reports-chart-toggle-indicator-${tenderChartStyle}`}
                                aria-hidden="true"
                            />
                            <button
                                className="reports-chart-toggle-option"
                                type="button"
                                aria-pressed={tenderChartStyle === "pie"}
                                onClick={() => setTenderChartStyle("pie")}
                            >
                                Pie
                            </button>
                            <button
                                className="reports-chart-toggle-option"
                                type="button"
                                aria-pressed={tenderChartStyle === "bar"}
                                onClick={() => setTenderChartStyle("bar")}
                            >
                                Bar
                            </button>
                        </div>
                    </div>
                    <div
                        className="reports-chart-toggle"
                        role="group"
                        aria-label="Tender chart metric"
                    >
                        <span
                            className={`reports-chart-toggle-indicator reports-chart-toggle-indicator-${tenderChartMetric}`}
                            aria-hidden="true"
                        />
                        <button
                            className="reports-chart-toggle-option"
                            type="button"
                            aria-pressed={tenderChartMetric === "count"}
                            onClick={() => setTenderChartMetric("count")}
                        >
                            No. of Tenders
                        </button>
                        <button
                            className="reports-chart-toggle-option"
                            type="button"
                            aria-pressed={tenderChartMetric === "revenue"}
                            onClick={() => setTenderChartMetric("revenue")}
                        >
                            Tenders Revenue
                        </button>
                    </div>
                </div>
            )}
            {!hasTenderRevenueData && (
                <p className="reports-chart-data-notice" role="status">
                    Revenue data is not available in this report.
                </p>
            )}
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
                richChart={selectedCard.id === "tenders"}
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
                onBack={() => onNavigate("/reports-dashboard/")}
            />
        </main>
    );
}

export default Reports;
