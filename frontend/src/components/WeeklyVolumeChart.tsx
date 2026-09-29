"use client";

import React from "react";
import { WeeklyWeek } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Calendar } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface WeeklyVolumeChartProps {
  weeks: WeeklyWeek[];
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { fullLabel: string; kmTotal: number; kmLongao: number; pace: string; growth: number; runs: number } }>;
}

export const WeeklyVolumeChart: React.FC<WeeklyVolumeChartProps> = ({ weeks }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!weeks || weeks.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        Sem dados semanais disponíveis.
      </div>
    );
  }

  // Format data for Recharts
  const data = weeks.map((w) => ({
    week: w.week_label.split(" - ")[0], // show start date
    fullLabel: w.week_label,
    kmTotal: w.total_km,
    kmLongao: w.longest_run_km,
    kmRodagem: Math.max(0, +(w.total_km - w.longest_run_km).toFixed(1)),
    pace: w.avg_pace_formatted,
    growth: w.growth_pct,
    runs: w.run_count,
  }));

  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
          <p className="font-bold text-slate-900 dark:text-slate-200">{d.fullLabel}</p>
          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
            Volume Total: {d.kmTotal} km ({d.runs} corridas)
          </div>
          <div className="text-teal-600 dark:text-teal-400">
            Maior corrida (Longão): {d.kmLongao} km
          </div>
          {d.pace && d.pace !== "--:--" && (
            <div className="text-cyan-600 dark:text-cyan-400">Pace médio: {d.pace}</div>
          )}
          {d.growth !== undefined && (
            <div className={`font-medium ${d.growth > 15 ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
              Variação vs semana anterior: {d.growth > 0 ? `+${d.growth}%` : `${d.growth}%`}
              {d.growth > 15 && " (⚠️ >10% regra da progressão)"}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";
  const lineStroke = isDark ? "#334155" : "#e2e8f0";

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative flex flex-col justify-between shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Volume Semanal & Distribuição de Carga
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evolução de quilometragem nas últimas semanas com destaque para o longão (regra dos 10%).
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            <span className="text-slate-600 dark:text-slate-300">Rodagens</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-teal-400 inline-block" />
            <span className="text-slate-600 dark:text-slate-300">Longão</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={isDark ? 0.4 : 0.8} />
            <XAxis
              dataKey="week"
              stroke={axisStroke}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: lineStroke }}
            />
            <YAxis
              stroke={axisStroke}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: lineStroke }}
              unit="km"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="kmRodagem" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="kmLongao" stackId="a" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>💡 Regra de Ouro: Evite aumentar mais de 10% de km em semanas consecutivas.</span>
      </div>
    </div>
  );
};
