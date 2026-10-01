"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Activity } from "../types";
import {
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Swords,
  ArrowRightLeft,
  Search,
  Sparkles,
  Flame,
  TrendingUp,
  Award
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { useTheme } from "../context/ThemeContext";

interface ActivityDuelProps {
  activities: Activity[];
  initialActivityA?: Activity | null;
  initialActivityB?: Activity | null;
}

export const ActivityDuel: React.FC<ActivityDuelProps> = ({
  activities,
  initialActivityA,
  initialActivityB,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Selected activities
  const [selectedIdA, setSelectedIdA] = useState<string>("");
  const [selectedIdB, setSelectedIdB] = useState<string>("");

  // Search filter for dropdowns
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [openSelector, setOpenSelector] = useState<"A" | "B" | null>(null);

  // Initialize selected activities
  useEffect(() => {
    if (initialActivityA) {
      setSelectedIdA(String(initialActivityA.strava_id || initialActivityA.id));
    } else if (activities.length > 0) {
      setSelectedIdA((prev) => prev || String(activities[0].strava_id || activities[0].id));
    }

    if (initialActivityB) {
      setSelectedIdB(String(initialActivityB.strava_id || initialActivityB.id));
    } else if (activities.length > 1) {
      setSelectedIdB((prev) => prev || String(activities[1].strava_id || activities[1].id));
    }
  }, [activities, initialActivityA, initialActivityB]);

  const actA = useMemo(() => {
    return activities.find(
      (a) => String(a.strava_id || a.id) === String(selectedIdA)
    );
  }, [activities, selectedIdA]);

  const actB = useMemo(() => {
    return activities.find(
      (a) => String(a.strava_id || a.id) === String(selectedIdB)
    );
  }, [activities, selectedIdB]);

  // Race distance in meters (based on the common distance to make the race 100% fair)
  const raceDistanceMeters = useMemo(() => {
    if (!actA || !actB) return 5000;
    // Default to the minimum distance so both runners have data across the full course
    return Math.min(actA.distance, actB.distance);
  }, [actA, actB]);

  const raceDistanceKm = (raceDistanceMeters / 1000).toFixed(2);

  // Speeds in m/s
  const speedA = useMemo(() => {
    if (!actA || actA.moving_time <= 0) return 3.0;
    return actA.distance / actA.moving_time;
  }, [actA]);

  const speedB = useMemo(() => {
    if (!actB || actB.moving_time <= 0) return 3.0;
    return actB.distance / actB.moving_time;
  }, [actB]);

  // Projected finish times for the raceDistanceMeters
  const timeASeconds = useMemo(() => {
    return speedA > 0 ? raceDistanceMeters / speedA : 0;
  }, [raceDistanceMeters, speedA]);

  const timeBSeconds = useMemo(() => {
    return speedB > 0 ? raceDistanceMeters / speedB : 0;
  }, [raceDistanceMeters, speedB]);

  const maxRaceTimeSeconds = useMemo(() => {
    return Math.max(timeASeconds, timeBSeconds);
  }, [timeASeconds, timeBSeconds]);

  // Simulation State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progressRatio, setProgressRatio] = useState<number>(0); // 0 to 1
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(5); // 1x, 2x, 5x, 10x, 25x
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Simulated elapsed time
  const currentSimulatedTime = progressRatio * maxRaceTimeSeconds;

  // Distances covered at current simulation time
  const distACovered = Math.min(raceDistanceMeters, currentSimulatedTime * speedA);
  const distBCovered = Math.min(raceDistanceMeters, currentSimulatedTime * speedB);

  // Runner progress on track (0 to 100%)
  const posAPercent = raceDistanceMeters > 0 ? Math.min(100, (distACovered / raceDistanceMeters) * 100) : 0;
  const posBPercent = raceDistanceMeters > 0 ? Math.min(100, (distBCovered / raceDistanceMeters) * 100) : 0;

  // Real-time Gap
  const gapMeters = Math.round(distACovered - distBCovered);
  const isAWinning = distACovered > distBCovered;
  const isTied = Math.abs(distACovered - distBCovered) < 2;

  // Race completed?
  const isRaceFinished = progressRatio >= 1;
  const winner = useMemo(() => {
    if (!actA || !actB) return null;
    if (timeASeconds < timeBSeconds) return "A";
    if (timeBSeconds < timeASeconds) return "B";
    return "tie";
  }, [actA, actB, timeASeconds, timeBSeconds]);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const step = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Real seconds elapsed * speedMultiplier
      const deltaSimulatedSec = (deltaMs / 1000) * speedMultiplier;
      setProgressRatio((prev) => {
        const nextTime = (prev * maxRaceTimeSeconds) + deltaSimulatedSec;
        const nextRatio = maxRaceTimeSeconds > 0 ? nextTime / maxRaceTimeSeconds : 1;
        if (nextRatio >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return nextRatio;
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speedMultiplier, maxRaceTimeSeconds]);

  // Helpers
  const formatTime = (totalSec: number) => {
    const sec = Math.max(0, Math.round(totalSec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) {
      return `${h}h ${remM.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    }
    return `${remM}:${s.toString().padStart(2, "0")}`;
  };

  const formatPaceFromSpeed = (spd: number) => {
    if (!spd || spd <= 0) return "--:--";
    const secPerKm = 1000 / spd;
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, "0")} /km`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  const formatActivityName = (act?: Activity | null) => {
    if (!act) return "";
    const dateStr = formatDate(act.start_date || act.start_date_local);
    return dateStr ? `${act.name} (${dateStr})` : act.name;
  };

  // Swap runners
  const handleSwap = () => {
    const temp = selectedIdA;
    setSelectedIdA(selectedIdB);
    setSelectedIdB(temp);
    setProgressRatio(0);
    setIsPlaying(false);
  };

  // Reset race
  const handleReset = () => {
    setIsPlaying(false);
    setProgressRatio(0);
  };

  // Play / Pause
  const handleTogglePlay = () => {
    if (isRaceFinished) {
      setProgressRatio(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Filter activities for search
  const filteredActsA = activities.filter((a) => {
    const term = searchA.toLowerCase();
    const nameWithDate = formatActivityName(a).toLowerCase();
    return nameWithDate.includes(term);
  });
  const filteredActsB = activities.filter((a) => {
    const term = searchB.toLowerCase();
    const nameWithDate = formatActivityName(a).toLowerCase();
    return nameWithDate.includes(term);
  });

  // Generate Km-by-Km progression data for the chart
  const splitChartData = useMemo(() => {
    if (!actA || !actB) return [];
    const totalKm = Math.ceil(raceDistanceMeters / 1000);
    const points = [];

    for (let km = 1; km <= totalKm; km++) {
      const targetMeters = Math.min(km * 1000, raceDistanceMeters);
      const tA = targetMeters / speedA;
      const tB = targetMeters / speedB;
      const diffSec = tB - tA; // positive means A is faster than B

      points.push({
        km: `${(targetMeters / 1000).toFixed(1)}k`,
        tempoA: Math.round(tA),
        tempoB: Math.round(tB),
        formatadoA: formatTime(tA),
        formatadoB: formatTime(tB),
        vantagemSegundos: Math.round(diffSec),
      });
    }
    return points;
  }, [actA, actB, raceDistanceMeters, speedA, speedB]);

  if (activities.length < 2) {
    return (
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-sm">
        <Swords className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Duelo Virtual Requer ao Menos 2 Atividades
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Sincronize mais atividades ou carregue a base de exemplo para colocar duas corridas lado a lado e assistir à disputa em tempo real!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Activity Selectors */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
                <Swords className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <span>Duelo Virtual de Atividades</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                    2 Corredores na Pista
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compare qualquer par de treinos ou provas simulando uma competição ao vivo metro a metro.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSwap}
              title="Inverter os dois corredores de pista"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Inverter Pistas</span>
            </button>
          </div>
        </div>

        {/* Competitor Selectors Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {/* Runner A Box */}
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Pista 1 • Corredor A (Verde)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {formatDate(actA?.start_date)}
              </span>
            </div>

            {/* Select Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setOpenSelector(openSelector === "A" ? null : "A")}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 text-slate-900 dark:text-slate-100 flex items-center justify-between hover:border-emerald-500 transition shadow-xs text-xs font-bold"
              >
                <span className="truncate max-w-[80%]">
                  {actA ? `${formatActivityName(actA)} • ${(actA.distance / 1000).toFixed(2)} km` : "Selecione uma atividade..."}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-extrabold ml-2">
                  Trocar ▼
                </span>
              </button>

              {/* Dropdown Menu */}
              {openSelector === "A" && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 max-h-64 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou data..."
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredActsA.map((a) => (
                      <button
                        key={a.id || a.strava_id}
                        onClick={() => {
                          setSelectedIdA(String(a.strava_id || a.id));
                          setOpenSelector(null);
                          handleReset();
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs transition flex items-center justify-between ${
                          String(a.strava_id || a.id) === String(selectedIdA)
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="truncate max-w-[200px]">
                          <span className="block font-semibold truncate">{formatActivityName(a)}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(a.start_date || a.start_date_local)}</span>
                        </div>
                        <div className="text-right text-[11px] shrink-0 font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold block">
                            {(a.distance / 1000).toFixed(2)} km
                          </span>
                          <span className="text-slate-400">{formatPaceFromSpeed(a.distance / a.moving_time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats snapshot */}
            {actA && (
              <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] text-slate-500 block">Tempo Total</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{formatTime(actA.moving_time)}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] text-slate-500 block">Pace Médio</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatPaceFromSpeed(speedA)}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] text-slate-500 block">FC Média</span>
                  <strong className="text-rose-600 dark:text-rose-400 font-extrabold">{actA.average_heartrate ? `${Math.round(actA.average_heartrate)} bpm` : "--"}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] text-slate-500 block">Cadência</span>
                  <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold">{actA.average_cadence ? `${Math.round(actA.average_cadence)} spm` : "--"}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Runner B Box */}
          <div className="rounded-2xl border-2 border-cyan-500/30 bg-cyan-50/30 dark:bg-cyan-950/10 p-4 space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                  Pista 2 • Corredor B (Azul)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {formatDate(actB?.start_date)}
              </span>
            </div>

            {/* Select Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setOpenSelector(openSelector === "B" ? null : "B")}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-cyan-500/40 text-slate-900 dark:text-slate-100 flex items-center justify-between hover:border-cyan-500 transition shadow-xs text-xs font-bold"
              >
                <span className="truncate max-w-[80%]">
                  {actB ? `${formatActivityName(actB)} • ${(actB.distance / 1000).toFixed(2)} km` : "Selecione uma atividade..."}
                </span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase font-extrabold ml-2">
                  Trocar ▼
                </span>
              </button>

              {/* Dropdown Menu */}
              {openSelector === "B" && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 max-h-64 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou data..."
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredActsB.map((a) => (
                      <button
                        key={a.id || a.strava_id}
                        onClick={() => {
                          setSelectedIdB(String(a.strava_id || a.id));
                          setOpenSelector(null);
                          handleReset();
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs transition flex items-center justify-between ${
                          String(a.strava_id || a.id) === String(selectedIdB)
                            ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="truncate max-w-[200px]">
                          <span className="block font-semibold truncate">{formatActivityName(a)}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(a.start_date || a.start_date_local)}</span>
                        </div>
                        <div className="text-right text-[11px] shrink-0 font-medium">
                          <span className="text-cyan-600 dark:text-cyan-400 font-bold block">
                            {(a.distance / 1000).toFixed(2)} km
                          </span>
                          <span className="text-slate-400">{formatPaceFromSpeed(a.distance / a.moving_time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats snapshot */}
            {actB && (
              <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-slate-500 block">Tempo Total</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{formatTime(actB.moving_time)}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-slate-500 block">Pace Médio</span>
                  <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold">{formatPaceFromSpeed(speedB)}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-slate-500 block">FC Média</span>
                  <strong className="text-rose-600 dark:text-rose-400 font-extrabold">{actB.average_heartrate ? `${Math.round(actB.average_heartrate)} bpm` : "--"}</strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-slate-500 block">Cadência</span>
                  <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold">{actB.average_cadence ? `${Math.round(actB.average_cadence)} spm` : "--"}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIRTUAL STADIUM RACE TRACK (Simulação Ao Vivo das 2 Pessoas Competindo) */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6 relative overflow-hidden">
        {/* Track Title and Telemetry HUD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Pista de Disputa • {raceDistanceKm} km
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <span>Simulação da Corrida em Tempo Real</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                (Relógio: {formatTime(currentSimulatedTime)})
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Real-time Gap Banner */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              {isTied ? (
                <span className="text-slate-600 dark:text-slate-300">Empate técnico lado a lado!</span>
              ) : isAWinning ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{actA ? formatActivityName(actA) : "Corredor A"} lidera (+{Math.abs(gapMeters)}m)</span>
                </span>
              ) : (
                <span className="text-cyan-600 dark:text-cyan-400 flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{actB ? formatActivityName(actB) : "Corredor B"} lidera (+{Math.abs(gapMeters)}m)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 1. PISTA DE ESTÁDIO LADO A LADO (Visual Principal, Leve e Fluido) */}
        <div className="bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 rounded-2xl p-4 sm:p-6 relative select-none">
          {/* Finish Line Ribbon */}
          <div className="absolute right-8 top-0 bottom-0 w-2.5 bg-repeating-linear-gradient flex flex-col justify-around z-10 border-l border-r border-slate-400 opacity-80"
               style={{
                 backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 10px, #000 10px, #000 20px)"
               }}
          />

          {/* Start and Distance markers */}
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-4 px-2">
            <span>🏁 Largada (0 km)</span>
            <span>25% ({(raceDistanceMeters * 0.25 / 1000).toFixed(1)}k)</span>
            <span>50% ({(raceDistanceMeters * 0.50 / 1000).toFixed(1)}k)</span>
            <span>75% ({(raceDistanceMeters * 0.75 / 1000).toFixed(1)}k)</span>
            <span className="text-amber-400 font-extrabold pr-4">🏆 Chegada ({raceDistanceKm}k)</span>
          </div>

          {/* PISTA 1: CORREDOR A (LADO A LADO) */}
          <div className="relative h-20 bg-slate-800/80 rounded-xl border border-slate-700/80 mb-3 flex items-center px-4 overflow-hidden">
            {/* Lane line dashes */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 border-b border-dashed border-slate-600" />
            <div className="absolute left-3 top-2 text-[10px] font-bold text-emerald-400/80 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Pista 1: {actA ? formatActivityName(actA) : "Corredor A"}</span>
            </div>

            {/* Runner A Avatar moving across lane */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-75 flex flex-col items-center"
              style={{
                left: `clamp(12px, ${posAPercent}%, calc(100% - 70px))`,
              }}
            >
              {/* Dynamic Tag */}
              <div className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center space-x-1">
                <span>{(distACovered / 1000).toFixed(2)} km</span>
              </div>
              {/* Runner Icon */}
              <div
                className={`w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/40 text-base ${isPlaying ? "animate-bounce" : ""}`}
                title={formatActivityName(actA)}
              >
                🏃‍♂️
              </div>
            </div>
          </div>

          {/* PISTA 2: CORREDOR B (LADO A LADO) */}
          <div className="relative h-20 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center px-4 overflow-hidden">
            {/* Lane line dashes */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 border-b border-dashed border-slate-600" />
            <div className="absolute left-3 top-2 text-[10px] font-bold text-cyan-400/80 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Pista 2: {actB ? formatActivityName(actB) : "Corredor B"}</span>
            </div>

            {/* Runner B Avatar moving across lane */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-75 flex flex-col items-center"
              style={{
                left: `clamp(12px, ${posBPercent}%, calc(100% - 70px))`,
              }}
            >
              {/* Dynamic Tag */}
              <div className="bg-cyan-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center space-x-1">
                <span>{(distBCovered / 1000).toFixed(2)} km</span>
              </div>
              {/* Runner Icon */}
              <div
                className={`w-9 h-9 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-400/40 text-base ${isPlaying ? "animate-bounce" : ""}`}
                title={formatActivityName(actB)}
              >
                🏃‍♀️
              </div>
            </div>
          </div>
        </div>

        {/* INTERACTIVE TIMELINE SCRUBBER & CONTROLS */}
        <div className="space-y-4 pt-2">
          {/* Timeline Range Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>Largada</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">
                Progresso: {Math.round(progressRatio * 100)}% ({formatTime(currentSimulatedTime)})
              </span>
              <span>Chegada</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.002"
              value={progressRatio}
              onChange={(e) => {
                setIsPlaying(false);
                setProgressRatio(parseFloat(e.target.value));
              }}
              className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Action Buttons & Speed controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTogglePlay}
                className="py-2.5 px-5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center space-x-2 shadow-md shadow-emerald-500/20 transition"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-slate-950" />
                    <span>Pausar</span>
                  </>
                ) : isRaceFinished ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Repetir Duelo</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Iniciar Disputa</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                title="Reiniciar Corrida"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Speed Multiplier Pills */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400 mr-1 text-[11px] font-semibold">Velocidade:</span>
              {[1, 2, 5, 10, 25].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeedMultiplier(s)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                    speedMultiplier === s
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FINISH BANNER (Quando a corrida chega ao fim) */}
        {isRaceFinished && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-cyan-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-600 dark:text-amber-400 block">
                  🏁 Duelo Concluído!
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {winner === "A" ? (
                    <span>Vitória de <strong className="text-emerald-600 dark:text-emerald-400">{formatActivityName(actA)}</strong>!</span>
                  ) : winner === "B" ? (
                    <span>Vitória de <strong className="text-cyan-600 dark:text-cyan-400">{formatActivityName(actB)}</strong>!</span>
                  ) : (
                    <span>Empate Exato na Linha de Chegada!</span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Diferença no tempo final: <strong>{formatTime(Math.abs(timeASeconds - timeBSeconds))}</strong> na distância de {raceDistanceKm} km.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Pace do Vencedor:
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {winner === "A" ? formatPaceFromSpeed(speedA) : formatPaceFromSpeed(speedB)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* METRIC-BY-METRIC HEAD-TO-HEAD COMPARISON TABLE */}
      {actA && actB && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Comparativo Detalhado de Performance (Métricas Diretas)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Tempo Projetado */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                Tempo nos {raceDistanceKm} km
              </span>
              <div className="my-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[48%]" title={formatActivityName(actA)}>
                    A ({formatDate(actA.start_date || actA.start_date_local)}): {formatTime(timeASeconds)}
                  </span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[48%]" title={formatActivityName(actB)}>
                    B ({formatDate(actB.start_date || actB.start_date_local)}): {formatTime(timeBSeconds)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {timeASeconds < timeBSeconds ? (
                  <span className="text-emerald-600 dark:text-emerald-400">✓ {formatActivityName(actA)} foi {formatTime(timeBSeconds - timeASeconds)} mais rápido</span>
                ) : timeBSeconds < timeASeconds ? (
                  <span className="text-cyan-600 dark:text-cyan-400">✓ {formatActivityName(actB)} foi {formatTime(timeASeconds - timeBSeconds)} mais rápido</span>
                ) : (
                  "Mesmo tempo"
                )}
              </div>
            </div>

            {/* 2. Pace Médio */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                Ritmo Médio (Pace)
              </span>
              <div className="my-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[48%]" title={formatActivityName(actA)}>
                    A ({formatDate(actA.start_date || actA.start_date_local)}): {formatPaceFromSpeed(speedA)}
                  </span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[48%]" title={formatActivityName(actB)}>
                    B ({formatDate(actB.start_date || actB.start_date_local)}): {formatPaceFromSpeed(speedB)}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {speedA > speedB ? (
                  <span className="text-emerald-600 dark:text-emerald-400">✓ {formatActivityName(actA)} teve pace {Math.round(Math.abs(1000/speedA - 1000/speedB))}s/km mais veloz</span>
                ) : speedB > speedA ? (
                  <span className="text-cyan-600 dark:text-cyan-400">✓ {formatActivityName(actB)} teve pace {Math.round(Math.abs(1000/speedB - 1000/speedA))}s/km mais veloz</span>
                ) : (
                  "Ritmos idênticos"
                )}
              </div>
            </div>

            {/* 3. Frequência Cardíaca */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                Coração (FC Média)
              </span>
              <div className="my-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[48%]" title={formatActivityName(actA)}>
                    A ({formatDate(actA.start_date || actA.start_date_local)}): {actA.average_heartrate ? `${Math.round(actA.average_heartrate)} bpm` : "--"}
                  </span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[48%]" title={formatActivityName(actB)}>
                    B ({formatDate(actB.start_date || actB.start_date_local)}): {actB.average_heartrate ? `${Math.round(actB.average_heartrate)} bpm` : "--"}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {actA.average_heartrate && actB.average_heartrate ? (
                  actA.average_heartrate < actB.average_heartrate ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✓ {formatActivityName(actA)} foi mais econômico (-{Math.round(actB.average_heartrate - actA.average_heartrate)} bpm)</span>
                  ) : actB.average_heartrate < actA.average_heartrate ? (
                    <span className="text-cyan-600 dark:text-cyan-400">✓ {formatActivityName(actB)} foi mais econômico (-{Math.round(actA.average_heartrate - actB.average_heartrate)} bpm)</span>
                  ) : "Mesma FC média"
                ) : "Sem dados de FC"}
              </div>
            </div>

            {/* 4. Cadência Biomecânica */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                Cadência (spm)
              </span>
              <div className="my-2 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[48%]" title={formatActivityName(actA)}>
                    A ({formatDate(actA.start_date || actA.start_date_local)}): {actA.average_cadence ? `${Math.round(actA.average_cadence)} spm` : "--"}
                  </span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[48%]" title={formatActivityName(actB)}>
                    B ({formatDate(actB.start_date || actB.start_date_local)}): {actB.average_cadence ? `${Math.round(actB.average_cadence)} spm` : "--"}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {actA.average_cadence && actB.average_cadence ? (
                  actA.average_cadence >= 165 && actB.average_cadence < 165 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✓ {formatActivityName(actA)} teve cadência mais protetora</span>
                  ) : actB.average_cadence >= 165 && actA.average_cadence < 165 ? (
                    <span className="text-cyan-600 dark:text-cyan-400">✓ {formatActivityName(actB)} teve cadência mais protetora</span>
                  ) : (
                    `Diferença: ${Math.round(Math.abs(actA.average_cadence - actB.average_cadence))} spm`
                  )
                ) : "Sem dados de cadência"}
              </div>
            </div>
          </div>

          {/* AI COACH COMPARISON VERDICT */}
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Diagnóstico do Treinador sobre o Duelo</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {winner === "A" ? (
                <>
                  A atividade <strong>{formatActivityName(actA)}</strong> superou <strong>{formatActivityName(actB)}</strong> por uma margem de{" "}
                  <strong>{formatTime(timeBSeconds - timeASeconds)}</strong>.{" "}
                  {actA.average_heartrate && actB.average_heartrate && actA.average_heartrate <= actB.average_heartrate ? (
                    <>
                      Impressionante: além de mais rápida, ela exigiu <strong>menos esforço cardíaco</strong> ({Math.round(actA.average_heartrate)} bpm vs {Math.round(actB.average_heartrate)} bpm), indicando uma excelente evolução de eficiência aeróbica e densidade mitocondrial!
                    </>
                  ) : (
                    <>
                      Essa corrida teve uma intensidade metabólica superior, ideal para treinos de ritmo e tiros.
                    </>
                  )}
                </>
              ) : winner === "B" ? (
                <>
                  A atividade <strong>{formatActivityName(actB)}</strong> foi vitoriosa sobre <strong>{formatActivityName(actA)}</strong> por{" "}
                  <strong>{formatTime(timeASeconds - timeBSeconds)}</strong>.{" "}
                  {actB.average_heartrate && actA.average_heartrate && actB.average_heartrate <= actA.average_heartrate ? (
                    <>
                      Excelente consistência: mesmo correndo mais rápido, a frequência cardíaca foi controlada, evidenciando ótima economia de corrida!
                    </>
                  ) : (
                    <>
                      O ritmo de prova foi sustentado com maior aplicação de força e potência aeróbica.
                    </>
                  )}
                </>
              ) : (
                <>
                  Ambas as atividades tiveram rendimentos praticamente idênticos no trecho comparado.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Km-by-Km Progression Chart */}
      {splitChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Evolução do Tempo Acumulado (Km a Km)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Veja o distanciamento entre os dois corredores ao longo do trajeto.
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold" title={formatActivityName(actA)}>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Pista 1: {actA ? formatActivityName(actA) : "Corredor A"}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-bold" title={formatActivityName(actB)}>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Pista 2: {actB ? formatActivityName(actB) : "Corredor B"}</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={splitChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={isDark ? 0.4 : 0.8} />
                <XAxis
                  dataKey="km"
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val: unknown) => formatTime(Number(val) || 0)}
                />
                <Tooltip
                  formatter={(val: unknown) => [formatTime(Number(val) || 0), "Tempo"]}
                  contentStyle={{
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#cbd5e1",
                    borderRadius: "0.75rem",
                    fontSize: "0.75rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="tempoA"
                  name={actA ? formatActivityName(actA) : "Corredor A"}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="tempoB"
                  name={actB ? formatActivityName(actB) : "Corredor B"}
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
