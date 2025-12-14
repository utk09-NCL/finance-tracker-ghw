import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  HistogramSeries,
  type ISeriesApi,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { css } from "../../utils/cssUtil";

export type CategoryPoint = {
  category: string;
  value: number;
};

type Props = {
  height?: number;
  dataActual: CategoryPoint[];
  dataProjected?: CategoryPoint[];
};

function toIndexed(data: CategoryPoint[]): HistogramData[] {
  const baseDate = new Date("2025-01-01");
  return data.map((d, idx) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + idx);
    const timeStr = date.toISOString().split("T")[0];
    return { time: timeStr as Time, value: d.value };
  });
}

const timeToDateStr = (time: Time): string => {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().split("T")[0];
  const bd = time as { year: number; month: number; day: number };
  return `${bd.year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;
};

const CategoryChart = ({ height = 300, dataActual, dataProjected = [] }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRefs = useRef<{ [key: string]: ISeriesApi<"Histogram"> }>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const categoryMapShort = new Map<string, string>();
    const categoryMapFull = new Map<string, string>();
    const baseDate = new Date("2025-01-01");

    dataActual.forEach((d, idx) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + idx);
      const timeStr = date.toISOString().split("T")[0];
      categoryMapFull.set(timeStr, d.category);
      const shortName = d.category.length > 12 ? `${d.category.slice(0, 12)}…` : d.category;
      categoryMapShort.set(timeStr, shortName);
    });

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: css("--background-secondary", "#ffffff") },
        textColor: css("--text-color", "#1b1b1b"),
      },
      grid: {
        vertLines: { color: css("--border-light", "#e5e7eb") },
        horzLines: { color: css("--border-light", "#e5e7eb") },
      },
      localization: {
        timeFormatter: (time: Time) => {
          const timeStr = timeToDateStr(time);
          return categoryMapFull.get(timeStr) || timeStr;
        },
      },
      timeScale: {
        barSpacing: 40,
        minBarSpacing: 20,
        tickMarkMaxCharacterLength: 12,
        tickMarkFormatter: (time: Time) => {
          const timeStr = timeToDateStr(time);
          return categoryMapShort.get(timeStr) || timeStr;
        },
      },
    });

    chartRef.current = chart;

    const actual = chart.addSeries(HistogramSeries);
    actual.applyOptions({
      color: css("--secondary-color", "#7f9172"),
      priceFormat: { type: "volume" },
    });
    actual.setData(toIndexed(dataActual));
    seriesRefs.current["actual"] = actual;

    if (dataProjected.length > 0) {
      const proj = chart.addSeries(HistogramSeries);
      proj.applyOptions({
        color: css("--secondary-color-accent", "#567568"),
        priceFormat: { type: "volume" },
      });
      proj.setData(toIndexed(dataProjected));
      seriesRefs.current["projected"] = proj;
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [height, dataActual, dataProjected]);

  return <div ref={containerRef} style={{ width: "100%", position: "relative" }} />;
};

export default CategoryChart;
