import csv
import io
import re
import zipfile
import gzip
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional, Union, BinaryIO

from database import upsert_activity, upsert_activities_bulk

PT_MONTHS = {
    "jan": 1, "janeiro": 1,
    "fev": 2, "fevereiro": 2,
    "mar": 3, "março": 3, "marco": 3,
    "abr": 4, "abril": 4,
    "mai": 5, "maio": 5,
    "jun": 6, "junho": 6,
    "jul": 7, "julho": 7,
    "ago": 8, "agosto": 8,
    "set": 9, "setembro": 9,
    "out": 10, "outubro": 10,
    "nov": 11, "novembro": 11,
    "dez": 12, "dezembro": 12
}

SPORT_MAP = {
    "corrida": "Run",
    "pedalada": "Ride",
    "pedalada de bicicleta elétrica": "EBikeRide",
    "ciclismo": "Ride",
    "caminhada": "Walk",
    "trilha": "Hike",
    "treinamento com peso": "WeightTraining",
    "musculação": "WeightTraining",
    "treino": "Workout",
    "natação": "Swim",
    "ioga": "Yoga",
    "pilates": "Pilates",
    "remo": "Rowing",
    "esteira": "VirtualRun",
    "rolo virtual": "VirtualRide"
}

def parse_time_string_to_seconds(time_str: Any, distance_m: float = 0.0) -> int:
    """
    Parses various time representations into seconds:
    - "01:18:30" (HH:MM:SS) -> 4710
    - "1:18:30" -> 4710
    - "18:30" (MM:SS) -> 1110
    - "3600" or "3600.0" -> 3600
    - Minutes format: if distance >= 2000m and raw number is <= 240,
      the time was recorded in minutes (e.g. 78 min for 5km = 4680s).
    """
    if not time_str:
        return 0
    clean = str(time_str).strip()
    if not clean:
        return 0
    if ":" in clean:
        parts = clean.split(":")
        try:
            if len(parts) == 3:
                h, m, s = int(float(parts[0])), int(float(parts[1])), float(parts[2])
                return int(h * 3600 + m * 60 + s)
            elif len(parts) == 2:
                m, s = int(float(parts[0])), float(parts[1])
                return int(m * 60 + s)
        except Exception:
            pass
    clean_num = parse_number(clean)
    try:
        val = float(clean_num)
        if distance_m >= 2000.0 and 0 < val <= 240.0:
            return int(val * 60.0)
        return int(val)
    except (ValueError, TypeError):
        return 0

def parse_number(val: Any) -> float:
    """Safely converts string/number with localized comma/dot format to float."""
    if val is None:
        return 0.0
    s = str(val).strip()
    if not s:
        return 0.0
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0

def parse_date_robust(date_str: Any) -> str:
    """
    Parses date string in multiple locales (Portuguese, English, ISO) into ISO format.
    """
    if not date_str:
        return ""
    clean = str(date_str).strip()
    
    # Try Portuguese format: '7 de out. de 2026, 20:19:41' or '7 de out de 2026 20:19:41'
    m = re.match(r"(\d{1,2})\s+de\s+([a-zA-Zç]+)\.?\s+de\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):?(\d{2})?", clean)
    if m:
        day, mon_str, year, hr, mn, sc = m.groups()
        mon_key = mon_str.lower()
        if mon_key in PT_MONTHS:
            mon = PT_MONTHS[mon_key]
        else:
            mon = PT_MONTHS.get(mon_key[:3], 1)
        sc = sc or "00"
        return f"{int(year):04d}-{mon:02d}-{int(day):02d}T{int(hr):02d}:{int(mn):02d}:{int(sc):02d}"

    for fmt in [
        "%b %d, %Y, %I:%M:%S %p",
        "%b %d, %Y, %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%m/%d/%Y %I:%M:%S %p",
        "%Y/%m/%d %H:%M:%S"
    ]:
        try:
            return datetime.strptime(clean, fmt).isoformat()
        except Exception:
            pass

    return clean

def detect_delimiter(text: str) -> str:
    """Detects whether CSV is delimited by comma, semicolon, or tab."""
    first_line = text.split("\n", 1)[0]
    best_delim = ","
    max_cols = 1
    for delim in [",", ";", "\t"]:
        cols = len(first_line.split(delim))
        if cols > max_cols:
            max_cols = cols
            best_delim = delim
    return best_delim

def parse_strava_csv(file_content: Union[bytes, str], athlete_id: Optional[str] = None) -> Tuple[int, int]:
    """
    Parses a Strava 'activities.csv' file from the Strava bulk data archive.
    Handles duplicate columns, localized Portuguese/English headers, and delimiters.
    Returns (imported_count, skipped_count).
    """
    if isinstance(file_content, bytes):
        try:
            text = file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = file_content.decode("latin-1")
    else:
        text = str(file_content)

    delim = detect_delimiter(text)
    reader = csv.reader(io.StringIO(text), delimiter=delim)
    try:
        headers = next(reader)
    except StopIteration:
        return 0, 0

    headers_clean = [h.strip() for h in headers]

    def find_col_indices(candidates: List[str]) -> List[int]:
        indices = []
        for cand in candidates:
            cand_l = cand.lower()
            for idx, h in enumerate(headers_clean):
                if h.lower() == cand_l and idx not in indices:
                    indices.append(idx)
        return indices

    def get_col_val(row: List[str], indices: List[int]) -> str:
        for idx in indices:
            if idx < len(row):
                v = row[idx].strip()
                if v:
                    return v
        return ""

    # Map candidate column headers for both Portuguese and English exports
    id_cols = find_col_indices(["id da atividade", "activity id", "id", "nome do arquivo", "filename"])
    name_cols = find_col_indices(["nome da atividade", "activity name", "name", "título", "title"])
    type_cols = find_col_indices(["tipo de atividade", "activity type", "type", "tipo", "esporte", "sport"])
    date_cols = find_col_indices(["data da atividade", "activity date", "start_date", "start_date_local", "data", "date", "hora de início", "start time"])
    moving_cols = find_col_indices(["tempo de movimentação", "moving time", "tempo em movimento", "moving_time", "tempo do temporizador", "timer time"])
    elapsed_cols = find_col_indices(["tempo decorrido", "elapsed time", "elapsed_time", "tempo total", "duração", "duration"])
    dist_cols = find_col_indices(["distância", "distance", "distancia", "distância da atividade", "activity distance"])
    elev_cols = find_col_indices(["ganho de elevação", "elevation gain", "total_elevation_gain", "elevação", "elevation"])
    hr_avg_cols = find_col_indices(["frequência cardíaca média", "average heart rate", "average_heartrate", "frequência cardíaca", "heart rate"])
    hr_max_cols = find_col_indices(["frequência cardíaca máxima", "max heart rate", "max_heartrate"])
    cad_cols = find_col_indices(["cadência média", "average cadence", "average_cadence"])
    speed_avg_cols = find_col_indices(["velocidade média", "average speed", "average_speed"])
    speed_max_cols = find_col_indices(["velocidade máx.", "velocidade máxima", "max speed", "max_speed"])

    activities_to_import: List[Dict[str, Any]] = []
    skipped = 0

    for row in reader:
        if not row or not any(row):
            continue

        act_id = get_col_val(row, id_cols)
        name = get_col_val(row, name_cols) or "Atividade"
        raw_sport = get_col_val(row, type_cols) or "Run"
        sport = SPORT_MAP.get(raw_sport.lower(), raw_sport)
        date_str = get_col_val(row, date_cols)
        iso_date = parse_date_robust(date_str) or datetime.utcnow().isoformat()

        # Distance: Strava CSV often has column in km (e.g. 10,01) and raw meters (10009.2).
        # Check from reversed order so the high-precision meter column is preferred.
        dist_m = 0.0
        for idx in reversed(dist_cols):
            if idx < len(row):
                val_str = row[idx].strip()
                if val_str:
                    num = parse_number(val_str)
                    if num > 100.0:
                        dist_m = num
                        break
                    elif num > 0:
                        dist_m = num * 1000.0
                        break

        # Moving time and elapsed time
        moving_raw = get_col_val(row, moving_cols)
        elapsed_raw = get_col_val(row, elapsed_cols)
        moving_s = parse_time_string_to_seconds(moving_raw, distance_m=dist_m)
        elapsed_s = parse_time_string_to_seconds(elapsed_raw, distance_m=dist_m)

        # Fallback between moving time and elapsed time
        if moving_s <= 0 and elapsed_s > 0:
            moving_s = elapsed_s
        if elapsed_s <= 0:
            elapsed_s = moving_s

        # Accept activity if it has either positive duration or positive distance
        if moving_s <= 0 and dist_m <= 0:
            skipped += 1
            continue

        elev = parse_number(get_col_val(row, elev_cols))
        hr_avg_raw = get_col_val(row, hr_avg_cols)
        hr_max_raw = get_col_val(row, hr_max_cols)
        cad_raw = get_col_val(row, cad_cols)

        hr_avg = parse_number(hr_avg_raw) if hr_avg_raw else None
        hr_max = parse_number(hr_max_raw) if hr_max_raw else None
        cad = parse_number(cad_raw) if cad_raw else None
        if cad and 60 <= cad <= 110:
            cad = cad * 2

        avg_speed = parse_number(get_col_val(row, speed_avg_cols))
        if avg_speed <= 0 and moving_s > 0 and dist_m > 0:
            avg_speed = dist_m / moving_s
        max_speed = parse_number(get_col_val(row, speed_max_cols))
        if max_speed <= 0 and avg_speed > 0:
            max_speed = avg_speed * 1.3

        act_dict = {
            "strava_id": str(act_id) if act_id else f"csv_{iso_date}_{dist_m}",
            "name": name,
            "type": sport,
            "distance": dist_m,
            "moving_time": moving_s,
            "elapsed_time": elapsed_s,
            "total_elevation_gain": elev,
            "start_date": iso_date,
            "start_date_local": iso_date,
            "average_speed": avg_speed,
            "max_speed": max_speed,
            "average_cadence": cad,
            "average_heartrate": hr_avg,
            "max_heartrate": hr_max,
            "source": "csv_import"
        }
        activities_to_import.append(act_dict)

    if activities_to_import:
        imported = upsert_activities_bulk(activities_to_import, athlete_id=athlete_id)
    else:
        imported = 0

    return imported, skipped

def parse_strava_zip(
    zip_source: Union[bytes, BinaryIO], 
    athlete_id: Optional[str] = None,
    filename: str = ""
) -> Tuple[int, int]:
    """
    Extracts activities.csv from a Strava Bulk Export zip file.
    If activities.csv is missing or contains 0 activities, falls back to parsing
    standalone .gpx/.fit/.tcx activity files included in the archive.
    """
    file_obj = io.BytesIO(zip_source) if isinstance(zip_source, bytes) else zip_source

    with zipfile.ZipFile(file_obj) as z:
        namelist = z.namelist()

        # Try to infer athlete_id from profile.csv or archive filename if not provided
        if not athlete_id:
            if "profile.csv" in namelist:
                try:
                    with z.open("profile.csv") as pf:
                        p_text = pf.read().decode("utf-8-sig", errors="ignore")
                        p_reader = csv.reader(io.StringIO(p_text))
                        p_headers = next(p_reader, [])
                        p_row = next(p_reader, [])
                        for p_idx, p_h in enumerate(p_headers):
                            if "atleta" in p_h.lower() or "athlete" in p_h.lower():
                                if p_idx < len(p_row) and p_row[p_idx].strip():
                                    athlete_id = p_row[p_idx].strip()
                                    break
                except Exception:
                    pass
            if not athlete_id and filename:
                m = re.search(r"export_(\d+)", filename.lower())
                if m:
                    athlete_id = m.group(1)

        # 1. Search for activities.csv or atividades.csv (case-insensitive)
        target_csv_name = None
        for name in namelist:
            name_lower = name.lower()
            if name_lower.endswith("activities.csv") or name_lower.endswith("atividades.csv"):
                target_csv_name = name
                break

        if target_csv_name:
            csv_bytes = z.read(target_csv_name)
            imported, skipped = parse_strava_csv(csv_bytes, athlete_id=athlete_id)
            if imported > 0:
                return imported, skipped

        # 2. Fallback: Parse individual GPX/FIT/TCX files inside the zip
        imported = 0
        skipped = 0
        for name in namelist:
            name_lower = name.lower()
            if name.endswith("/") or "__MACOSX" in name:
                continue

            if name_lower.endswith(".gpx") or name_lower.endswith(".gpx.gz"):
                try:
                    raw = z.read(name)
                    if name_lower.endswith(".gz"):
                        raw = gzip.decompress(raw)
                    ok = parse_gpx_file(raw, filename=name.split("/")[-1], athlete_id=athlete_id)
                    if ok:
                        imported += 1
                    else:
                        skipped += 1
                except Exception:
                    skipped += 1

            elif name_lower.endswith(".fit") or name_lower.endswith(".fit.gz"):
                try:
                    raw = z.read(name)
                    if name_lower.endswith(".gz"):
                        raw = gzip.decompress(raw)
                    ok = parse_fit_file(raw, filename=name.split("/")[-1], athlete_id=athlete_id)
                    if ok:
                        imported += 1
                    else:
                        skipped += 1
                except Exception:
                    skipped += 1

        if imported == 0 and not target_csv_name:
            raise ValueError(
                "Nenhum arquivo 'activities.csv' ou arquivos de atividade (.gpx, .fit) encontrado no arquivo ZIP."
            )

        return imported, skipped

def parse_gpx_file(file_content: bytes, filename: str = "Corrida GPX", athlete_id: Optional[str] = None) -> bool:
    """Parses a standalone GPX file using gpxpy."""
    import gpxpy
    try:
        gpx = gpxpy.parse(file_content.decode("utf-8", errors="ignore"))
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
        "name": filename.replace(".gpx", "").replace(".gz", ""),
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
    return upsert_activity(act_dict, athlete_id=athlete_id)

def parse_fit_file(file_content: bytes, filename: str = "Atividade FIT", athlete_id: Optional[str] = None) -> bool:
    """Parses a standalone FIT file using fitparse."""
    try:
        import fitparse
        fit = fitparse.FitFile(file_content)
        
        session = None
        for record in fit.get_messages("session"):
            session = record
            break
            
        if not session:
            return False
            
        vals = {d.name: d.value for d in session}
        dist = float(vals.get("total_distance") or 0.0)
        moving = int(vals.get("total_moving_time") or vals.get("total_timer_time") or vals.get("total_elapsed_time") or 0)
        elapsed = int(vals.get("total_elapsed_time") or moving)
        
        if moving <= 0 and dist <= 0:
            return False
            
        start_time = vals.get("start_time")
        iso_date = start_time.isoformat() if isinstance(start_time, datetime) else datetime.utcnow().isoformat()
        sport_raw = str(vals.get("sport") or "Run").capitalize()
        sport = SPORT_MAP.get(sport_raw.lower(), sport_raw)
        
        act_dict = {
            "strava_id": f"fit_{iso_date}_{dist}",
            "name": filename.replace(".fit", "").replace(".gz", ""),
            "type": sport,
            "distance": dist,
            "moving_time": moving if moving > 0 else elapsed,
            "elapsed_time": elapsed,
            "total_elevation_gain": float(vals.get("total_ascent") or 0.0),
            "start_date": iso_date,
            "start_date_local": iso_date,
            "average_speed": float(vals.get("avg_speed") or (dist / moving if moving > 0 else 0.0)),
            "max_speed": float(vals.get("max_speed") or 0.0),
            "average_cadence": float(vals.get("avg_cadence") or 0.0) or None,
            "average_heartrate": float(vals.get("avg_heart_rate") or 0.0) or None,
            "max_heartrate": float(vals.get("max_heart_rate") or 0.0) or None,
            "source": "fit_import"
        }
        return upsert_activity(act_dict, athlete_id=athlete_id)
    except Exception:
        return False

