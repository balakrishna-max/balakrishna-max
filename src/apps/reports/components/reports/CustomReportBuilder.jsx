import { useCallback, useEffect, useMemo, useState } from "react";
import ChartRenderer from "../ChartRenderer.jsx";
import DataTable from "../DataTable.jsx";
import {
    getFieldLabels,
    getRevenueDisplayConfig,
    normalizeReportData,
    transformChartData,
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
const MAX_CHART_CATEGORIES = 20;

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

    const chartData = transformChartData({
        rows: data.rows,
        xAxisField: xField,
        yAxisField: yField,
        columnTypes: data.columnTypes,
        dataTypes: data.dataTypes,
        fieldLabels: labels,
        revenueDisplayConfig: revenueDisplayConfig || {},
    });

    return chartData.data.length > 0 ? {chartType, chartData} : null;
}

function createBuilderChart(data, xFields, yFields, fieldLabels, revenueDisplayConfig) {
    if (!data || xFields.length === 0 || yFields.length === 0) {
        return null;
    }

    const axisLabel = xFields.map((field) => fieldLabels[field] || field).join(" / ");
    const chartRows = xFields.length === 1
        ? data.rows
        : data.rows.map((row) => ({
            ...row,
            [COUNT_FIELD]: xFields
                .map((field) => String(row[field] ?? ""))
                .join(" / "),
        }));
    const chartSource = xFields.length === 1
        ? data
        : {
            ...data,
            fields: [...data.fields, COUNT_FIELD],
            rows: chartRows,
            columnTypes: {...data.columnTypes, [COUNT_FIELD]: "text"},
            dataTypes: {...data.dataTypes, [COUNT_FIELD]: "STRING"},
        };
    const xAxisField = xFields.length === 1 ? xFields[0] : COUNT_FIELD;
    const chartLabels = xFields.length === 1
        ? fieldLabels
        : {...fieldLabels, [COUNT_FIELD]: axisLabel};
    const chartData = transformChartData({
        rows: chartSource.rows,
        xAxisField,
        yAxisField: yFields[0],
        yAxisFields: yFields.length > 1 ? yFields : [],
        columnTypes: chartSource.columnTypes,
        dataTypes: chartSource.dataTypes,
        fieldLabels: chartLabels,
        revenueDisplayConfig: revenueDisplayConfig || {},
    });

    return chartData.data.length > 0
        ? {chartData, chartType: yFields.length > 1 ? "grouped-bar" : "bar"}
        : null;
}

function CustomReportBuilder({ onBack, loadReport }) {
    const [rawData, setRawData] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [dataError, setDataError] = useState(null);
    const [selectedFields, setSelectedFields] = useState([]);
    const [selectedXFields, setSelectedXFields] = useState([]);
    const [selectedYFields, setSelectedYFields] = useState([]);
    const [selectedCatalogueIds, setSelectedCatalogueIds] = useState([]);
    const [catalogueData, setCatalogueData] = useState({});
    const [catalogueLoading, setCatalogueLoading] = useState({});
    const [catalogueErrors, setCatalogueErrors] = useState({});

    useEffect(() => {
        let isCancelled = false;

        loadReport("card-11")
            .then((result) => {
                if (!isCancelled) {
                    const normalizedData = requireNormalizedReportData(result, "dw");
                    const defaultXField = normalizedData.fields.find(
                        (field) => normalizedData.columnTypes[field] !== "number"
                    );
                    const defaultYField = normalizedData.fields.find(
                        (field) => normalizedData.columnTypes[field] === "number"
                    );

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

    const fieldLabels = useMemo(
        () => rawData ? getFieldLabels(rawData.fields) : {},
        [rawData]
    );
    const revenueDisplayConfig = useMemo(
        () => rawData ? getRevenueDisplayConfig(rawData) : {},
        [rawData]
    );
    const builderChart = useMemo(
        () => createBuilderChart(
            rawData,
            selectedXFields,
            selectedYFields,
            fieldLabels,
            revenueDisplayConfig
        ),
        [fieldLabels, rawData, revenueDisplayConfig, selectedXFields, selectedYFields]
    );

    const removeField = useCallback((field) => {
        setSelectedFields((currentFields) => currentFields.filter((item) => item !== field));
        setSelectedXFields((currentFields) => currentFields.filter((item) => item !== field));
        setSelectedYFields((currentFields) => currentFields.filter((item) => item !== field));
    }, []);

    const addField = useCallback((field) => {
        if (!rawData?.fields.includes(field)) {
            return;
        }

        const canUseAsValue = rawData.columnTypes[field] === "number";
        setSelectedFields((currentFields) =>
            currentFields.includes(field) ? currentFields : [...currentFields, field]
        );
        const updateFields = canUseAsValue ? setSelectedYFields : setSelectedXFields;
        updateFields((currentFields) => currentFields.includes(field)
            ? currentFields
            : [...currentFields, field]
        );
    }, [rawData]);

    const toggleAxis = useCallback((axis, field) => {
        const updateFields = axis === "x" ? setSelectedXFields : setSelectedYFields;
        updateFields((currentFields) => currentFields.includes(field)
            ? currentFields.filter((item) => item !== field)
            : [...currentFields, field]
        );
    }, []);

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
            <aside className="custom-report-builder-sidebar" aria-label="Custom report builder options">
                <section className="custom-report-builder-side-card" aria-labelledby="custom-report-fields-title">
                    <header className="custom-report-builder-side-header">
                        <div>
                            <h2 id="custom-report-fields-title">Data Fields</h2>
                        </div>
                        <span className="custom-report-builder-count">
                            {rawData?.fields.length || 0}
                        </span>
                    </header>

                    {isDataLoading && <p className="custom-report-builder-message">Loading data fields…</p>}
                    {dataError && (
                        <p className="custom-report-builder-message custom-report-builder-error" role="alert">
                            {dataError.message || "The raw report data could not be loaded."}
                        </p>
                    )}
                    {!isDataLoading && !dataError && rawData?.fields.length === 0 && (
                        <p className="custom-report-builder-message">No data fields were returned.</p>
                    )}
                    {!isDataLoading && rawData?.fields.length > 0 && (
                        <div className="custom-report-builder-field-list" aria-label="Available data fields">
                            {rawData.fields.map((field) => {
                                const isNumeric = rawData.columnTypes[field] === "number";

                                return (
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
                                        <span>{fieldLabels[field] || field}</span>
                                        <span className="custom-report-builder-field-type">
                                            {isNumeric ? "123" : "Aa"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
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

                <section className="custom-report-builder-panel" aria-labelledby="custom-report-chart-builder-title">
                    <header className="custom-report-builder-panel-header">
                        <div>
                            <h2 id="custom-report-chart-builder-title">Build your Chart</h2>
                            <p className="custom-report-builder-builder-hint">
                                Add field chips, then toggle X or Y on each one.
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
                            const isNumeric = rawData?.columnTypes[field] === "number";
                            const isXSelected = selectedXFields.includes(field);
                            const isYSelected = selectedYFields.includes(field);

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
                                                onClick={() => toggleAxis("x", field)}
                                            >
                                                X
                                            </button>
                                            <button
                                                className={isYSelected ? "custom-report-builder-axis-toggle is-selected" : "custom-report-builder-axis-toggle"}
                                                type="button"
                                                aria-pressed={isYSelected}
                                                aria-label={`${isYSelected ? "Remove from" : "Add to"} Y axis`}
                                                disabled={!isNumeric}
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
                        {builderChart ? (
                            <ChartRenderer
                                chartData={builderChart.chartData}
                                chartType={builderChart.chartType}
                                richChart
                            />
                        ) : (
                            <p className="custom-report-builder-empty">
                                Select at least one X-axis field and one numeric Y-axis field to build your chart.
                            </p>
                        )}
                    </div>
                </section>

                <section className="custom-report-builder-panel" aria-labelledby="custom-report-table-title">
                    <header className="custom-report-builder-panel-header">
                        <div>
                            <h2 id="custom-report-table-title">Data Table</h2>
                        </div>
                        {rawData && <span className="custom-report-builder-selected-count">{rawData.rows.length} records</span>}
                    </header>
                    <div className="custom-report-builder-table">
                        {rawData && selectedFields.length > 0 ? (
                            <DataTable
                                data={rawData}
                                revenueDisplayConfig={revenueDisplayConfig}
                                columnTypes={rawData.columnTypes}
                                dataTypes={rawData.dataTypes}
                                fieldLabels={fieldLabels}
                                visibleFields={selectedFields}
                            />
                        ) : (
                            <p className="custom-report-builder-empty">
                                Add fields to the X or Y axis to display matching columns here.
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
                                const labels = reportData ? getFieldLabels(reportData.fields) : {};
                                const chart = createChartView(
                                    reportData,
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
                                            <p className="custom-report-builder-message">This report has no chartable records.</p>
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
