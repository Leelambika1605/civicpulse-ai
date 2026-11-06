/**
 * CivicPulse AI - Core Frontend Controller (Bright Modern Theme)
 */

let allComplaints = [];
let currentSelectedImageBase64 = null;
let currentResolvingTicketId = null;
let citizenMiniMap = null;
let citizenDraggableMarker = null;
let citizenGoogleMap = null;
let citizenLocationMarker = null;

// Landmark coordinates & addresses
const LANDMARKS = {
  harinagar: {
    name: "Harinagar Main Road, Deepthi Nagar, Ward 196 Anjanapura, Bommanahalli, Bengaluru",
    lat: 12.877206,
    lng: 77.571510,
    zone: "Dense Residential Colony",
    note: "Opposite Annapoorna Tiffin Center, 3m x 2m crater"
  },
  victoria: {
    name: "Victoria Hospital Emergency Gate, Kalasipalya, Bengaluru",
    lat: 12.9634,
    lng: 77.5755,
    zone: "Hospital Zone",
    note: "Emergency Ramp entrance, Kalasipalya gate"
  },
  stjoseph: {
    name: "St. Joseph High School Gate, Residency Rd, Bengaluru",
    lat: 12.9719,
    lng: 77.5996,
    zone: "School / College Zone",
    note: "Near Primary School Bus Bay, Gate 2"
  },
  koramangala: {
    name: "Sony World Junction, Koramangala 100ft Rd, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    zone: "Major Arterial Road / Highway",
    note: "Left lane heading towards Oasis Mall"
  },
  mgroad: {
    name: "MG Road Metro Station Gate 2, Bengaluru",
    lat: 12.9754,
    lng: 77.6066,
    zone: "Metro / Transit Interchange",
    note: "Footpath right beside Metro Escalator exit"
  },
  indiranagar: {
    name: "12th Main Intersection, 100ft Road, Indiranagar, Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
    zone: "Commercial Market Area",
    note: "Outside corner bakery, 100ft road crossing"
  },
  whitefield: {
    name: "ITPL Main Road, Pattandur Agrahara, Whitefield, Bengaluru",
    lat: 12.9856,
    lng: 77.7289,
    zone: "Major Arterial Road / Highway",
    note: "Service road under ITPL flyover pillar 42"
  },
  jayanagar: {
    name: "4th Block Bus Stand, Jayanagar, Bengaluru",
    lat: 12.9250,
    lng: 77.5838,
    zone: "Dense Residential Colony",
    note: "Behind Bus Shelter 3, commercial lane"
  }
};

const SAMPLE_CASES = {
  bbmp_pothole: {
    title: "Severe 3m x 2m Deep Crater Pothole opp. Annapoorna Tiffin Center",
    desc: "Critical road crater 3m length x 2m width on Harinagar Main Road opp. Annapoorna Tiffin Center. Causing severe skidding of two-wheelers and auto-rickshaw axle damage during evening hours.",
    landmark: "harinagar",
    category: "Pothole",
    zone: "Dense Residential Colony",
    weather: "Clear Skies / Normal"
  },
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
  initCitizenGoogleMap();

  const addrInput = document.getElementById("input-address");
  if (addrInput) {
    addrInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        locateAddressOnMap();
      }
    });
  }

  if (window.lucide) lucide.createIcons();
});

// Google Maps Integrated Location Verification for Citizens
function initCitizenGoogleMap() {
  const mapEl = document.getElementById("citizen-google-map") || document.getElementById("citizen-mini-map");
  if (!mapEl || citizenGoogleMap) return;

  const latEl = document.getElementById("input-lat");
  const lngEl = document.getElementById("input-lng");
  const initialLat = latEl && parseFloat(latEl.value) ? parseFloat(latEl.value) : 12.9634;
  const initialLng = lngEl && parseFloat(lngEl.value) ? parseFloat(lngEl.value) : 77.5755;

  citizenGoogleMap = L.map(mapEl.id, {
    center: [initialLat, initialLng],
    zoom: 16,
    zoomControl: true,
    attributionControl: false
  });

  // Google Maps Vector Road Tiles (clean, official styling, reliable)
  const googleTileLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }).addTo(citizenGoogleMap);

  // Fallback to OSM in case network restricts Google tile subdomains
  googleTileLayer.on("tileerror", function() {
    if (!citizenGoogleMap._hasOsmFallback) {
      citizenGoogleMap._hasOsmFallback = true;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(citizenGoogleMap);
    }
  });

  // Official Google Maps Style Pin Marker
  const googlePinIcon = L.divIcon({
    className: "google-maps-pin",
    html: `
      <div style="width:30px; height:40px; transform:translate(-15px, -38px); filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)); cursor:pointer;">
        <svg viewBox="0 0 24 34" width="30" height="40">
          <path fill="#EA4335" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22c0-6.63-5.37-12-12-12z"/>
          <circle fill="#8B0000" cx="12" cy="12" r="5.5"/>
          <circle fill="#FFFFFF" cx="12" cy="12" r="4"/>
        </svg>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 38]
  });

  citizenLocationMarker = L.marker([initialLat, initialLng], {
    icon: googlePinIcon,
    draggable: true
  }).addTo(citizenGoogleMap);

  citizenLocationMarker.bindTooltip("📍 Exact Defect Location", { permanent: false, direction: "top" });

  citizenLocationMarker.on("dragend", function(e) {
    const pos = e.target.getLatLng();
    updateLocationCoordinates(pos.lat, pos.lng, true);
    const srcBadge = document.getElementById("location-source-badge");
    if (srcBadge) {
      srcBadge.innerText = "📍 Adjusted Pin";
      srcBadge.className = "text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200";
    }
  });

  citizenGoogleMap.on("click", function(e) {
    citizenLocationMarker.setLatLng(e.latlng);
    updateLocationCoordinates(e.latlng.lat, e.latlng.lng, true);
    const srcBadge = document.getElementById("location-source-badge");
    if (srcBadge) {
      srcBadge.innerText = "📍 Clicked on Map";
      srcBadge.className = "text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200";
    }
  });

  // Backward compatibility aliases
  citizenMiniMap = citizenGoogleMap;
  citizenDraggableMarker = citizenLocationMarker;
}

// Backward compatibility alias
function initCitizenMiniMap() {
  initCitizenGoogleMap();
}

// Update coordinates in inputs and on map
function updateLocationCoordinates(lat, lng, shouldReverseGeocode = false) {
  const latEl = document.getElementById("input-lat");
  const lngEl = document.getElementById("input-lng");
  const displayEl = document.getElementById("micro-coords-display");
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (latEl) latEl.value = numLat.toFixed(6);
  if (lngEl) lngEl.value = numLng.toFixed(6);
  if (displayEl) displayEl.innerText = `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`;

  if (citizenGoogleMap && citizenLocationMarker) {
    citizenLocationMarker.setLatLng([numLat, numLng]);
    citizenGoogleMap.setView([numLat, numLng], 16, { animate: true });
  }

  if (shouldReverseGeocode) {
    reverseGeocodeLocation(numLat, numLng);
  }

  updateDynamicCalculationPreview();
}

// Alias for older callers
function updateCitizenCoordinates(lat, lng) {
  updateLocationCoordinates(lat, lng, false);
}

// Reverse Geocode using Nominatim API to get human-readable street address
async function reverseGeocodeLocation(lat, lng) {
  const statusBadge = document.getElementById("geo-status-badge");
  if (statusBadge) {
    statusBadge.innerText = "🔄 Resolving street address...";
    statusBadge.className = "text-[10px] font-bold text-blue-600 animate-pulse";
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "Accept-Language": "en" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addrInput = document.getElementById("input-address");
        if (addrInput) addrInput.value = data.display_name;
        if (statusBadge) {
          statusBadge.innerText = "✅ Address synced with map";
          statusBadge.className = "text-[10px] font-bold text-emerald-600";
        }
        return;
      }
    }
  } catch (e) {
    console.warn("Reverse geocode failed:", e);
  }
  if (statusBadge) {
    statusBadge.innerText = "";
  }
}

// Exact Device GPS Detection
function useCurrentLocationGPS() {
  const btn = document.getElementById("btn-current-location");
  const statusBadge = document.getElementById("geo-status-badge");

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser. Please type your location manually.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-1.5">⌛</span> Locating...`;
  }
  if (statusBadge) {
    statusBadge.innerText = "🛰️ Querying exact device GPS...";
    statusBadge.className = "text-[10px] font-bold text-amber-600 animate-pulse";
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy || 5);

      updateLocationCoordinates(lat, lng, false);

      const landmarkSelect = document.getElementById("select-landmark");
      if (landmarkSelect) landmarkSelect.value = "custom";

      const srcBadge = document.getElementById("location-source-badge");
      if (srcBadge) {
        srcBadge.innerText = `🛰️ GPS Active (±${accuracy}m)`;
        srcBadge.className = "text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200";
      }

      if (statusBadge) {
        statusBadge.innerText = `✅ GPS Locked (±${accuracy}m accuracy)`;
        statusBadge.className = "text-[10px] font-bold text-emerald-600";
      }

      // Reverse geocode to populate address field
      await reverseGeocodeLocation(lat, lng);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Use Current Location`;
        if (window.lucide) lucide.createIcons();
      }
    },
    (error) => {
      console.warn("GPS error:", error);
      let errorMsg = "Unable to fetch GPS position.";
      if (error.code === 1) errorMsg = "Location permission denied.";
      else if (error.code === 2) errorMsg = "Position unavailable.";
      else if (error.code === 3) errorMsg = "Location request timed out.";

      if (statusBadge) {
        statusBadge.innerText = `⚠️ ${errorMsg} Please type your address.`;
        statusBadge.className = "text-[10px] font-bold text-amber-700";
      }

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Use Current Location`;
        if (window.lucide) lucide.createIcons();
      }
      alert(`${errorMsg} Please enter your address or landmark directly in the address field.`);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

// Geocode user typed address onto map
async function locateAddressOnMap() {
  const addrInput = document.getElementById("input-address");
  const address = addrInput ? addrInput.value.trim() : "";
  if (!address) {
    alert("Please enter a location or address to search.");
    return;
  }

  const statusBadge = document.getElementById("geo-status-badge");
  if (statusBadge) {
    statusBadge.innerText = "🔍 Locating on Google Maps...";
    statusBadge.className = "text-[10px] font-bold text-blue-600 animate-pulse";
  }

  // Multi-tier geocode queries for reliability
  const queries = [
    address,
    address.split(",").slice(-2).join(",").trim(),
    address.split(",")[0].trim()
  ].filter(q => q && q.length >= 3);

  let match = null;
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          match = results[0];
          break;
        }
      }
    } catch (e) {
      console.warn("Geocode query error:", e);
    }
  }

  if (match) {
    const lat = parseFloat(match.lat);
    const lng = parseFloat(match.lon);
    updateLocationCoordinates(lat, lng, false);

    const srcBadge = document.getElementById("location-source-badge");
    if (srcBadge) {
      srcBadge.innerText = "🔍 Verified Location";
      srcBadge.className = "text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200";
    }
    if (statusBadge) {
      statusBadge.innerText = `✅ Found on Google Maps`;
      statusBadge.className = "text-[10px] font-bold text-emerald-600";
    }
  } else {
    if (statusBadge) {
      statusBadge.innerText = "ℹ️ Address saved for municipal crew (adjust pin on map if needed)";
      statusBadge.className = "text-[10px] font-medium text-slate-500";
    }
  }

  const landmarkSelect = document.getElementById("select-landmark");
  if (landmarkSelect) landmarkSelect.value = "custom";
}

// Open current coordinates in Google Maps (Full View)
function openCurrentInGoogleMaps() {
  const latEl = document.getElementById("input-lat");
  const lngEl = document.getElementById("input-lng");
  const lat = latEl ? latEl.value : "12.9634";
  const lng = lngEl ? lngEl.value : "77.5755";
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Open Google Maps turn-by-turn navigation / directions
function openDirectionsInGoogleMaps() {
  const latEl = document.getElementById("input-lat");
  const lngEl = document.getElementById("input-lng");
  const lat = latEl ? latEl.value : "12.9634";
  const lng = lngEl ? lngEl.value : "77.5755";
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Landmark Preset Change
function handleLandmarkChange() {
  const val = document.getElementById("select-landmark").value;
  if (val === "custom") {
    const addrInput = document.getElementById("input-address");
    if (addrInput) addrInput.focus();
    const srcBadge = document.getElementById("location-source-badge");
    if (srcBadge) {
      srcBadge.innerText = "✍️ Custom Address";
      srcBadge.className = "text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200";
    }
    return;
  }

  if (val && LANDMARKS[val]) {
    const data = LANDMARKS[val];
    updateLocationCoordinates(data.lat, data.lng, false);
    const addrInput = document.getElementById("input-address");
    if (addrInput) addrInput.value = data.name;
    document.getElementById("select-zone").value = data.zone;
    const gateNote = document.getElementById("input-gate-note");
    if (gateNote && data.note) gateNote.value = data.note;

    const srcBadge = document.getElementById("location-source-badge");
    if (srcBadge) {
      srcBadge.innerText = "📍 Preset Landmark";
      srcBadge.className = "text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200";
    }

    updateDynamicCalculationPreview();
  }
}

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

// Landmark Preset Change (old duplicate - removed)
function handleLandmarkChange_old() {}

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
      if (allComplaints.length > 0 && typeof inspectTicketVisuals === "function") {
        inspectTicketVisuals(allComplaints[0]);
      }
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

          <button onclick="focusTicketOnMap(${ticket.lat}, ${ticket.lng})" class="px-3 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg flex items-center gap-1.5 border border-blue-200 transition-all shadow-sm">
            <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> View GIS Pin
          </button>

          <button onclick="openGoogleMapsPin(${ticket.lat}, ${ticket.lng})" class="px-3 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-300 shadow-sm transition-all" title="Open in Google Maps">
            <i data-lucide="external-link" class="w-3.5 h-3.5 text-blue-600"></i> Google Maps ↗
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
    const isBbmp = ticket.ticket_code && ticket.ticket_code.startsWith("BBMP-FMS");
    const badgeClass = ticket.priority_tier === "CRITICAL" ? "badge-critical" :
                       ticket.priority_tier === "HIGH" ? "badge-high" :
                       ticket.priority_tier === "MEDIUM" ? "badge-medium" : "badge-low";
    const lat = parseFloat(ticket.lat || 12.9634);
    const lng = parseFloat(ticket.lng || 77.5755);

    return `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-white transition-all shadow-sm">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">#${ticket.ticket_code}</span>
              ${isBbmp ? '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">🏛️ BBMP Real Data</span>' : '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">📱 Citizen Report</span>'}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">
                ${ticket.priority_tier} (${ticket.priority_score})
              </span>
            </div>
            <h5 class="text-xs font-bold text-slate-900 mt-1">${ticket.title}</h5>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 shadow-sm shrink-0">
            ${ticket.status}
          </span>
        </div>

        <p class="text-[11px] text-slate-700 font-medium bg-slate-100/80 p-2.5 rounded-lg border border-slate-200 my-2 leading-relaxed">
          ${ticket.description}
        </p>

        <div class="text-[11px] text-slate-600 space-y-1 mb-2.5">
          <div>📍 <strong class="text-slate-800">${ticket.address}</strong></div>
          <div class="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span>GPS: ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E</span>
            <span>Zone: ${ticket.zone_type}</span>
          </div>
          <div>🏢 Dept: <strong class="text-slate-800">${ticket.department}</strong> | SLA: &lt; ${ticket.sla_hours}h</div>
          <div>👥 Reports Merged: <strong class="text-amber-700 font-bold">${ticket.report_count} citizens</strong></div>
        </div>

        <div class="flex items-center gap-2 pt-2.5 border-t border-slate-200 flex-wrap">
          <button onclick="selectAndInspectTicket(${ticket.id})" class="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm flex items-center gap-1 cursor-pointer">
            📸 Inspect
          </button>
          <button onclick="openGoogleStreetView(${lat}, ${lng})" class="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm flex items-center gap-1 cursor-pointer" title="Open Official Google Maps 360° Street View">
            🌐 360° View ↗
          </button>
          <button onclick="openGoogleMapsPin(${lat}, ${lng})" class="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 shadow-sm flex items-center gap-1 cursor-pointer" title="Exact Pin in Google Maps">
            📍 Pin ↗
          </button>
          <button onclick="focusTicketOnMap(${lat}, ${lng}, true)" class="px-2 py-1 text-[11px] font-bold bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded border border-cyan-300 shadow-sm flex items-center gap-1 cursor-pointer">
            🛰️ Sat
          </button>
          
          ${ticket.status !== 'IN_PROGRESS' && !isResolved ? `
            <button onclick="dispatchCrew(${ticket.id})" class="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-900 text-white rounded font-bold shadow-sm cursor-pointer">
              Dispatch
            </button>
          ` : ''}

          <button onclick="openResolveModal(${ticket.id})" class="ml-auto px-2.5 py-1 text-[11px] ${isResolved ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded font-bold shadow-sm cursor-pointer">
            ${isResolved ? '✔ View Proof' : 'Verify & Close'}
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
  const source = document.getElementById("filter-source")?.value || "ALL";

  let filtered = allComplaints.filter(c => {
    if (dept !== "ALL" && c.department !== dept) return false;
    if (tier !== "ALL" && c.priority_tier !== tier) return false;
    if (status !== "ALL" && c.status !== status) return false;
    if (source === "BBMP" && !c.ticket_code.startsWith("BBMP-FMS")) return false;
    if (source === "CITIZEN" && c.ticket_code.startsWith("BBMP-FMS")) return false;
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


// Select and Inspect Complaint in Top Inspection Hub
function selectAndInspectTicket(id) {
  const ticket = allComplaints.find(c => c.id === id);
  if (ticket) {
    if (typeof inspectTicketVisuals === "function") {
      inspectTicketVisuals(ticket);
    }
    if (typeof switchInspectionMode === "function") {
      switchInspectionMode("streetview");
    }
    if (typeof focusTicketOnMap === "function") {
      focusTicketOnMap(ticket.lat, ticket.lng, false);
    }
  }
}


// Set Data Source Filter
function setDataSourceFilter(source) {
  const el = document.getElementById("filter-source");
  if (el) {
    el.value = source;
  }
  applyAdminFilters();
}
