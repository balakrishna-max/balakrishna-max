import {COLUMN_TYPES, isNumericChartField, isRevenueField, getFilterField, getTenderValueLabel} from "./dashboardData.js";

const STANDARD_X_AXIS_TYPES = [COLUMN_TYPES.TEXT];
const NUMBER_Y_AXIS_TYPES = [COLUMN_TYPES.NUMBER];
const STANDARD_CHART_CAPABILITY = {minYAxisFields: 1, maxYAxisFields: 1, allowedXAxisTypes: STANDARD_X_AXIS_TYPES, allowedYAxisTypes: NUMBER_Y_AXIS_TYPES,};

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

const REPORT_CONFIG = {
    "td-ecv-summary": {label: "TD-ECV Summary", departmentAxis: true, excludedAxisFields: ["nmappingdeptid"]},
    tenders: {label: "Tenders", departmentAxis: false, excludedAxisFields: []},
    "dw-tenders": {label: "Department Wise Tenders", departmentAxis: true, excludedAxisFields: []},
    "tender-analysis": {label: "Tender Analysis", departmentAxis: false, excludedAxisFields: []},
    "supplier-analysis": {label: "Supplier Analysis", departmentAxis: false, excludedAxisFields: []},
    "bid-analysis": {label: "Bid Analysis", departmentAxis: false, excludedAxisFields: []},
    payment: {label: "Payment", departmentAxis: false, excludedAxisFields: []},
};

const filterTypes = [
    {value: "none", label: "None", hasOptions: false},
    {value: "category-wise", label: "Category wise", hasOptions: true},
    {value: "status", label: "Status", hasOptions: true},
];

const reportTypes = Object.entries(REPORT_CONFIG).map(
    ([value, {label}]) => ({value, label})
);

function getReportConfig(reportId) {
    return REPORT_CONFIG[reportId];
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

function getChartAxisFieldOptions(data, chartType, axisName, excludedFields = [], referenceYAxisField = "") {
    if (!data || !Array.isArray(data.fields)) {
        return [];
    }

    const excludedFieldSet = new Set(
        Array.isArray(excludedFields) ? excludedFields : [excludedFields]
    );
    const isFieldAllowed = axisName === "x"
        ? (field) => isXAxisFieldAllowed(data, chartType, field)
        : (field) => isYAxisFieldAllowed(data, chartType, field);

    const referenceIsRevenue = referenceYAxisField
        ? isRevenueField(referenceYAxisField)
        : null;

    return data.fields.filter((field) => {
        if (excludedFieldSet.has(field) || !isFieldAllowed(field)) {
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

function isChartTypeSupported(data, chartType, fixedXAxisField = null) {
    if (!data || !Array.isArray(data.fields) || !data.columnTypes) {
        return false;
    }
    const capabilities = getChartCapabilities(chartType);
    if (!capabilities) {
        return false;
    }

    const usesFixedXAxisField = fixedXAxisField !== null && chartType !== "scatter";
    const xAxisCandidates = usesFixedXAxisField
        ? [fixedXAxisField].filter(
              (field) =>
                  data.fields.includes(field) &&
                  isXAxisFieldAllowed(data, chartType, field)
          )
        : getChartAxisFieldOptions(data, chartType, "x");

    if (xAxisCandidates.length === 0) {
        return false;
    }

    return xAxisCandidates.some(
        (xAxisField) => {
            const yAxisCandidates =
                data.fields.filter(
                    (field) =>
                        field !== xAxisField &&
                        isYAxisFieldAllowed(data, chartType, field)
                );

            return (yAxisCandidates.length >= capabilities.minYAxisFields);
        }
    );
}

function getChartTypeOptions(data, fixedXAxisField = null) {
    return chartTypes.map(
        (chartType) => ({
            ...chartType,
            disabled:
                !isChartTypeSupported(
                    data,
                    chartType.value,
                    fixedXAxisField
                ),
        })
    );
}

function getDefaultVisualizationSelection(data, chartType = "area", fixedXAxisField = null) {
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
            : getChartAxisFieldOptions(data, chartType, "x")[0] ?? "";

    if (!isXAxisFieldAllowed(data, chartType, xAxisField)) {
        return {
            chartType,
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    let yAxisCandidates = getChartAxisFieldOptions(data, chartType, "y", xAxisField);

    if (isMultiYAxisChart(chartType) && yAxisCandidates.length > 0) {
        yAxisCandidates = getChartAxisFieldOptions(
            data,
            chartType,
            "y",
            xAxisField,
            yAxisCandidates[0]
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

function getChartTypeSelection({data, chartType, xAxisField, yAxisField, yAxisFields = [], fixedXAxisField = null}) {
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
            isYAxisFieldAllowed(data, chartType, field)
    );
    if (isMultiYAxisChart(chartType) && validCurrentYAxisFields.length > 0) {
        const referenceYAxisField = validCurrentYAxisFields[0];
        validCurrentYAxisFields = validCurrentYAxisFields.filter(
            (field) => isRevenueField(field) === isRevenueField(referenceYAxisField)
        );
    }
    const nextXAxisField = fixedXAxisField !== null && chartType !== "scatter" ? fixedXAxisField : (
        isXAxisFieldAllowed(data, chartType, xAxisField) &&
        (capabilities.allowSameAxisField || !validCurrentYAxisFields.includes(xAxisField))
            ? xAxisField
            : getChartAxisFieldOptions(data, chartType, "x").find(
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
    let defaultYAxisFields = getChartAxisFieldOptions(data, chartType, "y", nextXAxisField);
    if (isMultiYAxis && defaultYAxisFields.length > 0) {
        defaultYAxisFields = getChartAxisFieldOptions(
            data,
            chartType,
            "y",
            nextXAxisField,
            defaultYAxisFields[0]
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

function validateChartSelection({data, chartType, xAxisField, yAxisField, yAxisFields = [],}) {
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

function isFilterTypeSupported(data, filterType) {
    if (filterType === "none") {
        return true;
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

function getFilterTypeOptions(data) {
    return filterTypes.map(
        (filter) => ({
            ...filter,
            disabled:
                !isFilterTypeSupported(data, filter.value)
        })
    );
}

function normalizeFilterOptionValue(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function getFilterValueOptions(data, filterType) {
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
    COLUMN_TYPES,
    CHART_CAPABILITIES,
    REPORT_CONFIG,
    filterTypes,
    getReportConfig,
    isDepartmentAxisReport,
    getChartCapabilities,
    getChartAxisFieldOptions,
    isMultiYAxisChart,
    isChartTypeSupported,
    getChartTypeOptions,
    getDefaultVisualizationSelection,
    getChartTypeSelection,
    getFilterTypeOptions,
    getFilterValueOptions,
    validateChartSelection,
};

export default chartTypes;