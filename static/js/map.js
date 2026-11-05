/**
 * Geospatial GIS Map Engine using Leaflet.js (Bright Modern Theme)
 * Visualizes infrastructure complaints, priority-coded markers, and 65m de-duplication buffers.
 */

let cityMap = null;
let markerLayerGroup = null;
let radiusLayerGroup = null;
let showRadiusBuffers = true;

const BENGALURU_CENTER = [12.9716, 77.5946];

function initMap() {
  if (cityMap) return;

  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  // Initialize map
  cityMap = L.map("map", {
    center: BENGALURU_CENTER,
    zoom: 12,
    zoomControl: true
  });

  // OpenStreetMap Tile Layer (Clean natural bright style)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | CivicPulse GIS'
  }).addTo(cityMap);

  markerLayerGroup = L.layerGroup().addTo(cityMap);
  radiusLayerGroup = L.layerGroup().addTo(cityMap);
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

    // Clean Bright Popup Content
    const popupHtml = `
      <div style="font-family: inherit; width: 230px; font-size: 12px; color: #0f172a; padding: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: #2563eb; font-size: 12px;">#${ticket.ticket_code}</strong>
          <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${ticket.priority_tier === 'CRITICAL' ? '#fee2e2; color: #dc2626; border: 1px solid #fca5a5;' : ticket.priority_tier === 'HIGH' ? '#ffedd5; color: #ea580c; border: 1px solid #fdba74;' : '#fef9c3; color: #ca8a04; border: 1px solid #fde047;'}">
            ${ticket.priority_tier} (${ticket.priority_score})
          </span>
        </div>
        <p style="font-weight: 700; font-size: 12px; margin: 4px 0 3px 0; color: #0f172a; line-height: 1.3;">${ticket.title}</p>
        <p style="color: #64748b; font-size: 11px; margin-bottom: 6px;">📍 ${ticket.address}</p>
        <div style="font-size: 11px; margin-bottom: 8px; color: #334155; line-height: 1.4;">
          🏢 <strong>${ticket.department}</strong><br>
          👥 <strong style="color: #ea580c;">${ticket.report_count}</strong> Citizen Reports Merged
        </div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button onclick="openResolveModal(${ticket.id})" style="flex: 1; background: #2563eb; color: white; font-weight: bold; border: none; padding: 6px; border-radius: 6px; font-size: 11px; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.3);">
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
        fillOpacity: 0.15,
        radius: 65,  // 65 meters de-duplication zone
        weight: 2,
        dashArray: "4, 4"
      });
      circle.bindTooltip(`65m De-duplication Zone (${ticket.ticket_code})`, { permanent: false, direction: "top" });
      radiusLayerGroup.addLayer(circle);
    }
  });
}

function focusTicketOnMap(lat, lng) {
  switchTab("admin");
  setTimeout(() => {
    if (!cityMap) initMap();
    cityMap.setView([lat, lng], 16, { animate: true });
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
