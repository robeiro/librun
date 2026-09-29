"use client";

import React from "react";
import { AnalyticsSummary, AcwrData } from "../types";
import { Gauge, Zap, Heart, Footprints, ShieldAlert, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";

interface SummaryCardsProps {
  summary: AnalyticsSummary;
  acwr: AcwrData;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, acwr }) => {
  // ACWR badge styling
  const getAcwrBadge = () => {
    switch (acwr.risk_level) {
      case "optimal":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          label: "Sweet Spot (Seguro)",
        };
      case "warning":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          label: "Atenção: Carga Alta",
        };
      case "danger":
        return {
          bg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />,
          label: "Alto Risco de Lesão",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
          icon: <TrendingUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />,
          label: acwr.status,
        };
    }
  };

  const acwrBadge = getAcwrBadge();

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 65) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Librun Index Score */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition">
        <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Librun Index
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Gauge className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline space-x-2">
            <span className={`text-4xl font-black ${getScoreColor(summary.librun_score)}`}>
              {summary.librun_score}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">/ 100</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Score equilibrado: Consistência, Polarização & Carga
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 text-[10px] text-slate-500 dark:text-slate-400 text-center">
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{summary.score_components?.consistencia || 0}/25</div>
            <div className="text-[9px] truncate">Consistência</div>
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{summary.score_components?.carga_acwr || 0}/25</div>
            <div className="text-[9px] truncate">Carga</div>
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{summary.score_components?.polarizacao || 0}/25</div>
            <div className="text-[9px] truncate">80/20</div>
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{summary.score_components?.cadencia || 0}/25</div>
            <div className="text-[9px] truncate">Cadência</div>
          </div>
        </div>
      </div>

      {/* 2. Carga & Risco (ACWR) */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Risco de Lesão (ACWR)
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {acwr.acwr}
            </span>
            <span className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${acwrBadge.bg}`}>
              {acwrBadge.icon}
              <span>{acwrBadge.label}</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
            7 dias: <strong className="text-slate-800 dark:text-slate-200">{acwr.acute_load_km} km</strong> vs Média 28 dias: <strong className="text-slate-800 dark:text-slate-200">{acwr.chronic_load_km} km</strong>
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          Faixa ideal recomendada: <span className="font-semibold text-emerald-600 dark:text-emerald-400">0.8 - 1.3</span>
        </div>
      </div>

      {/* 3. Pace Médio & Volume */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Volume & Ritmo Geral
          </span>
          <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400">
              {summary.overall_avg_pace}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Total de <strong className="text-slate-800 dark:text-slate-200">{summary.total_distance_km} km</strong> em{" "}
            <strong className="text-slate-800 dark:text-slate-200">{summary.total_runs} corridas</strong> ({summary.total_time_hours}h)
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          Ganho de elevação acumulado: <span className="font-semibold text-slate-800 dark:text-slate-200">{summary.total_elevation_gain_m} m</span>
        </div>
      </div>

      {/* 4. Cadência & Frequência Cardíaca */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Biomecânica & Coração
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Footprints className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {summary.avg_cadence ? `${Math.round(summary.avg_cadence)} spm` : "--"}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Cadência média</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 flex items-center justify-end space-x-1">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 inline" />
                <span>{summary.avg_heartrate ? `${Math.round(summary.avg_heartrate)} bpm` : "--"}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">FC média</div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          {summary.avg_cadence && summary.avg_cadence < 162 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Cadência baixa (risco de overstriding)</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Frequência de passos equilibrada</span>
          )}
        </div>
      </div>
    </div>
  );
};
