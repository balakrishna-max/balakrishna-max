import { useCallback, useEffect, useMemo, useState } from "react";
import ChartRenderer from "../ChartRenderer.jsx";
import DataTable from "../DataTable.jsx";
import {
    getFieldLabels,
    getFieldByNormalizedName,
    getRevenueDisplayConfig,
    getTenderValueLabel,
    isNumericLikeField,
    normalizeReportData,
    parseRevenueValue,
    transformChartData,
    getCurrentFinancialYearStartYear,
    formatFinancialYearLabel,
    filterDataByFinancialYears,
    getFinancialYearStartYear,
} from "../../utils/dashboardData.js";
import { getApiReportType } from "../../utils/dashboardConfig.js";

const REPORT_CATALOGUE = [
    {id: "current-fy-tenders", label: "Current FY Tenders", reportId: "tenders", chartType: "bar"},
    {id: "report-summary", label: "Report Summary", reportId: "td-ecv-summary", chartType: "bar"},
    {id: "departmentwise-tenders", label: "Departmentwise Tenders", reportId: "dw-tenders", chartType: "bar"},
    {id: "statuswise-tenders", label: "Statuswise Tenders", reportId: "tender-analysis", chartType: "pie"},
    {id: "categorywise-tenders", label: "Categorywise Tenders", reportId: "supplier-analysis", chartType: "pie"},
    {id: "monthly-tenders", label: "Monthly Tenders", reportId: "bid-analysis", chartType: "line"},
    {id: "current-fy-biddings", label: "Current FY Biddings", reportId: "payment", chartType: "bar"},
    {id: "auction-summary", label: "Auction Summary", reportId: "tender-analysis", chartType: "bar"},
    {id: "payments-summary", label: "Payments Summary", reportId: "payment", chartType: "bar"},
    {id: "awards-summary", label: "Awards Summary", reportId: "td-ecv-summary", chartType: "bar"},
];

const FIELD_TRANSFER_TYPE = "application/x-custom-report-field";
const COUNT_FIELD = "__customReportRecordCount";
const COMBINED_X_FIELD = "__customReportDimensions";
const MAX_CHART_CATEGORIES = 20;
const FIRST_FINANCIAL_YEAR = 2020;
const MAX_SERIES_CATEGORIES = 10;
const OTHER_SERIES_LABEL = "Other";
const MAIN_TENDER_CATEGORIES = ["Works", "Products", "Services"];
const BUILDER_FIELD_DEFINITIONS = [
    {
        id: "departmentName",
        label: "Department Name",
        aliases: ["departmentname", "sdepartmentname", "sdeptname", "mappingdepartmentname"],
    },
    {id: "ecv", label: "ECV", aliases: ["ecv", "estimatedcontractvalue"]},
    {id: "tenderType", label: "Tender Type", aliases: ["tendertype", "ntendertype"]},
    {id: "tenderStatus", label: "Tender Status", aliases: ["tenderstatus", "status"]},
    {id: "tenderCategory", label: "Tender Category", aliases: ["tendercategory", "ntendercategory"]},
    {id: "tenderSubject", label: "Tender Subject", aliases: ["tendersubject", "nameofwork", "snameofwork"]},
    {id: "financialYear", label: "Fin Year", aliases: ["finyear", "sfinyear", "financialyear"]},
    {id: "month", label: "Month", aliases: ["month", "smonth"]},
    {id: "estimatedCost", label: "Estimated Cost", aliases: ["estimatedcost"]},
];

function getPreferredField(fields, pattern) {
    return fields.find((field) => pattern.test(field)) || "";
}

function getBuilderFields(data) {
    if (!data || !Array.isArray(data.fields)) {
        return [];
    }

    return BUILDER_FIELD_DEFINITIONS.flatMap((definition) => {
        const field = definition.aliases
            .map((alias) => getFieldByNormalizedName(data.fields, alias))
            .find(Boolean);

        return field
            ? [{
                ...definition,
                field,
                isNumeric: ["ecv", "estimatedCost"].includes(definition.id) &&
                    isNumericLikeField(data, field),
            }]
            : [];
    });
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

    return first.localeCompare(second);
}

function getBuilderSeriesValues(data, definition) {
    if (definition.id === "tenderCategory") {
        return MAIN_TENDER_CATEGORIES;
    }

    const counts = new Map();
    data.rows.forEach((row) => {
        const value = getBuilderDisplayValue(definition.field, row[definition.field]);
        counts.set(value, (counts.get(value) || 0) + 1);
    });
    const values = [...counts.keys()].sort((first, second) =>
        compareBuilderSeriesValues(definition, first, second)
    );

    if (values.length <= MAX_SERIES_CATEGORIES) {
        return values;
    }

    const topValues = [...counts.entries()]
        .sort(([firstLabel, firstCount], [secondLabel, secondCount]) =>
            secondCount - firstCount ||
            compareBuilderSeriesValues(definition, firstLabel, secondLabel)
        )
        .slice(0, MAX_SERIES_CATEGORIES - 1)
        .map(([value]) => value);

    return [...topValues, OTHER_SERIES_LABEL];
}

function createBuilderReportView(data, xFields, yFields, builderFields, fieldLabels, revenueDisplayConfig) {
    if (!data || xFields.length === 0 || yFields.length === 0) {
        return null;
    }

    const definitionsByField = new Map(builderFields.map((definition) => [definition.field, definition]));
    const numericMeasures = yFields.filter((field) => definitionsByField.get(field)?.isNumeric);
    const seriesDefinition = yFields
        .map((field) => definitionsByField.get(field))
        .find((definition) => definition && !definition.isNumeric);
    const seriesValues = seriesDefinition
        ? getBuilderSeriesValues(data, seriesDefinition)
        : [];
    const series = seriesDefinition
        ? seriesValues.flatMap((value, valueIndex) => {
            const measures = numericMeasures.length > 0
                ? numericMeasures
                : [null];

            return measures.map((measure) => ({
                key: measure
                    ? `__aggregated_${measure}_${valueIndex}`
                    : `${COUNT_FIELD}_${valueIndex}`,
                label: measure
                    ? `${value} — ${fieldLabels[measure] || measure}`
                    : value,
                value,
                measure,
                isCount: !measure,
            }));
        })
        : numericMeasures.map((field) => ({
            key: field,
            label: fieldLabels[field] || field,
            measure: field,
            isCount: false,
        }));

    if (series.length === 0) {
        return null;
    }

    const categoryLabels = new Set(MAIN_TENDER_CATEGORIES.map((category) => category.toLowerCase()));
    const knownSeriesValues = new Set(seriesValues.filter((value) => value !== OTHER_SERIES_LABEL));
    const groupMap = new Map();
    let includedRowCount = 0;
    let excludedCategoryRowCount = 0;

    data.rows.forEach((row) => {
        const dimensionValues = xFields.map((field) => getBuilderDisplayValue(field, row[field]));
        let seriesValue = seriesDefinition
            ? getBuilderDisplayValue(seriesDefinition.field, row[seriesDefinition.field])
            : "";

        if (seriesDefinition?.id === "tenderCategory") {
            if (!categoryLabels.has(seriesValue.toLowerCase())) {
                excludedCategoryRowCount += 1;
                return;
            }
        } else if (seriesDefinition && !knownSeriesValues.has(seriesValue)) {
            seriesValue = OTHER_SERIES_LABEL;
        }

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
                const amount = parseRevenueValue(row[measure]);

                if (item && amount !== null) {
                    group.totals[item.key] += amount;
                }
            });
            return;
        }

        numericMeasures.forEach((measure) => {
            const amount = parseRevenueValue(row[measure]);

            if (amount !== null) {
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
            series.filter(({measure}) => measure && revenueDisplayConfig[measure])
                .map(({key, measure}) => [key, revenueDisplayConfig[measure]])
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
    if (chartData.data.length > MAX_CHART_CATEGORIES) {
        chartData.data = hasTemporalXAxis
            ? chartData.data.slice(0, MAX_CHART_CATEGORIES)
            : chartData.data
                .map((item) => ({
                    item,
                    total: series.reduce((sum, {key}) =>
                        sum + Math.abs(Number(item[key]) || 0), 0
                    ),
                }))
                .sort((first, second) => second.total - first.total)
                .slice(0, MAX_CHART_CATEGORIES)
                .map(({item}) => item);
    }

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
        excludedCategoryRowCount,
        totalGroupCount: outputRows.length,
    };
}

function requireNormalizedReportData(result, reportLabel) {
    const normalizedData = normalizeReportData(result);

    if (!normalizedData) {
        throw new Error(`The "${reportLabel}" report returned invalid data.`);
    }

    return normalizedData;
}

function createChartView(data, chartType, fieldLabels, revenueDisplayConfig) {
    if (!data || data.rows.length === 0 || data.fields.length === 0) {
        return null;
    }

    const xField = getPreferredField(
        data.fields,
        /department|status|category|month|financial.?year|date|type/i
    ) || data.fields.find((field) => data.columnTypes[field] !== "number") ||
        data.fields[0];
    const numericFields = data.fields.filter(
        (field) => data.columnTypes[field] === "number"
    );
    const yField = getPreferredField(
        numericFields,
        /count|total|amount|value|revenue|ecv|bid|payment|award/i
    ) || numericFields[0];
    const labels = fieldLabels || getFieldLabels(data.fields);

    if (!yField) {
        const counts = new Map();

        for (const row of data.rows) {
            const value = row[xField];

            if (value === null || value === undefined || String(value).trim() === "") {
                continue;
            }

            const label = String(value);
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const chartRows = [...counts.entries()]
            .sort((first, second) => second[1] - first[1])
            .slice(0, MAX_CHART_CATEGORIES)
            .map(([x, y]) => ({x, y}));

        if (chartRows.length === 0) {
            return null;
        }

        return {
            chartType,
            chartData: {
                data: chartRows,
                xAxis: {field: xField, label: labels[xField] || xField, type: "text", dataType: "STRING"},
                yAxis: {field: COUNT_FIELD, label: "Record Count", type: "number", dataType: "INTEGER"},
                yAxes: [{field: COUNT_FIELD, label: "Record Count", type: "number", dataType: "INTEGER"}],
            },
        };
    }

    const totalsByCategory = new Map();
    data.rows.forEach((row) => {
        const category = getBuilderDisplayValue(xField, row[xField]);
        const value = parseRevenueValue(row[yField]);

        if (value !== null) {
            totalsByCategory.set(category, (totalsByCategory.get(category) || 0) + value);
        }
    });
    const aggregatedRows = [...totalsByCategory.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, MAX_CHART_CATEGORIES)
        .map(([category, value]) => ({[xField]: category, [yField]: value}));
    const chartData = transformChartData({
        rows: aggregatedRows,
        xAxisField: xField,
        yAxisField: yField,
        columnTypes: data.columnTypes,
        dataTypes: data.dataTypes,
        fieldLabels: labels,
        revenueDisplayConfig: revenueDisplayConfig || {},
    });

    return chartData.data.length > 0 ? {chartType, chartData} : null;
}

function CustomReportBuilder({ onBack, loadReport }) {
    const currentFinancialYear = getCurrentFinancialYearStartYear();
    const [rawData, setRawData] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [dataError, setDataError] = useState(null);
    const [fromFinancialYear, setFromFinancialYear] = useState(currentFinancialYear);
    const [toFinancialYear, setToFinancialYear] = useState(currentFinancialYear);
    const [selectedFields, setSelectedFields] = useState([]);
    const [selectedXFields, setSelectedXFields] = useState([]);
    const [selectedYFields, setSelectedYFields] = useState([]);
    const [selectedCatalogueIds, setSelectedCatalogueIds] = useState([]);
    const [catalogueData, setCatalogueData] = useState({});
    const [catalogueLoading, setCatalogueLoading] = useState({});
    const [catalogueErrors, setCatalogueErrors] = useState({});
    const builderFields = useMemo(() => getBuilderFields(rawData), [rawData]);
    const builderFieldByName = useMemo(
        () => new Map(builderFields.map((definition) => [definition.field, definition])),
        [builderFields]
    );
    const fieldLabels = useMemo(() => {
        if (!rawData) {
            return {};
        }

        return {
            ...getFieldLabels(rawData.fields),
            ...Object.fromEntries(builderFields.map(({field, label}) => [field, label])),
        };
    }, [builderFields, rawData]);
    const unavailableBuilderFields = useMemo(() => {
        const availableIds = new Set(builderFields.map(({id}) => id));
        return BUILDER_FIELD_DEFINITIONS.filter(({id}) => !availableIds.has(id));
    }, [builderFieldByName]);

    useEffect(() => {
        let isCancelled = false;

        loadReport("card-11")
            .then((result) => {
                if (!isCancelled) {
                    const normalizedData = requireNormalizedReportData(result, "dw");
                    const availableFields = getBuilderFields(normalizedData);
                    const defaultXField = availableFields.find(
                        ({id}) => id === "departmentName"
                    )?.field;
                    const defaultYField = availableFields.find(
                        ({id}) => id === "tenderCategory"
                    )?.field;

                    setRawData(normalizedData);
                    setSelectedFields([defaultXField, defaultYField].filter(Boolean));
                    setSelectedXFields(defaultXField ? [defaultXField] : []);
                    setSelectedYFields(defaultYField ? [defaultYField] : []);
                }
            })
            .catch((error) => {
                console.error("Failed to load raw custom report data:", error);

                if (!isCancelled) {
                    setDataError(error);
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsDataLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [loadReport]);

    const financialYearOptions = useMemo(
        () => Array.from(
            {length: Math.max(0, currentFinancialYear - FIRST_FINANCIAL_YEAR + 1)},
            (_, index) => FIRST_FINANCIAL_YEAR + index
        ),
        [currentFinancialYear]
    );
    const toFinancialYearOptions = useMemo(
        () => financialYearOptions.filter((year) => year >= fromFinancialYear),
        [financialYearOptions, fromFinancialYear]
    );
    const fromFinancialYearOptions = useMemo(
        () => financialYearOptions.filter((year) => year <= toFinancialYear),
        [financialYearOptions, toFinancialYear]
    );
    const filteredRawDataResult = useMemo(
        () => filterDataByFinancialYears(rawData, fromFinancialYear, toFinancialYear),
        [fromFinancialYear, rawData, toFinancialYear]
    );
    const filteredRawData = filteredRawDataResult.data;
    const revenueDisplayConfig = useMemo(
        () => rawData ? getRevenueDisplayConfig(rawData) : {},
        [rawData]
    );
    const builderView = useMemo(
        () => createBuilderReportView(
            filteredRawData,
            selectedXFields,
            selectedYFields,
            builderFields,
            fieldLabels,
            revenueDisplayConfig
        ),
        [builderFields, fieldLabels, filteredRawData, revenueDisplayConfig, selectedXFields, selectedYFields]
    );

    const removeField = useCallback((field) => {
        setSelectedFields((currentFields) => currentFields.filter((item) => item !== field));
        setSelectedXFields((currentFields) => currentFields.filter((item) => item !== field));
        setSelectedYFields((currentFields) => currentFields.filter((item) => item !== field));
    }, []);

    const addField = useCallback((field) => {
        const definition = builderFieldByName.get(field);

        if (!definition) {
            return;
        }

        setSelectedFields((currentFields) =>
            currentFields.includes(field) ? currentFields : [...currentFields, field]
        );
        const updateFields = definition.isNumeric ? setSelectedYFields : setSelectedXFields;
        updateFields((currentFields) => currentFields.includes(field)
            ? currentFields
            : [...currentFields, field]
        );
    }, [builderFields]);

    const toggleAxis = useCallback((axis, field) => {
        const definition = builderFieldByName.get(field);

        if (!definition || (axis === "x" && definition.isNumeric)) {
            return;
        }

        if (axis === "x") {
            setSelectedXFields((currentFields) => currentFields.includes(field)
                ? currentFields.filter((item) => item !== field)
                : [...currentFields, field]
            );
            if (!definition.isNumeric) {
                setSelectedYFields((currentFields) => currentFields.filter((item) => item !== field));
            }
            return;
        }

        const isSelectedAsSeries = selectedYFields.includes(field);
        if (!definition.isNumeric && selectedYFields.some((item) =>
            item !== field && !builderFieldByName.get(item)?.isNumeric
        )) {
            return;
        }

        setSelectedYFields((currentFields) => isSelectedAsSeries
            ? currentFields.filter((item) => item !== field)
            : [...currentFields, field]
        );
        if (!definition.isNumeric && !isSelectedAsSeries) {
            setSelectedXFields((currentFields) => currentFields.filter((item) => item !== field));
        }
    }, [builderFieldByName, selectedYFields]);

    const handleFromFinancialYearChange = (event) => {
        const nextYear = Number(event.target.value);
        setFromFinancialYear(nextYear);

        if (toFinancialYear < nextYear) {
            setToFinancialYear(nextYear);
        }
    };

    const handleFieldDrop = useCallback((event) => {
        event.preventDefault();
        const field = event.dataTransfer.getData(FIELD_TRANSFER_TYPE) ||
            event.dataTransfer.getData("text/plain");
        addField(field);
    }, [addField]);

    const toggleCatalogueItem = useCallback((item) => {
        const isSelected = selectedCatalogueIds.includes(item.id);

        if (isSelected) {
            setSelectedCatalogueIds((currentIds) =>
                currentIds.filter((id) => id !== item.id)
            );
            return;
        }

        setSelectedCatalogueIds((currentIds) => [...currentIds, item.id]);

        if (catalogueData[item.id] || catalogueLoading[item.id]) {
            return;
        }

        setCatalogueLoading((current) => ({...current, [item.id]: true}));
        setCatalogueErrors((current) => ({...current, [item.id]: null}));
        loadReport(item.reportId)
            .then((result) => {
                setCatalogueData((current) => ({
                    ...current,
                    [item.id]: requireNormalizedReportData(result, item.label),
                }));
            })
            .catch((error) => {
                console.error(`Failed to load catalogue report "${item.label}":`, error);
                setCatalogueErrors((current) => ({...current, [item.id]: error}));
            })
            .finally(() => {
                setCatalogueLoading((current) => ({...current, [item.id]: false}));
            });
    }, [catalogueData, catalogueLoading, loadReport, selectedCatalogueIds]);

    return (
        <main className="custom-report-builder">
            <section className="custom-report-builder-panel custom-report-builder-financial-year" aria-labelledby="custom-report-financial-year-title">
                <h2 id="custom-report-financial-year-title">Financial Year</h2>
                <label>
                    <span>From</span>
                    <select
                        aria-label="Financial year from"
                        value={fromFinancialYear}
                        onChange={handleFromFinancialYearChange}
                    >
                        {fromFinancialYearOptions.map((year) => (
                            <option key={year} value={year}>{formatFinancialYearLabel(year)}</option>
                        ))}
                    </select>
                </label>
                <span className="custom-report-builder-financial-year-to" aria-hidden="true">to</span>
                <label>
                    <span>To</span>
                    <select
                        aria-label="Financial year to"
                        value={toFinancialYear}
                        onChange={(event) => setToFinancialYear(Number(event.target.value))}
                    >
                        {toFinancialYearOptions.map((year) => (
                            <option key={year} value={year}>{formatFinancialYearLabel(year)}</option>
                        ))}
                    </select>
                </label>
            </section>

            <aside className="custom-report-builder-sidebar" aria-label="Custom report builder options">
                <section className="custom-report-builder-side-card" aria-labelledby="custom-report-fields-title">
                    <header className="custom-report-builder-side-header">
                        <div>
                            <h2 id="custom-report-fields-title">Data Fields</h2>
                        </div>
                        <span className="custom-report-builder-count">
                            {builderFields.length}
                        </span>
                    </header>

                    {isDataLoading && <p className="custom-report-builder-message">Loading data fields…</p>}
                    {dataError && (
                        <p className="custom-report-builder-message custom-report-builder-error" role="alert">
                            {dataError.message || "The raw report data could not be loaded."}
                        </p>
                    )}
                    {!isDataLoading && !dataError && rawData && builderFields.length === 0 && (
                        <p className="custom-report-builder-message">None of the supported report fields were returned.</p>
                    )}
                    {!isDataLoading && rawData && builderFields.length > 0 && (
                        <>
                            {unavailableBuilderFields.length > 0 && (
                                <p className="custom-report-builder-message custom-report-builder-field-notice">
                                    Not returned by this API: {unavailableBuilderFields.map(({label}) => label).join(", ")}.
                                </p>
                            )}
                            <div className="custom-report-builder-field-list" aria-label="Available data fields">
                                {builderFields.map(({field, isNumeric, label}) => (
                                    <button
                                        className="custom-report-builder-field-chip"
                                        type="button"
                                        key={field}
                                        draggable
                                        title="Drag or click to add this field to your chart"
                                        onDragStart={(event) => {
                                            event.dataTransfer.setData(FIELD_TRANSFER_TYPE, field);
                                            event.dataTransfer.setData("text/plain", field);
                                            event.dataTransfer.effectAllowed = "copy";
                                        }}
                                        onClick={() => addField(field)}
                                    >
                                        <span>{label}</span>
                                        <span className="custom-report-builder-field-type">
                                            {isNumeric ? "123" : "Aa"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                <section className="custom-report-builder-side-card" aria-labelledby="custom-report-catalogue-title">
                    <header className="custom-report-builder-side-header">
                        <div>
                            <h2 id="custom-report-catalogue-title">Report Catalogue</h2>
                        </div>
                        <span className="custom-report-builder-count">{selectedCatalogueIds.length}</span>
                    </header>
                    <div className="custom-report-builder-catalogue-list" aria-label="Report catalogue">
                        {REPORT_CATALOGUE.map((item) => {
                            const isSelected = selectedCatalogueIds.includes(item.id);

                            return (
                                <label className="custom-report-builder-catalogue-option" key={item.id}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleCatalogueItem(item)}
                                    />
                                    <span>{item.label}</span>
                                    {catalogueLoading[item.id] && (
                                        <span className="custom-report-builder-option-status">Loading</span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </section>
            </aside>

            <section className="custom-report-builder-content" aria-label="Custom report workspace">
                <header className="custom-report-builder-page-header">
                    <div>
                        <h1>Custom Report Builder</h1>
                        <p>Arrange fields, build a chart, and explore report catalogue views.</p>
                    </div>
                    <button className="custom-report-builder-back" type="button" onClick={onBack}>
                        Back to reports
                    </button>
                </header>

                {rawData && !filteredRawDataResult.isFilterable && (
                    <p className="custom-report-builder-filter-notice" role="status">
                        No Financial Year or date field was returned, so the selected year range cannot filter these records.
                    </p>
                )}

                <section className="custom-report-builder-panel" aria-labelledby="custom-report-chart-builder-title">
                    <header className="custom-report-builder-panel-header">
                        <div>
                            <h2 id="custom-report-chart-builder-title">Build your Chart</h2>
                            <p className="custom-report-builder-builder-hint">
                                Choose X-axis dimensions and Y-axis totals or one categorical breakdown.
                            </p>
                        </div>
                        <span className="custom-report-builder-selected-count">
                            {selectedFields.length} selected
                        </span>
                    </header>
                    <div
                        className="custom-report-builder-selected-fields"
                        aria-label="Selected chart fields"
                        onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={handleFieldDrop}
                    >
                        {selectedFields.length > 0 ? selectedFields.map((field) => {
                            const definition = builderFields.find((item) => item.field === field);
                            const isNumeric = definition?.isNumeric || false;
                            const isXSelected = selectedXFields.includes(field);
                            const isYSelected = selectedYFields.includes(field);
                            const hasAnotherCategoricalY = !isNumeric &&
                                selectedYFields.some((item) =>
                                    item !== field && !builderFieldByName.get(item)?.isNumeric
                                );

                            return (
                                <span className="custom-report-builder-selected-chip-wrap" key={field}>
                                    <span className="custom-report-builder-selected-chip">
                                        <span className="custom-report-builder-selected-label">
                                            {fieldLabels[field] || field}
                                        </span>
                                        <span className="custom-report-builder-axis-toggles" aria-label={`Axes for ${fieldLabels[field] || field}`}>
                                            <button
                                                className={isXSelected ? "custom-report-builder-axis-toggle is-selected" : "custom-report-builder-axis-toggle"}
                                                type="button"
                                                aria-pressed={isXSelected}
                                                aria-label={`${isXSelected ? "Remove from" : "Add to"} X axis`}
                                                disabled={isNumeric || isYSelected}
                                                onClick={() => toggleAxis("x", field)}
                                            >
                                                X
                                            </button>
                                            <button
                                                className={isYSelected ? "custom-report-builder-axis-toggle is-selected" : "custom-report-builder-axis-toggle"}
                                                type="button"
                                                aria-pressed={isYSelected}
                                                aria-label={`${isYSelected ? "Remove from" : "Add to"} Y axis${!isNumeric ? " as a breakdown" : ""}`}
                                                title={hasAnotherCategoricalY && !isYSelected
                                                    ? "Only one categorical Y-axis breakdown can be selected at a time"
                                                    : !isNumeric && isXSelected ? "Adds this field as the Y-axis breakdown" : ""}
                                                disabled={!isNumeric && hasAnotherCategoricalY && !isYSelected}
                                                onClick={() => toggleAxis("y", field)}
                                            >
                                                Y
                                            </button>
                                        </span>
                                    </span>
                                    <button
                                        className="custom-report-builder-remove-badge"
                                        type="button"
                                        aria-label={`Remove ${fieldLabels[field] || field} from selected fields`}
                                        onClick={() => removeField(field)}
                                    >
                                        −
                                    </button>
                                </span>
                            );
                        }) : (
                            <p className="custom-report-builder-drop-hint">
                                Drag data field chips here, or click a field in the sidebar.
                            </p>
                        )}
                    </div>
                </section>

                <section className="custom-report-builder-panel" aria-labelledby="custom-report-chart-title">
                    <header className="custom-report-builder-panel-header">
                        <div>
                            <h2 id="custom-report-chart-title">Chart</h2>
                        </div>
                    </header>
                    <div className="custom-report-builder-main-chart">
                        {builderView?.chart ? (
                            <ChartRenderer
                                chartData={builderView.chart.chartData}
                                chartType={builderView.chart.chartType}
                                chartTitles={builderView.chart.chartTitles}
                                richChart
                            />
                        ) : (
                            <p className="custom-report-builder-empty">
                                {builderView?.includedRowCount === 0
                                    ? "No rows match the selected category or FY range."
                                    : filteredRawData?.rows.length === 0
                                    ? `No records found for ${formatFinancialYearLabel(fromFinancialYear)} to ${formatFinancialYearLabel(toFinancialYear)}.`
                                    : "Select at least one X-axis field and one Y-axis field to build an aggregated chart."}
                            </p>
                        )}
                    </div>
                    {builderView && builderView.totalGroupCount > MAX_CHART_CATEGORIES && (
                        <p className="custom-report-builder-builder-hint">
                            Chart shows up to {MAX_CHART_CATEGORIES} groups; the table below includes all {builderView.totalGroupCount.toLocaleString("en-IN")} groups.
                        </p>
                    )}
                </section>

                <section className="custom-report-builder-panel" aria-labelledby="custom-report-table-title">
                    <header className="custom-report-builder-panel-header">
                        <div>
                            <h2 id="custom-report-table-title">Data Table</h2>
                            {builderView && (
                                <p className="custom-report-builder-builder-hint">
                                    {builderView.includedRowCount.toLocaleString("en-IN")} source rows aggregated into {builderView.data.rows.length.toLocaleString("en-IN")} groups.
                                </p>
                            )}
                        </div>
                        {builderView && (
                            <span className="custom-report-builder-selected-count">
                                {builderView.data.rows.length.toLocaleString("en-IN")} groups
                            </span>
                        )}
                    </header>
                    {builderView?.excludedCategoryRowCount > 0 && (
                        <p className="custom-report-builder-filter-notice" role="status">
                            {builderView.excludedCategoryRowCount.toLocaleString("en-IN")} source rows outside Works, Products, and Services are excluded from this category view.
                        </p>
                    )}
                    <div className="custom-report-builder-table">
                        {builderView && builderView.data.rows.length > 0 ? (
                            <DataTable
                                data={builderView.data}
                                revenueDisplayConfig={builderView.revenueDisplayConfig}
                                columnTypes={builderView.data.columnTypes}
                                dataTypes={builderView.data.dataTypes}
                                fieldLabels={builderView.fieldLabels}
                                visibleFields={builderView.data.fields}
                            />
                        ) : (
                            <p className="custom-report-builder-empty">
                                {builderView?.includedRowCount === 0
                                    ? "No rows match the selected category or FY range."
                                    : rawData && filteredRawData?.rows.length === 0
                                    ? `No records found for ${formatFinancialYearLabel(fromFinancialYear)} to ${formatFinancialYearLabel(toFinancialYear)}.`
                                    : "Add an X-axis dimension and at least one Y-axis total or categorical breakdown to see aggregated results."}
                            </p>
                        )}
                    </div>
                </section>

                {selectedCatalogueIds.length > 0 && (
                    <section className="custom-report-builder-panel" aria-labelledby="custom-report-catalogue-charts-title">
                        <header className="custom-report-builder-panel-header">
                            <div>
                                <p className="custom-report-builder-eyebrow">Selected catalogue reports</p>
                                <h2 id="custom-report-catalogue-charts-title">Report Catalogue Charts</h2>
                            </div>
                        </header>
                        <div className="custom-report-builder-chart-grid">
                            {REPORT_CATALOGUE.filter((item) => selectedCatalogueIds.includes(item.id)).map((item) => {
                                const reportData = catalogueData[item.id];
                                const filteredCatalogueResult = filterDataByFinancialYears(
                                    reportData,
                                    fromFinancialYear,
                                    toFinancialYear
                                );
                                const filteredCatalogueData = filteredCatalogueResult.data;
                                const labels = reportData ? getFieldLabels(reportData.fields) : {};
                                const chart = createChartView(
                                    filteredCatalogueData,
                                    item.chartType,
                                    labels,
                                    reportData ? getRevenueDisplayConfig(reportData) : {}
                                );

                                return (
                                    <article className="custom-report-builder-catalogue-chart" key={item.id}>
                                        <header>
                                            <h3>{item.label}</h3>
                                            <span>{getApiReportType(item.reportId)}</span>
                                        </header>
                                        {catalogueLoading[item.id] && (
                                            <p className="custom-report-builder-message">Loading report data…</p>
                                        )}
                                        {catalogueErrors[item.id] && (
                                            <p className="custom-report-builder-message custom-report-builder-error" role="alert">
                                                {catalogueErrors[item.id].message || "This catalogue report could not be loaded."}
                                            </p>
                                        )}
                                        {!catalogueLoading[item.id] && !catalogueErrors[item.id] && chart && (
                                            <div className="custom-report-builder-catalogue-plot">
                                                <ChartRenderer
                                                    chartData={chart.chartData}
                                                    chartType={chart.chartType}
                                                    richChart
                                                />
                                            </div>
                                        )}
                                        {!catalogueLoading[item.id] && !catalogueErrors[item.id] && reportData && !chart && (
                                            <p className="custom-report-builder-message">
                                                {filteredCatalogueResult.isFilterable
                                                    ? `No chartable records found for ${formatFinancialYearLabel(fromFinancialYear)} to ${formatFinancialYearLabel(toFinancialYear)}.`
                                                    : "This report has no chartable records."}
                                            </p>
                                        )}
                                        {reportData && !filteredCatalogueResult.isFilterable && (
                                            <p className="custom-report-builder-message">
                                                No financial year or date field was returned; this chart is unfiltered.
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}
            </section>
        </main>
    );
}

export default CustomReportBuilder;
