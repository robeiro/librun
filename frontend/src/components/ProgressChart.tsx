"use client";

import React, { useState, useMemo } from "react";
import { ProgressData } from "../types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { 
  TrendingUp, 
  Zap, 
  Heart, 
  Gauge, 
  Calendar, 
  Timer, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  Filter,
  Layers
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ProgressChartProps {
  progress?: ProgressData;
}

type MetricType = "pace" | "efficiency" | "heartrate" | "cadence" | "volume";
type AggregationType = "run" | "week" | "month";
type DistanceFilterType = "all" | "curta" | "media" | "longao";

interface ChartItemData {
  chartX: string;
  tooltipTitle: string;
  valPace: number | null;
  valMovingAvgPace?: number | null;
  valBestPace?: number | null;
  valEfficiency?: number | null;
  valMovingAvgEfficiency?: number | null;
  valHeartRate?: number | null;
  valCadence?: number | null;
  valDistance: number;
  distance_km?: number;
  pace_formatted?: string;
  moving_avg_pace_formatted?: string;
  average_heartrate?: number | null;
  aerobic_efficiency?: number | null;
  average_cadence?: number | null;
  total_km?: number;
  run_count?: number;
  avg_pace_formatted?: string;
  best_pace_formatted?: string;
  avg_heartrate?: number | null;
  avg_efficiency?: number | null;
  avg_cadence?: number | null;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: ChartItemData;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  metric: MetricType;
  aggregation: AggregationType;
}

const formatSecondsToPace = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export const ProgressChart: React.FC<ProgressChartProps> = ({ progress }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [metric, setMetric] = useState<MetricType>("pace");
  const [aggregation, setAggregation] = useState<AggregationType>("run");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilterType>("all");
  const [showTrendline, setShowTrendline] = useState<boolean>(true);

  // Filter and prepare data based on aggregation and filters (unconditional hook)
  const chartData: ChartItemData[] = useMemo(() => {
    const timeline = progress?.timeline || [];
    const weekly = progress?.weekly || [];
    const monthly = progress?.monthly || [];

    if (!timeline.length && !weekly.length) return [];
    if (aggregation === "run") {
      let filtered = timeline;
      if (distanceFilter !== "all") {
        filtered = timeline.filter((p) => p.category === distanceFilter);
      }
      return filtered.map((p) => ({
        ...p,
        chartX: p.date_formatted,
        tooltipTitle: `${p.name} • ${p.full_date}`,
        valPace: p.pace_seconds > 0 ? p.pace_seconds : null,
        valMovingAvgPace: p.moving_avg_pace_seconds > 0 ? p.moving_avg_pace_seconds : null,
        valEfficiency: p.aerobic_efficiency,
        valMovingAvgEfficiency: p.moving_avg_efficiency,
        valHeartRate: p.average_heartrate,
        valCadence: p.average_cadence,
        valDistance: p.distance_km,
      }));
    } else if (aggregation === "week") {
      return weekly.map((w) => ({
        ...w,
        chartX: w.label.split(" - ")[0],
        tooltipTitle: `Semana: ${w.label}`,
        valPace: w.avg_pace_seconds > 0 ? w.avg_pace_seconds : null,
        valBestPace: w.best_pace_seconds > 0 ? w.best_pace_seconds : null,
        valEfficiency: w.avg_efficiency,
        valHeartRate: w.avg_heartrate,
        valCadence: w.avg_cadence,
        valDistance: w.total_km,
      }));
    } else {
      return monthly.map((m) => ({
        ...m,
        chartX: m.label,
        tooltipTitle: `Mês: ${m.label}`,
        valPace: m.avg_pace_seconds > 0 ? m.avg_pace_seconds : null,
        valBestPace: m.best_pace_seconds > 0 ? m.best_pace_seconds : null,
        valEfficiency: m.avg_efficiency,
        valHeartRate: m.avg_heartrate,
        valCadence: m.avg_cadence,
        valDistance: m.total_km,
      }));
    }
  }, [progress, aggregation, distanceFilter]);

  const summary = progress?.summary;
  const hasData = Boolean(progress && (progress.timeline?.length || progress.weekly?.length) && summary);

  if (!hasData || !summary) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        <TrendingUp className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-50" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Sem dados suficientes para o gráfico de progresso
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Conecte sua conta do Strava ou carregue arquivos de corrida para acompanhar sua evolução de ritmo, frequência cardíaca e eficiência aeróbica.
        </p>
      </div>
    );
  }

  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";

  // Custom Tooltip
  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 z-50 min-w-[210px]">
          <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1">
            {d.tooltipTitle}
          </p>

          {aggregation === "run" ? (
            <div className="space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span>Distância:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{d.distance_km} km</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ritmo (Pace):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.pace_formatted}</span>
              </div>
              {d.moving_avg_pace_formatted && (
                <div className="flex justify-between items-center text-[11px] text-teal-600 dark:text-teal-400">
                  <span>Média Móvel (5 corridas):</span>
                  <span className="font-semibold">{d.moving_avg_pace_formatted}</span>
                </div>
              )}
              {d.average_heartrate && (
                <div className="flex justify-between items-center">
                  <span>FC Média:</span>
                  <span className="font-bold text-rose-500">{d.average_heartrate} bpm</span>
                </div>
              )}
              {d.aerobic_efficiency && (
                <div className="flex justify-between items-center text-[11px]">
                  <span>Fator de Eficiência:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{d.aerobic_efficiency} m/bpm</span>
                </div>
              )}
              {d.average_cadence && (
                <div className="flex justify-between items-center">
                  <span>Cadência:</span>
                  <span className="font-bold text-amber-500">{d.average_cadence} spm</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span>Volume Total:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{d.total_km} km ({d.run_count} treinos)</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Pace Médio:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.avg_pace_formatted}</span>
              </div>
              {d.best_pace_formatted && d.best_pace_formatted !== "--:--" && (
                <div className="flex justify-between items-center text-[11px] text-teal-600 dark:text-teal-400">
                  <span>Melhor Pace:</span>
                  <span className="font-semibold">{d.best_pace_formatted}</span>
                </div>
              )}
              {d.avg_heartrate && (
                <div className="flex justify-between items-center">
                  <span>FC Média:</span>
                  <span className="font-bold text-rose-500">{d.avg_heartrate} bpm</span>
                </div>
              )}
              {d.avg_efficiency && (
                <div className="flex justify-between items-center text-[11px]">
                  <span>Eficiência Aeróbica:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{d.avg_efficiency} m/bpm</span>
                </div>
              )}
              {d.avg_cadence && (
                <div className="flex justify-between items-center">
                  <span>Cadência Média:</span>
                  <span className="font-bold text-amber-500">{d.avg_cadence} spm</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative flex flex-col justify-between shadow-sm space-y-6">
      {/* 1. Header with Title and Explanatory Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Evolução & Progresso ao Longo do Tempo
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Acompanhe o ganho real de velocidade, a queda da frequência cardíaca no mesmo esforço (eficiência aeróbica) e a regularidade biomecânica ao longo dos seus treinos.
          </p>
        </div>

        {/* Diagnostic Badge */}
        {summary?.verdict_headline && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-3.5 py-2 flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 self-start md:self-auto shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{summary.verdict_headline}</span>
          </div>
        )}
      </div>

      {/* 2. Top Summary KPI Cards (Evolution Deltas) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Pace KPI */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Timer className="w-3.5 h-3.5 text-emerald-500" />
              <span>Evolução do Pace</span>
            </span>
            {summary.pace_diff_seconds < 0 ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowDownRight className="w-3 h-3" />
                {Math.abs(Math.round(summary.pace_diff_seconds))}s/km
              </span>
            ) : summary.pace_diff_seconds > 0 ? (
              <span className="text-[11px] font-bold text-amber-500 flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                +{Math.round(summary.pace_diff_seconds)}s/km
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Estável</span>
            )}
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline space-x-1.5">
            <span>{summary.recent_pace_formatted}</span>
            <span className="text-xs font-normal text-slate-400">
              (início: {summary.baseline_pace_formatted})
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {summary.pace_improvement_pct > 0 
              ? `🚀 ${summary.pace_improvement_pct}% mais veloz` 
              : summary.pace_improvement_pct < 0 
              ? "Ritmo mais cadenciado e controlado" 
              : "Ritmo constante"}
          </div>
        </div>

        {/* Aerobic Efficiency KPI */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Eficiência Aeróbica</span>
            </span>
            {summary.efficiency_improvement_pct ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                +{summary.efficiency_improvement_pct}%
              </span>
            ) : null}
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline space-x-1.5">
            <span>{summary.recent_efficiency || "--"} <span className="text-xs font-normal text-slate-400">m/bpm</span></span>
            {summary.baseline_efficiency && (
              <span className="text-xs font-normal text-slate-400">
                (início: {summary.baseline_efficiency})
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {summary.efficiency_improvement_pct && summary.efficiency_improvement_pct > 0
              ? "Coração bate menos por km percorrido"
              : "Relação velocidade vs FC"}
          </div>
        </div>

        {/* Cadence KPI */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
              <span>Cadência Média</span>
            </span>
            {summary.cadence_diff !== null && summary.cadence_diff !== undefined && (
              <span className={`text-[11px] font-bold flex items-center ${summary.cadence_diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                {summary.cadence_diff >= 0 ? `+${summary.cadence_diff}` : summary.cadence_diff} spm
              </span>
            )}
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline space-x-1.5">
            <span>{summary.recent_cadence ? `${Math.round(summary.recent_cadence)}` : "--"} <span className="text-xs font-normal text-slate-400">spm</span></span>
            {summary.baseline_cadence && (
              <span className="text-xs font-normal text-slate-400">
                (início: {Math.round(summary.baseline_cadence)})
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Meta ideal: 170 a 185 passos/min
          </div>
        </div>

        {/* Best Effort Record */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Award className="w-3.5 h-3.5 text-yellow-500" />
              <span>Melhor Treino Recente</span>
            </span>
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
            {summary.fastest_run ? summary.fastest_run.pace : "--:--"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {summary.fastest_run ? `${summary.fastest_run.name} (${summary.fastest_run.distance_km}k)` : "Nenhum esforço registrado"}
          </div>
        </div>
      </div>

      {/* 3. Interactive Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        {/* Metric Selector Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            onClick={() => setMetric("pace")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "pace"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Ritmo (Pace min/km)</span>
          </button>

          <button
            onClick={() => setMetric("efficiency")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "efficiency"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Eficiência Aeróbica (m/bpm)</span>
          </button>

          <button
            onClick={() => setMetric("heartrate")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "heartrate"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Frequência Cardíaca</span>
          </button>

          <button
            onClick={() => setMetric("cadence")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "cadence"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Cadência (spm)</span>
          </button>

          <button
            onClick={() => setMetric("volume")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "volume"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Volume (km)</span>
          </button>
        </div>

        {/* Aggregation & Filtering Options */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Aggregation Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setAggregation("run")}
              className={`py-1 px-2.5 rounded-lg font-bold transition ${
                aggregation === "run"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Por Corrida
            </button>
            <button
              onClick={() => setAggregation("week")}
              className={`py-1 px-2.5 rounded-lg font-bold transition ${
                aggregation === "week"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setAggregation("month")}
              className={`py-1 px-2.5 rounded-lg font-bold transition ${
                aggregation === "month"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Mensal
            </button>
          </div>

          {/* Distance Filter (available when by run) */}
          {aggregation === "run" && (
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl px-2 py-0.5 border border-slate-200 dark:border-slate-700/60">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value as DistanceFilterType)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold py-1 pr-1 outline-hidden text-xs cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">Todas as distâncias</option>
                <option value="curta" className="dark:bg-slate-900">Curtas (&lt; 6 km)</option>
                <option value="media" className="dark:bg-slate-900">Médias (6 a 12 km)</option>
                <option value="longao" className="dark:bg-slate-900">Longões (&gt; 12 km)</option>
              </select>
            </div>
          )}

          {/* Toggle Trendline */}
          {aggregation === "run" && metric === "pace" && (
            <button
              onClick={() => setShowTrendline(!showTrendline)}
              className={`py-1 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center space-x-1 ${
                showTrendline
                  ? "bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-400"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Média Móvel (5 corridas)</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Chart Display Canvas */}
      <div className="h-80 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          {/* PACE METRIC: Line Chart with inverted Y-axis so faster pace is on top */}
          {metric === "pace" ? (
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis
                dataKey="chartX"
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                reversed={true} // Faster pace (lower seconds) appears higher!
                tickFormatter={(val) => formatSecondsToPace(val)}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />

              {/* Individual Runs / Points */}
              <Line
                type="monotone"
                dataKey="valPace"
                name="Pace"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                dot={{ r: 3.5, fill: "#0ea5e9" }}
                activeDot={{ r: 6, fill: "#0284c7" }}
                connectNulls
              />

              {/* Smoothed Trendline (5-run moving average) */}
              {aggregation === "run" && showTrendline && (
                <Line
                  type="monotone"
                  dataKey="valMovingAvgPace"
                  name="Média Móvel (Tendência)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
              )}

              {/* Best pace in weekly/monthly view */}
              {aggregation !== "run" && (
                <Line
                  type="monotone"
                  dataKey="valBestPace"
                  name="Melhor Ritmo"
                  stroke="#2dd4bf"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2dd4bf" }}
                  connectNulls
                />
              )}
            </LineChart>
          ) : metric === "efficiency" ? (
            /* AEROBIC EFFICIENCY (Speed / HR) */
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                unit=" m/bpm"
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Area
                type="monotone"
                dataKey="valEfficiency"
                name="Fator de Eficiência"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorEff)"
                connectNulls
              />
              {aggregation === "run" && (
                <Line
                  type="monotone"
                  dataKey="valMovingAvgEfficiency"
                  name="Tendência Média Móvel"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  connectNulls
                />
              )}
            </AreaChart>
          ) : metric === "heartrate" ? (
            /* HEART RATE */
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                unit=" bpm"
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Area
                type="monotone"
                dataKey="valHeartRate"
                name="Frequência Cardíaca Média"
                stroke="#f43f5e"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorHr)"
                connectNulls
              />
            </AreaChart>
          ) : metric === "cadence" ? (
            /* CADENCE */
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                unit=" spm"
                domain={[140, 195]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <ReferenceLine y={170} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Meta 170 spm", position: "insideTopRight", fill: "#10b981", fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="valCadence"
                name="Cadência Média"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorCad)"
                connectNulls
              />
            </AreaChart>
          ) : (
            /* VOLUME / DISTANCE */
            <BarChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis stroke={axisStroke} fontSize={11} tickLine={false} unit=" km" domain={[0, "auto"]} />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Bar dataKey="valDistance" name="Distância (km)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 5. Chart Legend & Diagnostic Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center flex-wrap gap-4">
          {metric === "pace" && (
            <>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <span>Corridas Individuais</span>
              </div>
              {aggregation === "run" && showTrendline && (
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1 bg-emerald-500 inline-block rounded-full" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Linha de Tendência (Média Móvel)</span>
                </div>
              )}
              <span className="text-slate-400 dark:text-slate-500">
                (Eixo invertido: pontos mais altos indicam ritmo mais rápido ⚡)
              </span>
            </>
          )}

          {metric === "efficiency" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Fator de Eficiência:</strong> Velocidade (m/min) dividida pelos batimentos cardíacos (bpm). Quanto mais alto, mais resistente e econômico é o seu coração.
            </div>
          )}

          {metric === "cadence" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Cadência:</strong> Passadas acima de 168-170 spm reduzem impacto articular e contato com o solo.
            </div>
          )}

          {metric === "heartrate" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Frequência Cardíaca:</strong> Se você corre na mesma velocidade com menor FC, sua base aeróbica está evoluindo.
            </div>
          )}
        </div>

        <div className="shrink-0 text-slate-400 dark:text-slate-500 font-medium">
          Total de {chartData.length} registros analisados
        </div>
      </div>

      {/* 6. Coach Verdict Card */}
      {summary?.verdict_text && (
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
              Diagnóstico de Evolução librun
            </h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {summary.verdict_text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
