import { useEffect, useRef, useState } from "react";
import { filterNormalizedData, getPeriodDateFields, getRevenueDisplayConfig, normalizeCsvData,
    normalizeReportData, getFieldLabels, getDepartmentNameField } from "../../utils/dashboardData";

import { getChartAxisOptions, getChartTypeSelection, getDefaultPeriod, getDefaultVisualizationSelection, getReportAxisData, getReportConfig, getReportControls, getSupportedChartType, isDepartmentAxisReport, isMultiYAxisChart } from "../../utils/dashboardConfig";

import DashboardVisualization from "../DashboardVisualization.jsx";

function OverallReports({ onBack, loadReport }) {
    const [reportType, setReportType] = useState("");
    const defaultPeriod = getDefaultPeriod();
    const [fromDate, setFromDate] = useState( defaultPeriod.fromDate);
    const [toDate, setToDate] = useState(defaultPeriod.toDate);

    const [filterType, setFilterType] = useState("none");
    const [filterValue, setFilterValue] = useState("");
    const [viewMode, setViewMode] = useState("split");
    const [csvData, setCsvData] = useState(null);
    const [chartType, setChartType] = useState("");
    const [xAxisField, setXAxisField] = useState("");
    const [yAxisField, setYAxisField] = useState("");
    const [yAxisFields, setYAxisFields] = useState([]);
    const [uploadError, setUploadError] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [reportError, setReportError] = useState(null);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const chartTypeRef = useRef("");
    const lastMultiYAxisFieldsRef = useRef([]);

    /*
     * Full normalized dataset.
     *
     * This is the capability/source dataset:
     * - chart type suitability
     * - filter type suitability
     * - category/status available values
     * - period date availability
     *
     * It must remain unfiltered.
     */
    const normalizedVisualizationData = reportData ? normalizeReportData(reportData) : csvData ? normalizeCsvData(csvData.fields, csvData.rows) : null;
    const revenueDisplayConfig = normalizedVisualizationData
        ? getRevenueDisplayConfig(normalizedVisualizationData)
        : {};
    const usesDepartmentAxis = isDepartmentAxisReport(reportType) && reportData !== null;
    const departmentNameField = usesDepartmentAxis ? getDepartmentNameField(normalizedVisualizationData?.fields): "";
    const fieldLabels = normalizedVisualizationData
        ? getFieldLabels(normalizedVisualizationData.fields)
        : {};

    const periodDateFields = getPeriodDateFields(normalizedVisualizationData);
    const controlOptions = getReportControls(reportType);

    /*
     * Filtered dataset used by the actual
     * table/chart visualization.
     */
    const visualizationData = filterNormalizedData(normalizedVisualizationData,
            {
                fromDateField: controlOptions.period ? periodDateFields.periodDateField : "",
                fromDate, toDate, filterType, filterValue,
            }
        );

    const handleFromDateChange = (newFromDate) => {setFromDate(newFromDate);};
    const handleToDateChange = (newToDate) => {setToDate(newToDate);};
    const axisSelectionData = normalizedVisualizationData
        ? usesDepartmentAxis
            ? getReportAxisData(normalizedVisualizationData, reportType)
            : normalizedVisualizationData
        : null;
    const fixedXAxisField = usesDepartmentAxis ? departmentNameField : null;
    const selectedYAxisFields = yAxisFields.length > 0
        ? yAxisFields
        : yAxisField
          ? [yAxisField]
          : [];
    const xAxisOptions = getChartAxisOptions(
        axisSelectionData,
        {
            chartType,
            axisName: "x",
            fieldLabels,
            reportId: reportType,
            fixedXAxisField,
        }
    );
    const yAxisOptions = getChartAxisOptions(
        axisSelectionData,
        {
            chartType,
            axisName: "y",
            fieldLabels,
            referenceYAxisField: selectedYAxisFields[0] || "",
            reportId: reportType,
        }
    );

    const handleReportTypeChange = (newReportType) => {
        const defaultPeriod =  getDefaultPeriod();
        setReportType(newReportType);
        setFromDate(defaultPeriod.fromDate);
        setToDate(defaultPeriod.toDate);
        setFilterType("none");
        setFilterValue("");
        setCsvData(null);
        setUploadError(null);
        setReportData(null);
        setReportError(null);
        setIsReportLoading(false);
    };

    const handleFilterTypeChange = (newFilterType, newFilterValue = "") => {
        setFilterType(newFilterType);

        /*
         * The current filter type is "none".
         * Do not use the old "all" value here.
         */
        setFilterValue(newFilterType === "none" ? "" : newFilterValue);
    };

    const handleViewModeChange = (nextViewMode) => {
        setViewMode((currentViewMode) => currentViewMode === nextViewMode ? "split" : nextViewMode);
    };

    useEffect(() => {
        if (!reportType) {
            setReportData(null);
            setReportError(null);
            setIsReportLoading(false);
            return;
        }
        let isCancelled = false;
        async function loadSelectedReport() {
            setIsReportLoading(true);
            setReportError(null);
            setReportData(null);

            try {
                const reportResult = await loadReport(reportType);

                if (!isCancelled) {
                    const normalizedData = normalizeReportData(reportResult);
                    const usesDepartmentAxis = isDepartmentAxisReport(reportType);
                    const departmentNameField = usesDepartmentAxis ? getDepartmentNameField(normalizedData?.fields) : "";
                    const reportAxisData = getReportAxisData(normalizedData, reportType);
                    const fixedXAxisField = usesDepartmentAxis ? departmentNameField : null;
                    const currentChartType = chartTypeRef.current || "area";
                    const selectedChartType = getSupportedChartType(
                        reportAxisData,
                        currentChartType,
                        fixedXAxisField,
                        reportType
                    );
                    const defaultSelection = getDefaultVisualizationSelection(
                        reportAxisData,
                        selectedChartType,
                        fixedXAxisField,
                        reportType
                    );

                    setReportData(reportResult);
                    chartTypeRef.current = selectedChartType;
                    setChartType(selectedChartType);
                    setXAxisField(defaultSelection.xAxisField);
                    setYAxisField(defaultSelection.yAxisField);
                    setYAxisFields(defaultSelection.yAxisFields);
                }
            } catch (error) {
                console.error(`Failed to load report "${reportType}":`, error);

                if (!isCancelled) {
                    setReportData(null);
                    setReportError(error);
                }
            } finally {
                if (!isCancelled) {
                    setIsReportLoading(
                        false
                    );
                }
            }
        }

        loadSelectedReport();

        return () => {
            isCancelled = true;
        };
    }, [loadReport, reportType]);

    const handleCsvUploadSuccess = (parsedData) => {
        const normalizedData = normalizeCsvData(parsedData.fields, parsedData.rows);
        const defaultSelection = getDefaultVisualizationSelection(normalizedData);
        chartTypeRef.current = defaultSelection.chartType;
        setCsvData(parsedData);
        setReportData(null);
        setReportError(null);
        setChartType(defaultSelection.chartType);
        setXAxisField(defaultSelection.xAxisField);
        setYAxisField(defaultSelection.yAxisField);
        setYAxisFields(defaultSelection.yAxisFields);
        setUploadError(null);
    };

    const handleChartTypeChange = (newChartType) => {
        const currentIsMulti = isMultiYAxisChart(chartType);
        const nextIsMulti = isMultiYAxisChart(newChartType);
        if (currentIsMulti && yAxisFields.length > 0) {
            lastMultiYAxisFieldsRef.current = yAxisFields;
        }
        const yAxisFieldsForSelection = nextIsMulti && !currentIsMulti && lastMultiYAxisFieldsRef.current.length > 0 ? lastMultiYAxisFieldsRef.current : yAxisFields;
        const nextSelection = getChartTypeSelection({
                data: axisSelectionData, chartType: newChartType,
                xAxisField, yAxisField, yAxisFields: yAxisFieldsForSelection,
                fixedXAxisField, reportId: reportType,
            });

        chartTypeRef.current = newChartType;
        setChartType(newChartType);
        setXAxisField(nextSelection.xAxisField);
        setYAxisField(nextSelection.yAxisField);
        setYAxisFields(nextSelection.yAxisFields);
    };

    const activeReportConfig = getReportConfig(reportType);
    const reportTitle = activeReportConfig
        ? `MIS Reports - ${activeReportConfig.label}`
        : "MIS Reports";
    return (
        <main className="dashboard-page">
            <DashboardVisualization
                reportType={reportType}
                fromDate={fromDate}
                toDate={toDate}
                filterType={filterType}
                filterValue={filterValue}
                title={reportTitle}
                data={visualizationData}
                revenueDisplayConfig={revenueDisplayConfig}
                fieldLabels={fieldLabels}
                controlData={axisSelectionData}
                fixedXAxisField={fixedXAxisField}
                chartType={chartType}
                xAxisField={xAxisField}
                yAxisField={yAxisField}
                yAxisFields={yAxisFields}
                xAxisOptions={xAxisOptions}
                yAxisOptions={yAxisOptions}
                viewMode={viewMode}
                hasData={visualizationData !== null}
                uploadError={uploadError}
                onReportTypeChange={handleReportTypeChange}
                onFromDateChange={handleFromDateChange}
                onToDateChange={handleToDateChange}
                onFilterTypeChange={handleFilterTypeChange}
                onViewModeChange={handleViewModeChange}
                onChartTypeChange={handleChartTypeChange}
                onXAxisFieldChange={setXAxisField}
                onYAxisFieldChange={setYAxisField}
                onYAxisFieldsChange={setYAxisFields}
                onCsvUploadSuccess={handleCsvUploadSuccess}
                onCsvUploadError={setUploadError}
                reportError={reportError}
                isReportLoading={isReportLoading}
                hasPeriodDateFields={controlOptions.period && periodDateFields.hasDateFields}
                onBack={onBack}
            />
        </main>
    );
}

export default OverallReports;