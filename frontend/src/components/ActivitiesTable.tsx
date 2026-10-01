"use client";

import React, { useState, useMemo } from "react";
import { Activity } from "../types";
import { Search, Heart, Footprints, Swords, BrainCircuit, Filter } from "lucide-react";

interface ActivitiesTableProps {
  activities: Activity[];
  onCompare?: (activity: Activity) => void;
  onAnalyzeAi?: (activity: Activity) => void;
}

const getSportDisplay = (typeStr: string) => {
  const t = (typeStr || "").toLowerCase();
  if (t.includes("run") || t.includes("corrida")) {
    return { label: "Corrida", icon: "🏃", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" };
  }
  if (t.includes("ride") || t.includes("bike") || t.includes("cicl")) {
    return { label: "Ciclismo", icon: "🚴", color: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border-sky-200 dark:border-sky-500/20" };
  }
  if (t.includes("swim") || t.includes("nata")) {
    return { label: "Natação", icon: "🏊", color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" };
  }
  if (t.includes("walk") || t.includes("caminh") || t.includes("hike") || t.includes("trilha")) {
    return { label: "Caminhada", icon: "🚶", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" };
  }
  if (t.includes("weight") || t.includes("strength") || t.includes("força") || t.includes("workout") || t.includes("crossfit") || t.includes("yoga")) {
    return { label: "Força", icon: "🏋️", color: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" };
  }
  return { label: typeStr || "Outro", icon: "⚡", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700" };
};

export const ActivitiesTable: React.FC<ActivitiesTableProps> = ({ activities, onCompare, onAnalyzeAi }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState<number>(50);

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, "0")}m`;
    }
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const formatPerformance = (act: Activity) => {
    const t = (act.type || "").toLowerCase();
    const dist = act.distance || 0;
    const sec = act.moving_time || 0;

    if (t.includes("ride") || t.includes("bike")) {
      if (sec > 0 && dist > 0) {
        const speed = (dist / 1000) / (sec / 3600);
        return `${speed.toFixed(1)} km/h`;
      }
      return "--.- km/h";
    }

    if (t.includes("swim")) {
      if (sec > 0 && dist > 0) {
        const sec100 = sec / (dist / 100);
        const m = Math.floor(sec100 / 60);
        const s = Math.round(sec100 % 60);
        return `${m}:${s.toString().padStart(2, "0")} /100m`;
      }
      return "--:-- /100m";
    }

    if (dist > 0 && sec > 0) {
      const km = dist / 1000;
      const paceSec = sec / km;
      const m = Math.floor(paceSec / 60);
      const s = Math.round(paceSec % 60);
      return `${m}:${s.toString().padStart(2, "0")} min/km`;
    }

    return "--:--";
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  const uniqueSports = useMemo(() => {
    const set = new Set<string>();
    for (const a of activities) {
      const sp = getSportDisplay(a.type).label;
      set.add(sp);
    }
    return Array.from(set);
  }, [activities]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const term = searchTerm.toLowerCase();
      const dStr = formatDate(a.start_date || a.start_date_local || "");
      const matchesSearch = a.name.toLowerCase().includes(term) || dStr.includes(term) || (a.type || "").toLowerCase().includes(term);
      
      if (!matchesSearch) return false;
      if (sportFilter !== "all") {
        const spLabel = getSportDisplay(a.type).label;
        if (spLabel !== sportFilter) return false;
      }
      return true;
    });
  }, [activities, searchTerm, sportFilter]);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Histórico de Atividades & Treinos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activities.length} atividades registradas no total.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Sport Filter */}
          {uniqueSports.length > 1 && (
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold outline-hidden text-xs cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">Todos os Esportes</option>
                {uniqueSports.map((sp) => (
                  <option key={sp} value={sp} className="dark:bg-slate-900">{sp}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 transition"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-3">Data</th>
              <th className="py-3 px-3">Modalidade</th>
              <th className="py-3 px-3">Nome do Treino</th>
              <th className="py-3 px-3">Distância</th>
              <th className="py-3 px-3">Tempo</th>
              <th className="py-3 px-3">Ritmo / Vel.</th>
              <th className="py-3 px-3">FC Média</th>
              <th className="py-3 px-3">Cadência</th>
              <th className="py-3 px-3">Elevação</th>
              <th className="py-3 px-3">Origem</th>
              <th className="py-3 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.slice(0, visibleCount).map((act) => {
              const sp = getSportDisplay(act.type);
              const km = act.distance > 0 ? (act.distance / 1000).toFixed(2) : null;
              const perf = formatPerformance(act);

              return (
                <tr key={act.id || act.strava_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDate(act.start_date || act.start_date_local || "")}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sp.color}`}>
                      <span>{sp.icon}</span>
                      <span>{sp.label}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    {act.name}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                    {km ? `${km} km` : "--"}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {formatSeconds(act.moving_time)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-medium text-cyan-600 dark:text-cyan-400">
                    {perf}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {act.average_heartrate ? (
                      <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-medium">
                        <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                        <span>{Math.round(act.average_heartrate)} bpm</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">--</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {act.average_cadence ? (
                      <span className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                        <Footprints className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                        <span>
                          {Math.round(act.average_cadence)} {act.type?.toLowerCase().includes("ride") ? "rpm" : "spm"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">--</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {act.total_elevation_gain ? `+${Math.round(act.total_elevation_gain)}m` : "--"}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                      {act.source === "strava_api" ? "Strava API" : act.source === "csv_import" ? "CSV" : "Amostra"}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {onAnalyzeAi && (
                        <button
                          onClick={() => onAnalyzeAi(act)}
                          title="Analisar esta atividade com a IA do Google Gemini"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-700 hover:bg-teal-500 hover:text-slate-950 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500 dark:hover:text-slate-950 border border-teal-200 dark:border-teal-500/20 transition shadow-xs"
                        >
                          <BrainCircuit className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          <span>Raio-X IA</span>
                        </button>
                      )}
                      {onCompare && (
                        <button
                          onClick={() => onCompare(act)}
                          title="Abrir no Duelo Virtual contra outro treino"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-slate-950 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950 border border-emerald-200 dark:border-emerald-500/20 transition shadow-xs"
                        >
                          <Swords className="w-3 h-3" />
                          <span>Duelo</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500">
          <span>
            Exibindo <strong>{visibleCount}</strong> de <strong>{filtered.length}</strong> atividades
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setVisibleCount((prev) => prev + 50)}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            >
              + Carregar mais 50
            </button>
            <button
              onClick={() => setVisibleCount(filtered.length)}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition"
            >
              Mostrar todas ({filtered.length})
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Nenhuma atividade corresponde aos filtros selecionados.
        </div>
      )}
    </div>
  );
};
