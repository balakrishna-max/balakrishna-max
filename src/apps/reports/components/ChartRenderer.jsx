import { useEffect, useRef, useState } from "react";

import * as echarts from "echarts/core";
import {
    BarChart,
    LineChart,
    PieChart,
    RadarChart,
    ScatterChart,
} from "echarts/charts";
import {
    GridComponent,
    PolarComponent,
    RadarComponent,
    TitleComponent,
    TooltipComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
    BarChart,
    LineChart,
    PieChart,
    RadarChart,
    ScatterChart,
    GridComponent,
    PolarComponent,
    RadarComponent,
    TitleComponent,
    TooltipComponent,
    LabelLayout,
    CanvasRenderer,
]);

const CHART_COLORS = [
    "#3B82F6",
    "#F97316",
    "#14B87A",
    "#E83E8C",
    "#FACC15",
    "#8B5CF6",
    "#22D3EE",
    "#EF4444",
    "#84CC16",
    "#92400E",
    "#A855F7",
    "#2DD4BF",
    "#FB923C",
    "#38BDF8",
    "#D946EF",
    "#059669",
    "#334155",
    "#FBBF24",
    "#818CF8",
    "#047857",
    "#F43F5E",
    "#0EA5E9",
    "#65A30D",
    "#6D28D9",
    "#67E8F9",
    "#C2410C",
    "#F472B6",
    "#6366F1",
    "#EAB308",
    "#9D174D",
    "#6EE7B7",
    "#B91C1C",
];

const BAR_RADIUS = [6, 6, 0, 0];
const HORIZONTAL_BAR_RADIUS = [0, 6, 6, 0];
const PIE_OUTSIDE_LABEL_THRESHOLD = 0.12;
const ANIMATION_DATA_THRESHOLD = 1000;
const LARGE_DATA_THRESHOLD = 2000;
const SYMBOL_DATA_THRESHOLD = 300;
const PROGRESSIVE_DATA_THRESHOLD = 5000;
const PROGRESSIVE_THRESHOLD = 3000;

const DECIMAL_NUMBER_FORMATTER =
    new Intl.NumberFormat(
        "en-IN",
        {
            useGrouping: true,
            maximumFractionDigits: 20,
        }
    );

const PLAIN_NUMBER_FORMATTER =
    new Intl.NumberFormat(
        "en-US",
        {
            useGrouping: false,
            maximumFractionDigits: 20,
        }
    );

const EXACT_INDIAN_NUMBER_FORMATTER =
    new Intl.NumberFormat(
        "en-IN",
        {
            useGrouping: true,
            maximumFractionDigits: 20,
        }
    );

const SCALED_REVENUE_FORMATTER =
    new Intl.NumberFormat(
        "en-IN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }
    );

const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (character) => HTML_ESCAPES[character]
    );
}

function getChartColor(index) {
    return CHART_COLORS[
        index % CHART_COLORS.length
    ];
}

function getCssVariable(name) {
    return getComputedStyle(
        document.documentElement
    )
        .getPropertyValue(name)
        .trim();
}

function getRootFontSize() {
    return (
        Number.parseFloat(
            getComputedStyle(
                document.documentElement
            ).fontSize
        ) || 13
    );
}

function getFontSize(name) {
    const value =
        getCssVariable(name);

    if (value.endsWith("rem")) {
        return (
            Number.parseFloat(value) *
            getRootFontSize()
        );
    }

    if (value.endsWith("px")) {
        return Number.parseFloat(value);
    }

    return (
        Number.parseFloat(value) || 12
    );
}

function getChartTheme() {
    return {
        primary:
            getCssVariable(
                "--color-primary"
            ),

        primaryHover:
            getCssVariable(
                "--color-primary-hover"
            ),

        grid:
            getCssVariable(
                "--color-border"
            ),

        axis:
            getCssVariable(
                "--color-text-secondary"
            ),

        text:
            getCssVariable(
                "--color-text-dark"
            ),

        surface:
            getCssVariable(
                "--color-surface"
            ),

        fontFamily:
            getCssVariable(
                "--font-family-base"
            ),

        fontSize:
            getFontSize(
                "--font-size-xs"
            ),

        tooltipFontSize:
            getFontSize(
                "--font-size-sm"
            ),

        shadow:
            getCssVariable(
                "--shadow-md"
            ),

        radius:
            getCssVariable(
                "--radius-md"
            ),
    };
}

function formatNumericValue(
    value,
    dataType
) {
    const numericValue =
        Number(value);

    if (
        !Number.isFinite(
            numericValue
        )
    ) {
        return String(
            value ?? "—"
        );
    }

    const normalizedDataType =
        String(
            dataType ?? ""
        ).toUpperCase();

    if (
        normalizedDataType ===
        "DECIMAL"
    ) {
        return DECIMAL_NUMBER_FORMATTER.format(
            numericValue
        );
    }

    return PLAIN_NUMBER_FORMATTER.format(
        numericValue
    );
}

function getChartRevenueDisplayConfig(
    chartData
) {
    const axes =
        Array.isArray(
            chartData?.yAxes
        ) &&
        chartData.yAxes.length > 0
            ? chartData.yAxes
            : chartData?.yAxis
              ? [chartData.yAxis]
              : [];

    if (axes.length === 0) {
        return null;
    }

    const revenueConfigs =
        axes.map(
            (axis) =>
                axis.revenueDisplayConfig
        );

    if (
        revenueConfigs.some(
            (config) =>
                !config
        )
    ) {
        return null;
    }

    const firstConfig =
        revenueConfigs[0];

    const hasSameUnit =
        revenueConfigs.every(
            (config) =>
                config.divisor ===
                    firstConfig.divisor &&
                config.suffix ===
                    firstConfig.suffix
        );

    return hasSameUnit
        ? firstConfig
        : null;
}

function getRevenueUnitLabel(
    revenueDisplayConfig
) {
    if (
        !revenueDisplayConfig
    ) {
        return "";
    }

    switch (
        revenueDisplayConfig.suffix
    ) {
        case "Cr":
            return "In Crores";

        case "L":
            return "In Lakhs";

        case "k":
            return "In Thousands";

        default:
            return "In Rupees";
    }
}

function formatRevenueAxisValue(
    value,
    revenueDisplayConfig,
    dataType
) {
    const numericValue =
        Number(value);

    if (
        !Number.isFinite(
            numericValue
        )
    ) {
        return String(
            value ?? "—"
        );
    }

    if (
        !revenueDisplayConfig
    ) {
        return formatNumericValue(
            numericValue,
            dataType
        );
    }

    const scaledValue =
        numericValue /
        revenueDisplayConfig.divisor;

    return `₹${SCALED_REVENUE_FORMATTER.format(
        scaledValue
    )}`;
}

function formatRevenueTooltipValue(
    value,
    revenueDisplayConfig,
    dataType
) {
    const numericValue =
        Number(value);

    if (
        !Number.isFinite(
            numericValue
        )
    ) {
        return String(
            value ?? "—"
        );
    }

    if (
        !revenueDisplayConfig
    ) {
        return formatNumericValue(
            numericValue,
            dataType
        );
    }

    return `₹${EXACT_INDIAN_NUMBER_FORMATTER.format(
        numericValue
    )}`;
}

function getRevenueUnitTitle(
    chartData,
    theme
) {
    const revenueDisplayConfig =
        getChartRevenueDisplayConfig(
            chartData
        );

    if (
        !revenueDisplayConfig
    ) {
        return null;
    }

    return {
        text: getRevenueUnitLabel(
            revenueDisplayConfig
        ),
        right: 8,
        top: 4,
        textStyle: {
            color: theme.axis,
            fontFamily:
                theme.fontFamily,
            fontSize:
                theme.fontSize,
            fontWeight: 500,
        },
    };
}

function getSeriesDisplayConfig(
    chartData,
    seriesName
) {
    const normalizedSeriesName =
        String(
            seriesName ?? ""
        );

    const matchingAxis =
        chartData.yAxes?.find(
            (axis) =>
                axis.field ===
                    normalizedSeriesName ||
                axis.label ===
                    normalizedSeriesName
        );

    return {
        dataType:
            matchingAxis?.dataType ||
            chartData.yAxis
                ?.dataType ||
            "NUMBER",

        revenueDisplayConfig:
            matchingAxis
                ?.revenueDisplayConfig ||
            chartData.yAxis
                ?.revenueDisplayConfig ||
            null,
    };
}

function getTooltipFormatter(
    chartData,
    theme
) {
    return (params) => {
        const items =
            Array.isArray(params)
                ? params
                : [params];

        if (
            items.length === 0
        ) {
            return "";
        }

        const axisLabel =
            items[0]
                ?.axisValueLabel ??
            items[0]?.name ??
            "";

        const rows = items
            .filter(
                (item) =>
                    item?.value !==
                    undefined
            )
            .map((item) => {
                const rawValue =
                    Array.isArray(
                        item.value
                    )
                        ? item.value[
                              item.value.length -
                                  1
                          ]
                        : item.value;

                const displayConfig =
                    getSeriesDisplayConfig(
                        chartData,
                        item.seriesName
                    );

                const formattedValue =
                    formatRevenueTooltipValue(
                        rawValue,
                        displayConfig.revenueDisplayConfig,
                        displayConfig.dataType
                    );

                const seriesLabel = escapeHtml(
                    item.seriesName ??
                        chartData.yAxis?.label ??
                        "Value"
                );

                return `${item.marker ?? ""}<span style="font-weight:600">${seriesLabel}</span>: ${escapeHtml(formattedValue)}`;
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

function getCartesianBaseOption(
    chartData,
    theme,
    chartType
) {
    const isHorizontal =
        chartType ===
        "horizontal-bar";

    const useCategoryX =
        chartType !==
            "scatter" &&
        chartType !==
            "horizontal-bar";

    const xValues =
        chartData.data.map(
            (item) =>
                String(
                    item.x ?? ""
                )
        );

    const revenueDisplayConfig =
        getChartRevenueDisplayConfig(
            chartData
        );

    const revenueUnitTitle =
        getRevenueUnitTitle(
            chartData,
            theme
        );

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        color:
            CHART_COLORS,

        title:
            revenueUnitTitle
                ? revenueUnitTitle
                : undefined,

        grid: {
            top: revenueUnitTitle
                ? 42
                : 20,
            right: 28,
            bottom: 28,
            left: 28,
            outerBoundsMode:
                "same",
            outerBoundsContain:
                "axisLabel",
        },

        tooltip: {
            trigger:
                chartType ===
                "scatter"
                    ? "item"
                    : "axis",

            axisPointer: {
                type:
                    chartType ===
                        "bar" ||
                    chartType ===
                        "stacked-bar" ||
                    chartType ===
                        "horizontal-bar"
                        ? "shadow"
                        : "line",
            },

            backgroundColor:
                theme.surface,

            borderColor:
                theme.grid,

            borderWidth: 1,

            extraCssText:
                `box-shadow:${theme.shadow};border-radius:${theme.radius};padding:8px;`,

            textStyle: {
                color:
                    theme.text,
                fontFamily:
                    theme.fontFamily,
                fontSize:
                    theme.tooltipFontSize,
            },

            formatter:
                getTooltipFormatter(
                    chartData,
                    theme
                ),
        },

        xAxis:
            isHorizontal
                ? {
                      type: "value",

                      name:
                          chartData
                              .yAxis
                              ?.label ??
                          "",

                      nameTextStyle: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisLabel: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                          hideOverlap:
                              true,

                          formatter:
                              (value) =>
                                  formatRevenueAxisValue(
                                      value,
                                      revenueDisplayConfig,
                                      chartData
                                          .yAxis
                                          ?.dataType
                                  ),
                      },
                  }
                : useCategoryX
                  ? {
                        type: "category",

                        name:
                            chartData
                                .xAxis
                                ?.label ??
                            "",

                        data:
                            xValues,

                        boundaryGap:
                            chartType ===
                                "bar" ||
                            chartType ===
                                "stacked-bar",

                        nameTextStyle: {
                            color:
                                theme.axis,
                            fontFamily:
                                theme.fontFamily,
                            fontSize:
                                theme.fontSize,
                        },

                        axisLine: {
                            lineStyle: {
                                color:
                                    theme.grid,
                            },
                        },

                        axisTick: {
                            lineStyle: {
                                color:
                                    theme.grid,
                            },
                        },

                        axisLabel: {
                            color:
                                theme.axis,
                            fontFamily:
                                theme.fontFamily,
                            fontSize:
                                theme.fontSize,
                            hideOverlap:
                                true,
                        },
                    }
                  : {
                        type: "value",

                        name:
                            chartData
                                .xAxis
                                ?.label ??
                            "",

                        nameTextStyle: {
                            color:
                                theme.axis,
                            fontFamily:
                                theme.fontFamily,
                            fontSize:
                                theme.fontSize,
                        },

                        axisLine: {
                            lineStyle: {
                                color:
                                    theme.grid,
                            },
                        },

                        axisTick: {
                            lineStyle: {
                                color:
                                    theme.grid,
                            },
                        },

                        axisLabel: {
                            color:
                                theme.axis,
                            fontFamily:
                                theme.fontFamily,
                            fontSize:
                                theme.fontSize,

                            formatter:
                                (value) =>
                                    formatNumericValue(
                                        value,
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

                      data:
                          xValues,

                      nameTextStyle: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisLabel: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                          hideOverlap:
                              true,
                      },
                  }
                : {
                      type: "value",

                      name:
                          chartData
                              .yAxis
                              ?.label ??
                          "",

                      nameTextStyle: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                      },

                      axisLine: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisTick: {
                          lineStyle: {
                              color:
                                  theme.grid,
                          },
                      },

                      axisLabel: {
                          color:
                              theme.axis,
                          fontFamily:
                              theme.fontFamily,
                          fontSize:
                              theme.fontSize,
                          formatter:
                              (value) =>
                                  formatRevenueAxisValue(
                                      value,
                                      revenueDisplayConfig,
                                      chartData
                                          .yAxis
                                          ?.dataType
                                  ),
                      },
                  },
    };
}

function getCartesianSeries(
    chartData,
    chartType,
    theme
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

    if (
        chartType === "area"
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
                    width: 2,
                },

                itemStyle: {
                    color:
                        theme.primary,
                },

                areaStyle: {
                    opacity: 0.16,
                },

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

    if (
        chartType ===
        "scatter"
    ) {
        return [
            {
                type: "scatter",

                name:
                    yAxisLabel,

                data:
                    chartData.data.map(
                        (item) => [
                            Number(
                                item.x
                            ),
                            Number(
                                item.y
                            ),
                        ]
                    ),

                symbol: "circle",

                symbolSize:
                    dataLength >
                    LARGE_DATA_THRESHOLD
                        ? 5
                        : 8,

                large:
                    largeMode,

                largeThreshold:
                    LARGE_DATA_THRESHOLD,

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
                },

                progressive:
                    dataLength >
                    PROGRESSIVE_DATA_THRESHOLD
                        ? 3000
                        : 0,

                progressiveThreshold:
                    PROGRESSIVE_THRESHOLD,
            },
        ];
    }

    if (
        chartType ===
        "composed"
    ) {
        return [
            {
                type: "bar",

                name:
                    yAxisLabel,

                data:
                    values,

                barMaxWidth: 42,

                large:
                    largeMode,

                largeThreshold:
                    LARGE_DATA_THRESHOLD,

                itemStyle: {
                    color:
                        theme.primary,
                    borderRadius:
                        BAR_RADIUS,
                },
            },

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
                        CHART_COLORS[1],
                    width: 2,
                },

                itemStyle: {
                    color:
                        CHART_COLORS[1],
                },
            },
        ];
    }

    if (
        chartType ===
        "stacked-bar"
    ) {
        return chartData.yAxes.map(
            (axis, index) => ({
                type: "bar",

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

                large:
                    largeMode,

                largeThreshold:
                    LARGE_DATA_THRESHOLD,

                barMaxWidth: 42,

                itemStyle: {
                    color:
                        getChartColor(
                            index
                        ),

                    borderRadius:
                        index ===
                        chartData
                            .yAxes
                            .length -
                            1
                            ? BAR_RADIUS
                            : [
                                  0,
                                  0,
                                  0,
                                  0,
                              ],
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
    revenueDisplayConfig
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

            return {
                name: String(
                    item.x ?? ""
                ),

                value:
                    Math.abs(
                        value
                    ),

                itemStyle: {
                    color:
                        getChartColor(
                            index
                        ),
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
                        theme.fontSize,

                    fontWeight: 500,

                    formatter:
                        useOutsideLabel
                            ? labelText
                            : insideLabel,
                },

                labelLine: {
                    show:
                        showLabels &&
                        useOutsideLabel,

                    length: 18,
                    length2: 24,
                },
            };
        }
    );
}

function getPieOption(
    chartData,
    chartType,
    theme
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
            revenueDisplayConfig
        );

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        title:
            revenueUnitTitle
                ? revenueUnitTitle
                : undefined,

        tooltip: {
            trigger: "item",

            backgroundColor:
                theme.surface,

            borderColor:
                theme.grid,

            borderWidth: 1,

            extraCssText:
                `box-shadow:${theme.shadow};border-radius:${theme.radius};padding:8px;`,

            textStyle: {
                color:
                    theme.text,
                fontFamily:
                    theme.fontFamily,
                fontSize:
                    theme.tooltipFontSize,
            },

            formatter: (params) => {
                const exactValue =
                    formatRevenueTooltipValue(
                        params.value,
                        revenueDisplayConfig,
                        chartData
                            .yAxis
                            ?.dataType
                    );
                const valueLabel =
                    chartData.yAxis?.label ||
                    "Value";

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
                radius: chartType === "donut" ? ["45%", "62%"] : ["0%", "62%"],
                center: ["50%","50%"],
                startAngle: 90,
                clockwise: true,
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

                    borderWidth: 1,
                },

                data:
                    pieData,
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

    const indicatorMax =
        maxValue > 0
            ? maxValue * 1.1
            : 1;

    const revenueDisplayConfig =
        getChartRevenueDisplayConfig(
            chartData
        );

    const revenueUnitTitle =
        getRevenueUnitTitle(
            chartData,
            theme
        );

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        title:
            revenueUnitTitle
                ? revenueUnitTitle
                : undefined,

        tooltip: {
            trigger: "item",

            backgroundColor:
                theme.surface,

            borderColor:
                theme.grid,

            borderWidth: 1,

            textStyle: {
                color:
                    theme.text,
                fontFamily:
                    theme.fontFamily,
                fontSize:
                    theme.tooltipFontSize,
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

function getRadialOption(
    chartData,
    theme
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

    return {
        animation:
            chartData.data.length <
            ANIMATION_DATA_THRESHOLD,

        animationThreshold:
            ANIMATION_DATA_THRESHOLD,

        title:
            revenueUnitTitle
                ? revenueUnitTitle
                : undefined,

        tooltip: {
            trigger: "item",

            backgroundColor:
                theme.surface,

            borderColor:
                theme.grid,

            borderWidth: 1,

            textStyle: {
                color:
                    theme.text,
                fontFamily:
                    theme.fontFamily,
                fontSize:
                    theme.tooltipFontSize,
            },

            formatter: (params) => {
                const item =
                    Array.isArray(
                        params
                    )
                        ? params[0]
                        : params;

                const exactValue =
                    formatRevenueTooltipValue(
                        item?.value,
                        revenueDisplayConfig,
                        chartData
                            .yAxis
                            ?.dataType
                    );

                return `
                    <div style="font-family:${theme.fontFamily};font-size:${theme.tooltipFontSize}px;color:${theme.text}">
                        <div style="margin-bottom:4px;color:${theme.primary};font-weight:600;">${String(
                            chartData
                                .yAxis
                                ?.label ??
                                "Value"
                        )}</div>
                        <div>Value: ${escapeHtml(exactValue)}</div>
                    </div>
                `;
            },
        },

        polar: {
            radius: [
                "20%",
                "80%",
            ],
        },

        angleAxis: {
            type: "category",

            data:
                chartData.data.map(
                    (item) =>
                        String(
                            item.x ??
                                ""
                        )
                ),

            startAngle: 90,

            axisLine: {
                lineStyle: {
                    color:
                        theme.grid,
                },
            },

            axisLabel: {
                show: false,
            },

            axisTick: {
                show: false,
            },
        },

        radiusAxis: {
            type: "value",

            axisLine: {
                show: false,
            },

            axisTick: {
                show: false,
            },

            axisLabel: {
                show: false,
            },

            splitLine: {
                lineStyle: {
                    color:
                        theme.grid,
                },
            },
        },

        series: [
            {
                type: "bar",

                coordinateSystem:
                    "polar",

                data:
                    chartData.data.map(
                        (item) =>
                            Number(
                                item.y
                            )
                    ),

                roundCap:
                    true,

                barMaxWidth: 36,

                itemStyle: {
                    color:
                        theme.primary,
                },

                emphasis: {
                    itemStyle: {
                        color:
                            theme.primaryHover,
                    },
                },

                label: {
                    show:
                        chartData
                            .data
                            .length <= 20,

                    position:
                        "inside",

                    color:
                        theme.text,

                    fontFamily:
                        theme.fontFamily,

                    fontSize:
                        theme.fontSize,

                    formatter: (
                        params
                    ) =>
                        formatRevenueAxisValue(
                            params.value,
                            revenueDisplayConfig,
                            chartData
                                .yAxis
                                ?.dataType
                        ),
                },
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

    const isPieChart =
        chartType === "pie" ||
        chartType === "donut";

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
                    chartType,
                    theme
                );
        } else if (
            chartType === "radar"
        ) {
            option =
                getRadarOption(
                    chartData,
                    theme
                );
        } else if (
            chartType === "radial"
        ) {
            option =
                getRadialOption(
                    chartData,
                    theme
                );
        } else {
            option = {
                ...getCartesianBaseOption(
                    chartData,
                    theme,
                    chartType
                ),

                series:
                    getCartesianSeries(
                        chartData,
                        chartType,
                        theme
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

        chart.clear();

        chart.setOption(
            option,
            {
                lazyUpdate:
                    true,
            }
        );

        chart.resize();
    }, [
        chartData,
        chartType,
        isPieChart,
        isChartReady,
    ]);

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