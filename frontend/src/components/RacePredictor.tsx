"use client";

import React from "react";
import { RacePredictions } from "../types";
import { Trophy, HelpCircle } from "lucide-react";

interface RacePredictorProps {
  predictionsData: RacePredictions;
}

export const RacePredictor: React.FC<RacePredictorProps> = ({ predictionsData }) => {
  const preds = predictionsData?.predictions;
  const ref = predictionsData?.reference_activity;

  // Sanity check: ensure predicted times and reference efforts are physiologically realistic
  const isPlausible = React.useMemo(() => {
    if (!preds || Object.keys(preds).length === 0) return false;
    const fiveKSecs = preds["5k"]?.predicted_time_seconds;
    if (fiveKSecs && fiveKSecs < 720) return false; // 5k under 12 minutes is physically impossible for mortals
    if (ref?.pace && (ref.pace.startsWith("0:") || ref.pace.startsWith("1:"))) return false; // Pace < 2:00/km is glitched
    return true;
  }, [preds, ref]);

  if (!preds || Object.keys(preds).length === 0 || !isPlausible) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        {predictionsData?.message || "Dados insuficientes ou inconsistentes para prever tempos de prova (faça ao menos uma corrida de 3km ou mais em ritmo fisiológico realista)."}
      </div>
    );
  }

  const raceCards = [
    { key: "5k", title: "5 km", color: "from-cyan-50 to-blue-50/60 dark:from-cyan-500/20 dark:to-blue-500/10", border: "border-cyan-200 dark:border-cyan-500/30", textTitle: "text-cyan-800 dark:text-slate-300" },
    { key: "10k", title: "10 km", color: "from-emerald-50 to-teal-50/60 dark:from-emerald-500/20 dark:to-teal-500/10", border: "border-emerald-200 dark:border-emerald-500/30", textTitle: "text-emerald-800 dark:text-slate-300" },
    { key: "21k", title: "Meia Maratona (21.1k)", color: "from-amber-50 to-orange-50/60 dark:from-amber-500/20 dark:to-orange-500/10", border: "border-amber-200 dark:border-amber-500/30", textTitle: "text-amber-800 dark:text-slate-300" },
    { key: "42k", title: "Maratona (42.2k)", color: "from-purple-50 to-pink-50/60 dark:from-purple-500/20 dark:to-pink-500/10", border: "border-purple-200 dark:border-purple-500/30", textTitle: "text-purple-800 dark:text-slate-300" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Previsão de Tempos de Prova (Fórmula de Riegel)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Estimativa do seu potencial atual calibrado pelo seu melhor esforço aeróbico recente.
            </p>
          </div>
        </div>

        {ref && (
          <div className="text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300">
            Esforço Base: <strong className="text-emerald-600 dark:text-emerald-400">{ref.distance_km} km @ {ref.pace}</strong> ({ref.name}{ref.date ? ` • ${new Date(ref.date).toLocaleDateString("pt-BR")}` : ""})
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        {raceCards.map((rc) => {
          const p = preds[rc.key];
          if (!p) return null;
          return (
            <div
              key={rc.key}
              className={`rounded-xl border ${rc.border} bg-gradient-to-b ${rc.color} p-4 flex flex-col justify-between shadow-xs`}
            >
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${rc.textTitle}`}>
                  {p.name}
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                  {p.predicted_time_formatted}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/40 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Ritmo sugerido:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/60 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                  {p.predicted_pace_formatted}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        <span>
          A predição considera que você treinou o volume específico para a distância (especialmente nos 21k e 42k).
        </span>
      </div>
    </div>
  );
};
