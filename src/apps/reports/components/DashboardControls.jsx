import { useState } from "react";
import SearchableDropdown from "./SearchableDropdown";
import {
    reportTypes,
    isMultiYAxisChart,
    getChartTypeOptions,
    getFilterTypeOptions,
    getFilterValueOptions,
} from "../utils/dashboardConfig";
import tableViewIcon from "../assets/table-view.png";
import chartViewIcon from "../assets/chart-view.png";

import "../styles/DashboardControls.css";

function DashboardControls({
    reportType,
    filterType,
    chartType,
    fromDate = "",
    toDate = "",
    hasPeriodDateFields,
    filterValue,
    viewMode,
    xAxisField,
    yAxisField,
    yAxisFields,
    xAxisOptions,
    yAxisOptions,
    hasData,
    data = null,
    filterOptionsData = data,
    onReportTypeChange,
    onFilterTypeChange,
    onFilterValueChange,
    onFromDateChange,
    onToDateChange,
    onViewModeChange,
    onChartTypeChange,
    onXAxisFieldChange,
    onYAxisFieldChange,
    onYAxisFieldsChange,
}) {
    const [openFilterType, setOpenFilterType] =
        useState(null);

    const chartTypeOptions = getChartTypeOptions(data);

    const filterTypeOptions = getFilterTypeOptions(data).filter(
        (filter) => filter.value !== "years"
    );

    const activeFilterType =
        openFilterType || filterType;

    const filterValueOptions =
        getFilterValueOptions(
            filterOptionsData,
            activeFilterType
        );

    const selectedFilterOption =
        filterValueOptions.find(
            (option) => option.value === filterValue
        );

    const handleFilterOpen = (filter) => {
        if (filter.disabled) {
            return;
        }

        if (
            filter.value === "none" ||
            filter.value === "number-wise" ||
            filter.value === "value-wise" ||
            filter.value === "percentage-wise"
        ) {
            setOpenFilterType(null);
            onFilterTypeChange(filter.value);
            return;
        }

        setOpenFilterType(filter.value);
    };

    const formatMonthYearInput = (value) => {
        const digitsOnly = value
            .replace(/\D/g, "")
            .slice(0, 6);

        if (digitsOnly.length <= 2) {
            return digitsOnly;
        }

        return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(
            2
        )}`;
    };

    return (
        <div
            className="dashboard-controls"
            aria-label="Dashboard visualization controls"
        >
            <div className="dashboard-controls-fields">
                <SearchableDropdown
                    label="Report Type"
                    value={reportType}
                    options={reportTypes}
                    placeholder="Select report"
                    onChange={onReportTypeChange}
                />

                <div
                    className={`searchable-dropdown dashboard-controls-year ${
                        hasPeriodDateFields
                            ? ""
                            : "dashboard-controls-year-disabled"
                    }`}
                    aria-label="Period"
                >
                    <span className="searchable-dropdown-label">
                        Period
                    </span>

                    <div className="dashboard-controls-year-fields">
                        <input
                            type="text"
                            inputMode="numeric"
                            className="form-control"
                            value={fromDate}
                            placeholder="MM/YYYY"
                            maxLength={7}
                            aria-label="From month and year"
                            disabled={!hasPeriodDateFields}
                            onChange={(event) =>
                                onFromDateChange(
                                    formatMonthYearInput(
                                        event.target.value
                                    )
                                )
                            }
                        />

                        <span
                            className="dashboard-controls-year-separator"
                            aria-hidden="true"
                        >
                            →
                        </span>

                        <input
                            type="text"
                            inputMode="numeric"
                            className="form-control"
                            value={toDate}
                            placeholder="MM/YYYY"
                            maxLength={7}
                            aria-label="To month and year"
                            disabled={!hasPeriodDateFields}
                            onChange={(event) =>
                                onToDateChange(
                                    formatMonthYearInput(
                                        event.target.value
                                    )
                                )
                            }
                        />
                    </div>
                </div>

                <SearchableDropdown
                    label="Chart Type"
                    value={chartType}
                    options={chartTypeOptions}
                    placeholder="Select chart"
                    onChange={onChartTypeChange}
                    disabled={!hasData}
                />

                <SearchableDropdown
                    label="X Axis"
                    value={xAxisField}
                    options={xAxisOptions}
                    placeholder="Select field"
                    onChange={onXAxisFieldChange}
                    disabled={!hasData}
                />

                {isMultiYAxisChart(chartType) ? (
                    <SearchableDropdown
                        label="Y Axis"
                        value={yAxisFields}
                        options={yAxisOptions}
                        placeholder="Select fields"
                        onChange={onYAxisFieldsChange}
                        disabled={!hasData}
                        multiple
                    />
                ) : (
                    <SearchableDropdown
                        label="Y Axis"
                        value={yAxisField}
                        options={yAxisOptions}
                        placeholder="Select field"
                        onChange={onYAxisFieldChange}
                        disabled={!hasData}
                    />
                )}
            </div>

            <div className="dashboard-controls-filter-row">
                <div className="dashboard-controls-filter">
                    <span className="dashboard-controls-filter-label">
                        Filter by :
                    </span>

                    <div
                        className="dashboard-controls-filter-options"
                        role="radiogroup"
                        aria-label="Filter by"
                    >
                        {filterTypeOptions.map((filter) => {
                            const isSelected =
                                filterType ===
                                filter.value;

                            const isOpen =
                                openFilterType ===
                                filter.value;

                            const selectedFilterDisplay =
                                isSelected
                                    ? selectedFilterOption?.label ||
                                      ""
                                    : "";

                            const isFilterValueSelected =
                                Boolean(
                                    selectedFilterDisplay
                                );

                            return (
                                <div
                                    key={filter.value}
                                    className={`dashboard-controls-filter-option-group ${
                                        isSelected
                                            ? "dashboard-controls-filter-option-group-active"
                                            : ""
                                    }`}
                                >
                                    <label
                                        className={`dashboard-controls-filter-option ${
                                            filter.disabled
                                                ? "dashboard-controls-filter-option-disabled"
                                                : ""
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="dashboard-filter-type"
                                            value={filter.value}
                                            checked={isSelected}
                                            disabled={
                                                filter.disabled
                                            }
                                            onClick={() =>
                                                handleFilterOpen(
                                                    filter
                                                )
                                            }
                                        />

                                        <span>
                                            {filter.label}
                                        </span>

                                        {isFilterValueSelected && (
                                            <span className="dashboard-controls-filter-selected-value">
                                                (
                                                {
                                                    selectedFilterDisplay
                                                }
                                                )
                                            </span>
                                        )}
                                    </label>

                                    {isOpen &&
                                        (filter.value ===
                                            "category-wise" ||
                                            filter.value ===
                                                "status") && (
                                            <div className="dashboard-controls-filter-value">
                                                <SearchableDropdown
                                                    label=""
                                                    value=""
                                                    options={
                                                        filterValueOptions
                                                    }
                                                    onChange={(
                                                        value
                                                    ) => {
                                                        onFilterTypeChange(
                                                            filter.value,
                                                            value
                                                        );

                                                        setOpenFilterType(
                                                            null
                                                        );
                                                    }}
                                                    onClose={() =>
                                                        setOpenFilterType(
                                                            null
                                                        )
                                                    }
                                                    initialOpen
                                                    hideTrigger
                                                />
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    className={`dashboard-controls-view-toggle dashboard-controls-view-toggle-${viewMode}`}
                    role="group"
                    aria-label="Visualization view"
                >
                    <button
                        type="button"
                        className={`dashboard-controls-view-button ${
                            viewMode === "table"
                                ? "dashboard-controls-view-button-active"
                                : ""
                        }`}
                        onClick={() =>
                            onViewModeChange("table")
                        }
                        aria-label="Show table only"
                        aria-pressed={
                            viewMode === "table"
                        }
                        title="Table view"
                    >
                        <span
                            className="dashboard-controls-view-icon"
                            style={{
                                "--view-icon": `url(${tableViewIcon})`,
                            }}
                            aria-hidden="true"
                        />
                    </button>

                    <button
                        type="button"
                        className={`dashboard-controls-view-button ${
                            viewMode === "chart"
                                ? "dashboard-controls-view-button-active"
                                : ""
                        }`}
                        onClick={() =>
                            onViewModeChange("chart")
                        }
                        aria-label="Show chart only"
                        aria-pressed={
                            viewMode === "chart"
                        }
                        title="Chart view"
                    >
                        <span
                            className="dashboard-controls-view-icon"
                            style={{
                                "--view-icon": `url(${chartViewIcon})`,
                            }}
                            aria-hidden="true"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardControls;