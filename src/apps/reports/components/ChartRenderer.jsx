import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, RadarChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, RadarComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import {
    formatRevenueValue,
    formatNumericValue,
    getRevenueUnitLabel,
    isRevenueField,
} from "../utils/dashboardData";
import { CHART_COLORS } from "../utils/dashboardConfig.js";

echarts.use([BarChart, LineChart, PieChart,
    RadarChart, ScatterChart, GridComponent,
    LegendComponent, RadarComponent, TitleComponent,
    TooltipComponent, LabelLayout, CanvasRenderer,]);

const BAR_RADIUS = [6, 6, 0, 0];
const HORIZONTAL_BAR_RADIUS = [0, 6, 6, 0];
const PIE_OUTSIDE_LABEL_THRESHOLD = 0.12;
const ANIMATION_DATA_THRESHOLD = 1000;
const LARGE_DATA_THRESHOLD = 2000;
const SYMBOL_DATA_THRESHOLD = 300;
const PROGRESSIVE_DATA_THRESHOLD = 5000;
const PROGRESSIVE_THRESHOLD = 3000;
const HTML_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function getChartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
}

function getCssVariable(name) {
    return getComputedStyle(
        document.documentElement
    )
        .getPropertyValue(name)
        .trim();
}

function getRootFontSize() {
    return (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 13);
}

function getFontSize(name) {
    const value = getCssVariable(name);
    if (value.endsWith("rem")) {
        return (Number.parseFloat(value) *  getRootFontSize());
    }
    if (value.endsWith("px")) {
        return Number.parseFloat(value);
    }
    return (Number.parseFloat(value) || 12 );
}

function getChartTheme() {
    return {
        primary: getCssVariable("--color-primary"),
        primaryHover: getCssVariable("--color-primary-hover"),
        grid: getCssVariable("--color-border"),
        axis: getCssVariable("--color-text-secondary"),
        text: getCssVariable("--color-text-dark"),
        surface: getCssVariable("--color-surface"),
        fontFamily: getCssVariable("--font-family-base"),
        fontSize: getFontSize("--font-size-xs"),
        tooltipFontSize: getFontSize("--font-size-sm"),
        shadow: getCssVariable("--shadow-md"),
        radius: getCssVariable("--radius-md")
    };
}

function getChartRevenueDisplayConfig(chartData) {
    const axes = Array.isArray(chartData?.yAxes) &&
        chartData.yAxes.length > 0 ? chartData.yAxes : chartData?.yAxis ? [chartData.yAxis] : [];
    const revenueConfigs = axes.map((axis) => axis.revenueDisplayConfig);
    const configuredRevenueAxes = revenueConfigs.filter(Boolean);

    if (configuredRevenueAxes.length === 0) {
        return chartData?.xAxis?.revenueDisplayConfig || null;
    }

    if (configuredRevenueAxes.length !== axes.length) {
        throw new Error("A chart cannot combine money and non-money Y-axis fields.");
    }

    const sharedConfig = configuredRevenueAxes[0];
    const hasSharedUnit = configuredRevenueAxes.every(
        (config) =>
            config.divisor === sharedConfig.divisor &&
            config.suffix === sharedConfig.suffix
    );

    if (!hasSharedUnit) {
        throw new Error("Money fields in a chart must use the report-wide display unit.");
    }

    return sharedConfig;
}

function formatRevenueAxisValue(value, revenueDisplayConfig, dataType) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return String(value ?? "—");
    }
    if (!revenueDisplayConfig) {
        return formatNumericValue(numericValue, dataType, {emptyAsDash: false});
    }
    return formatRevenueValue(numericValue, revenueDisplayConfig);
}

function formatRevenueTooltipValue(value, revenueDisplayConfig, dataType) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return String(value ?? "—");
    }
    if (!revenueDisplayConfig) {
        return formatNumericValue(numericValue, dataType, {emptyAsDash: false});
    }
    return formatRevenueValue(numericValue, revenueDisplayConfig, {exact: true});
}

function getRevenueUnitTitle(chartData, theme) {
    const revenueDisplayConfig = getChartRevenueDisplayConfig(chartData);

    if (!revenueDisplayConfig) {
        return null;
    }
    const revenueUnit = getRevenueUnitLabel(revenueDisplayConfig);

    return {
        text: `In ${revenueUnit}`,
        right: 8,
        top: 4,
        textStyle: { color: theme.axis,
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize,
            fontWeight: 500 },
    };
}

function getSeriesDisplayConfig(chartData, seriesName) {
    const normalizedSeriesName = String(seriesName ?? "" );
    const matchingAxis = chartData.yAxes?.find((axis) => axis.field === normalizedSeriesName || axis.label === normalizedSeriesName);
    const fallbackAxis = chartData.yAxes?.length > 0 ? null : chartData.yAxis;

    return {
        dataType:
            matchingAxis?.dataType ||
            fallbackAxis?.dataType ||
            "NUMBER",

        revenueDisplayConfig:
            matchingAxis
                ?.revenueDisplayConfig ||
            fallbackAxis?.revenueDisplayConfig ||
            null,
    };
}

function getTooltipFormatter(chartData, theme) {
    return (params) => {const items = Array.isArray(params) ? params : [params];

        if (items.length === 0) {
            return "";
        }
        const axisLabel = items[0] ?.axisValueLabel ?? items[0]?.name ??  "";
        const rows = items.filter(
                (item) => item?.value !==  undefined
            )
            .map((item) => {
                const rawValues = Array.isArray(item.value)
                    ? item.value
                    : null;
                const rawValue = rawValues
                    ? rawValues[rawValues.length - 1]
                    : item.value;

                const displayConfig = getSeriesDisplayConfig(chartData, item.seriesName);
                const formattedValue = formatRevenueTooltipValue(rawValue, displayConfig.revenueDisplayConfig, displayConfig.dataType);
                const formattedXValue = chartData.xAxis?.revenueDisplayConfig && rawValues
                    ? formatRevenueTooltipValue(
                          rawValues[0],
                          chartData.xAxis.revenueDisplayConfig,
                          chartData.xAxis.dataType
                      )
                    : "";
                const seriesLabel = escapeHtml(
                    item.seriesName ??
                        chartData.yAxis?.label ??
                        "Value"
                );
                const xAxisLabel = escapeHtml(chartData.xAxis?.label || "X");
                const xValueMarkup = formattedXValue
                    ? `<br /><span style="font-weight:600">${xAxisLabel}</span>: ${escapeHtml(formattedXValue)}`
                    : "";

                return `${item.marker ?? ""}<span style="font-weight:600">${seriesLabel}</span>: ${escapeHtml(formattedValue)}${xValueMarkup}`;
            });

        return `
            <div style="font-family:${theme.fontFamily};font-size:${theme.tooltipFontSize}px;color:${theme.text}">
                <div style="margin-bottom:4px;color:${theme.primary};font-weight:600;">${escapeHtml(
                    axisLabel
                )}</div>
                ${rows.join(
                    "<br />"
                )}
            </div>
        `;
    };
}

function getCartesianBaseOption(chartData, theme, chartType, richChart, chartTitles, fillAvailableSpace) {
    const isHorizontal = chartType === "horizontal-bar";
    const useCategoryX = chartType !== "scatter" && chartType !== "horizontal-bar";
    const xValues = chartData.data.map((item) =>String(item.x ?? ""));
    const showAllCategoryLabels = richChart &&
        chartType === "grouped-bar" &&
        (xValues.length > 8 || xValues.some((value) => value.length > 12));
    const xAxisRevenueDisplayConfig = chartData.xAxis?.revenueDisplayConfig || null;
    const yAxisRevenueDisplayConfig = chartData.yAxis?.revenueDisplayConfig || null;

    const revenueUnitTitle =  getRevenueUnitTitle(chartData, theme);

    return {
        animation: chartData.data.length < ANIMATION_DATA_THRESHOLD,

        animationThreshold:  ANIMATION_DATA_THRESHOLD,

        animationDuration: richChart ? 850 : undefined,
        animationDurationUpdate: richChart ? 650 : undefined,
        animationEasing: richChart ? "cubicOut" : undefined,
        animationEasingUpdate: richChart ? "cubicOut" : undefined,

        color:  CHART_COLORS,

        title: revenueUnitTitle ? revenueUnitTitle : undefined,

        grid: {
            top: fillAvailableSpace && chartType === "grouped-bar"
                ? 52
                : richChart && chartType === "grouped-bar"
                    ? 64
                    : revenueUnitTitle ? 48 : 32,
            right: fillAvailableSpace ? 20 : 16,
            bottom: fillAvailableSpace && showAllCategoryLabels
                ? 88
                : showAllCategoryLabels ? 108 : chartType === "grouped-bar" ? 52 : 48,
            left: fillAvailableSpace && chartType === "grouped-bar"
                ? 72
                : chartType === "grouped-bar" ? 64 : 48,
            containLabel: true,
        },

        legend: richChart && chartType === "grouped-bar"
            ? {
                top: 22,
                left: "center",
                itemWidth: 12,
                itemHeight: 12,
                itemGap: 22,
                icon: "roundRect",
                textStyle: {
                    color: theme.axis,
                    fontFamily: theme.fontFamily,
                    fontSize: theme.fontSize,
                },
            }
            : undefined,

        tooltip: {
            trigger: chartType === "scatter" ? "item" : "axis",

            axisPointer: {
                type:
                    chartType === "bar" ||
                    chartType === "grouped-bar" ||
                    chartType === "stacked-bar" ||
                    chartType === "horizontal-bar"
                        ? "shadow"
                        : "line",
            },

            backgroundColor: getCssVariable("--glass-surface") || theme.surface,
            borderColor: getCssVariable("--glass-border") || theme.grid,
            borderWidth: 1,
            extraCssText: `box-shadow:${getCssVariable("--glass-shadow") || theme.shadow}; backdrop-filter:${getCssVariable("--glass-blur")};
                            -webkit-backdrop-filter:${getCssVariable("--glass-blur")};border-radius:${theme.radius};padding:8px;`,
            textStyle: {
                color: theme.text, fontFamily: theme.fontFamily,
                fontSize: theme.tooltipFontSize,
            },

            formatter:
                getTooltipFormatter(chartData, theme),
        },

        xAxis:
            isHorizontal
                ? {
                      type: "value",

                      name: chartData .yAxis ?.label ?? "",

                      nameLocation: "middle",
                      nameGap: 30,

                      nameTextStyle: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize: theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisLabel: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize: theme.fontSize,
                          hideOverlap:
                              true,

                          formatter:
                              (value) =>
                                  formatRevenueAxisValue(
                                      value,
                                      yAxisRevenueDisplayConfig,
                                      chartData
                                          .yAxis
                                          ?.dataType
                                  ),
                      },
                  }
                : useCategoryX
                  ? {
                        type: "category",
                        name: chartData.xAxis ?.label ?? "",
                        data: xValues,
                        boundaryGap: chartType === "bar" ||
                            chartType === "grouped-bar" ||
                            chartType ===  "stacked-bar",
                        nameLocation: "middle",
                        nameGap: showAllCategoryLabels
                            ? fillAvailableSpace ? 36 : 44
                            : 26,
                        nameTextStyle: {
                            color: theme.axis,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize,
                        },

                        axisLine: {
                            lineStyle: {
                                color: theme.grid,
                            },
                        },

                        axisTick: {
                            lineStyle: {
                                color: theme.grid,
                            },
                        },

                        axisLabel: {
                            color: theme.axis,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize,
                            hideOverlap: fillAvailableSpace ? false : !showAllCategoryLabels,
                            interval: fillAvailableSpace || showAllCategoryLabels ? 0 : "auto",
                            rotate: showAllCategoryLabels
                                ? fillAvailableSpace ? 28 : 35
                                : chartType === "grouped-bar" ? 18 : 0,
                            margin: fillAvailableSpace && showAllCategoryLabels
                                ? 10
                                : showAllCategoryLabels
                                ? 12
                                : chartType === "grouped-bar" ? 10 : 6,
                            width: showAllCategoryLabels
                                ? fillAvailableSpace ? 116 : 132
                                : undefined,
                            overflow: showAllCategoryLabels ? "break" : undefined,
                            align: showAllCategoryLabels ? "right" : undefined,
                            fontWeight: richChart ? 500 : undefined,
                        },
                    }
                  : {
                        type: "value",
                        name: chartData
                                .xAxis
                                ?.label ??
                            "",

                        nameLocation: "middle",
                        nameGap: 26,

                        nameTextStyle: {
                            color: theme.axis,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize,
                        },

                        axisLine: {
                            lineStyle: {
                                color: theme.grid,
                            },
                        },

                        axisTick: {
                            lineStyle: {
                                color: theme.grid,
                            },
                        },

                        axisLabel: {
                            color: theme.axis,
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSize,

                            formatter:
                                (value) =>
                                    formatRevenueAxisValue(
                                        value,
                                        xAxisRevenueDisplayConfig,
                                        chartData
                                            .xAxis
                                            ?.dataType
                                    ),
                        },
                    },

        yAxis:
            isHorizontal
                ? {
                      type: "category",

                      name:
                          chartData
                              .xAxis
                              ?.label ??
                          "",

                      nameLocation: "middle",
                      nameGap: 30,

                      data:
                          xValues,

                      nameTextStyle: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize: theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisLabel: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                          hideOverlap:
                              true,
                      },
                  }
                : {
                      type: "value",

                      name:
                          chartType === "grouped-bar"
                              ? chartData.yAxes?.[0]?.revenueDisplayConfig ||
                                  isRevenueField(chartData.yAxes?.[0]?.field)
                                  ? chartTitles?.groupedRevenueYAxis || chartData.yAxis?.label || ""
                                  : chartTitles?.groupedCountYAxis || chartData.yAxis?.label || ""
                              : chartData
                                    .yAxis
                                    ?.label ??
                                "",

                      nameLocation: "middle",
                      nameGap: 30,

                      nameTextStyle: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize: theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color: theme.grid,
                          },
                      },

                      axisLabel: {
                          color: theme.axis,
                          fontFamily: theme.fontFamily,
                          fontSize: theme.fontSize,
                          formatter:
                              (value) =>
                                  formatRevenueAxisValue(
                                      value,
                                      yAxisRevenueDisplayConfig,
                                      chartData
                                          .yAxis
                                          ?.dataType
                                  ),
                      },
                      splitLine: {
                          show: fillAvailableSpace && chartType === "grouped-bar",
                          lineStyle: {
                              color: theme.grid,
                              opacity: 0.55,
                              type: "dashed",
                          },
                      },
                  },
    };
}

function blendHexColor(color, target, amount) {
    const hex = color.replace("#", "");
    const channels = [0, 2, 4].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16);
        return Math.round(channel + (target - channel) * amount)
            .toString(16)
            .padStart(2, "0");
    });

    return `#${channels.join("")}`;
}

function getCartesianSeries(
    chartData,
    chartType,
    theme,
    richChart
) {
    const dataLength =
        chartData.data.length;

    const largeMode =
        dataLength >
        LARGE_DATA_THRESHOLD;

    const values =
        chartData.data.map(
            (item) =>
                Number(item.y)
        );

    const yAxisLabel =
        chartData.yAxis
            ?.label ?? "";

    if (
        chartType === "line"
    ) {
        return [
            {
                type: "line",

                name:
                    yAxisLabel,

                data:
                    values,

                smooth: true,

                showSymbol:
                    dataLength <=
                    SYMBOL_DATA_THRESHOLD,

                symbolSize: 6,

                lineStyle: {
                    color:
                        theme.primary,
                    width: 2,
                },

                itemStyle: {
                    color:
                        theme.primary,
                },

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                        borderColor:
                            theme.surface,
                        borderWidth: 2,
                    },
                    symbolSize: 6,
                },

                progressive:
                    dataLength >
                    PROGRESSIVE_DATA_THRESHOLD
                        ? 2000
                        : 0,

                progressiveThreshold:
                    PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    if (
        chartType === "bar"
    ) {
        return [
            {
                type: "bar",

                name:
                    yAxisLabel,

                data:
                    values,

                large:
                    largeMode,

                largeThreshold:
                    LARGE_DATA_THRESHOLD,

                barMaxWidth: 42,

                itemStyle: {
                    color:
                        theme.primary,
                    borderRadius:
                        BAR_RADIUS,
                },

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                    },
                },

                progressive:
                    dataLength >
                    PROGRESSIVE_DATA_THRESHOLD
                        ? 2000
                        : 0,

                progressiveThreshold:
                    PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    if (chartType === "grouped-bar") {
        return chartData.yAxes.map(
            (axis, index) => {
                const color = getChartColor(index);
                return {
                    type: "bar",
                    name: axis.label,
                    data: chartData.data.map(
                        (item) => Number(item[axis.field])
                    ),
                    large: largeMode,
                    largeThreshold: LARGE_DATA_THRESHOLD,
                    barMaxWidth: richChart ? 48 : 42,
                    barCategoryGap: richChart ? "34%" : "20%",
                    itemStyle: {
                        color: richChart
                            ? {
                                type: "linear",
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: blendHexColor(color, 255, 0.28) },
                                    { offset: 0.38, color },
                                    { offset: 1, color: blendHexColor(color, 0, 0.2) },
                                ],
                            }
                            : color,
                        borderRadius: richChart ? [10, 10, 3, 3] : BAR_RADIUS,
                        shadowBlur: richChart ? 12 : 0,
                        shadowColor: richChart ? `${color}42` : "transparent",
                        shadowOffsetY: richChart ? 5 : 0,
                    },
                    emphasis: {
                        focus: "series",
                        itemStyle: richChart
                            ? {
                                shadowBlur: 20,
                                shadowColor: `${color}70`,
                                shadowOffsetY: 7,
                            }
                            : undefined,
                    },
                    progressive: dataLength > PROGRESSIVE_DATA_THRESHOLD ? 2000 : 0,
                    progressiveThreshold: PROGRESSIVE_THRESHOLD,
                };
            }
        );
    }

    if (chartType === "area") {
        return [
            {
                type: "line",
                name: yAxisLabel,
                data: values,
                smooth: true,
                showSymbol: dataLength <= SYMBOL_DATA_THRESHOLD,
                symbolSize: 6,
                lineStyle: {width: 2},
                itemStyle: {color: theme.primary},
                areaStyle: {opacity: 0.16},

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                    },

                    areaStyle: {
                        color:
                            theme.primaryHover,
                        opacity: 0.22,
                    },
                },

                progressive:
                    dataLength >
                    PROGRESSIVE_DATA_THRESHOLD
                        ? 2000
                        : 0,

                progressiveThreshold:
                    PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    if (chartType ===  "scatter") {
        return [
            {
                type: "scatter",
                name: yAxisLabel,
                data: chartData.data.map((item) => [Number(item.x), Number(item.y)]),
                symbol: "circle",
                symbolSize: dataLength > LARGE_DATA_THRESHOLD ? 5 : 8,
                large: largeMode,
                largeThreshold: LARGE_DATA_THRESHOLD,
                itemStyle: {color: theme.primary},

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                        borderColor:
                            theme.surface,
                        borderWidth: 2,
                    },
                },

                progressive: dataLength > PROGRESSIVE_DATA_THRESHOLD ? 3000 : 0,
                progressiveThreshold: PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    if (chartType === "composed") {
        return [
            {
                type: "bar",
                name: yAxisLabel,
                data: values,
                barMaxWidth: 42,
                large: largeMode,
                largeThreshold: LARGE_DATA_THRESHOLD,
                itemStyle: {color: theme.primary, borderRadius: BAR_RADIUS}
            },

            {
                type: "line",
                name: yAxisLabel,
                data: values,
                smooth: true,
                showSymbol: dataLength <= SYMBOL_DATA_THRESHOLD,
                symbolSize: 6,
                lineStyle: {color: CHART_COLORS[1], width: 2},
                itemStyle: {color: CHART_COLORS[1]}
            },
        ];
    }

    if (chartType === "stacked-bar") {
        return chartData.yAxes.map(
            (axis, index) => ({
                type: "bar",
                name: axis.label,
                data: chartData.data.map(
                        (item) =>
                            Number(
                                item[
                                    axis.field
                                ]
                            )
                    ),

                stack: "stacked",
                large: largeMode,
                largeThreshold: LARGE_DATA_THRESHOLD,
                barMaxWidth: 42,
                itemStyle: {
                    color:
                        getChartColor(
                            index
                        ),

                    borderRadius: index === chartData .yAxes .length - 1 ? BAR_RADIUS : [0, 0, 0, 0],
                },
            })
        );
    }

    if (
        chartType ===
        "stacked-area"
    ) {
        return chartData.yAxes.map(
            (axis, index) => {
                const color =
                    getChartColor(
                        index
                    );

                return {
                    type: "line",

                    name:
                        axis.label,

                    data:
                        chartData.data.map(
                            (item) =>
                                Number(
                                    item[
                                        axis.field
                                    ]
                                )
                        ),

                    stack:
                        "stacked",

                    smooth: true,

                    showSymbol:
                        dataLength <=
                        SYMBOL_DATA_THRESHOLD,

                    symbolSize: 6,

                    lineStyle: {
                        color,
                        width: 2,
                    },

                    itemStyle: {
                        color,
                    },

                    areaStyle: {
                        color,
                        opacity: 0.18,
                    },

                    emphasis: {
                        itemStyle: {
                            color:
                                theme.primaryHover,
                        },
                    },
                };
            }
        );
    }

    if (
        chartType ===
        "horizontal-bar"
    ) {
        return [
            {
                type: "bar",

                name:
                    yAxisLabel,

                data:
                    values,

                large:
                    largeMode,

                largeThreshold:
                    LARGE_DATA_THRESHOLD,

                barMaxWidth: 42,

                itemStyle: {
                    color:
                        theme.primary,
                    borderRadius:
                        HORIZONTAL_BAR_RADIUS,
                },

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                    },
                },

                progressive:
                    dataLength >
                    PROGRESSIVE_DATA_THRESHOLD
                        ? 2000
                        : 0,

                progressiveThreshold:
                    PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    return [];
}

function getRenderablePieData(
    data
) {
    if (
        !Array.isArray(data)
    ) {
        return [];
    }

    return data.filter(
        (item) => {
            const numericValue =
                Number(
                    item?.y
                );

            return (
                Number.isFinite(
                    numericValue
                ) &&
                Math.abs(
                    numericValue
                ) > 0
            );
        }
    );
}

function getPieData(
    data,
    theme,
    dataType,
    revenueDisplayConfig,
    richChart = false
) {
    const renderableData =
        getRenderablePieData(
            data
        );

    const total =
        renderableData.reduce(
            (sum, item) =>
                sum +
                Math.abs(
                    Number(
                        item?.y
                    ) || 0
                ),
            0
        );

    const showLabels =
        renderableData.length <=
        50;

    return renderableData.map(
        (item, index) => {
            const value =
                Number(item.y);

            const percent =
                total > 0
                    ? Math.abs(
                          value
                      ) / total
                    : 0;

            const useOutsideLabel = percent < PIE_OUTSIDE_LABEL_THRESHOLD;

            const formattedValue =
                formatRevenueAxisValue(
                    value,
                    revenueDisplayConfig,
                    dataType
                );

            const labelText = `${String(item.x ?? "" )} - ${formattedValue} (${(percent * 100).toFixed(1)}%)`;

            const insideLabel = `${formattedValue} (${(percent * 100).toFixed(1)}%)`;
            const color = getChartColor(index);

            return {
                name: String(
                    item.x ?? ""
                ),

                value:
                    Math.abs(
                        value
                    ),

                itemStyle: {
                    color: richChart
                        ? {
                            type: "linear",
                            x: 0.1,
                            y: 0,
                            x2: 0.9,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: blendHexColor(color, 255, 0.34) },
                                { offset: 0.52, color },
                                { offset: 1, color: blendHexColor(color, 0, 0.18) },
                            ],
                        }
                        : color,
                    shadowBlur: richChart ? 16 : 0,
                    shadowColor: richChart ? `${color}55` : "transparent",
                    shadowOffsetY: richChart ? 6 : 0,
                },

                label: {
                    show:
                        showLabels,

                    position:
                        useOutsideLabel
                            ? "outside"
                            : "inside",

                    color:
                        theme.text,

                    fontFamily:
                        theme.fontFamily,

                    fontSize:
                        richChart ? theme.fontSize + 1 : theme.fontSize,

                    fontWeight: 500,

                    textBorderColor: richChart ? theme.surface : undefined,
                    textBorderWidth: richChart ? 4 : 0,
                    distanceToLabelLine: richChart ? 5 : undefined,

                    formatter:
                        richChart || useOutsideLabel
                            ? labelText
                            : insideLabel,
                },

                labelLine: {
                    show:
                        showLabels &&
                        (richChart || useOutsideLabel),

                    length: richChart ? 22 : 18,
                    length2: richChart ? 30 : 24,
                    lineStyle: richChart
                        ? { color: `${color}99`, width: 1.5 }
                        : undefined,
                },
            };
        }
    );
}

function getPieOption(
    chartData,
    theme,
    richChart = false
) {
    const revenueDisplayConfig =
        getChartRevenueDisplayConfig(
            chartData
        );

    const revenueUnitTitle =
        getRevenueUnitTitle(
            chartData,
            theme
        );

    const pieData =
        getPieData(
            chartData.data,
            theme,
            chartData.yAxis
                ?.dataType,
            revenueDisplayConfig,
            richChart
        );

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        animationDuration: richChart ? 900 : undefined,
        animationDurationUpdate: richChart ? 700 : undefined,
        animationEasing: richChart ? "cubicOut" : undefined,
        animationEasingUpdate: richChart ? "cubicOut" : undefined,

        title:
            revenueUnitTitle
                ? revenueUnitTitle
                : undefined,

        tooltip: {
            trigger: "item",

            backgroundColor:
                getCssVariable("--glass-surface") || theme.surface,

            borderWidth: 1,

            extraCssText:
                `box-shadow:${getCssVariable("--glass-shadow") || theme.shadow};backdrop-filter:${getCssVariable("--glass-blur")};-webkit-backdrop-filter:${getCssVariable("--glass-blur")};border-radius:${theme.radius};padding:8px;`,

            textStyle: {
                color: theme.text,
                fontFamily: theme.fontFamily,
                fontSize: theme.tooltipFontSize,
            },

            formatter: (params) => {
                const exactValue =
                    formatRevenueTooltipValue(
                        params.value,
                        revenueDisplayConfig,
                        chartData.yAxis ?.dataType
                    );
                const valueLabel = chartData.yAxis?.label || "Value";

                return `
                    <div style="font-family:${theme.fontFamily};font-size:${theme.tooltipFontSize}px;color:${theme.text}">
                        <div style="margin-bottom:4px;color:${params.color};font-weight:600;">${escapeHtml(params.name ?? "")}</div>
                        <div>${escapeHtml(valueLabel)}: ${escapeHtml(exactValue)}</div>
                        <div>Percentage: ${Number(
                            params.percent ??
                                0
                        ).toFixed(
                            1
                        )}%</div>
                    </div>
                `;
            },
        },

        series: [
            {
                type: "pie",
                radius: richChart ? "68%" : ["0%", "62%"],
                center: ["50%", "50%"],
                startAngle: 90,
                clockwise: true,
                padAngle: richChart ? 2 : 0,
                selectedMode: richChart ? "single" : false,
                selectedOffset: richChart ? 16 : 0,
                hoverOffset: richChart ? 12 : 0,
                avoidLabelOverlap: pieData.length <= 50,
                minAngle: pieData.length > 100 ? 0.5 : 2,

                ...(pieData.length <=
                50
                    ? {
                          labelLayout: {
                              hideOverlap:
                                  true,
                              moveOverlap:
                                  "shiftY",
                          },
                      }
                    : {}),

                itemStyle: {
                    borderColor:
                        theme.surface,

                    borderWidth: richChart ? 4 : 1,
                    borderRadius: richChart ? 5 : 0,
                    shadowBlur: richChart ? 18 : 0,
                    shadowColor: richChart ? "rgb(35 55 75 / 20%)" : "transparent",
                    shadowOffsetY: richChart ? 7 : 0,
                },

                data:
                    pieData,
                emphasis: {
                    scale: richChart,
                    scaleSize: richChart ? 10 : 0,
                    itemStyle: {
                        shadowBlur: richChart ? 24 : 0,
                        shadowColor: "rgb(35 55 75 / 30%)",
                    },
                },
            },
        ],
    };
}

function getRadarOption(
    chartData,
    theme
) {
    const maxValue =
        chartData.data.reduce(
            (
                currentMax,
                item
            ) =>
                Math.max(
                    currentMax,
                    Number(
                        item.y
                    ) || 0
                ),
            0
        );

    const indicatorMax = maxValue > 0 ? maxValue * 1.1 : 1;
    const revenueDisplayConfig = getChartRevenueDisplayConfig(chartData);

    const revenueUnitTitle = getRevenueUnitTitle(chartData, theme);

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        title: revenueUnitTitle ? revenueUnitTitle : undefined,

        tooltip: {
            trigger: "item",

            backgroundColor: getCssVariable("--glass-surface") || theme.surface,

            extraCssText: `box-shadow:${getCssVariable("--glass-shadow") || theme.shadow};backdrop-filter:${getCssVariable("--glass-blur")};-webkit-backdrop-filter:${getCssVariable("--glass-blur")};border-radius:${theme.radius};padding:8px;`,

            textStyle: {
                color: theme.text,
                fontFamily: theme.fontFamily,
                fontSize: theme.tooltipFontSize,
            },

            formatter: (params) => {
                const item =
                    Array.isArray(
                        params
                    )
                        ? params[0]
                        : params;

                const values =
                    Array.isArray(
                        item?.value
                    )
                        ? item.value
                        : [];

                const indicators =
                    chartData.data.map(
                        (
                            dataItem,
                            index
                        ) =>
                            `${escapeHtml(
                                dataItem.x ??
                                    ""
                            )}: ${escapeHtml(formatRevenueTooltipValue(
                                values[
                                    index
                                ],
                                revenueDisplayConfig,
                                chartData
                                    .yAxis
                                    ?.dataType
                            ))}`
                    );

                return `
                    <div style="font-family:${theme.fontFamily};font-size:${theme.tooltipFontSize}px;color:${theme.text}">
                        <div style="margin-bottom:4px;color:${theme.primary};font-weight:600;">${escapeHtml(
                            chartData
                                .yAxis
                                ?.label ??
                                "Value"
                        )}</div>
                        ${indicators.join(
                            "<br />"
                        )}
                    </div>
                `;
            },
        },

        radar: {
            center: [
                "50%",
                "50%",
            ],

            radius: "70%",

            indicator:
                chartData.data.map(
                    (item) => ({
                        name: String(
                            item.x ?? ""
                        ),

                        max:
                            indicatorMax,
                    })
                ),

            axisName: {
                color:
                    theme.axis,
                fontFamily:
                    theme.fontFamily,
                fontSize:
                    theme.fontSize,
            },

            splitLine: {
                lineStyle: {
                    color:
                        theme.grid,
                },
            },

            splitArea: {
                areaStyle: {
                    color: [
                        "transparent",
                    ],
                },
            },

            axisLine: {
                lineStyle: {
                    color:
                        theme.grid,
                },
            },
        },

        series: [
            {
                type: "radar",

                name:
                    chartData
                        .yAxis
                        ?.label ?? "",

                data: [
                    {
                        value:
                            chartData.data.map(
                                (item) =>
                                    Number(
                                        item.y
                                    )
                            ),

                        name:
                            chartData
                                .yAxis
                                ?.label ?? "",

                        symbol:
                            "circle",

                        symbolSize: 6,

                        lineStyle: {
                            color:
                                theme.primary,
                            width: 2,
                        },

                        itemStyle: {
                            color:
                                theme.primary,
                        },

                        areaStyle: {
                            color:
                                theme.primary,
                            opacity:
                                0.18,
                        },
                    },
                ],
            },
        ],
    };
}

function PieLegend({
    data,
    dataType,
    revenueDisplayConfig,
}) {
    const total =
        data.reduce(
            (sum, item) =>
                sum +
                Math.abs(
                    Number(
                        item.y
                    ) || 0
                ),
            0
        );

    return (
        <div className="pie-chart-legend">
            {data.map(
                (
                    item,
                    index
                ) => {
                    const value =
                        Number(
                            item.y
                        ) || 0;

                    const percent =
                        total > 0
                            ? (Math.abs(
                                  value
                              ) /
                                  total) *
                              100
                            : 0;

                    return (
                        <div
                            key={`pie-legend-${index}`}
                            className="pie-chart-legend-item"
                        >
                            <span
                                className="pie-chart-legend-color"
                                style={{
                                    backgroundColor:
                                        getChartColor(
                                            index
                                        ),
                                }}
                                aria-hidden="true"
                            />

                            <div className="pie-chart-legend-content">
                                <span className="pie-chart-legend-name">
                                    {String(
                                        item.x
                                    )}
                                </span>

                                <span className="pie-chart-legend-value">
                                    {formatRevenueAxisValue(
                                        value,
                                        revenueDisplayConfig,
                                        dataType
                                    )}{" "}
                                    (
                                    {percent.toFixed(
                                        1
                                    )}
                                    %)
                                </span>
                            </div>
                        </div>
                    );
                }
            )}
        </div>
    );
}

function LegendArrowIcon({
    isOpen,
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d={
                    isOpen
                        ? "M 6 9 L 12 15 L 18 9"
                        : "M 6 15 L 12 9 L 18 15"
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ChartRenderer({
    chartData,
    chartType,
    richChart = false,
    fillAvailableSpace = false,
    chartTitles,
    onDataPointClick,
}) {
    const chartRef =
        useRef(null);

    const chartInstanceRef =
        useRef(null);

    const [
        isLegendOpen,
        setIsLegendOpen,
    ] = useState(false);

    const [
        isChartReady,
        setIsChartReady,
    ] = useState(false);

    const isPieChart = chartType === "pie";

    useEffect(() => {
        const chartElement =
            chartRef.current;

        if (!chartElement) {
            return undefined;
        }

        const initializeChart =
            () => {
                if (
                    chartInstanceRef.current
                ) {
                    return chartInstanceRef.current;
                }

                if (
                    chartElement.clientWidth ===
                        0 ||
                    chartElement.clientHeight ===
                        0
                ) {
                    return null;
                }

                const chart =
                    echarts.init(
                        chartElement,
                        null,
                        {
                            renderer:
                                "canvas",
                        }
                    );

                chartInstanceRef.current =
                    chart;

                setIsChartReady(
                    true
                );

                return chart;
            };

        const resizeObserver =
            new ResizeObserver(
                () => {
                    const chart =
                        initializeChart();

                    if (
                        chart &&
                        chartElement.clientWidth >
                            0 &&
                        chartElement.clientHeight >
                            0
                    ) {
                        chart.resize();
                    }
                }
            );

        resizeObserver.observe(
            chartElement
        );

        initializeChart();

        return () => {
            resizeObserver.disconnect();

            chartInstanceRef.current?.dispose();

            chartInstanceRef.current =
                null;

            setIsChartReady(
                false
            );
        };
    }, []);

    useEffect(() => {
        const chart =
            chartInstanceRef.current;

        if (
            !chart ||
            !chartData ||
            !Array.isArray(
                chartData.data
            ) ||
            chartData.data.length ===
                0
        ) {
            return;
        }

        const theme =
            getChartTheme();

        let option;

        if (isPieChart) {
            option =
                getPieOption(
                    chartData,
                    theme,
                    richChart
                );
        } else if (
            chartType === "radar"
        ) {
            option =
                getRadarOption(
                    chartData,
                    theme
                );
        } else {
            option = {
                ...getCartesianBaseOption(
                    chartData,
                    theme,
                    chartType,
                    richChart,
                    chartTitles,
                    fillAvailableSpace
                ),

                series:
                    getCartesianSeries(
                        chartData,
                        chartType,
                        theme,
                        richChart
                    ),
            };
        }

        const revenueUnitTitle =
            getRevenueUnitTitle(
                chartData,
                theme
            );

        if (
            revenueUnitTitle
        ) {
            option.title =
                revenueUnitTitle;
        }

        chart.setOption(
            option,
            {
                lazyUpdate:
                    true,
                replaceMerge: ["series", "xAxis", "yAxis", "legend", "title"],
            }
        );

        chart.resize();
    }, [
        chartData,
        chartType,
        richChart,
        fillAvailableSpace,
        isPieChart,
        isChartReady,
    ]);

    useEffect(() => {
        const chart = chartInstanceRef.current;

        if (!chart || !onDataPointClick) {
            return undefined;
        }

        const handleDataPointClick = (event) => onDataPointClick(event);
        chart.on("click", handleDataPointClick);

        return () => chart.off("click", handleDataPointClick);
    }, [isChartReady, onDataPointClick]);

    if (
        !chartData ||
        !Array.isArray(
            chartData.data
        ) ||
        chartData.data.length ===
            0
    ) {
        return null;
    }

    const pieData =
        isPieChart
            ? getRenderablePieData(
                  chartData.data
              )
            : [];

    return (
        <div
            className={
                isPieChart
                    ? "pie-chart-container"
                    : undefined
            }
            style={{
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
            }}
        >
            <div
                ref={chartRef}
                className={
                    isPieChart
                        ? "pie-chart-plot"
                        : undefined
                }
                style={{
                    width: "100%",
                    height: "100%",
                    minWidth: 0,
                    minHeight: 0,
                }}
            />

            {isPieChart && (
                <div className="pie-chart-toolbar">
                    <button
                        type="button"
                        className="pie-chart-legend-toggle"
                        aria-label={
                            isLegendOpen
                                ? "Close legend"
                                : "Open legend"
                        }
                        aria-expanded={
                            isLegendOpen
                        }
                        aria-controls="pie-chart-legend"
                        onClick={() =>
                            setIsLegendOpen(
                                (
                                    current
                                ) =>
                                    !current
                            )
                        }
                    >
                        <span className="pie-chart-legend-toggle-label">
                            Legend
                        </span>

                        <LegendArrowIcon
                            isOpen={
                                isLegendOpen
                            }
                        />
                    </button>

                    {isLegendOpen && (
                        <div
                            id="pie-chart-legend"
                            className="pie-chart-legend-overlay"
                        >
                            <PieLegend
                                data={
                                    pieData
                                }
                                dataType={
                                    chartData
                                        .yAxis
                                        ?.dataType
                                }
                                revenueDisplayConfig={
                                    chartData
                                        .yAxis
                                        ?.revenueDisplayConfig
                                }
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ChartRenderer;