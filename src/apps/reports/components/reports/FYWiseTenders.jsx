import { useState } from "react";
import DashboardVisualization from "../DashboardVisualization.jsx";
import { getChartAxisOptions, getDefaultVisualizationSelection,
    getReportConfig, getSupportedChartType, REPORT_IDS } from "../../utils/dashboardConfig.js";
import { COLUMN_TYPES, getFieldLabels, getFieldByNormalizedName,
    parseRevenueValue, getRevenueDisplayConfig, getTenderValueLabel } from "../../utils/dashboardData.js";

const TENDER_REPORT_CONFIG = getReportConfig(REPORT_IDS.TENDERS);
const TENDER_CATEGORIES = TENDER_REPORT_CONFIG.tenderCategoryValues.map((apiValue) => ({
    apiValue,
    label: getTenderValueLabel(TENDER_REPORT_CONFIG.fields.category, apiValue),
}));
const TENDER_CHART_FIELDS = TENDER_REPORT_CONFIG.chartFields;
const TENDER_CONTROLS = TENDER_REPORT_CONFIG.fyWiseControls;

function getFinancialYearStart(value) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
        return null;
    }

    const yearMatch = normalizedValue.match(/(?:^|\D)(\d{4})(?:\D|$)/);
    return yearMatch ? Number(yearMatch[1]) : null;
}

function buildTenderFinancialYearData(data, metric, revenueField) {
    const categoryField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.category);
    const financialYearField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.financialYear);
    const series = TENDER_CATEGORIES.map(({ label, apiValue }) => ({
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
        apiValue,
    }));

    if (!categoryField || !financialYearField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)) {
        return null;
    }

    const totalsByYear = new Map();

    data.rows.forEach((row) => {
        const category = Number(String(row[categoryField] ?? "").trim());
        const financialYear = String(row[financialYearField] ?? "").trim();
        const yearStart = getFinancialYearStart(financialYear);

        if (
            !Number.isInteger(category) ||
            !series.some((item) => item.apiValue === category) ||
            yearStart === null ||
            !financialYear
        ) {
            return;
        }

        if (!totalsByYear.has(yearStart)) {
            totalsByYear.set(yearStart, {
                [TENDER_CHART_FIELDS.financialYear]: financialYear,
                ...Object.fromEntries(series.map(({ field }) => [field, 0])),
            });
        }

        const seriesField = series.find(
            (item) => item.apiValue === category
        ).field;
        const amount = metric === TENDER_CONTROLS.metrics.revenue.value
            ? parseRevenueValue(row[revenueField])
            : 1;

        if (Number.isFinite(amount)) {
            totalsByYear.get(yearStart)[seriesField] += amount;
        }
    });

    const fields = [
        TENDER_CHART_FIELDS.financialYear,
        ...series.map((item) => item.field),
    ];
    const fieldDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields,
        rows: Array.from(totalsByYear.entries())
            .sort(([firstYear], [secondYear]) => firstYear - secondYear)
            .slice(-TENDER_REPORT_CONFIG.maxFinancialYears)
            .map(([, row]) => row),
        columnTypes: {
            [TENDER_CHART_FIELDS.financialYear]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                series.map(({ field }) => [field, COLUMN_TYPES.NUMBER])
            ),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.financialYear]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(
                series.map(({ field }) => [field, fieldDataType])
            ),
        },
    };
}

function buildTenderPieData(data, metric, revenueField) {
    const categoryField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.category);
    if (!categoryField || (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)) {
        return null;
    }

    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.revenueTotal
        : TENDER_CHART_FIELDS.tenderCount;
    const totals = new Map(
        TENDER_CATEGORIES.map(({ label, apiValue }) => [
            apiValue,
            { [TENDER_CHART_FIELDS.category]: label, [valueField]: 0 },
        ])
    );

    data.rows.forEach((row) => {
        const category = Number(String(row[categoryField] ?? "").trim());
        const total = totals.get(category);
        if (!total) {
            return;
        }

        if (metric === TENDER_CONTROLS.metrics.count.value) {
            total[valueField] += 1;
            return;
        }

        const amount = parseRevenueValue(row[revenueField]);
        if (Number.isFinite(amount)) {
            total[valueField] += amount;
        }
    });

    return {
        fields: [TENDER_CHART_FIELDS.category, valueField],
        rows: Array.from(totals.values()),
        columnTypes: {
            [TENDER_CHART_FIELDS.category]: COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.category]: TENDER_CONTROLS.dataTypes.text,
            [valueField]: metric === TENDER_CONTROLS.metrics.revenue.value
                ? TENDER_CONTROLS.dataTypes.revenue
                : TENDER_CONTROLS.dataTypes.count,
        },
    };
}

function createEmptyChartData(chartStyle) {
    if (chartStyle === TENDER_CONTROLS.chartStyles.pie.value) {
        return {
            fields: [TENDER_CHART_FIELDS.category, TENDER_CHART_FIELDS.revenueTotal],
            rows: [],
            columnTypes: {
                [TENDER_CHART_FIELDS.category]: COLUMN_TYPES.TEXT,
                [TENDER_CHART_FIELDS.revenueTotal]: COLUMN_TYPES.NUMBER,
            },
            dataTypes: {
                [TENDER_CHART_FIELDS.category]: TENDER_CONTROLS.dataTypes.text,
                [TENDER_CHART_FIELDS.revenueTotal]: TENDER_CONTROLS.dataTypes.revenue,
            },
        };
    }

    return {
        fields: [
            TENDER_CHART_FIELDS.financialYear,
            ...TENDER_CATEGORIES.map(
                ({ label }) => `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            ),
        ],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.financialYear]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                TENDER_CATEGORIES.map(({ label }) => [
                    `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`,
                    COLUMN_TYPES.NUMBER,
                ])
            ),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.financialYear]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(
                TENDER_CATEGORIES.map(({ label }) => [
                    `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`,
                    TENDER_CONTROLS.dataTypes.revenue,
                ])
            ),
        },
    };
}

function FYWiseTenders({
    reportData,
    reportMetrics,
    reportError,
    isReportLoading,
    onNavigate,
}) {
    const [chartMetric, setChartMetric] = useState(TENDER_CONTROLS.defaultMetric);
    const [chartStyle, setChartStyle] = useState(TENDER_CONTROLS.defaultChartStyle);

    if (!reportData) {
        return (
            <main className="reports-detail-page">
                <h1>{TENDER_REPORT_CONFIG.cardLabel}</h1>
                <p role={reportError ? "alert" : "status"}>
                    {reportError
                        ? "Unable to load this report."
                        : isReportLoading
                          ? "Loading report..."
                          : "Report data is unavailable."}
                </p>
                <button type="button" onClick={() => onNavigate("/mis-reports/")}>
                    Back to reports
                </button>
            </main>
        );
    }

    const revenueField = getFieldByNormalizedName(reportData.fields, TENDER_REPORT_CONFIG.fields.revenue);
    const financialYearData = buildTenderFinancialYearData(
        reportData,
        chartMetric,
        revenueField
    );
    const pieData = buildTenderPieData(reportData, chartMetric, revenueField);
    const activeChartData = chartStyle === TENDER_CONTROLS.chartStyles.pie.value
        ? pieData
        : financialYearData;
    const hasRevenueData = chartMetric !== TENDER_CONTROLS.metrics.revenue.value || Boolean(activeChartData);
    const chartSourceData = activeChartData || (
        hasRevenueData
            ? reportData
            : createEmptyChartData(chartStyle)
    );
    const defaultChartType = chartStyle === TENDER_CONTROLS.chartStyles.pie.value
        ? TENDER_CONTROLS.chartTypes.pie
        : TENDER_CONTROLS.chartTypes.financialYear;
    const chartType = getSupportedChartType(
        chartSourceData,
        defaultChartType,
        null,
        REPORT_IDS.TENDERS
    );
    const selection = getDefaultVisualizationSelection(chartSourceData, chartType, null, REPORT_IDS.TENDERS);
    const fieldLabels = getFieldLabels(reportData.fields);

    if (chartStyle === TENDER_CONTROLS.chartStyles.pie.value) {
        fieldLabels[TENDER_CHART_FIELDS.category] = TENDER_CHART_FIELDS.category;
        const metricField = chartMetric === TENDER_CONTROLS.metrics.revenue.value
            ? TENDER_CHART_FIELDS.revenueTotal
            : TENDER_CHART_FIELDS.tenderCount;
        fieldLabels[metricField] = metricField;
    } else if (financialYearData && chartMetric === TENDER_CONTROLS.metrics.revenue.value) {
        TENDER_CATEGORIES.forEach(({ label }) => {
            const revenueField = `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`;
            fieldLabels[revenueField] = revenueField;
        });
    }

    const selectedYAxisFields = selection.yAxisFields.length > 0
        ? selection.yAxisFields
        : selection.yAxisField
          ? [selection.yAxisField]
          : [];
    const xAxisOptions = getChartAxisOptions(chartSourceData, {
        chartType,
        axisName: "x",
        fieldLabels,
        reportId: REPORT_IDS.TENDERS,
    });
    const yAxisOptions = getChartAxisOptions(
        chartSourceData,
        {
            chartType,
            axisName: "y",
            fieldLabels,
            referenceYAxisField: selectedYAxisFields[0] || "",
            reportId: REPORT_IDS.TENDERS,
        }
    );
    const title = TENDER_REPORT_CONFIG.cardLabel;

    return (
        <main className="reports-detail-page">
            <section
                className="reports-metrics"
                aria-label={`${title} summary metrics`}
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
                        {Object.values(TENDER_CONTROLS.chartStyles).map(({value, label}) => (
                            <button
                                className="reports-chart-toggle-option"
                                type="button"
                                key={value}
                                aria-pressed={chartStyle === value}
                                onClick={() => setChartStyle(value)}
                            >
                                {label}
                            </button>
                        ))}
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
                    {Object.values(TENDER_CONTROLS.metrics).map(({value, label}) => (
                        <button
                            className="reports-chart-toggle-option"
                            type="button"
                            key={value}
                            aria-pressed={chartMetric === value}
                            onClick={() => setChartMetric(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {!hasRevenueData && (
                <p className="reports-chart-data-notice" role="status">
                    Revenue data is not available in this report.
                </p>
            )}
            <DashboardVisualization
                reportType={REPORT_IDS.TENDERS}
                title={title}
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