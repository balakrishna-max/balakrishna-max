import { useState } from "react";
import DashboardVisualization from "../DashboardVisualization.jsx";
import {
    getChartAxisFieldOptions,
    getChartTypeOptions,
    getDefaultVisualizationSelection,
} from "../../utils/dashboardConfig.js";
import {
    COLUMN_TYPES,
    getHumanReadableFieldLabel,
    getRevenueDisplayConfig,
} from "../../utils/dashboardData.js";

const MAX_FINANCIAL_YEARS = 8;
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

function getFinancialYearStart(value) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
        return null;
    }

    const yearMatch = normalizedValue.match(/(?:^|\D)(\d{4})(?:\D|$)/);
    return yearMatch ? Number(yearMatch[1]) : null;
}

function buildTenderFinancialYearData(data, metric, revenueField) {
    const categoryField = getNormalizedField(data.fields, "ntendercategory");
    const financialYearField = getNormalizedField(data.fields, "sfinyear");
    const series = TENDER_CATEGORIES.map(({ label, category }) => ({
        field: metric === "revenue" ? `${label} Revenue` : label,
        category,
    }));

    if (!categoryField || !financialYearField || (metric === "revenue" && !revenueField)) {
        return null;
    }

    const totalsByYear = new Map();

    data.rows.forEach((row) => {
        const category = Number(String(row[categoryField] ?? "").trim());
        const financialYear = String(row[financialYearField] ?? "").trim();
        const yearStart = getFinancialYearStart(financialYear);

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
            .slice(-MAX_FINANCIAL_YEARS)
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

function buildTenderPieData(data, metric, revenueField) {
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

function createEmptyChartData(chartStyle) {
    if (chartStyle === "pie") {
        return {
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
        };
    }

    return {
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
}

function FYWiseTenders({ reportData, reportMetrics, onNavigate }) {
    const [chartMetric, setChartMetric] = useState("count");
    const [chartStyle, setChartStyle] = useState("bar");

    const revenueField = getNormalizedField(reportData.fields, "secv");
    const financialYearData = buildTenderFinancialYearData(
        reportData,
        chartMetric,
        revenueField
    );
    const pieData = buildTenderPieData(reportData, chartMetric, revenueField);
    const activeChartData = chartStyle === "pie" ? pieData : financialYearData;
    const hasRevenueData = chartMetric !== "revenue" || Boolean(activeChartData);
    const chartSourceData = activeChartData || (
        hasRevenueData
            ? reportData
            : createEmptyChartData(chartStyle)
    );
    const chartTypeOptions = getChartTypeOptions(chartSourceData, null);
    const defaultChartType = chartStyle === "pie" ? "pie" : "grouped-bar";
    const chartType = chartTypeOptions.find(
        (option) => option.value === defaultChartType && !option.disabled
    )?.value || chartTypeOptions.find((option) => !option.disabled)?.value || defaultChartType;
    const selection = getDefaultVisualizationSelection(chartSourceData, chartType);
    const fieldLabels = Object.fromEntries(
        reportData.fields.map((field) => [field, getHumanReadableFieldLabel(field)])
    );

    if (chartStyle === "pie") {
        fieldLabels["Tender Category"] = "Tender Category";
        fieldLabels[chartMetric === "revenue" ? "Total Revenue" : "Tender Count"] =
            chartMetric === "revenue" ? "Total Revenue" : "Tender Count";
    } else if (financialYearData && chartMetric === "revenue") {
        TENDER_CATEGORIES.forEach(({ label }) => {
            fieldLabels[`${label} Revenue`] = `${label} Revenue`;
        });
    }

    const selectedYAxisFields = selection.yAxisFields.length > 0
        ? selection.yAxisFields
        : selection.yAxisField
          ? [selection.yAxisField]
          : [];
    const xAxisOptions = getChartAxisFieldOptions(chartSourceData, chartType, "x")
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
                aria-label="Tenders - FY wise summary metrics"
            >
                {reportMetrics.map((metric) => (
                    <article className="reports-metric-card" key={metric.label}>
                        <h2 className="reports-metric-label">{metric.label}</h2>
                        <p className="reports-metric-value">{metric.value}</p>
                    </article>
                ))}
            </section>
            <div className="reports-chart-toggle-row">
                <div
                    className="reports-chart-toggle-group"
                    role="group"
                    aria-label="Chart type"
                >
                    <div className="reports-chart-toggle reports-chart-type-toggle">
                        <span
                            className={`reports-chart-toggle-indicator reports-chart-toggle-indicator-${chartStyle}`}
                            aria-hidden="true"
                        />
                        <button
                            className="reports-chart-toggle-option"
                            type="button"
                            aria-pressed={chartStyle === "pie"}
                            onClick={() => setChartStyle("pie")}
                        >
                            Pie
                        </button>
                        <button
                            className="reports-chart-toggle-option"
                            type="button"
                            aria-pressed={chartStyle === "bar"}
                            onClick={() => setChartStyle("bar")}
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
                        className={`reports-chart-toggle-indicator reports-chart-toggle-indicator-${chartMetric}`}
                        aria-hidden="true"
                    />
                    <button
                        className="reports-chart-toggle-option"
                        type="button"
                        aria-pressed={chartMetric === "count"}
                        onClick={() => setChartMetric("count")}
                    >
                        No. of Tenders
                    </button>
                    <button
                        className="reports-chart-toggle-option"
                        type="button"
                        aria-pressed={chartMetric === "revenue"}
                        onClick={() => setChartMetric("revenue")}
                    >
                        Tenders Revenue
                    </button>
                </div>
            </div>
            {!hasRevenueData && (
                <p className="reports-chart-data-notice" role="status">
                    Revenue data is not available in this report.
                </p>
            )}
            <DashboardVisualization
                reportType="tenders"
                title="Tenders - FY wise"
                data={reportData}
                controlData={reportData}
                chartSourceData={chartSourceData}
                revenueDisplayConfig={getRevenueDisplayConfig(reportData)}
                chartRevenueDisplayConfig={getRevenueDisplayConfig(chartSourceData)}
                fieldLabels={fieldLabels}
                fixedXAxisField={null}
                chartType={chartType}
                richChart
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

export default FYWiseTenders;