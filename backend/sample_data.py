from datetime import datetime, timedelta
import random
from typing import List, Dict, Any
from database import upsert_activity, clear_all_activities

def seed_sample_activities(clear_existing: bool = True) -> int:
    """
    Seeds a realistic 10-week multi-sport history for demonstration:
    - Running: 3 runs per week (Rodagem, Tiros/Ritmo, Longão progressivo)
    - Cycling: 1 road ride or indoor session per week (25k to 55k, cadence ~85 rpm)
    - Swimming: 1 swim session every 2 weeks (1.200m to 1.800m)
    - Strength/Workout: 1 functional/core strength session per week (45-50 min)
    - Realistic paces, heart rates, cadences, and clear progress curves over time.
    """
    if clear_existing:
        clear_all_activities()

    now = datetime.now()
    activities = []

    count = 0
    # Generate for past 10 weeks (70 days)
    for week in range(9, -1, -1):
        progress_factor = (9 - week) / 9.0  # 0.0 (past) to 1.0 (recent)
        week_monday = now - timedelta(days=now.weekday() + (week * 7))
        
        # 1. Tuesday: Corrida - Rodagem 6k a 8k
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

        # 2. Wednesday: Musculação / Treino de Força (Fortalecimento Funcional & Core)
        wed_date = week_monday + timedelta(days=2, hours=18, minutes=30)
        gym_time_sec = int(random.uniform(42, 52) * 60) # 42 a 52 min
        gym_hr = int(122 - progress_factor * 2 + random.uniform(-3, 3))
        activities.append({
            "strava_id": f"sample_{wed_date.strftime('%Y%m%d%H%M')}",
            "name": "Treino de Força & Prevenção (Core e Pernas)",
            "type": "WeightTraining",
            "distance": 0.0,
            "moving_time": gym_time_sec,
            "elapsed_time": gym_time_sec + 180,
            "total_elevation_gain": 0.0,
            "start_date": wed_date.isoformat(),
            "average_speed": 0.0,
            "average_cadence": None,
            "average_heartrate": gym_hr,
            "max_heartrate": gym_hr + 22,
            "source": "sample"
        })

        # 3. Thursday: Corrida - Intervalados ou Treino de Ritmo 5k a 7k
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

        # 4. Friday: Natação regenerativa (a cada 2 semanas) ou Caminhada/Soltura
        if week % 2 == 0:
            fri_date = week_monday + timedelta(days=4, hours=12, minutes=15)
            swim_dist_m = round(random.uniform(1200, 1800), -2) # 1200m a 1800m
            # Pace ~1:55/100m para ~1:45/100m
            pace_100m_sec = (115.0 - progress_factor * 10.0) + random.uniform(-3, 3)
            swim_time_sec = int((swim_dist_m / 100.0) * pace_100m_sec)
            swim_hr = int(136 - progress_factor * 3 + random.uniform(-2, 2))
            activities.append({
                "strava_id": f"sample_{fri_date.strftime('%Y%m%d%H%M')}",
                "name": f"Natação Regenerativa {int(swim_dist_m)}m",
                "type": "Swim",
                "distance": swim_dist_m,
                "moving_time": swim_time_sec,
                "elapsed_time": swim_time_sec + 300,
                "total_elevation_gain": 0.0,
                "start_date": fri_date.isoformat(),
                "average_speed": swim_dist_m / swim_time_sec,
                "average_cadence": int(28 + progress_factor * 2), # braçadas/min
                "average_heartrate": swim_hr,
                "max_heartrate": swim_hr + 15,
                "source": "sample"
            })
        else:
            fri_date = week_monday + timedelta(days=4, hours=17, minutes=30)
            walk_dist_km = round(random.uniform(4.0, 5.5), 2)
            walk_time_sec = int(walk_dist_km * 10.5 * 60) # ~10:30 min/km
            activities.append({
                "strava_id": f"sample_{fri_date.strftime('%Y%m%d%H%M')}",
                "name": "Caminhada Regenerativa no Parque",
                "type": "Walk",
                "distance": walk_dist_km * 1000.0,
                "moving_time": walk_time_sec,
                "elapsed_time": walk_time_sec + 120,
                "total_elevation_gain": 35.0,
                "start_date": fri_date.isoformat(),
                "average_speed": (walk_dist_km * 1000.0) / walk_time_sec,
                "average_cadence": 115,
                "average_heartrate": 105,
                "max_heartrate": 118,
                "source": "sample"
            })

        # 5. Saturday: Ciclismo de Estrada / Giro Longo
        sat_date = week_monday + timedelta(days=5, hours=7, minutes=30)
        bike_dist_km = round(random.uniform(28.0, 52.0) + (progress_factor * 8.0), 1) # 28km até 60km
        # Speed: 24.5 km/h to 28.5 km/h
        bike_speed_kmh = (24.8 + progress_factor * 3.2) + random.uniform(-0.5, 0.5)
        bike_time_sec = int((bike_dist_km / bike_speed_kmh) * 3600)
        bike_hr = int(141 - progress_factor * 3 + random.uniform(-2, 2))
        bike_rpm = int(82 + progress_factor * 4 + random.uniform(-1, 1)) # rpm
        activities.append({
            "strava_id": f"sample_{sat_date.strftime('%Y%m%d%H%M')}",
            "name": f"Pedal de Estrada & Giro Aeróbico ({int(bike_dist_km)}K)",
            "type": "Ride",
            "distance": bike_dist_km * 1000.0,
            "moving_time": bike_time_sec,
            "elapsed_time": bike_time_sec + 360,
            "total_elevation_gain": round(bike_dist_km * 9.5),
            "start_date": sat_date.isoformat(),
            "average_speed": (bike_dist_km * 1000.0) / bike_time_sec,
            "average_cadence": bike_rpm,
            "average_heartrate": bike_hr,
            "max_heartrate": bike_hr + 20,
            "source": "sample"
        })

        # 6. Sunday: Corrida - Longão progressivo: 10km até 16km
        sun_date = week_monday + timedelta(days=6, hours=7, minutes=0)
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

if __name__ == "__main__":
    n = seed_sample_activities(clear_existing=True)
    print(f"Sucesso: {n} atividades multiesportivas geradas no banco local.")

