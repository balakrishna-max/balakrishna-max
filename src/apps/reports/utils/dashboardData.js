const COLUMN_TYPES = { NUMBER: "number", DATE: "date", TEXT: "text" };
const DECIMAL_NUMBER_FORMATTER = new Intl.NumberFormat("en-IN", {
    useGrouping: true,
    maximumFractionDigits: 20,
});
const PLAIN_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
});

const API_DATA_TYPE_MAP = { STRING: COLUMN_TYPES.TEXT, INTEGER: COLUMN_TYPES.NUMBER, LONG: COLUMN_TYPES.NUMBER, 
    DECIMAL: COLUMN_TYPES.NUMBER, BOOLEAN: COLUMN_TYPES.TEXT, DATE: COLUMN_TYPES.DATE, DATETIME: COLUMN_TYPES.DATE };

function isEmptyValue(value) {
    return (value === null || value === undefined || String(value).trim() === "");
}

function isNumericValue(value) {
    if (isEmptyValue(value)) {
        return false;
    }
    const normalizedValue = String(value).trim().replace(/,/g, "");
    return (
        normalizedValue !== "" && !Number.isNaN(Number(normalizedValue))
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
    const nonEmptyValues = values.filter((value) => !isEmptyValue(value));
    if (nonEmptyValues.length === 0) {
        return COLUMN_TYPES.TEXT;
    }

    const allNumeric = nonEmptyValues.every((value) => isNumericValue(value));
    if (allNumeric) {
        return COLUMN_TYPES.NUMBER;
    }

    const allDates = nonEmptyValues.every((value) => isDateValue(value));
    if (allDates) {
        return COLUMN_TYPES.DATE;
    }

    return COLUMN_TYPES.TEXT;
}

function detectColumnTypes(fields, rows) {
    return fields.reduce(
        (types, field) => {const values = rows.map((row) => row[field]);
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
                const values = rows.map((row) => row[field]).filter((value) => !isEmptyValue(value));
                const hasDecimalValue = values.some((value) => {const normalizedValue = String(value).trim().replace(/,/g, "");
                    return normalizedValue.includes(".");
                });

                types[field] = hasDecimalValue ? "DECIMAL" : "INTEGER";
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
    return String(fieldName).toLowerCase().replace(/[\s_-]/g, "");
}

function isPhoneColumn(fieldName) {
    const normalizedFieldName =
        normalizeFieldName(fieldName);

    return (
        normalizedFieldName.includes("phone") || normalizedFieldName.includes("mobile") || normalizedFieldName.includes("contactnumber")
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

const FILTER_FIELD_ALIASES = {
    "category-wise": [
        "ntendercategory", "tendercategory", "ncategory", "category",
        "categoryname", "designation", "desg.", "e desg.",
        "subcategory", "nature", "commodity", "service", "services",
        "product", "products", "work", "works", "type",
    ],
    status: [
        "ntenderstatus", "tenderstatus", "ntendersattus", "nstatus",
        "status", "state", "stage", "currentstatus", "bidstatus",
        "supplierstatus", "paymentstatus", "invoicestatus", "approvalstatus",
    ],
};

const TENDER_STATUS_LABELS = {
    101: "Under Creation",
    102: "Under Editing",
    103: "Sent for Publishing",
    104: "Deleted Before Publishing",
    105: "Published",
    106: "Recalled",
    107: "Rejected",
    108: "Cancelled",
    109: "Hard Copies TBS",
    110: "Closed",
    111: "LOA Issue",
    112: "LOA Pending",
    113: "LOA Approval",
    114: "Waiting LOA Approval",
};

const TENDER_TYPE_LABELS = {
    101: "Open",
    102: "Limited",
    103: "Nomination",
    104: "Proprietary",
};

const TENDER_EVALTYPE_LABELS = {
    101: "Percentage",
    102: "Item Wise",
    103: "Both",
    104: "Multiple",
    105: "Price Bid EPC"
};

const TENDER_CATEGORY_LABELS = {
    101: "Works",
    102: "Products",
    103: "Custom",
    104: "Services",
    105: "SwissChallengeApp",
    106: "Catalog Request",
};

function getTenderValueLabel(fieldName, value) {
    const filterType = getFilterTypeForField(fieldName);
    const labels = filterType === "category-wise"
        ? TENDER_CATEGORY_LABELS
        : filterType === "status"
          ? TENDER_STATUS_LABELS
          : null;

    if (!labels || isEmptyValue(value)) {
        return value;
    }

    const code = Number(String(value).trim());

    return Number.isInteger(code) && labels[code] !== undefined
        ? labels[code]
        : value;
}

function isNumericLikeField(data, fieldName) {
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
    return isNumericLikeField(data, fieldName);
}

const REVENUE_UNIT_THRESHOLDS = [
    {minimum: 10000000, divisor: 10000000, suffix: "cr."},
    {minimum: 100000, divisor: 100000, suffix: "lak."},
    {minimum: 1000, divisor: 1000, suffix: "k"},
    {minimum: 0, divisor: 1, suffix: ""},
];
const REVENUE_VALUE_FORMATTERS = {
    exact: new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 20,
    }),
    scaled: Array.from(
        {length: 21},
        (_, maximumFractionDigits) => new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits,
        })
    ),
};

function getRevenueDisplayUnit(
    maxValue
) {
    const unit = REVENUE_UNIT_THRESHOLDS.find(
        (threshold) => maxValue >= threshold.minimum
    );

    if (!unit) {
        throw new Error(`Cannot determine a display unit for revenue value "${maxValue}".`);
    }

    return unit;
}

function getRevenueValueRange(
    rows,
    fieldName
) {
    if (
        !Array.isArray(rows) ||
        !fieldName
    ) {
        return null;
    }

    let minimumValue = null;
    let maximumValue = null;

    for (const row of rows) {
        const numericValue =
            parseRevenueValue(
                row[fieldName]
            );

        if (numericValue === null) {
            continue;
        }

        if (minimumValue === null || numericValue < minimumValue) {
            minimumValue = numericValue;
        }

        if (maximumValue === null || numericValue > maximumValue) {
            maximumValue = numericValue;
        }
    }

    return {minimumValue, maximumValue};
}

function getRevenueDisplayConfig(data) {
    const revenueFields =
        getRevenueFields(data);

    const ranges = Object.fromEntries(
        revenueFields.map((fieldName) => [
            fieldName,
            getRevenueValueRange(data.rows, fieldName),
        ])
    );

    for (const fieldName of revenueFields) {
        if (!ranges[fieldName]) {
            throw new Error(`Cannot determine the value range for revenue field "${fieldName}".`);
        }
    }

    const sharedMaximum = revenueFields.reduce((maximum, fieldName) => {
        const range = ranges[fieldName];
        return range.maximumValue === null
            ? maximum
            : Math.max(maximum, Math.abs(range.maximumValue), Math.abs(range.minimumValue));
    }, 0);

    return revenueFields.reduce(
        (config, fieldName) => {
            const {minimumValue, maximumValue} = ranges[fieldName];

            if (maximumValue === null) {
                return config;
            }

            const unit = getRevenueDisplayUnit(sharedMaximum);

            config[fieldName] = {
                minimumValue,
                maximumValue,
                divisor: unit.divisor,
                suffix: unit.suffix,
            };

            return config;
        },
        {}
    );
}

function getRevenueUnitLabel(displayConfig) {
    return displayConfig ? displayConfig.suffix || "₹" : "";
}

function formatRevenueValue(
    value,
    displayConfig,
    {
        exact = false,
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

    const scaledValue = numericValue / displayConfig.divisor;
    const decimalPlaces = Math.min(
        20,
        Math.max(2, Math.ceil(-Math.log10(Math.abs(scaledValue))) + 1)
    );
    const formatter = exact
        ? REVENUE_VALUE_FORMATTERS.exact
        : REVENUE_VALUE_FORMATTERS.scaled[decimalPlaces];
    const formattedValue = formatter.format(exact ? numericValue : scaledValue);

    return `₹${formattedValue}`;
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

function formatNumericValue(value, dataType, {preserveNonDecimalValue = false, emptyAsDash = true} = {}) {
    if (emptyAsDash && (value === null || value === undefined || value === "")) {
        return "—";
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return String(value ?? "—");
    }

    if (dataType === "DECIMAL") {
        return DECIMAL_NUMBER_FORMATTER.format(numericValue);
    }

    return preserveNonDecimalValue
        ? String(value)
        : PLAIN_NUMBER_FORMATTER.format(numericValue);
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

    const aliases = FILTER_FIELD_ALIASES[filterType];
    if (!Array.isArray(aliases) || aliases.length === 0) {
        return "";
    }

    const candidates = data.fields.filter((field) => {
        return getFilterTypeForField(field) === filterType;
    }).map((field) => {
        const normalizedFieldName = normalizeFieldName(field);
        const fieldType = data.columnTypes[field];
        const aliasIndex = aliases.indexOf(normalizedFieldName);
        let score = aliasIndex >= 0 ? 1000 - aliasIndex * 20 : 500;

        if (fieldType === COLUMN_TYPES.TEXT) {
            score += 15;
        }

        if (isNumericLikeField(data, field)) {
            score -= 30;
        }

        if (isPhoneColumn(field)) {
            score -= 100;
        }

        if (normalizedFieldName.includes("id") || normalizedFieldName.includes("code") || normalizedFieldName.includes("number")) {
            score -= 50;
        }

        return {field, score};
    }).filter((candidate) => candidate.score > 0).sort((first, second) => second.score - first.score);

    return (candidates[0]?.field || "");
}

function getFilterTypeForField(fieldName) {
    const normalizedFieldName = normalizeFieldName(fieldName);

    return Object.entries(FILTER_FIELD_ALIASES).find(([filterType, aliases]) =>
        aliases.includes(normalizedFieldName) ||
        normalizedFieldName.includes(`tender${filterType === "status" ? "status" : "category"}`)
    )?.[0];
}

function parseMonthYear(value) {
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(value)) {
        return null;
    }
    const [month, year] = value.split("/").map(Number);
    return (year * 12 + (month - 1));
}

function getRowMonthIndex(value) {
    if (isEmptyValue(value)) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return (date.getFullYear() * 12 +date.getMonth());
}

const PERIOD_START_KEYWORDS = {opening: 100, open: 90, start: 95, started: 95, begin: 85,
    beginning: 85,  created: 90, create: 85, creation: 85, initiated: 75,
    initiation: 70, commence: 70, commenced: 70, commencement: 70, effective: 65,
    issue: 60, issued: 65, publish: 55, published: 60, from: 50};

const PERIOD_END_KEYWORDS = new Set(["closing", "close", "closed", "end", "ended", "to", "till", "until",
    "ending", "terminate", "terminated", "termination", "submission",
    "submitted", "expiry", "expired", "deadline", "due",
    "complete", "completed", "completion", "finish", "finished"]);

const PERIOD_START_PENALTIES = {update: 60, updated: 65, modify: 55, modified: 60, last: 40,
    delete: 65, deleted: 70, deletion: 65, payment: 55, paid: 55,
    invoice: 55, invoiced: 55, approval: 35, approved: 40, closing: 70,
    close: 60, closed: 65, end: 60, ended: 60, ending: 60,
    terminate: 60, terminated: 65, termination: 60, submission: 30, submitted: 35,
    expiry: 45, expired: 50, deadline: 40, complete: 45, completed: 50,
    completion: 45, finish: 40, finished: 45};

const PERIOD_TECHNICAL_TOKENS = new Set(["date", "datetime", "timestamp", "time", "dt"]);
const PERIOD_START_TOKENS = new Set(Object.keys(PERIOD_START_KEYWORDS));

function tokenizeDateFieldName(fieldName) {
    return String(fieldName).trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[^a-zA-Z0-9]+/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
}

function getDateFieldQuality(data, fieldName) {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0
    ) {
        return {populatedRatio: 0, validDateRatio: 0};
    }

    let populatedCount = 0;
    let validDateCount = 0;

    for (const row of data.rows) {
        const value = row[fieldName];

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

    return {populatedRatio: populatedCount / data.rows.length,
        validDateRatio:  validDateCount / populatedCount,
    };
}

function getContextTokens(tokens) {
    return tokens.filter(
        (token) =>
            !PERIOD_TECHNICAL_TOKENS.has(token) &&
            !PERIOD_START_TOKENS.has(token) &&
            !PERIOD_END_KEYWORDS.has(token) &&
            token !== "id" && token !== "no" &&
            token !== "number" && token !== "code"
    );
}

function getSharedContextScore(
    firstTokens,
    secondTokens
) {
    const firstContext = getContextTokens(firstTokens);
    const secondContext = getContextTokens(secondTokens);
    if (firstContext.length === 0 || secondContext.length === 0) {
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

function getPeriodStartScore(fieldName) {
    const tokens = tokenizeDateFieldName(fieldName);
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
        const relatedTokens = tokenizeDateFieldName(field);
        const hasEndMeaning = relatedTokens.some((token) => PERIOD_END_KEYWORDS.has(token));
        if (!hasEndMeaning) {continue;}
        const sharedContextScore = getSharedContextScore(candidate.tokens, relatedTokens);

        if (candidateContext.length > 0 && sharedContextScore > bestRelatedScore) {
            bestRelatedScore = sharedContextScore;
        }
    }

    return bestRelatedScore;
}

function getPeriodDateFields(data) {
    const emptyResult = {hasDateFields: false, periodDateField: ""};

    if (!data || !Array.isArray(data.fields) || !data.columnTypes ) {
        return emptyResult;
    }

    const dateFields = data.fields.filter(
            (field) => data.columnTypes[field] === COLUMN_TYPES.DATE
        );

    if (dateFields.length === 0) {
        return emptyResult;
    }

    const candidates = dateFields.map((field) => {
                const namingScore = getPeriodStartScore(field);
                const quality = getDateFieldQuality(data, field);
                const relatedEndScore = getRelatedEndDateScore(namingScore, dateFields);
                const qualityScore = quality.validDateRatio * 35 + quality.populatedRatio * 15;
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

    if (!bestCandidate || bestCandidate.quality.validDateRatio <= 0) {
        return emptyResult;
    }

    return {hasDateFields: true, periodDateField: bestCandidate.fieldName};
}

function transformChartData({rows, xAxisField, yAxisField, yAxisFields = [], columnTypes, dataTypes = {}, fieldLabels = {}, revenueDisplayConfig}) {
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

    const xAxisIsRevenue = Boolean(revenueDisplayConfig?.[xAxisField]);
    const xAxisType = isNumericChartField({rows, columnTypes}, xAxisField)
        ? COLUMN_TYPES.NUMBER
        : columnTypes[xAxisField];
    const isMultiYAxisChart = yAxisFields.length > 0;
    const data = rows
        .map((row) => {
            const rawXValue = xAxisIsRevenue
                ? parseRevenueValue(row[xAxisField])
                : transformDataValue(
                    row[xAxisField],
                    xAxisType
                );
            const xValue = xAxisType === COLUMN_TYPES.NUMBER
                ? rawXValue
                : getTenderValueLabel(xAxisField, rawXValue);
            if (xValue === null || xValue === undefined) {
                return null;
            }

            if (!isMultiYAxisChart) {
                const yAxisIsRevenue = Boolean(revenueDisplayConfig?.[yAxisField]);
                const yAxisType = isNumericChartField({rows, columnTypes}, yAxisField) ? COLUMN_TYPES.NUMBER : columnTypes[yAxisField];
                const yValue = yAxisIsRevenue ? parseRevenueValue(row[yAxisField]) : transformDataValue(row[yAxisField], yAxisType);

                return {x: xValue, y: yValue};
            }
            const transformedRow = {x: xValue};
            for ( const field of selectedYAxisFields ) {
                const yAxisIsRevenue = Boolean(revenueDisplayConfig?.[field]);
                const yAxisType = isNumericChartField({rows, columnTypes}, field)
                        ? COLUMN_TYPES.NUMBER : columnTypes[field];
                const yValue = yAxisIsRevenue ? parseRevenueValue(row[field]) : transformDataValue(row[field], yAxisType);
                transformedRow[field] = yValue;
            }

            return transformedRow;
        })
        .filter(Boolean);

    const yAxes = selectedYAxisFields.map(
            (field) => {
                const revenueField = Boolean(revenueDisplayConfig?.[field]);
                const yAxisType = revenueField ? COLUMN_TYPES.NUMBER : columnTypes[field];
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

    return {data, xAxis: {
            field: xAxisField, label: fieldLabels[xAxisField] || xAxisField,
            type: xAxisType,
            dataType: xAxisIsRevenue
                ? "DECIMAL"
                : dataTypes[xAxisField] || getFallbackDataType(xAxisType),
            revenueDisplayConfig: revenueDisplayConfig[xAxisField] || null},
        yAxis: yAxes[0] ?? null,
        yAxes,
    };
}

function filterNormalizedData(data,
    {
        fromDateField = "",
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

    if (fromDateField && fromDate && toDate) {
        const fromMonthIndex = parseMonthYear(fromDate);
        const toMonthIndex = parseMonthYear(toDate);
        filteredRows = filteredRows.filter( (row) => {
                    const rowFromMonthIndex = getRowMonthIndex(row[fromDateField]);

                    if (rowFromMonthIndex === null || fromMonthIndex === null || toMonthIndex === null ) {
                        return false;
                    }

                    return (rowFromMonthIndex >= fromMonthIndex && rowFromMonthIndex <= toMonthIndex);
                }
            );
    }

    const effectiveFilterField = filterField || getFilterField(data, filterType);
    if (effectiveFilterField && !isEmptyValue(filterValue) && (filterType === "category-wise" || filterType === "status" || filterField)) {
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
    const filteredData = {...data, rows: filteredRows};
    return filteredData;
}

function normalizeCsvData(fields, rows) {
    const columnTypes = detectColumnTypes(fields, rows);
    const dataTypes = detectCsvDataTypes(fields, rows, columnTypes);
    return {fields, rows, columnTypes, dataTypes};
}

function normalizeReportData(reportData) {
    if (!reportData || !Array.isArray(reportData.columns) || !Array.isArray(reportData.rows)) {
        return null;
    }

    const fields = reportData.columns.map((column) => column.name);
    const columnTypes = reportData.columns.reduce(
            (types, column) => {
                const columnType = API_DATA_TYPE_MAP[column.dataType];
                if (!columnType) {
                    throw new Error(`Unsupported API datatype "${column.dataType}" for column "${column.name}".`);
                }
                types[column.name] = columnType;
                return types;
            },
            {}
        );

    const dataTypes = reportData.columns.reduce(
            (types, column) => {
                if (!column.dataType) {
                    throw new Error(`Missing API datatype for column "${column.name}".`);
                }
                types[column.name] = String(column.dataType).toUpperCase();
                return types;
            },
            {}
        );
    return {fields, rows: reportData.rows, columnTypes, dataTypes};
}

function getHumanReadableFieldLabel(field) {
    const normalizedField = String(field).replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalizedField === "deptname") {
        return "Department Name";
    }
    const words = String(field).replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().split(/\s+/);
    if (words.length > 1 && /^[nsm]$/.test(words[0]) && /^[A-Z]/.test(words[1])) {
        words.shift();
    }
    const knownTerms = {dept: "Department", ecv: "ECV", id: "ID", td: "TD"};
    return words.map((word) => knownTerms[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function normalizeLookupFieldName(field) {
    return String(field).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFieldByNormalizedName(fields = [], targetName) {
    const target = normalizeLookupFieldName(targetName);
    return fields.find((field) => normalizeLookupFieldName(field) === target) || "";
}

function getFieldLabels(fields) {
    return Object.fromEntries(
        fields.map((field) => [field, getHumanReadableFieldLabel(field)])
    );
}

function getDepartmentNameField(fields = []) {
    const aliases = new Set([
        "deptname", "sdeptname", "ndeptname", "departmentname",
        "sdepartmentname", "department", "sdepartment",
    ]);

    return fields.find((field) => aliases.has(normalizeLookupFieldName(field))) || "";
}

function getReportMetrics(data, fieldLabels = {}) {
    if (!data) {
        return [];
    }

    const numericFields = data.fields.filter((field) => data.columnTypes[field] === COLUMN_TYPES.NUMBER);
    const textFields = data.fields.filter((field) => data.columnTypes[field] === COLUMN_TYPES.TEXT);
    const metrics = [{label: "Total Records", value: data.rows.length, priority: 0}];

    numericFields.forEach((field) => {
        const total = data.rows.reduce((sum, row) => {
            const value = parseNumericValue(row[field]);
            return value === null ? sum : sum + value;
        }, 0);

        metrics.push({
            label: `Total ${fieldLabels[field] || field}`,
            value: total,
            priority: isRevenueField(field) ? 1 : 2,
            isNumeric: true,
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
        {label: "Report Fields", value: data.fields.length, priority: 4},
        {label: "Numeric Fields", value: numericFields.length, priority: 5},
        {label: "Text Fields", value: textFields.length, priority: 6},
        {
            label: "Populated Values",
            value: data.fields.reduce(
                (count, field) =>
                    count + data.rows.filter(
                        (row) => !isEmptyValue(row[field])
                    ).length,
                0
            ),
            priority: 7,
        }
    );

    return metrics
        .sort((first, second) => first.priority - second.priority)
        .slice(0, 5)
        .map(({label, value, isNumeric}) => ({
            label,
            value: new Intl.NumberFormat("en-IN", {
                maximumFractionDigits: isNumeric ? 2 : 0,
            }).format(value),
        }));
}

export {COLUMN_TYPES, API_DATA_TYPE_MAP, TENDER_STATUS_LABELS,
    TENDER_CATEGORY_LABELS, isPhoneColumn, isNumericLikeField,
    getNumericLikeFields, isNumericChartField, isRevenueField,
    getRevenueFields, getRevenueDisplayConfig, getRevenueUnitLabel, formatRevenueValue,
    parseRevenueValue, getTenderValueLabel, transformChartData,
    formatNumericValue,
    getFilterField, normalizeCsvData, normalizeReportData,
    filterNormalizedData, getPeriodDateFields, getHumanReadableFieldLabel,
    getFieldLabels, getFieldByNormalizedName, getDepartmentNameField,
    getReportMetrics};