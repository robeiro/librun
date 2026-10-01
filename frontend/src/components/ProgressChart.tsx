"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ProgressData, SportSummaryItem } from "../types";
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
  Layers,
  Clock,
  Activity,
  Layers3
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ProgressChartProps {
  progress?: ProgressData;
}

type MetricType = "pace" | "speed" | "duration" | "efficiency" | "heartrate" | "cadence" | "volume" | "load";
type AggregationType = "session" | "week" | "month";
type DistanceFilterType = "all" | "curta" | "media" | "longao";
type SportFilterType = "all" | "run" | "ride" | "swim" | "walk" | "workout" | string;

interface ChartItemData {
  chartX: string;
  tooltipTitle: string;
  sportIcon: string;
  sportLabel: string;
  sportColor: string;
  sportCategory: string;
  valPace: number | null;
  valMovingAvgPace?: number | null;
  valBestPace?: number | null;
  valSpeed?: number | null;
  valMovingAvgSpeed?: number | null;
  valDurationHours?: number | null;
  valDurationMinutes?: number | null;
  valEfficiency?: number | null;
  valMovingAvgEfficiency?: number | null;
  valHeartRate?: number | null;
  valCadence?: number | null;
  valDistance: number;
  valLoad?: number | null;
  distance_km?: number;
  pace_formatted?: string;
  moving_avg_pace_formatted?: string;
  average_heartrate?: number | null;
  aerobic_efficiency?: number | null;
  average_cadence?: number | null;
  cadence_unit?: string;
  total_km?: number;
  total_time_hours?: number;
  run_count?: number;
  total_sessions?: number;
  avg_pace_formatted?: string;
  best_pace_formatted?: string;
  avg_heartrate?: number | null;
  avg_efficiency?: number | null;
  avg_cadence?: number | null;
  by_sport?: Record<string, { count: number; km: number; hours: number }>;
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

  const [selectedSport, setSelectedSport] = useState<SportFilterType>("all");
  const [metric, setMetric] = useState<MetricType>("duration");
  const [aggregation, setAggregation] = useState<AggregationType>("session");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilterType>("all");
  const [showTrendline, setShowTrendline] = useState<boolean>(true);

  // Available sports in this athlete's data
  const availableSports = useMemo(() => {
    if (progress?.sports_summary && progress.sports_summary.length > 0) {
      return progress.sports_summary;
    }
    // Fallback: derive from timeline
    const timeline = progress?.timeline || [];
    const sportMap = new Map<string, SportSummaryItem>();
    for (const p of timeline) {
      const cat = p.sport_category || "run";
      if (!sportMap.has(cat)) {
        sportMap.set(cat, {
          sport_type: p.sport_type || "Run",
          sport_category: cat,
          sport_label: p.sport_label || (cat === "run" ? "Corrida" : cat),
          sport_icon: p.sport_icon || "🏃",
          sport_color: p.sport_color || "#10b981",
          count: 0,
          total_time_hours: 0,
          total_km: 0,
          pct_time: 0,
        });
      }
      const item = sportMap.get(cat)!;
      item.count += 1;
      item.total_km += p.distance_km || 0;
      item.total_time_hours += (p.moving_time_seconds || 0) / 3600;
    }
    return Array.from(sportMap.values());
  }, [progress]);

  // Adjust default metric when sport changes
  useEffect(() => {
    if (selectedSport === "run") {
      setMetric("pace");
    } else if (selectedSport === "ride") {
      setMetric("speed");
    } else if (selectedSport === "swim") {
      setMetric("pace");
    } else if (selectedSport === "workout") {
      setMetric("duration");
    } else if (selectedSport === "all") {
      setMetric((prev) => {
        if (prev === "pace" || prev === "speed" || prev === "cadence") {
          return "duration";
        }
        return prev;
      });
    }
  }, [selectedSport]);

  // Filter and prepare chart dataset
  const chartData: ChartItemData[] = useMemo(() => {
    const timeline = progress?.timeline || [];
    const weekly = progress?.weekly || [];
    const monthly = progress?.monthly || [];

    if (!timeline.length && !weekly.length) return [];

    if (aggregation === "session") {
      let filtered = timeline;

      // Filter by sport
      if (selectedSport !== "all") {
        filtered = filtered.filter((p) => (p.sport_category || "run") === selectedSport);
      }

      // Filter by distance (for run / ride)
      if (distanceFilter !== "all") {
        filtered = filtered.filter((p) => p.category === distanceFilter);
      }

      return filtered.map((p) => {
        const timeHours = (p.moving_time_seconds || 0) / 3600.0;
        const timeMinutes = (p.moving_time_seconds || 0) / 60.0;
        const speed = p.speed_kmh && p.speed_kmh > 0 ? p.speed_kmh : null;
        const movSpeed = p.moving_avg_speed_kmh && p.moving_avg_speed_kmh > 0 ? p.moving_avg_speed_kmh : null;

        return {
          chartX: p.date_formatted,
          tooltipTitle: `${p.name} • ${p.full_date}`,
          sportIcon: p.sport_icon || "🏃",
          sportLabel: p.sport_label || "Corrida",
          sportColor: p.sport_color || "#10b981",
          sportCategory: p.sport_category || "run",
          valPace: p.pace_seconds > 0 ? p.pace_seconds : null,
          valMovingAvgPace: p.moving_avg_pace_seconds > 0 ? p.moving_avg_pace_seconds : null,
          valSpeed: speed,
          valMovingAvgSpeed: movSpeed,
          valDurationHours: roundToDec(timeHours, 2),
          valDurationMinutes: Math.round(timeMinutes),
          valEfficiency: p.aerobic_efficiency,
          valMovingAvgEfficiency: p.moving_avg_efficiency,
          valHeartRate: p.average_heartrate,
          valCadence: p.average_cadence,
          valDistance: p.distance_km,
          valLoad: p.training_load || 0,
          distance_km: p.distance_km,
          pace_formatted: p.pace_formatted,
          moving_avg_pace_formatted: p.moving_avg_pace_formatted,
          average_heartrate: p.average_heartrate,
          aerobic_efficiency: p.aerobic_efficiency,
          average_cadence: p.average_cadence,
          cadence_unit: p.cadence_unit || "spm",
        };
      });
    } else if (aggregation === "week") {
      return weekly.map((w) => {
        const timeH = w.total_time_hours || (w.total_km > 0 ? roundToDec(w.total_km / 10.0, 1) : 0);
        return {
          chartX: w.label.split(" - ")[0],
          tooltipTitle: `Semana: ${w.label}`,
          sportIcon: "📅",
          sportLabel: "Total Semanal",
          sportColor: "#10b981",
          sportCategory: "all",
          valPace: w.avg_pace_seconds > 0 ? w.avg_pace_seconds : null,
          valBestPace: w.best_pace_seconds > 0 ? w.best_pace_seconds : null,
          valDurationHours: timeH,
          valDurationMinutes: Math.round(timeH * 60),
          valEfficiency: w.avg_efficiency,
          valHeartRate: w.avg_heartrate,
          valCadence: w.avg_cadence,
          valDistance: w.total_km,
          total_km: w.total_km,
          total_time_hours: timeH,
          run_count: w.total_sessions || w.run_count,
          total_sessions: w.total_sessions || w.run_count,
          avg_pace_formatted: w.avg_pace_formatted,
          best_pace_formatted: w.best_pace_formatted,
          avg_heartrate: w.avg_heartrate,
          avg_efficiency: w.avg_efficiency,
          avg_cadence: w.avg_cadence,
          by_sport: w.by_sport,
        };
      });
    } else {
      return monthly.map((m) => {
        const timeH = m.total_time_hours || (m.total_km > 0 ? roundToDec(m.total_km / 10.0, 1) : 0);
        return {
          chartX: m.label,
          tooltipTitle: `Mês: ${m.label}`,
          sportIcon: "🗓️",
          sportLabel: "Total Mensal",
          sportColor: "#10b981",
          sportCategory: "all",
          valPace: m.avg_pace_seconds > 0 ? m.avg_pace_seconds : null,
          valBestPace: m.best_pace_seconds > 0 ? m.best_pace_seconds : null,
          valDurationHours: timeH,
          valDurationMinutes: Math.round(timeH * 60),
          valEfficiency: m.avg_efficiency,
          valHeartRate: m.avg_heartrate,
          valCadence: m.avg_cadence,
          valDistance: m.total_km,
          total_km: m.total_km,
          total_time_hours: timeH,
          run_count: m.total_sessions || m.run_count,
          total_sessions: m.total_sessions || m.run_count,
          avg_pace_formatted: m.avg_pace_formatted,
          best_pace_formatted: m.best_pace_formatted,
          avg_heartrate: m.avg_heartrate,
          avg_efficiency: m.avg_efficiency,
          avg_cadence: m.avg_cadence,
          by_sport: m.by_sport,
        };
      });
    }
  }, [progress, aggregation, selectedSport, distanceFilter]);

  const summary = progress?.summary;
  const hasData = Boolean(progress && (progress.timeline?.length || progress.weekly?.length) && summary);

  if (!hasData || !summary) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        <TrendingUp className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-50" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Sem dados suficientes para a linha do tempo de evolução
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Conecte sua conta do Strava ou carregue suas atividades (corridas, ciclismo, natação, musculação) para acompanhar sua evolução ao longo do tempo.
        </p>
      </div>
    );
  }

  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";

  // Custom Rich Tooltip
  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-xl text-xs space-y-2 z-50 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {d.tooltipTitle}
            </span>
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center space-x-1">
              <span>{d.sportIcon}</span>
              <span>{d.sportLabel}</span>
            </span>
          </div>

          {aggregation === "session" ? (
            <div className="space-y-1 text-slate-600 dark:text-slate-300">
              {d.valDistance > 0 && (
                <div className="flex justify-between items-center">
                  <span>Distância:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{d.valDistance} km</span>
                </div>
              )}

              {d.valDurationMinutes && d.valDurationMinutes > 0 ? (
                <div className="flex justify-between items-center">
                  <span>Duração:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {d.valDurationHours && d.valDurationHours >= 1 ? `${d.valDurationHours}h` : `${d.valDurationMinutes} min`}
                  </span>
                </div>
              ) : null}

              {/* Sport-specific metric display */}
              {d.sportCategory === "ride" && d.valSpeed ? (
                <div className="flex justify-between items-center">
                  <span>Velocidade:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{d.valSpeed} km/h</span>
                </div>
              ) : d.pace_formatted ? (
                <div className="flex justify-between items-center">
                  <span>Ritmo / Desempenho:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.pace_formatted}</span>
                </div>
              ) : null}

              {d.moving_avg_pace_formatted && d.sportCategory === "run" && (
                <div className="flex justify-between items-center text-[11px] text-teal-600 dark:text-teal-400">
                  <span>Média Móvel (5 corridas):</span>
                  <span className="font-semibold">{d.moving_avg_pace_formatted}</span>
                </div>
              )}

              {d.average_heartrate ? (
                <div className="flex justify-between items-center">
                  <span>FC Média:</span>
                  <span className="font-bold text-rose-500">{d.average_heartrate} bpm</span>
                </div>
              ) : null}

              {d.aerobic_efficiency ? (
                <div className="flex justify-between items-center text-[11px]">
                  <span>Fator de Eficiência:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{d.aerobic_efficiency} m/bpm</span>
                </div>
              ) : null}

              {d.average_cadence ? (
                <div className="flex justify-between items-center">
                  <span>Cadência:</span>
                  <span className="font-bold text-amber-500">
                    {d.average_cadence} {d.cadence_unit || "spm"}
                  </span>
                </div>
              ) : null}

              {d.valLoad && d.valLoad > 0 ? (
                <div className="flex justify-between items-center text-[11px] text-purple-600 dark:text-purple-400">
                  <span>Carga de Esforço:</span>
                  <span className="font-semibold">{d.valLoad} pts</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span>Total de Treinos:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{d.total_sessions} sessões</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Tempo Acumulado:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.total_time_hours}h</span>
              </div>
              {d.total_km && d.total_km > 0 ? (
                <div className="flex justify-between items-center">
                  <span>Quilometragem Total:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{d.total_km} km</span>
                </div>
              ) : null}
              {d.avg_heartrate ? (
                <div className="flex justify-between items-center">
                  <span>FC Média Período:</span>
                  <span className="font-bold text-rose-500">{d.avg_heartrate} bpm</span>
                </div>
              ) : null}

              {/* Multi-sport breakdown */}
              {d.by_sport && Object.keys(d.by_sport).length > 0 && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Distribuição por Esporte:</span>
                  {Object.entries(d.by_sport).map(([sp, data]) => {
                    const icon = sp === "run" ? "🏃 Corrida" : sp === "ride" ? "🚴 Ciclismo" : sp === "swim" ? "🏊 Natação" : sp === "workout" ? "🏋️ Força" : sp === "walk" ? "🚶 Caminhada" : "⚡ Outro";
                    return (
                      <div key={sp} className="flex justify-between items-center text-[11px]">
                        <span>{icon}:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {data.count}x {data.km > 0 ? `(${data.km} km)` : `(${data.hours}h)`}
                        </span>
                      </div>
                    );
                  })}
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
              Linha do Tempo de Evolução & Progresso
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Acompanhe a sua evolução cronológica treino a treino em todos os esportes que você pratica: ritmo de corrida, velocidade no pedal, natação, treinos de força e economia cardíaca.
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

      {/* 2. Multi-Sport Filter Toolbar */}
      <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <Layers3 className="w-4 h-4 text-emerald-500" />
            <span>Modalidade Esportiva:</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {summary.multi_sport_count && summary.multi_sport_count > 1
              ? `Atleta Multiesporte (${summary.multi_sport_count} modalidades registradas)`
              : "Filtrar por esporte"}
          </span>
        </div>

        {/* Sport Pills */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setSelectedSport("all")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              selectedSport === "all"
                ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>🌐</span>
            <span>Todos os Esportes</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              {summary.total_activities}
            </span>
          </button>

          {availableSports.map((sp) => {
            const isSelected = selectedSport === sp.sport_category;
            return (
              <button
                key={sp.sport_category}
                onClick={() => setSelectedSport(sp.sport_category)}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                  isSelected
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{sp.sport_icon}</span>
                <span>{sp.sport_label}</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {sp.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Top Summary KPI Cards (Adaptive by Sport) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1: Primary Progress Metric (Pace / Speed / Hours) */}
        {selectedSport === "ride" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                <span>Velocidade no Pedal</span>
              </span>
              {summary.speed_diff_kmh && summary.speed_diff_kmh > 0 ? (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                  +{summary.speed_diff_kmh} km/h
                </span>
              ) : null}
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline space-x-1.5">
              <span>{summary.recent_speed_kmh ? `${summary.recent_speed_kmh} km/h` : "--"}</span>
              {summary.baseline_speed_kmh && (
                <span className="text-xs font-normal text-slate-400">
                  (início: {summary.baseline_speed_kmh}k)
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {summary.speed_improvement_pct ? `🚀 +${summary.speed_improvement_pct}% mais veloz no ciclismo` : "Velocidade sustentada"}
            </div>
          </div>
        ) : selectedSport === "all" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Volume Total</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {summary.multi_sport_count || 1} esportes
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline space-x-1.5">
              <span>{summary.total_hours || "--"} <span className="text-xs font-normal text-slate-400">horas</span></span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {summary.total_activities} treinos • {summary.total_distance_km} km totais
            </div>
          </div>
        ) : (
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
                ? "Ritmo cadenciado e controlado" 
                : "Ritmo constante"}
            </div>
          </div>
        )}

        {/* KPI 2: Aerobic Efficiency */}
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Eficiência Cardíaca</span>
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
              ? "Coração mais econômico por esforço"
              : "Relação velocidade vs FC"}
          </div>
        </div>

        {/* KPI 3: Cadence / Regularity */}
        {selectedSport === "ride" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <Gauge className="w-3.5 h-3.5 text-sky-500" />
                <span>Cadência do Pedal</span>
              </span>
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">rpm</span>
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              85 rpm
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Giro fluido e eficiente (80-95 rpm)
            </div>
          </div>
        ) : selectedSport === "all" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>Constância Geral</span>
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {Math.round((summary.total_activities / 10) * 10) / 10} <span className="text-xs font-normal text-slate-400">treinos/sem</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Excelente rotina de estímulos
            </div>
          </div>
        ) : (
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
        )}

        {/* KPI 4: Best Effort / Sport Distribution */}
        {selectedSport === "ride" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-yellow-500" />
                <span>Maior Pedalada</span>
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {summary.longest_ride ? `${summary.longest_ride.distance_km} km` : "--"}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {summary.longest_ride ? `${summary.longest_ride.speed} • ${summary.longest_ride.date}` : "Sem dados"}
            </div>
          </div>
        ) : selectedSport === "all" ? (
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-yellow-500" />
                <span>Modalidade Principal</span>
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {summary.primary_sport || "Corrida"}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {availableSports.length > 1 ? `${availableSports.length} esportes combinados` : "Treino regular"}
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* 4. Interactive Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        {/* Metric Selector Buttons (Tailored to current sport) */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Pace Metric (Run, Walk, Swim) */}
          {(selectedSport === "run" || selectedSport === "walk" || selectedSport === "swim") && (
            <button
              onClick={() => setMetric("pace")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                metric === "pace"
                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{selectedSport === "swim" ? "Ritmo (min/100m)" : "Ritmo (Pace min/km)"}</span>
            </button>
          )}

          {/* Speed Metric (Ride or general) */}
          {(selectedSport === "ride" || selectedSport === "all") && (
            <button
              onClick={() => setMetric("speed")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                metric === "speed"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Velocidade (km/h)</span>
            </button>
          )}

          {/* Duration Metric (Universal across all sports) */}
          <button
            onClick={() => setMetric("duration")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "duration"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Tempo de Treino</span>
          </button>

          {/* Aerobic Efficiency */}
          <button
            onClick={() => setMetric("efficiency")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "efficiency"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Eficiência Aeróbica</span>
          </button>

          {/* Heart Rate */}
          <button
            onClick={() => setMetric("heartrate")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "heartrate"
                ? "bg-rose-500 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Frequência Cardíaca</span>
          </button>

          {/* Cadence (Run, Ride) */}
          {(selectedSport === "run" || selectedSport === "ride") && (
            <button
              onClick={() => setMetric("cadence")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                metric === "cadence"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{selectedSport === "ride" ? "Cadência Pedal (rpm)" : "Cadência (spm)"}</span>
            </button>
          )}

          {/* Distance / Volume */}
          <button
            onClick={() => setMetric("volume")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              metric === "volume"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Distância (km)</span>
          </button>
        </div>

        {/* Aggregation & Filtering Options */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Aggregation Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setAggregation("session")}
              className={`py-1 px-2.5 rounded-lg font-bold transition ${
                aggregation === "session"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Por Treino
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

          {/* Distance Filter (available when by session and on running/cycling) */}
          {aggregation === "session" && (selectedSport === "run" || selectedSport === "ride") && (
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl px-2 py-0.5 border border-slate-200 dark:border-slate-700/60">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value as DistanceFilterType)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold py-1 pr-1 outline-hidden text-xs cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">Todas as distâncias</option>
                <option value="curta" className="dark:bg-slate-900">
                  {selectedSport === "ride" ? "Curtas (< 25 km)" : "Curtas (< 6 km)"}
                </option>
                <option value="media" className="dark:bg-slate-900">
                  {selectedSport === "ride" ? "Médias (25 a 55 km)" : "Médias (6 a 12 km)"}
                </option>
                <option value="longao" className="dark:bg-slate-900">
                  {selectedSport === "ride" ? "Longos (> 55 km)" : "Longões (> 12 km)"}
                </option>
              </select>
            </div>
          )}

          {/* Toggle Trendline */}
          {aggregation === "session" && (metric === "pace" || metric === "speed") && (
            <button
              onClick={() => setShowTrendline(!showTrendline)}
              className={`py-1 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center space-x-1 ${
                showTrendline
                  ? "bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-400"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Média Móvel (Tendência)</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Chart Display Canvas */}
      <div className="h-80 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          {/* PACE METRIC: Line Chart with inverted Y-axis so faster pace is on top */}
          {metric === "pace" ? (
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                reversed={true} // Faster pace appears higher!
                tickFormatter={(val) => formatSecondsToPace(val)}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />

              {/* Individual Sessions */}
              <Line
                type="monotone"
                dataKey="valPace"
                name="Ritmo"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                dot={{ r: 3.5, fill: "#0ea5e9" }}
                activeDot={{ r: 6, fill: "#0284c7" }}
                connectNulls
              />

              {/* Smoothed Trendline */}
              {aggregation === "session" && showTrendline && (
                <Line
                  type="monotone"
                  dataKey="valMovingAvgPace"
                  name="Média Móvel"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
              )}

              {aggregation !== "session" && (
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
          ) : metric === "speed" ? (
            /* SPEED METRIC (km/h) */
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickLine={false}
                unit=" km/h"
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Line
                type="monotone"
                dataKey="valSpeed"
                name="Velocidade"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 4, fill: "#0ea5e9" }}
                activeDot={{ r: 6, fill: "#0284c7" }}
                connectNulls
              />
              {aggregation === "session" && showTrendline && (
                <Line
                  type="monotone"
                  dataKey="valMovingAvgSpeed"
                  name="Média Móvel Velocidade"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          ) : metric === "duration" ? (
            /* DURATION (Universal Multi-Sport) */
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
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
                unit="h"
                domain={[0, "auto"]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Area
                type="monotone"
                dataKey="valDurationHours"
                name="Horas de Treino"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorDuration)"
                connectNulls
              />
            </AreaChart>
          ) : metric === "efficiency" ? (
            /* AEROBIC EFFICIENCY */
            <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.35 : 0.7} />
              <XAxis dataKey="chartX" stroke={axisStroke} fontSize={11} tickLine={false} />
              <YAxis stroke={axisStroke} fontSize={11} tickLine={false} unit=" m/bpm" domain={["auto", "auto"]} />
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
              {aggregation === "session" && (
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
              <YAxis stroke={axisStroke} fontSize={11} tickLine={false} unit=" bpm" domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              <Area
                type="monotone"
                dataKey="valHeartRate"
                name="FC Média"
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
                unit={selectedSport === "ride" ? " rpm" : " spm"}
                domain={selectedSport === "ride" ? [60, 110] : [140, 195]}
              />
              <Tooltip content={<CustomTooltip metric={metric} aggregation={aggregation} />} />
              {selectedSport === "run" && (
                <ReferenceLine y={170} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Meta 170 spm", position: "insideTopRight", fill: "#10b981", fontSize: 11 }} />
              )}
              <Area
                type="monotone"
                dataKey="valCadence"
                name={selectedSport === "ride" ? "Cadência do Pedal" : "Cadência de Passadas"}
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

      {/* 6. Chart Legend & Diagnostic Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center flex-wrap gap-4">
          {metric === "pace" && (
            <>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <span>Ritmo das Sessões</span>
              </div>
              {aggregation === "session" && showTrendline && (
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1 bg-emerald-500 inline-block rounded-full" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Linha de Tendência</span>
                </div>
              )}
              <span className="text-slate-400 dark:text-slate-500">
                (Eixo invertido: pontos mais altos indicam velocidade mais rápida ⚡)
              </span>
            </>
          )}

          {metric === "speed" && (
            <div className="text-slate-600 dark:text-slate-300">
              ⚡ <strong>Velocidade Média (km/h):</strong> Acompanhe os ganhos de potência e velocidade sustentada em treinos de ciclismo.
            </div>
          )}

          {metric === "duration" && (
            <div className="text-slate-600 dark:text-slate-300">
              ⏱️ <strong>Volume de Horas:</strong> Medida universal de treino aplicável a qualquer modalidade esportiva (corrida, bike, natação, musculação).
            </div>
          )}

          {metric === "efficiency" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Fator de Eficiência:</strong> Velocidade (m/min) dividida pela FC (bpm). Quanto mais alto, mais resistente e econômico é o seu coração.
            </div>
          )}

          {metric === "cadence" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Cadência:</strong> Para corrida, acima de 168-170 spm minimiza impacto. Para ciclismo, 80-95 rpm preserva a musculatura das pernas.
            </div>
          )}

          {metric === "heartrate" && (
            <div className="text-slate-600 dark:text-slate-300">
              💡 <strong>Frequência Cardíaca:</strong> Se você executa o mesmo esforço com FC mais baixa ao longo das semanas, sua adaptação aeróbica está consolidada.
            </div>
          )}
        </div>

        <div className="shrink-0 text-slate-400 dark:text-slate-500 font-medium">
          Total de {chartData.length} registros analisados
        </div>
      </div>

      {/* 7. Coach Verdict Card */}
      {summary?.verdict_text && (
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
              Diagnóstico de Evolução Multiesporte librun
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

function roundToDec(val: number, dec: number): number {
  const p = Math.pow(10, dec);
  return Math.round(val * p) / p;
}
