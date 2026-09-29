"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  AnalyticsData, 
  AthleteSettings, 
  Activity 
} from "../types";
import { Navbar } from "../components/Navbar";
import { SummaryCards } from "../components/SummaryCards";
import { CoachingInsights } from "../components/CoachingInsights";
import { WeeklyVolumeChart } from "../components/WeeklyVolumeChart";
import { HeartRateZonesChart } from "../components/HeartRateZonesChart";
import { RacePredictor } from "../components/RacePredictor";
import { ActivitiesTable } from "../components/ActivitiesTable";
import { ActivityDuel } from "../components/ActivityDuel";
import { StravaConnectModal } from "../components/StravaConnectModal";
import { SettingsModal } from "../components/SettingsModal";
import { GeminiCoach } from "../components/GeminiCoach";
import { ActivityAiModal } from "../components/ActivityAiModal";
import { 
  Sparkles, 
  UploadCloud, 
  Activity as ActivityIcon, 
  Heart, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2,
  Swords,
  BrainCircuit
} from "lucide-react";

export default function Home() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [athlete, setAthlete] = useState<AthleteSettings | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "coach" | "zones" | "duel" | "activities">("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected activities for the virtual duel
  const [duelActivityA, setDuelActivityA] = useState<Activity | null>(null);
  const [duelActivityB, setDuelActivityB] = useState<Activity | null>(null);

  // Single activity AI modal
  const [selectedActivityForAi, setSelectedActivityForAi] = useState<Activity | null>(null);
  const [isActivityAiModalOpen, setIsActivityAiModalOpen] = useState<boolean>(false);

  const handleAnalyzeActivityWithAi = (act: Activity) => {
    setSelectedActivityForAi(act);
    setIsActivityAiModalOpen(true);
  };

  const handleCompareActivity = (act: Activity) => {
    setDuelActivityA(act);
    const other = activities.find(a => String(a.strava_id || a.id) !== String(act.strava_id || act.id));
    if (other) {
      setDuelActivityB(other);
    }
    setActiveTab("duel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch settings
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setAthlete(sData);
      }

      // 2. Fetch analytics
      const analyticsRes = await fetch("/api/analytics");
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
      }

      // 3. Fetch activities
      const actRes = await fetch("/api/activities");
      if (actRes.ok) {
        const actsData = await actRes.json();
        setActivities(actsData.activities || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle Strava OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast(`Autorização cancelada ou recusada pelo Strava: ${error}`);
      fetchData();
      return;
    }

    if (code) {
      // Clean query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const handleCallback = async () => {
        setIsLoading(true);
        showToast("Conectando ao Strava e sincronizando suas corridas...");
        try {
          const savedLimit = typeof window !== "undefined" ? localStorage.getItem("librun_sync_limit") : null;
          const savedClientId = typeof window !== "undefined" ? localStorage.getItem("librun_strava_client_id") : null;
          const savedClientSecret = typeof window !== "undefined" ? localStorage.getItem("librun_strava_client_secret") : null;
          const syncCount = savedLimit !== null ? parseInt(savedLimit, 10) : 0;
          const exRes = await fetch("/api/strava/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: code,
              client_id: savedClientId || undefined,
              client_secret: savedClientSecret || undefined,
              sync_count: syncCount,
            }),
          });
          const exData = await exRes.json();
          if (exRes.ok) {
            if (exData.sync_error) {
              showToast(`Strava conectado, mas houve erro ao importar corridas: ${exData.sync_error}`);
            } else {
              const countMsg = exData.sync?.runs_synced 
                ? `${exData.sync.runs_synced} corridas importadas com sucesso!` 
                : "Suas corridas foram importadas.";
              showToast(`Conta do Strava conectada com sucesso! ${countMsg}`);
            }
          } else {
            showToast(`Erro na autorização do Strava: ${exData.detail || "Verifique as credenciais no painel do Strava"}`);
          }
        } catch (e) {
          console.error("Erro no callback Strava:", e);
          showToast("Falha ao comunicar com o servidor. Verifique se o backend está online.");
        } finally {
          await fetchData();
          setIsLoading(false);
        }
      };
      handleCallback();
    } else {
      fetchData();
    }
  }, [fetchData]);

  // Load sample dataset
  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/activities/sample", { method: "POST" });
      const data = await res.json();
      showToast(data.message);
      await fetchData();
    } catch {
      showToast("Erro ao carregar dados de exemplo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save athlete settings
  const handleSaveSettings = async (newSettings: Partial<AthleteSettings>) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        showToast("Configurações salvas!");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Clear data
  const handleClearData = async () => {
    try {
      await fetch("/api/activities", { method: "DELETE" });
      showToast("Todas as corridas foram apagadas.");
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const hasData = activities.length > 0 && analytics && analytics.summary.total_runs > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors">
      {/* Navbar */}
      <Navbar
        athlete={athlete}
        totalRuns={analytics?.summary?.total_runs || 0}
        onOpenConnect={() => setIsConnectModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLoadSample={handleLoadSample}
        isLoading={isLoading}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* If no data yet, show welcoming hero with quick setup */}
        {!hasData && !isLoading && (
          <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto my-8 space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <ActivityIcon className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                Bem-vindo ao <span className="bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">librun</span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                Conecte seu Strava ou carregue seus arquivos de atividade para descobrir onde você está perdendo rendimento e como correr mais rápido sem se machucar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="py-3 px-5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Conectar Strava / Upload</span>
              </button>

              <button
                onClick={handleLoadSample}
                className="py-3 px-5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Testar com Dados de Exemplo</span>
              </button>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-3 gap-4 text-left text-xs text-slate-600 dark:text-slate-400">
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block mb-1">🎯 80/20 Polarizado</strong>
                Descubra se você está caindo na armadilha da Zona Cinzenta (Z3).
              </div>
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block mb-1">🛡️ Prevenção de Lesões</strong>
                Índice ACWR (Carga Aguda vs Crônica) para calibrar seus aumentos de km.
              </div>
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block mb-1">⚡ Eficiência de Passada</strong>
                Diagnóstico de cadência (spm) para eliminar overstriding.
              </div>
            </div>
          </div>
        )}

        {/* When data is present: Navigation Tabs & Dashboard */}
        {hasData && (
          <>
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto gap-2">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "overview"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <ActivityIcon className="w-4 h-4" />
                  <span>Visão Geral</span>
                </button>

                <button
                  onClick={() => setActiveTab("coach")}
                  className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "coach"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Coach IA (Gemini)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                </button>

                <button
                  onClick={() => setActiveTab("zones")}
                  className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "zones"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Zonas Cardíacas & 80/20</span>
                </button>

                <button
                  onClick={() => setActiveTab("duel")}
                  className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "duel"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <Swords className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Duelo Virtual (Comparar)</span>
                </button>

                <button
                  onClick={() => setActiveTab("activities")}
                  className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === "activities"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Corridas ({activities.length})</span>
                </button>
              </div>

              <div className="hidden md:flex items-center text-xs text-slate-500 dark:text-slate-400">
                <span>Atleta: <strong className="text-slate-800 dark:text-slate-300">{athlete?.athlete_name}</strong></span>
              </div>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* 1. KPI Cards */}
                {analytics && (
                  <SummaryCards
                    summary={analytics.summary}
                    acwr={analytics.acwr}
                  />
                )}

                {/* 2. Personalized Coaching Insights */}
                {analytics?.coaching_insights && (
                  <CoachingInsights insights={analytics.coaching_insights} />
                )}

                {/* 3. Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analytics?.weekly_breakdown && (
                    <WeeklyVolumeChart weeks={analytics.weekly_breakdown} />
                  )}

                  {analytics?.hr_distribution && (
                    <HeartRateZonesChart distribution={analytics.hr_distribution} />
                  )}
                </div>

                {/* 4. Race Predictions */}
                {analytics?.race_predictions && (
                  <RacePredictor predictionsData={analytics.race_predictions} />
                )}

                {/* 5. Recent Activities */}
                <ActivitiesTable 
                  activities={activities} 
                  onCompare={handleCompareActivity}
                  onAnalyzeAi={handleAnalyzeActivityWithAi}
                />
              </div>
            )}

            {/* TAB: COACH RECOMMENDATIONS */}
            {activeTab === "coach" && (
              <div className="space-y-6">
                {/* 1. Google Gemini Deep AI Diagnosis */}
                <GeminiCoach 
                  athlete={athlete} 
                  onOpenSettings={() => setIsSettingsModalOpen(true)} 
                />

                {/* 2. Physiological Rule-based Insights */}
                {analytics?.coaching_insights && (
                  <CoachingInsights insights={analytics.coaching_insights} />
                )}

                {/* 3. Training load explanation */}
                {analytics?.acwr && (
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      <span>Como Funciona o Índice de Carga ACWR (Prevenção de Lesões)?</span>
                    </h3>
                    <p className="leading-relaxed">
                      O <strong>ACWR (Acute:Chronic Workload Ratio)</strong> compara a sua carga dos últimos 7 dias (quanto cansaço você acumulou recentemente) com a sua média das últimas 4 semanas (sua capacidade física crônica instalada).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-1">0.8 a 1.3: Sweet Spot</span>
                        Zona de adaptação máxima com risco de lesão menor que 5%.
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20">
                        <span className="text-amber-700 dark:text-amber-400 font-bold block mb-1">1.3 a 1.5: Sobrecarga</span>
                        Aumento acelerado de esforço. Recomenda-se sono adequado e massagem/alongamento.
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-red-200 dark:border-red-500/20">
                        <span className="text-red-700 dark:text-red-400 font-bold block mb-1">&gt; 1.5: Zona de Perigo</span>
                        Multiplica o risco de estresse ósseo, canelite e tendinopatias. Reduza o volume.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ZONES & POLARIZATION */}
            {activeTab === "zones" && (
              <div className="space-y-6">
                {analytics?.hr_distribution && (
                  <HeartRateZonesChart distribution={analytics.hr_distribution} />
                )}

                <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-xs text-slate-700 dark:text-slate-300 space-y-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    O Princípio do Treinamento Polarizado (Dr. Stephen Seiler)
                  </h3>
                  <p className="leading-relaxed">
                    Estudos com corredores de elite e amadores de alta performance demonstram que atletas que evoluem de forma contínua passam <strong>80% do tempo em intensidades baixas</strong> (Zona 1 e Zona 2) e apenas <strong>20% em intensidades altas</strong> (Zona 4 e 5).
                  </p>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200">
                    <strong>Por que a Zona 3 é perigosa para amadores?</strong><br />
                    A Zona 3 dá a sensação falsa de &quot;treino produtivo&quot; porque o corredor termina cansado e suado. Porém, ela não desenvolve a densidade mitocondrial nem a capacidade enzimática aeróbica tão bem quanto a Z2, e ao mesmo tempo gera fadiga suficiente para impedir que você atinja sua velocidade máxima no treino de tiros (Z4/Z5).
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DUEL / COMPARISON */}
            {activeTab === "duel" && (
              <div className="space-y-6">
                <ActivityDuel
                  activities={activities}
                  initialActivityA={duelActivityA}
                  initialActivityB={duelActivityB}
                />
              </div>
            )}

            {/* TAB: ACTIVITIES */}
            {activeTab === "activities" && (
              <div className="space-y-6">
                <ActivitiesTable 
                  activities={activities} 
                  onCompare={handleCompareActivity}
                  onAnalyzeAi={handleAnalyzeActivityWithAi}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Strava Connect & Upload Modal */}
      <StravaConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        athlete={athlete}
        onRefreshData={fetchData}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        athlete={athlete}
        onSave={handleSaveSettings}
        onClearData={handleClearData}
      />

      {/* Activity AI Analysis Modal */}
      <ActivityAiModal
        activity={selectedActivityForAi}
        athlete={athlete}
        isOpen={isActivityAiModalOpen}
        onClose={() => setIsActivityAiModalOpen(false)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />
    </div>
  );
}
