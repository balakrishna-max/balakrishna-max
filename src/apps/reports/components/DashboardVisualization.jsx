import { useRef, useState } from "react";

import { transformChartData } from "../utils/dashboardData";
import { validateChartSelection } from "../utils/dashboardConfig";

import DashboardControls from "../components/DashboardControls";
/*
 * Department dropdown temporarily disabled.
 * import SearchableDropdown from "../components/SearchableDropdown";
 */
import DataTable from "../components/DataTable";
import ChartRenderer from "../components/ChartRenderer";
import parseCsvFile from "../services/csv/csvParser";

import "../styles/DashboardVisualization.css";

function DashboardVisualization({
    reportType,
    /*
     * Department selection temporarily disabled.
     * department,
     * departmentOptions,
     */
    data,
    fieldLabels = {},
    controlData,
    filterOptionsData,
    filterType,
    filterValue,
    hasPeriodDateFields,
    fromDateField,
    toDateField,
    fromDate = "",
    toDate = "",
    viewMode,
    chartType,
    xAxisField,
    yAxisField,
    yAxisFields = [],
    xAxisOptions,
    yAxisOptions,
    hasData,
    uploadError,
    onReportTypeChange,
    onFromDateChange,
    onToDateChange,
    onFilterTypeChange,
    onFilterValueChange,
    onViewModeChange,
    /*
     * Department selection temporarily disabled.
     * onDeparmentChange,
     */
    onChartTypeChange,
    onXAxisFieldChange,
    onYAxisFieldChange,
    onYAxisFieldsChange,
    onCsvUploadSuccess,
    onCsvUploadError,
    title,
    reportError,
    isReportLoading,
}) {
    const fileInputRef = useRef(null);

    const [
        isControlsDrawerOpen,
        setIsControlsDrawerOpen,
    ] = useState(false);

    /*
     * Department dropdown temporarily disabled.
     *
     * const departmentField = (
     *     <SearchableDropdown
     *         label="Deparment"
     *         value={department}
     *         options={departmentOptions}
     *         placeholder="Select department"
     *         onChange={onDeparmentChange}
     *     />
     * );
     */

    const headerClassName = [
        "dashboard-visualization-header",
        isControlsDrawerOpen
            ? "dashboard-visualization-header-drawer-open"
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    const controlsClassName = [
        "dashboard-visualization-controls",
        isControlsDrawerOpen
            ? "dashboard-visualization-controls-open"
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    const handleUploadButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            onCsvUploadError({
                type: "csv-file-type-error",
                message: "Please select a CSV file.",
            });

            event.target.value = "";
            return;
        }

        try {
            const parsedData = await parseCsvFile(file);
            onCsvUploadSuccess(parsedData);
        } catch (error) {
            onCsvUploadError(error);
        } finally {
            event.target.value = "";
        }
    };

    const handleBackButtonClick = () => {
        window.history.back();
    };

    const visualizationColumnTypes =
        data?.columnTypes || {};

    const visualizationDataTypes =
        data?.dataTypes || {};

    const validationResult =
        validateChartSelection({
            data,
            columnTypes:
                visualizationColumnTypes,
            chartType,
            xAxisField,
            yAxisField,
            yAxisFields,
        });

    const chartData =
        validationResult.isValid
            ? transformChartData({
                  rows: data.rows,
                  columnTypes:
                      visualizationColumnTypes,
                  xAxisField,
                  yAxisField,
                  yAxisFields,
                  dataTypes:
                      visualizationDataTypes,
                  fieldLabels,
              })
            : null;

    const canRenderChart =
        validationResult.isValid &&
        chartData &&
        Array.isArray(chartData.data) &&
        chartData.data.length > 0;

    const hasRows =
        Array.isArray(data?.rows) &&
        data.rows.length > 0;

    const tableFields =
        reportType === "td-ecv-summary"
            ? [
                  ...new Set([
                      ...xAxisOptions.map(
                          (option) => option.value
                      ),
                      ...yAxisOptions.map(
                          (option) => option.value
                      ),
                  ]),
              ].filter(Boolean)
            : undefined;

    return (
        <section
            className="dashboard-visualization"
            aria-label="Data visualization"
        >
            <header className={headerClassName}>
                <div className="dashboard-visualization-title-row">
                    <h2 className="dashboard-visualization-title">
                        {title}
                    </h2>

                    {/*
                    <div className="dashboard-visualization-department dashboard-visualization-department-desktop">
                        {departmentField}
                    </div>
                    */}
                </div>

                <div className="dashboard-visualization-toolbar-row">
                    <button
                        type="button"
                        className="dashboard-controls-drawer-toggle"
                        aria-expanded={isControlsDrawerOpen}
                        aria-controls="dashboard-controls-drawer"
                        onClick={() =>
                            setIsControlsDrawerOpen(
                                (current) => !current
                            )
                        }
                    >
                        <span aria-hidden="true">
                            ☰
                        </span>

                        <span>Controls</span>
                    </button>
                </div>

                <div
                    id="dashboard-controls-drawer"
                    className={controlsClassName}
                >
                    <button
                        type="button"
                        className="dashboard-controls-drawer-close"
                        onClick={() =>
                            setIsControlsDrawerOpen(false)
                        }
                        aria-label="Close controls"
                    >
                        ×
                    </button>

                    {/*
                    <div className="dashboard-visualization-department dashboard-visualization-department-mobile">
                        {departmentField}
                    </div>
                    */}

                    <DashboardControls
                        reportType={reportType}
                        filterType={filterType}
                        filterValue={filterValue}
                        fromDate={fromDate}
                        toDate={toDate}
                        hasPeriodDateFields={
                            hasPeriodDateFields
                        }

                        /*
                         * Full unfiltered normalized
                         * dataset used for capability
                         * detection inside the controls.
                         */
                        data={controlData}
                         filterOptionsData={
                             filterOptionsData
                         }

                         fromDateField={fromDateField}
                        toDateField={toDateField}
                        viewMode={viewMode}
                        chartType={chartType}
                        xAxisField={xAxisField}
                        yAxisField={yAxisField}
                        yAxisFields={yAxisFields}
                        xAxisOptions={xAxisOptions}
                        yAxisOptions={yAxisOptions}
                        hasData={hasData}
                        onReportTypeChange={
                            onReportTypeChange
                        }
                        onFromDateChange={
                            onFromDateChange
                        }
                        onToDateChange={
                            onToDateChange
                        }
                        onFilterTypeChange={
                            onFilterTypeChange
                        }
                        onFilterValueChange={
                            onFilterValueChange
                        }
                        onViewModeChange={
                            onViewModeChange
                        }
                        onChartTypeChange={
                            onChartTypeChange
                        }
                        onXAxisFieldChange={
                            onXAxisFieldChange
                        }
                        onYAxisFieldChange={
                            onYAxisFieldChange
                        }
                        onYAxisFieldsChange={
                            onYAxisFieldsChange
                        }
                    />
                </div>
            </header>

            <div className="dashboard-visualization-actions">
                {/* <button
                    type="button"
                    className="dashboard-action-button"
                    onClick={handleBackButtonClick}
                >
                    Back
                </button> */}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    hidden
                />

                <button
                    type="button"
                    className="dashboard-action-button"
                    onClick={handleUploadButtonClick}
                >
                    + Add CSV File
                </button>
            </div>

            {isReportLoading && (
                <div className="dashboard-visualization-message">
                    Loading report data...
                </div>
            )}

            {!isReportLoading &&
                uploadError && (
                    <div
                        className="dashboard-visualization-message"
                        role="alert"
                    >
                        {uploadError.message ||
                            "The CSV file could not be loaded."}
                    </div>
                )}

            {!isReportLoading &&
                reportError && (
                    <div className="dashboard-visualization-message">
                        {reportError.message}
                    </div>
                )}

            {!isReportLoading &&
                !reportError &&
                data &&
                !hasRows && (
                    <div className="dashboard-visualization-empty">
                        <h3 className="dashboard-visualization-empty-title">
                            No data found
                        </h3>

                        <p className="dashboard-visualization-empty-message">
                            No resources or records were found for the selected filter options.
                        </p>
                    </div>
                )}

            {!isReportLoading &&
                !reportError &&
                data &&
                hasRows && (
                    <div
                        className={`dashboard-visualization-content dashboard-visualization-content-${viewMode}`}
                    >
                        <section
                            className="dashboard-visualization-data"
                            aria-label="Data"
                        >
                            <div className="dashboard-visualization-data-content">
                                <DataTable
                                    data={data}
                                    visibleFields={
                                        tableFields
                                    }
                                    fieldLabels={
                                        fieldLabels
                                    }
                                    columnTypes={
                                        visualizationColumnTypes
                                    }
                                    dataTypes={
                                        visualizationDataTypes
                                    }
                                />
                            </div>
                        </section>

                        <section
                            className="dashboard-visualization-chart-view"
                            aria-label="Chart visualization"
                        >
                            <div className="dashboard-visualization-chart-content">
                                {!validationResult.isValid && (
                                    <div className="dashboard-visualization-empty">
                                        <h3 className="dashboard-visualization-empty-title">
                                            Configure your chart
                                        </h3>

                                        <p className="dashboard-visualization-empty-message">
                                            {
                                                validationResult.message
                                            }
                                        </p>
                                    </div>
                                )}

                                {validationResult.isValid &&
                                    !canRenderChart && (
                                        <div className="dashboard-visualization-empty">
                                            <h3 className="dashboard-visualization-empty-title">
                                                No chart data available
                                            </h3>

                                            <p className="dashboard-visualization-empty-message">
                                                The selected fields do not contain data that can be visualized.
                                            </p>
                                        </div>
                                    )}

                                {canRenderChart && (
                                    <div className="dashboard-visualization-chart">
                                        <ChartRenderer
                                            chartData={chartData}
                                            chartType={chartType}
                                        />
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

            {!isReportLoading &&
                !reportError &&
                !data && (
                    <div className="dashboard-visualization-empty">
                        <h3 className="dashboard-visualization-empty-title">
                            No data loaded
                        </h3>

                        <p className="dashboard-visualization-empty-message">
                            Select a report type or upload a CSV file to begin visualizing your data.
                        </p>
                    </div>
                )}
        </section>
    );
}

export default DashboardVisualization;