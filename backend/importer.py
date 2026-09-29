import csv
import io
import zipfile
import gzip
from datetime import datetime
from typing import List, Dict, Any, Tuple

from database import upsert_activity

def parse_strava_csv(file_content: bytes) -> Tuple[int, int]:
    """
    Parses a Strava 'activities.csv' file from the Strava bulk data archive.
    Returns (imported_count, skipped_count).
    """
    try:
        # Try decoding as utf-8, fallback to latin-1
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    skipped = 0

    for row in reader:
        # Map common Strava CSV headers (handle both English and Portuguese exports)
        act_id = row.get("Activity ID") or row.get("ID da atividade") or row.get("id") or ""
        act_name = row.get("Activity Name") or row.get("Nome da atividade") or row.get("name") or "Corrida"
        act_type = row.get("Activity Type") or row.get("Tipo de atividade") or row.get("type") or "Run"
        
        # Only keep run activities or if user uploaded run files
        act_type_lower = act_type.lower()
        if "run" not in act_type_lower and "corrida" not in act_type_lower and "walk" not in act_type_lower and "hike" not in act_type_lower:
            # Skip bikes, swims, etc. for running focus unless it's generic
            if act_type not in ["Run", "TrailRun", "VirtualRun", "Track"]:
                continue

        # Date parsing
        date_str = (
            row.get("Activity Date") or 
            row.get("Data da atividade") or 
            row.get("start_date") or 
            row.get("start_date_local") or ""
        )
        # Often formatted like: "Sep 15, 2026, 7:15:30 AM" or "2026-09-15 07:15:30"
        iso_date = ""
        if date_str:
            for fmt in [
                "%b %d, %Y, %I:%M:%S %p",
                "%d de %b. de %Y, %H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M"
            ]:
                try:
                    dt = datetime.strptime(date_str.strip(), fmt)
                    iso_date = dt.isoformat()
                    break
                except Exception:
                    pass
            if not iso_date:
                iso_date = date_str

        # Distance: In Strava CSV, 'Distance' is often in km or meters
        dist_val = (
            row.get("Distance") or 
            row.get("Distância") or 
            row.get("distance") or "0"
        ).replace(",", ".")
        try:
            distance_num = float(dist_val)
            # If distance is <= 100, it's very likely in kilometers, convert to meters
            if 0 < distance_num <= 100.0:
                distance_m = distance_num * 1000.0
            else:
                distance_m = distance_num
        except ValueError:
            distance_m = 0.0

        # Moving Time (seconds)
        moving_val = (
            row.get("Moving Time") or 
            row.get("Tempo em movimento") or 
            row.get("moving_time") or "0"
        ).replace(",", ".")
        try:
            moving_time_s = int(float(moving_val))
        except ValueError:
            moving_time_s = 0

        # Elapsed Time (seconds)
        elapsed_val = (
            row.get("Elapsed Time") or 
            row.get("Tempo decorrido") or 
            row.get("elapsed_time") or str(moving_time_s)
        ).replace(",", ".")
        try:
            elapsed_time_s = int(float(elapsed_val))
        except ValueError:
            elapsed_time_s = moving_time_s

        # Elevation Gain
        elev_val = (
            row.get("Elevation Gain") or 
            row.get("Ganho de elevação") or 
            row.get("total_elevation_gain") or "0"
        ).replace(",", ".")
        try:
            elevation_gain = float(elev_val)
        except ValueError:
            elevation_gain = 0.0

        # Average Speed
        avg_speed = 0.0
        if moving_time_s > 0 and distance_m > 0:
            avg_speed = distance_m / moving_time_s

        # Average Heartrate
        hr_val = (
            row.get("Average Heart Rate") or 
            row.get("Frequência cardíaca média") or 
            row.get("average_heartrate") or ""
        ).replace(",", ".")
        try:
            avg_hr = float(hr_val) if hr_val else None
        except ValueError:
            avg_hr = None

        # Max Heartrate
        max_hr_val = (
            row.get("Max Heart Rate") or 
            row.get("Frequência cardíaca máxima") or 
            row.get("max_heartrate") or ""
        ).replace(",", ".")
        try:
            max_hr = float(max_hr_val) if max_hr_val else None
        except ValueError:
            max_hr = None

        # Average Cadence
        cad_val = (
            row.get("Average Cadence") or 
            row.get("Cadência média") or 
            row.get("average_cadence") or ""
        ).replace(",", ".")
        try:
            avg_cad = float(cad_val) if cad_val else None
            # If cadence is reported per leg (e.g. 80-95), double it to spm
            if avg_cad and 60 <= avg_cad <= 110:
                avg_cad = avg_cad * 2
        except ValueError:
            avg_cad = None

        if distance_m > 0 and moving_time_s > 0:
            act_dict = {
                "strava_id": str(act_id) if act_id else f"csv_{iso_date}_{distance_m}",
                "name": act_name,
                "type": "Run",
                "distance": distance_m,
                "moving_time": moving_time_s,
                "elapsed_time": elapsed_time_s,
                "total_elevation_gain": elevation_gain,
                "start_date": iso_date,
                "start_date_local": iso_date,
                "average_speed": avg_speed,
                "max_speed": avg_speed * 1.3,
                "average_cadence": avg_cad,
                "average_heartrate": avg_hr,
                "max_heartrate": max_hr,
                "source": "csv_import"
            }
            upsert_activity(act_dict)
            imported += 1
        else:
            skipped += 1

    return imported, skipped

def parse_strava_zip(zip_bytes: bytes) -> Tuple[int, int]:
    """Extracts activities.csv from a Strava Bulk Export zip file."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        # Search for activities.csv
        target_name = None
        for name in z.namelist():
            if name.endswith("activities.csv") or name.lower().endswith("atividades.csv"):
                target_name = name
                break
        
        if not target_name:
            raise ValueError("Arquivo activities.csv não encontrado dentro do arquivo ZIP fornecido.")

        csv_bytes = z.read(target_name)
        return parse_strava_csv(csv_bytes)

def parse_gpx_file(file_content: bytes, filename: str = "Corrida GPX") -> bool:
    """Parses a standalone GPX file using gpxpy."""
    import gpxpy
    try:
        gpx = gpxpy.parse(file_content.decode("utf-8"))
    except Exception:
        return False

    moving_time, stopped_time, moving_distance, stopped_distance, max_speed = gpx.get_moving_data()
    total_elevation_gain = gpx.get_uphill_downhill().uphill or 0.0
    start_time = gpx.get_time_bounds().start_time

    if not moving_distance or moving_distance <= 0:
        return False

    time_sec = int(moving_time) if moving_time else 1
    avg_speed = moving_distance / time_sec

    act_dict = {
        "strava_id": f"gpx_{start_time.isoformat() if start_time else filename}",
        "name": filename.replace(".gpx", ""),
        "type": "Run",
        "distance": moving_distance,
        "moving_time": time_sec,
        "elapsed_time": int(time_sec + (stopped_time or 0)),
        "total_elevation_gain": total_elevation_gain,
        "start_date": start_time.isoformat() if start_time else datetime.utcnow().isoformat(),
        "start_date_local": start_time.isoformat() if start_time else datetime.utcnow().isoformat(),
        "average_speed": avg_speed,
        "max_speed": max_speed or (avg_speed * 1.2),
        "average_cadence": None,
        "average_heartrate": None,
        "max_heartrate": None,
        "source": "gpx_import"
    }
    upsert_activity(act_dict)
    return True
