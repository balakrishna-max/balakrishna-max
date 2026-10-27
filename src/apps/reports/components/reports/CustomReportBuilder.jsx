import { useCallback, useEffect, useMemo, useState } from "react";
import ChartRenderer from "../ChartRenderer.jsx";
import DataTable from "../DataTable.jsx";
import {
    getFieldLabels,
    getRevenueDisplayConfig,
    normalizeReportData,
    parseRevenueValue,
    transformChartData,
    getCurrentFinancialYearStartYear,
    formatFinancialYearLabel,
    filterDataByFinancialYears,
} from "../../utils/dashboardData.js";
import { getApiReportType } from "../../utils/dashboardConfig.js";
import {
    createBuilderReportView,
    getBuilderFields,
    getBuilderDisplayValue,
    getMissingBuilderFields,
} from "../../utils/customReportBuilderData.js";

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
const FIRST_FINANCIAL_YEAR = 2020;

function getPreferredField(fields, pattern) {
    return fields.find((field) => pattern.test(field)) || "";
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
            const label = getBuilderDisplayValue(xField, row[xField]);
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const chartRows = [...counts.entries()]
            .sort((first, second) => second[1] - first[1])
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
    const unavailableBuilderFields = getMissingBuilderFields(builderFields);

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
                    const defaultMeasureField = availableFields.find(
                        ({id, isNumeric, isAvailable}) =>
                            id === "ecv" && isNumeric && isAvailable
                    )?.field;

                    setRawData(normalizedData);
                    setSelectedFields(
                        [defaultXField, defaultMeasureField].filter(Boolean)
                    );
                    setSelectedXFields(defaultXField ? [defaultXField] : []);
                    setSelectedYFields(defaultMeasureField ? [defaultMeasureField] : []);
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
    }, [builderFieldByName, builderFields, selectedFields]);

    const addField = useCallback((field) => {
        const definition = builderFieldByName.get(field);

        if (!definition?.isAvailable || selectedFields.includes(field)) {
            return;
        }

        setSelectedFields((currentFields) => [...currentFields, field]);
        if (definition.isNumeric) {
            setSelectedYFields([field]);
            return;
        }

        setSelectedXFields((currentFields) => currentFields.includes(field)
            ? currentFields
            : [...currentFields, field]
        );
    }, [builderFieldByName]);

    const toggleAxis = useCallback((axis, field) => {
        const definition = builderFieldByName.get(field);

        if (!definition?.isAvailable || (axis === "x" && definition.isNumeric)) {
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
        if (definition.isNumeric) {
            setSelectedYFields((currentFields) => isSelectedAsSeries
                ? currentFields.filter((item) => item !== field)
                : [field]
            );
            return;
        }

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
    }, [builderFieldByName, builderFields, selectedYFields]);

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
                            {builderFields.length + unavailableBuilderFields.length}
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
                            {(unavailableBuilderFields.length > 0 ||
                                !builderFieldByName.get("__customReportRevenue")?.isAvailable) && (
                                <p className="custom-report-builder-message custom-report-builder-field-notice">
                                    {unavailableBuilderFields.length > 0 && (
                                        <>Not returned by this API: {unavailableBuilderFields.map(({label}) => label).join(", ")}.</>
                                    )}
                                    {!builderFieldByName.get("__customReportRevenue")?.isAvailable && (
                                        <> Revenue is disabled because this API response does not contain a numeric ECV field.</>
                                    )}
                                </p>
                            )}
                            <div className="custom-report-builder-field-list" aria-label="Available data fields">
                                {builderFields.map(({field, isAvailable, isNumeric, label, sourceField}) => (
                                    <button
                                        className={isAvailable
                                            ? "custom-report-builder-field-chip"
                                            : "custom-report-builder-field-chip is-unavailable"}
                                        type="button"
                                        key={field}
                                        draggable={isAvailable}
                                        disabled={!isAvailable}
                                        title={!isAvailable
                                            ? "Unavailable: no numeric ECV field was returned by the API"
                                            : isNumeric
                                                ? `Numeric Y-axis measure (API field: ${sourceField})`
                                                : `Categorical/date X-axis dimension or Y-axis breakdown (API field: ${sourceField})`}
                                        onDragStart={(event) => {
                                            if (!isAvailable) {
                                                return;
                                            }
                                            event.dataTransfer.setData(FIELD_TRANSFER_TYPE, field);
                                            event.dataTransfer.setData("text/plain", field);
                                            event.dataTransfer.effectAllowed = "copy";
                                        }}
                                        onClick={() => addField(field)}
                                    >
                                        <span>{label}</span>
                                        <span className="custom-report-builder-field-type">
                                            {!isAvailable ? "Unavailable" : isNumeric ? "123" : "Aa"}
                                        </span>
                                    </button>
                                ))}
                                {unavailableBuilderFields.map(({id, label}) => (
                                    <button
                                        className="custom-report-builder-field-chip is-unavailable"
                                        type="button"
                                        key={`unavailable-${id}`}
                                        disabled
                                        title={`${label} was not returned by the API`}
                                    >
                                        <span>{label}</span>
                                        <span className="custom-report-builder-field-type">Unavailable</span>
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
                                Select/Drag your fields to plot the chart
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
                                fillAvailableSpace
                            />
                        ) : (
                            <p className="custom-report-builder-empty">
                                {builderView?.includedRowCount === 0
                                    ? "No rows match the selected financial year range."
                                    : filteredRawData?.rows.length === 0
                                    ? `No records found for ${formatFinancialYearLabel(fromFinancialYear)} to ${formatFinancialYearLabel(toFinancialYear)}.`
                                    : "Select at least one X-axis field and one Y-axis field to build an aggregated chart."}
                            </p>
                        )}
                    </div>
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
                    {builderView?.tenderValueRowsWithoutTenderId > 0 &&
                        selectedYFields.some((field) =>
                            ["ecv", "revenue"].includes(builderFieldByName.get(field)?.id)
                        ) && (
                            <p className="custom-report-builder-filter-notice" role="status">
                                {builderView.tenderValueRowsWithoutTenderId.toLocaleString("en-IN")} source rows with ECV have no Tender ID, so those values are summed per row.
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
                                    ? "No rows match the selected financial year range."
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
