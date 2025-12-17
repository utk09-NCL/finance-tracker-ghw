import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  LineStyle,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { css } from "../../utils/cssUtil";

export type YearPoint = {
  year: string | number;
  income: number;
  expenses: number;
};

function yearToTime(year: string | number): Time {
  if (typeof year === "number") {
    return year as Time;
  }
  const normalized = /^\d{4}$/.test(year) ? `${year}-07-01` : year;
  return normalized as Time;
}

function toLineData(points: YearPoint[], type: "income" | "expenses"): LineData[] {
  return points
    .map((p) => ({
      time: yearToTime(p.year),
      value: type === "income" ? p.income : p.expenses,
    }))
    .sort((a, b) => (a.time as string).localeCompare(b.time as string));
}

type Props = {
  height?: number;
  actualData: YearPoint[];
  projectedData?: YearPoint[];
};

const YearlyTrendsChart = ({ height = 300, actualData, projectedData = [] }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRefs = useRef<{ [key: string]: ISeriesApi<"Line"> }>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: {
          type: ColorType.Solid,
          color: css("--background-secondary", "#ffffff"),
        },
        textColor: css("--text-color", "#1b1b1b"),
      },
      grid: {
        vertLines: {
          color: css("--border-light", "#e5e7eb"),
        },
        horzLines: {
          color: css("--border-light", "#e5e7eb"),
        },
      },
      rightPriceScale: {
        borderColor: css("--border-light", "#e5e7eb"),
      },
      timeScale: {
        borderColor: css("--border-light", "#e5e7eb"),
        timeVisible: false,
      },
    });
    chartRef.current = chart;

    // Actual Income - solid green line
    if (actualData.length > 0) {
      const actualIncomeSeries = chart.addSeries(LineSeries);
      actualIncomeSeries.applyOptions({
        color: css("--success-color", "#10b981"),
        lineWidth: 3,
        lineStyle: LineStyle.Solid,
        title: "Actual Income",
        priceFormat: {
          type: "price",
          precision: 0,
          minMove: 1,
        },
      });
      actualIncomeSeries.setData(toLineData(actualData, "income"));
      seriesRefs.current["actualIncome"] = actualIncomeSeries;
    }

    // Actual Expenses - solid red line
    if (actualData.length > 0) {
      const actualExpensesSeries = chart.addSeries(LineSeries);
      actualExpensesSeries.applyOptions({
        color: css("--error-color", "#ef4444"),
        lineWidth: 3,
        lineStyle: LineStyle.Solid,
        title: "Actual Expenses",
        priceFormat: {
          type: "price",
          precision: 0,
          minMove: 1,
        },
      });
      actualExpensesSeries.setData(toLineData(actualData, "expenses"));
      seriesRefs.current["actualExpenses"] = actualExpensesSeries;
    }

    // Projected Income - dotted blue line
    if (projectedData.length > 0) {
      const projIncomeSeries = chart.addSeries(LineSeries);
      projIncomeSeries.applyOptions({
        color: css("--info-color", "#3b82f6"),
        lineWidth: 3,
        lineStyle: LineStyle.Dotted,
        title: "Projected Income",
        priceFormat: {
          type: "price",
          precision: 0,
          minMove: 1,
        },
      });
      projIncomeSeries.setData(toLineData(projectedData, "income"));
      seriesRefs.current["projIncome"] = projIncomeSeries;
    }

    // Projected Expenses - dotted orange line
    if (projectedData.length > 0) {
      const projExpensesSeries = chart.addSeries(LineSeries);
      projExpensesSeries.applyOptions({
        color: css("--warning-color", "#f59e0b"),
        lineWidth: 3,
        lineStyle: LineStyle.Dotted,
        title: "Projected Expenses",
        priceFormat: {
          type: "price",
          precision: 0,
          minMove: 1,
        },
      });
      projExpensesSeries.setData(toLineData(projectedData, "expenses"));
      seriesRefs.current["projExpenses"] = projExpensesSeries;
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [height, actualData, projectedData]);

  return <div ref={containerRef} style={{ width: "100%", position: "relative" }} />;
};

export default YearlyTrendsChart;
