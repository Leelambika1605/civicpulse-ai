# CivicPulse AI
## Public Infrastructure Complaint Analysis and Priority Management System
**TechXcellence Hackathon — Smart Cities (Track T1, Problem Statement #4)**

CivicPulse AI is an end-to-end intelligent triage and dynamic priority management platform designed for municipal corporations (e.g., BBMP, PWD, BWSSB, BESCOM). It bridges the gap between chaotic, unstructured citizen grievance reports and rapid, prioritized municipal action.

---

## 🌟 Key Technical Innovations

1. **Multi-Modal AI Intake (CV + NLP):**
   - **Computer Vision (OpenCV & PIL):** Analyzes uploaded defect photos, evaluates surface roughness, contour area, and dark void ratios to compute a **Defect Severity Score ($S_{\text{defect}} \in [1, 10]$)**.
   - **NLP Urgency Engine:** Scans descriptions for critical safety hazards (`"hospital"`, `"ambulance"`, `"school"`, `"live wire"`, `"sparking"`, `"burst"`, `"open manhole"`) and calculates an Urgency Score ($A_{\text{urgency}}$).

2. **Spatio-Temporal De-duplication (Smart Merging):**
   - Using the **Haversine Great-Circle Formula**, queries active complaints within a **$65\text{-meter}$ radius**.
   - If an active issue is found, it automatically **merges the new report into the Master Ticket**, prevents municipal ticketing clutter, and increments citizen impact count ($N_{\text{reports}} \leftarrow N + 1$).

3. **Dynamic Priority Scoring (DPS) Algorithm:**
   Tickets are triaged using a multi-factor risk formula:
   $$\text{Score} = \min\left(100, \, w_1 \cdot (S_{\text{defect}} \times 10) + w_2 \cdot (Z_{\text{zone}} \times 10) + w_3 \cdot (\log_2(1 + N_{\text{reports}}) \times 25) + w_4 \cdot H_{\text{weather}} + w_5 \cdot (A_{\text{urgency}} \times 10)\right)$$

   | Score Range | Priority Tier | Standard SLA | Automated Routing |
   | :--- | :--- | :--- | :--- |
   | **82 – 100** | 🔴 **CRITICAL** | &lt; 6 Hours | Immediate Field Dispatch |
   | **62 – 81** | 🟠 **HIGH** | &lt; 24 Hours | High Priority Daily Roster |
   | **40 – 61** | 🟡 **MEDIUM** | &lt; 48 Hours | Standard Queue |
   | **0 – 39** | 🟢 **LOW** | &lt; 7 Days | Routine Maintenance |

4. **Automated Department Routing:**
   - Roads & Potholes ➔ **Roads & PWD**
   - Burst Pipes & Open Manholes ➔ **Water Supply & Sewerage Board (BWSSB)**
   - Dangling Wires & Defunct Streetlights ➔ **Electricity Board (BESCOM)**
   - Garbage Dumps & Stench ➔ **Solid Waste Management (BBMP)**

5. **Before-After AI Resolution Verification:**
   - Field crews upload an "After Repair" photo.
   - The AI Visual Audit engine compares edge contour reduction and texture uniformity before marking the ticket as `RESOLVED`.

---

## 🏛️ System Architecture

```
[ Citizen Web Portal ]               [ Municipal Command Center ]
         │                                        │
         ▼                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python REST Server (app.py)                 │
├──────────────────────────────┬──────────────────────────────┤
│ • ai_engine.py               │ • priority_engine.py         │
│   (CV Defect + NLP Urgency)  │   (DPS + Haversine 65m Dup)  │
├──────────────────────────────┴──────────────────────────────┤
│ • database.py (SQLite DB + Audit Logs + SLA Tracker)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+ (Standard Library + OpenCV & Pillow already installed)
- Modern web browser (Chrome, Edge, Firefox)

### Running the System
Open PowerShell or your command prompt:

```powershell
# Navigate to project folder
cd C:\Users\prade\.gemini\antigravity\scratch\infra-complaint-system

# Run server
python run.py
```

Open your browser to:
👉 **`http://localhost:8000`**

---

## 🎯 Hackathon Presentation Demo Flow

1. **Demonstrate Citizen Filing:**
   - Click one of the quick test buttons (e.g. *Pothole near Hospital* or *Live Wire near School*).
   - Show how the **NLP Urgency Scanner** highlights keywords in real-time.
   - Click **Submit Complaint**.
   - Show the AI triage result: Computed score (96/100), Critical Tier, and auto-routed department.

2. **Demonstrate Spatio-Temporal De-Duplication (The "Wow" Factor):**
   - Click the same test button again (or submit an issue at the same landmark).
   - Watch the system trigger: **"Spatio-Temporal De-Duplication Triggered! Merged with Master Ticket #CP-BLR-xxxx 0m away. Report count increased to 9!"**
   - Explain to judges how this eliminates redundant tickets for municipal workers.

3. **Demonstrate Command Center & GIS Map:**
   - Switch to **Command Center & GIS** tab.
   - Show the interactive Leaflet map with pulsing red markers and dashed 65m de-duplication buffer zones.
   - Filter by Department (Roads, Water, Electricity) or Priority Tier.
   - Click **Dispatch Crew** on any critical ticket.

4. **Demonstrate AI Resolution Verification:**
   - Click **Verify & Close** on an active ticket.
   - View the "Before" vs "After" repair photo comparison.
   - Click **Run AI Visual Audit & Close Ticket** to see OpenCV calculate contour reduction and confirm resolution with proof.
