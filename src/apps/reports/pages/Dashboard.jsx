import { useEffect, useRef, useState } from "react";
import { filterNormalizedData, getPeriodDateFields, getRevenueDisplayConfig, normalizeCsvData,
    normalizeReportData, getHumanReadableFieldLabel } from "../utils/dashboardData";

import { getChartAxisFieldOptions, getChartTypeOptions, getChartTypeSelection, getDefaultVisualizationSelection, getReportConfig, isDepartmentAxisReport, isMultiYAxisChart } from "../utils/dashboardConfig";

import DashboardVisualization from "../components/DashboardVisualization";
import { /* Department loading is temporarily disabled. fetchDeparments, */ fetchReport } from "../services/api/dashboardApi";

function getDefaultPeriod() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const financialYearStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;

    return {
        fromDate: `04/${financialYearStartYear}`,
        toDate: `${String(currentMonth).padStart(2,"0")}/${currentYear}`,
    };
}
function getDepartmentNameField(fields = []) {
    const departmentNameAliases = new Set([
        "deptname", "sdeptname", "ndeptname", "departmentname", "sdepartmentname", "department", "sdepartment",
    ]);

    return (
        fields.find((field) =>
            departmentNameAliases.has(String(field).toLowerCase().replace(/[^a-z0-9]/g, ""))) || ""
    );
}

function getDepartmentAxisData(data, reportType) {
    if (!data || !isDepartmentAxisReport(reportType)) {
        return data;
    }

    const excludedFields = getReportConfig(reportType).excludedAxisFields;

    return {
        ...data, fields: data.fields.filter(
            (field) => !excludedFields.includes(
                    field.toLowerCase()
                )
        ),
    };
}

function Dashboard() {
    const [reportType, setReportType] = useState("");
    const defaultPeriod = getDefaultPeriod();
    const [fromDate, setFromDate] = useState( defaultPeriod.fromDate);
    const [toDate, setToDate] = useState(defaultPeriod.toDate);

    /*
     * Department selection is temporarily disabled.
     *
     * const [department, setDeparment] = useState("all");
     *
     * const [departmentOptions, setDeparmentOptions] =
     *     useState([
     *         {
     *             value: "all",
     *             label: "All",
     *         },
     *     ]);
     */

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
    const fieldLabels = reportData !== null && normalizedVisualizationData  ? Object.fromEntries(
                  normalizedVisualizationData.fields.map(
                      (field) => [
                          field, getHumanReadableFieldLabel(field),
                      ]
                  )
              )
            : {};

    /*
     * Department filtering is temporarily disabled.
     *
     * const departmentField =
     *     normalizedVisualizationData?.fields.find(
     *         (field) =>
     *             field === "sDepartment" ||
     *             field === "sDepartmentName" ||
     *             field.toLowerCase() ===
     *                 "department"
     *     ) || "";
     */

    const periodDateFields = getPeriodDateFields(normalizedVisualizationData);

    /*
     * Filtered dataset used by the actual
     * table/chart visualization.
     */
    const visualizationData = filterNormalizedData(normalizedVisualizationData,
            {
                /*
                 * Department filtering is temporarily disabled.
                 * departmentField,
                 * department,
                 */
                fromDateField: periodDateFields.periodDateField,
                fromDate, toDate, filterType, filterValue,
            }
        );

    const handleFromDateChange = (newFromDate) => {setFromDate(newFromDate);};
    const handleToDateChange = (newToDate) => {setToDate(newToDate);};
    const axisSelectionData = normalizedVisualizationData
        ? usesDepartmentAxis
            ? getDepartmentAxisData(normalizedVisualizationData, reportType)
            : normalizedVisualizationData
        : null;
    const fixedXAxisField = usesDepartmentAxis ? departmentNameField : null;
    const selectedYAxisFields = yAxisFields.length > 0
        ? yAxisFields
        : yAxisField
          ? [yAxisField]
          : [];
    const xAxisOptions = getChartAxisFieldOptions(
        axisSelectionData,
        chartType,
        "x"
    )
        .filter((field) => chartType === "scatter" || fixedXAxisField === null || field === fixedXAxisField)
        .map((field) => ({value: field, label: fieldLabels[field] || field}));
    const yAxisOptions = getChartAxisFieldOptions(
        axisSelectionData,
        chartType,
        "y",
        [],
        selectedYAxisFields[0] || ""
    ).map((field) => ({value: field, label: fieldLabels[field] || field}));

    const handleReportTypeChange = (newReportType) => {
        const defaultPeriod =  getDefaultPeriod();
        setReportType(newReportType);
        setFromDate(defaultPeriod.fromDate);
        setToDate(defaultPeriod.toDate);
        // setDeparment("all");
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

    /*
     * Department API loading is temporarily disabled.
     *
     * useEffect(() => {
     *     let isCancelled = false;
     *
     *     async function loadDeparments() {
     *         try {
     *             const departments =
     *                 await fetchDeparments();
     *
     *             if (!isCancelled) {
     *                 const departmentOptions =
     *                     departments.map(
     *                         (departmentName) => ({
     *                             value:
     *                                 departmentName,
     *                             label:
     *                                 departmentName,
     *                         })
     *                     );
     *
     *                 setDeparmentOptions([
     *                     {
     *                         value: "all",
     *                         label: "All",
     *                     },
     *                     ...departmentOptions,
     *                 ]);
     *             }
     *         } catch (error) {
     *             console.error(
     *                 "Failed to load departments:",
     *                 error
     *             );
     *         }
     *     }
     *
     *     loadDeparments();
     *
     *     return () => {
     *         isCancelled = true;
     *     };
     * }, []);
     */

    useEffect(() => {
        if (!reportType) {
            setReportData(null);
            setReportError(null);
            setIsReportLoading(false);
            return;
        }
        let isCancelled = false;
        async function loadReport() {
            setIsReportLoading(true);
            setReportError(null);
            setReportData(null);

            try {
                const result = await fetchReport({reportType});

                if (!isCancelled) {
                    const normalizedData = normalizeReportData(result.data);
                    const usesDepartmentAxis = isDepartmentAxisReport(reportType);
                    const departmentNameField = usesDepartmentAxis ? getDepartmentNameField(normalizedData?.fields) : "";
                    const reportAxisData = getDepartmentAxisData(normalizedData, reportType);
                    const fixedXAxisField = usesDepartmentAxis ? departmentNameField : null;
                    const chartTypeOptions = getChartTypeOptions(reportAxisData, fixedXAxisField);
                    const currentChartType = chartTypeRef.current || "area";
                    const selectedChartType = chartTypeOptions.some(
                        (option) => option.value === currentChartType && !option.disabled
                    )
                        ? currentChartType
                        : chartTypeOptions.find((option) => !option.disabled)?.value || currentChartType;
                    const defaultSelection = getDefaultVisualizationSelection(
                        reportAxisData,
                        selectedChartType,
                        fixedXAxisField
                    );

                    setReportData(result.data);
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

        loadReport();

        return () => {
            isCancelled = true;
        };
    }, [reportType]);

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
                fixedXAxisField,
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
                /*
                 * Department selection is temporarily disabled.
                 * department={department}
                 * departmentOptions={departmentOptions}
                 */
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
                /*
                 * Department selection is temporarily disabled.
                 * onDeparmentChange={setDeparment}
                 */
                onChartTypeChange={handleChartTypeChange}
                onXAxisFieldChange={setXAxisField}
                onYAxisFieldChange={setYAxisField}
                onYAxisFieldsChange={setYAxisFields}
                onCsvUploadSuccess={handleCsvUploadSuccess}
                onCsvUploadError={setUploadError}
                reportError={reportError}
                isReportLoading={isReportLoading}
                hasPeriodDateFields={periodDateFields.hasDateFields}
            />
        </main>
    );
}

export default Dashboard;