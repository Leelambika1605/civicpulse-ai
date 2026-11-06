/**
 * Geospatial GIS Map Engine & Visual Inspection Hub using Leaflet.js
 * Combines:
 *  1. Interactive Street Surroundings & Defect Inspector (Pan, Zoom, Scroll)
 *  2. Esri High-Resolution Aerial Satellite Close-Up (Zoom 19)
 *  3. AI OpenCV Defect Diagnostic Scan
 *  4. Leaflet City Road Map with 65m De-duplication Buffers & Google Street View Integration
 */

let cityMap = null;
let satelliteCloseupMap = null;    // Top panel: satellite close-up
let closeupMarker = null;          // Red pin on close-up map
let markerLayerGroup = null;
let radiusLayerGroup = null;
let streetTileLayer = null;
let satelliteTileLayer = null;
let isSatelliteMode = false;
let showRadiusBuffers = true;

let currentInspectedTicket = null;
let currentInspectionMode = "streetview";
let currentPhotoAngle = 1;

// Pan/Zoom State for Interactive Street View
let pzState = {
  scale: 1.0,
  x: 0,
  y: 0,
  isDragging: false,
  startX: 0,
  startY: 0
};

const BENGALURU_CENTER = [12.9634, 77.5755];

function initMap() {
  if (cityMap) return;

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  // ── BOTTOM PANEL: OSM Road Map ──────────────────────────────────────────
  streetTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | CivicPulse GIS'
  });

  satelliteTileLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });

  cityMap = L.map("map", {
    center: BENGALURU_CENTER,
    zoom: 13,
    layers: [streetTileLayer],
    zoomControl: true
  });

  const baseMaps = {
    "🗺️ Standard Street Map": streetTileLayer,
    "🛰️ High-Res Satellite View": satelliteTileLayer
  };
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(cityMap);

  markerLayerGroup = L.layerGroup().addTo(cityMap);
  radiusLayerGroup = L.layerGroup().addTo(cityMap);

  cityMap.on("baselayerchange", function(e) {
    isSatelliteMode = (e.name.includes("Satellite"));
    updateSatelliteButtonState();
  });

  // ── TOP PANEL: Satellite Close-Up Map & Interactive Pan/Zoom Viewer ─────
  initSatelliteCloseup();
  initStreetViewPanZoom();

  // Load default main pothole ticket (CP-BLR-8012)
  if (window.allComplaints && allComplaints.length > 0) {
    inspectTicketVisuals(allComplaints[0]);
  }
}

/**
 * Initializes the top satellite close-up panel (Esri World Imagery, zoom 19).
 */
function initSatelliteCloseup() {
  const el = document.getElementById("satellite-closeup-map");
  if (!el || satelliteCloseupMap) return;

  satelliteCloseupMap = L.map("satellite-closeup-map", {
    center: BENGALURU_CENTER,
    zoom: 19,
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: true,
    doubleClickZoom: true
  });

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 20,
    attribution: 'Tiles &copy; Esri'
  }).addTo(satelliteCloseupMap);

  // Red pulsing crosshair pin
  const crosshairIcon = L.divIcon({
    className: "",
    html: `<div style="
      width:22px; height:22px; border-radius:50%;
      background:rgba(239,68,68,0.9);
      border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(239,68,68,0.35), 0 2px 8px rgba(0,0,0,0.4);
      animation:pulse-ring 1.6s ease-out infinite;
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  closeupMarker = L.marker(BENGALURU_CENTER, { icon: crosshairIcon }).addTo(satelliteCloseupMap);
}

/**
 * Interactive Street & Surroundings Pan/Zoom/Scroll Inspector
 */
function initStreetViewPanZoom() {
  const viewport = document.getElementById("streetview-viewport-panel");
  const layer = document.getElementById("streetview-pan-layer");
  if (!viewport || !layer) return;

  function applyTransform() {
    layer.style.transform = `translate(${pzState.x}px, ${pzState.y}px) scale(${pzState.scale})`;
  }

  // Mouse Drag to Pan
  viewport.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    pzState.isDragging = true;
    pzState.startX = e.clientX - pzState.x;
    pzState.startY = e.clientY - pzState.y;
    viewport.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!pzState.isDragging) return;
    pzState.x = e.clientX - pzState.startX;
    pzState.y = e.clientY - pzState.startY;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (pzState.isDragging) {
      pzState.isDragging = false;
      viewport.style.cursor = "grab";
    }
  });

  // Mouse Wheel to Zoom in/out
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    const newScale = Math.min(4.0, Math.max(0.85, pzState.scale + zoomFactor));
    pzState.scale = newScale;
    applyTransform();
  }, { passive: false });

  // Touch Drag & Pan
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      pzState.isDragging = true;
      pzState.startX = e.touches[0].clientX - pzState.x;
      pzState.startY = e.touches[0].clientY - pzState.y;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (!pzState.isDragging || e.touches.length !== 1) return;
    pzState.x = e.touches[0].clientX - pzState.startX;
    pzState.y = e.touches[0].clientY - pzState.startY;
    applyTransform();
  }, { passive: true });

  viewport.addEventListener("touchend", () => {
    pzState.isDragging = false;
  }, { passive: true });
}

function zoomStreetView(delta) {
  const layer = document.getElementById("streetview-pan-layer");
  if (!layer) return;
  pzState.scale = Math.min(4.0, Math.max(0.85, pzState.scale + delta));
  layer.style.transform = `translate(${pzState.x}px, ${pzState.y}px) scale(${pzState.scale})`;
}

function resetStreetViewZoom() {
  const layer = document.getElementById("streetview-pan-layer");
  if (!layer) return;
  pzState.scale = 1.0;
  pzState.x = 0;
  pzState.y = 0;
  layer.style.transform = `translate(0px, 0px) scale(1)`;
}

/**
 * Switch Top Visual Inspection Modes
 */
function switchInspectionMode(mode) {
  currentInspectionMode = mode;

  const btnStreet = document.getElementById("tab-mode-streetview");
  const btnSat = document.getElementById("tab-mode-satellite");
  const btnScan = document.getElementById("tab-mode-scan");

  const panelStreet = document.getElementById("streetview-viewport-panel");
  const panelSat = document.getElementById("satellite-closeup-map");
  const panelScan = document.getElementById("ai-scan-viewport-panel");

  // Reset button styles
  [btnStreet, btnSat, btnScan].forEach(b => {
    if (b) {
      b.style.background = "transparent";
      b.style.color = "#94a3b8";
      b.style.fontWeight = "600";
    }
  });

  // Hide all panels
  if (panelStreet) panelStreet.style.display = "none";
  if (panelSat) panelSat.style.display = "none";
  if (panelScan) panelScan.style.display = "none";

  if (mode === "streetview") {
    if (panelStreet) panelStreet.style.display = "flex";
    if (btnStreet) {
      btnStreet.style.background = "#2563eb";
      btnStreet.style.color = "#ffffff";
      btnStreet.style.fontWeight = "700";
    }
  } else if (mode === "satellite") {
    if (panelSat) {
      panelSat.style.display = "block";
      if (satelliteCloseupMap) {
        setTimeout(() => satelliteCloseupMap.invalidateSize(), 50);
      }
    }
    if (btnSat) {
      btnSat.style.background = "#0891b2";
      btnSat.style.color = "#ffffff";
      btnSat.style.fontWeight = "700";
    }
  } else if (mode === "scan") {
    if (panelScan) panelScan.style.display = "flex";
    if (btnScan) {
      btnScan.style.background = "#7c3aed";
      btnScan.style.color = "#ffffff";
      btnScan.style.fontWeight = "700";
    }
  }
}

/**
 * Switch between Angle 1 (Pothole Pin) and Angle 2 (Surroundings)
 */
function switchStreetPhoto(angle) {
  currentPhotoAngle = angle;
  const imgEl = document.getElementById("inspector-street-img");
  const btn1 = document.getElementById("btn-photo-1");
  const btn2 = document.getElementById("btn-photo-2");
  const defectMarker = document.getElementById("inspector-defect-marker");
  const landmarkCallout = document.getElementById("inspector-landmark-callout");

  if (!imgEl) return;

  if (angle === 1) {
    imgEl.src = (currentInspectedTicket && currentInspectedTicket.image_url) 
      ? currentInspectedTicket.image_url 
      : "/uploads/streetview_pothole_pin.jpg";
    if (btn1) {
      btn1.style.background = "rgba(37,99,235,0.9)";
      btn1.style.color = "white";
    }
    if (btn2) {
      btn2.style.background = "rgba(15,23,42,0.8)";
      btn2.style.color = "#cbd5e1";
    }
    if (defectMarker) {
      defectMarker.style.display = "flex";
      defectMarker.style.top = "44%";
      defectMarker.style.left = "58%";
    }
    if (landmarkCallout) {
      landmarkCallout.style.display = "block";
      landmarkCallout.style.top = "22%";
      landmarkCallout.style.left = "28%";
      landmarkCallout.innerText = "📍 Victoria Hospital Emergency Gate";
    }
  } else {
    imgEl.src = (currentInspectedTicket && currentInspectedTicket.streetview_image_url)
      ? currentInspectedTicket.streetview_image_url
      : "/uploads/streetview_pothole_surroundings.jpg";
    if (btn2) {
      btn2.style.background = "rgba(37,99,235,0.9)";
      btn2.style.color = "white";
    }
    if (btn1) {
      btn1.style.background = "rgba(15,23,42,0.8)";
      btn1.style.color = "#cbd5e1";
    }
    if (defectMarker) {
      defectMarker.style.display = "flex";
      defectMarker.style.top = "52%";
      defectMarker.style.left = "48%";
    }
    if (landmarkCallout) {
      landmarkCallout.style.display = "block";
      landmarkCallout.style.top = "15%";
      landmarkCallout.style.left = "20%";
      landmarkCallout.innerText = "🚖 Auto-Rickshaw Stand & Corner Houses";
    }
  }

  resetStreetViewZoom();
}

/**
 * Inspect a specific complaint ticket in the Visual Inspection Hub
 */
function inspectTicketVisuals(ticket) {
  if (!ticket) return;
  currentInspectedTicket = ticket;

  const lat = parseFloat(ticket.lat || 12.9634);
  const lng = parseFloat(ticket.lng || 77.5755);

  // Update Header Info
  const codeEl = document.getElementById("inspector-ticket-code");
  const tierEl = document.getElementById("inspector-ticket-tier");
  const titleEl = document.getElementById("inspector-ticket-title");
  const coordsEl = document.getElementById("inspector-coords");
  const gmapsLink = document.getElementById("inspector-gmaps-link");
  const navLink = document.getElementById("inspector-nav-link");

  if (codeEl) codeEl.innerText = `#${ticket.ticket_code}`;
  if (tierEl) {
    tierEl.innerText = `${ticket.priority_tier} (${ticket.priority_score})`;
    tierEl.className = ticket.priority_tier === "CRITICAL" ? "badge-critical" :
                       ticket.priority_tier === "HIGH" ? "badge-high" : "badge-medium";
  }
  if (titleEl) titleEl.innerText = ticket.title;
  if (coordsEl) coordsEl.innerText = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  // Google Maps Links (Real 360 Street View link with coordinates)
  if (gmapsLink) {
    gmapsLink.href = `https://www.google.com/maps/@${lat},${lng},3a,75y,90t/data=!3m6!1e1`;
  }
  if (navLink) {
    navLink.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  // Update Photos
  const streetImg = document.getElementById("inspector-street-img");
  const scanImg = document.getElementById("inspector-ai-scan-img");
  const defectLabel = document.getElementById("marker-defect-label");
  const landmarkCallout = document.getElementById("inspector-landmark-callout");
  const switcher = document.getElementById("inspector-photo-switcher");

  if (defectLabel) {
    defectLabel.innerText = `${(ticket.category || "DEFECT").toUpperCase()} LOCATED`;
  }

  if (landmarkCallout) {
    landmarkCallout.innerText = `📍 ${ticket.address.split(",")[0]}`;
  }

  // Set images
  let primaryImg = ticket.image_url || "/uploads/streetview_pothole_pin.jpg";
  if (ticket.ticket_code === "CP-BLR-8012") {
    primaryImg = "/uploads/streetview_pothole_pin.jpg";
    if (switcher) switcher.style.display = "flex";
  } else {
    if (switcher) switcher.style.display = "none";
  }

  if (streetImg) streetImg.src = primaryImg;

  // AI Diagnostic image
  if (scanImg) {
    if (ticket.ticket_code === "CP-BLR-8012") {
      scanImg.src = "/uploads/ai_scan_streetview_pothole_pin.jpg";
    } else {
      const baseName = primaryImg.split("/").pop();
      scanImg.src = `/uploads/ai_scan_${baseName}`;
      scanImg.onerror = () => { scanImg.src = primaryImg; };
    }
  }

  resetStreetViewZoom();

  // Also sync the Satellite close-up panel
  if (satelliteCloseupMap) {
    satelliteCloseupMap.setView([lat, lng], 19, { animate: true, duration: 0.5 });
    if (closeupMarker) {
      closeupMarker.setLatLng([lat, lng]);
    }
  }
}

function updateStreetView(lat, lng) {
  // Find ticket matching lat/lng
  if (window.allComplaints) {
    const match = allComplaints.find(c => Math.abs(c.lat - lat) < 0.0005 && Math.abs(c.lng - lng) < 0.0005);
    if (match) {
      inspectTicketVisuals(match);
      switchInspectionMode("streetview");
      return;
    }
  }
  updateSatelliteCloseup(lat, lng);
}

function updateSatelliteCloseup(lat, lng) {
  if (!satelliteCloseupMap) initSatelliteCloseup();
  if (!satelliteCloseupMap) return;

  satelliteCloseupMap.setView([lat, lng], 19, { animate: true, duration: 0.5 });
  if (closeupMarker) {
    closeupMarker.setLatLng([lat, lng]);
  }

  const coordsEl = document.getElementById("inspector-coords");
  if (coordsEl) {
    coordsEl.innerText = `📍 ${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
  }
  const gmLink = document.getElementById("inspector-gmaps-link");
  if (gmLink) {
    gmLink.href = `https://www.google.com/maps/@${lat},${lng},3a,75y,90t/data=!3m6!1e1`;
  }
}

function zoomSatellite(lat, lng) {
  if (!cityMap) initMap();
  switchInspectionMode("satellite");
  cityMap.setView([lat, lng], 18, { animate: true });
  updateSatelliteCloseup(lat, lng);
}

function focusTicketOnMap(lat, lng, enableSatellite = false) {
  switchTab("admin");
  setTimeout(() => {
    if (!cityMap) initMap();
    if (enableSatellite && !isSatelliteMode) {
      toggleSatelliteView();
    }
    const zoomLevel = enableSatellite ? 18 : 16;
    cityMap.setView([lat, lng], zoomLevel, { animate: true });

    // Sync inspection panel
    if (window.allComplaints) {
      const match = allComplaints.find(c => Math.abs(c.lat - lat) < 0.0005 && Math.abs(c.lng - lng) < 0.0005);
      if (match) {
        inspectTicketVisuals(match);
      }
    }
    if (enableSatellite) {
      switchInspectionMode("satellite");
    }
  }, 200);
}

function toggleSatelliteView() {
  if (!cityMap) initMap();
  if (!cityMap) return;

  if (isSatelliteMode) {
    cityMap.removeLayer(satelliteTileLayer);
    cityMap.addLayer(streetTileLayer);
    isSatelliteMode = false;
  } else {
    cityMap.removeLayer(streetTileLayer);
    cityMap.addLayer(satelliteTileLayer);
    isSatelliteMode = true;
  }
  updateSatelliteButtonState();
}

function updateSatelliteButtonState() {
  const btn = document.getElementById("btn-toggle-satellite");
  if (!btn) return;

  if (isSatelliteMode) {
    btn.innerHTML = `<i data-lucide="map" class="w-3.5 h-3.5 inline mr-1"></i> Switch to Street Map`;
    btn.className = "px-3.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm transition-all border border-slate-700";
  } else {
    btn.innerHTML = `<i data-lucide="satellite" class="w-3.5 h-3.5 inline mr-1"></i> 🛰️ View Satellite Imagery`;
    btn.className = "px-3.5 py-1.5 text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-bold shadow-md shadow-cyan-500/20 transition-all";
  }
  if (window.lucide) lucide.createIcons();
}

function getMarkerIcon(tier) {
  let cssClass = "pulse-marker-medium";
  if (tier === "CRITICAL") cssClass = "pulse-marker-critical";
  else if (tier === "HIGH") cssClass = "pulse-marker-high";
  else if (tier === "LOW") cssClass = "pulse-marker-low";

  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `<div class="${cssClass}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
}

function renderMapMarkers(complaints) {
  if (!cityMap) initMap();
  if (!cityMap) return;

  markerLayerGroup.clearLayers();
  radiusLayerGroup.clearLayers();

  complaints.forEach((ticket) => {
    if (!ticket.lat || !ticket.lng) return;

    const lat = parseFloat(ticket.lat);
    const lng = parseFloat(ticket.lng);
    const icon = getMarkerIcon(ticket.priority_tier);

    // Marker
    const marker = L.marker([lat, lng], { icon: icon });

    // Clean High-Contrast Popup Content
    const popupHtml = `
      <div style="font-family: inherit; width: 250px; font-size: 12px; color: #0f172a; padding: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: #2563eb; font-size: 12px;">#${ticket.ticket_code}</strong>
          <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${ticket.priority_tier === 'CRITICAL' ? '#fee2e2; color: #dc2626; border: 1px solid #fca5a5;' : ticket.priority_tier === 'HIGH' ? '#ffedd5; color: #ea580c; border: 1px solid #fdba74;' : '#fef9c3; color: #ca8a04; border: 1px solid #fde047;'}">
            ${ticket.priority_tier} (${ticket.priority_score})
          </span>
        </div>
        
        <div style="position: relative; width: 100%; height: 100px; border-radius: 6px; overflow: hidden; margin-bottom: 6px; border: 1px solid #cbd5e1; background:#0f172a;">
          <img src="${ticket.image_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Defect">
          <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(15,23,42,0.85); color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px;">
            GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>
        </div>

        <p style="font-weight: 700; font-size: 12px; margin: 4px 0 3px 0; color: #0f172a; line-height: 1.3;">${ticket.title}</p>
        <p style="color: #64748b; font-size: 11px; margin-bottom: 6px;">📍 ${ticket.address}</p>
        <div style="font-size: 11px; margin-bottom: 8px; color: #334155; line-height: 1.4;">
          🏢 <strong>${ticket.department}</strong><br>
          👥 <strong style="color: #ea580c;">${ticket.report_count}</strong> Citizen Reports Merged
        </div>

        <div style="display: flex; gap: 5px; margin-top: 6px; flex-wrap: wrap;">
          <button onclick="updateStreetView(${lat}, ${lng})" style="flex: 1; background: #2563eb; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 10px; cursor: pointer; min-width:80px;">
            📸 Inspect Street
          </button>
          <button onclick="zoomSatellite(${lat}, ${lng})" style="flex: 1; background: #0891b2; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 10px; cursor: pointer; min-width:80px;">
            🛰️ Satellite
          </button>
          <button onclick="openResolveModal(${ticket.id})" style="flex: 1; background: #059669; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 10px; cursor: pointer; min-width:80px;">
            ${ticket.status === 'RESOLVED' ? '✔ View Proof' : 'Verify & Resolve'}
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on("popupopen", function() {
      updateStreetView(lat, lng);
    });
    markerLayerGroup.addLayer(marker);

    // Draw 65-meter De-duplication Buffer circle around active tickets
    if (showRadiusBuffers && ticket.status !== "RESOLVED") {
      const circleColor = ticket.priority_tier === "CRITICAL" ? "#ef4444" : "#f97316";
      const circle = L.circle([lat, lng], {
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: 0.18,
        radius: 65,
        weight: 2,
        dashArray: "4, 4"
      });
      circle.bindTooltip(`65m De-duplication Zone (${ticket.ticket_code})`, { permanent: false, direction: "top" });
      radiusLayerGroup.addLayer(circle);
    }
  });
}

function toggleMapClusters() {
  showRadiusBuffers = !showRadiusBuffers;
  const btn = document.getElementById("btn-toggle-pins");
  if (showRadiusBuffers) {
    radiusLayerGroup.addTo(cityMap);
    if (btn) btn.innerText = "Hide 65m De-dup Zones";
  } else {
    cityMap.removeLayer(radiusLayerGroup);
    if (btn) btn.innerText = "Show 65m De-dup Zones";
  }
}
