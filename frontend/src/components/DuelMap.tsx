"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Activity } from "../types";
import { 
  Maximize2, 
  LocateFixed, 
  MapPin, 
  Compass, 
  Layers, 
  AlertTriangle,
  Flag,
  Trophy
} from "lucide-react";
import L from "leaflet";

interface DuelMapProps {
  actA?: Activity | null;
  actB?: Activity | null;
  distACovered: number;
  distBCovered: number;
  raceDistanceMeters: number;
  isDark: boolean;
  isPlaying: boolean;
  formatActivityName: (act?: Activity | null) => string;
}

// Google Polyline Decoder
function decodePolyline(encoded?: string | null): [number, number][] {
  if (!encoded) return [];
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Haversine formula for distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate cumulative distances along coordinates
function calculateCumulativeDistances(points: [number, number][]): number[] {
  const distances = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    total += d;
    distances.push(total);
  }
  return distances;
}

// Interpolate exact [lat, lng] given covered distance
function interpolatePosition(
  points: [number, number][],
  cumDistances: number[],
  targetMeters: number
): [number, number] {
  if (points.length === 0) return [0, 0];
  if (targetMeters <= 0 || points.length === 1) return points[0];

  const total = cumDistances[cumDistances.length - 1];
  if (targetMeters >= total) return points[points.length - 1];

  let low = 0;
  let high = cumDistances.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cumDistances[mid] < targetMeters) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const i = Math.max(0, low - 1);
  const nextI = Math.min(points.length - 1, i + 1);
  const segmentLen = cumDistances[nextI] - cumDistances[i];
  if (segmentLen <= 0) return points[i];

  const ratio = (targetMeters - cumDistances[i]) / segmentLen;
  const lat = points[i][0] + ratio * (points[nextI][0] - points[i][0]);
  const lng = points[i][1] + ratio * (points[nextI][1] - points[i][1]);
  return [lat, lng];
}

// Helper to extract polyline string
function getPolylineString(act?: Activity | null): string | null {
  if (!act) return null;
  if (act.summary_polyline) return act.summary_polyline;
  if (act.raw_data) {
    try {
      const parsed = typeof act.raw_data === "string" ? JSON.parse(act.raw_data) : act.raw_data;
      return parsed?.map?.summary_polyline || null;
    } catch {
      return null;
    }
  }
  return null;
}

export const DuelMap: React.FC<DuelMapProps> = ({
  actA,
  actB,
  distACovered,
  distBCovered,
  raceDistanceMeters,
  isDark,
  isPlaying,
  formatActivityName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layers
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineARef = useRef<L.Polyline | null>(null);
  const polylineBRef = useRef<L.Polyline | null>(null);
  const markerARef = useRef<L.Marker | null>(null);
  const markerBRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const finishMarkerRef = useRef<L.Marker | null>(null);

  const [followRunners, setFollowRunners] = useState(false);
  const [mapStyle, setMapStyle] = useState<"standard" | "satellite">("standard");

  // Decoded points & cumulative distances
  const polyAStr = useMemo(() => getPolylineString(actA), [actA]);
  const polyBStr = useMemo(() => getPolylineString(actB), [actB]);

  const pointsA = useMemo(() => decodePolyline(polyAStr), [polyAStr]);
  const pointsB = useMemo(() => decodePolyline(polyBStr), [polyBStr]);

  const cumDistA = useMemo(() => calculateCumulativeDistances(pointsA), [pointsA]);
  const cumDistB = useMemo(() => calculateCumulativeDistances(pointsB), [pointsB]);

  const hasGPSA = pointsA.length > 1;
  const hasGPSB = pointsB.length > 1;

  // Real-time positions
  const posA = useMemo(() => {
    if (!hasGPSA) return null;
    return interpolatePosition(pointsA, cumDistA, distACovered);
  }, [pointsA, cumDistA, distACovered, hasGPSA]);

  const posB = useMemo(() => {
    if (!hasGPSB) return null;
    return interpolatePosition(pointsB, cumDistB, distBCovered);
  }, [pointsB, cumDistB, distBCovered, hasGPSB]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const initialCenter: [number, number] = pointsA[0] || pointsB[0] || [-16.594, -49.312];
    const initialZoom = 14;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // Update Base Tile Layer based on isDark and mapStyle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let tileUrl = "";
    let attribution = "";

    if (mapStyle === "satellite") {
      // Esri World Imagery (high-resolution satellite)
      tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
    } else if (isDark) {
      // CartoDB Dark Matter
      tileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';
    } else {
      // CartoDB Voyager / Positron
      tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';
    }

    const newTile = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    tileLayerRef.current = newTile;
  }, [isDark, mapStyle]);

  // Update Route Polylines and Fit Bounds on Activity Change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean up old polylines
    if (polylineARef.current) map.removeLayer(polylineARef.current);
    if (polylineBRef.current) map.removeLayer(polylineBRef.current);
    if (startMarkerRef.current) map.removeLayer(startMarkerRef.current);
    if (finishMarkerRef.current) map.removeLayer(finishMarkerRef.current);

    const allPoints: [number, number][] = [];

    // Draw Route A
    if (hasGPSA) {
      polylineARef.current = L.polyline(pointsA, {
        color: "#10b981", // Emerald 500
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      allPoints.push(...pointsA);

      // Start Marker (Largada)
      const startHtml = `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black shadow-lg border-2 border-white text-xs">
          🏁
        </div>
      `;
      startMarkerRef.current = L.marker(pointsA[0], {
        icon: L.divIcon({
          html: startHtml,
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);

      // Finish Marker (Chegada)
      const finishPos = pointsA[pointsA.length - 1];
      const finishHtml = `
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black shadow-lg border-2 border-white text-xs">
          🏆
        </div>
      `;
      finishMarkerRef.current = L.marker(finishPos, {
        icon: L.divIcon({
          html: finishHtml,
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);
    }

    // Draw Route B
    if (hasGPSB) {
      polylineBRef.current = L.polyline(pointsB, {
        color: "#22d3ee", // Cyan 400
        weight: 4,
        opacity: 0.8,
        dashArray: hasGPSA ? "8, 8" : undefined,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      allPoints.push(...pointsB);
    }

    // Auto-fit map to encompass both courses
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
      });
    }
  }, [pointsA, pointsB, hasGPSA, hasGPSB]);

  // Update Dynamic Runner A Marker Position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !posA) return;

    const kmCovered = (distACovered / 1000).toFixed(2);
    const htmlA = `
      <div class="flex flex-col items-center pointer-events-none -translate-x-1/2 -translate-y-1/2" style="width: 140px;">
        <div class="bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-emerald-400 whitespace-nowrap mb-0.5 animate-pulse">
          ${actA ? formatActivityName(actA) : "Corredor A"} (${kmCovered} km)
        </div>
        <div class="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 border-2 border-white flex items-center justify-center font-bold text-sm shadow-xl shadow-emerald-500/50 ${isPlaying ? "scale-110" : ""}">
          🏃‍♂️
        </div>
      </div>
    `;

    if (!markerARef.current) {
      markerARef.current = L.marker(posA, {
        icon: L.divIcon({
          html: htmlA,
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      markerARef.current.setLatLng(posA);
      markerARef.current.setIcon(
        L.divIcon({
          html: htmlA,
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
      );
    }
  }, [posA, distACovered, actA, isPlaying, formatActivityName]);

  // Update Dynamic Runner B Marker Position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !posB) return;

    const kmCovered = (distBCovered / 1000).toFixed(2);
    const htmlB = `
      <div class="flex flex-col items-center pointer-events-none -translate-x-1/2 -translate-y-1/2" style="width: 140px;">
        <div class="bg-cyan-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-cyan-300 whitespace-nowrap mb-0.5 animate-pulse">
          ${actB ? formatActivityName(actB) : "Corredor B"} (${kmCovered} km)
        </div>
        <div class="w-8 h-8 rounded-full bg-cyan-400 text-slate-950 border-2 border-white flex items-center justify-center font-bold text-sm shadow-xl shadow-cyan-400/50 ${isPlaying ? "scale-110" : ""}">
          🏃‍♀️
        </div>
      </div>
    `;

    if (!markerBRef.current) {
      markerBRef.current = L.marker(posB, {
        icon: L.divIcon({
          html: htmlB,
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: 990,
      }).addTo(map);
    } else {
      markerBRef.current.setLatLng(posB);
      markerBRef.current.setIcon(
        L.divIcon({
          html: htmlB,
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
      );
    }
  }, [posB, distBCovered, actB, isPlaying, formatActivityName]);

  // Follow runners with camera when enabled
  useEffect(() => {
    if (!followRunners || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (posA && posB) {
      const midLat = (posA[0] + posB[0]) / 2;
      const midLng = (posA[1] + posB[1]) / 2;
      map.panTo([midLat, midLng], { animate: true, duration: 0.3 });
    } else if (posA) {
      map.panTo(posA, { animate: true, duration: 0.3 });
    }
  }, [posA, posB, followRunners]);

  // Reset view to fit all points
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const all = [...pointsA, ...pointsB];
    if (all.length > 0) {
      map.fitBounds(L.latLngBounds(all), { padding: [50, 50], maxZoom: 16 });
      setFollowRunners(false);
    }
  };

  if (!hasGPSA && !hasGPSB) {
    return (
      <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Nenhuma rota GPS disponível para estas atividades
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          As atividades selecionadas não possuem coordenadas de mapa salvas (ex.: treinos manuais ou esteira). Use o <strong>Modo Pista Virtual</strong> para acompanhar a disputa lado a lado!
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
      {/* MAP CANVAS */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* TOP FLOATING CONTROLS & HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Route Indicators */}
        <div className="flex items-center space-x-2 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs shadow-lg pointer-events-auto">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-bold text-emerald-400 truncate max-w-[130px] sm:max-w-[180px]">
              {actA ? formatActivityName(actA) : "Pista 1"}
            </span>
          </div>
          <span className="text-slate-500">vs</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="font-bold text-cyan-400 truncate max-w-[130px] sm:max-w-[180px]">
              {actB ? formatActivityName(actB) : "Pista 2"}
            </span>
          </div>
        </div>

        {/* Map Actions Button Group */}
        <div className="flex items-center space-x-1.5 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto text-xs font-semibold">
          <button
            onClick={() => setFollowRunners(!followRunners)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition ${
              followRunners
                ? "bg-emerald-500 text-slate-950 font-bold"
                : "text-slate-300 hover:bg-slate-800"
            }`}
            title="Acompanhar corredores automaticamente com a câmera"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-seguir</span>
          </button>

          <button
            onClick={handleFitBounds}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Enquadrar percurso inteiro na tela"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enquadrar</span>
          </button>

          <button
            onClick={() => setMapStyle(mapStyle === "standard" ? "satellite" : "standard")}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Alternar entre visualização de Ruas e Satélite"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{mapStyle === "standard" ? "Satélite" : "Ruas"}</span>
          </button>
        </div>
      </div>

      {/* BOTTOM LEGEND INFO BANNER */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <div className="bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 shadow-lg flex items-center space-x-3 pointer-events-auto">
          <span className="flex items-center space-x-1 font-semibold">
            <span>🏁 Largada</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center space-x-1 font-semibold text-amber-400">
            <span>🏆 Chegada ({(raceDistanceMeters / 1000).toFixed(2)} km)</span>
          </span>
          {pointsA.length > 0 && pointsB.length > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">
                {Math.abs(pointsA[0][0] - pointsB[0][0]) < 0.005 && Math.abs(pointsA[0][1] - pointsB[0][1]) < 0.005
                  ? "✓ Mesmo circuito real"
                  : "Rotas diferentes"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
