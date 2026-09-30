import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import statistics

def calculate_pace_seconds(distance_meters: float, moving_time_seconds: int) -> float:
    """Returns pace in seconds per kilometer."""
    if distance_meters <= 0 or moving_time_seconds <= 0:
        return 0.0
    km = distance_meters / 1000.0
    return moving_time_seconds / km

def format_pace(seconds_per_km: float) -> str:
    """Formats pace seconds/km as mm:ss min/km."""
    if seconds_per_km <= 0 or math.isinf(seconds_per_km) or math.isnan(seconds_per_km):
        return "--:--"
    minutes = int(seconds_per_km // 60)
    seconds = int(round(seconds_per_km % 60))
    if seconds == 60:
        minutes += 1
        seconds = 0
    return f"{minutes}:{seconds:02d} min/km"

def get_hr_zones(max_hr: int = 190, rest_hr: int = 55) -> Dict[str, Dict[str, Any]]:
    """Calculates 5 heart rate zones using percentage of Max HR."""
    return {
        "Z1": {
            "name": "Recuperação Ativa",
            "min_hr": int(round(max_hr * 0.50)),
            "max_hr": int(round(max_hr * 0.60)),
            "description": "Ritmo muito leve, regenerativo, melhora circulação e recuperação.",
            "target_pct": 15,
            "color": "#10B981" # Emerald
        },
        "Z2": {
            "name": "Base Aeróbica",
            "min_hr": int(round(max_hr * 0.60)),
            "max_hr": int(round(max_hr * 0.70)),
            "description": "Ritmo conversacional, queima de gordura, densidade mitocondrial e base de resistência.",
            "target_pct": 65,
            "color": "#3B82F6" # Blue
        },
        "Z3": {
            "name": "Zona Moderada (Tempo)",
            "min_hr": int(round(max_hr * 0.70)),
            "max_hr": int(round(max_hr * 0.80)),
            "description": "Zona 'cinzenta': esforço moderado, cansaço acumulado sem a máxima adaptação de limiar.",
            "target_pct": 5,
            "color": "#F59E0B" # Amber
        },
        "Z4": {
            "name": "Limiar Anaeróbico",
            "min_hr": int(round(max_hr * 0.80)),
            "max_hr": int(round(max_hr * 0.90)),
            "description": "Ritmo duro e sustentável por ~40-60min, tolerância ao lactato e velocidade de prova.",
            "target_pct": 10,
            "color": "#F97316" # Orange
        },
        "Z5": {
            "name": "VO2 Máx & Potência",
            "min_hr": int(round(max_hr * 0.90)),
            "max_hr": max_hr,
            "description": "Tiros curtos, velocidade máxima, esforço quase exaustivo.",
            "target_pct": 5,
            "color": "#EF4444" # Red
        }
    }

def classify_activity_hr_zone(avg_hr: Optional[float], zones: Dict[str, Dict[str, Any]]) -> Optional[str]:
    if not avg_hr or avg_hr <= 0:
        return None
    for zone_id, z in zones.items():
        if z["min_hr"] <= avg_hr <= z["max_hr"] + 2:
            return zone_id
    if avg_hr < zones["Z1"]["min_hr"]:
        return "Z1"
    return "Z5"

def parse_iso_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    clean = date_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean)
    except Exception:
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
        except Exception:
            return None

def calculate_acwr(activities: List[Dict[str, Any]], reference_date: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Calculates the Acute:Chronic Workload Ratio (ACWR).
    Acute Workload = load from the last 7 days.
    Chronic Workload = average 7-day load over the last 28 days (total last 28 days / 4).
    """
    if not activities:
        return {
            "acwr": 1.0,
            "acute_load_km": 0.0,
            "chronic_load_km": 0.0,
            "status": "Sem dados",
            "risk_level": "none",
            "message": "Nenhuma atividade recente registrada."
        }

    dated_acts = []
    for a in activities:
        dt = parse_iso_date(a.get("start_date") or a.get("start_date_local"))
        if dt:
            km = (a.get("distance") or 0.0) / 1000.0
            # TRIMP proxy if HR exists, otherwise km
            avg_hr = a.get("average_heartrate")
            intensity_weight = 1.0
            if avg_hr and avg_hr > 120:
                intensity_weight = (avg_hr / 160.0) ** 1.3
            load = km * intensity_weight
            dated_acts.append((dt, km, load))

    if not dated_acts:
        return {
            "acwr": 1.0,
            "acute_load_km": 0.0,
            "chronic_load_km": 0.0,
            "status": "Sem dados",
            "risk_level": "none",
            "message": "Atividades sem datas válidas."
        }

    dated_acts.sort(key=lambda x: x[0])
    ref_dt = reference_date or dated_acts[-1][0]
    
    acute_start = ref_dt - timedelta(days=7)
    chronic_start = ref_dt - timedelta(days=28)

    acute_km = sum(km for dt, km, _ in dated_acts if acute_start < dt <= ref_dt)
    chronic_km_28d = sum(km for dt, km, _ in dated_acts if chronic_start < dt <= ref_dt)
    chronic_load_avg = chronic_km_28d / 4.0 if chronic_km_28d > 0 else 0.0

    if chronic_load_avg <= 0.5:
        # Very low chronic load
        acwr = 1.0 if acute_km == 0 else 1.5
    else:
        acwr = round(acute_km / chronic_load_avg, 2)

    # Interpret ACWR
    if acwr < 0.8:
        status = "Subtreinamento"
        risk_level = "low_decay"
        message = "Carga recente menor que a adaptação crônica. Risco de perda de condicionamento cardiovascular."
    elif 0.8 <= acwr <= 1.3:
        status = "Sweet Spot (Ideal)"
        risk_level = "optimal"
        message = "Equilíbrio perfeito entre estímulo e recuperação. Risco mínimo de lesão e máxima progressão."
    elif 1.3 < acwr <= 1.5:
        status = "Atenção (Carga Elevada)"
        risk_level = "warning"
        message = "Aumento considerável na carga dos últimos 7 dias. Monitore cansaço muscular e garanta bom sono."
    else:
        status = "Zona de Perigo (Sobrecarga Alta)"
        risk_level = "danger"
        message = "Aumento súbito de volume/intensidade (>1.5x da média). Alto risco de lesões por overuse (canelite, tendão, fascite)."

    return {
        "acwr": acwr,
        "acute_load_km": round(acute_km, 1),
        "chronic_load_km": round(chronic_load_avg, 1),
        "status": status,
        "risk_level": risk_level,
        "message": message
    }

def calculate_weekly_breakdown(activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Groups activities by calendar week (Monday to Sunday) for the last 12 weeks."""
    if not activities:
        return []

    dated_acts = []
    for a in activities:
        dt = parse_iso_date(a.get("start_date") or a.get("start_date_local"))
        if dt:
            dated_acts.append((dt, a))

    if not dated_acts:
        return []

    dated_acts.sort(key=lambda x: x[0])
    last_date = dated_acts[-1][0]
    
    # Calculate start of current week (Monday)
    current_week_start = last_date.date() - timedelta(days=last_date.date().weekday())

    weeks_dict = {}
    for i in range(11, -1, -1):
        w_start = current_week_start - timedelta(weeks=i)
        w_end = w_start + timedelta(days=6)
        label = f"{w_start.strftime('%d/%m')} - {w_end.strftime('%d/%m')}"
        weeks_dict[label] = {
            "week_label": label,
            "start_date": w_start.isoformat(),
            "end_date": w_end.isoformat(),
            "total_km": 0.0,
            "run_count": 0,
            "total_time_seconds": 0,
            "elevation_gain": 0.0,
            "longest_run_km": 0.0,
            "avg_pace_seconds": 0.0,
            "paces": []
        }

    for dt, a in dated_acts:
        d = dt.date()
        w_start = d - timedelta(days=d.weekday())
        w_end = w_start + timedelta(days=6)
        label = f"{w_start.strftime('%d/%m')} - {w_end.strftime('%d/%m')}"
        
        if label in weeks_dict:
            km = (a.get("distance") or 0.0) / 1000.0
            time_sec = int(a.get("moving_time") or 0)
            elev = float(a.get("total_elevation_gain") or 0.0)
            
            weeks_dict[label]["total_km"] += km
            weeks_dict[label]["run_count"] += 1
            weeks_dict[label]["total_time_seconds"] += time_sec
            weeks_dict[label]["elevation_gain"] += elev
            if km > weeks_dict[label]["longest_run_km"]:
                weeks_dict[label]["longest_run_km"] = km
            if km > 0 and time_sec > 0:
                weeks_dict[label]["paces"].append(time_sec / km)

    result = []
    prev_km = 0.0
    for label, w in weeks_dict.items():
        w["total_km"] = round(w["total_km"], 1)
        w["longest_run_km"] = round(w["longest_run_km"], 1)
        w["elevation_gain"] = round(w["elevation_gain"], 0)
        w["avg_pace_seconds"] = round(statistics.mean(w["paces"]), 1) if w["paces"] else 0.0
        w["avg_pace_formatted"] = format_pace(w["avg_pace_seconds"])
        
        # Growth percentage vs previous week
        if prev_km > 0:
            growth = round(((w["total_km"] - prev_km) / prev_km) * 100.0, 1)
        else:
            growth = 0.0 if w["total_km"] == 0 else 100.0
        w["growth_pct"] = growth
        prev_km = w["total_km"]
        result.append(w)

    return result

def calculate_race_predictions(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Predicts race times (5k, 10k, 21.1k, 42.195k) using Pete Riegel formula:
    T2 = T1 * (D2 / D1)^1.06
    Calibrated with athlete's actual best performances in recent activities.
    """
    if not activities:
        return {}

    best_efforts = []
    for a in activities:
        dist_m = float(a.get("distance") or 0.0)
        time_s = int(a.get("moving_time") or 0)
        if dist_m >= 2500 and time_s > 0:
            pace = time_s / (dist_m / 1000.0)
            best_efforts.append({
                "distance": dist_m,
                "time": time_s,
                "pace": pace,
                "name": a.get("name"),
                "date": a.get("start_date")
            })

    if not best_efforts:
        return {}

    # Pick the best reference effort (highest aerobic speed for distance >= 4000m)
    best_efforts.sort(key=lambda x: x["pace"])
    # Prefer runs >= 4km for endurance predictions
    endurance_efforts = [e for e in best_efforts if e["distance"] >= 4000]
    ref = endurance_efforts[0] if endurance_efforts else best_efforts[0]

    d1 = ref["distance"]
    t1 = ref["time"]

    targets = [
        {"name": "5 km", "distance_meters": 5000, "key": "5k"},
        {"name": "10 km", "distance_meters": 10000, "key": "10k"},
        {"name": "Meia Maratona (21.1 km)", "distance_meters": 21097.5, "key": "21k"},
        {"name": "Maratona (42.2 km)", "distance_meters": 42195, "key": "42k"},
    ]

    predictions = {}
    for t in targets:
        d2 = t["distance_meters"]
        # Riegel exponent: 1.06 standard, slightly adjusted if scaling from very short to marathon
        exponent = 1.06 if d2 <= 21100 else 1.08
        predicted_time_seconds = t1 * ((d2 / d1) ** exponent)
        predicted_pace = predicted_time_seconds / (d2 / 1000.0)
        
        hours = int(predicted_time_seconds // 3600)
        mins = int((predicted_time_seconds % 3600) // 60)
        secs = int(round(predicted_time_seconds % 60))
        
        if hours > 0:
            time_formatted = f"{hours}h {mins:02d}m {secs:02d}s"
        else:
            time_formatted = f"{mins}m {secs:02d}s"

        predictions[t["key"]] = {
            "name": t["name"],
            "distance_km": round(d2 / 1000.0, 1),
            "predicted_time_seconds": round(predicted_time_seconds),
            "predicted_time_formatted": time_formatted,
            "predicted_pace_formatted": format_pace(predicted_pace)
        }

    return {
        "reference_activity": {
            "name": ref["name"],
            "distance_km": round(ref["distance"] / 1000.0, 2),
            "pace": format_pace(ref["pace"]),
            "date": ref["date"]
        },
        "predictions": predictions
    }

def calculate_progress_analytics(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes chronological progress metrics and timeline for:
    - Pace evolution over time (individual runs and 5-run rolling trendline)
    - Aerobic Efficiency Factor (Speed m/min per Heart Rate bpm)
    - Average Heart Rate and Cadence trends
    - Weekly and monthly aggregated progression
    - Baseline vs Recent improvement deltas and diagnosis
    """
    if not activities:
        return {
            "timeline": [],
            "weekly": [],
            "monthly": [],
            "summary": {
                "total_activities": 0,
                "baseline_pace_formatted": "--:--",
                "recent_pace_formatted": "--:--",
                "pace_diff_seconds": 0.0,
                "pace_improvement_pct": 0.0,
                "baseline_efficiency": None,
                "recent_efficiency": None,
                "efficiency_improvement_pct": None,
                "baseline_cadence": None,
                "recent_cadence": None,
                "cadence_diff": None,
                "fastest_run": None,
                "longest_run": None,
                "verdict_headline": "Sem dados suficientes",
                "verdict_text": "Registre seus treinos para visualizar seu gráfico de evolução temporal."
            }
        }

    dated_runs = []
    for a in activities:
        dist = float(a.get("distance") or 0.0)
        time_s = int(a.get("moving_time") or 0)
        if dist < 500 or time_s < 60:
            continue
        dt = parse_iso_date(a.get("start_date") or a.get("start_date_local"))
        if dt:
            dated_runs.append((dt, a))

    if not dated_runs:
        return {
            "timeline": [],
            "weekly": [],
            "monthly": [],
            "summary": {
                "total_activities": 0,
                "baseline_pace_formatted": "--:--",
                "recent_pace_formatted": "--:--",
                "pace_diff_seconds": 0.0,
                "pace_improvement_pct": 0.0,
                "baseline_efficiency": None,
                "recent_efficiency": None,
                "efficiency_improvement_pct": None,
                "baseline_cadence": None,
                "recent_cadence": None,
                "cadence_diff": None,
                "fastest_run": None,
                "longest_run": None,
                "verdict_headline": "Sem dados válidos",
                "verdict_text": "Nenhuma corrida com data e distância válidas foi encontrada."
            }
        }

    dated_runs.sort(key=lambda x: x[0])

    timeline = []
    paces_list = []
    eff_list = []

    for idx, (dt, a) in enumerate(dated_runs):
        dist_m = float(a.get("distance") or 0.0)
        time_s = int(a.get("moving_time") or 0)
        dist_km = round(dist_m / 1000.0, 2)
        pace_s = calculate_pace_seconds(dist_m, time_s)
        speed_kmh = round((dist_km / (time_s / 3600.0)), 1) if time_s > 0 else 0.0
        
        hr = a.get("average_heartrate")
        if hr is not None:
            hr = round(float(hr), 0)
            if hr <= 40 or hr > 230:
                hr = None
                
        cadence = a.get("average_cadence")
        if cadence is not None:
            cadence = round(float(cadence), 0)
            if cadence <= 80:
                cadence = None

        # Aerobic efficiency: speed in m/min divided by average heart rate
        aerobic_eff = None
        if hr and hr > 50 and time_s > 0:
            speed_m_min = dist_m / (time_s / 60.0)
            aerobic_eff = round(speed_m_min / hr, 2)

        # Category by distance
        if dist_km < 6.0:
            cat = "curta"
        elif dist_km < 12.0:
            cat = "media"
        else:
            cat = "longao"

        paces_list.append(pace_s)
        if aerobic_eff is not None:
            eff_list.append(aerobic_eff)

        # 5-run rolling moving average of pace
        window_paces = paces_list[max(0, idx - 4):idx + 1]
        mov_avg_pace = round(statistics.mean(window_paces), 1) if window_paces else pace_s

        # 5-run rolling moving average of efficiency
        window_eff = [t_item["aerobic_efficiency"] for t_item in timeline[max(0, idx - 4):idx] if t_item.get("aerobic_efficiency") is not None]
        if aerobic_eff is not None:
            window_eff.append(aerobic_eff)
        mov_avg_eff = round(statistics.mean(window_eff), 2) if window_eff else None

        date_formatted = dt.strftime("%d/%m")
        full_date = dt.strftime("%d/%m/%Y")

        timeline.append({
            "id": a.get("strava_id") or a.get("id") or str(idx),
            "name": a.get("name") or "Corrida",
            "date": dt.isoformat(),
            "date_formatted": date_formatted,
            "full_date": full_date,
            "distance_km": dist_km,
            "moving_time_seconds": time_s,
            "pace_seconds": round(pace_s, 1),
            "pace_formatted": format_pace(pace_s),
            "speed_kmh": speed_kmh,
            "average_heartrate": hr,
            "average_cadence": cadence,
            "aerobic_efficiency": aerobic_eff,
            "category": cat,
            "moving_avg_pace_seconds": mov_avg_pace,
            "moving_avg_pace_formatted": format_pace(mov_avg_pace),
            "moving_avg_efficiency": mov_avg_eff
        })

    # Group by calendar week (Monday to Sunday)
    weeks_map = {}
    for dt, a in dated_runs:
        d = dt.date()
        w_start = d - timedelta(days=d.weekday())
        w_end = w_start + timedelta(days=6)
        w_key = w_start.isoformat()
        label = f"{w_start.strftime('%d/%m')} - {w_end.strftime('%d/%m')}"
        if w_key not in weeks_map:
            weeks_map[w_key] = {
                "label": label,
                "period": "Semana",
                "start_date": w_key,
                "runs": []
            }
        weeks_map[w_key]["runs"].append(a)

    weekly = []
    for w_key in sorted(weeks_map.keys()):
        w_data = weeks_map[w_key]
        r_list = w_data["runs"]
        tot_km = sum((r.get("distance") or 0.0) / 1000.0 for r in r_list)
        tot_time = sum(int(r.get("moving_time") or 0) for r in r_list)
        paces = [calculate_pace_seconds(r.get("distance") or 0.0, r.get("moving_time") or 0) for r in r_list if (r.get("distance") or 0) > 0 and (r.get("moving_time") or 0) > 0]
        hrs = [r["average_heartrate"] for r in r_list if r.get("average_heartrate") and r["average_heartrate"] > 40]
        cads = [r["average_cadence"] for r in r_list if r.get("average_cadence") and r["average_cadence"] > 100]
        
        avg_pace_s = (tot_time / tot_km) if tot_km > 0 else 0.0
        best_pace_s = min(paces) if paces else 0.0
        
        effs = []
        for r in r_list:
            h = r.get("average_heartrate")
            t = int(r.get("moving_time") or 0)
            d = float(r.get("distance") or 0.0)
            if h and h > 50 and t > 0:
                effs.append((d / (t / 60.0)) / h)

        weekly.append({
            "label": w_data["label"],
            "period": "Semana",
            "start_date": w_key,
            "total_km": round(tot_km, 1),
            "run_count": len(r_list),
            "avg_pace_seconds": round(avg_pace_s, 1),
            "avg_pace_formatted": format_pace(avg_pace_s),
            "best_pace_seconds": round(best_pace_s, 1),
            "best_pace_formatted": format_pace(best_pace_s),
            "avg_heartrate": round(statistics.mean(hrs), 0) if hrs else None,
            "avg_cadence": round(statistics.mean(cads), 0) if cads else None,
            "avg_efficiency": round(statistics.mean(effs), 2) if effs else None,
            "longest_run_km": round(max((r.get("distance") or 0.0) / 1000.0 for r in r_list), 1) if r_list else 0.0
        })

    # Group by calendar month
    months_map = {}
    pt_months = {
        "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
        "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
        "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
    }
    for dt, a in dated_runs:
        m_key = dt.strftime("%Y-%m")
        m_label = f"{pt_months.get(dt.strftime('%m'), dt.strftime('%m'))}/{dt.strftime('%y')}"
        if m_key not in months_map:
            months_map[m_key] = {
                "label": m_label,
                "period": "Mês",
                "start_date": f"{m_key}-01",
                "runs": []
            }
        months_map[m_key]["runs"].append(a)

    monthly = []
    for m_key in sorted(months_map.keys()):
        m_data = months_map[m_key]
        r_list = m_data["runs"]
        tot_km = sum((r.get("distance") or 0.0) / 1000.0 for r in r_list)
        tot_time = sum(int(r.get("moving_time") or 0) for r in r_list)
        paces = [calculate_pace_seconds(r.get("distance") or 0.0, r.get("moving_time") or 0) for r in r_list if (r.get("distance") or 0) > 0 and (r.get("moving_time") or 0) > 0]
        hrs = [r["average_heartrate"] for r in r_list if r.get("average_heartrate") and r["average_heartrate"] > 40]
        cads = [r["average_cadence"] for r in r_list if r.get("average_cadence") and r["average_cadence"] > 100]
        
        avg_pace_s = (tot_time / tot_km) if tot_km > 0 else 0.0
        best_pace_s = min(paces) if paces else 0.0
        
        effs = []
        for r in r_list:
            h = r.get("average_heartrate")
            t = int(r.get("moving_time") or 0)
            d = float(r.get("distance") or 0.0)
            if h and h > 50 and t > 0:
                effs.append((d / (t / 60.0)) / h)

        monthly.append({
            "label": m_data["label"],
            "period": "Mês",
            "start_date": m_data["start_date"],
            "total_km": round(tot_km, 1),
            "run_count": len(r_list),
            "avg_pace_seconds": round(avg_pace_s, 1),
            "avg_pace_formatted": format_pace(avg_pace_s),
            "best_pace_seconds": round(best_pace_s, 1),
            "best_pace_formatted": format_pace(best_pace_s),
            "avg_heartrate": round(statistics.mean(hrs), 0) if hrs else None,
            "avg_cadence": round(statistics.mean(cads), 0) if cads else None,
            "avg_efficiency": round(statistics.mean(effs), 2) if effs else None,
            "longest_run_km": round(max((r.get("distance") or 0.0) / 1000.0 for r in r_list), 1) if r_list else 0.0
        })

    # Summary and Deltas
    total_acts = len(timeline)
    sample_size = max(1, min(6, total_acts // 3)) if total_acts >= 3 else 1

    baseline_pts = timeline[:sample_size]
    recent_pts = timeline[-sample_size:]

    base_paces = [p["pace_seconds"] for p in baseline_pts if p["pace_seconds"] > 0]
    rec_paces = [p["pace_seconds"] for p in recent_pts if p["pace_seconds"] > 0]

    base_pace_avg = statistics.mean(base_paces) if base_paces else 0.0
    rec_pace_avg = statistics.mean(rec_paces) if rec_paces else 0.0

    pace_diff = round(rec_pace_avg - base_pace_avg, 1) # negative means faster
    pace_pct = round(((base_pace_avg - rec_pace_avg) / base_pace_avg) * 100.0, 1) if base_pace_avg > 0 else 0.0

    base_effs = [p["aerobic_efficiency"] for p in baseline_pts if p["aerobic_efficiency"] is not None]
    rec_effs = [p["aerobic_efficiency"] for p in recent_pts if p["aerobic_efficiency"] is not None]

    base_eff_avg = round(statistics.mean(base_effs), 2) if base_effs else None
    rec_eff_avg = round(statistics.mean(rec_effs), 2) if rec_effs else None
    eff_pct = round(((rec_eff_avg - base_eff_avg) / base_eff_avg) * 100.0, 1) if base_eff_avg and rec_eff_avg and base_eff_avg > 0 else None

    base_cads = [p["average_cadence"] for p in baseline_pts if p["average_cadence"] is not None]
    rec_cads = [p["average_cadence"] for p in recent_pts if p["average_cadence"] is not None]
    base_cad_avg = round(statistics.mean(base_cads), 0) if base_cads else None
    rec_cad_avg = round(statistics.mean(rec_cads), 0) if rec_cads else None
    cad_diff = round(rec_cad_avg - base_cad_avg, 0) if base_cad_avg and rec_cad_avg else None

    # Fastest run (minimum 2.5km)
    valid_fast = [p for p in timeline if p["distance_km"] >= 2.5 and p["pace_seconds"] > 0]
    fastest = min(valid_fast, key=lambda x: x["pace_seconds"]) if valid_fast else (timeline[0] if timeline else None)
    fastest_info = {
        "name": fastest["name"],
        "date": fastest["date_formatted"],
        "pace": fastest["pace_formatted"],
        "distance_km": fastest["distance_km"]
    } if fastest else None

    # Longest run
    longest = max(timeline, key=lambda x: x["distance_km"]) if timeline else None
    longest_info = {
        "name": longest["name"],
        "date": longest["date_formatted"],
        "distance_km": longest["distance_km"],
        "pace": longest["pace_formatted"]
    } if longest else None

    # Formulate diagnosis verdict
    if total_acts < 3:
        verdict_hl = "Início do Monitoramento"
        verdict_msg = "Você começou a registrar seus treinos. Com pelo menos 5 corridas, calcularemos a curva precisa de evolução e eficiência aeróbica."
    elif pace_diff <= -8.0 or (eff_pct is not None and eff_pct >= 4.0):
        verdict_hl = "Evolução Positiva Expressiva 🚀"
        diff_text = f"{abs(int(pace_diff))}s/km mais veloz" if pace_diff < 0 else ""
        eff_text = f" com ganho de +{eff_pct}% na eficiência cardíaca" if eff_pct and eff_pct > 0 else ""
        verdict_msg = f"Seu rendimento evoluiu claramente ao longo do período analisado! Você está correndo com ritmo cerca de {diff_text}{eff_text} em relação ao seu início."
    elif pace_diff >= 8.0:
        verdict_hl = "Fase de Volume & Construção Aeróbica 🧱"
        verdict_msg = "Seu ritmo médio recente foi mais controlado e cadenciado, típico de ciclos focados em aumento de volume semanal ou recuperação ativa."
    else:
        verdict_hl = "Rendimento Consistente & Estável ⚖️"
        verdict_msg = "Você mantém um ritmo e esforço homogêneos ao longo dos treinos, demonstrando boa regularidade e controle da intensidade aeróbica."

    summary = {
        "total_activities": total_acts,
        "baseline_pace_formatted": format_pace(base_pace_avg),
        "recent_pace_formatted": format_pace(rec_pace_avg),
        "pace_diff_seconds": pace_diff,
        "pace_improvement_pct": pace_pct,
        "baseline_efficiency": base_eff_avg,
        "recent_efficiency": rec_eff_avg,
        "efficiency_improvement_pct": eff_pct,
        "baseline_cadence": base_cad_avg,
        "recent_cadence": rec_cad_avg,
        "cadence_diff": cad_diff,
        "fastest_run": fastest_info,
        "longest_run": longest_info,
        "verdict_headline": verdict_hl,
        "verdict_text": verdict_msg
    }

    return {
        "timeline": timeline,
        "weekly": weekly,
        "monthly": monthly,
        "summary": summary
    }

def generate_coaching_insights(
    activities: List[Dict[str, Any]],
    settings: Dict[str, Any],
    acwr_data: Dict[str, Any],
    weekly_data: List[Dict[str, Any]],
    hr_distribution: Dict[str, Any],
    cadence_stats: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Synthesizes all sports science metrics and produces actionable,
    personalized improvement recommendations ('Onde você precisa melhorar').
    """
    insights = []

    # 1. ANALYZE HR & POLARIZED TRAINING (80/20 Rule & The Grey Zone)
    z3_pct = hr_distribution.get("Z3", {}).get("percentage", 0)
    z1_z2_pct = hr_distribution.get("Z1", {}).get("percentage", 0) + hr_distribution.get("Z2", {}).get("percentage", 0)
    z4_z5_pct = hr_distribution.get("Z4", {}).get("percentage", 0) + hr_distribution.get("Z5", {}).get("percentage", 0)

    if z3_pct > 25:
        insights.append({
            "id": "grey_zone_trap",
            "category": "intensidade",
            "severity": "critical",
            "title": "Armadilha da 'Zona Cinzenta' (Zona 3 Excessiva)",
            "subtitle": f"{z3_pct}% do seu volume está na Zona 3 (Moderada)",
            "problem": "Você está correndo rápido demais nos dias fáceis. A Zona 3 cansa os músculos e o sistema nervoso sem gerar a máxima queima de gordura/densidade mitocondrial da Z2, nem o ganho de limiar da Z4.",
            "action": "Diminua o ritmo em 30 a 50 seg/km nos treinos normais de rodagem. Você deve ser capaz de manter uma conversa fluida sem perder o fôlego (Zona 2 conversacional).",
            "expected_gain": "Recuperação mais rápida entre treinos, maior resistência aeróbica e pernas descansadas para os treinos de tiro."
        })
    elif z1_z2_pct >= 70:
        insights.append({
            "id": "good_aerobic_base",
            "category": "intensidade",
            "severity": "good",
            "title": "Excelente Disciplina Aeróbica (80/20)",
            "subtitle": f"{z1_z2_pct}% do seu volume em ritmo regenerativo e base (Z1/Z2)",
            "problem": None,
            "action": "Continue protegendo seus treinos fáceis. Isso permite que quando você fizer treinos intervalados (Z4/Z5), seu corpo consiga atingir a velocidade máxima necessária.",
            "expected_gain": "Evolução sólida do VO2máx sem lesões articulares."
        })
    elif z4_z5_pct > 35:
        insights.append({
            "id": "high_intensity_overload",
            "category": "intensidade",
            "severity": "warning",
            "title": "Excesso de Treinos em Alta Intensidade",
            "subtitle": f"{z4_z5_pct}% do volume em Z4/Z5 (Limiar e VO2 Máx)",
            "problem": "Mais de 30% do treino em intensidade anaeróbica causa fadiga do sistema nervoso central e eleva o cortisol.",
            "action": "Limite treinos de alta intensidade a no máximo 1 a 2 vezes por semana, intercalando com corridas leves e dias de descanso.",
            "expected_gain": "Evita o overtraining e picos de cansaço extremo."
        })

    # 2. ANALYZE TRAINING LOAD & INJURY RISK (ACWR)
    acwr = acwr_data.get("acwr", 1.0)
    if acwr > 1.4:
        insights.append({
            "id": "acwr_high_injury_risk",
            "category": "carga",
            "severity": "critical",
            "title": "Risco Elevado de Lesão por Sobrecarga (ACWR > 1.4)",
            "subtitle": f"Índice Agudo/Crônico em {acwr} (Zona de Risco)",
            "problem": f"A carga dos últimos 7 dias ({acwr_data.get('acute_load_km')} km) subiu muito rápido em relação à sua média do último mês ({acwr_data.get('chronic_load_km')} km). Estatisticamente, este é o momento em que surgem canelites, tendinopatias e fascite plantar.",
            "action": "Para a próxima semana, reduza o volume semanal em pelo menos 15-20% ou troque uma corrida de impacto por cross-training (bicicleta/natação) para permitir adaptação tecidual.",
            "expected_gain": "Continuidade nos treinos sem precisar parar por lesões ortopédicas."
        })
    elif acwr < 0.75 and acwr_data.get("chronic_load_km", 0) > 5:
        insights.append({
            "id": "acwr_detraining",
            "category": "carga",
            "severity": "info",
            "title": "Queda no Volume Recente (Descondicionamento)",
            "subtitle": f"Índice Agudo/Crônico em {acwr}",
            "problem": "Seu volume nos últimos 7 dias caiu bastante em relação ao que seu corpo estava acostumado.",
            "action": "Se não foi uma semana planejada de polimento/descanso (tapering), retome gradualmente a consistência para não perder as adaptações cardíacas.",
            "expected_gain": "Manutenção da capacidade aeróbica construída."
        })
    else:
        insights.append({
            "id": "acwr_sweet_spot",
            "category": "carga",
            "severity": "good",
            "title": "Carga de Treino no Ponto Ideal (Sweet Spot)",
            "subtitle": f"ACWR em {acwr} (Faixa ideal: 0.8 a 1.3)",
            "problem": None,
            "action": "Sua progressão está equilibrada e segura. Mantenha essa cadência de evolução sem dar saltos bruscos.",
            "expected_gain": "Adaptação muscular consistente com mínimo risco de afastamento por lesão."
        })

    # 3. ANALYZE CADENCE & BIOMECHANICS
    avg_cadence = cadence_stats.get("average_cadence")
    if avg_cadence:
        if avg_cadence < 162:
            insights.append({
                "id": "low_cadence_overstride",
                "category": "biomecanica",
                "severity": "warning",
                "title": "Cadência Baixa: Provável 'Overstriding' (Passada Lenta)",
                "subtitle": f"Sua cadência média é de {int(avg_cadence)} spm (passos por minuto)",
                "problem": "Uma cadência abaixo de 162 passos/min geralmente significa passadas muito longas com contato inicial muito à frente do quadril. Isso funciona como um freio a cada pisada e transmite grande impacto para joelhos e tíbia.",
                "action": "Procure dar passadas mais curtas e ágeis. Tente usar um metrônomo no relógio ou fone em 170 spm por 5 minutos durante cada treino leve.",
                "expected_gain": "Menor choque articular nos joelhos e economia de até 5% de energia na corrida."
            })
        elif 168 <= avg_cadence <= 185:
            insights.append({
                "id": "cadence_optimal",
                "category": "biomecanica",
                "severity": "good",
                "title": "Cadência Eficiente e Econômica",
                "subtitle": f"Cadência média de {int(avg_cadence)} spm",
                "problem": None,
                "action": "Sua frequência de passadas está na faixa ótima dos corredores eficientes. O tempo de contato com o solo é reduzido.",
                "expected_gain": "Excelente absorção de impacto pela musculatura elástica."
            })

    # 4. ANALYZE LONGEST RUN RATIO (Longão desproporcional)
    if weekly_data:
        recent_week = weekly_data[-1]
        tot_km = recent_week.get("total_km", 0)
        long_km = recent_week.get("longest_run_km", 0)
        if tot_km > 0 and (long_km / tot_km) > 0.42 and tot_km > 15:
            ratio_pct = int(round((long_km / tot_km) * 100))
            insights.append({
                "id": "long_run_ratio_high",
                "category": "volume",
                "severity": "warning",
                "title": "Longão Desproporcional ao Volume Semanal",
                "subtitle": f"Seu longão representou {ratio_pct}% de toda a sua quilometragem da semana",
                "problem": "Quando uma única corrida concentra mais de 35% a 40% do volume da semana inteira, o risco de fadiga excessiva e lesão no fim de semana aumenta muito.",
                "action": "Distribua melhor os quilômetros durante a semana. Em vez de fazer 5km na quarta e 15km no sábado, tente fazer 6km terça, 6km quinta e 12km no sábado.",
                "expected_gain": "Maior frescor físico no treino longo e adaptação mais uniforme."
            })

    # 5. ANALYZE CONSISTENCY & FREQUENCY
    runs_per_week = [w["run_count"] for w in weekly_data[-4:] if w["run_count"] > 0]
    avg_runs_week = statistics.mean(runs_per_week) if runs_per_week else 0
    if avg_runs_week < 2.2 and len(runs_per_week) >= 2:
        insights.append({
            "id": "low_frequency",
            "category": "consistencia",
            "severity": "info",
            "title": "Aumente a Frequência Semanal de Treinos",
            "subtitle": f"Média recente de {avg_runs_week:.1f} treinos/semana",
            "problem": "Correr apenas 1 ou 2 vezes por semana dificulta a adaptação neuromuscular estável e expõe o corpo a picos de esforço espaçados.",
            "action": "Se possível, adicione uma rodagem regenerativa curta de 20 a 30 minutos na semana para somar 3 estímulos regulares.",
            "expected_gain": "Ganhos exponenciais de condicionamento sem aumentar a fadiga diária."
        })

    return insights

def compute_full_analytics(activities: List[Dict[str, Any]], settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main analytics aggregator: combines all algorithms into a complete dashboard payload.
    """
    max_hr = int(settings.get("max_hr") or 190)
    rest_hr = int(settings.get("rest_hr") or 55)
    zones = get_hr_zones(max_hr, rest_hr)

    # Filter only runs
    runs = [a for a in activities if "run" in str(a.get("type", "")).lower() or a.get("type") == "Run"]
    if not runs and activities:
        runs = activities # fallback

    total_runs = len(runs)
    total_distance_m = sum(float(a.get("distance") or 0.0) for a in runs)
    total_time_s = sum(int(a.get("moving_time") or 0) for a in runs)
    total_elevation_m = sum(float(a.get("total_elevation_gain") or 0.0) for a in runs)

    overall_pace_s = (total_time_s / (total_distance_m / 1000.0)) if total_distance_m > 0 else 0.0
    overall_pace_formatted = format_pace(overall_pace_s)

    # Heart Rate & Zones Breakdown
    hr_counts = {"Z1": 0, "Z2": 0, "Z3": 0, "Z4": 0, "Z5": 0}
    hr_km = {"Z1": 0.0, "Z2": 0.0, "Z3": 0.0, "Z4": 0.0, "Z5": 0.0}
    runs_with_hr = 0
    all_avg_hrs = []

    for a in runs:
        avg_hr = a.get("average_heartrate")
        km = (a.get("distance") or 0.0) / 1000.0
        if avg_hr and avg_hr > 50:
            runs_with_hr += 1
            all_avg_hrs.append(avg_hr)
            zone = classify_activity_hr_zone(avg_hr, zones)
            if zone:
                hr_counts[zone] += 1
                hr_km[zone] += km

    total_hr_km = sum(hr_km.values())
    hr_distribution = {}
    for zid, zinfo in zones.items():
        km_in_z = round(hr_km[zid], 1)
        pct = round((km_in_z / total_hr_km * 100.0), 1) if total_hr_km > 0 else 0.0
        hr_distribution[zid] = {
            **zinfo,
            "zone_id": zid,
            "total_km": km_in_z,
            "activities_count": hr_counts[zid],
            "percentage": pct
        }

    # Cadence Stats
    cadences = [float(a["average_cadence"]) for a in runs if a.get("average_cadence") and a["average_cadence"] > 100]
    avg_cadence = round(statistics.mean(cadences), 1) if cadences else None
    cadence_stats = {
        "average_cadence": avg_cadence,
        "sample_size": len(cadences),
        "status": "Ideal (170-185)" if avg_cadence and 170 <= avg_cadence <= 185 else ("Atenção (<162)" if avg_cadence and avg_cadence < 162 else "Normal")
    }

    # ACWR
    acwr_data = calculate_acwr(runs)

    # Weekly Breakdown
    weekly_breakdown = calculate_weekly_breakdown(runs)

    # Race Predictions
    race_predictions = calculate_race_predictions(runs)

    # Performance Score (Librun Index)
    # 0 to 100 composite score
    score_components = {}
    
    # 1. ACWR score (max 25)
    acwr_val = acwr_data.get("acwr", 1.0)
    if 0.8 <= acwr_val <= 1.3:
        acwr_score = 25
    elif 1.3 < acwr_val <= 1.45 or 0.65 <= acwr_val < 0.8:
        acwr_score = 18
    else:
        acwr_score = 10
    score_components["carga_acwr"] = acwr_score

    # 2. Polarized intensity score (max 25)
    z3_p = hr_distribution.get("Z3", {}).get("percentage", 0)
    z12_p = hr_distribution.get("Z1", {}).get("percentage", 0) + hr_distribution.get("Z2", {}).get("percentage", 0)
    if total_hr_km > 0:
        if z3_p <= 15 and z12_p >= 65:
            intensity_score = 25
        elif z3_p <= 25:
            intensity_score = 18
        else:
            intensity_score = 12
    else:
        intensity_score = 20
    score_components["polarizacao"] = intensity_score

    # 3. Cadence score (max 25)
    if avg_cadence:
        if 168 <= avg_cadence <= 185:
            cad_score = 25
        elif 162 <= avg_cadence < 168:
            cad_score = 20
        else:
            cad_score = 14
    else:
        cad_score = 18
    score_components["cadencia"] = cad_score

    # 4. Consistency score (max 25)
    recent_runs = sum(w["run_count"] for w in weekly_breakdown[-4:]) if weekly_breakdown else 0
    if recent_runs >= 12:
        const_score = 25
    elif recent_runs >= 8:
        const_score = 20
    elif recent_runs >= 4:
        const_score = 15
    else:
        const_score = 10
    score_components["consistencia"] = const_score

    librun_score = sum(score_components.values())

    # Generate personalized recommendations
    insights = generate_coaching_insights(
        activities=runs,
        settings=settings,
        acwr_data=acwr_data,
        weekly_data=weekly_breakdown,
        hr_distribution=hr_distribution,
        cadence_stats=cadence_stats
    )

    return {
        "summary": {
            "total_runs": total_runs,
            "total_distance_km": round(total_distance_m / 1000.0, 1),
            "total_time_hours": round(total_time_s / 3600.0, 1),
            "total_elevation_gain_m": round(total_elevation_m, 0),
            "overall_avg_pace": overall_pace_formatted,
            "overall_avg_pace_seconds": round(overall_pace_s, 1),
            "avg_heartrate": round(statistics.mean(all_avg_hrs), 0) if all_avg_hrs else None,
            "avg_cadence": avg_cadence,
            "librun_score": librun_score,
            "score_components": score_components
        },
        "acwr": acwr_data,
        "hr_distribution": hr_distribution,
        "cadence_stats": cadence_stats,
        "weekly_breakdown": weekly_breakdown,
        "race_predictions": race_predictions,
        "coaching_insights": insights,
        "progress": calculate_progress_analytics(runs)
    }
