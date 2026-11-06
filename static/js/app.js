/**
 * CivicPulse AI - Core Frontend Controller (Bright Modern Theme)
 */

let allComplaints = [];
let currentSelectedImageBase64 = null;
let currentResolvingTicketId = null;

// Landmark coordinates & addresses
const LANDMARKS = {
  victoria: {
    name: "Victoria Hospital Emergency Gate, Kalasipalya, Bengaluru",
    lat: 12.9634,
    lng: 77.5755,
    zone: "Hospital Zone"
  },
  stjoseph: {
    name: "St. Joseph High School Gate, Residency Rd, Bengaluru",
    lat: 12.9719,
    lng: 77.5996,
    zone: "School / College Zone"
  },
  koramangala: {
    name: "Sony World Junction, Koramangala 100ft Rd, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    zone: "Major Arterial Road / Highway"
  },
  mgroad: {
    name: "MG Road Metro Station Gate 2, Bengaluru",
    lat: 12.9754,
    lng: 77.6066,
    zone: "Metro / Transit Interchange"
  },
  indiranagar: {
    name: "12th Main Intersection, 100ft Road, Indiranagar, Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
    zone: "Commercial Market Area"
  },
  whitefield: {
    name: "ITPL Main Road, Pattandur Agrahara, Whitefield, Bengaluru",
    lat: 12.9856,
    lng: 77.7289,
    zone: "Major Arterial Road / Highway"
  },
  jayanagar: {
    name: "4th Block Bus Stand, Jayanagar, Bengaluru",
    lat: 12.9250,
    lng: 77.5838,
    zone: "Dense Residential Colony"
  }
};

const SAMPLE_CASES = {
  pothole: {
    title: "Deep Pothole Right in front of Emergency Ambulance Bay",
    desc: "Huge pothole filled with rainwater right in front of the hospital emergency ramp. Ambulances are bouncing and slowing down severely.",
    landmark: "victoria",
    category: "Pothole",
    zone: "Hospital Zone",
    weather: "Moderate Rain"
  },
  wire: {
    title: "Sparking Live Electric Wire Hanging Near School Gate",
    desc: "Truck hit pole, electric live wire is dangling near primary school bus entrance. Sparking continuously, child hazard!",
    landmark: "stjoseph",
    category: "Streetlight & Electric Wire",
    zone: "School / College Zone",
    weather: "Clear Skies / Normal"
  },
  leak: {
    title: "18-inch High Pressure Drinking Water Pipe Burst on Arterial Road",
    desc: "Water gushing across two lanes of main road. High flooding, traffic halted, clean water wasting for 6 hours.",
    landmark: "koramangala",
    category: "Water Pipeline Leak",
    zone: "Major Arterial Road / Highway",
    weather: "Clear Skies / Normal"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadComplaints();
  loadStats();
  triggerLiveNLPPreview();
  if (window.lucide) lucide.createIcons();
});

// Tab Switcher
function switchTab(tab) {
  const citizenSec = document.getElementById("tab-citizen-content");
  const adminSec = document.getElementById("tab-admin-content");
  const analyticsSec = document.getElementById("tab-analytics-content");

  const btnCitizen = document.getElementById("nav-citizen");
  const btnAdmin = document.getElementById("nav-admin");
  const btnAnalytics = document.getElementById("nav-analytics");

  // Reset classes
  [btnCitizen, btnAdmin, btnAnalytics].forEach(btn => {
    btn.className = "px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all";
  });

  citizenSec.classList.add("hidden");
  adminSec.classList.add("hidden");
  analyticsSec.classList.add("hidden");

  if (tab === "citizen") {
    citizenSec.classList.remove("hidden");
    btnCitizen.className = "px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition-all shadow-md shadow-blue-500/20";
  } else if (tab === "admin") {
    adminSec.classList.remove("hidden");
    btnAdmin.className = "px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition-all shadow-md shadow-blue-500/20";
    setTimeout(() => {
      initMap();
      renderMapMarkers(allComplaints);
      cityMap.invalidateSize();
    }, 100);
  } else if (tab === "analytics") {
    analyticsSec.classList.remove("hidden");
    btnAnalytics.className = "px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition-all shadow-md shadow-blue-500/20";
    loadStats();
  }
}

// Landmark Preset Change
function handleLandmarkChange() {
  const val = document.getElementById("select-landmark").value;
  if (val && LANDMARKS[val]) {
    const data = LANDMARKS[val];
    document.getElementById("input-lat").value = data.lat;
    document.getElementById("input-lng").value = data.lng;
    document.getElementById("input-address").value = data.name;
    document.getElementById("select-zone").value = data.zone;
    updateDynamicCalculationPreview();
  }
}

// Quick Sample Case Loader
function loadSampleCase(key) {
  const c = SAMPLE_CASES[key];
  if (!c) return;

  document.getElementById("input-title").value = c.title;
  document.getElementById("input-description").value = c.desc;
  document.getElementById("select-landmark").value = c.landmark;
  document.getElementById("select-category").value = c.category;
  document.getElementById("select-zone").value = c.zone;
  document.getElementById("select-weather").value = c.weather;
  handleLandmarkChange();
  triggerLiveNLPPreview();
}

// Live NLP Keyword Scanner & Preview
function triggerLiveNLPPreview() {
  const desc = (document.getElementById("input-description")?.value || "") + " " + (document.getElementById("input-title")?.value || "");
  const descLower = desc.toLowerCase();

  const keywords = [
    { word: "hospital", weight: 4.8 }, { word: "ambulance", weight: 5.0 },
    { word: "school", weight: 3.8 }, { word: "live wire", weight: 4.9 },
    { word: "sparking", weight: 4.6 }, { word: "accident", weight: 4.5 },
    { word: "water gushing", weight: 3.7 }, { word: "pipe burst", weight: 3.8 },
    { word: "flooded", weight: 3.9 }, { word: "pothole", weight: 2.2 },
    { word: "open manhole", weight: 4.9 }, { word: "dark", weight: 2.5 }
  ];

  const matched = [];
  let urgency = 2.0;

  keywords.forEach(k => {
    if (descLower.includes(k.word)) {
      matched.push(k.word);
      urgency += k.weight;
    }
  });

  urgency = Math.min(10.0, Math.round(urgency * 10) / 10);

  // Render chips
  const chipsContainer = document.getElementById("nlp-chips");
  if (chipsContainer) {
    if (matched.length > 0) {
      chipsContainer.innerHTML = matched.map(m => 
        `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-sm">
          ⚡ ${m}
        </span>`
      ).join("");
    } else {
      chipsContainer.innerHTML = `<span class="text-[11px] text-slate-400 italic">Type description to trigger live NLP hazard extraction...</span>`;
    }
  }

  updateDynamicCalculationPreview(urgency);
}

// Real-Time Dynamic Priority Preview Formula
function updateDynamicCalculationPreview(extractedUrgency = null) {
  const zoneVal = document.getElementById("select-zone")?.value || "Hospital Zone";
  const weatherVal = document.getElementById("select-weather")?.value || "Clear Skies / Normal";

  const zoneMap = {
    "Hospital Zone": 9.5,
    "School / College Zone": 8.8,
    "Major Arterial Road / Highway": 8.2,
    "Metro / Transit Interchange": 7.8,
    "Commercial Market Area": 6.5,
    "Dense Residential Colony": 5.0,
    "Suburban / Low Density": 3.5
  };

  const weatherMap = {
    "Clear Skies / Normal": 0,
    "Moderate Rain": 15,
    "Heavy Rain / Storm Warning": 25,
    "Overcast / Foggy": 8
  };

  const zoneScore = zoneMap[zoneVal] || 5.0;
  const weatherPts = weatherMap[weatherVal] || 0;
  const urgency = extractedUrgency !== null ? extractedUrgency : 7.5;
  const cvSeverity = 8.5;

  const compDefect = cvSeverity * 10.0;
  const compZone = zoneScore * 10.0;
  const compUrgency = urgency * 10.0;
  const rawScore = (0.30 * compDefect) + (0.25 * compZone) + (0.25 * compUrgency) + (0.12 * 0) + (0.08 * weatherPts);
  const score = Math.min(100, Math.max(15, Math.round(rawScore)));

  const previewScore = document.getElementById("preview-score");
  const previewBadge = document.getElementById("preview-tier-badge");
  const barCvVal = document.getElementById("bar-cv-val");
  const barNlpVal = document.getElementById("bar-nlp-val");
  const barZoneVal = document.getElementById("bar-zone-val");
  const barCv = document.getElementById("bar-cv");
  const barNlp = document.getElementById("bar-nlp");
  const barZone = document.getElementById("bar-zone");
  const previewDept = document.getElementById("preview-dept");

  if (previewScore) previewScore.innerText = score;

  if (barCvVal) barCvVal.innerText = `${cvSeverity} / 10`;
  if (barNlpVal) barNlpVal.innerText = `${urgency} / 10`;
  if (barZoneVal) barZoneVal.innerText = `${zoneVal.split(" (")[0]} (${zoneScore})`;

  if (barCv) barCv.style.width = `${cvSeverity * 10}%`;
  if (barNlp) barNlp.style.width = `${urgency * 10}%`;
  if (barZone) barZone.style.width = `${zoneScore * 10}%`;

  if (previewBadge) {
    if (score >= 82) {
      previewBadge.className = "px-3.5 py-1.5 rounded-lg text-xs font-black badge-critical uppercase tracking-wider shadow-sm";
      previewBadge.innerText = "CRITICAL (SLA: 6h)";
    } else if (score >= 62) {
      previewBadge.className = "px-3.5 py-1.5 rounded-lg text-xs font-black badge-high uppercase tracking-wider shadow-sm";
      previewBadge.innerText = "HIGH (SLA: 24h)";
    } else if (score >= 40) {
      previewBadge.className = "px-3.5 py-1.5 rounded-lg text-xs font-black badge-medium uppercase tracking-wider shadow-sm";
      previewBadge.innerText = "MEDIUM (SLA: 48h)";
    } else {
      previewBadge.className = "px-3.5 py-1.5 rounded-lg text-xs font-black badge-low uppercase tracking-wider shadow-sm";
      previewBadge.innerText = "LOW (SLA: 7d)";
    }
  }

  const cat = document.getElementById("select-category")?.value;
  if (previewDept) {
    if (cat === "Pothole" || cat === "Road Defect") previewDept.innerText = "Roads & PWD";
    else if (cat === "Water Pipeline Leak" || cat === "Open Manhole") previewDept.innerText = "Water Supply & Sewerage (BWSSB)";
    else if (cat === "Streetlight & Electric Wire") previewDept.innerText = "Electricity Board (BESCOM)";
    else if (cat === "Garbage Dump") previewDept.innerText = "Solid Waste Management (BBMP)";
    else previewDept.innerText = "Auto-Detecting...";
  }
}

// Handle Image Selection
function handleImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    currentSelectedImageBase64 = e.target.result;
    document.getElementById("image-preview").src = currentSelectedImageBase64;
    document.getElementById("image-preview-container").classList.remove("hidden");
    document.getElementById("image-placeholder-container").classList.add("hidden");
  };
  reader.readAsDataURL(file);
}

// Handle Complaint Form Submit
async function handleComplaintSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙️</span> Processing AI Computer Vision & De-duplication...`;

  const payload = {
    title: document.getElementById("input-title").value,
    description: document.getElementById("input-description").value,
    lat: parseFloat(document.getElementById("input-lat").value),
    lng: parseFloat(document.getElementById("input-lng").value),
    address: document.getElementById("input-address").value,
    zone_type: document.getElementById("select-zone").value,
    weather_condition: document.getElementById("select-weather").value,
    category: document.getElementById("select-category").value,
    image_base64: currentSelectedImageBase64
  };

  try {
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    displaySubmissionResult(data);
    loadComplaints();
    loadStats();
  } catch (err) {
    alert("Error submitting complaint: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> Submit Complaint for AI Triage`;
    if (window.lucide) lucide.createIcons();
  }
}

function displaySubmissionResult(data) {
  const resultCard = document.getElementById("submission-result-card");
  const resHeading = document.getElementById("res-heading");
  const resMessage = document.getElementById("res-message");
  const resDetails = document.getElementById("res-details");

  resultCard.classList.remove("hidden");

  const userImg = data.user_image_url || "/uploads/pothole_hospital.png";
  const aiAnnotatedImg = data.ai_annotated_image_url || userImg;

  if (data.is_duplicate) {
    resultCard.className = "card-glass p-5 border border-indigo-300 bg-indigo-50/90 shadow-md";
    resHeading.innerText = "Spatio-Temporal De-Duplication Triggered!";
    resHeading.className = "text-sm font-extrabold text-indigo-900";
    resMessage.innerText = data.message;
    resMessage.className = "text-xs text-indigo-800 mb-3 font-medium";

    const masterImg = data.master_image_url || "/uploads/pothole_hospital.png";

    resDetails.innerHTML = `
      <!-- Side-by-Side Visual Comparison Card -->
      <div class="mb-3 p-2.5 rounded-xl bg-white border border-indigo-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
            🔍 AI Visual Comparison at this Location
          </span>
          <span class="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-300">
            Same Location Defect Match
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="text-center">
            <span class="text-[10px] font-bold text-slate-600 block mb-1">Your Uploaded Photo</span>
            <img src="${userImg}" alt="Your Upload" class="w-full h-28 object-cover rounded-lg border border-slate-200 shadow-sm">
          </div>
          <div class="text-center">
            <span class="text-[10px] font-bold text-indigo-700 block mb-1">Existing Report at this Spot</span>
            <img src="${masterImg}" alt="Master Ticket Photo" class="w-full h-28 object-cover rounded-lg border border-indigo-200 shadow-sm">
          </div>
        </div>
        <div class="mt-2 text-center text-[11px] font-bold text-indigo-800 bg-indigo-50 py-1 rounded">
          ✔ OpenCV Spatial Defect Match: Both reports correspond to the same defect cluster!
        </div>
      </div>

      <div class="flex justify-between"><span>Existing Master Ticket:</span> <strong class="text-blue-700 font-bold">#${data.master_ticket_code}</strong></div>
      <div class="flex justify-between"><span>Proximity Distance:</span> <strong>${data.distance_meters} meters away</strong></div>
      <div class="flex justify-between"><span>Total Citizen Reports Merged:</span> <strong class="text-amber-700 font-bold">${data.report_count} Reports</strong></div>
      <div class="flex justify-between"><span>Escalated Priority:</span> <strong class="text-red-600 font-extrabold">${data.updated_priority}/100 (${data.updated_tier})</strong></div>
    `;
  } else {
    resultCard.className = "card-glass p-5 border border-emerald-300 bg-emerald-50/90 shadow-md";
    resHeading.innerText = "New Infrastructure Defect Registered!";
    resHeading.className = "text-sm font-extrabold text-emerald-900";
    resMessage.innerText = data.message;
    resMessage.className = "text-xs text-emerald-800 mb-3 font-medium";
    const t = data.data;

    resDetails.innerHTML = `
      <!-- Side-by-Side Visual Comparison Card (User Photo vs AI Diagnostic Map) -->
      <div class="mb-3 p-2.5 rounded-xl bg-white border border-emerald-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1">
            🔬 AI Defect Visual Comparison
          </span>
          <span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
            OpenCV AI Validated
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="text-center">
            <span class="text-[10px] font-bold text-slate-600 block mb-1">Your Uploaded Photo</span>
            <img src="${userImg}" alt="User Photo" class="w-full h-28 object-cover rounded-lg border border-slate-200 shadow-sm">
          </div>
          <div class="text-center">
            <span class="text-[10px] font-bold text-blue-700 block mb-1">AI Defect Detection Map</span>
            <img src="${aiAnnotatedImg}" alt="AI Scan Overlay" class="w-full h-28 object-cover rounded-lg border border-blue-200 shadow-sm">
          </div>
        </div>
        <div class="mt-2 text-center text-[11px] font-bold text-emerald-800 bg-emerald-50 py-1 rounded">
          ✔ AI Validated: Defect contours, crack edges & crater boundaries extracted successfully!
        </div>
      </div>

      <div class="flex justify-between"><span>Generated Ticket Code:</span> <strong class="text-blue-700 font-bold">#${t.ticket_code}</strong></div>
      <div class="flex justify-between"><span>Department Assigned:</span> <strong class="text-slate-800 font-bold">${t.department}</strong></div>
      <div class="flex justify-between"><span>Dynamic Priority Score:</span> <strong class="text-red-600 font-extrabold">${t.priority_score}/100 (${t.priority_tier})</strong></div>
      <div class="flex justify-between"><span>Resolution SLA:</span> <strong class="text-slate-800 font-bold">Under ${t.sla_hours} Hours</strong></div>
      <div class="pt-2 mt-2 border-t border-emerald-200 flex justify-end">
        <button onclick="focusTicketOnMap(${t.lat}, ${t.lng}, true)" class="px-3 py-1.5 text-xs bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5">
          🛰️ View Location on Authority Satellite Map
        </button>
      </div>
    `;
  }

  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Fetch all complaints
async function loadComplaints() {
  try {
    const res = await fetch("/api/complaints");
    const json = await res.json();
    if (json.success) {
      allComplaints = json.data;
      renderCitizenFeed(allComplaints);
      renderAdminQueue(allComplaints);
      if (cityMap) renderMapMarkers(allComplaints);
    }
  } catch (err) {
    console.error("Failed to load complaints:", err);
  }
}

// Fetch Stats
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const json = await res.json();
    if (json.success) {
      const s = json.data;
      document.getElementById("metric-critical").innerText = s.critical_issues;
      document.getElementById("metric-duplicates").innerText = s.duplicates_prevented;
      document.getElementById("metric-resolved").innerText = s.resolved_issues;

      const statTot = document.getElementById("stat-total");
      const statCrit = document.getElementById("stat-critical");
      const statDup = document.getElementById("stat-duplicates");
      const statRes = document.getElementById("stat-resolved");

      if (statTot) statTot.innerText = s.total_complaints;
      if (statCrit) statCrit.innerText = s.critical_issues;
      if (statDup) statDup.innerText = s.duplicates_prevented;
      if (statRes) statRes.innerText = s.resolved_issues;

      renderCharts(s);
    }
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

// Render Citizen Community Cards
function renderCitizenFeed(complaints) {
  const container = document.getElementById("citizen-feed-container");
  if (!container) return;

  if (complaints.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 col-span-3 text-center py-6 font-medium">No complaints found.</p>`;
    return;
  }

  container.innerHTML = complaints.map(ticket => {
    const badgeClass = ticket.priority_tier === "CRITICAL" ? "badge-critical" :
                       ticket.priority_tier === "HIGH" ? "badge-high" :
                       ticket.priority_tier === "MEDIUM" ? "badge-medium" : "badge-low";

    const isResolved = ticket.status === "RESOLVED";

    return `
      <div class="card-glass p-5 flex flex-col justify-between border border-slate-200 bg-white shadow-sm hover:shadow-md">
        <div>
          <!-- Header Code & Tier -->
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">#${ticket.ticket_code}</span>
            <span class="px-2.5 py-0.5 rounded text-[11px] font-bold ${badgeClass}">
              ${ticket.priority_tier} (${ticket.priority_score})
            </span>
          </div>

          <!-- Image Thumbnail -->
          <div class="relative rounded-xl overflow-hidden mb-3 border border-slate-200 bg-slate-100 h-40">
            <img src="${ticket.image_url}" alt="Defect" class="w-full h-full object-cover">
            ${isResolved ? `
              <div class="absolute bottom-2 right-2 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-md">
                ✔ VERIFIED REPAIR
              </div>
            ` : `
              <div class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200">
                SLA: &lt; ${ticket.sla_hours}h
              </div>
            `}
          </div>

          <!-- Title & Address -->
          <h4 class="text-xs font-bold text-slate-900 line-clamp-1 mb-1">${ticket.title}</h4>
          <p class="text-[11px] text-slate-600 line-clamp-2 mb-2 leading-relaxed">${ticket.description}</p>
          <p class="text-[11px] text-slate-500 mb-2 font-medium">📍 ${ticket.address}</p>

          <!-- Department & Status -->
          <div class="text-[11px] text-slate-600 mb-3 space-y-0.5 pt-2 border-t border-slate-100">
            <div>Dept: <strong class="text-slate-800">${ticket.department}</strong></div>
            <div>Status: <span class="font-bold ${isResolved ? 'text-emerald-600' : 'text-amber-600'}">${ticket.status}</span></div>
          </div>
        </div>

        <!-- Footer Actions: Upvote & View on Map -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button onclick="upvoteTicket(${ticket.id})" class="px-3.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-blue-700 rounded-lg flex items-center gap-1.5 border border-slate-300 shadow-sm transition-all">
            <i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i> Upvote (${ticket.report_count})
          </button>

          <button onclick="focusTicketOnMap(${ticket.lat}, ${ticket.lng})" class="px-3.5 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg flex items-center gap-1.5 border border-blue-200 transition-all shadow-sm">
            <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> View GIS Pin
          </button>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// Render Admin Dispatch Queue
function renderAdminQueue(complaints) {
  const container = document.getElementById("admin-queue-container");
  const countEl = document.getElementById("queue-count");
  if (!container) return;

  if (countEl) countEl.innerText = `${complaints.length} Tickets`;

  if (complaints.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-6 font-medium">No matching complaints in queue.</p>`;
    return;
  }

  container.innerHTML = complaints.map(ticket => {
    const isResolved = ticket.status === "RESOLVED";
    const badgeClass = ticket.priority_tier === "CRITICAL" ? "badge-critical" :
                       ticket.priority_tier === "HIGH" ? "badge-high" :
                       ticket.priority_tier === "MEDIUM" ? "badge-medium" : "badge-low";

    return `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-white transition-all shadow-sm">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">#${ticket.ticket_code}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">
                ${ticket.priority_tier} (${ticket.priority_score})
              </span>
            </div>
            <h5 class="text-xs font-bold text-slate-900 mt-1">${ticket.title}</h5>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-sm">
            ${ticket.status}
          </span>
        </div>

        <div class="text-[11px] text-slate-600 space-y-0.5 mb-2.5">
          <div>📍 ${ticket.address}</div>
          <div>🏢 Dept: <strong class="text-slate-800">${ticket.department}</strong> | SLA: &lt; ${ticket.sla_hours}h</div>
          <div>👥 Reports Merged: <strong class="text-amber-700 font-bold">${ticket.report_count} citizens</strong></div>
        </div>

        <div class="flex items-center gap-2 pt-2.5 border-t border-slate-200">
          <button onclick="focusTicketOnMap(${ticket.lat}, ${ticket.lng}, false)" class="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 shadow-sm">
            Map
          </button>
          <button onclick="focusTicketOnMap(${ticket.lat}, ${ticket.lng}, true)" class="px-2.5 py-1 text-[11px] font-bold bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded border border-cyan-300 shadow-sm flex items-center gap-1">
            🛰️ Satellite
          </button>
          
          ${ticket.status !== 'IN_PROGRESS' && !isResolved ? `
            <button onclick="dispatchCrew(${ticket.id})" class="px-3 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold shadow-sm">
              Dispatch Crew
            </button>
          ` : ''}

          <button onclick="openResolveModal(${ticket.id})" class="ml-auto px-3 py-1 text-[11px] ${isResolved ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded font-bold shadow-sm">
            ${isResolved ? '✔ View Audit' : 'Verify & Close'}
          </button>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// Apply Admin Filters
function applyAdminFilters() {
  const dept = document.getElementById("filter-dept").value;
  const tier = document.getElementById("filter-tier").value;
  const status = document.getElementById("filter-status").value;

  let filtered = allComplaints.filter(c => {
    if (dept !== "ALL" && c.department !== dept) return false;
    if (tier !== "ALL" && c.priority_tier !== tier) return false;
    if (status !== "ALL" && c.status !== status) return false;
    return true;
  });

  renderAdminQueue(filtered);
  if (cityMap) renderMapMarkers(filtered);
}

// Upvote Ticket
async function upvoteTicket(id) {
  try {
    const res = await fetch(`/api/complaints/${id}/upvote`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      loadComplaints();
      loadStats();
    }
  } catch (err) {
    alert("Error upvoting ticket: " + err.message);
  }
}

// Dispatch Crew
async function dispatchCrew(id) {
  try {
    const res = await fetch(`/api/complaints/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS", details: "Field engineering crew dispatched to on-site coordinates." })
    });
    const data = await res.json();
    if (data.success) {
      loadComplaints();
    }
  } catch (err) {
    alert("Error updating status: " + err.message);
  }
}

// Open Resolution & AI Verification Modal
function openResolveModal(ticketId) {
  currentResolvingTicketId = ticketId;
  const ticket = allComplaints.find(c => c.id === ticketId);
  if (!ticket) return;

  document.getElementById("modal-ticket-code").innerText = `Ticket #${ticket.ticket_code} - ${ticket.title}`;
  document.getElementById("modal-before-img").src = ticket.image_url;
  document.getElementById("modal-after-img").src = ticket.after_image_url || "/uploads/pothole_hospital_repaired.png";

  const auditRes = document.getElementById("modal-audit-result");
  const verifyBtn = document.getElementById("modal-verify-btn");

  if (ticket.status === "RESOLVED") {
    auditRes.classList.remove("hidden");
    auditRes.innerHTML = `
      <div class="text-emerald-700 font-bold mb-1">✔ TICKET RESOLVED & VERIFIED</div>
      <div class="text-slate-700 font-medium">${ticket.ai_verification_notes || "Defect contour reduction confirmed. Road surface fully restored."}</div>
    `;
    verifyBtn.classList.add("hidden");
  } else {
    auditRes.classList.add("hidden");
    verifyBtn.classList.remove("hidden");
  }

  document.getElementById("resolve-modal").classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeResolveModal() {
  document.getElementById("resolve-modal").classList.add("hidden");
  currentResolvingTicketId = null;
}

// Run AI Visual Audit & Close Ticket
async function executeResolveVerification() {
  if (!currentResolvingTicketId) return;

  const btn = document.getElementById("modal-verify-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙️</span> Running AI Visual Audit...`;

  try {
    const res = await fetch(`/api/complaints/${currentResolvingTicketId}/verify-resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (data.success) {
      const auditRes = document.getElementById("modal-audit-result");
      auditRes.classList.remove("hidden");
      auditRes.innerHTML = `
        <div class="text-emerald-700 font-bold mb-1">✔ AI Visual Audit Passed (Confidence: ${Math.round(data.confidence * 100)}%)</div>
        <div class="text-slate-700 font-medium">${data.notes}</div>
      `;
      btn.classList.add("hidden");
      loadComplaints();
      loadStats();
    } else {
      alert("AI Verification Failed: " + data.error);
    }
  } catch (err) {
    alert("Error verifying resolution: " + err.message);
  } finally {
    btn.disabled = false;
  }
}
