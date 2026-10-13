import { useEffect, useRef, useState } from "react";
import { isPhoneColumn, formatRevenueValue, getRevenueUnitLabel,
    isRevenueField, getTenderValueLabel } from "../utils/dashboardData";
import "../styles/DataTable.css";

const INITIAL_ROW_COUNT = 50;
const ROW_BATCH_SIZE = 50;
const LOAD_MORE_THRESHOLD = 300;

function formatNumericValue(value, dataType) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const numericValue =  Number(value);

    if (
        !Number.isFinite(
            numericValue
        )
    ) {
        return String(value);
    }

    if (
        dataType !== "DECIMAL"
    ) {
        return String(value);
    }

    return new Intl.NumberFormat(
        "en-IN",
        {
            useGrouping: true,
            maximumFractionDigits: 20,
        }
    ).format(numericValue);
}

function formatCellValue(
    value,
    fieldName,
    columnType,
    dataType,
    revenueDisplayConfig
) {
    const displayValue =
        getTenderValueLabel(
            fieldName,
            value
        );

    if (
        displayValue === null ||
        displayValue === undefined ||
        displayValue === ""
    ) {
        return "—";
    }

    if (isPhoneColumn(fieldName)) {
        return String(displayValue);
    }

    const revenueConfig = revenueDisplayConfig?.[fieldName];

    if (isRevenueField(fieldName) && revenueConfig) {
        return formatRevenueValue(
            displayValue,
            revenueConfig
        );
    }

    if (columnType === "number") {
        return formatNumericValue(
            displayValue,
            dataType
        );
    }

    return String(displayValue);
}

function getColumnClassName(columnType) {
    if (columnType === "number") {
        return "data-table-column-number";
    }

    if (columnType === "date") {
        return "data-table-column-date";
    }

    return "data-table-column-text";
}

function DataTable({
    data,
    revenueDisplayConfig,
    columnTypes,
    dataTypes,
    fieldLabels = {},
    visibleFields,
}) {
    const [visibleRowCount, setVisibleRowCount] =
        useState(INITIAL_ROW_COUNT);

    const [selectedRowIndex, setSelectedRowIndex] = useState(null);

    const tableWrapperRef = useRef(null);

    useEffect(() => {
        setVisibleRowCount(INITIAL_ROW_COUNT);
        setSelectedRowIndex(null);
    }, [data]);

    if (!data || !data.fields || !data.rows) {
        return null;
    }
    const displayedFields =
        Array.isArray(visibleFields)
            ? visibleFields.filter(
                  (field) =>
                      data.fields.includes(field)
              )
            : data.fields;

    const visibleRows = data.rows.slice(
        0,
        visibleRowCount
    );

    const hasMoreRows =
        visibleRowCount < data.rows.length;

    const handleScroll = () => {
        const tableWrapper = tableWrapperRef.current;

        if (!tableWrapper || !hasMoreRows) {
            return;
        }

        const distanceFromBottom =
            tableWrapper.scrollHeight -
            tableWrapper.scrollTop -
            tableWrapper.clientHeight;

        if (distanceFromBottom <= LOAD_MORE_THRESHOLD) {
            setVisibleRowCount((currentCount) => {
                const nextCount = currentCount + ROW_BATCH_SIZE;

                return Math.min(nextCount, data.rows.length);
            });
        }
    };

    const handleRowSelect = (rowIndex) => {
        setSelectedRowIndex((currentIndex) =>
            currentIndex === rowIndex ? null : rowIndex
        );
    };

    return (
        <div
            ref={tableWrapperRef}
            className="data-table-wrapper"
            onScroll={handleScroll}
        >
            <table className="data-table">
                <thead className="data-table-head">
                    <tr>
                        {displayedFields.map((field) => {
                            const columnType = columnTypes?.[field];
                            const isRevenueColumn = isRevenueField(field) &&
                                Boolean(revenueDisplayConfig?.[field]);
                            const columnClassName =
                                getColumnClassName(isRevenueColumn ? "number" : columnType);
                            const revenueUnit = getRevenueUnitLabel(revenueDisplayConfig?.[field]);

                            return (
                                <th
                                    key={field}
                                    className={`data-table-header-cell ${columnClassName}`}
                                    scope="col"
                                >
                                    {fieldLabels[field] || field}
                                    {revenueUnit &&
                                        ` (${revenueUnit})`}
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody className="data-table-body">
                    {visibleRows.map((row, rowIndex) => (
                        <tr
                            key={`row-${rowIndex}`}
                            className={`data-table-row ${
                                selectedRowIndex === rowIndex
                                    ? "data-table-row-selected"
                                    : ""
                            }`}
                            onClick={() => handleRowSelect(rowIndex)}
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                ) {
                                    event.preventDefault();
                                    handleRowSelect(rowIndex);
                                }
                            }}
                            aria-selected={selectedRowIndex === rowIndex}
                        >
                            {displayedFields.map((field) => {
                                const columnType = columnTypes?.[field];
                                const isRevenueColumn = isRevenueField(field) &&
                                    Boolean(revenueDisplayConfig?.[field]);
                                const columnClassName =
                                    getColumnClassName(isRevenueColumn ? "number" : columnType);

                                return (
                                    <td
                                        key={`${rowIndex}-${field}`}
                                        className={`data-table-cell ${columnClassName}`}
                                        title={isRevenueColumn
                                            ? formatRevenueValue(
                                                  row[field],
                                                  revenueDisplayConfig[field],
                                                  {exact: true}
                                              )
                                            : undefined}
                                    >
                                        {formatCellValue(
                                            row[field],
                                            field,
                                            columnType,
                                            dataTypes?.[field],
                                            revenueDisplayConfig
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DataTable;