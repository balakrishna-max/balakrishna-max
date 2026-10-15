import {COLUMN_TYPES, isNumericChartField, isRevenueField, getFilterField, getTenderValueLabel} from "./dashboardData.js";

const STANDARD_X_AXIS_TYPES = [COLUMN_TYPES.TEXT];
const NUMBER_Y_AXIS_TYPES = [COLUMN_TYPES.NUMBER];
const STANDARD_CHART_CAPABILITY = {minYAxisFields: 1, maxYAxisFields: 1, allowedXAxisTypes: STANDARD_X_AXIS_TYPES, allowedYAxisTypes: NUMBER_Y_AXIS_TYPES,};

const CHART_COLORS = [
    "#3B82F6", "#F97316", "#14B87A", "#E83E8C", "#FACC15", "#8B5CF6",
    "#22D3EE", "#EF4444", "#84CC16", "#92400E", "#A855F7", "#2DD4BF",
    "#FB923C", "#38BDF8", "#D946EF", "#059669", "#334155", "#FBBF24",
    "#818CF8", "#047857", "#F43F5E", "#0EA5E9", "#65A30D", "#6D28D9",
    "#67E8F9", "#C2410C", "#F472B6", "#6366F1", "#EAB308", "#9D174D",
    "#6EE7B7", "#B91C1C",
];

const CHART_DEFINITIONS = [
    {value: "area", label: "Area Chart", capability: {...STANDARD_CHART_CAPABILITY}},
    {value: "bar", label: "Bar Chart", capability: {...STANDARD_CHART_CAPABILITY, allowedXAxisTypes: [COLUMN_TYPES.TEXT, COLUMN_TYPES.DATE]}},
    {value: "grouped-bar", label: "Grouped Bar Chart", capability: {...STANDARD_CHART_CAPABILITY, maxYAxisFields: Infinity, multiYAxis: true}},
    {value: "composed", label: "Composed Chart", capability: {...STANDARD_CHART_CAPABILITY}},
    {value: "horizontal-bar", label: "Horizontal Bar Chart", capability: {...STANDARD_CHART_CAPABILITY, allowedXAxisTypes: [COLUMN_TYPES.TEXT, COLUMN_TYPES.DATE]}},
    {value: "line", label: "Line Chart", capability: {...STANDARD_CHART_CAPABILITY}},
    {value: "pie", label: "Pie Chart", capability: {...STANDARD_CHART_CAPABILITY}},
    {value: "radar", label: "Radar Chart", capability: {...STANDARD_CHART_CAPABILITY}},
    {value: "scatter", label: "Scatter Plot", capability: {...STANDARD_CHART_CAPABILITY, allowedXAxisTypes: [COLUMN_TYPES.NUMBER], allowSameAxisField: true}},
    {value: "stacked-area", label: "Stacked Area Chart", capability: {...STANDARD_CHART_CAPABILITY, maxYAxisFields: Infinity, multiYAxis: true}},
    {value: "stacked-bar", label: "Stacked Bar Chart", capability: {...STANDARD_CHART_CAPABILITY, maxYAxisFields: Infinity, multiYAxis: true}},
];

const chartTypes = CHART_DEFINITIONS.map(({value, label}) => ({value, label}));
const CHART_CAPABILITIES = Object.fromEntries(CHART_DEFINITIONS.map(({value, capability}) => [value, capability]));

const OVERALL_REPORT_CONTROLS = Object.freeze({ reportType: true, chartType: true, xAxis: true, yAxis: true,
    filters: true, period: true, viewMode: true, csvImport: true, csvExport: true });

const DEFAULT_PERIOD_START_MONTH = 4;
const OVERALL_REPORT_CHART_TITLES = Object.freeze({
    groupedRevenueYAxis: "Total Tender Revenue",
    groupedCountYAxis: "Total Number of Tenders",
});
const NO_REPORT_SELECTED_CONTROLS = Object.freeze({
    reportType: true,
    chartType: false,
    xAxis: false,
    yAxis: false,
    filters: false,
    period: false,
    viewMode: true,
    csvImport: true,
    csvExport: true,
});
const NO_REPORT_SELECTED_CHART_TITLES = Object.freeze({});

function getDefaultPeriod(today = new Date()) {
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const startYear = currentMonth >= DEFAULT_PERIOD_START_MONTH
        ? currentYear
        : currentYear - 1;

    return {
        fromDate: `${String(DEFAULT_PERIOD_START_MONTH).padStart(2, "0")}/${startYear}`,
        toDate: `${String(currentMonth).padStart(2, "0")}/${currentYear}`,
    };
}

const REPORT_IDS = {
    TENDERS: "tenders",
    PROCUREMENT_SUMMARY: "td-ecv-summary",
    DEPARTMENT_WISE_TENDERS: "dw-tenders",
    OVERALL_REPORTS: "overall-reports",
};

const REPORT_CONFIG = {
    [REPORT_IDS.TENDERS]: {
        cardLabel: "Tenders - FY Wise",
        label: "Tenders",
        apiReportType: "tcc",
        component: "fyWiseTenders",
        controls: OVERALL_REPORT_CONTROLS,
        chartTitles: OVERALL_REPORT_CHART_TITLES,
        fields: {
            category: "ntendercategory",
            financialYear: "sfinyear",
            revenue: "secv",
        },
        chartFields: {
            financialYear: "Financial Year",
            category: "Tender Category",
            revenueTotal: "Total Revenue",
            tenderCount: "Tender Count",
            revenueSuffix: "Revenue",
        },
        fyWiseControls: {
            defaultChartStyle: "bar",
            chartStyles: {
                pie: {value: "pie", label: "Pie"},
                bar: {value: "bar", label: "Bar"},
            },
            defaultMetric: "count",
            metrics: {
                count: {value: "count", label: "No. of Tenders"},
                revenue: {value: "revenue", label: "Tenders Revenue"},
            },
            chartTypes: {
                pie: "pie",
                financialYear: "grouped-bar",
            },
            dataTypes: {
                text: "STRING",
                count: "INTEGER",
                revenue: "DECIMAL",
            },
        },
        maxFinancialYears: 8,
        tenderCategoryValues: [102, 101, 104],
        card: true,
        dashboard: true,
    },
    [REPORT_IDS.PROCUREMENT_SUMMARY]: {
        cardLabel: "Procurement Summary",
        label: "TD-ECV Summary",
        apiReportType: "td-ecv-summary",
        component: "procurementSummary",
        controls: OVERALL_REPORT_CONTROLS,
        chartTitles: OVERALL_REPORT_CHART_TITLES,
        card: true,
        dashboard: true,
        departmentAxis: true,
        excludedAxisFields: ["nmappingdeptid"],
    },
    [REPORT_IDS.DEPARTMENT_WISE_TENDERS]: {
        cardLabel: "Department-Wise Tenders",
        label: "Department Wise Tenders",
        apiReportType: "dw-tenders",
        component: "dwTenders",
        controls: OVERALL_REPORT_CONTROLS,
        chartTitles: OVERALL_REPORT_CHART_TITLES,
        card: true,
        dashboard: true,
        departmentAxis: true,
    },
    "tender-analysis": {
        cardLabel: "Card 4", label: "Tender Analysis", apiReportType: "tender-analysis",
        component: null, card: true, dashboard: true,
        controls: OVERALL_REPORT_CONTROLS, chartTitles: OVERALL_REPORT_CHART_TITLES,
    },
    "supplier-analysis": {
        cardLabel: "Card 5", label: "Supplier Analysis", apiReportType: "supplier-analysis",
        component: null, card: true, dashboard: true,
        controls: OVERALL_REPORT_CONTROLS, chartTitles: OVERALL_REPORT_CHART_TITLES,
    },
    "bid-analysis": {
        cardLabel: "Card 6", label: "Bid Analysis", apiReportType: "bid-analysis",
        component: null, card: true, dashboard: true,
        controls: OVERALL_REPORT_CONTROLS, chartTitles: OVERALL_REPORT_CHART_TITLES,
    },
    payment: {
        cardLabel: "Card 7", label: "Payment", apiReportType: "payment",
        component: null, card: true, dashboard: true,
        controls: OVERALL_REPORT_CONTROLS, chartTitles: OVERALL_REPORT_CHART_TITLES,
    },
    "card-8": {
        cardLabel: "Card 8", label: "Card 8", apiReportType: "card-8",
        component: null, card: true,
    },
    "card-9": {
        cardLabel: "Card 9", label: "Card 9", apiReportType: "card-9",
        component: null, card: true,
    },
    "card-10": {
        cardLabel: "Card 10", label: "Card 10", apiReportType: "card-10",
        component: null, card: true,
    },
    "card-11": {
        cardLabel: "Card 11", label: "Card 11", apiReportType: "card-11",
        component: null, card: true,
    },
    [REPORT_IDS.OVERALL_REPORTS]: {
        cardLabel: "Overall Reports",
        label: "Overall Reports",
        component: "overallReports",
        card: true,
        apiReportType: null,
    },
};

const filterTypes = [
    {value: "none", label: "None", hasOptions: false},
    {value: "category-wise", label: "Category wise", hasOptions: true},
    {value: "status", label: "Status", hasOptions: true},
];

const reportTypes = Object.entries(REPORT_CONFIG)
    .filter(([, report]) => report.dashboard)
    .map(([value, {label}]) => ({value, label}));

const reportCards = Object.entries(REPORT_CONFIG)
    .filter(([, report]) => report.card)
    .map(([id, report]) => ({id, label: report.cardLabel}));

function getReportConfig(reportId) {
    return REPORT_CONFIG[reportId];
}

function getReportControls(reportId) {
    if (!reportId) {
        return NO_REPORT_SELECTED_CONTROLS;
    }

    const controls = getReportConfig(reportId)?.controls;

    if (!controls) {
        throw new Error(`Report controls are not configured for "${reportId}".`);
    }

    return controls;
}

function getReportChartTitles(reportId) {
    if (!reportId) {
        return NO_REPORT_SELECTED_CHART_TITLES;
    }

    const chartTitles = getReportConfig(reportId)?.chartTitles;

    if (!chartTitles) {
        throw new Error(`Report chart titles are not configured for "${reportId}".`);
    }

    return chartTitles;
}

function getApiReportType(reportId) {
    const apiReportType = getReportConfig(reportId)?.apiReportType;

    if (typeof apiReportType !== "string" || !apiReportType) {
        throw new Error(`API report type is not configured for "${reportId}".`);
    }

    return apiReportType;
}

function isReportAxisFieldAllowed(reportId, axisName, field) {
    const report = getReportConfig(reportId);
    const excludedFields = new Set(
        (report?.excludedAxisFields || []).map((excludedField) =>
            excludedField.toLowerCase()
        )
    );
    const allowedFields = report?.axisFields?.[axisName];
    return !excludedFields.has(field.toLowerCase()) &&
        (!Array.isArray(allowedFields) || allowedFields.includes(field));
}

function getReportAxisData(data, reportId) {
    if (!data || !Array.isArray(data.fields)) {
        return data;
    }

    const report = getReportConfig(reportId);
    const excludedFields = new Set(
        (report?.excludedAxisFields || []).map((field) => field.toLowerCase())
    );

    return {
        ...data,
        fields: data.fields.filter((field) =>
            !excludedFields.has(field.toLowerCase()) &&
            (!report?.axisFields?.all || report.axisFields.all.includes(field))
        ),
    };
}

function getChartCapabilities(chartType) {
    return CHART_CAPABILITIES[chartType];
}

function isMultiYAxisChart(chartType) {
    return CHART_CAPABILITIES[chartType]?.multiYAxis === true;
}

function isDepartmentAxisReport(reportId) {
    return getReportConfig(reportId)?.departmentAxis === true;
}

function getFieldType(columnTypes, field) {
    if (!columnTypes || !field) {
        return null;
    }

    return columnTypes[field] || null;
}

function getYAxisFieldType(data, field) {
    if (!data || !data.columnTypes || !field) {
        return null;
    }

    const fieldType = getFieldType(data.columnTypes, field);

    if (isNumericChartField(data, field)) {
        return COLUMN_TYPES.NUMBER;
    }

    return fieldType;
}

function getXAxisFieldType(data, field, chartType) {
    if (!data || !data.columnTypes || !field) {
        return null;
    }

    const declaredType = getFieldType(data.columnTypes, field);
    const capabilities = getChartCapabilities(chartType);
    if (declaredType === COLUMN_TYPES.TEXT &&
        capabilities?.allowedXAxisTypes.includes(COLUMN_TYPES.TEXT)) {
        return declaredType;
    }

    return isNumericChartField(data, field) ? COLUMN_TYPES.NUMBER : declaredType;
}

function isXAxisFieldAllowed(data, chartType, field) {
    const capabilities = getChartCapabilities(chartType);
    const fieldType = getXAxisFieldType(data, field, chartType);

    return Boolean(
        data?.columnTypes &&
        field &&
        capabilities?.allowedXAxisTypes.includes(
            fieldType
        ) &&
        !(fieldType === COLUMN_TYPES.TEXT && isRevenueField(field))
    );
}

function isYAxisFieldAllowed(data, chartType, field) {
    const capabilities = getChartCapabilities(chartType);

    return Boolean(
        data?.columnTypes &&
        field &&
        capabilities?.allowedYAxisTypes.includes(
            getYAxisFieldType(data, field)
        )
    );
}

function getChartAxisFieldOptions(data, chartType, axisName, excludedFields = [], referenceYAxisField = "", reportId = "") {
    if (!data || !Array.isArray(data.fields)) {
        return [];
    }

    const excludedFieldSet = new Set([
        ...(Array.isArray(excludedFields) ? excludedFields : [excludedFields]),
    ]);
    const isFieldAllowed = axisName === "x"
        ? (field) => isXAxisFieldAllowed(data, chartType, field)
        : (field) => isYAxisFieldAllowed(data, chartType, field);

    const referenceIsRevenue = referenceYAxisField
        ? isRevenueField(referenceYAxisField)
        : null;

    return data.fields.filter((field) => {
        if (
            excludedFieldSet.has(field) ||
            !isReportAxisFieldAllowed(reportId, axisName, field) ||
            !isFieldAllowed(field)
        ) {
            return false;
        }

        if (
            axisName === "y" &&
            isMultiYAxisChart(chartType) &&
            referenceIsRevenue !== null
        ) {
            return isRevenueField(field) === referenceIsRevenue;
        }

        return true;
    });
}

function isChartTypeSupported(data, chartType, fixedXAxisField = null, reportId = "") {
    if (!data || !Array.isArray(data.fields) || !data.columnTypes) {
        return false;
    }
    const capabilities = getChartCapabilities(chartType);
    if (!capabilities) {
        return false;
    }
    const supportedChartTypes = getReportConfig(reportId)?.chartTypes;
    if (supportedChartTypes && !supportedChartTypes.includes(chartType)) {
        return false;
    }

    const usesFixedXAxisField = fixedXAxisField !== null && chartType !== "scatter";
    const xAxisCandidates = usesFixedXAxisField
        ? [fixedXAxisField].filter(
              (field) =>
                  data.fields.includes(field) &&
                  isReportAxisFieldAllowed(reportId, "x", field) &&
                  isXAxisFieldAllowed(data, chartType, field)
          )
        : getChartAxisFieldOptions(data, chartType, "x", [], "", reportId);

    if (xAxisCandidates.length === 0) {
        return false;
    }

    return xAxisCandidates.some(
        (xAxisField) => {
            const yAxisCandidates =
                data.fields.filter(
                    (field) =>
                        field !== xAxisField &&
                        isReportAxisFieldAllowed(reportId, "y", field) &&
                        isYAxisFieldAllowed(data, chartType, field)
                );

            return (yAxisCandidates.length >= capabilities.minYAxisFields);
        }
    );
}

function getChartTypeOptions(data, fixedXAxisField = null, reportId = "") {
    return chartTypes.map(
        (chartType) => ({
            ...chartType,
            disabled:
                !isChartTypeSupported(
                    data,
                    chartType.value,
                    fixedXAxisField,
                    reportId
                ),
        })
    );
}

function getSupportedChartType(data, preferredChartType, fixedXAxisField = null, reportId = "") {
    const options = getChartTypeOptions(data, fixedXAxisField, reportId);
    return options.find(
        (option) => option.value === preferredChartType && !option.disabled
    )?.value || options.find((option) => !option.disabled)?.value || null;
}

function getChartAxisOptions(
    data,
    {chartType, axisName, fieldLabels = {}, excludedFields = [], referenceYAxisField = "", reportId = "", fixedXAxisField = null}
) {
    return getChartAxisFieldOptions(
        data,
        chartType,
        axisName,
        excludedFields,
        referenceYAxisField,
        reportId
    )
        .filter((field) =>
            axisName !== "x" ||
            chartType === "scatter" ||
            fixedXAxisField === null ||
            field === fixedXAxisField
        )
        .map((field) => ({value: field, label: fieldLabels[field] || field}));
}

function getDefaultVisualizationSelection(data, chartType = "area", fixedXAxisField = null, reportId = "") {
    if (!data || !Array.isArray(data.fields) || !data.columnTypes) {
        return {chartType, xAxisField: "", yAxisField: "", yAxisFields: []};
    }

    const capabilities = getChartCapabilities(chartType);

    if (!capabilities) {
        return {
            chartType,
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const xAxisField =
        chartType !== "scatter" && fixedXAxisField !== null
            ? fixedXAxisField
            : getChartAxisFieldOptions(data, chartType, "x", [], "", reportId)[0] ?? "";

    if (!isXAxisFieldAllowed(data, chartType, xAxisField)) {
        return {
            chartType,
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    let yAxisCandidates = getChartAxisFieldOptions(data, chartType, "y", xAxisField, "", reportId);

    if (isMultiYAxisChart(chartType) && yAxisCandidates.length > 0) {
        yAxisCandidates = getChartAxisFieldOptions(
            data,
            chartType,
            "y",
            xAxisField,
            yAxisCandidates[0],
            reportId
        );
    }

    const yAxisField = yAxisCandidates[0] || "";

    const isMultiYAxis = isMultiYAxisChart(chartType);

    return {
        chartType,
        xAxisField,
        yAxisField,
        yAxisFields: isMultiYAxis
            ? yAxisCandidates
            : [],
    };
}

function getChartTypeSelection({data, chartType, xAxisField, yAxisField, yAxisFields = [], fixedXAxisField = null, reportId = ""}) {
    if (!data || !Array.isArray(data.fields) || !data.columnTypes) {
        return {
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const capabilities = getChartCapabilities(chartType);

    if (!capabilities) {
        return {
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const currentYAxisFields = yAxisFields.length > 0 ? yAxisFields : yAxisField ? [yAxisField] : [];
    let validCurrentYAxisFields = currentYAxisFields.filter(
        (field) =>
            data.fields.includes(field) &&
            isReportAxisFieldAllowed(reportId, "y", field) &&
            isYAxisFieldAllowed(data, chartType, field)
    );
    if (isMultiYAxisChart(chartType) && validCurrentYAxisFields.length > 0) {
        const referenceYAxisField = validCurrentYAxisFields[0];
        validCurrentYAxisFields = validCurrentYAxisFields.filter(
            (field) => isRevenueField(field) === isRevenueField(referenceYAxisField)
        );
    }
    const nextXAxisField = fixedXAxisField !== null && chartType !== "scatter" ? fixedXAxisField : (
        isReportAxisFieldAllowed(reportId, "x", xAxisField) &&
        isXAxisFieldAllowed(data, chartType, xAxisField) &&
        (capabilities.allowSameAxisField || !validCurrentYAxisFields.includes(xAxisField))
            ? xAxisField
            : getChartAxisFieldOptions(data, chartType, "x", [], "", reportId).find(
                  (field) => capabilities.allowSameAxisField || !validCurrentYAxisFields.includes(field)
              ) || ""
    );

    if (!isXAxisFieldAllowed(data, chartType, nextXAxisField)) {
        return {
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const isMultiYAxis = isMultiYAxisChart(chartType);
    const validYAxisFields = validCurrentYAxisFields.filter((field) => field !== nextXAxisField);
    let defaultYAxisFields = getChartAxisFieldOptions(data, chartType, "y", nextXAxisField, "", reportId);
    if (isMultiYAxis && defaultYAxisFields.length > 0) {
        defaultYAxisFields = getChartAxisFieldOptions(
            data,
            chartType,
            "y",
            nextXAxisField,
            defaultYAxisFields[0],
            reportId
        );
    }

    if (isMultiYAxis) {
        const nextYAxisFields = validYAxisFields.length > 0 ? validYAxisFields : defaultYAxisFields.slice(0, 1);

        return {
            xAxisField: nextXAxisField,
            yAxisField: nextYAxisFields[0] ||  "",
            yAxisFields: nextYAxisFields,
        };
    }

    const nextYAxisField = validYAxisFields[0] || defaultYAxisFields[0] || "";

    return {xAxisField: nextXAxisField, yAxisField: nextYAxisField, yAxisFields: []};
}

function getChartLabel(chartType) {
    return (CHART_CAPABILITIES[chartType] ? chartTypes.find((chart) => chart.value === chartType )?.label : chartType) || chartType;
}

function getFieldTypeLabel(fieldType) {
    switch (fieldType) {
        case COLUMN_TYPES.NUMBER:
            return "numeric";

        case COLUMN_TYPES.DATE:
            return "date";

        case COLUMN_TYPES.TEXT:
            return "text/category";

        default:
            return "unknown";
    }
}

function validateAxisFieldType({field, fieldType, axisName, allowedTypes,}) {
    if (!field) {
        return {
            isValid: false,
            message: `Select a ${axisName}-axis field to continue.`,
        };
    }

    if (!fieldType) {
        return {
            isValid: false,
            message:
                `The datatype of ${field} on the ${axisName}-axis could not be determined.`,
        };
    }

    if (
        !allowedTypes.includes(fieldType)
    ) {
        const allowedTypeLabels =
            allowedTypes.map(
                getFieldTypeLabel
            );

        return {
            isValid: false,
            message:
                `The selected field "${field}" cannot be used on the ${axisName}-axis. ` +
                `This chart requires ${allowedTypeLabels.join(
                    " or "
                )} values on the ${axisName}-axis, but "${field}" contains ${getFieldTypeLabel(
                    fieldType
                )} values.`,
        };
    }

    return {
        isValid: true,
        message: "",
    };
}

function validateChartSelection({data, chartType, xAxisField, yAxisField, yAxisFields = [], reportId = ""}) {
    const capabilities = getChartCapabilities(chartType);

    const chartLabel = getChartLabel(chartType);

    if (!data) {
        return {
            isValid: false,
            message:
                "Upload a CSV file before creating a chart.",
        };
    }

    if (!chartType) {
        return {
            isValid: false,
            message:
                "Select a chart type to continue.",
        };
    }

    if (!capabilities) {
        return {
            isValid: false,
            message:
                "The selected chart type is not supported.",
        };
    }
    const supportedChartTypes = getReportConfig(reportId)?.chartTypes;
    if (supportedChartTypes && !supportedChartTypes.includes(chartType)) {
        return {
            isValid: false,
            message: "The selected chart type is not enabled for this report.",
        };
    }

    if (!xAxisField) {
        return {
            isValid: false,
            message:
                "Select an X-axis field to continue.",
        };
    }

    if (!data.fields.includes(xAxisField)) {
        return {
            isValid: false,
            message:
                "The selected X-axis field is not available.",
        };
    }
    if (!isReportAxisFieldAllowed(reportId, "x", xAxisField)) {
        return {isValid: false, message: "The selected X-axis field is not enabled for this report."};
    }

    const selectedYAxisFields = yAxisFields.length > 0 ? yAxisFields : yAxisField ? [yAxisField] : [];

    if (selectedYAxisFields.length < capabilities.minYAxisFields) {
        return {
            isValid: false,
            message:
                "Select at least one valid Y-axis field.",
        };
    }

    if (selectedYAxisFields.length > capabilities.maxYAxisFields) {
        return {
            isValid: false,
            message:
                "Too many Y-axis fields are selected for this chart.",
        };
    }

    if (selectedYAxisFields.includes(xAxisField) && !capabilities.allowSameAxisField) {
        return {
            isValid: false,
            message:
                "The X-axis field cannot also be selected as a Y-axis field.",
        };
    }

    if (
        capabilities.multiYAxis &&
        selectedYAxisFields.some(
            (field) => isRevenueField(field) !== isRevenueField(selectedYAxisFields[0])
        )
    ) {
        return {
            isValid: false,
            message: "Multi-series charts cannot combine money values with non-money values.",
        };
    }

    const xAxisType = getXAxisFieldType(data, xAxisField, chartType);

    const xAxisValidation = validateAxisFieldType({
            field: xAxisField,
            fieldType: xAxisType,
            axisName: "X",
            allowedTypes:
                capabilities.allowedXAxisTypes,
        });

    if (!xAxisValidation.isValid) {
        return {
            isValid: false,
            message:
                `Cannot plot ${chartLabel} with ` +
                `"${xAxisField}" on the X-axis. ` +
                xAxisValidation.message,
        };
    }

    if (!isXAxisFieldAllowed(data, chartType, xAxisField)) {
        return {
            isValid: false,
            message:
                `Cannot plot ${chartLabel} with ` +
                `"${xAxisField}" on the X-axis. ` +
                "Choose a field with an allowed API datatype that is not a revenue field.",
        };
    }

    for (const field of selectedYAxisFields) {
        if (!isReportAxisFieldAllowed(reportId, "y", field)) {
            return {isValid: false, message: `The selected Y-axis field "${field}" is not enabled for this report.`};
        }
        const yAxisType = getYAxisFieldType(data, field);
        const yAxisValidation =
            validateAxisFieldType({
                field,
                fieldType: yAxisType,
                axisName: "Y",
                allowedTypes:
                    capabilities.allowedYAxisTypes,
            });

        if (!yAxisValidation.isValid) {
            return {
                isValid: false,
                message:
                    `Cannot plot ${chartLabel} with ` +
                    `"${xAxisField}" on the X-axis and ` +
                    `"${field}" on the Y-axis. ` +
                    yAxisValidation.message,
            };
        }
    }

    return {
        isValid: true,
        message: "",
    };
}

function isFilterTypeSupported(data, filterType, reportId = "") {
    if (filterType === "none") {
        return true;
    }
    const supportedFilters = getReportConfig(reportId)?.filters;
    if (supportedFilters && !supportedFilters.includes(filterType)) {
        return false;
    }

    if (!data || !Array.isArray(data.fields) || !data.columnTypes) {
        return false;
    }

    if (filterType === "category-wise") {
        return Boolean(
            getFilterField(
                data,
                "category-wise"
            )
        );
    }

    if (filterType === "status") {
        return Boolean(getFilterField(data, "status"));
    }

    return false;
}

function getFilterTypeOptions(data, reportId = "") {
    return filterTypes.map(
        (filter) => ({
            ...filter,
            disabled:
                !isFilterTypeSupported(data, filter.value, reportId)
        })
    );
}

function normalizeFilterOptionValue(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function getFilterValueOptions(data, filterType, reportId = "") {
    if (!isFilterTypeSupported(data, filterType, reportId)) {
        return [];
    }
    const filterField = getFilterField(data, filterType);

    if (!filterField || !Array.isArray(data?.rows)) {
        return [];
    }

    const values = new Map();

    for (const row of data.rows) {
        const rawValue = row[filterField];
        const optionValue = String(rawValue ?? "").trim();
        const normalizedValue =
            normalizeFilterOptionValue(optionValue);

        if (!normalizedValue || values.has(normalizedValue)) {
            continue;
        }

        values.set(normalizedValue, {
            value: optionValue,
            label: String(
                getTenderValueLabel(
                    filterField,
                    rawValue
                )
            ),
        });
    }

    return Array.from(values.values()).sort(
        (first, second) =>
            first.label.localeCompare(second.label)
    );
}

export {
    chartTypes,
    reportTypes,
    reportCards,
    COLUMN_TYPES,
    CHART_COLORS,
    CHART_CAPABILITIES,
    REPORT_CONFIG,
    REPORT_IDS,
    filterTypes,
    getReportConfig,
    getReportControls,
    getReportChartTitles,
    getDefaultPeriod,
    getApiReportType,
    getReportAxisData,
    isDepartmentAxisReport,
    getChartCapabilities,
    getChartAxisFieldOptions,
    isMultiYAxisChart,
    isChartTypeSupported,
    getChartTypeOptions,
    getSupportedChartType,
    getChartAxisOptions,
    getDefaultVisualizationSelection,
    getChartTypeSelection,
    getFilterTypeOptions,
    getFilterValueOptions,
    validateChartSelection,
};

export default chartTypes;