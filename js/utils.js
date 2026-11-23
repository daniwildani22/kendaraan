/**
 * KendaraTrack - Utility Helpers
 * Formatting, calculations, date helpers, category styling
 */

const Utils = {
  /**
   * Format number as Indonesian Rupiah (e.g., Rp 150.000)
   */
  formatRupiah(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "Rp 0";
    const num = Math.round(Number(amount));
    return "Rp " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  },

  /**
   * Format number as Kilometer string (e.g., 14.250 KM)
   */
  formatKm(km) {
    if (km === null || km === undefined || isNaN(km)) return "0 KM";
    const num = Math.round(Number(km));
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " KM";
  },

  /**
   * Format plain number with thousand separator
   */
  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return "0";
    return Number(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  },

  /**
   * Parse Indonesian Rupiah / formatted string into raw integer
   */
  parseCurrency(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const clean = str.replace(/[^\d]/g, "");
    return clean ? parseInt(clean, 10) : 0;
  },

  /**
   * Format date into Indonesian readable format (e.g., 23 Nov 2026)
   */
  formatDateIndo(dateStr, includeDayName = false) {
    if (!dateStr) return "-";
    const date = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    if (isNaN(date.getTime())) return dateStr;

    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    if (includeDayName) {
      return `${dayName}, ${day} ${month} ${year}`;
    }
    return `${day} ${month} ${year}`;
  },

  /**
   * Relative date label (Hari Ini, Kemarin, or 23 Nov 2026)
   */
  formatRelativeDate(dateStr) {
    if (!dateStr) return "-";
    const cleanDate = dateStr.split("T")[0];
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(today.getDate() - 1);
    const yYear = yesterdayDate.getFullYear();
    const yMonth = String(yesterdayDate.getMonth() + 1).padStart(2, "0");
    const yDay = String(yesterdayDate.getDate()).padStart(2, "0");
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

    if (cleanDate === todayStr) {
      return "Hari Ini";
    } else if (cleanDate === yesterdayStr) {
      return "Kemarin";
    } else {
      return this.formatDateIndo(cleanDate);
    }
  },

  /**
   * Get days difference from target date to today
   * > 0: upcoming (in X days)
   * = 0: today
   * < 0: overdue (X days ago)
   */
  getDaysDifference(targetDateStr) {
    if (!targetDateStr) return 9999;
    const target = new Date(targetDateStr.split("T")[0] + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate fuel efficiency (KM / Liter)
   */
  calculateKmLiter(currentOdometer, previousOdometer, liters) {
    if (!currentOdometer || !previousOdometer || !liters || Number(liters) <= 0) {
      return null;
    }
    const deltaKm = Number(currentOdometer) - Number(previousOdometer);
    if (deltaKm <= 0) return null;
    const efficiency = deltaKm / Number(liters);
    return Math.round(efficiency * 10) / 10; // 1 decimal place e.g. 42.5 KM/L
  },

  /**
   * Get Oil Health Status and Metrics
   */
  getOilHealth(vehicle) {
    if (!vehicle) return { percentUsed: 0, kmRemaining: 0, status: "aman", targetKm: 0 };

    const interval = vehicle.oil_interval_km || 3000;
    const lastKm = vehicle.last_oil_odometer || 0;
    const currentKm = vehicle.current_odometer || 0;
    const targetKm = lastKm + interval;
    const kmDriven = Math.max(0, currentKm - lastKm);
    const kmRemaining = targetKm - currentKm;

    const percentUsed = Math.min(100, Math.max(0, Math.round((kmDriven / interval) * 100)));

    let status = "aman"; // Green
    let statusLabel = "Kondisi Prima";
    let colorClass = "from-emerald-500 to-teal-600";
    let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";

    if (kmRemaining <= 0) {
      status = "lewat";
      statusLabel = "Waktunya Ganti!";
      colorClass = "from-red-500 to-rose-600";
      badgeClass = "bg-red-100 text-red-800 border-red-200";
    } else if (kmRemaining <= 500) {
      status = "segera";
      statusLabel = "Segera Ganti";
      colorClass = "from-amber-500 to-orange-500";
      badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    }

    return {
      lastKm,
      currentKm,
      targetKm,
      kmDriven,
      kmRemaining,
      percentUsed,
      status,
      statusLabel,
      colorClass,
      badgeClass,
      lastDate: vehicle.last_oil_date,
      oilBrand: vehicle.last_oil_brand || "Oli Rekomendasi Pabrikan"
    };
  },

  /**
   * Determine document and schedule status: 'aman', 'segera', 'lewat'
   */
  getScheduleStatus(dueDateStr, targetKm = null, currentVehicleKm = null) {
    const daysLeft = this.getDaysDifference(dueDateStr);
    let kmLeft = null;
    if (targetKm && currentVehicleKm) {
      kmLeft = targetKm - currentVehicleKm;
    }

    let status = "aman";
    let label = `${daysLeft} Hari Lagi`;
    let badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";

    if (daysLeft < 0 || (kmLeft !== null && kmLeft <= 0)) {
      status = "lewat";
      label = daysLeft < 0 ? `Lewat ${Math.abs(daysLeft)} Hari` : "Jatuh Tempo KM";
      badgeClass = "bg-rose-50 text-rose-700 border border-rose-200 font-semibold";
    } else if (daysLeft <= 14 || (kmLeft !== null && kmLeft <= 300)) {
      status = "segera";
      label = daysLeft === 0 ? "Hari Ini!" : `${daysLeft} Hari Lagi`;
      badgeClass = "bg-amber-50 text-amber-700 border border-amber-200 font-medium";
    }

    return {
      status,
      label,
      daysLeft,
      kmLeft,
      badgeClass
    };
  },

  /**
   * Category Metadata for styling, pastel backgrounds, and icons
   */
  getCategoryDetails(category) {
    const map = {
      bbm: {
        label: "Bahan Bakar (BBM)",
        icon: "fuel",
        bg: "bg-blue-50 text-blue-600 border-blue-100",
        badge: "bg-blue-100 text-blue-800",
        type: "pengeluaran"
      },
      ganti_oli: {
        label: "Ganti Oli",
        icon: "droplet",
        bg: "bg-amber-50 text-amber-600 border-amber-100",
        badge: "bg-amber-100 text-amber-800",
        type: "pengeluaran"
      },
      sparepart: {
        label: "Ganti Sparepart",
        icon: "wrench",
        bg: "bg-purple-50 text-purple-600 border-purple-100",
        badge: "bg-purple-100 text-purple-800",
        type: "pengeluaran"
      },
      servis: {
        label: "Servis Bengkel",
        icon: "settings",
        bg: "bg-indigo-50 text-indigo-600 border-indigo-100",
        badge: "bg-indigo-100 text-indigo-800",
        type: "pengeluaran"
      },
      pajak: {
        label: "Pajak & SIM",
        icon: "file-text",
        bg: "bg-rose-50 text-rose-600 border-rose-100",
        badge: "bg-rose-100 text-rose-800",
        type: "pengeluaran"
      },
      cicilan: {
        label: "Cicilan / Tagihan",
        icon: "credit-card",
        bg: "bg-orange-50 text-orange-600 border-orange-100",
        badge: "bg-orange-100 text-orange-800",
        type: "pengeluaran"
      },
      parkir_tol: {
        label: "Tol & Parkir",
        icon: "navigation",
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        badge: "bg-slate-200 text-slate-800",
        type: "pengeluaran"
      },
      cuci: {
        label: "Cuci & Perawatan",
        icon: "sparkles",
        bg: "bg-teal-50 text-teal-600 border-teal-100",
        badge: "bg-teal-100 text-teal-800",
        type: "pengeluaran"
      },
      pendapatan: {
        label: "Pendapatan Kendaraan",
        icon: "trending-up",
        bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
        badge: "bg-emerald-100 text-emerald-800",
        type: "pemasukan"
      },
      sewa: {
        label: "Sewa / Rental Kendaraan",
        icon: "key",
        bg: "bg-teal-50 text-teal-600 border-teal-100",
        badge: "bg-teal-100 text-teal-800",
        type: "pemasukan"
      },
      reimbursement: {
        label: "Klaim / Reimburse",
        icon: "shield-check",
        bg: "bg-sky-50 text-sky-600 border-sky-100",
        badge: "bg-sky-100 text-sky-800",
        type: "pemasukan"
      },
      penjualan_part: {
        label: "Jual Part / Aksesoris",
        icon: "package",
        bg: "bg-violet-50 text-violet-600 border-violet-100",
        badge: "bg-violet-100 text-violet-800",
        type: "pemasukan"
      },
      pemasukan_lain: {
        label: "Pemasukan Lainnya",
        icon: "plus-circle",
        bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
        badge: "bg-emerald-100 text-emerald-800",
        type: "pemasukan"
      },
      lainnya: {
        label: "Pengeluaran Lainnya",
        icon: "more-horizontal",
        bg: "bg-gray-100 text-gray-700 border-gray-200",
        badge: "bg-gray-200 text-gray-800",
        type: "pengeluaran"
      }
    };

    return map[category] || map.lainnya;
  },

  /**
   * Safe HTML string escape to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Generate UUID v4
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Compress and convert image File to Base64 Data URL (optimized for storage)
   */
  compressImage(file, maxDimension = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("File yang dipilih bukan gambar"));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Scale proportionally to fit within maxDimension
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Export as compressed JPEG
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Gagal memuat gambar"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Trigger browser file download (CSV)
   */
  downloadCSV(filename, csvContent) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

window.Utils = Utils;
