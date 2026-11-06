"""
Full-Featured Multi-Threaded HTTP REST Server for Smart City Infrastructure System
Zero external pip dependencies: built on Python 3.11 standard library + OpenCV/PIL.
"""

import os
import sys
import json
import uuid
import base64
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from datetime import datetime

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import (
    init_db, add_complaint, get_all_complaints, get_complaint_by_id,
    upvote_complaint, update_complaint_status, get_system_stats
)
from ai_engine import InfrastructureAIEngine
from priority_engine import PriorityEngine

ai_engine = InfrastructureAIEngine()
priority_engine = PriorityEngine()


class SmartCityRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _send_json(self, data, status_code=200):
        response_bytes = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route: API Complaints List
        if path == "/api/complaints":
            dept = query.get("department", ["ALL"])[0]
            status = query.get("status", ["ALL"])[0]
            tier = query.get("tier", ["ALL"])[0]
            complaints = get_all_complaints(dept, status, tier)
            self._send_json({"success": True, "data": complaints})
            return

        # Route: API Single Complaint Details
        elif path.startswith("/api/complaints/") and not path.endswith("/stats"):
            try:
                complaint_id = int(path.split("/")[-1])
                complaint = get_complaint_by_id(complaint_id)
                if complaint:
                    self._send_json({"success": True, "data": complaint})
                else:
                    self._send_json({"success": False, "error": "Complaint not found"}, 404)
            except ValueError:
                self._send_json({"success": False, "error": "Invalid complaint ID"}, 400)
            return

        # Route: API Analytics Stats
        elif path == "/api/stats":
            stats = get_system_stats()
            self._send_json({"success": True, "data": stats})
            return

        # Route: Fallback to static files
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Read POST body
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)

        try:
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except Exception:
            body = {}

        # -------------------------------------------------------------
        # 1. POST /api/complaints (Create new complaint / Auto-triage)
        # -------------------------------------------------------------
        if path == "/api/complaints":
            title = body.get("title", "").strip()
            description = body.get("description", "").strip()
            lat = float(body.get("lat", 12.9716))
            lng = float(body.get("lng", 77.5946))
            address = body.get("address", "Bengaluru, Karnataka")
            zone_type = body.get("zone_type", "Dense Residential Colony")
            weather = body.get("weather_condition", "Clear Skies / Normal")
            citizen_name = body.get("citizen_name", "Anonymous Citizen")
            citizen_phone = body.get("citizen_phone", "+91-9876543210")
            user_category = body.get("category", "").strip()
            image_data = body.get("image_base64")

            # Save uploaded image if provided
            image_url = "/uploads/pothole_hospital.png"  # fallback default
            local_image_path = os.path.join(UPLOADS_DIR, "pothole_hospital.png")

            if image_data and "," in image_data:
                try:
                    header, encoded = image_data.split(",", 1)
                    file_ext = "png"
                    if "jpeg" in header or "jpg" in header:
                        file_ext = "jpg"
                    filename = f"upload_{uuid.uuid4().hex[:10]}.{file_ext}"
                    local_image_path = os.path.join(UPLOADS_DIR, filename)
                    with open(local_image_path, "wb") as f:
                        f.write(base64.b64decode(encoded))
                    image_url = f"/uploads/{filename}"
                except Exception as e:
                    print("Error saving image:", e)

            # Step A: NLP Urgency & Department Extraction
            nlp_result = ai_engine.analyze_complaint_text(description + " " + title)
            urgency_score = nlp_result["urgency_score"]
            recommended_dept = nlp_result["recommended_department"]
            category = user_category if user_category and user_category != "Auto-Detect" else nlp_result["detected_category"]
            department = recommended_dept

            # Step B: Computer Vision Defect Severity Analysis & Diagnostic Map Generation
            cv_result = ai_engine.analyze_image_defect(local_image_path, category)
            severity_score = cv_result["severity_score"]
            ai_annotated_image_url = cv_result.get("ai_annotated_image_url", image_url)

            # Step C: Spatio-Temporal De-duplication Check
            existing_complaints = get_all_complaints()
            dup_info = priority_engine.check_duplicate(lat, lng, category, existing_complaints)

            if dup_info and dup_info["is_duplicate"]:
                # DUPLICATE DETECTED! Merge with existing master ticket
                master_id = dup_info["master_ticket_id"]
                master_ticket = get_complaint_by_id(master_id)
                new_report_count = master_ticket["report_count"] + 1

                # Recalculate Master Ticket Priority with increased report volume
                recomputed = priority_engine.calculate_priority(
                    severity_score=master_ticket["severity_score"],
                    urgency_score=max(urgency_score, master_ticket["urgency_score"]),
                    zone_type=master_ticket["zone_type"],
                    n_reports=new_report_count,
                    weather_condition=weather
                )

                upvote_complaint(
                    complaint_id=master_id,
                    new_priority_score=recomputed["priority_score"],
                    new_tier=recomputed["priority_tier"],
                    new_sla=recomputed["sla_hours"]
                )

                self._send_json({
                    "success": True,
                    "is_duplicate": True,
                    "message": f"Spatio-Temporal De-duplication triggered! Merged with Master Ticket #{dup_info['master_ticket_code']} located {dup_info['distance_meters']}m away.",
                    "master_ticket_id": master_id,
                    "master_ticket_code": dup_info["master_ticket_code"],
                    "distance_meters": dup_info["distance_meters"],
                    "updated_priority": recomputed["priority_score"],
                    "updated_tier": recomputed["priority_tier"],
                    "report_count": new_report_count,
                    "user_image_url": image_url,
                    "ai_annotated_image_url": ai_annotated_image_url,
                    "master_image_url": master_ticket.get("image_url")
                })
                return

            # Step D: New Unique Complaint -> Dynamic Priority Scoring
            priority_info = priority_engine.calculate_priority(
                severity_score=severity_score,
                urgency_score=urgency_score,
                zone_type=zone_type,
                n_reports=1,
                weather_condition=weather
            )

            ticket_code = f"CP-BLR-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
            if not title:
                title = f"{category} reported at {address.split(',')[0]}"

            new_record = {
                "ticket_code": ticket_code,
                "title": title,
                "description": description,
                "category": category,
                "department": department,
                "lat": lat,
                "lng": lng,
                "address": address,
                "zone_type": zone_type,
                "image_url": image_url,
                "severity_score": severity_score,
                "urgency_score": urgency_score,
                "priority_score": priority_info["priority_score"],
                "priority_tier": priority_info["priority_tier"],
                "sla_hours": priority_info["sla_hours"],
                "status": "SUBMITTED",
                "report_count": 1,
                "citizen_name": citizen_name,
                "citizen_phone": citizen_phone,
                "weather_condition": weather
            }

            complaint_id = add_complaint(new_record)
            created_ticket = get_complaint_by_id(complaint_id)

            self._send_json({
                "success": True,
                "is_duplicate": False,
                "message": "New master complaint registered and triaged by AI successfully.",
                "data": created_ticket,
                "user_image_url": image_url,
                "ai_annotated_image_url": ai_annotated_image_url,
                "ai_breakdown": {
                    "cv_severity": severity_score,
                    "nlp_urgency": urgency_score,
                    "matched_keywords": [k["keyword"] for k in nlp_result["matched_keywords"]],
                    "priority_tier": priority_info["priority_tier"],
                    "priority_score": priority_info["priority_score"],
                    "sla_hours": priority_info["sla_hours"]
                }
            })
            return

        # -------------------------------------------------------------
        # 2. POST /api/complaints/<id>/upvote (Citizen community support)
        # -------------------------------------------------------------
        elif path.startswith("/api/complaints/") and path.endswith("/upvote"):
            complaint_id = int(path.split("/")[-2])
            ticket = get_complaint_by_id(complaint_id)
            if not ticket:
                self._send_json({"success": False, "error": "Ticket not found"}, 404)
                return

            new_count = ticket["report_count"] + 1
            recomputed = priority_engine.calculate_priority(
                severity_score=ticket["severity_score"],
                urgency_score=ticket["urgency_score"],
                zone_type=ticket["zone_type"],
                n_reports=new_count,
                weather_condition=ticket["weather_condition"]
            )
            upvote_complaint(
                complaint_id=complaint_id,
                new_priority_score=recomputed["priority_score"],
                new_tier=recomputed["priority_tier"],
                new_sla=recomputed["sla_hours"]
            )
            self._send_json({
                "success": True,
                "report_count": new_count,
                "priority_score": recomputed["priority_score"],
                "priority_tier": recomputed["priority_tier"]
            })
            return

        # -------------------------------------------------------------
        # 3. POST /api/complaints/<id>/status (Update Workflow Status)
        # -------------------------------------------------------------
        elif path.startswith("/api/complaints/") and path.endswith("/status"):
            complaint_id = int(path.split("/")[-2])
            new_status = body.get("status", "IN_PROGRESS")
            details = body.get("details", "")
            update_complaint_status(complaint_id, new_status, details)
            self._send_json({"success": True, "status": new_status})
            return

        # -------------------------------------------------------------
        # 4. POST /api/complaints/<id>/verify-resolve (AI Resolution Verification)
        # -------------------------------------------------------------
        elif path.startswith("/api/complaints/") and path.endswith("/verify-resolve"):
            complaint_id = int(path.split("/")[-2])
            ticket = get_complaint_by_id(complaint_id)
            if not ticket:
                self._send_json({"success": False, "error": "Ticket not found"}, 404)
                return

            after_image_base64 = body.get("after_image_base64")
            after_filename = f"resolved_{uuid.uuid4().hex[:8]}.png"
            after_local_path = os.path.join(UPLOADS_DIR, after_filename)
            after_url = f"/uploads/{after_filename}"

            if after_image_base64 and "," in after_image_base64:
                try:
                    _, encoded = after_image_base64.split(",", 1)
                    with open(after_local_path, "wb") as f:
                        f.write(base64.b64decode(encoded))
                except Exception as e:
                    print("Error saving resolution photo:", e)
            else:
                # Fallback to generated repaired photo
                after_url = ticket.get("after_image_url") or "/uploads/pothole_hospital_repaired.png"
                after_local_path = os.path.join(STATIC_DIR, after_url.lstrip("/"))

            before_local_path = os.path.join(STATIC_DIR, (ticket.get("image_url") or "").lstrip("/"))

            # Run Computer Vision verification
            verify_res = ai_engine.verify_resolution_repair(before_local_path, after_local_path)

            if verify_res["verified"]:
                update_complaint_status(
                    complaint_id=complaint_id,
                    status="RESOLVED",
                    details="Resolution verified by AI Visual Audit.",
                    after_image=after_url,
                    ai_notes=f"AI Visual Audit Passed: Confidence {int(verify_res['confidence'] * 100)}%. {verify_res['notes']}"
                )
                self._send_json({
                    "success": True,
                    "verified": True,
                    "confidence": verify_res["confidence"],
                    "notes": verify_res["notes"],
                    "after_image_url": after_url
                })
            else:
                self._send_json({
                    "success": False,
                    "verified": False,
                    "error": "Defect still detected in resolution image. Repair must be re-inspected."
                })
            return

        self._send_json({"error": "Endpoint not found"}, 404)


def run_server(port=None):
    if port is None:
        port = int(os.environ.get("PORT", 8000))
    init_db()
    # Bind to 0.0.0.0 for cloud deployment compatibility (Render, Railway, Docker, AWS)
    server_address = ("0.0.0.0", port)
    httpd = ThreadingHTTPServer(server_address, SmartCityRequestHandler)
    print("=" * 70)
    print(f"CivicPulse AI - Public Infrastructure Triage System")
    print(f"Server listening on http://0.0.0.0:{port} (Local: http://localhost:{port})")
    print(f"City: Bengaluru Smart City Ops Center")
    print("=" * 70)
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8000))
    run_server(port)
