/**
 * Geospatial GIS Map Engine using Leaflet.js
 * Visualizes infrastructure complaints, priority-coded markers, 65m de-duplication buffers,
 * and high-resolution Satellite Imagery toggle (Esri World Imagery).
 */

let cityMap = null;
let markerLayerGroup = null;
let radiusLayerGroup = null;
let streetTileLayer = null;
let satelliteTileLayer = null;
let isSatelliteMode = false;
let showRadiusBuffers = true;

const BENGALURU_CENTER = [12.9716, 77.5946];

function initMap() {
  if (cityMap) return;

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  // 1. Street Map Tiles (OpenStreetMap)
  streetTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | CivicPulse GIS'
  });

  // 2. High-Resolution Satellite Tiles (Esri World Imagery)
  satelliteTileLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Initialize Map
  cityMap = L.map("map", {
    center: BENGALURU_CENTER,
    zoom: 12,
    layers: [streetTileLayer],
    zoomControl: true
  });

  // Add Layer Switcher Control in Top-Right Corner
  const baseMaps = {
    "🗺️ Standard Street Map": streetTileLayer,
    "🛰️ High-Res Satellite View": satelliteTileLayer
  };

  L.control.layers(baseMaps, null, { position: "topright" }).addTo(cityMap);

  markerLayerGroup = L.layerGroup().addTo(cityMap);
  radiusLayerGroup = L.layerGroup().addTo(cityMap);

  // Sync button text on layer change
  cityMap.on("baselayerchange", function(e) {
    isSatelliteMode = (e.name.includes("Satellite"));
    updateSatelliteButtonState();
  });
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
      <div style="font-family: inherit; width: 240px; font-size: 12px; color: #0f172a; padding: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: #2563eb; font-size: 12px;">#${ticket.ticket_code}</strong>
          <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${ticket.priority_tier === 'CRITICAL' ? '#fee2e2; color: #dc2626; border: 1px solid #fca5a5;' : ticket.priority_tier === 'HIGH' ? '#ffedd5; color: #ea580c; border: 1px solid #fdba74;' : '#fef9c3; color: #ca8a04; border: 1px solid #fde047;'}">
            ${ticket.priority_tier} (${ticket.priority_score})
          </span>
        </div>
        
        <div style="position: relative; width: 100%; height: 95px; border-radius: 6px; overflow: hidden; margin-bottom: 6px; border: 1px solid #cbd5e1;">
          <img src="${ticket.image_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Defect">
          <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(15,23,42,0.8); color: white; font-size: 9px; padding: 2px 5px; border-radius: 4px;">
            GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>
        </div>

        <p style="font-weight: 700; font-size: 12px; margin: 4px 0 3px 0; color: #0f172a; line-height: 1.3;">${ticket.title}</p>
        <p style="color: #64748b; font-size: 11px; margin-bottom: 6px;">📍 ${ticket.address}</p>
        <div style="font-size: 11px; margin-bottom: 8px; color: #334155; line-height: 1.4;">
          🏢 <strong>${ticket.department}</strong><br>
          👥 <strong style="color: #ea580c;">${ticket.report_count}</strong> Citizen Reports Merged
        </div>

        <div style="display: flex; gap: 5px; margin-top: 6px;">
          <button onclick="zoomSatellite(${lat}, ${lng})" style="flex: 1; background: #0891b2; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 10px; cursor: pointer;">
            🛰️ Satellite Zoom
          </button>
          <button onclick="openResolveModal(${ticket.id})" style="flex: 1; background: #2563eb; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 10px; cursor: pointer;">
            ${ticket.status === 'RESOLVED' ? '✔ View Proof' : 'Verify & Resolve'}
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    markerLayerGroup.addLayer(marker);

    // Draw 65-meter De-duplication Buffer circle around active tickets
    if (showRadiusBuffers && ticket.status !== "RESOLVED") {
      const circleColor = ticket.priority_tier === "CRITICAL" ? "#ef4444" : "#f97316";
      const circle = L.circle([lat, lng], {
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: 0.18,
        radius: 65,  // 65 meters de-duplication zone
        weight: 2,
        dashArray: "4, 4"
      });
      circle.bindTooltip(`65m De-duplication Zone (${ticket.ticket_code})`, { permanent: false, direction: "top" });
      radiusLayerGroup.addLayer(circle);
    }
  });
}

function zoomSatellite(lat, lng) {
  if (!cityMap) initMap();
  if (!isSatelliteMode) {
    toggleSatelliteView();
  }
  cityMap.setView([lat, lng], 18, { animate: true });
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
  }, 200);
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
