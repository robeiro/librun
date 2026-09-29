"use client";

import React from "react";
import { HrZoneInfo } from "../types";
import { Heart, AlertTriangle } from "lucide-react";

interface HeartRateZonesChartProps {
  distribution: Record<string, HrZoneInfo>;
}

export const HeartRateZonesChart: React.FC<HeartRateZonesChartProps> = ({ distribution }) => {
  if (!distribution || Object.keys(distribution).length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        Nenhum dado cardíaco registrado.
      </div>
    );
  }

  const zonesList = ["Z1", "Z2", "Z3", "Z4", "Z5"].map((k) => distribution[k]).filter(Boolean);
  const totalKm = zonesList.reduce((acc, curr) => acc + curr.total_km, 0);

  const z3 = distribution["Z3"];
  const isGreyZoneTrap = z3 && z3.percentage > 25;

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 dark:text-rose-400">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Zonas de Frequência Cardíaca & Polarização (80/20)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Distribuição de intensidade baseada na frequência cardíaca máxima configurada.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {totalKm.toFixed(1)} km analisados
            </span>
          </div>
        </div>

        {/* Grey Zone Alert Banner */}
        {isGreyZoneTrap && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-950 dark:text-amber-300">Atenção ao Treinamento na Zona Cinzenta:</strong>{" "}
              {z3.percentage}% do seu volume está na <strong>Zona 3 (Moderada)</strong>.
              Corredores amadores tendem a correr rápido demais nos dias que deveriam ser leves. O modelo ideal preconiza ~80% em Z1/Z2 e 20% em Z4/Z5.
            </div>
          </div>
        )}

        {/* Zone Bars */}
        <div className="mt-5 space-y-3">
          {zonesList.map((z) => {
            return (
              <div key={z.zone_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {z.zone_id} • {z.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      ({z.min_hr} - {z.max_hr} bpm)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 dark:text-slate-400">{z.total_km} km</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200 min-w-[40px] text-right">
                      {z.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar with target indicator */}
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(z.percentage, 2))}%`,
                      backgroundColor: z.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div>
          🎯 <strong>Ideal Polarizado:</strong> 80% Leve (Z1/Z2), &lt;10% Moderado (Z3), 15-20% Forte (Z4/Z5).
        </div>
        <div className="text-right">
          💡 Z2 gera mitocôndrias e queima de gordura sem fadiga muscular excessiva.
        </div>
      </div>
    </div>
  );
};
