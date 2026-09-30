from datetime import datetime, timedelta
import random
from typing import List, Dict, Any
from database import upsert_activity, clear_all_activities

def seed_sample_activities(clear_existing: bool = True) -> int:
    """
    Seeds a realistic 10-week running history for demonstration:
    - 3-4 runs per week
    - Realistic paces, distances (5k to 16k), cadence (~158-164 spm), HR zones
    - Designed to show real actionable insights:
      * Zone 3 'grey zone' trap (~45% of time in Z3)
      * Low cadence warning (<162 spm)
      * Acute:Chronic ratio in safe/moderate area (~1.25)
      * Race predictions from 5k/10k efforts
    """
    if clear_existing:
        clear_all_activities()

    now = datetime.now()
    activities = []

    # Run profiles:
    # 1. Rodagem Leve (tentativa de Z2, mas frequentemente escapa pra Z3)
    # 2. Treino de Ritmo / Tempo Run (Z3/Z4)
    # 3. Tiros / Intervalado (Z4/Z5)
    # 4. Longão de Domingo (Z2/Z3)

    count = 0
    # Generate for past 10 weeks (70 days)
    for week in range(9, -1, -1):
        progress_factor = (9 - week) / 9.0  # 0.0 (past) to 1.0 (recent)
        week_monday = now - timedelta(days=now.weekday() + (week * 7))
        
        # Tuesday: Rodagem 6k a 8k
        tue_date = week_monday + timedelta(days=1, hours=6, minutes=45)
        dist_km = round(random.uniform(6.5, 8.2), 2)
        pace_min = (5.65 - progress_factor * 0.30) + random.uniform(-0.06, 0.06) # Evolui de ~5:39 para ~5:21 min/km
        time_sec = int(dist_km * pace_min * 60)
        hr = int(149 - progress_factor * 4 + random.uniform(-2, 2))
        cadence = int(157 + progress_factor * 5 + random.uniform(-1, 1))
        activities.append({
            "strava_id": f"sample_{tue_date.strftime('%Y%m%d%H%M')}",
            "name": "Rodagem Matinal",
            "type": "Run",
            "distance": dist_km * 1000.0,
            "moving_time": time_sec,
            "elapsed_time": time_sec + 60,
            "total_elevation_gain": round(dist_km * 8.5),
            "start_date": tue_date.isoformat(),
            "average_speed": (dist_km * 1000.0) / time_sec,
            "average_cadence": cadence,
            "average_heartrate": hr,
            "max_heartrate": hr + 14,
            "source": "sample"
        })

        # Thursday: Treino de Ritmo ou Intervalado 5k a 7k
        thu_date = week_monday + timedelta(days=3, hours=19, minutes=10)
        is_intervals = (week % 2 == 0)
        dist_km = round(random.uniform(5.0, 7.0), 2)
        if is_intervals:
            pace_min = (4.95 - progress_factor * 0.32) + random.uniform(-0.05, 0.05) # ~4:57 para ~4:38 min/km
            hr = int(168 - progress_factor * 2 + random.uniform(-2, 2))
            cadence = int(163 + progress_factor * 4 + random.uniform(-1, 1))
            name = "Intervalados 6x400m na Pista"
        else:
            pace_min = (5.28 - progress_factor * 0.28) + random.uniform(-0.05, 0.05) # ~5:17 para ~5:00 min/km
            hr = int(158 - progress_factor * 3 + random.uniform(-2, 2))
            cadence = int(160 + progress_factor * 4 + random.uniform(-1, 1))
            name = "Treino Contínuo Ritmo de Prova"

        time_sec = int(dist_km * pace_min * 60)
        activities.append({
            "strava_id": f"sample_{thu_date.strftime('%Y%m%d%H%M')}",
            "name": name,
            "type": "Run",
            "distance": dist_km * 1000.0,
            "moving_time": time_sec,
            "elapsed_time": time_sec + 120,
            "total_elevation_gain": round(dist_km * 6.0),
            "start_date": thu_date.isoformat(),
            "average_speed": (dist_km * 1000.0) / time_sec,
            "average_cadence": cadence,
            "average_heartrate": hr,
            "max_heartrate": hr + 16,
            "source": "sample"
        })

        # Friday or Saturday: Rodagem Curta Opcional (a cada 2 semanas)
        if week % 2 != 0:
            sat_date = week_monday + timedelta(days=5, hours=8, minutes=0)
            dist_km = round(random.uniform(4.5, 5.5), 2)
            pace_min = (5.85 - progress_factor * 0.25) + random.uniform(-0.06, 0.06)
            time_sec = int(dist_km * pace_min * 60)
            hr = int(142 - progress_factor * 3 + random.uniform(-2, 2))
            cadence = int(158 + progress_factor * 3 + random.uniform(-1, 1))
            activities.append({
                "strava_id": f"sample_{sat_date.strftime('%Y%m%d%H%M')}",
                "name": "Soltura Leve de Sábado",
                "type": "Run",
                "distance": dist_km * 1000.0,
                "moving_time": time_sec,
                "elapsed_time": time_sec + 40,
                "total_elevation_gain": round(dist_km * 5.0),
                "start_date": sat_date.isoformat(),
                "average_speed": (dist_km * 1000.0) / time_sec,
                "average_cadence": cadence,
                "average_heartrate": hr,
                "max_heartrate": hr + 10,
                "source": "sample"
            })

        # Sunday: Longão (Long Run) progressivo: 10km até 16km
        sun_date = week_monday + timedelta(days=6, hours=7, minutes=0)
        # Progressive volume
        base_long = 10.0 + (9 - week) * 0.6
        dist_km = round(base_long + random.uniform(-0.5, 0.8), 2)
        pace_min = (5.65 - progress_factor * 0.25) + random.uniform(-0.06, 0.06)
        time_sec = int(dist_km * pace_min * 60)
        hr = int(148 - progress_factor * 3 + random.uniform(-2, 2))
        cadence = int(157 + progress_factor * 4 + random.uniform(-1, 1))
        activities.append({
            "strava_id": f"sample_{sun_date.strftime('%Y%m%d%H%M')}",
            "name": f"Longão de Domingo ({int(dist_km)}K)",
            "type": "Run",
            "distance": dist_km * 1000.0,
            "moving_time": time_sec,
            "elapsed_time": time_sec + 180,
            "total_elevation_gain": round(dist_km * 11.0),
            "start_date": sun_date.isoformat(),
            "average_speed": (dist_km * 1000.0) / time_sec,
            "average_cadence": cadence,
            "average_heartrate": hr,
            "max_heartrate": hr + 18,
            "source": "sample"
        })

    for act in activities:
        upsert_activity(act)
        count += 1

    return count
