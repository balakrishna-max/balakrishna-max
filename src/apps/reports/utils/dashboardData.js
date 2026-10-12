const COLUMN_TYPES = { NUMBER: "number", DATE: "date", TEXT: "text" };

const API_DATA_TYPE_MAP = { STRING: COLUMN_TYPES.TEXT, INTEGER: COLUMN_TYPES.NUMBER, LONG: COLUMN_TYPES.NUMBER, DECIMAL: COLUMN_TYPES.NUMBER,
    BOOLEAN: COLUMN_TYPES.TEXT, DATE: COLUMN_TYPES.DATE, DATETIME: COLUMN_TYPES.DATE };

function isEmptyValue(value) {
    return (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    );
}

function isNumericValue(value) {
    if (isEmptyValue(value)) {
        return false;
    }

    const normalizedValue = String(value)
        .trim()
        .replace(/,/g, "");

    return (
        normalizedValue !== "" &&
        !Number.isNaN(Number(normalizedValue))
    );
}

function isDateValue(value) {
    if (isEmptyValue(value)) {
        return false;
    }

    const parsedDate = new Date(value);

    return !Number.isNaN(parsedDate.getTime());
}

function detectColumnType(values) {
    const nonEmptyValues = values.filter(
        (value) => !isEmptyValue(value)
    );

    if (nonEmptyValues.length === 0) {
        return COLUMN_TYPES.TEXT;
    }

    const allNumeric = nonEmptyValues.every(
        (value) => isNumericValue(value)
    );

    if (allNumeric) {
        return COLUMN_TYPES.NUMBER;
    }

    const allDates = nonEmptyValues.every(
        (value) => isDateValue(value)
    );

    if (allDates) {
        return COLUMN_TYPES.DATE;
    }

    return COLUMN_TYPES.TEXT;
}

function detectColumnTypes(fields, rows) {
    return fields.reduce(
        (types, field) => {
            const values = rows.map(
                (row) => row[field]
            );

            types[field] = detectColumnType(values);

            return types;
        },
        {}
    );
}

function detectCsvDataTypes(fields, rows, columnTypes) {
    return fields.reduce(
        (types, field) => {
            const columnType = columnTypes[field];

            if (columnType === COLUMN_TYPES.NUMBER) {
                const values = rows
                    .map((row) => row[field])
                    .filter((value) => !isEmptyValue(value));

                const hasDecimalValue = values.some((value) => {
                    const normalizedValue = String(value)
                        .trim()
                        .replace(/,/g, "");

                    return normalizedValue.includes(".");
                });

                types[field] = hasDecimalValue
                    ? "DECIMAL"
                    : "INTEGER";

                return types;
            }

            if (columnType === COLUMN_TYPES.DATE) {
                types[field] = "DATE";
                return types;
            }

            types[field] = "STRING";
            return types;
        },
        {}
    );
}

function getFallbackDataType(columnType) {
    if (columnType === COLUMN_TYPES.NUMBER) {
        return "NUMBER";
    }

    if (columnType === COLUMN_TYPES.DATE) {
        return "DATE";
    }

    return "STRING";
}

function normalizeFieldName(fieldName) {
    return String(fieldName)
        .toLowerCase()
        .replace(/[\s_-]/g, "");
}

function isPhoneColumn(fieldName) {
    const normalizedFieldName =
        normalizeFieldName(fieldName);

    return (
        normalizedFieldName.includes("phone") ||
        normalizedFieldName.includes("mobile") ||
        normalizedFieldName.includes("contactnumber")
    );
}

const MONEY_FIELD_KEYWORDS = [ "revenue", "turnover", "income", "sales", "profit", "amount", "totalamount", "netamount", "grossamount", "price", "cost", "value",
    "payment", "paid", "invoice", "budget", "expenditure", "expense", "spend", "fee", "charge", "fare", "transactionvalue", "transactionamount", "contractvalue",
    "contractamount", "tendervalues", "tenderamount", "bidvalue", "bidamount", "estimatedcost", "estimatedvalue", "awardvalue", "awardamount", "awardedvalue", "awardedamount", 
     "businessvalue", "ordervalue", "orderamount", "ecv", "inr", "rupee", "rate", "turnovervalues" ];

const NON_MONEY_FIELD_KEYWORDS = [ "count", "quantity", "qty", "percentage", "percent", "ratio", "rate", "days", "duration", "year", "month", "id", "identifier", 
     "number", "code", "sequence", "serial" ];

const NON_NUMERIC_FIELD_KEYWORDS = [ "phone", "mobile", "contact", "contactnumber", "id", "identifier", "number", "no", "code", "sequence", "serial", "zipcode", 
    "pincode", "postalcode", "year", "month", "day" ];

const FILTER_FIELD_KEYWORDS = {
    "category-wise": [ "ncategory", "category", "categoryname", "subcategory", "nature", "commodity", "service", "services", "product",
        "products", "work", "works", "type" ],

    "status": [ "status", "state", "stage", "currentstatus", "tenderstatus", "bidstatus", "supplierstatus", "paymentstatus", "invoicestatus", "approvalstatus" ],
};

const FILTER_FIELD_NAMES = {
    "category-wise": ["category", "categoryname", "tendercategory", "ntendercategory"],
    status: ["status", "nstatus", "tenderstatus", "ntenderstatus"],
};

const TENDER_STATUS_LABELS = {
    101: "Under creation",
    102: "Under creation",
    103: "Sent for Publishing",
    104: "Deleted",
    105: "Published",
    106: "Recalled",
    107: "Rejected",
    108: "Cancelled",
    109: "TBS",
    110: "Closed",
    111: "LOA Issue",
    112: "LOA Pending",
    113: "LOA Approval",
    114: "LOA Waiting Approval",
};

const TENDER_CATEGORY_LABELS = {
    101: "Works",
    102: "Products",
    103: "Custom",
    104: "Services",
    105: "Swiss Challenge PPP",
    106: "Catalog Request",
};

function getTenderValueLabel(fieldName, value) {
    const normalizedFieldName =
        normalizeFieldName(fieldName);
    let labels = null;

    if (
        normalizedFieldName === "category" ||
        normalizedFieldName === "categoryname" ||
        normalizedFieldName.includes("tendercategory")
    ) {
        labels = TENDER_CATEGORY_LABELS;
    } else if (
        normalizedFieldName === "status" ||
        normalizedFieldName === "nstatus" ||
        normalizedFieldName.includes("tenderstatus")
    ) {
        labels = TENDER_STATUS_LABELS;
    }

    if (!labels || isEmptyValue(value)) {
        return value;
    }

    const code = Number(String(value).trim());

    return Number.isInteger(code) && labels[code] !== undefined
        ? labels[code]
        : value;
}

function isNumericLikeField(
    data,
    fieldName
) {
    if (
        !data ||
        !Array.isArray(data.rows) ||
        !data.columnTypes ||
        !fieldName
    ) {
        return false;
    }

    const columnType =
        data.columnTypes[fieldName];

    if (
        columnType === COLUMN_TYPES.NUMBER
    ) {
        return true;
    }

    if (
        columnType !== COLUMN_TYPES.TEXT
    ) {
        return false;
    }

    const normalizedFieldName =
        normalizeFieldName(fieldName);

    const hasExcludedKeyword =
        NON_NUMERIC_FIELD_KEYWORDS.some(
            (keyword) =>
                normalizedFieldName.includes(
                    keyword
                )
        );

    if (hasExcludedKeyword) {
        return false;
    }

    const values = data.rows
        .map((row) => row[fieldName])
        .filter(
            (value) =>
                !isEmptyValue(value)
        );

    if (values.length === 0) {
        return false;
    }

    return values.every(
        (value) =>
            isNumericValue(value)
    );
}

function getNumericLikeFields(
    data
) {
    if (
        !data ||
        !Array.isArray(data.fields)
    ) {
        return [];
    }

    return data.fields.filter(
        (field) =>
            isNumericLikeField(
                data,
                field
            )
    );
}

function isRevenueField(
    fieldName
) {
    if (isEmptyValue(fieldName)) {
        return false;
    }

    const normalizedFieldName =
        normalizeFieldName(fieldName);

    const hasMoneyKeyword =
        MONEY_FIELD_KEYWORDS.some(
            (keyword) =>
                normalizedFieldName.includes(
                    keyword
                )
        );

    if (!hasMoneyKeyword) {
        return false;
    }

    const hasNonMoneyKeyword =
        NON_MONEY_FIELD_KEYWORDS.some(
            (keyword) =>
                normalizedFieldName.includes(
                    keyword
                )
        );

    return !hasNonMoneyKeyword;
}

function getRevenueFields(
    data
) {
    if (
        !data ||
        !Array.isArray(data.fields)
    ) {
        return [];
    }

    return data.fields.filter(
        (field) =>
            isRevenueField(field)
    );
}

function isNumericChartField(
    data,
    fieldName
) {
    return (
        isRevenueField(fieldName) ||
        isNumericLikeField(
            data,
            fieldName
        )
    );
}

const REVENUE_UNIT_THRESHOLDS = [ { minimum: 10000000, divisor: 10000000, suffix: "Cr"},
    { minimum: 100000,divisor: 100000,suffix: "Lakh"},
    { minimum: 1000, divisor: 1000, suffix: "Thousand" },
    { minimum: 0, divisor: 1, suffix: ""} ];

function getRevenueDisplayUnit(
    maxValue
) {
    for (
        const threshold of REVENUE_UNIT_THRESHOLDS
    ) {
        if (
            maxValue >=
            threshold.minimum
        ) {
            return threshold;
        }
    }

    return REVENUE_UNIT_THRESHOLDS[
        REVENUE_UNIT_THRESHOLDS.length - 1
    ];
}

function getMaximumRevenueValue(
    rows,
    fieldName
) {
    if (
        !Array.isArray(rows) ||
        !fieldName
    ) {
        return null;
    }

    let maximumValue = null;

    for (const row of rows) {
        const numericValue =
            parseRevenueValue(
                row[fieldName]
            );

        if (numericValue === null) {
            continue;
        }

        if ( maximumValue === null || numericValue > maximumValue ) {
            maximumValue = numericValue;
        }
    }

    return maximumValue;
}

function getRevenueDisplayConfig(
    data
) {
    const revenueFields =
        getRevenueFields(data);

    return revenueFields.reduce(
        (config, fieldName) => {
            const maximumValue =
                getMaximumRevenueValue(
                    data.rows,
                    fieldName
                );

            if (
                maximumValue === null
            ) {
                return config;
            }

            const unit =
                getRevenueDisplayUnit(
                    maximumValue
                );

            config[fieldName] = {
                maximumValue,
                divisor: unit.divisor,
                suffix: unit.suffix,
            };

            return config;
        },
        {}
    );
}

function formatRevenueValue(
    value,
    displayConfig,
    {
        includeUnit = true,
    } = {}
) {
    const numericValue =
        parseRevenueValue(value);

    if (
        numericValue === null ||
        !displayConfig
    ) {
        return "";
    }

    const scaledValue =
        numericValue /
        displayConfig.divisor;

    const formattedValue =
        new Intl.NumberFormat(
            "en-IN",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }
        ).format(
            scaledValue
        );

    if (!includeUnit || !displayConfig.suffix) {
        return `₹${formattedValue}`;
    }

    return `₹${formattedValue} ${displayConfig.suffix}`;
}

function parseNumericValue(value) {
    if (isEmptyValue(value)) {
        return null;
    }

    const normalizedValue = String(value)
        .trim()
        .replace(/,/g, "");

    const parsedValue = Number(normalizedValue);

    return Number.isNaN(parsedValue)
        ? null
        : parsedValue;
}

function parseRevenueValue(value) {
    return parseNumericValue(value);
}

function transformDataValue(value, columnType) {
    if (isEmptyValue(value)) {
        return null;
    }

    if (columnType === COLUMN_TYPES.NUMBER) {
        return parseNumericValue(value);
    }

    if (columnType === COLUMN_TYPES.DATE) {
        return value;
    }

    return value;
}

function normalizeComparableValue(value) {
    if (isEmptyValue(value)) {
        return "";
    }

    return String(value)
        .trim()
        .toLowerCase();
}

function getFilterField(
    data,
    filterType
) {
    if (
        !data ||
        !Array.isArray(data.fields) ||
        !Array.isArray(data.rows) ||
        !data.columnTypes
    ) {
        return "";
    }

    const keywords =
        FILTER_FIELD_KEYWORDS[
            filterType
        ];

    if (
        !Array.isArray(keywords) ||
        keywords.length === 0
    ) {
        return "";
    }

    const supportedFieldNames = FILTER_FIELD_NAMES[filterType];

    const candidates = data.fields.filter((field) => {
                const normalizedFieldName = normalizeFieldName(field);

                return supportedFieldNames.some(
                    (name) => normalizedFieldName === name || normalizedFieldName.includes(
                            `tender${filterType === "status" ? "status" : "category"}`
                        )
                );
            })
            .map((field) => {
                const normalizedFieldName =
                    normalizeFieldName(
                        field
                    );

                const fieldType =
                    data.columnTypes[
                        field
                    ];

                let score = 0;

                for (const keyword of keywords) {
                    if (
                        normalizedFieldName.includes(
                            keyword
                        )
                    ) {
                        score +=
                            keyword.length >= 8
                                ? 40
                                : 25;
                    }
                }

                if (
                    filterType === "category-wise" &&
                    ["ntendercategory", "tendercategory", "category"].includes(
                        normalizedFieldName
                    )
                ) {
                    score += 100;
                }

                if (
                    filterType === "status" &&
                    ["ntenderstatus", "tenderstatus", "nstatus", "status"].includes(
                        normalizedFieldName
                    )
                ) {
                    score += 100;
                }

                if (fieldType === COLUMN_TYPES.TEXT) {
                    score += 15;
                }

                if (isNumericLikeField(data, field)) {
                    score -= 30;
                }

                if (
                    isPhoneColumn(field)
                ) {
                    score -= 100;
                }

                if ( normalizedFieldName.includes("id") || normalizedFieldName.includes("code") || normalizedFieldName.includes("number") ) {
                    score -= 50;
                }

                return {
                    field,
                    score,
                };
            })
            .filter(
                (candidate) =>
                    candidate.score > 0
            )
            .sort(
                (first, second) =>
                    second.score -
                    first.score
            );

    return (
        candidates[0]?.field || ""
    );
}

function parseMonthYear(value) {
    if (
        !/^(0[1-9]|1[0-2])\/\d{4}$/.test(
            value
        )
    ) {
        return null;
    }

    const [month, year] =
        value.split("/").map(Number);

    return (
        year * 12 +
        (month - 1)
    );
}

function parseYearRange(value) {
    if (
        !/^\d{4}-\d{4}$/.test(
            String(value).trim()
        )
    ) {
        return null;
    }

    const [fromYear, toYear] =
        String(value)
            .trim()
            .split("-")
            .map(Number);

    if (toYear < fromYear) {
        return null;
    }

    return {
        fromYear,
        toYear,
    };
}

function getRowMonthIndex(value) {
    if (isEmptyValue(value)) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return (
        date.getFullYear() * 12 +
        date.getMonth()
    );
}

const PERIOD_START_KEYWORDS = {
    opening: 100,
    open: 90,
    start: 95,
    started: 95,
    begin: 85,
    beginning: 85,
    created: 90,
    create: 85,
    creation: 85,
    initiated: 75,
    initiation: 70,
    commence: 70,
    commenced: 70,
    commencement: 70,
    effective: 65,
    issue: 60,
    issued: 65,
    publish: 55,
    published: 60,
    from: 50,
};

const PERIOD_END_KEYWORDS = new Set([
    "closing",
    "close",
    "closed",
    "end",
    "ended",
    "ending",
    "terminate",
    "terminated",
    "termination",
    "submission",
    "submitted",
    "expiry",
    "expired",
    "deadline",
    "due",
    "complete",
    "completed",
    "completion",
    "finish",
    "finished",
]);

const PERIOD_START_PENALTIES = {
    update: 60,
    updated: 65,
    modify: 55,
    modified: 60,
    last: 40,
    delete: 65,
    deleted: 70,
    deletion: 65,
    payment: 55,
    paid: 55,
    invoice: 55,
    invoiced: 55,
    approval: 35,
    approved: 40,
    closing: 70,
    close: 60,
    closed: 65,
    end: 60,
    ended: 60,
    ending: 60,
    terminate: 60,
    terminated: 65,
    termination: 60,
    submission: 30,
    submitted: 35,
    expiry: 45,
    expired: 50,
    deadline: 40,
    complete: 45,
    completed: 50,
    completion: 45,
    finish: 40,
    finished: 45,
};

const PERIOD_TECHNICAL_TOKENS = new Set([
    "date",
    "datetime",
    "timestamp",
    "time",
    "dt",
]);

const PERIOD_START_TOKENS = new Set(
    Object.keys(
        PERIOD_START_KEYWORDS
    )
);

function tokenizeDateFieldName(
    fieldName
) {
    return String(fieldName)
        .trim()
        .replace(
            /([a-z0-9])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[^a-zA-Z0-9]+/g,
            " "
        )
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

function getDateFieldQuality(
    data,
    fieldName
) {
    if (
        !data ||
        !Array.isArray(data.rows) ||
        data.rows.length === 0
    ) {
        return {
            populatedRatio: 0,
            validDateRatio: 0,
        };
    }

    let populatedCount = 0;
    let validDateCount = 0;

    for (const row of data.rows) {
        const value =
            row[fieldName];

        if (isEmptyValue(value)) {
            continue;
        }

        populatedCount += 1;

        if (isDateValue(value)) {
            validDateCount += 1;
        }
    }

    if (populatedCount === 0) {
        return {
            populatedRatio: 0,
            validDateRatio: 0,
        };
    }

    return {
        populatedRatio:
            populatedCount /
            data.rows.length,

        validDateRatio:
            validDateCount /
            populatedCount,
    };
}

function getContextTokens(
    tokens
) {
    return tokens.filter(
        (token) =>
            !PERIOD_TECHNICAL_TOKENS.has(
                token
            ) &&
            !PERIOD_START_TOKENS.has(
                token
            ) &&
            !PERIOD_END_KEYWORDS.has(
                token
            ) &&
            token !== "id" &&
            token !== "no" &&
            token !== "number" &&
            token !== "code"
    );
}

function getSharedContextScore(
    firstTokens,
    secondTokens
) {
    const firstContext =
        getContextTokens(
            firstTokens
        );

    const secondContext =
        getContextTokens(
            secondTokens
        );

    if (
        firstContext.length === 0 ||
        secondContext.length === 0
    ) {
        return 0;
    }

    const sharedTokens =
        firstContext.filter(
            (token) =>
                secondContext.includes(
                    token
                )
        );

    return (
        sharedTokens.length * 30
    );
}

function getPeriodStartScore(
    fieldName
) {
    const tokens =
        tokenizeDateFieldName(
            fieldName
        );

    let score = 0;

    if (tokens[0] === "dt") {
        score += 100;
    }

    if (tokens.includes("dt")) {
        score += 20;
    }

    if (tokens.includes("date") || tokens.includes("datetime")) {
        score += 15;
    }

    for (const token of tokens) {
        score += PERIOD_START_KEYWORDS[token] || 0;

        score -= PERIOD_START_PENALTIES[token] || 0;
    }

    return { fieldName, tokens, score };
}

function getRelatedEndDateScore(candidate, dateFields) {
    const candidateContext = getContextTokens(candidate.tokens);

    let bestRelatedScore = 0;

    for (const field of dateFields) {
        if (field === candidate.fieldName) {
            continue;
        }

        const relatedTokens =
            tokenizeDateFieldName(
                field
            );

        const hasEndMeaning =
            relatedTokens.some(
                (token) =>
                    PERIOD_END_KEYWORDS.has(
                        token
                    )
            );

        if (!hasEndMeaning) {
            continue;
        }

        const sharedContextScore =
            getSharedContextScore(
                candidate.tokens,
                relatedTokens
            );

        if (
            candidateContext.length > 0 &&
            sharedContextScore >
                bestRelatedScore
        ) {
            bestRelatedScore =
                sharedContextScore;
        }
    }

    return bestRelatedScore;
}

function getPeriodDateFields(
    data
) {
    const emptyResult = {
        hasDateFields: false,
        periodDateField: "",
    };

    if (
        !data ||
        !Array.isArray(
            data.fields
        ) ||
        !data.columnTypes
    ) {
        return emptyResult;
    }

    const dateFields =
        data.fields.filter(
            (field) =>
                data.columnTypes[
                    field
                ] === COLUMN_TYPES.DATE
        );

    if (
        dateFields.length === 0
    ) {
        return emptyResult;
    }

    const candidates =
        dateFields
            .map((field) => {
                const namingScore =
                    getPeriodStartScore(
                        field
                    );

                const quality =
                    getDateFieldQuality(
                        data,
                        field
                    );

                const relatedEndScore =
                    getRelatedEndDateScore(
                        namingScore,
                        dateFields
                    );

                const qualityScore =
                    quality.validDateRatio *
                        35 +
                    quality.populatedRatio *
                        15;

                return {
                    ...namingScore,
                    quality,
                    relatedEndScore,
                    totalScore:
                        namingScore.score +
                        relatedEndScore +
                        qualityScore,
                };
            })
            .sort(
                (first, second) =>
                    second.totalScore -
                    first.totalScore
            );

    const bestCandidate = candidates[0];

    if (
        !bestCandidate ||
        bestCandidate.quality.validDateRatio <= 0
    ) {
        return emptyResult;
    }

    return {
        hasDateFields: true,
        periodDateField: bestCandidate.fieldName,
    };
}

function transformChartData({rows, xAxisField, yAxisField, yAxisFields = [], columnTypes, dataTypes = {}, fieldLabels = {}}) {
    if (!Array.isArray(rows) || !xAxisField || !columnTypes) {
        return {data: [], xAxis: null, yAxis: null, yAxes: [] };
    }

    const selectedYAxisFields =
        yAxisFields.length > 0
            ? yAxisFields
            : yAxisField
              ? [yAxisField]
              : [];

    if (selectedYAxisFields.length === 0) {
        return {
            data: [],
            xAxis: null,
            yAxis: null,
            yAxes: [],
        };
    }

    const xAxisType =
        columnTypes[xAxisField];

    const isMultiYAxisChart =
        yAxisFields.length > 0;

    const data = rows
        .map((row) => {
            const rawXValue =
                transformDataValue(
                    row[xAxisField],
                    xAxisType
                );
            const xValue =
                getTenderValueLabel(
                    xAxisField,
                    rawXValue
                );

            if (
                xValue === null ||
                xValue === undefined
            ) {
                return null;
            }

            if (!isMultiYAxisChart) {
                const yAxisIsRevenue =
                    isRevenueField(
                        yAxisField
                    );

                const yAxisType =
                    isNumericChartField(
                        {
                            rows,
                            columnTypes,
                        },
                        yAxisField
                    )
                        ? COLUMN_TYPES.NUMBER
                        : columnTypes[yAxisField];

                const yValue =
                    yAxisIsRevenue
                        ? parseRevenueValue(
                            row[yAxisField]
                        )
                        : transformDataValue(
                            row[yAxisField],
                            yAxisType
                        );

                return {
                    x: xValue,
                    y: yValue,
                };
            }

            const transformedRow = {
                x: xValue,
            };

            for (
                const field of selectedYAxisFields
            ) {
                const yAxisIsRevenue =
                    isRevenueField(field);

                const yAxisType =
                    isNumericChartField(
                        {
                            rows,
                            columnTypes,
                        },
                        field
                    )
                        ? COLUMN_TYPES.NUMBER
                        : columnTypes[field];

                const yValue =
                    yAxisIsRevenue
                        ? parseRevenueValue(
                            row[field]
                        )
                        : transformDataValue(
                            row[field],
                            yAxisType
                        );

                transformedRow[field] =
                    yValue;
            }

            return transformedRow;
        })
        .filter(Boolean);

    const revenueDisplayConfig =
        getRevenueDisplayConfig({
            fields: selectedYAxisFields,
            rows,
            columnTypes,
        });

    const yAxes =
        selectedYAxisFields.map(
            (field) => {
                const revenueField =
                    isRevenueField(field);

                const yAxisType =
                    revenueField
                        ? COLUMN_TYPES.NUMBER
                        : columnTypes[field];

                return {
                    field,
                    label: fieldLabels[field] || field,
                    type: yAxisType,
                    dataType:
                        revenueField
                            ? "DECIMAL"
                            : dataTypes[field] ||
                              getFallbackDataType(
                                  yAxisType
                              ),
                    revenueDisplayConfig:
                        revenueDisplayConfig[field] ||
                        null,
                };
            }
        );

    return {
        data,

        xAxis: {
            field: xAxisField,
            label: fieldLabels[xAxisField] || xAxisField,
            type: xAxisType,
            dataType:
                dataTypes[xAxisField] ||
                getFallbackDataType(xAxisType),
        },

        yAxis: yAxes[0] ?? null,

        yAxes,
    };
}

function filterNormalizedData(data,
    {
        /*
         * Department filtering temporarily disabled.
         * departmentField = "",
         * department = "all",
         */
        fromDateField = "",
        toDateField = "",
        fromDate = "",
        toDate = "",
        filterType = "none",
        filterField = "",
        filterValue = "",
    } = {}
) {
    if (!data || !Array.isArray(data.rows)) {
        return data;
    }

    let filteredRows =
        data.rows;

    /*
     * Department filtering temporarily disabled.
     *
     * if (departmentField && department && department !== "all") {
     *     const normalizedDepartment =
     *         normalizeComparableValue(department);
     *
     *     filteredRows = filteredRows.filter((row) =>
     *         normalizeComparableValue(
     *             row[departmentField]
     *         ) === normalizedDepartment
     *     );
     * }
     */

    if (fromDateField && fromDate && toDate) {
        const fromMonthIndex = parseMonthYear(fromDate);

        const toMonthIndex = parseMonthYear(toDate);

        filteredRows = filteredRows.filter( (row) => {
                    const rowFromMonthIndex =
                        getRowMonthIndex(
                            row[fromDateField]
                        );

                    if (rowFromMonthIndex === null || fromMonthIndex === null || toMonthIndex === null ) {
                        return false;
                    }

                    return (rowFromMonthIndex >= fromMonthIndex && rowFromMonthIndex <= toMonthIndex);
                }
            );
    }

    if (
        filterType === "years" &&
        fromDateField &&
        !isEmptyValue(filterValue)
    ) {
        const yearRange =
            parseYearRange(filterValue);

        if (yearRange) {
            filteredRows =
                filteredRows.filter(
                    (row) => {
                        const rowMonthIndex =
                            getRowMonthIndex(
                                row[fromDateField]
                            );

                        if (
                            rowMonthIndex === null
                        ) {
                            return false;
                        }

                        const rowYear =
                            Math.floor(
                                rowMonthIndex / 12
                            );

                        return (
                            rowYear >=
                                yearRange.fromYear &&
                            rowYear <=
                                yearRange.toYear
                        );
                    }
                );
        }
    }

    const effectiveFilterField =
    filterField ||
    getFilterField(
        data,
        filterType
    );

    if (effectiveFilterField && !isEmptyValue(filterValue) && (filterType === "category-wise" || filterType === "status" || filterField)
    ) {
        const normalizedFilterValue = normalizeComparableValue(filterValue);

        filteredRows =
            filteredRows.filter(
                (row) =>
                    normalizeComparableValue(
                        row[
                            effectiveFilterField
                        ]
                    ) ===
                    normalizedFilterValue
            );
    }

    const filteredData = {
        ...data,
        rows: filteredRows,
    };

    return filteredData;
}

/*
 * Department aggregation temporarily disabled.
 *
const AGGREGATION_FILTER_TYPES = new Set(["number-wise", "value-wise", "percentage-wise"]);

const AGGREGATION_FIELD_NAMES = {
    department: "Department",
    bidCount: "No. of Bids",
    estimatedValue: "Estimated Value",
    bidPercentage: "Bid Count Percentage",
    estimatedValuePercentage:
        "Estimated Value Percentage",
};

function getAggregationDepartmentField(
    data,
    departmentField = ""
) {
    if (departmentField && Array.isArray(data?.fields) && data.fields.includes(departmentField)) {
        return departmentField;
    }

    return (
        data?.fields?.find(
            (field) =>
                field === "sDepartment" ||
                field === "sDepartmentName" ||
                field.toLowerCase() ===
                    "department"
        ) || ""
    );
}

function aggregateByDepartment(
    data,
    {
        departmentField = "",
        filterType = "none",
    } = {}
) {
    if (
        !data ||
        !AGGREGATION_FILTER_TYPES.has(
            filterType
        )
    ) {
        return data;
    }

    const resolvedDepartmentField =
        getAggregationDepartmentField(
            data,
            departmentField
        );

    const hasTenderIdField =
        data.fields.includes("nTenderID");

    const hasEstimatedCostField =
        data.fields.includes(
            "mEstimatedCost"
        );

    if (!resolvedDepartmentField || !hasTenderIdField) {
        console.error(`Cannot apply "${filterType}" because the tender dataset does not contain the required department or nTenderID field.`);
        return data;
    }

    if ((filterType === "value-wise" || filterType === "percentage-wise") && !hasEstimatedCostField) {
        console.error(`Cannot apply "${filterType}" because the dataset does not contain mEstimatedCost.`);
        return data;
    }

    const departmentGroups =
        new Map();

    for (const row of data.rows) {
        const departmentValue =
            row[resolvedDepartmentField];

        if (isEmptyValue(departmentValue)) {
            continue;
        }

        const normalizedDepartment =
            normalizeComparableValue(
                departmentValue
            );

        if (!departmentGroups.has(normalizedDepartment)) {
            departmentGroups.set(
                normalizedDepartment,
                {
                    department:
                        String(
                            departmentValue
                        ).trim(),
                    tenderIds:
                        new Set(),
                    estimatedValue: 0,
                }
            );
        }

        const group =
            departmentGroups.get(
                normalizedDepartment
            );

        const tenderId =
            normalizeComparableValue(
                row.nTenderID
            );

        if (tenderId) {
            group.tenderIds.add(
                tenderId
            );
        }

        if (
            hasEstimatedCostField
        ) {
            const estimatedValue =
                parseNumericValue(
                    row.mEstimatedCost
                );

            if (
                estimatedValue !== null
            ) {
                group.estimatedValue +=
                    estimatedValue;
            }
        }
    }

    const groupedRows =
        Array.from(
            departmentGroups.values()
        );

    const totalBidCount =
        groupedRows.reduce(
            (total, group) =>
                total +
                group.tenderIds.size,
            0
        );

    const totalEstimatedValue =
        groupedRows.reduce(
            (total, group) =>
                total +
                group.estimatedValue,
            0
        );

    if (
        filterType === "number-wise"
    ) {
        return {
            fields: [
                AGGREGATION_FIELD_NAMES.department,
                AGGREGATION_FIELD_NAMES.bidCount,
            ],

            rows: groupedRows.map(
                (group) => ({
                    [AGGREGATION_FIELD_NAMES.department]:
                        group.department,

                    [AGGREGATION_FIELD_NAMES.bidCount]:
                        group.tenderIds.size,
                })
            ),

            columnTypes: {
                [AGGREGATION_FIELD_NAMES.department]:
                    COLUMN_TYPES.TEXT,

                [AGGREGATION_FIELD_NAMES.bidCount]:
                    COLUMN_TYPES.NUMBER,
            },

            dataTypes: {
                [AGGREGATION_FIELD_NAMES.department]:
                    "STRING",

                [AGGREGATION_FIELD_NAMES.bidCount]:
                    "INTEGER",
            },
        };
    }

    if (
        filterType === "value-wise"
    ) {
        return {
            fields: [
                AGGREGATION_FIELD_NAMES.department,
                AGGREGATION_FIELD_NAMES.estimatedValue,
            ],

            rows: groupedRows.map(
                (group) => ({
                    [AGGREGATION_FIELD_NAMES.department]:
                        group.department,

                    [AGGREGATION_FIELD_NAMES.estimatedValue]:
                        group.estimatedValue,
                })
            ),

            columnTypes: {
                [AGGREGATION_FIELD_NAMES.department]: COLUMN_TYPES.TEXT,
                [AGGREGATION_FIELD_NAMES.estimatedValue]: COLUMN_TYPES.NUMBER,
            },

            dataTypes: {
                [AGGREGATION_FIELD_NAMES.department]: "STRING",
                [AGGREGATION_FIELD_NAMES.estimatedValue]: "DECIMAL" },
        };
    }

    return {
        fields: [
            AGGREGATION_FIELD_NAMES.department,
            AGGREGATION_FIELD_NAMES.bidPercentage,
            AGGREGATION_FIELD_NAMES.estimatedValuePercentage,
        ],

        rows: groupedRows.map(
            (group) => ({
                [AGGREGATION_FIELD_NAMES.department]:
                    group.department,

                [AGGREGATION_FIELD_NAMES.bidPercentage]:
                    totalBidCount > 0
                        ? Number(
                              (
                                  group.tenderIds.size /
                                  totalBidCount
                              ).toFixed(2)
                          )
                        : 0,

                [AGGREGATION_FIELD_NAMES.estimatedValuePercentage]:
                    totalEstimatedValue > 0
                        ? Number(
                              (
                                  group.estimatedValue /
                                  totalEstimatedValue
                              ).toFixed(2)
                          )
                        : 0,
            })
        ),

        columnTypes: {
            [AGGREGATION_FIELD_NAMES.department]:
                COLUMN_TYPES.TEXT,

            [AGGREGATION_FIELD_NAMES.bidPercentage]:
                COLUMN_TYPES.NUMBER,

            [AGGREGATION_FIELD_NAMES.estimatedValuePercentage]:
                COLUMN_TYPES.NUMBER,
        },

        dataTypes: {
            [AGGREGATION_FIELD_NAMES.department]:
                "STRING",

            [AGGREGATION_FIELD_NAMES.bidPercentage]:
                "DECIMAL",

            [AGGREGATION_FIELD_NAMES.estimatedValuePercentage]:
                "DECIMAL",
        },
    };
}
*/

function normalizeCsvData(fields, rows) {
    const columnTypes =
        detectColumnTypes(
            fields,
            rows
        );

    const dataTypes =
        detectCsvDataTypes(
            fields,
            rows,
            columnTypes
        );

    return {fields, rows, columnTypes, dataTypes};
}

function normalizeReportData(reportData) {
    if (!reportData || !Array.isArray(reportData.columns) || !Array.isArray(reportData.rows)) {
        return null;
    }

    const fields =
        reportData.columns.map(
            (column) => column.name
        );

    const columnTypes =
        reportData.columns.reduce(
            (types, column) => {
                const columnType =
                    API_DATA_TYPE_MAP[
                        column.dataType
                    ];

                if (!columnType) {
                    throw new Error(
                        `Unsupported API datatype "${column.dataType}" for column "${column.name}".`
                    );
                }

                types[column.name] =
                    columnType;

                return types;
            },
            {}
        );

    const dataTypes =
        reportData.columns.reduce(
            (types, column) => {
                if (!column.dataType) {
                    throw new Error(
                        `Missing API datatype for column "${column.name}".`
                    );
                }

                types[column.name] = String(
                    column.dataType
                ).toUpperCase();

                return types;
            },
            {}
        );

    return {
        fields,
        rows: reportData.rows,
        columnTypes,
        dataTypes,
    };
}

function getHumanReadableFieldLabel(field) {
    const normalizedField =
        String(field).replace(/[^a-z0-9]/gi, "").toLowerCase();

    if (normalizedField === "deptname") {
        return "Department Name";
    }

    const words =
        String(field)
            .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/[_-]+/g, " ")
            .trim()
            .split(/\s+/);

    if (
        words.length > 1 &&
        /^[nsm]$/.test(words[0]) &&
        /^[A-Z]/.test(words[1])
    ) {
        words.shift();
    }

    const knownTerms = {
        dept: "Department",
        ecv: "ECV",
        id: "ID",
        td: "TD",
    };

    return words
        .map((word) =>
            knownTerms[word.toLowerCase()] ||
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");
}

export {
    COLUMN_TYPES,
    API_DATA_TYPE_MAP,
    TENDER_STATUS_LABELS,
    TENDER_CATEGORY_LABELS,
    isPhoneColumn,
    isNumericLikeField,
    getNumericLikeFields,
    isNumericChartField,
    isRevenueField,
    getRevenueFields,
    getRevenueDisplayConfig,
    formatRevenueValue,
    parseRevenueValue,
    getTenderValueLabel,
    transformChartData,
    getFilterField,
    normalizeCsvData,
    normalizeReportData,
    filterNormalizedData,
    getPeriodDateFields,
    getHumanReadableFieldLabel,
};