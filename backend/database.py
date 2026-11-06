"""
SQLite Database Layer for Public Infrastructure Complaints
Handles persistence, status updates, de-duplication merging, and activity logs.
"""

import sqlite3
import os
import json
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "complaints.db")


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        department TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        address TEXT NOT NULL,
        zone_type TEXT NOT NULL,
        image_url TEXT,
        after_image_url TEXT,
        severity_score REAL DEFAULT 5.0,
        urgency_score REAL DEFAULT 5.0,
        priority_score INTEGER DEFAULT 50,
        priority_tier TEXT DEFAULT 'MEDIUM',
        sla_hours INTEGER DEFAULT 48,
        status TEXT DEFAULT 'SUBMITTED',  -- SUBMITTED, ASSIGNED, IN_PROGRESS, RESOLVED
        report_count INTEGER DEFAULT 1,
        citizen_name TEXT DEFAULT 'Anonymous Citizen',
        citizen_phone TEXT DEFAULT '+91-98XXXXX01',
        weather_condition TEXT DEFAULT 'Clear Skies / Normal',
        ai_verification_notes TEXT,
        streetview_image_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    );
    """)

    conn.commit()
    conn.close()


def add_complaint(data: dict) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    INSERT INTO complaints (
        ticket_code, title, description, category, department,
        lat, lng, address, zone_type, image_url, after_image_url,
        severity_score, urgency_score, priority_score, priority_tier,
        sla_hours, status, report_count, citizen_name, citizen_phone,
        weather_condition, created_at, updated_at, streetview_image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["ticket_code"], data["title"], data["description"], data["category"], data["department"],
        data["lat"], data["lng"], data["address"], data["zone_type"], data.get("image_url", ""),
        data.get("after_image_url", ""), data["severity_score"], data["urgency_score"],
        data["priority_score"], data["priority_tier"], data["sla_hours"],
        data.get("status", "SUBMITTED"), data.get("report_count", 1),
        data.get("citizen_name", "Citizen"), data.get("citizen_phone", "+91-9876543210"),
        data.get("weather_condition", "Clear Skies / Normal"), now, now,
        data.get("streetview_image_url", data.get("image_url", ""))
    ))

    complaint_id = cursor.lastrowid

    # Add initial activity log
    cursor.execute("""
    INSERT INTO activity_logs (complaint_id, action, details, timestamp)
    VALUES (?, ?, ?, ?)
    """, (complaint_id, "TICKET_CREATED", f"Triage Priority: {data['priority_tier']} ({data['priority_score']}/100) -> Routed to {data['department']}", now))

    conn.commit()
    conn.close()
    return complaint_id


def upvote_complaint(complaint_id: int, new_priority_score: int, new_tier: str, new_sla: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    UPDATE complaints
    SET report_count = report_count + 1,
        priority_score = ?,
        priority_tier = ?,
        sla_hours = ?,
        updated_at = ?
    WHERE id = ?
    """, (new_priority_score, new_tier, new_sla, now, complaint_id))

    cursor.execute("""
    INSERT INTO activity_logs (complaint_id, action, details, timestamp)
    VALUES (?, ?, ?, ?)
    """, (complaint_id, "CITIZEN_MERGE_UPVOTE", f"Duplicate report merged. Priority escalated to {new_priority_score} ({new_tier}).", now))

    conn.commit()
    conn.close()


def update_complaint_status(complaint_id: int, status: str, details: str = "", after_image: str = None, ai_notes: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if status == "RESOLVED":
        cursor.execute("""
        UPDATE complaints
        SET status = ?, after_image_url = COALESCE(?, after_image_url),
            ai_verification_notes = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
        """, (status, after_image, ai_notes, now, now, complaint_id))
    else:
        cursor.execute("""
        UPDATE complaints
        SET status = ?, updated_at = ?
        WHERE id = ?
        """, (status, now, complaint_id))

    cursor.execute("""
    INSERT INTO activity_logs (complaint_id, action, details, timestamp)
    VALUES (?, ?, ?, ?)
    """, (complaint_id, f"STATUS_{status}", details or f"Status changed to {status}", now))

    conn.commit()
    conn.close()


def get_all_complaints(department: str = None, status: str = None, tier: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if department and department != "ALL":
        query += " AND department = ?"
        params.append(department)
    if status and status != "ALL":
        query += " AND status = ?"
        params.append(status)
    if tier and tier != "ALL":
        query += " AND priority_tier = ?"
        params.append(tier)

    # Sort by priority score descending
    query += " ORDER BY priority_score DESC, created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    complaints = [dict(row) for row in rows]
    conn.close()
    return complaints


def get_complaint_by_id(complaint_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    complaint = dict(row)
    cursor.execute("SELECT * FROM activity_logs WHERE complaint_id = ? ORDER BY timestamp DESC", (complaint_id,))
    logs = [dict(log) for log in cursor.fetchall()]
    complaint["activity_logs"] = logs
    conn.close()
    return complaint


def get_system_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM complaints")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE priority_tier = 'CRITICAL'")
    critical = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'RESOLVED'")
    resolved = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(report_count - 1) FROM complaints")
    duplicates_prevented = cursor.fetchone()[0] or 0

    # Department breakdown
    cursor.execute("""
    SELECT department, COUNT(*) as count,
           SUM(CASE WHEN priority_tier = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count
    FROM complaints
    GROUP BY department
    """)
    dept_breakdown = [dict(r) for r in cursor.fetchall()]

    # Priority distribution
    cursor.execute("SELECT priority_tier, COUNT(*) as count FROM complaints GROUP BY priority_tier")
    tier_counts = {r["priority_tier"]: r["count"] for r in cursor.fetchall()}

    conn.close()

    return {
        "total_complaints": total,
        "critical_issues": critical,
        "resolved_issues": resolved,
        "active_issues": total - resolved,
        "duplicates_prevented": duplicates_prevented,
        "department_breakdown": dept_breakdown,
        "tier_distribution": {
            "CRITICAL": tier_counts.get("CRITICAL", 0),
            "HIGH": tier_counts.get("HIGH", 0),
            "MEDIUM": tier_counts.get("MEDIUM", 0),
            "LOW": tier_counts.get("LOW", 0)
        }
    }
