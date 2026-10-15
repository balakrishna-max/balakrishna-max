import DashboardVisualization from "../DashboardVisualization.jsx";
import {
    getChartAxisOptions,
    getDefaultVisualizationSelection,
    getReportConfig,
    getReportAxisData,
    getSupportedChartType,
    isDepartmentAxisReport,
} from "../../utils/dashboardConfig.js";
import {
    getFieldLabels,
    getDepartmentNameField,
    getRevenueDisplayConfig,
    getReportMetrics,
} from "../../utils/dashboardData.js";

function ReportView({
    reportId,
    title,
    data,
    reportError = null,
    isReportLoading = false,
    onBack,
}) {
    if (!data) {
        return (
            <main className="reports-detail-page">
                <section
                    className="reports-metrics"
                    aria-label={`${title} summary metrics`}
                >
                    {Array.from({ length: 5 }, (_, index) => (
                        <article
                            className="reports-metric-card"
                            key={`loading-metric-${index}`}
                            aria-busy={!reportError}
                        >
                            <h2 className="reports-metric-label">
                                {reportError ? "Metric unavailable" : "Loading metric"}
                            </h2>
                            <p className="reports-metric-value">
                                {reportError ? "—" : "…"}
                            </p>
                        </article>
                    ))}
                </section>
                <DashboardVisualization
                    reportType={reportId}
                    title={title}
                    data={null}
                    controlData={null}
                    revenueDisplayConfig={{}}
                    fieldLabels={{}}
                    chartType=""
                    xAxisField=""
                    yAxisField=""
                    yAxisFields={[]}
                    xAxisOptions={[]}
                    yAxisOptions={[]}
                    viewMode="split"
                    hasData={false}
                    hasPeriodDateFields={false}
                    filterType="none"
                    filterValue=""
                    reportError={reportError}
                    isReportLoading={isReportLoading}
                    showControls={false}
                    showHeader={false}
                    showActions={false}
                    visualizationClassName="reports-visualization"
                    onBack={onBack}
                />
            </main>
        );
    }

    const fieldLabels = getFieldLabels(data.fields);
    const reportMetrics = getReportMetrics(data, fieldLabels);
    const reportConfig = getReportConfig(reportId);
    const departmentNameField = isDepartmentAxisReport(reportId)
        ? getDepartmentNameField(data.fields)
        : "";
    const chartSourceData = getReportAxisData(data, reportId);
    const fixedXAxisField = departmentNameField || null;
    const chartType = getSupportedChartType(chartSourceData, "bar", fixedXAxisField, reportId);
    const selection = getDefaultVisualizationSelection(
        chartSourceData,
        chartType,
        fixedXAxisField,
        reportId
    );
    const selectedYAxisFields = selection.yAxisFields.length > 0
        ? selection.yAxisFields
        : selection.yAxisField
          ? [selection.yAxisField]
          : [];
    const xAxisOptions = getChartAxisOptions(chartSourceData, {
        chartType,
        axisName: "x",
        fieldLabels,
        reportId,
        fixedXAxisField,
    });
    const yAxisOptions = getChartAxisOptions(
        chartSourceData,
        {
            chartType,
            axisName: "y",
            fieldLabels,
            referenceYAxisField: selectedYAxisFields[0] || "",
            reportId,
        }
    );

    return (
        <main className="reports-detail-page">
            <section
                className="reports-metrics"
                aria-label={`${title} summary metrics`}
            >
                {reportMetrics.map((metric) => (
                    <article className="reports-metric-card" key={metric.label}>
                        <h2 className="reports-metric-label">{metric.label}</h2>
                        <p className="reports-metric-value">{metric.value}</p>
                    </article>
                ))}
            </section>
            <DashboardVisualization
                reportType={reportId}
                title={title}
                data={data}
                controlData={chartSourceData}
                chartSourceData={chartSourceData}
                visibleFields={reportConfig?.visibleTableFields}
                revenueDisplayConfig={getRevenueDisplayConfig(data)}
                chartRevenueDisplayConfig={getRevenueDisplayConfig(chartSourceData)}
                fieldLabels={fieldLabels}
                fixedXAxisField={fixedXAxisField}
                chartType={chartType}
                xAxisField={selection.xAxisField}
                yAxisField={selection.yAxisField}
                yAxisFields={selection.yAxisFields}
                xAxisOptions={xAxisOptions}
                yAxisOptions={yAxisOptions}
                viewMode="split"
                hasData
                hasPeriodDateFields={false}
                filterType="none"
                filterValue=""
                isReportLoading={false}
                showControls={false}
                showHeader={false}
                showActions={false}
                visualizationClassName="reports-visualization"
                onBack={onBack}
            />
        </main>
    );
}

export default ReportView;
