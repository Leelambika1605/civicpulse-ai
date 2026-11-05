"""
Seed data generator with realistic Smart City Bengaluru complaints and synthetic images.
"""

import os
from PIL import Image, ImageDraw, ImageFont
from database import init_db, add_complaint, get_db_connection

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")


def create_sample_image(filename: str, title: str, bg_color: tuple, text_color: tuple, is_repaired: bool = False):
    """Generates clean SVG/PNG visual demo cards for complaints and resolutions."""
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    img_path = os.path.join(UPLOADS_DIR, filename)

    if os.path.exists(img_path):
        return f"/uploads/{filename}"

    w, h = 600, 400
    img = Image.new("RGB", (w, h), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Draw border & grid aesthetic
    draw.rectangle([10, 10, w - 10, h - 10], outline=(70, 80, 95), width=2)

    # Draw symbolic shapes
    if "pothole" in filename or "road" in filename:
        # Asphalt road background
        draw.rectangle([40, 160, 560, 360], fill=(45, 52, 60))
        # Road lane lines
        for x in range(60, 540, 80):
            draw.rectangle([x, 255, x + 40, 265], fill=(240, 200, 50))
        if not is_repaired:
            # Jagged pothole crater
            draw.ellipse([220, 220, 380, 310], fill=(20, 20, 25), outline=(180, 50, 50), width=4)
            draw.ellipse([250, 240, 350, 290], fill=(10, 10, 15))
        else:
            # Fresh asphalt patch
            draw.rectangle([210, 210, 390, 320], fill=(30, 35, 40), outline=(50, 200, 100), width=3)
            draw.text((245, 255), "[ REPAIRED ]", fill=(50, 255, 120))

    elif "electric" in filename or "wire" in filename or "pole" in filename:
        # Pole & wire visual
        draw.line([(150, 80), (150, 370)], fill=(120, 130, 140), width=10)
        draw.line([(100, 120), (200, 120)], fill=(120, 130, 140), width=6)
        if not is_repaired:
            # Dangling sparking live wire
            draw.line([(180, 120), (320, 280), (450, 320)], fill=(255, 180, 0), width=4)
            # Sparks
            draw.text((450, 305), "⚡ SPARKING ⚡", fill=(255, 60, 60))
        else:
            draw.line([(180, 120), (550, 120)], fill=(100, 180, 255), width=4)
            draw.text((260, 200), "[ SECURED & RESTORED ]", fill=(50, 255, 120))

    elif "water" in filename or "leak" in filename:
        # Water pipe burst
        draw.rectangle([60, 240, 540, 300], fill=(100, 110, 120))
        if not is_repaired:
            # Water spray / pool
            draw.ellipse([240, 170, 360, 270], fill=(50, 150, 255, 180), outline=(100, 200, 255), width=3)
            draw.text((230, 200), "🌊 PIPE BURST", fill=(255, 255, 255))
        else:
            draw.rectangle([250, 235, 350, 305], fill=(70, 80, 90), outline=(50, 255, 120), width=3)
            draw.text((255, 260), "[ REPLACED ]", fill=(50, 255, 120))
    else:
        # Generic municipal issue / garbage
        draw.rectangle([100, 180, 500, 350], fill=(80, 70, 60))
        if not is_repaired:
            draw.text((220, 240), "⚠ INFRA DEFECT", fill=(255, 100, 100))
        else:
            draw.text((240, 240), "✔ SITE CLEANED", fill=(50, 255, 120))

    # Header label
    draw.text((30, 30), title.upper(), fill=text_color)
    status_label = "STATUS: RESOLVED & VERIFIED" if is_repaired else "STATUS: ACTIVE HAZARD"
    status_col = (50, 255, 120) if is_repaired else (255, 100, 100)
    draw.text((30, 65), status_label, fill=status_col)

    img.save(img_path)
    return f"/uploads/{filename}"


SAMPLE_COMPLAINTS = [
    {
        "ticket_code": "CP-BLR-8012",
        "title": "Severe Crater Pothole blocking Ambulance Entrance",
        "description": "Massive deep pothole right in front of Victoria Hospital emergency gate. Ambulance vehicles are jolting dangerously and patient transport is delayed.",
        "category": "Pothole",
        "department": "Roads & PWD",
        "lat": 12.9634,
        "lng": 77.5755,
        "address": "Opposite Victoria Hospital Emergency Gate, Kalasipalya, Bengaluru",
        "zone_type": "Hospital Zone",
        "image_file": "pothole_hospital.png",
        "after_image_file": "pothole_hospital_repaired.png",
        "severity_score": 9.4,
        "urgency_score": 9.8,
        "priority_score": 96,
        "priority_tier": "CRITICAL",
        "sla_hours": 6,
        "status": "ASSIGNED",
        "report_count": 8,
        "citizen_name": "Dr. Rajesh K.",
        "weather_condition": "Moderate Rain"
    },
    {
        "ticket_code": "CP-BLR-8013",
        "title": "Live Wire Dangling from Broken Pole near Primary School",
        "description": "High tension electric pole hit by a truck last night. Electric wire is dangling at child height right outside St. Joseph School entrance. Continuous sparking noticed.",
        "category": "Streetlight & Electric Wire",
        "department": "Electricity Board (BESCOM)",
        "lat": 12.9719,
        "lng": 77.5996,
        "address": "Near St. Joseph High School Gate, Residency Road, Bengaluru",
        "zone_type": "School / College Zone",
        "image_file": "electric_pole_school.png",
        "after_image_file": "electric_pole_repaired.png",
        "severity_score": 9.6,
        "urgency_score": 9.7,
        "priority_score": 95,
        "priority_tier": "CRITICAL",
        "sla_hours": 6,
        "status": "IN_PROGRESS",
        "report_count": 5,
        "citizen_name": "Sunita Rao",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8014",
        "title": "Main Water Supply Pipeline Burst Gushing onto Ring Road",
        "description": "BWSSB 18-inch drinking water pipe fractured under the pavement. Fresh water gushing at high pressure, flooding two lanes of the arterial ring road near Sony World junction.",
        "category": "Water Pipeline Leak",
        "department": "Water Supply & Sewerage Board (BWSSB)",
        "lat": 12.9352,
        "lng": 77.6245,
        "address": "100 Feet Road, Near Sony World Junction, Koramangala 4th Block, Bengaluru",
        "zone_type": "Major Arterial Road / Highway",
        "image_file": "water_leak_koramangala.png",
        "after_image_file": "water_leak_repaired.png",
        "severity_score": 8.5,
        "urgency_score": 8.0,
        "priority_score": 84,
        "priority_tier": "CRITICAL",
        "sla_hours": 6,
        "status": "IN_PROGRESS",
        "report_count": 4,
        "citizen_name": "Arun Kumar",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8015",
        "title": "Open Uncovered Drainage Manhole on Pavement",
        "description": "Heavy cement manhole lid stolen or broken. 8-foot deep pit is completely open on the footpath. High pedestrian density in the evening near metro station.",
        "category": "Open Manhole",
        "department": "Water Supply & Sewerage Board (BWSSB)",
        "lat": 12.9754,
        "lng": 77.6066,
        "address": "Near MG Road Metro Station Gate 2, Bengaluru",
        "zone_type": "Metro / Transit Interchange",
        "image_file": "manhole_metro.png",
        "after_image_file": "manhole_repaired.png",
        "severity_score": 8.9,
        "urgency_score": 8.5,
        "priority_score": 82,
        "priority_tier": "CRITICAL",
        "sla_hours": 6,
        "status": "SUBMITTED",
        "report_count": 6,
        "citizen_name": "Pooja Hegde",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8016",
        "title": "Road Cave-in and Asphalt Cracks after Cable Trenching",
        "description": "Contractor dug up side of the road for optical fiber laying and filled it with loose mud. Road has caved in by 10 inches causing two-wheelers to skid.",
        "category": "Road Defect",
        "department": "Roads & PWD",
        "lat": 12.9784,
        "lng": 77.6408,
        "address": "12th Main, 100ft Road Intersection, Indiranagar, Bengaluru",
        "zone_type": "Commercial Market Area",
        "image_file": "road_indiranagar.png",
        "after_image_file": "road_indiranagar_repaired.png",
        "severity_score": 7.2,
        "urgency_score": 6.0,
        "priority_score": 71,
        "priority_tier": "HIGH",
        "sla_hours": 24,
        "status": "ASSIGNED",
        "report_count": 3,
        "citizen_name": "Deepak Sharma",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8017",
        "title": "Five Consecutive Streetlights Defunct on Tech Corridor",
        "description": "Stretch of 200 meters completely dark for three consecutive nights. Women employees returning from IT tech park shifts feeling unsafe.",
        "category": "Streetlight",
        "department": "Electricity Board (BESCOM)",
        "lat": 12.9856,
        "lng": 77.7289,
        "address": "ITPL Main Road, Near Pattandur Agrahara, Whitefield, Bengaluru",
        "zone_type": "Major Arterial Road / Highway",
        "image_file": "streetlight_whitefield.png",
        "after_image_file": "streetlight_repaired.png",
        "severity_score": 6.8,
        "urgency_score": 7.0,
        "priority_score": 68,
        "priority_tier": "HIGH",
        "sla_hours": 24,
        "status": "RESOLVED",
        "report_count": 4,
        "citizen_name": "Kavita Nair",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8018",
        "title": "Massive Garbage Blackspot Overflowing onto Pedestrian Walkway",
        "description": "Uncollected commercial food waste and plastic debris dumped on the street corner for 5 days. Foul stench and stray dog menace.",
        "category": "Garbage Dump",
        "department": "Solid Waste Management (BBMP)",
        "lat": 12.9250,
        "lng": 77.5838,
        "address": "9th Main, 4th Block, Jayanagar, Bengaluru",
        "zone_type": "Dense Residential Colony",
        "image_file": "garbage_jayanagar.png",
        "after_image_file": "garbage_repaired.png",
        "severity_score": 6.0,
        "urgency_score": 4.5,
        "priority_score": 54,
        "priority_tier": "MEDIUM",
        "sla_hours": 48,
        "status": "RESOLVED",
        "report_count": 2,
        "citizen_name": "Venkatesh Babu",
        "weather_condition": "Clear Skies / Normal"
    },
    {
        "ticket_code": "CP-BLR-8019",
        "title": "Minor Road Surface Wear and Gravel Spillage",
        "description": "Top layer of asphalt worn off exposing gravel near residential apartment cul-de-sac. No traffic disruption, but noisy.",
        "category": "Road Defect",
        "department": "Roads & PWD",
        "lat": 13.0358,
        "lng": 77.5970,
        "address": "Bellary Road Service Lane, Near Hebbal Lake, Bengaluru",
        "zone_type": "Suburban / Low Density",
        "image_file": "minor_gravel.png",
        "after_image_file": "minor_gravel_repaired.png",
        "severity_score": 3.8,
        "urgency_score": 2.5,
        "priority_score": 34,
        "priority_tier": "LOW",
        "sla_hours": 168,
        "status": "SUBMITTED",
        "report_count": 1,
        "citizen_name": "Manjunath S.",
        "weather_condition": "Clear Skies / Normal"
    }
]


def seed_database():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM complaints")
    count = cursor.fetchone()[0]
    conn.close()

    if count > 0:
        print(f"Database already contains {count} complaints. Skipping seed.")
        return

    print("Generating demo images and seeding complaints...")
    for item in SAMPLE_COMPLAINTS:
        # Create defect image
        img_url = create_sample_image(
            item["image_file"],
            item["title"][:28],
            bg_color=(35, 40, 50),
            text_color=(240, 240, 250),
            is_repaired=False
        )
        
        # Create repaired image
        after_url = create_sample_image(
            item["after_image_file"],
            f"Repaired: {item['title'][:20]}",
            bg_color=(25, 45, 35),
            text_color=(180, 255, 200),
            is_repaired=True
        )

        item["image_url"] = img_url
        item["after_image_url"] = after_url
        add_complaint(item)

    print(f"Successfully seeded {len(SAMPLE_COMPLAINTS)} complaints!")


if __name__ == "__main__":
    seed_database()
