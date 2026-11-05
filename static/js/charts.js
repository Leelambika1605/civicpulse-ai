/**
 * Analytics Charts Engine using Chart.js (Bright Modern Theme)
 */

let deptChartInstance = null;
let tierChartInstance = null;

function renderCharts(statsData) {
  if (!window.Chart) return;

  const deptCtx = document.getElementById("deptChart");
  const tierCtx = document.getElementById("tierChart");

  if (!deptCtx || !tierCtx) return;

  // 1. Department Breakdown Doughnut Chart
  const deptLabels = (statsData.department_breakdown || []).map(d => d.department.split(" (")[0]);
  const deptCounts = (statsData.department_breakdown || []).map(d => d.count);

  if (deptChartInstance) {
    deptChartInstance.destroy();
  }

  deptChartInstance = new Chart(deptCtx, {
    type: "doughnut",
    data: {
      labels: deptLabels.length ? deptLabels : ["Roads & PWD", "Water & Sewerage", "Electricity", "Waste Mgmt"],
      datasets: [{
        data: deptCounts.length ? deptCounts : [3, 2, 2, 1],
        backgroundColor: [
          "#0284c7", // Sky blue - Roads
          "#3b82f6", // Blue - Water
          "#f59e0b", // Amber - Electricity
          "#10b981"  // Emerald - Waste
        ],
        borderWidth: 3,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#475569", font: { size: 12, weight: "bold" } }
        }
      }
    }
  });

  // 2. Priority Tier Bar Chart
  const tierCounts = statsData.tier_distribution || { CRITICAL: 4, HIGH: 2, MEDIUM: 1, LOW: 1 };

  if (tierChartInstance) {
    tierChartInstance.destroy();
  }

  tierChartInstance = new Chart(tierCtx, {
    type: "bar",
    data: {
      labels: ["CRITICAL (<6h)", "HIGH (<24h)", "MEDIUM (<48h)", "LOW (<7d)"],
      datasets: [{
        label: "Tickets Count",
        data: [
          tierCounts["CRITICAL"] || 0,
          tierCounts["HIGH"] || 0,
          tierCounts["MEDIUM"] || 0,
          tierCounts["LOW"] || 0
        ],
        backgroundColor: [
          "rgba(239, 68, 68, 0.85)",
          "rgba(249, 115, 22, 0.85)",
          "rgba(234, 179, 8, 0.85)",
          "rgba(16, 185, 129, 0.85)"
        ],
        borderColor: [
          "#dc2626",
          "#ea580c",
          "#ca8a04",
          "#059669"
        ],
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#64748b", stepSize: 1, font: { weight: "bold" } },
          grid: { color: "#e2e8f0" }
        },
        x: {
          ticks: { color: "#475569", font: { size: 11, weight: "bold" } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
