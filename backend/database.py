import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "librun.db"

def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Athlete / User Settings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS athlete_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        strava_client_id TEXT,
        strava_client_secret TEXT,
        strava_access_token TEXT,
        strava_refresh_token TEXT,
        strava_token_expires_at INTEGER,
        athlete_id TEXT,
        athlete_name TEXT DEFAULT 'Corredor',
        max_hr INTEGER DEFAULT 190,
        rest_hr INTEGER DEFAULT 55,
        target_distance TEXT DEFAULT '10k',
        target_time_minutes REAL DEFAULT 50.0,
        gemini_api_key TEXT,
        gemini_model TEXT DEFAULT 'gemini-1.5-flash',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Check if gemini_api_key and gemini_model columns exist (migration for existing db)
    cursor.execute("PRAGMA table_info(athlete_settings)")
    settings_cols = [col[1] for col in cursor.fetchall()]
    if "gemini_api_key" not in settings_cols:
        cursor.execute("ALTER TABLE athlete_settings ADD COLUMN gemini_api_key TEXT")
    if "gemini_model" not in settings_cols:
        cursor.execute("ALTER TABLE athlete_settings ADD COLUMN gemini_model TEXT DEFAULT 'gemini-1.5-flash'")

    # Default settings row if not present
    cursor.execute("""
    INSERT OR IGNORE INTO athlete_settings (id, athlete_name, max_hr, rest_hr, target_distance, target_time_minutes, gemini_model)
    VALUES (1, 'Corredor', 190, 55, '10k', 50.0, 'gemini-1.5-flash')
    """)

    # Privacy & Local-first security:
    # Ensure sensitive personal keys and tokens are never stored on the server database
    cursor.execute("""
    UPDATE athlete_settings 
    SET strava_client_id = NULL,
        strava_client_secret = NULL,
        strava_access_token = NULL,
        strava_refresh_token = NULL,
        strava_token_expires_at = NULL,
        gemini_api_key = NULL,
        athlete_id = NULL
    WHERE id = 1
    """)
    conn.commit()

    # Activities Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strava_id TEXT UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        distance REAL NOT NULL, -- meters
        moving_time INTEGER NOT NULL, -- seconds
        elapsed_time INTEGER NOT NULL, -- seconds
        total_elevation_gain REAL DEFAULT 0.0, -- meters
        start_date TEXT NOT NULL, -- ISO 8601 string
        start_date_local TEXT,
        average_speed REAL DEFAULT 0.0, -- m/s
        max_speed REAL DEFAULT 0.0, -- m/s
        average_cadence REAL DEFAULT NULL, -- spm
        average_heartrate REAL DEFAULT NULL, -- bpm
        max_heartrate REAL DEFAULT NULL, -- bpm
        suffer_score REAL DEFAULT NULL,
        elevation_high REAL DEFAULT NULL,
        elevation_low REAL DEFAULT NULL,
        source TEXT DEFAULT 'strava_api', -- 'strava_api', 'csv_import', 'sample'
        notes TEXT,
        raw_data TEXT, -- JSON if extra details
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("PRAGMA table_info(activities)")
    act_cols = [col[1] for col in cursor.fetchall()]
    if "athlete_id" not in act_cols:
        cursor.execute("ALTER TABLE activities ADD COLUMN athlete_id TEXT")

    # AI Analyses Table (cache analyses to save quota and speed up access)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_type TEXT NOT NULL, -- 'coach_global', 'activity'
        target_id TEXT, -- strava_id or null
        content TEXT NOT NULL,
        model_used TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Indices for speed
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities (start_date DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_type ON activities (type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_athlete_id ON activities (athlete_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_analyses_type_target ON ai_analyses (analysis_type, target_id)")

    # Data fix migration: if any activity has distance >= 1500m and moving_time <= 240s,
    # it was imported with moving_time in minutes from legacy Strava CSV import.
    cursor.execute("""
    UPDATE activities 
    SET moving_time = CAST(moving_time * 60 AS INTEGER),
        average_speed = CASE WHEN (moving_time * 60) > 0 THEN distance / (moving_time * 60) ELSE average_speed END
    WHERE distance >= 1500.0 AND moving_time > 0 AND moving_time <= 240
    """)

    conn.commit()
    conn.close()

def save_athlete_settings(settings: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    fields = []
    values = []
    for k, v in settings.items():
        if k in [
            "gemini_api_key", 
            "strava_client_secret", 
            "strava_client_id", 
            "strava_access_token", 
            "strava_refresh_token", 
            "strava_token_expires_at"
        ]:
            continue  # Do not persist personal API keys or client tokens to server DB
        if k in ["athlete_id", "athlete_name", "max_hr", "rest_hr", "target_distance", "target_time_minutes", "gemini_model"]:
            fields.append(f"{k} = ?")
            values.append(v)
    
    if fields:
        values.append(1)
        query = f"UPDATE athlete_settings SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
    conn.close()

def get_athlete_settings(athlete_id: Optional[str] = None) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM athlete_settings WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["strava_client_id"] = None
        res["strava_client_secret"] = None
        res["strava_access_token"] = None
        res["strava_refresh_token"] = None
        res["strava_token_expires_at"] = None
        res["gemini_api_key"] = None
        res["athlete_id"] = athlete_id if athlete_id else None
        if not res.get("gemini_model") or res.get("gemini_model") == "gemini-flash-lite-latest":
            res["gemini_model"] = "gemini-1.5-flash"
        return res
    return {
        "athlete_id": athlete_id if athlete_id else None,
        "athlete_name": "Corredor",
        "max_hr": 190,
        "rest_hr": 55,
        "target_distance": "10k",
        "target_time_minutes": 50.0,
        "gemini_model": "gemini-1.5-flash"
    }

def save_ai_analysis(analysis_type: str, content: str, target_id: Optional[str] = None, model_used: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO ai_analyses (analysis_type, target_id, content, model_used)
    VALUES (?, ?, ?, ?)
    """, (analysis_type, target_id, content, model_used))
    conn.commit()
    conn.close()

def get_latest_ai_analysis(analysis_type: str, target_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if target_id:
        cursor.execute("""
        SELECT * FROM ai_analyses 
        WHERE analysis_type = ? AND target_id = ?
        ORDER BY created_at DESC LIMIT 1
        """, (analysis_type, target_id))
    else:
        cursor.execute("""
        SELECT * FROM ai_analyses 
        WHERE analysis_type = ?
        ORDER BY created_at DESC LIMIT 1
        """, (analysis_type,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def upsert_activity(act: Dict[str, Any], athlete_id: Optional[str] = None) -> bool:
    """Inserts or updates an activity. Returns True if inserted, False if updated."""
    conn = get_connection()
    cursor = conn.cursor()
    
    strava_id = str(act.get("strava_id") or act.get("id") or "")
    if not strava_id:
        # Generate an id based on start_date and distance
        strava_id = f"local_{act.get('start_date', '')}_{act.get('distance', 0)}"

    name = act.get("name") or "Corrida"
    act_type = act.get("type") or "Run"
    distance = float(act.get("distance", 0.0))
    moving_time = int(act.get("moving_time", 0))
    elapsed_time = int(act.get("elapsed_time", moving_time))
    total_elevation_gain = float(act.get("total_elevation_gain", 0.0) or 0.0)
    start_date = str(act.get("start_date") or "")
    start_date_local = str(act.get("start_date_local") or start_date)
    average_speed = float(act.get("average_speed", 0.0) or 0.0)
    max_speed = float(act.get("max_speed", 0.0) or 0.0)
    average_cadence = float(act["average_cadence"]) if act.get("average_cadence") is not None else None
    average_heartrate = float(act["average_heartrate"]) if act.get("average_heartrate") is not None else None
    max_heartrate = float(act["max_heartrate"]) if act.get("max_heartrate") is not None else None
    suffer_score = float(act["suffer_score"]) if act.get("suffer_score") is not None else None
    source = act.get("source", "strava_api")
    raw_data = json.dumps(act.get("raw_data") or {}) if isinstance(act.get("raw_data"), dict) else None

    # Determine athlete_id
    act_athlete_id = None
    if athlete_id:
        act_athlete_id = str(athlete_id)
    elif act.get("athlete_id"):
        act_athlete_id = str(act.get("athlete_id"))
    elif isinstance(act.get("athlete"), dict) and act.get("athlete", {}).get("id"):
        act_athlete_id = str(act["athlete"]["id"])
    elif source == "sample":
        act_athlete_id = "sample"

    # Handle strava cadence: Strava returns SPM for runs, or revs for cycling. For runs it is usually SPM (steps per min)
    # If cadence is reported as 80-95 (steps per leg), double it to 160-190 spm
    if average_cadence is not None and 60 <= average_cadence <= 110:
        average_cadence = average_cadence * 2

    cursor.execute("""
    INSERT INTO activities (
        strava_id, athlete_id, name, type, distance, moving_time, elapsed_time,
        total_elevation_gain, start_date, start_date_local, average_speed, max_speed,
        average_cadence, average_heartrate, max_heartrate, suffer_score, source, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(strava_id) DO UPDATE SET
        athlete_id = COALESCE(excluded.athlete_id, activities.athlete_id),
        name = excluded.name,
        type = excluded.type,
        distance = excluded.distance,
        moving_time = excluded.moving_time,
        elapsed_time = excluded.elapsed_time,
        total_elevation_gain = excluded.total_elevation_gain,
        start_date = excluded.start_date,
        start_date_local = excluded.start_date_local,
        average_speed = excluded.average_speed,
        max_speed = excluded.max_speed,
        average_cadence = excluded.average_cadence,
        average_heartrate = excluded.average_heartrate,
        max_heartrate = excluded.max_heartrate,
        suffer_score = excluded.suffer_score,
        source = excluded.source,
        raw_data = excluded.raw_data
    """, (
        strava_id, act_athlete_id, name, act_type, distance, moving_time, elapsed_time,
        total_elevation_gain, start_date, start_date_local, average_speed, max_speed,
        average_cadence, average_heartrate, max_heartrate, suffer_score, source, raw_data
    ))
    conn.commit()
    conn.close()
    return True

def get_activities(limit: Optional[int] = None, act_type: Optional[str] = None, athlete_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    where_parts = []
    params = []

    if athlete_id and athlete_id != "sample":
        where_parts.append("(athlete_id = ? OR (athlete_id IS NULL AND source != 'sample'))")
        params.append(str(athlete_id))
    else:
        # Unauthenticated / anonymous visitor: show sample activities only
        where_parts.append("(source = 'sample' OR athlete_id = 'sample')")

    if act_type:
        where_parts.append("type LIKE ?")
        params.append(f"%{act_type}%")

    query = f"SELECT * FROM activities WHERE {' AND '.join(where_parts)} ORDER BY start_date DESC"
    if limit and limit > 0:
        query += f" LIMIT {int(limit)}"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Fallback to sample data if athlete has no synced activities yet
    if not rows and athlete_id and athlete_id != "sample":
        fallback_query = "SELECT * FROM activities WHERE source = 'sample'"
        fallback_params = []
        if act_type:
            fallback_query += " AND type LIKE ?"
            fallback_params.append(f"%{act_type}%")
        fallback_query += " ORDER BY start_date DESC"
        if limit and limit > 0:
            fallback_query += f" LIMIT {int(limit)}"
        cursor.execute(fallback_query, fallback_params)
        rows = cursor.fetchall()

    conn.close()
    
    result = []
    for r in rows:
        item = dict(r)
        poly = None
        if item.get("raw_data"):
            try:
                rd = json.loads(item["raw_data"])
                poly = rd.get("map", {}).get("summary_polyline")
            except Exception:
                pass
        item["summary_polyline"] = poly
        result.append(item)
    return result

def clear_all_activities(athlete_id: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    if athlete_id and athlete_id != "sample":
        cursor.execute("DELETE FROM activities WHERE athlete_id = ?", (str(athlete_id),))
    else:
        cursor.execute("DELETE FROM activities")
    conn.commit()
    conn.close()

def clear_sample_activities():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM activities WHERE source = 'sample'")
    conn.commit()
    conn.close()
