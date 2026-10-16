import { useCallback, useState } from "react";
import DashboardVisualization from "../DashboardVisualization.jsx";
import { getChartAxisOptions, getDefaultVisualizationSelection,
    getReportConfig, getSupportedChartType, REPORT_IDS } from "../../utils/dashboardConfig.js";
import { COLUMN_TYPES, getFieldLabels, getFieldByNormalizedName, getDepartmentNameField,
    parseRevenueValue, getRevenueDisplayConfig,
    getTenderValueLabel, getFilterField, TENDER_TYPE_LABELS } from "../../utils/dashboardData.js";

const TENDER_REPORT_CONFIG = getReportConfig(REPORT_IDS.TENDERS);
const TENDER_CATEGORIES = TENDER_REPORT_CONFIG.tenderCategoryValues.map((apiValue) => ({
    apiValue, label: getTenderValueLabel(TENDER_REPORT_CONFIG.fields.category, apiValue),
}));
const TENDER_STATUS_VALUES = TENDER_REPORT_CONFIG.tenderStatusValues;
const TENDER_TYPE_VALUES = TENDER_REPORT_CONFIG.tenderTypeValues;
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

function getEligibleTenderValues(row, categoryField, statusField, tenderTypeField) {
    const category = Number(String(row[categoryField] ?? "").trim());
    const status = statusField
        ? Number(String(row[statusField] ?? "").trim())
        : null;
    const tenderType = Number(String(row[tenderTypeField] ?? "").trim());

    if (
        !TENDER_CATEGORIES.some((item) => item.apiValue === category) ||
        (statusField && !TENDER_STATUS_VALUES.includes(status)) ||
        !TENDER_TYPE_VALUES.includes(tenderType)
    ) {
        return null;
    }

    return {category, tenderType};
}

function getTenderAmount(row, metric, revenueField, tenderCountField) {
    return metric === TENDER_CONTROLS.metrics.revenue.value
        ? parseRevenueValue(row[revenueField])
        : parseRevenueValue(row[tenderCountField]);
}

function buildTenderFinancialYearData(
    data,
    metric,
    revenueField,
    tenderCountField,
    statusField,
    tenderTypeField
) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
        return null;
    }

    const categoryField = getFilterField(data, "category-wise");
    const financialYearField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.financialYear);
    const series = TENDER_CATEGORIES.map(({ label, apiValue }) => ({
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
        apiValue,
    }));

    if (!categoryField || !financialYearField || !tenderTypeField || !tenderCountField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)) {
        return null;
    }

    const totalsByFinancialYear = new Map();

    data.rows.forEach((row) => {
        const eligibleTender = getEligibleTenderValues(
            row,
            categoryField,
            statusField,
            tenderTypeField
        );
        const financialYear = String(row[financialYearField] ?? "").trim();
        const yearStart = getFinancialYearStart(financialYear);

        if (
            !eligibleTender ||
            yearStart === null ||
            !financialYear
        ) {
            return;
        }

        if (!totalsByFinancialYear.has(financialYear)) {
            totalsByFinancialYear.set(financialYear, {
                [TENDER_CHART_FIELDS.financialYear]: financialYear,
                ...Object.fromEntries(series.map(({ field }) => [field, 0])),
            });
        }

        const seriesField = series.find(
            (item) => item.apiValue === eligibleTender.category
        ).field;
        const amount = getTenderAmount(row, metric, revenueField, tenderCountField);

        if (Number.isFinite(amount)) {
            totalsByFinancialYear.get(financialYear)[seriesField] += amount;
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
        rows: Array.from(totalsByFinancialYear.entries())
            .sort(([firstYear], [secondYear]) =>
                getFinancialYearStart(firstYear) - getFinancialYearStart(secondYear) ||
                firstYear.localeCompare(secondYear)
            )
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

function buildDepartmentFinancialYearData(
    data,
    financialYear,
    metric,
    revenueField,
    tenderCountField,
    statusField,
    tenderTypeField
) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
        return null;
    }

    const departmentField = getDepartmentNameField(data.fields);
    const categoryField = getFilterField(data, "category-wise");
    const financialYearField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.financialYear);

    if (
        !departmentField ||
        !categoryField ||
        !financialYearField ||
        !tenderTypeField ||
        !tenderCountField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)
    ) {
        return null;
    }

    const categorySeries = TENDER_CATEGORIES.map(({ apiValue, label }) => ({
        apiValue,
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
    }));

    const departmentTotals = new Map();

    data.rows.forEach((row) => {
        const rowFinancialYear = String(row[financialYearField] ?? "").trim();
        const department = String(row[departmentField] ?? "").trim();

        if (
            getFinancialYearStart(rowFinancialYear) !== getFinancialYearStart(financialYear) ||
            !department
        ) {
            return;
        }

        const eligibleTender = getEligibleTenderValues(
            row,
            categoryField,
            statusField,
            tenderTypeField
        );
        if (!eligibleTender) {
            return;
        }

        const amount = getTenderAmount(row, metric, revenueField, tenderCountField);
        if (!Number.isFinite(amount)) {
            return;
        }

        const categoryData = categorySeries.find(
            (series) => series.apiValue === eligibleTender.category
        );
        const departmentData = departmentTotals.get(department) || {
            total: 0,
            series: Object.fromEntries(categorySeries.map(({ field }) => [field, 0])),
        };

        departmentData.total += amount;
        departmentData.series[categoryData.field] += amount;
        departmentTotals.set(department, departmentData);
    });

    const departmentLabel = TENDER_CHART_FIELDS.department;
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;
    const topDepartments = Array.from(departmentTotals)
        .sort(([firstName, firstData], [secondName, secondData]) =>
            secondData.total - firstData.total || firstName.localeCompare(secondName)
        )
        .slice(0, TENDER_REPORT_CONFIG.maxDepartments);

    return {
        fields: [departmentLabel, ...categorySeries.map(({ field }) => field)],
        rows: topDepartments.map(([department, totals]) => ({
            [departmentLabel]: department,
            ...totals.series,
        })),
        columnTypes: {
            [departmentLabel]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                categorySeries.map(({ field }) => [field, COLUMN_TYPES.NUMBER])
            ),
        },
        dataTypes: {
            [departmentLabel]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(
                categorySeries.map(({ field }) => [field, valueDataType])
            ),
        },
    };
}

function getMonthValue(value) {
    const normalizedValue = String(value ?? "").trim();
    const monthNames = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    const namedMonthMatch = normalizedValue.match(/^([a-z]+)/i);
    const namedMonth = namedMonthMatch
        ? monthNames.indexOf(namedMonthMatch[1].slice(0, 3).toLowerCase()) + 1
        : 0;
    const isoDateMatch = normalizedValue.match(/^(\d{4})[-/](\d{1,2})/);
    const localDateMatch = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const year = isoDateMatch
        ? Number(isoDateMatch[1])
        : localDateMatch
          ? Number(localDateMatch[3])
          : NaN;
    const month = isoDateMatch
        ? Number(isoDateMatch[2])
        : localDateMatch
          ? Number(localDateMatch[2])
          : NaN;

    if (namedMonth && !Number.isInteger(year)) {
        return {year: null, month: namedMonth};
    }

    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
        return {year, month};
    }

    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return {year: date.getFullYear(), month: date.getMonth() + 1};
}

function isMonthInFinancialYear(month, financialYear) {
    const financialYearStart = getFinancialYearStart(financialYear);
    if (financialYearStart === null) {
        return false;
    }

    const monthIndex = month.year * 12 + month.month - 1;
    const startMonthIndex = financialYearStart * 12 +
        TENDER_REPORT_CONFIG.financialYearStartMonth - 1;
    return monthIndex >= startMonthIndex && monthIndex < startMonthIndex + 12;
}

function buildDepartmentMonthlyTenderTypeData(
    data,
    financialYear,
    department,
    metric,
    revenueField,
    tenderCountField,
    statusField,
    monthField,
    tenderTypeField
) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows) ||
        !monthField) {
        return null;
    }

    const departmentField = getDepartmentNameField(data.fields);
    const financialYearField = getFieldByNormalizedName(
        data.fields,
        TENDER_REPORT_CONFIG.fields.financialYear
    );
    const categoryField = getFilterField(data, "category-wise");

    if (!departmentField || !financialYearField || !categoryField ||
        !tenderCountField || !tenderTypeField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)) {
        return null;
    }

    const typeSeries = TENDER_TYPE_VALUES.map((apiValue) => ({
        apiValue,
        label: TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`,
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`,
    }));
    const financialYearStart = getFinancialYearStart(financialYear);
    if (financialYearStart === null) {
        return null;
    }

    const firstMonthIndex = financialYearStart * 12 +
        TENDER_REPORT_CONFIG.financialYearStartMonth - 1;
    const totalsByMonth = new Map(
        Array.from({length: 12}, (_, offset) => {
            const monthIndex = firstMonthIndex + offset;
            const monthYear = Math.floor(monthIndex / 12);
            const monthLabel = new Intl.DateTimeFormat("en-US", {
                month: "short",
                year: "numeric",
                timeZone: "UTC",
            }).format(new Date(Date.UTC(monthYear, monthIndex % 12, 1)));

            return [
                monthIndex,
                {
                    [TENDER_CHART_FIELDS.month]: monthLabel,
                    ...Object.fromEntries(typeSeries.map(({field}) => [field, 0])),
                },
            ];
        })
    );
    let matchedTenderCount = 0;

    data.rows.forEach((row) => {
        if (getFinancialYearStart(row[financialYearField]) !== financialYearStart ||
            String(row[departmentField] ?? "").trim() !== department) {
            return;
        }

        const eligibleTender = getEligibleTenderValues(
            row,
            categoryField,
            statusField,
            tenderTypeField
        );
        if (!eligibleTender) {
            return;
        }

        const month = getMonthValue(row[monthField]);
        if (!month || !month.month) {
            return;
        }
        const financialYearMonth = {
            year: month.year ?? (
                month.month >= TENDER_REPORT_CONFIG.financialYearStartMonth
                    ? financialYearStart
                    : financialYearStart + 1
            ),
            month: month.month,
        };
        if (!isMonthInFinancialYear(financialYearMonth, financialYear)) {
            return;
        }
        matchedTenderCount += parseRevenueValue(row[tenderCountField]) || 0;

        const series = typeSeries.find(
            ({apiValue}) => apiValue === eligibleTender.tenderType
        );
        if (!series) {
            return;
        }

        const amount = getTenderAmount(row, metric, revenueField, tenderCountField);
        if (!Number.isFinite(amount)) {
            return;
        }

        const monthIndex = financialYearMonth.year * 12 + financialYearMonth.month - 1;
        if (totalsByMonth.has(monthIndex)) {
            totalsByMonth.get(monthIndex)[series.field] += amount;
        }
    });

    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields: [TENDER_CHART_FIELDS.month, ...typeSeries.map(({field}) => field)],
        rows: Array.from(totalsByMonth.values()),
        matchedTenderCount,
        columnTypes: {
            [TENDER_CHART_FIELDS.month]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(typeSeries.map(({field}) => [field, COLUMN_TYPES.NUMBER])),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.month]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(typeSeries.map(({field}) => [field, valueDataType])),
        },
    };
}

function createEmptyDepartmentMonthlyData(metric) {
    const typeFields = TENDER_TYPE_VALUES.map((apiValue) => ({
        label: TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`,
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : TENDER_TYPE_LABELS[apiValue] || `Type ${apiValue}`,
    }));
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields: [TENDER_CHART_FIELDS.month, ...typeFields.map(({field}) => field)],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.month]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(typeFields.map(({field}) => [field, COLUMN_TYPES.NUMBER])),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.month]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(typeFields.map(({field}) => [field, valueDataType])),
        },
    };
}

function createEmptyChartData(metric) {
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    const series = TENDER_CATEGORIES.map(({ label, apiValue }) => ({
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
        apiValue,
    }));

    return {
        fields: [
            TENDER_CHART_FIELDS.financialYear,
            ...series.map(({ field }) => field),
        ],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.financialYear]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                series.map(({ field }) => [field, COLUMN_TYPES.NUMBER])
            ),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.financialYear]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(
                series.map(({ field }) => [field, valueDataType])
            ),
        },
    };
}

function createEmptyDepartmentChartData(metric) {
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;
    const categorySeries = TENDER_CATEGORIES.map(({ label }) => ({
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
    }));

    return {
        fields: [
            TENDER_CHART_FIELDS.department,
            ...categorySeries.map(({ field }) => field),
        ],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.department]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(
                categorySeries.map(({ field }) => [field, COLUMN_TYPES.NUMBER])
            ),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.department]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(
                categorySeries.map(({ field }) => [field, valueDataType])
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
    const [selectedFinancialYear, setSelectedFinancialYear] = useState(null);
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const reportFields = reportData?.fields || [];
    const revenueField = reportData
        ? getFieldByNormalizedName(reportFields, TENDER_REPORT_CONFIG.fields.revenue)
        : "";
    const statusField = reportData ? getFilterField(reportData, "status") : "";
    const tenderTypeField = getFieldByNormalizedName(
        reportFields,
        TENDER_REPORT_CONFIG.fields.tenderType
    );
    const tenderCountField = getFieldByNormalizedName(
        reportFields,
        TENDER_REPORT_CONFIG.fields.tenderCount
    );
    const departmentField = getDepartmentNameField(reportFields);
    const monthField = getFieldByNormalizedName(
        reportFields,
        TENDER_REPORT_CONFIG.fields.month
    );
    const financialYearData = buildTenderFinancialYearData(
        reportData,
        chartMetric,
        revenueField,
        tenderCountField,
        statusField,
        tenderTypeField
    );
    const departmentData = selectedFinancialYear
        ? buildDepartmentFinancialYearData(
              reportData,
              selectedFinancialYear,
              chartMetric,
              revenueField,
              tenderCountField,
              statusField,
              tenderTypeField
          )
        : null;
    const handleChartDataPointClick = useCallback((event) => {
        if (
            selectedDepartment ||
            (event?.componentType && event.componentType !== "series")
        ) {
            return;
        }

        const data = selectedFinancialYear ? departmentData : financialYearData;
        const labelField = selectedFinancialYear
            ? TENDER_CHART_FIELDS.department
            : TENDER_CHART_FIELDS.financialYear;
        const clickedLabel = String(
            event?.axisValue ?? event?.name ?? ""
        ).trim();
        const clickedRow = data?.rows.find(
            (row) => String(row[labelField]) === clickedLabel
        ) || (
            Number.isInteger(event?.dataIndex)
                ? data?.rows[event.dataIndex]
                : null
        );

        if (!clickedRow) {
            return;
        }

        if (selectedFinancialYear) {
            setSelectedDepartment(clickedRow[labelField]);
        } else {
            setSelectedFinancialYear(clickedRow[labelField]);
        }
    }, [
        departmentData,
        financialYearData,
        selectedDepartment,
        selectedFinancialYear,
    ]);

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

    const departmentMonthlyData = selectedDepartment && selectedFinancialYear
        ? buildDepartmentMonthlyTenderTypeData(
              reportData,
              selectedFinancialYear,
              selectedDepartment,
              chartMetric,
              revenueField,
              tenderCountField,
              statusField,
              monthField,
              tenderTypeField
          )
        : null;
    const chartSourceData = selectedDepartment
        ? departmentMonthlyData || createEmptyDepartmentMonthlyData(chartMetric)
        : selectedFinancialYear
          ? departmentData || createEmptyDepartmentChartData(chartMetric)
        : financialYearData || createEmptyChartData(chartMetric);
    const chartType = getSupportedChartType(
        chartSourceData,
        TENDER_CONTROLS.chartTypes.financialYear,
        null,
        REPORT_IDS.TENDERS
    );
    const selection = getDefaultVisualizationSelection(chartSourceData, chartType, null, REPORT_IDS.TENDERS);
    const fieldLabels = getFieldLabels(reportData.fields);
    fieldLabels[TENDER_CHART_FIELDS.department] = TENDER_CHART_FIELDS.department;
    if (selectedDepartment) {
        fieldLabels[TENDER_CHART_FIELDS.month] = TENDER_CHART_FIELDS.month;
        TENDER_TYPE_VALUES.forEach((typeValue) => {
            const label = TENDER_TYPE_LABELS[typeValue] || `Type ${typeValue}`;
            const field = chartMetric === TENDER_CONTROLS.metrics.revenue.value
                ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
                : label;
            fieldLabels[field] = field;
        });
    } else if (selectedFinancialYear) {
        TENDER_CATEGORIES.forEach(({label}) => {
            const field = chartMetric === TENDER_CONTROLS.metrics.revenue.value
                ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
                : label;
            fieldLabels[field] = field;
        });
    } else if (chartMetric === TENDER_CONTROLS.metrics.revenue.value) {
        TENDER_CATEGORIES.forEach(({ label }) => {
            const revenueField = `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`;
            fieldLabels[revenueField] = revenueField;
        });
    }
    fieldLabels[TENDER_CHART_FIELDS.financialYear] = TENDER_CHART_FIELDS.financialYear;

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
    let chartDataNotice = null;

    if (selectedFinancialYear) {
        if (!departmentField) {
            chartDataNotice = "Department names are not available in this report.";
        } else if (chartMetric === TENDER_CONTROLS.metrics.revenue.value && !revenueField) {
            chartDataNotice = "Revenue data is not available in this report.";
        } else if (!tenderTypeField) {
            chartDataNotice = "Tender Type data is not available in this report.";
        } else if (!tenderCountField) {
            chartDataNotice = "Tender count data is not available in this report.";
        } else if (selectedDepartment && !monthField) {
            chartDataNotice = "Month data is not available in this report.";
        } else if (!departmentData) {
            chartDataNotice = "Department data is unavailable for the selected financial year.";
        } else if (selectedDepartment && !departmentMonthlyData) {
            chartDataNotice = `Monthly tender-type data is unavailable for ${selectedDepartment}.`;
        } else if (selectedDepartment && departmentMonthlyData.matchedTenderCount === 0) {
            chartDataNotice = `No tenders for ${selectedDepartment} match ${selectedFinancialYear} within the financial-year range in ${monthField}.`;
        } else if (departmentData.rows.length === 0) {
            chartDataNotice = `No departments have tenders in ${selectedFinancialYear}.`;
        } else if (
            !selectedDepartment &&
            departmentData.rows.length < TENDER_REPORT_CONFIG.maxDepartments
        ) {
            chartDataNotice = `The report contains ${departmentData.rows.length} departments with tenders in ${selectedFinancialYear}.`;
        }
    } else if (!tenderTypeField) {
        chartDataNotice = "Tender Type data is not available in this report.";
    } else if (!tenderCountField) {
        chartDataNotice = "Tender count data is not available in this report.";
    } else if (chartMetric === TENDER_CONTROLS.metrics.revenue.value && !revenueField) {
        chartDataNotice = "Revenue data is not available in this report.";
    } else if (!financialYearData) {
        chartDataNotice = "Tender category or financial year data is unavailable for this chart.";
    }

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
                {selectedFinancialYear && (
                    <div className="reports-drilldown-context">
                        <span>
                            Financial Year: <strong>{selectedFinancialYear}</strong>
                        </span>
                        {selectedDepartment && (
                            <span>
                                Department: <strong>{selectedDepartment}</strong>
                            </span>
                        )}
                        <button
                            className="reports-drilldown-back"
                            type="button"
                            onClick={() => {
                                if (selectedDepartment) {
                                    setSelectedDepartment(null);
                                    return;
                                }
                                setSelectedFinancialYear(null);
                            }}
                        >
                            {selectedDepartment ? "Back to departments" : "Back to financial years"}
                        </button>
                    </div>
                )}
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
            <DashboardVisualization
                reportType={REPORT_IDS.TENDERS}
                title={title}
                data={chartSourceData}
                controlData={chartSourceData}
                chartSourceData={chartSourceData}
                revenueDisplayConfig={getRevenueDisplayConfig(chartSourceData)}
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
                onChartDataPointClick={
                    !selectedDepartment
                        ? handleChartDataPointClick
                        : undefined
                }
            />
        </main>
    );
}

export default FYWiseTenders;