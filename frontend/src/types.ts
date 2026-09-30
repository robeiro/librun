export interface Activity {
  id: number;
  strava_id: string;
  name: string;
  type: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local?: string;
  average_speed: number;
  max_speed: number;
  average_cadence?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  suffer_score?: number | null;
  source: string;
  summary_polyline?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface HrZoneInfo {
  name: string;
  min_hr: number;
  max_hr: number;
  description: string;
  target_pct: number;
  color: string;
  zone_id: string;
  total_km: number;
  activities_count: number;
  percentage: number;
}

export interface WeeklyWeek {
  week_label: string;
  start_date: string;
  end_date: string;
  total_km: number;
  run_count: number;
  total_time_seconds: number;
  elevation_gain: number;
  longest_run_km: number;
  avg_pace_seconds: number;
  avg_pace_formatted: string;
  growth_pct: number;
}

export interface CoachingInsight {
  id: string;
  category: "intensidade" | "carga" | "biomecanica" | "volume" | "consistencia";
  severity: "critical" | "warning" | "good" | "info";
  title: string;
  subtitle: string;
  problem: string | null;
  action: string;
  expected_gain: string;
}

export interface RacePredictionItem {
  name: string;
  distance_km: number;
  predicted_time_seconds: number;
  predicted_time_formatted: string;
  predicted_pace_formatted: string;
}

export interface RacePredictions {
  reference_activity?: {
    name: string;
    distance_km: number;
    pace: string;
    date: string;
  };
  predictions?: {
    [key: string]: RacePredictionItem;
  };
}

export interface AnalyticsSummary {
  total_runs: number;
  total_distance_km: number;
  total_time_hours: number;
  total_elevation_gain_m: number;
  overall_avg_pace: string;
  overall_avg_pace_seconds: number;
  avg_heartrate?: number | null;
  avg_cadence?: number | null;
  librun_score: number;
  score_components: {
    carga_acwr: number;
    polarizacao: number;
    cadencia: number;
    consistencia: number;
  };
}

export interface AcwrData {
  acwr: number;
  acute_load_km: number;
  chronic_load_km: number;
  status: string;
  risk_level: "optimal" | "warning" | "danger" | "low_decay" | "none";
  message: string;
}

export interface ProgressPoint {
  id: string | number;
  name: string;
  date: string;
  date_formatted: string;
  full_date: string;
  distance_km: number;
  moving_time_seconds: number;
  pace_seconds: number;
  pace_formatted: string;
  speed_kmh: number;
  average_heartrate?: number | null;
  average_cadence?: number | null;
  aerobic_efficiency?: number | null;
  category: "curta" | "media" | "longao";
  moving_avg_pace_seconds: number;
  moving_avg_pace_formatted: string;
  moving_avg_efficiency?: number | null;
}

export interface ProgressPeriodPoint {
  label: string;
  period: string;
  start_date: string;
  total_km: number;
  run_count: number;
  avg_pace_seconds: number;
  avg_pace_formatted: string;
  best_pace_seconds: number;
  best_pace_formatted: string;
  avg_heartrate?: number | null;
  avg_cadence?: number | null;
  avg_efficiency?: number | null;
  longest_run_km: number;
}

export interface ProgressSummary {
  total_activities: number;
  baseline_pace_formatted: string;
  recent_pace_formatted: string;
  pace_diff_seconds: number;
  pace_improvement_pct: number;
  baseline_efficiency?: number | null;
  recent_efficiency?: number | null;
  efficiency_improvement_pct?: number | null;
  baseline_cadence?: number | null;
  recent_cadence?: number | null;
  cadence_diff?: number | null;
  fastest_run?: {
    name: string;
    date: string;
    pace: string;
    distance_km: number;
  } | null;
  longest_run?: {
    name: string;
    date: string;
    distance_km: number;
    pace: string;
  } | null;
  verdict_headline: string;
  verdict_text: string;
}

export interface ProgressData {
  timeline: ProgressPoint[];
  weekly: ProgressPeriodPoint[];
  monthly: ProgressPeriodPoint[];
  summary: ProgressSummary;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  acwr: AcwrData;
  hr_distribution: Record<string, HrZoneInfo>;
  cadence_stats: {
    average_cadence: number | null;
    sample_size: number;
    status: string;
  };
  weekly_breakdown: WeeklyWeek[];
  race_predictions: RacePredictions;
  coaching_insights: CoachingInsight[];
  progress?: ProgressData;
}

export interface AthleteSettings {
  id?: number;
  athlete_id?: string | number;
  athlete_name: string;
  max_hr: number;
  rest_hr: number;
  target_distance: string;
  target_time_minutes: number;
  strava_client_id?: string;
  strava_client_secret?: string;
  strava_client_secret_configured?: boolean;
  has_strava_token?: boolean;
  gemini_api_key?: string;
  gemini_api_key_configured?: boolean;
  gemini_api_key_masked?: string;
  gemini_model?: string;
}

export interface GeminiModelOption {
  id: string;
  displayName: string;
  description?: string;
}

export interface AiAnalysisResponse {
  success: boolean;
  analysis?: string;
  created_at?: string;
  cached?: boolean;
  model_used?: string;
  error?: string;
}
