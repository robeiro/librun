"use client";

import React, { useState } from "react";
import { Activity } from "../types";
import { Search, Heart, Footprints, Swords } from "lucide-react";

interface ActivitiesTableProps {
  activities: Activity[];
  onCompare?: (activity: Activity) => void;
}

export const ActivitiesTable: React.FC<ActivitiesTableProps> = ({ activities, onCompare }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, "0")}m`;
    }
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const formatPace = (distanceMeters: number, seconds: number) => {
    if (!distanceMeters || !seconds) return "--:--";
    const km = distanceMeters / 1000;
    const paceSec = seconds / km;
    const m = Math.floor(paceSec / 60);
    const s = Math.round(paceSec % 60);
    return `${m}:${s.toString().padStart(2, "0")} min/km`;
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

  const filtered = activities.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Histórico de Atividades do Strava
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activities.length} corridas importadas e analisadas.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar atividade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-3">Data</th>
              <th className="py-3 px-3">Nome da Corrida</th>
              <th className="py-3 px-3">Distância</th>
              <th className="py-3 px-3">Tempo</th>
              <th className="py-3 px-3">Pace Médio</th>
              <th className="py-3 px-3">FC Média</th>
              <th className="py-3 px-3">Cadência</th>
              <th className="py-3 px-3">Elevação</th>
              <th className="py-3 px-3">Origem</th>
              <th className="py-3 px-3 text-right">Comparar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.slice(0, 50).map((act) => {
              const km = (act.distance / 1000).toFixed(2);
              const pace = formatPace(act.distance, act.moving_time);
              return (
                <tr key={act.id || act.strava_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDate(act.start_date || act.start_date_local || "")}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    {act.name}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                    {km} km
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {formatSeconds(act.moving_time)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-medium text-cyan-600 dark:text-cyan-400">
                    {pace}
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
                        <span>{Math.round(act.average_cadence)} spm</span>
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
                    {onCompare && (
                      <button
                        onClick={() => onCompare(act)}
                        title="Abrir no Duelo Virtual contra outra corrida"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-slate-950 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950 border border-emerald-200 dark:border-emerald-500/20 transition shadow-xs"
                      >
                        <Swords className="w-3 h-3" />
                        <span>Duelo</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Nenhuma atividade corresponde à busca.
        </div>
      )}
    </div>
  );
};
