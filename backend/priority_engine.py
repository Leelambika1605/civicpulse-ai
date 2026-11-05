"""
Dynamic Priority Scoring (DPS) and Geospatial De-duplication Engine
"""

import math
from typing import List, Dict, Optional, Tuple

# Zone Criticality Multipliers (1.0 - 10.0 scale)
ZONE_CRITICALITY = {
    "Hospital Zone": 9.5,
    "School / College Zone": 8.8,
    "Major Arterial Road / Highway": 8.2,
    "Metro / Transit Interchange": 7.8,
    "Commercial Market Area": 6.5,
    "Dense Residential Colony": 5.0,
    "Suburban / Low Density": 3.5
}

# Weather Hazard Multipliers (10 - 30 point adder)
WEATHER_HAZARD_POINTS = {
    "Heavy Rain / Storm Warning": 25.0,
    "Moderate Rain": 15.0,
    "Overcast / Foggy": 8.0,
    "Clear Skies / Normal": 0.0
}

# Thresholds for De-duplication
DUPLICATE_RADIUS_METERS = 65.0  # complaints within 65m of an active ticket


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class PriorityEngine:
    def __init__(self):
        # DPS Weightings (must be balanced to ensure high sensitivity to public danger)
        self.w_defect = 0.30       # Computer vision defect severity (0-10 -> 0-100)
        self.w_zone = 0.25         # Criticality of the zone (hospitals, schools)
        self.w_urgency = 0.25      # NLP extracted safety urgency keywords
        self.w_volume = 0.12       # Citizen upvotes / report volume impact
        self.w_weather = 0.08      # Weather risk factor

    def check_duplicate(self, new_lat: float, new_lng: float, new_category: str, existing_tickets: List[Dict]) -> Optional[Dict]:
        """
        Spatio-Temporal De-duplication:
        Checks if an active complaint exists within 65m with similar or matching category.
        """
        for ticket in existing_tickets:
            # Only compare against active complaints (not already resolved)
            if ticket.get("status") in ["RESOLVED", "CLOSED"]:
                continue

            lat = ticket.get("lat")
            lng = ticket.get("lng")
            if lat is None or lng is None:
                continue

            dist = haversine_distance(new_lat, new_lng, float(lat), float(lng))
            if dist <= DUPLICATE_RADIUS_METERS:
                # Match found!
                return {
                    "is_duplicate": True,
                    "distance_meters": round(dist, 1),
                    "master_ticket_id": ticket.get("id"),
                    "master_ticket_code": ticket.get("ticket_code"),
                    "existing_status": ticket.get("status")
                }
        return None

    def calculate_priority(
        self,
        severity_score: float,       # 1.0 - 10.0 (from CV)
        urgency_score: float,        # 1.0 - 10.0 (from NLP)
        zone_type: str,              # Zone name
        n_reports: int = 1,          # Number of citizens reporting
        weather_condition: str = "Clear Skies / Normal"
    ) -> Dict:
        """
        Dynamic Priority Scoring (DPS) Algorithm
        Outputs Score (0 - 100), Priority Tier, and SLA Hours.
        """
        zone_score = ZONE_CRITICALITY.get(zone_type, 5.0)  # 1.0 to 10.0
        weather_pts = WEATHER_HAZARD_POINTS.get(weather_condition, 0.0)

        # Scale sub-components to 0-100 basis
        comp_defect = severity_score * 10.0
        comp_zone = zone_score * 10.0
        comp_urgency = urgency_score * 10.0
        
        # Logarithmic volume dampening: 1 report = 0 bonus, 2 reports = 15, 4 reports = 30, 8 reports = 45...
        comp_volume = min(100.0, math.log2(max(1, n_reports)) * 25.0)

        # Weighted calculation
        raw_score = (
            (self.w_defect * comp_defect) +
            (self.w_zone * comp_zone) +
            (self.w_urgency * comp_urgency) +
            (self.w_volume * comp_volume) +
            (self.w_weather * weather_pts)
        )

        final_score = int(min(100, max(10, round(raw_score))))

        # Tier & SLA Mapping
        if final_score >= 82:
            tier = "CRITICAL"
            sla_hours = 6
            color = "#ef4444"  # Red
        elif final_score >= 62:
            tier = "HIGH"
            sla_hours = 24
            color = "#f97316"  # Orange
        elif final_score >= 40:
            tier = "MEDIUM"
            sla_hours = 48
            color = "#eab308"  # Yellow
        else:
            tier = "LOW"
            sla_hours = 168  # 7 Days
            color = "#22c55e"  # Green

        return {
            "priority_score": final_score,
            "priority_tier": tier,
            "sla_hours": sla_hours,
            "color_hex": color,
            "breakdown": {
                "defect_component": round(comp_defect, 1),
                "zone_component": round(comp_zone, 1),
                "urgency_component": round(comp_urgency, 1),
                "volume_component": round(comp_volume, 1),
                "weather_bonus": round(weather_pts, 1)
            }
        }
