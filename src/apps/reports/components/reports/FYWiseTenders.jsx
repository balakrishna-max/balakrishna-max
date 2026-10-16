import { useCallback, useState } from "react";
import DashboardVisualization from "../DashboardVisualization.jsx";
import { getChartAxisOptions, getDefaultVisualizationSelection,
    getReportConfig, getSupportedChartType, REPORT_IDS } from "../../utils/dashboardConfig.js";
import { COLUMN_TYPES, getFieldLabels, getFieldByNormalizedName, getDepartmentNameField,
    getFilterField, getPeriodDateFields, parseRevenueValue, getRevenueDisplayConfig,
    getTenderValueLabel } from "../../utils/dashboardData.js";

const TENDER_REPORT_CONFIG = getReportConfig(REPORT_IDS.TENDERS);
const TENDER_CATEGORIES = TENDER_REPORT_CONFIG.tenderCategoryValues.map((apiValue) => ({
    apiValue, label: getTenderValueLabel(TENDER_REPORT_CONFIG.fields.category, apiValue),
}));
const TENDER_STATUSES = TENDER_REPORT_CONFIG.tenderStatusValues.map((apiValue) => ({
    apiValue,
    label: getTenderValueLabel(TENDER_REPORT_CONFIG.fields.status, apiValue),
}));
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

function buildTenderFinancialYearData(data, metric, revenueField) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
        return null;
    }

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

    const totalsByFinancialYear = new Map();

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

        if (!totalsByFinancialYear.has(financialYear)) {
            totalsByFinancialYear.set(financialYear, {
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

function buildFinancialYearPieData(data, metric) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
        return null;
    }

    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.revenueTotal
        : TENDER_CHART_FIELDS.tenderCount;
    const fields = data.fields.slice(1);

    return {
        fields: [TENDER_CHART_FIELDS.financialYear, valueField],
        rows: data.rows.map((row) => ({
            [TENDER_CHART_FIELDS.financialYear]: row[TENDER_CHART_FIELDS.financialYear],
            [valueField]: fields.reduce((total, field) => total + Number(row[field] || 0), 0),
        })),
        columnTypes: {
            [TENDER_CHART_FIELDS.financialYear]: COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.financialYear]: TENDER_CONTROLS.dataTypes.text,
            [valueField]: metric === TENDER_CONTROLS.metrics.revenue.value
                ? TENDER_CONTROLS.dataTypes.revenue
                : TENDER_CONTROLS.dataTypes.count,
        },
    };
}

function buildDepartmentFinancialYearData(
    data,
    financialYear,
    metric,
    revenueField,
    monthField,
    selectedCategory,
    statusField,
    tenderTypeField
) {
    if (!data || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
        return null;
    }

    const departmentField = getDepartmentNameField(data.fields);
    const categoryField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.category);
    const financialYearField = getFieldByNormalizedName(data.fields, TENDER_REPORT_CONFIG.fields.financialYear);

    if (
        !departmentField ||
        !categoryField ||
        !financialYearField ||
        !monthField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)
    ) {
        return null;
    }

    const categorySeries = TENDER_CATEGORIES.map(({ apiValue, label }) => ({
        apiValue,
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
    })).filter(({apiValue}) => selectedCategory === null || apiValue === selectedCategory);

    if (!statusField || !tenderTypeField) {
        return null;
    }

    const departmentTotals = new Map();

    data.rows.forEach((row) => {
        const rowFinancialYear = String(row[financialYearField] ?? "").trim();
        const department = String(row[departmentField] ?? "").trim();

        if (
            rowFinancialYear !== financialYear ||
            !department
        ) {
            return;
        }

        const month = getMonthValue(row[monthField]);
        if (!month || !isMonthInFinancialYear(month, financialYear)) {
            return;
        }

        const category = Number(String(row[categoryField] ?? "").trim());
        const categoryData = categorySeries.find((series) => series.apiValue === category);
        const status = Number(String(row[statusField] ?? "").trim());
        const tenderType = Number(String(row[tenderTypeField] ?? "").trim());
        if (
            !categoryData ||
            !TENDER_CATEGORIES.some((item) => item.apiValue === category) ||
            !TENDER_STATUSES.some((item) => item.apiValue === status) ||
            !TENDER_TYPE_VALUES.includes(tenderType)
        ) {
            return;
        }

        const amount = metric === TENDER_CONTROLS.metrics.revenue.value
            ? parseRevenueValue(row[revenueField])
            : 1;
        if (!Number.isFinite(amount)) {
            return;
        }

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

function buildDepartmentMonthlyTenderStatusData(
    data,
    financialYear,
    department,
    metric,
    revenueField,
    monthField,
    selectedCategory,
    tenderStatusField,
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
    const categoryField = getFieldByNormalizedName(
        data.fields,
        TENDER_REPORT_CONFIG.fields.category
    );

    if (!departmentField || !financialYearField || !tenderStatusField ||
        !categoryField || !tenderTypeField ||
        (metric === TENDER_CONTROLS.metrics.revenue.value && !revenueField)) {
        return null;
    }

    const statusSeries = TENDER_STATUSES.map(({apiValue, label}) => ({
        apiValue,
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
    }));
    const totalsByMonth = new Map();

    data.rows.forEach((row) => {
        if (
            String(row[financialYearField] ?? "").trim() !== financialYear ||
            String(row[departmentField] ?? "").trim() !== department ||
            !TENDER_CATEGORIES.some(
                (item) => item.apiValue === Number(String(row[categoryField] ?? "").trim())
            ) ||
            (selectedCategory !== null &&
                Number(String(row[categoryField] ?? "").trim()) !== selectedCategory) ||
            !TENDER_TYPE_VALUES.includes(Number(String(row[tenderTypeField] ?? "").trim()))
        ) {
            return;
        }

        const month = getMonthValue(row[monthField]);
        if (!month || !isMonthInFinancialYear(month, financialYear)) {
            return;
        }
        const status = Number(String(row[tenderStatusField] ?? "").trim());
        const series = statusSeries.find(({apiValue}) => apiValue === status);

        if (!series) {
            return;
        }

        const amount = metric === TENDER_CONTROLS.metrics.revenue.value
            ? parseRevenueValue(row[revenueField])
            : 1;
        if (!Number.isFinite(amount)) {
            return;
        }

        const monthIndex = month.year * 12 + month.month - 1;
        const monthLabel = new Intl.DateTimeFormat("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
        const monthData = totalsByMonth.get(monthIndex) || {
            [TENDER_CHART_FIELDS.month]: monthLabel,
            ...Object.fromEntries(statusSeries.map(({field}) => [field, 0])),
        };
        monthData[series.field] += amount;
        totalsByMonth.set(monthIndex, monthData);
    });

    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields: [TENDER_CHART_FIELDS.month, ...statusSeries.map(({field}) => field)],
        rows: Array.from(totalsByMonth.entries())
            .sort(([firstMonth], [secondMonth]) => firstMonth - secondMonth)
            .map(([, row]) => row),
        columnTypes: {
            [TENDER_CHART_FIELDS.month]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(statusSeries.map(({field}) => [field, COLUMN_TYPES.NUMBER])),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.month]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(statusSeries.map(({field}) => [field, valueDataType])),
        },
    };
}

function buildTenderStatusPieData(data, metric) {
    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.revenueTotal
        : TENDER_CHART_FIELDS.tenderCount;

    return {
        fields: [TENDER_CHART_FIELDS.status, valueField],
        rows: TENDER_STATUSES.map(({label}) => {
            const field = metric === TENDER_CONTROLS.metrics.revenue.value
                ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
                : label;

            return {
                [TENDER_CHART_FIELDS.status]: label,
                [valueField]: data.rows.reduce((total, row) => total + Number(row[field] || 0), 0),
            };
        }),
        columnTypes: {
            [TENDER_CHART_FIELDS.status]: COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.status]: TENDER_CONTROLS.dataTypes.text,
            [valueField]: metric === TENDER_CONTROLS.metrics.revenue.value
                ? TENDER_CONTROLS.dataTypes.revenue
                : TENDER_CONTROLS.dataTypes.count,
        },
    };
}

function createEmptyDepartmentMonthlyData(metric) {
    const statusFields = TENDER_STATUSES.map(({label}) => ({
        field: metric === TENDER_CONTROLS.metrics.revenue.value
            ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
            : label,
    }));
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields: [TENDER_CHART_FIELDS.month, ...statusFields.map(({field}) => field)],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.month]: COLUMN_TYPES.TEXT,
            ...Object.fromEntries(statusFields.map(({field}) => [field, COLUMN_TYPES.NUMBER])),
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.month]: TENDER_CONTROLS.dataTypes.text,
            ...Object.fromEntries(statusFields.map(({field}) => [field, valueDataType])),
        },
    };
}

function createEmptyDepartmentPieData(metric) {
    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.departmentRevenue
        : TENDER_CHART_FIELDS.departmentCount;
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    return {
        fields: [TENDER_CHART_FIELDS.department, valueField],
        rows: [],
        columnTypes: {
            [TENDER_CHART_FIELDS.department]: COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.department]: TENDER_CONTROLS.dataTypes.text,
            [valueField]: valueDataType,
        },
    };
}

function createEmptyChartData(chartStyle, metric) {
    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.revenueTotal
        : TENDER_CHART_FIELDS.tenderCount;
    const valueDataType = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CONTROLS.dataTypes.revenue
        : TENDER_CONTROLS.dataTypes.count;

    if (chartStyle === TENDER_CONTROLS.chartStyles.pie.value) {
        return {
            fields: [TENDER_CHART_FIELDS.financialYear, valueField],
            rows: [],
            columnTypes: {
                [TENDER_CHART_FIELDS.financialYear]: COLUMN_TYPES.TEXT,
                [valueField]: COLUMN_TYPES.NUMBER,
            },
            dataTypes: {
                [TENDER_CHART_FIELDS.financialYear]: TENDER_CONTROLS.dataTypes.text,
                [valueField]: valueDataType,
            },
        };
    }

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

function buildDepartmentPieData(data, metric) {
    const fields = data.fields.filter((field) => field !== TENDER_CHART_FIELDS.department);
    const valueField = metric === TENDER_CONTROLS.metrics.revenue.value
        ? TENDER_CHART_FIELDS.departmentRevenue
        : TENDER_CHART_FIELDS.departmentCount;

    return {
        fields: [TENDER_CHART_FIELDS.department, valueField],
        rows: data.rows.map((row) => ({
            [TENDER_CHART_FIELDS.department]: row[TENDER_CHART_FIELDS.department],
            [valueField]: fields.reduce((total, field) => total + Number(row[field] || 0), 0),
        })),
        columnTypes: {
            [TENDER_CHART_FIELDS.department]: COLUMN_TYPES.TEXT,
            [valueField]: COLUMN_TYPES.NUMBER,
        },
        dataTypes: {
            [TENDER_CHART_FIELDS.department]: TENDER_CONTROLS.dataTypes.text,
            [valueField]: metric === TENDER_CONTROLS.metrics.revenue.value
                ? TENDER_CONTROLS.dataTypes.revenue
                : TENDER_CONTROLS.dataTypes.count,
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
    const [selectedFinancialYear, setSelectedFinancialYear] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
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
    const departmentField = getDepartmentNameField(reportFields);
    const monthField = reportData ? getPeriodDateFields(reportData).periodDateField : "";
    const financialYearData = buildTenderFinancialYearData(
        reportData,
        chartMetric,
        revenueField
    );
    const departmentData = selectedFinancialYear
        ? buildDepartmentFinancialYearData(
              reportData,
              selectedFinancialYear,
              chartMetric,
              revenueField,
              monthField,
              selectedCategory,
              statusField,
              tenderTypeField
          )
        : null;
    const handleChartDataPointClick = useCallback((event) => {
        if (selectedDepartment) {
            return;
        }

        const clickedLabels = [event?.name, event?.axisValue]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean);

        if (selectedFinancialYear) {
            const clickedDepartment = departmentData?.rows.find(
                (row) => clickedLabels.includes(row[TENDER_CHART_FIELDS.department])
            );
            if (clickedDepartment) {
                setSelectedDepartment(clickedDepartment[TENDER_CHART_FIELDS.department]);
            }
            return;
        }

        const clickedFinancialYear = financialYearData?.rows.find(
            (row) => clickedLabels.includes(row[TENDER_CHART_FIELDS.financialYear])
        );
        if (clickedFinancialYear) {
            setSelectedFinancialYear(clickedFinancialYear[TENDER_CHART_FIELDS.financialYear]);
            const clickedCategoryLabel = String(event?.seriesName ?? "").trim();
            const clickedCategory = TENDER_CATEGORIES.find(
                ({label}) => clickedCategoryLabel === (
                    chartMetric === TENDER_CONTROLS.metrics.revenue.value
                        ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
                        : label
                )
            );
            setSelectedCategory(
                chartStyle === TENDER_CONTROLS.chartStyles.bar.value
                    ? clickedCategory?.apiValue ?? null
                    : null
            );
        }
    }, [
        chartStyle,
        chartMetric,
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

    const pieData = buildFinancialYearPieData(financialYearData, chartMetric);
    const activeChartData = chartStyle === TENDER_CONTROLS.chartStyles.pie.value
        ? pieData
        : financialYearData;
    const departmentMonthlyData = selectedDepartment && selectedFinancialYear
        ? buildDepartmentMonthlyTenderStatusData(
              reportData,
              selectedFinancialYear,
              selectedDepartment,
              chartMetric,
              revenueField,
              monthField,
              selectedCategory,
              statusField,
              tenderTypeField
          )
        : null;
    const chartSourceData = selectedDepartment
        ? departmentMonthlyData
            ? chartStyle === TENDER_CONTROLS.chartStyles.pie.value
                ? buildTenderStatusPieData(departmentMonthlyData, chartMetric)
                : departmentMonthlyData
            : createEmptyDepartmentMonthlyData(chartMetric)
        : selectedFinancialYear
          ? chartStyle === TENDER_CONTROLS.chartStyles.pie.value
              ? departmentData
                  ? buildDepartmentPieData(departmentData, chartMetric)
                  : createEmptyDepartmentPieData(chartMetric)
              : departmentData || createEmptyDepartmentChartData(chartMetric)
        : activeChartData || createEmptyChartData(chartStyle, chartMetric);
    const defaultChartType = selectedFinancialYear
        ? chartStyle === TENDER_CONTROLS.chartStyles.pie.value
            ? TENDER_CONTROLS.chartTypes.departmentPie
            : TENDER_CONTROLS.chartTypes.department
        : chartStyle === TENDER_CONTROLS.chartStyles.pie.value
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
    fieldLabels[TENDER_CHART_FIELDS.department] = TENDER_CHART_FIELDS.department;
    if (selectedDepartment) {
        fieldLabels[TENDER_CHART_FIELDS.month] = TENDER_CHART_FIELDS.month;
        TENDER_STATUSES.forEach(({label}) => {
            const field = chartMetric === TENDER_CONTROLS.metrics.revenue.value
                ? `${label} ${TENDER_CHART_FIELDS.revenueSuffix}`
                : label;
            fieldLabels[field] = field;
        });
        fieldLabels[TENDER_CHART_FIELDS.status] = TENDER_CHART_FIELDS.status;
        fieldLabels[chartMetric === TENDER_CONTROLS.metrics.revenue.value
            ? TENDER_CHART_FIELDS.revenueTotal
            : TENDER_CHART_FIELDS.tenderCount] = chartMetric === TENDER_CONTROLS.metrics.revenue.value
                ? TENDER_CHART_FIELDS.revenueTotal
                : TENDER_CHART_FIELDS.tenderCount;
    } else if (selectedFinancialYear) {
        const metricField = chartMetric === TENDER_CONTROLS.metrics.revenue.value
            ? TENDER_CHART_FIELDS.departmentRevenue
            : TENDER_CHART_FIELDS.departmentCount;
        fieldLabels[metricField] = metricField;
    } else if (chartStyle === TENDER_CONTROLS.chartStyles.pie.value) {
        const pieMetricField = chartMetric === TENDER_CONTROLS.metrics.revenue.value
            ? TENDER_CHART_FIELDS.revenueTotal
            : TENDER_CHART_FIELDS.tenderCount;
        fieldLabels[TENDER_CHART_FIELDS.financialYear] = TENDER_CHART_FIELDS.financialYear;
        fieldLabels[pieMetricField] = pieMetricField;
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
    const categoryScope = selectedCategory === null
        ? TENDER_CATEGORIES.map(({label}) => label).join(", ")
        : TENDER_CATEGORIES.find(({apiValue}) => apiValue === selectedCategory)?.label;
    let chartDataNotice = null;

    if (selectedFinancialYear) {
        if (!departmentField) {
            chartDataNotice = "Department names are not available in this report.";
        } else if (chartMetric === TENDER_CONTROLS.metrics.revenue.value && !revenueField) {
            chartDataNotice = "Revenue data is not available in this report.";
        } else if (!statusField) {
            chartDataNotice = "Tender Status data is not available in this report.";
        } else if (!tenderTypeField) {
            chartDataNotice = "Tender Type data is not available in this report.";
        } else if (!monthField) {
            chartDataNotice = "Month data is not available in this report.";
        } else if (!departmentData) {
            chartDataNotice = "Department data is unavailable for the selected financial year.";
        } else if (selectedDepartment && !departmentMonthlyData) {
            chartDataNotice = `Monthly Tender Status data is unavailable for ${selectedDepartment}.`;
        } else if (selectedDepartment && departmentMonthlyData.rows.length === 0) {
            chartDataNotice = `No monthly Published or Closed rows for ${selectedDepartment} match ${selectedFinancialYear}, ${categoryScope}, configured Tender Types, and the financial-year date range in ${monthField}.`;
        } else if (departmentData.rows.length === 0) {
            chartDataNotice = `No departments have Published or Closed rows for ${categoryScope} and configured Tender Types in ${selectedFinancialYear} using ${monthField} within the financial-year date range.`;
        } else if (departmentData.rows.length < TENDER_REPORT_CONFIG.maxDepartments) {
            chartDataNotice = `The fetched report contains ${departmentData.rows.length} departments with Published or Closed rows for ${categoryScope} and configured Tender Types in ${selectedFinancialYear}.`;
        }
    } else if (chartMetric === TENDER_CONTROLS.metrics.revenue.value && !revenueField) {
        chartDataNotice = "Revenue data is not available in this report.";
    } else if (!activeChartData) {
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
                        {selectedCategory !== null && (
                            <span>
                                Tender Category: <strong>
                                    {TENDER_CATEGORIES.find(
                                        ({apiValue}) => apiValue === selectedCategory
                                    )?.label}
                                </strong>
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
                                setSelectedCategory(null);
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
            {chartDataNotice && (
                <p className="reports-chart-data-notice" role="status">
                    {chartDataNotice}
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