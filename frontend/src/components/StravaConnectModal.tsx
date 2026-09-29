"use client";

import React, { useState } from "react";
import { X, UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, ExternalLink } from "lucide-react";
import { AthleteSettings } from "../types";

interface StravaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  athlete: AthleteSettings | null;
  onRefreshData: () => void;
}

export const StravaConnectModal: React.FC<StravaConnectModalProps> = ({
  isOpen,
  onClose,
  athlete,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<"oauth" | "file" | "sample">("oauth");
  const [clientId, setClientId] = useState(athlete?.strava_client_id || "");
  const [clientSecret, setClientSecret] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [syncLimit, setSyncLimit] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("librun_sync_limit");
      if (saved) return Number(saved);
    }
    return 30;
  });

  if (!isOpen) return null;

  // Handle direct file upload (CSV / ZIP / GPX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setUploadStatus("Enviando e processando atividades...");
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/activities/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Falha ao importar arquivo");
      }
      setUploadStatus(data.message);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Erro desconhecido ao carregar arquivo");
      setUploadStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle OAuth Strava Redirect
  const handleStartOAuth = async () => {
    if (!clientId.trim()) {
      setErrorMsg("Por favor, preencha o Client ID do seu app Strava.");
      return;
    }
    setErrorMsg(null);
    setIsSyncing(true);

    try {
      localStorage.setItem("librun_sync_limit", String(syncLimit));
      const redirectUri = window.location.origin + "/";
      const res = await fetch("/api/strava/auth-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          redirect_uri: redirectUri,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Save client secret if provided
        if (clientSecret.trim()) {
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strava_client_id: clientId.trim(),
              strava_client_secret: clientSecret.trim(),
            }),
          });
        }
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Erro ao iniciar autenticação Strava.");
      setIsSyncing(false);
    }
  };

  // Sync recent runs from Strava
  const handleSyncStrava = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setUploadStatus(`Conectando ao Strava e baixando suas ${syncLimit === 500 ? "todas as" : syncLimit} corridas mais recentes...`);

    try {
      localStorage.setItem("librun_sync_limit", String(syncLimit));
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: syncLimit }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Falha na sincronização.");
      }
      setUploadStatus(`Sincronização concluída! ${data.runs_synced} corridas atualizadas.`);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
      setUploadStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <UploadCloud className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Conectar Atividades do Strava
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha a forma mais conveniente para importar suas corridas.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("oauth")}
            className={`py-2 px-3 rounded-lg transition ${
              activeTab === "oauth"
                ? "bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-emerald-500/30 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            1. Conexão Strava API (OAuth)
          </button>
          <button
            onClick={() => setActiveTab("file")}
            className={`py-2 px-3 rounded-lg transition ${
              activeTab === "file"
                ? "bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-emerald-500/30 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            2. Importar Arquivo (CSV / ZIP)
          </button>
        </div>

        {/* Tab 1: Strava OAuth */}
        {activeTab === "oauth" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center justify-between">
                <span>Como obter suas credenciais gratuitas:</span>
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center space-x-1 font-semibold"
                >
                  <span>Strava Developers</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                <li>Acesse <strong>strava.com/settings/api</strong>.</li>
                <li>Crie uma aplicação (Ex: <em>librun</em>).</li>
                <li>No campo <strong>Authorization Callback Domain</strong>, digite: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-700 dark:text-emerald-400">localhost</code>.</li>
                <li>Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> abaixo:</li>
              </ol>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Client ID do Strava
                </label>
                <input
                  type="text"
                  placeholder="Ex: 123456"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Client Secret do Strava
                </label>
                <input
                  type="password"
                  placeholder={athlete?.strava_client_secret_configured ? "•••••••• (Já salvo)" : "Ex: a1b2c3d4e5f6..."}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500"
                />
              </div>

              {/* Quantidade de Corridas para Sincronizar */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">
                    Quantas corridas sincronizar?
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {syncLimit === 500 ? "Todas as corridas" : `${syncLimit} corridas`}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 text-center">
                  {[10, 30, 50, 100, 200, 500].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSyncLimit(num)}
                      className={`py-1.5 rounded-xl text-xs font-semibold border transition ${
                        syncLimit === num
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm font-bold"
                          : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {num === 500 ? "Todas" : num}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {syncLimit === 500 ? "Importa todo o histórico disponível no Strava." : `Importa as ${syncLimit} atividades de corrida mais recentes.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={handleStartOAuth}
                disabled={isSyncing}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#FC5200] hover:bg-[#e04800] text-white flex items-center justify-center space-x-2 transition shadow-lg shadow-orange-500/20"
              >
                <span>Autorizar com o Strava</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {athlete?.has_strava_token && (
                <button
                  onClick={handleSyncStrava}
                  disabled={isSyncing}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center justify-center space-x-2 transition shadow-md"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sincronizar Agora</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: File Upload */}
        {activeTab === "file" && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-900 dark:text-slate-200">
                Como baixar seu histórico completo no Strava:
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                No site do Strava, vá em <strong>Configurações &gt; Minha Conta &gt; Baixar ou Excluir sua Conta</strong> e clique em <em>Solicitar seu Arquivo</em>. Você receberá um e-mail com o link para download do ZIP. Você pode subir o arquivo <strong>export.zip</strong> diretamente aqui ou o arquivo <strong>activities.csv</strong>.
              </p>
            </div>

            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-950/70 transition group">
              <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition mb-2" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                Clique para selecionar seu activities.csv ou export.zip
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                Suporta também arquivos GPX individuais
              </span>
              <input
                type="file"
                accept=".csv,.zip,.gpx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isSyncing}
              />
            </label>
          </div>
        )}

        {/* Status Messages */}
        {uploadStatus && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-800 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
