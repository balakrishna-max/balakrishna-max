import {
    COLUMN_TYPES,
    isNumericChartField,
    getPeriodDateFields,
    getFilterField,
    getTenderValueLabel,
    TENDER_STATUS_LABELS,
    TENDER_CATEGORY_LABELS,
} from "./dashboardData";

const STANDARD_X_AXIS_TYPES = [
    COLUMN_TYPES.NUMBER,
    COLUMN_TYPES.DATE,
    COLUMN_TYPES.TEXT,
];

const NUMBER_Y_AXIS_TYPES = [
    COLUMN_TYPES.NUMBER,
];

const STANDARD_CHART_CAPABILITY = {
    minYAxisFields: 1,
    maxYAxisFields: 1,
    allowedXAxisTypes: STANDARD_X_AXIS_TYPES,
    allowedYAxisTypes: NUMBER_Y_AXIS_TYPES,
};

const chartTypes = [
    {
        value: "area",
        label: "Area Chart",
    },
    {
        value: "bar",
        label: "Bar Chart",
    },
    {
        value: "composed",
        label: "Composed Chart",
    },
    {
        value: "donut",
        label: "Donut Chart",
    },
    {
        value: "horizontal-bar",
        label: "Horizontal Bar Chart",
    },
    {
        value: "line",
        label: "Line Chart",
    },
    {
        value: "pie",
        label: "Pie Chart",
    },
    {
        value: "radar",
        label: "Radar Chart",
    },
    {
        value: "radial",
        label: "Radial Chart",
    },
    {
        value: "scatter",
        label: "Scatter Plot",
    },
    {
        value: "stacked-area",
        label: "Stacked Area Chart",
    },
    {
        value: "stacked-bar",
        label: "Stacked Bar Chart",
    },
];

const CHART_CAPABILITIES = {
    line: {
        ...STANDARD_CHART_CAPABILITY,
    },

    bar: {
        ...STANDARD_CHART_CAPABILITY,
    },

    area: {
        ...STANDARD_CHART_CAPABILITY,
    },

    scatter: {
        ...STANDARD_CHART_CAPABILITY,
        allowedXAxisTypes: [
            COLUMN_TYPES.NUMBER,
        ],
    },

    composed: {
        ...STANDARD_CHART_CAPABILITY,
    },

    pie: {
        ...STANDARD_CHART_CAPABILITY,
    },

    donut: {
        ...STANDARD_CHART_CAPABILITY,
    },

    radar: {
        ...STANDARD_CHART_CAPABILITY,
        maxYAxisFields: Infinity,
    },

    radial: {
        ...STANDARD_CHART_CAPABILITY,
    },

    "stacked-bar": {
        ...STANDARD_CHART_CAPABILITY,
        maxYAxisFields: Infinity,
    },

    "stacked-area": {
        ...STANDARD_CHART_CAPABILITY,
        maxYAxisFields: Infinity,
    },

    "horizontal-bar": {
        ...STANDARD_CHART_CAPABILITY,
        allowedXAxisTypes: [
            COLUMN_TYPES.TEXT,
            COLUMN_TYPES.DATE,
        ],
    },
};

const REPORT_CONFIG = {
    "TD-ECV Summary": {
        id: "td-ecv-summary",
        label: "TD-ECV Summary",
    },
    "Tenders": {
        id: "tenders",
        label: "Tenders",
    },
    "Department wise Tenders": {
        id: "dw-tenders",
        label: "Department wise Tenders",
    },
    "Tender Analysis": {
        id: "tender-analysis",
        label: "Tender Analysis",
    },
    "Supplier Analysis": {
        id: "supplier-analysis",
        label: "Supplier Analysis",
    },
    "Bid Analysis": {
        id: "bid-analysis",
        label: "Bid Analysis",
    },
    "Payment": {
        id: "payment",
        label: "Payment",
    },
};

const filterTypes = [
    {
        value: "none",
        label: "None",
        hasOptions: false,
    },
    /*
    {
        value: "number-wise",
        label: "Number wise",
        hasOptions: false,
    },
    {
        value: "value-wise",
        label: "Value wise",
        hasOptions: false,
    },
    {
        value: "percentage-wise",
        label: "Percentage wise",
        hasOptions: false,
    },
    */
    {
        value: "category-wise",
        label: "Category wise",
        hasOptions: true,
    },
    {
        value: "status",
        label: "Status",
        hasOptions: true,
    },
];

const statusFilterOptions = [
    ...Object.entries(TENDER_STATUS_LABELS).map(
        ([value, label]) => ({
            value,
            label,
        })
    ),
    {
        value: "In Progress",
        label: "In Progress",
    },
    {
        value: "Awarded",
        label: "Awarded",
    },
    {
        value: "Rejected",
        label: "Rejected",
    },
    {
        value: "Cancelled",
        label: "Cancelled",
    },
];

const categoryFilterOptions = [
    ...Object.entries(TENDER_CATEGORY_LABELS).map(
        ([value, label]) => ({
            value,
            label,
        })
    ),
    {
        value: "goods",
        label: "Goods",
    },
    {
        value: "services",
        label: "Services",
    },
    {
        value: "works",
        label: "Works",
    },
    {
        value: "products",
        label: "Products",
    },
    {
        value: "transport",
        label: "Transport",
    },
];

const reportTypes = Object.values(REPORT_CONFIG).map(
    (report) => ({
        value: report.id,
        label: report.label,
    })
);

function getReportConfig(reportId) {
    return REPORT_CONFIG[reportId] || null;
}

function getChartCapabilities(chartType) {
    return CHART_CAPABILITIES[chartType] || null;
}

function isMultiYAxisChart(chartType) {
    return (
        chartType === "stacked-bar" ||
        chartType === "stacked-area"
    );
}

function getFieldType(columnTypes, field) {
    if (!columnTypes || !field) {
        return null;
    }

    return columnTypes[field] || null;
}

function getYAxisFieldType(
    data,
    field
) {
    if (
        !data ||
        !data.columnTypes ||
        !field
    ) {
        return null;
    }

    const fieldType =
        getFieldType(
            data.columnTypes,
            field
        );

    if (
        isNumericChartField(
            data,
            field
        )
    ) {
        return COLUMN_TYPES.NUMBER;
    }

    return fieldType;
}

function isChartTypeSupported(
    data,
    chartType
) {
    if (
        !data ||
        !Array.isArray(data.fields) ||
        !data.columnTypes
    ) {
        return false;
    }

    const capabilities =
        getChartCapabilities(
            chartType
        );

    if (!capabilities) {
        return false;
    }

    const xAxisCandidates =
        data.fields.filter(
            (field) =>
                capabilities.allowedXAxisTypes.includes(
                    getFieldType(
                        data.columnTypes,
                        field
                    )
                )
        );

    if (xAxisCandidates.length === 0) {
        return false;
    }

    return xAxisCandidates.some(
        (xAxisField) => {
            const yAxisCandidates =
                data.fields.filter(
                    (field) =>
                        field !== xAxisField &&
                        capabilities.allowedYAxisTypes.includes(
                            getYAxisFieldType(
                                data,
                                field
                            )
                        )
                );

            return (
                yAxisCandidates.length >=
                capabilities.minYAxisFields
            );
        }
    );
}

function getChartTypeOptions(data) {
    return chartTypes.map(
        (chartType) => ({
            ...chartType,
            disabled:
                !isChartTypeSupported(
                    data,
                    chartType.value
                ),
        })
    );
}

function getDefaultVisualizationSelection(
    data,
    chartType = "area"
) {
    if (
        !data ||
        !Array.isArray(data.fields) ||
        !data.columnTypes
    ) {
        return {
            chartType,
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const capabilities =
        getChartCapabilities(chartType);

    if (!capabilities) {
        return {
            chartType,
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const xAxisField =
        data.fields.find(
            (field) =>
                capabilities.allowedXAxisTypes.includes(
                    getFieldType(
                        data.columnTypes,
                        field
                    )
                )
        ) || "";

    const yAxisCandidates =
        data.fields.filter(
            (field) =>
                field !== xAxisField &&
                capabilities.allowedYAxisTypes.includes(
                    getYAxisFieldType(
                        data,
                        field
                    )
                )
        );

    const yAxisField =
        yAxisCandidates[0] || "";

    const isMultiYAxis =
        isMultiYAxisChart(chartType);

    return {
        chartType,
        xAxisField,
        yAxisField,
        yAxisFields: isMultiYAxis
            ? yAxisCandidates
            : [],
    };
}

function getChartTypeSelection({
    data,
    chartType,
    xAxisField,
    yAxisField,
    yAxisFields = [],
}) {
    if (
        !data ||
        !Array.isArray(data.fields) ||
        !data.columnTypes
    ) {
        return {
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const capabilities =
        getChartCapabilities(
            chartType
        );

    if (!capabilities) {
        return {
            xAxisField: "",
            yAxisField: "",
            yAxisFields: [],
        };
    }

    const isXAxisAllowed = (field) =>
        Boolean(field) &&
        capabilities.allowedXAxisTypes.includes(
            getFieldType(
                data.columnTypes,
                field
            )
        );

    const isYAxisAllowed = (field) =>
        Boolean(field) &&
        capabilities.allowedYAxisTypes.includes(
            getYAxisFieldType(
                data,
                field
            )
        );

    const currentYAxisFields =
        yAxisFields.length > 0
            ? yAxisFields
            : yAxisField
              ? [yAxisField]
              : [];

    const validCurrentYAxisFields =
        currentYAxisFields.filter(
            (field) =>
                data.fields.includes(field) &&
                isYAxisAllowed(field)
        );

    const canKeepCurrentXAxis =
        isXAxisAllowed(xAxisField) &&
        !validCurrentYAxisFields.includes(
            xAxisField
        );

    const defaultXAxisField =
        data.fields.find(
            (field) =>
                isXAxisAllowed(field) &&
                !validCurrentYAxisFields.includes(
                    field
                )
        ) || "";

    const nextXAxisField =
        canKeepCurrentXAxis
            ? xAxisField
            : defaultXAxisField;

    const validYAxisFields =
        validCurrentYAxisFields.filter(
            (field) =>
                field !== nextXAxisField
        );

    const defaultYAxisFields =
        data.fields.filter(
            (field) =>
                field !== nextXAxisField &&
                isYAxisAllowed(field)
        );

    const isMultiYAxis =
        isMultiYAxisChart(chartType);

    if (isMultiYAxis) {
        const nextYAxisFields =
            validYAxisFields.length > 0
                ? validYAxisFields
                : defaultYAxisFields.slice(
                      0,
                      1
                  );

        return {
            xAxisField:
                nextXAxisField,

            yAxisField:
                nextYAxisFields[0] ||
                "",

            yAxisFields:
                nextYAxisFields,
        };
    }

    const nextYAxisField =
        validYAxisFields[0] ||
        defaultYAxisFields[0] ||
        "";

    return {
        xAxisField:
            nextXAxisField,

        yAxisField:
            nextYAxisField,

        yAxisFields: [],
    };
}

function getChartLabel(chartType) {
    return (
        CHART_CAPABILITIES[chartType]
            ? chartTypes.find(
                  (chart) =>
                      chart.value ===
                      chartType
              )?.label
            : chartType
    ) || chartType;
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

function validateAxisFieldType({
    field,
    fieldType,
    axisName,
    allowedTypes,
}) {
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

function validateChartSelection({
    data,
    columnTypes,
    chartType,
    xAxisField,
    yAxisField,
    yAxisFields = [],
}) {
    const capabilities =
        getChartCapabilities(
            chartType
        );

    const chartLabel =
        getChartLabel(chartType);

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

    if (
        !data.fields.includes(
            xAxisField
        )
    ) {
        return {
            isValid: false,
            message:
                "The selected X-axis field is not available.",
        };
    }

    const selectedYAxisFields =
        yAxisFields.length > 0
            ? yAxisFields
            : yAxisField
              ? [yAxisField]
              : [];

    if (
        selectedYAxisFields.length <
        capabilities.minYAxisFields
    ) {
        return {
            isValid: false,
            message:
                "Select at least one valid Y-axis field.",
        };
    }

    if (
        selectedYAxisFields.length >
        capabilities.maxYAxisFields
    ) {
        return {
            isValid: false,
            message:
                "Too many Y-axis fields are selected for this chart.",
        };
    }

    if (
        selectedYAxisFields.includes(
            xAxisField
        )
    ) {
        return {
            isValid: false,
            message:
                "The X-axis field cannot also be selected as a Y-axis field.",
        };
    }

    const xAxisType =
        getFieldType(
            columnTypes,
            xAxisField
        );

    const xAxisValidation =
        validateAxisFieldType({
            field: xAxisField,
            fieldType: xAxisType,
            axisName: "X",
            allowedTypes:
                capabilities.allowedXAxisTypes,
        });

    if (
        !xAxisValidation.isValid
    ) {
        return {
            isValid: false,
            message:
                `Cannot plot ${chartLabel} with ` +
                `"${xAxisField}" on the X-axis. ` +
                xAxisValidation.message,
        };
    }

    for (
        const field of selectedYAxisFields
    ) {
        const yAxisType =
            getYAxisFieldType(
                data,
                field
            );

        const yAxisValidation =
            validateAxisFieldType({
                field,
                fieldType: yAxisType,
                axisName: "Y",
                allowedTypes:
                    capabilities.allowedYAxisTypes,
            });

        if (
            !yAxisValidation.isValid
        ) {
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

/*
 * Department aggregation capability checks are temporarily disabled.
 *
 * function getAggregationDepartmentField(
 *     data,
 *     departmentField = ""
 * ) {
 *     if (
 *         departmentField &&
 *         Array.isArray(data?.fields) &&
 *         data.fields.includes(
 *             departmentField
 *         )
 *     ) {
 *         return departmentField;
 *     }
 *
 *     return (
 *         data?.fields?.find(
 *             (field) =>
 *                 field === "sDepartment" ||
 *                 field === "sDepartmentName" ||
 *                 field.toLowerCase() ===
 *                     "department"
 *         ) || ""
 *     );
 * }
 *
 * function hasAggregationFields(
 *     data,
 *     filterType
 * ) {
 *     if (
 *         !data ||
 *         !Array.isArray(data.fields)
 *     ) {
 *         return false;
 *     }
 *
 *     const departmentField =
 *         getAggregationDepartmentField(
 *             data
 *         );
 *
 *     const hasTenderIdField =
 *         data.fields.includes(
 *             "nTenderID"
 *         );
 *
 *     if (
 *         !departmentField ||
 *         !hasTenderIdField
 *     ) {
 *         return false;
 *     }
 *
 *     if (
 *         filterType ===
 *             "number-wise"
 *     ) {
 *         return true;
 *     }
 *
 *     const hasEstimatedCostField =
 *         data.fields.includes(
 *             "mEstimatedCost"
 *         );
 *
 *     return (
 *         (
 *             filterType ===
 *                 "value-wise" ||
 *             filterType ===
 *                 "percentage-wise"
 *         ) &&
 *         hasEstimatedCostField
 *     );
 * }
 */

function isFilterTypeSupported(
    data,
    filterType
) {
    if (
        filterType === "none"
    ) {
        return true;
    }

    if (
        !data ||
        !Array.isArray(data.fields) ||
        !data.columnTypes
    ) {
        return false;
    }

    /*
     * Department aggregation filter types are temporarily disabled.
     *
     * if (
     *     filterType === "number-wise" ||
     *     filterType === "value-wise" ||
     *     filterType === "percentage-wise"
     * ) {
     *     return hasAggregationFields(
     *         data,
     *         filterType
     *     );
     * }
     */

    if (
        filterType ===
            "category-wise"
    ) {
        return Boolean(
            getFilterField(
                data,
                "category-wise"
            )
        );
    }

    if (
        filterType ===
            "status"
    ) {
        return Boolean(
            getFilterField(
                data,
                "status"
            )
        );
    }

    if (
        filterType ===
            "years"
    ) {
        return Boolean(
            getPeriodDateFields(
                data
            ).hasDateFields
        );
    }

    return false;
}

function getFilterTypeOptions(
    data
) {
    return filterTypes.map(
        (filter) => ({
            ...filter,
            disabled:
                !isFilterTypeSupported(
                    data,
                    filter.value
                ),
        })
    );
}

function normalizeFilterOptionValue(
    value
) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function getFilterValueOptions(
    data,
    filterType
) {
    const filterField =
        getFilterField(
            data,
            filterType
        );

    if (
        !filterField ||
        !Array.isArray(data?.rows)
    ) {
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
    statusFilterOptions,
    categoryFilterOptions,
    getReportConfig,
    getChartCapabilities,
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