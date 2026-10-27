import {
    getFieldByNormalizedName,
    getHumanReadableFieldLabel,
    getTenderValueLabel,
    getFinancialYearStartYear,
    isNumericLikeField,
    parseRevenueValue,
    transformChartData,
} from "./dashboardData.js";

const COUNT_FIELD = "__customReportRecordCount";
const COMBINED_X_FIELD = "__customReportDimensions";
const REVENUE_FIELD = "__customReportRevenue";
const MAIN_TENDER_CATEGORIES = ["Works", "Products", "Services"];
const BUILDER_FIELD_DEFINITIONS = [
    {
        id: "departmentName",
        label: "Department Name",
        aliases: ["departmentname", "sdepartmentname", "sdeptname", "mappingdepartmentname"],
    },
    {id: "ecv", label: "ECV", aliases: ["ecv", "secv", "estimatedcontractvalue", "mestimatedcost"]},
    {id: "tenderType", label: "Tender Type", aliases: ["tendertype", "ntendertype"]},
    {id: "tenderStatus", label: "Tender Status", aliases: ["ntenderstatus", "ntendersattus", "nstatus", "status"]},
    {id: "tenderCategory", label: "Tender Category", aliases: ["tendercategory", "ntendercategory"]},
    {id: "tenderSubject", label: "Tender Subject", aliases: ["tendersubject", "nameofwork", "snameofwork"]},
    {id: "financialYear", label: "Fin Year", aliases: ["finyear", "sfinyear", "financialyear"]},
    {id: "month", label: "Month", aliases: ["month", "smonth"]},
    {id: "estimatedCost", label: "Estimated Cost", aliases: ["estimatedcost"]},
];

function isBuilderNumericMeasure(data, field) {
    const normalizedField = String(field).replace(/[^a-z0-9]/gi, "").toLowerCase();
    const measureName = /ecv|estimatedcost|revenue|amount|value|total|emd|bids|count|quantity|price|cost|fee|payment|award/i;

    return isNumericLikeField(data, field) && measureName.test(normalizedField);
}

function normalizeBuilderFieldName(field) {
    return String(field).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getTenderIdentifierField(builderFields) {
    return builderFields.find(({field}) =>
        ["tenderid", "ntenderid"].includes(normalizeBuilderFieldName(field))
    )?.field || "";
}

function getBuilderFields(data) {
    if (!data || !Array.isArray(data.fields)) {
        return [];
    }

    const mappedFields = BUILDER_FIELD_DEFINITIONS.flatMap((definition) => {
        const field = definition.aliases
            .map((alias) => getFieldByNormalizedName(data.fields, alias))
            .find(Boolean);

        return field
            ? [{
                ...definition,
                field,
                isNumeric: ["ecv", "estimatedCost"].includes(definition.id) &&
                    isBuilderNumericMeasure(data, field),
                sourceField: field,
                isAvailable: true,
            }]
            : [];
    });
    const mappedFieldNames = new Set(
        mappedFields.map(({field}) => normalizeBuilderFieldName(field))
    );
    const displayedLabels = new Set(mappedFields.map(({label}) => normalizeBuilderFieldName(label)));
    const additionalFields = data.fields
        .flatMap((field) => {
            const normalizedField = normalizeBuilderFieldName(field);

            if (mappedFieldNames.has(normalizedField)) {
                return [];
            }

            mappedFieldNames.add(normalizedField);
            let label = getHumanReadableFieldLabel(field);

            if (displayedLabels.has(normalizeBuilderFieldName(label))) {
                label = `${label} · API column`;
            }
            displayedLabels.add(normalizeBuilderFieldName(label));

            return [{
                id: `source:${field}`,
                label,
                field,
                sourceField: field,
                isNumeric: isBuilderNumericMeasure(data, field),
                isAvailable: true,
            }];
        });
    const ecvField = mappedFields.find(({id}) => id === "ecv");
    const revenueField = {
        id: "revenue",
        label: "Revenue",
        field: REVENUE_FIELD,
        sourceField: ecvField?.isNumeric ? ecvField.field : "",
        isNumeric: true,
        isAvailable: Boolean(ecvField?.isNumeric),
    };

    return [...mappedFields, ...additionalFields, revenueField];
}

function getMissingBuilderFields(builderFields) {
    const availableIds = new Set(builderFields.map(({id}) => id));
    return BUILDER_FIELD_DEFINITIONS.filter(({id}) => !availableIds.has(id));
}

function getBuilderDisplayValue(field, value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return "Unspecified";
    }

    return String(getTenderValueLabel(field, value)).trim();
}

function getMonthSortValue(value) {
    const text = String(value).trim().toLowerCase();
    const monthNumber = Number(text);

    if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
        return (monthNumber + 8) % 12;
    }

    const monthIndex = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
    ].findIndex((month) => text.startsWith(month));

    return monthIndex < 0 ? Number.MAX_SAFE_INTEGER : (monthIndex + 9) % 12;
}

function compareBuilderSeriesValues(definition, first, second) {
    if (definition.id === "financialYear") {
        const firstYear = getFinancialYearStartYear(first);
        const secondYear = getFinancialYearStartYear(second);
        return (firstYear ?? Number.MAX_SAFE_INTEGER) -
            (secondYear ?? Number.MAX_SAFE_INTEGER) ||
            first.localeCompare(second);
    }

    if (definition.id === "month") {
        return getMonthSortValue(first) - getMonthSortValue(second) ||
            first.localeCompare(second);
    }

    if (definition.id === "tenderCategory") {
        const firstMainCategoryIndex = MAIN_TENDER_CATEGORIES.indexOf(first);
        const secondMainCategoryIndex = MAIN_TENDER_CATEGORIES.indexOf(second);

        if (firstMainCategoryIndex !== secondMainCategoryIndex) {
            if (firstMainCategoryIndex < 0) {
                return 1;
            }
            if (secondMainCategoryIndex < 0) {
                return -1;
            }
            return firstMainCategoryIndex - secondMainCategoryIndex;
        }
    }

    return first.localeCompare(second);
}

function getBuilderSeriesValues(data, definition) {
    const counts = new Map();
    data.rows.forEach((row) => {
        const value = getBuilderDisplayValue(definition.field, row[definition.field]);
        counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.keys()].sort((first, second) =>
        compareBuilderSeriesValues(definition, first, second)
    );
}

function createBuilderReportView(data, xFields, yFields, builderFields, fieldLabels, revenueDisplayConfig) {
    if (!data || xFields.length === 0 || yFields.length === 0) {
        return null;
    }

    const definitionsByField = new Map(builderFields.map((definition) => [definition.field, definition]));
    const numericMeasureDefinitions = yFields
        .map((field) => definitionsByField.get(field))
        .filter((definition) => definition?.isNumeric && definition.isAvailable);
    const numericMeasures = numericMeasureDefinitions.map(({field}) => field);
    const seriesDefinition = yFields
        .map((field) => definitionsByField.get(field))
        .find((definition) => definition?.isAvailable && !definition.isNumeric);
    const seriesValues = seriesDefinition
        ? getBuilderSeriesValues(data, seriesDefinition)
        : [];
    const series = seriesDefinition
        ? seriesValues.flatMap((value, valueIndex) => {
            const measures = numericMeasures.length > 0
                ? numericMeasureDefinitions
                : [null];

            return measures.map((measure) => ({
                key: measure
                    ? `__aggregated_${measure.field}_${valueIndex}`
                    : `${COUNT_FIELD}_${valueIndex}`,
                label: measure
                    ? `${value} — ${fieldLabels[measure.field] || measure.label}`
                    : value,
                value,
                measure: measure?.field ?? null,
                sourceField: measure?.sourceField ?? null,
                isCount: !measure,
            }));
        })
        : numericMeasures.map((field) => ({
            key: field,
            label: fieldLabels[field] || definitionsByField.get(field)?.label || field,
            measure: field,
            sourceField: definitionsByField.get(field)?.sourceField || field,
            isCount: false,
        }));

    if (series.length === 0) {
        return null;
    }

    const tenderIdentifierField = getTenderIdentifierField(builderFields);
    const groupMap = new Map();
    const countedTenderValues = new Set();
    let includedRowCount = 0;
    let tenderValueRowsWithoutTenderId = 0;

    function shouldIncludeTenderValue(row, groupKey, seriesKey) {
        if (!tenderIdentifierField) {
            tenderValueRowsWithoutTenderId += 1;
            return true;
        }

        const tenderId = String(row[tenderIdentifierField] ?? "").trim();

        if (!tenderId) {
            tenderValueRowsWithoutTenderId += 1;
            return true;
        }

        const tenderValueKey = JSON.stringify([groupKey, seriesKey, tenderId]);
        if (countedTenderValues.has(tenderValueKey)) {
            return false;
        }

        countedTenderValues.add(tenderValueKey);
        return true;
    }

    data.rows.forEach((row) => {
        const dimensionValues = xFields.map((field) => getBuilderDisplayValue(field, row[field]));
        const seriesValue = seriesDefinition
            ? getBuilderDisplayValue(seriesDefinition.field, row[seriesDefinition.field])
            : "";

        const groupKey = JSON.stringify(dimensionValues);
        let group = groupMap.get(groupKey);

        if (!group) {
            group = {
                dimensions: dimensionValues,
                totals: Object.fromEntries(series.map(({key}) => [key, 0])),
            };
            groupMap.set(groupKey, group);
        }

        includedRowCount += 1;

        if (seriesDefinition) {
            if (numericMeasures.length === 0) {
                const seriesItem = series.find((item) => item.value === seriesValue);
                if (seriesItem) {
                    group.totals[seriesItem.key] += 1;
                }
                return;
            }

            numericMeasures.forEach((measure) => {
                const item = series.find((candidate) =>
                    candidate.value === seriesValue &&
                    candidate.measure === measure
                );
                if (!item) {
                    return;
                }

                const amount = parseRevenueValue(row[item.sourceField]);

                if (amount !== null) {
                    if (["ecv", "revenue"].includes(definitionsByField.get(item.measure)?.id) &&
                        !shouldIncludeTenderValue(row, groupKey, item.key)) {
                        return;
                    }

                    group.totals[item.key] += amount;
                }
            });
            return;
        }

        numericMeasures.forEach((measure) => {
            const definition = definitionsByField.get(measure);
            const amount = parseRevenueValue(row[definition?.sourceField || measure]);

            if (amount !== null &&
                (!["ecv", "revenue"].includes(definition?.id) ||
                    shouldIncludeTenderValue(row, groupKey, measure))) {
                group.totals[measure] += amount;
            }
        });
    });

    const dimensionLabels = xFields.map((field) => fieldLabels[field] || field);
    const chartXAxisField = xFields.length === 1 ? xFields[0] : COMBINED_X_FIELD;
    const outputFields = [
        ...xFields,
        ...series.map(({key}) => key),
    ];
    const temporalFieldIndex = xFields.findIndex((field) =>
        ["financialYear", "month"].includes(definitionsByField.get(field)?.id)
    );
    const hasTemporalXAxis = xFields.length === 1 && temporalFieldIndex === 0;
    const outputRows = [...groupMap.values()]
        .sort((first, second) => {
            if (hasTemporalXAxis) {
                const definition = definitionsByField.get(xFields[temporalFieldIndex]);
                return compareBuilderSeriesValues(
                    definition,
                    first.dimensions[temporalFieldIndex],
                    second.dimensions[temporalFieldIndex]
                );
            }

            const firstTotal = series.reduce((total, item) => total + Math.abs(first.totals[item.key]), 0);
            const secondTotal = series.reduce((total, item) => total + Math.abs(second.totals[item.key]), 0);
            return secondTotal - firstTotal;
        })
        .map((group) => ({
            ...Object.fromEntries(xFields.map((field, index) => [field, group.dimensions[index]])),
            ...group.totals,
            ...(xFields.length > 1
                ? {[COMBINED_X_FIELD]: group.dimensions.join(" / ")}
                : {}),
        }));
    const outputColumnTypes = {
        ...Object.fromEntries(xFields.map((field) => [field, "text"])),
        ...Object.fromEntries(series.map(({key}) => [key, "number"])),
        ...(xFields.length > 1 ? {[COMBINED_X_FIELD]: "text"} : {}),
    };
    const outputDataTypes = {
        ...Object.fromEntries(xFields.map((field) => [field, "STRING"])),
        ...Object.fromEntries(series.map(({key, isCount}) => [key, isCount ? "INTEGER" : "DECIMAL"])),
        ...(xFields.length > 1 ? {[COMBINED_X_FIELD]: "STRING"} : {}),
    };
    const outputLabels = {
        ...fieldLabels,
        ...Object.fromEntries(series.map(({key, label}) => [key, label])),
        ...(xFields.length > 1 ? {[COMBINED_X_FIELD]: dimensionLabels.join(" / ")} : {}),
    };
    const outputRevenueConfig = {
        ...revenueDisplayConfig,
        ...Object.fromEntries(
            series.filter(({sourceField}) => sourceField && revenueDisplayConfig[sourceField])
                .map(({key, sourceField}) => [key, revenueDisplayConfig[sourceField]])
        ),
    };
    const chartData = transformChartData({
        rows: outputRows,
        xAxisField: chartXAxisField,
        yAxisField: series[0].key,
        yAxisFields: series.length > 1 ? series.map(({key}) => key) : [],
        columnTypes: {...outputColumnTypes, [chartXAxisField]: "text"},
        dataTypes: {...outputDataTypes, [chartXAxisField]: "STRING"},
        fieldLabels: outputLabels,
        revenueDisplayConfig: outputRevenueConfig,
    });

    return {
        data: {
            fields: outputFields,
            rows: outputRows,
            columnTypes: outputColumnTypes,
            dataTypes: outputDataTypes,
        },
        fieldLabels: outputLabels,
        revenueDisplayConfig: outputRevenueConfig,
        chart: chartData.data.length > 0
            ? {
                chartData,
                chartType: series.length > 1 ? "grouped-bar" : "bar",
                chartTitles: {
                    groupedCountYAxis: "Tender / Resource Count",
                    groupedRevenueYAxis: `Total ${numericMeasures.map((field) => fieldLabels[field] || field).join(" / ")}`,
                },
            }
            : null,
        includedRowCount,
        revenueRowsWithoutTenderId: tenderValueRowsWithoutTenderId,
        tenderValueRowsWithoutTenderId,
        revenueIsTenderDeduplicated: Boolean(tenderIdentifierField),
        totalGroupCount: outputRows.length,
    };
}

export {
    getBuilderFields,
    getMissingBuilderFields,
    getBuilderDisplayValue,
    createBuilderReportView,
};
