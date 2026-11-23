/**
 * KendaraTrack - Analytics & Charts (Chart.js Integration)
 * Monthly Income vs Expense Bar Chart & Category Breakdown Donut Chart
 */

const AnalyticsCharts = (function () {
  let barChartInstance = null;
  let donutChartInstance = null;

  async function renderAll() {
    const activeVehicleId = KendaraAPI.getActiveVehicleId();
    const transactions = await KendaraAPI.getTransactions(activeVehicleId);
    const vehicle = await KendaraAPI.getVehicle(activeVehicleId);

    renderBarChart(transactions);
    renderDonutChart(transactions);
    renderMetrics(transactions, vehicle);
  }

  function renderBarChart(transactions) {
    const canvas = document.getElementById("analytics-bar-chart");
    if (!canvas) return;

    // Generate past 6 months list ending at current date (Nov 2026)
    const monthLabels = [];
    const monthKeys = []; // YYYY-MM
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${d.getFullYear()}-${mStr}`;
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      monthLabels.push(`${months[d.getMonth()]}`);
      monthKeys.push(key);
    }

    const expensesData = new Array(6).fill(0);
    const incomesData = new Array(6).fill(0);

    transactions.forEach((tx) => {
      const txMonthKey = tx.date ? tx.date.substring(0, 7) : "";
      const idx = monthKeys.indexOf(txMonthKey);
      if (idx !== -1) {
        if (tx.type === "pengeluaran") {
          expensesData[idx] += Number(tx.amount) || 0;
        } else if (tx.type === "pemasukan") {
          incomesData[idx] += Number(tx.amount) || 0;
        }
      }
    });

    if (barChartInstance) {
      barChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    barChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: "Pengeluaran",
            data: expensesData,
            backgroundColor: "#0F5132",
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: "Pemasukan",
            data: incomesData,
            backgroundColor: "#34D399",
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: "circle",
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            }
          },
          tooltip: {
            backgroundColor: "#0F172A",
            padding: 10,
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "bold" },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: ${Utils.formatRupiah(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, color: "#64748B" }
          },
          y: {
            grid: { color: "#F1F5F9" },
            ticks: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 },
              color: "#94A3B8",
              callback: function (val) {
                if (val >= 1000000) return (val / 1000000).toFixed(1) + "jt";
                if (val >= 1000) return (val / 1000).toFixed(0) + "rb";
                return val;
              }
            }
          }
        }
      }
    });
  }

  function renderDonutChart(transactions) {
    const canvas = document.getElementById("analytics-donut-chart");
    const legendContainer = document.getElementById("donut-legend-container");
    if (!canvas) return;

    const categoryTotals = {};
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type === "pengeluaran") {
        const cat = tx.category || "lainnya";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
        totalExpense += Number(tx.amount) || 0;
      }
    });

    const categoryColors = {
      bbm: "#3B82F6",
      ganti_oli: "#F59E0B",
      sparepart: "#8B5CF6",
      servis: "#6366F1",
      pajak: "#F43F5E",
      cicilan: "#FB923C",
      parkir_tol: "#64748B",
      cuci: "#14B8A6",
      lainnya: "#94A3B8"
    };

    const labels = [];
    const dataValues = [];
    const bgColors = [];

    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amount]) => {
        const catMeta = Utils.getCategoryDetails(cat);
        labels.push(catMeta.label);
        dataValues.push(amount);
        bgColors.push(categoryColors[cat] || "#94A3B8");
      });

    if (donutChartInstance) {
      donutChartInstance.destroy();
    }

    if (dataValues.length === 0) {
      // Empty state
      labels.push("Belum ada pengeluaran");
      dataValues.push(1);
      bgColors.push("#E2E8F0");
    }

    const ctx = canvas.getContext("2d");
    donutChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 2,
            borderColor: "#FFFFFF"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "74%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.raw;
                const percentage = totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0;
                return `${context.label}: ${Utils.formatRupiah(val)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // Custom HTML legend with percentages
    if (legendContainer) {
      if (totalExpense === 0) {
        legendContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Belum ada pengeluaran tercatat</p>';
      } else {
        let legHtml = "";
        Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5) // top 5
          .forEach(([cat, amount]) => {
            const catMeta = Utils.getCategoryDetails(cat);
            const color = categoryColors[cat] || "#94A3B8";
            const pct = Math.round((amount / totalExpense) * 100);
            legHtml += `
              <div class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-none text-xs">
                <div class="flex items-center space-x-2">
                  <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
                  <span class="text-slate-700 font-medium">${catMeta.label}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-900">${Utils.formatRupiah(amount)}</span>
                  <span class="text-slate-400 text-[11px]">(${pct}%)</span>
                </div>
              </div>
            `;
          });
        legendContainer.innerHTML = legHtml;
      }
    }
  }

  function renderMetrics(transactions, vehicle) {
    const costPerKmEl = document.getElementById("metric-cost-per-km");
    const fuelEfficiencyEl = document.getElementById("metric-fuel-efficiency");
    const topCategoryEl = document.getElementById("metric-top-category");

    let totalExpense = 0;
    let bbmTxs = [];
    const catTotals = {};

    transactions.forEach((tx) => {
      if (tx.type === "pengeluaran") {
        const amt = Number(tx.amount) || 0;
        totalExpense += amt;
        catTotals[tx.category] = (catTotals[tx.category] || 0) + amt;
        if (tx.category === "bbm" && tx.fuel_liters && tx.odometer) {
          bbmTxs.push(tx);
        }
      }
    });

    // Top Category
    let topCatName = "-";
    let topCatAmt = 0;
    Object.entries(catTotals).forEach(([cat, amt]) => {
      if (amt > topCatAmt) {
        topCatAmt = amt;
        topCatName = Utils.getCategoryDetails(cat).label;
      }
    });
    if (topCategoryEl) topCategoryEl.innerText = topCatName;

    // Cost Per KM (Total expenses / total odometer)
    if (costPerKmEl) {
      if (vehicle && vehicle.current_odometer && vehicle.current_odometer > 0) {
        const costPerKm = Math.round(totalExpense / vehicle.current_odometer);
        costPerKmEl.innerText = `${Utils.formatRupiah(costPerKm)} / KM`;
      } else {
        costPerKmEl.innerText = "Rp - / KM";
      }
    }

    // Fuel Efficiency (Average KM/L calculated from consecutive BBM entries)
    if (fuelEfficiencyEl) {
      bbmTxs.sort((a, b) => Number(a.odometer) - Number(b.odometer));
      let totalKm = 0;
      let totalLiters = 0;

      for (let i = 1; i < bbmTxs.length; i++) {
        const delta = Number(bbmTxs[i].odometer) - Number(bbmTxs[i - 1].odometer);
        if (delta > 0 && bbmTxs[i].fuel_liters > 0) {
          totalKm += delta;
          totalLiters += Number(bbmTxs[i].fuel_liters);
        }
      }

      if (totalLiters > 0 && totalKm > 0) {
        const avgEff = (totalKm / totalLiters).toFixed(1);
        fuelEfficiencyEl.innerText = `${avgEff} KM / L`;
      } else {
        // Fallback default estimate for Indonesian motor/mobil
        fuelEfficiencyEl.innerText = vehicle && vehicle.type === "mobil" ? "13.5 KM / L" : "42.8 KM / L";
      }
    }
  }

  return {
    renderAll
  };
})();

window.AnalyticsCharts = AnalyticsCharts;
