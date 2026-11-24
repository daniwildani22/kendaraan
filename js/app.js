/**
 * KendaraTrack - Main Application Controller
 * Handles state, view navigation, forms, modals, and reactive updates
 */

const App = (function () {
  // Application State
  const state = {
    activeTab: "home", // 'home' | 'calendar' | 'transactions' | 'service' | 'analytics'
    activeVehicleId: null,
    vehicles: [],
    transactions: [],
    maintenanceLogs: [],
    schedules: [],
    txFilterType: "semua", // 'semua' | 'pemasukan' | 'pengeluaran'
    txFilterCategory: "all",
    txSearchQuery: "",
    editingTransactionId: null,
    editingScheduleId: null,
    trips: [],
    activeTrip: null,
    gpsWatchId: null,
    gpsPermissionGranted: false,
    currentGpsPosition: null,
    tripTimerInterval: null,
    fleetActiveTab: "live",
    leafletMapInstance: null,
    selectedMapTrip: null
  };

  function updateGreetingText() {
    const greetingEl = document.getElementById("header-greeting-time");
    const user = (typeof KendaraAuth !== "undefined") ? KendaraAuth.getUser() : null;
    if (greetingEl) {
      const hour = new Date().getHours();
      let timeGreet = "Good Morning!";
      if (hour >= 4 && hour < 11) timeGreet = "Good Morning!";
      else if (hour >= 11 && hour < 15) timeGreet = "Good Afternoon!";
      else if (hour >= 15 && hour < 19) timeGreet = "Good Evening!";
      else timeGreet = "Good Night!";

      if (user && user.name) {
        const firstName = user.name.split(" ")[0];
        const isDemo = user.provider === "guest" || user.is_demo;
        greetingEl.innerHTML = `${timeGreet}, <span class="font-extrabold text-[#0B4F9C]">${Utils.escapeHTML(firstName)}</span>${isDemo ? ' <span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Demo</span>' : ''}`;
      } else {
        greetingEl.innerText = timeGreet;
      }
    }
  }

  /**
   * Boot the application
   */
  async function init() {
    initPWA();

    // Check if returning from Google / Supabase OAuth callback redirect
    try {
      if (typeof KendaraAuth !== "undefined" && KendaraAuth.handleOAuthCallback) {
        const oauthUser = await KendaraAuth.handleOAuthCallback();
        if (oauthUser) {
          showToast(`Berhasil masuk dengan Google! Halo, ${oauthUser.name || ""}`, "success", 4000);
        }
      }
    } catch (oauthErr) {
      console.warn("OAuth Callback warning:", oauthErr);
      showAuthAlert("Login Google gagal: " + oauthErr.message, "error");
      showToast("Login Google gagal: " + oauthErr.message, "error", 6500);
    }

    const isLoggedIn = checkAuthStatus();
    if (!isLoggedIn) {
      if (window.lucide) lucide.createIcons();
      return;
    }

    state.activeVehicleId = KendaraAPI.getActiveVehicleId();
    updateGreetingText();
    await refreshData();
    initFleetTracking();
    setupEventListeners();
    switchTab("home");
    renderVehicleDropdown();
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Refresh all data from repository
   */
  async function refreshData() {
    state.vehicles = await KendaraAPI.getVehicles();

    // Ensure valid active vehicle
    if (!state.vehicles.some((v) => v.id === state.activeVehicleId)) {
      state.activeVehicleId = state.vehicles[0] ? state.vehicles[0].id : null;
      if (state.activeVehicleId) {
        KendaraAPI.setActiveVehicleId(state.activeVehicleId);
      }
    }

    state.transactions = await KendaraAPI.getTransactions(state.activeVehicleId);
    state.maintenanceLogs = await KendaraAPI.getMaintenanceLogs(state.activeVehicleId);
    state.schedules = await KendaraAPI.getSchedules(state.activeVehicleId);
    state.trips = await KendaraAPI.getTrips(state.activeVehicleId);

    // Render active screen
    renderCurrentTab();
    renderVehicleDropdown();
    updateActiveTripUI();
  }

  /**
   * Switch Active Vehicle
   */
  async function switchVehicle(vehicleId) {
    state.activeVehicleId = vehicleId;
    KendaraAPI.setActiveVehicleId(vehicleId);
    await refreshData();
    showToast("Kendaraan aktif diubah", "success");
  }

  /**
   * Switch Navigation Tab
   */
  function switchTab(tabName) {
    state.activeTab = tabName;

    // Update bottom navigation bar styles
    document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
      const target = btn.getAttribute("data-tab");
      const iconWrap = btn.querySelector(".nav-icon-wrap");
      const label = btn.querySelector(".nav-label");

      if (target === tabName) {
        btn.classList.add("text-[#0B4F9C]", "font-bold");
        btn.classList.remove("text-slate-400", "font-normal");
        if (iconWrap) {
          iconWrap.classList.add("bg-blue-50", "text-[#0B4F9C]");
          iconWrap.classList.remove("text-slate-400");
        }
      } else {
        btn.classList.remove("text-[#0B4F9C]", "font-bold");
        btn.classList.add("text-slate-400", "font-normal");
        if (iconWrap) {
          iconWrap.classList.remove("bg-blue-50", "text-[#0B4F9C]");
          iconWrap.classList.add("text-slate-400");
        }
      }
    });

    // Hide all view screens & show selected
    document.querySelectorAll(".view-screen").forEach((screen) => {
      screen.classList.add("hidden");
    });

    const activeScreen = document.getElementById(`screen-${tabName}`);
    if (activeScreen) {
      activeScreen.classList.remove("hidden");
    }

    // Trigger tab-specific renders
    if (tabName === "home") {
      renderHomeScreen();
    } else if (tabName === "calendar") {
      Calendar.render();
    } else if (tabName === "transactions") {
      renderTransactionsScreen();
    } else if (tabName === "service") {
      renderServiceScreen();
    } else if (tabName === "analytics") {
      renderAnalyticsScreen();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    const mainEl = document.getElementById("app-main");
    if (mainEl) mainEl.scrollTop = 0;
    if (window.lucide) lucide.createIcons();
  }

  function renderCurrentTab() {
    switchTab(state.activeTab);
  }

  /**
   * Render Vehicle Dropdown in Top Greeting
   */
  function renderVehicleDropdown() {
    const container = document.getElementById("vehicle-select-container");
    if (!container) return;

    if (state.vehicles.length === 0) {
      container.innerHTML = '<span class="text-xs text-slate-400">Belum ada kendaraan</span>';
      return;
    }

    const activeVehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    let avatarHtml = "";
    if (activeVehicle && activeVehicle.photo_vehicle) {
      avatarHtml = `
        <button onclick="App.openPhotoLightbox('${activeVehicle.photo_vehicle}', '${activeVehicle.name}', 'vehicle', '${activeVehicle.id}', 'photo_vehicle')"
          title="Lihat Foto Kendaraan" class="w-6 h-6 rounded-full overflow-hidden border border-[#0B4F9C] shadow-2xs flex-shrink-0 active:scale-95 transition-transform hover:ring-2 hover:ring-blue-300">
          <img src="${activeVehicle.photo_vehicle}" alt="${activeVehicle.name}" class="w-full h-full object-cover">
        </button>
      `;
    }

    let selectHtml = `
      <div class="flex items-center gap-1.5">
        ${avatarHtml}
        <div class="relative flex items-center">
          <select id="vehicle-dropdown-select" onchange="App.switchVehicle(this.value)"
            class="appearance-none bg-transparent text-slate-900 font-extrabold text-sm py-0.5 pr-4 pl-0 focus:outline-none cursor-pointer max-w-[200px] truncate leading-tight">
    `;

    state.vehicles.forEach((v) => {
      const isSelected = v.id === state.activeVehicleId ? "selected" : "";
      const icon = v.type === "mobil" ? "🚗" : "🛵";
      selectHtml += `
        <option value="${v.id}" ${isSelected} class="text-xs font-semibold text-slate-800">
          ${v.name} • ${v.plate_number}
        </option>
      `;
    });

    selectHtml += `
          </select>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-600 absolute right-0 pointer-events-none"></i>
        </div>
      </div>
    `;
    container.innerHTML = selectHtml;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * ============================================================
   * 1. HOME SCREEN RENDERER
   * ============================================================
   */
  function renderHomeScreen() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);

    // Render Visible Vehicle Photo Showcase Card
    renderHomeVehicleCard(vehicle);

    // Calculate this month's expenses and incomes
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    let monthExpense = 0;
    let monthIncome = 0;

    state.transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(currentMonthKey)) {
        if (tx.type === "pengeluaran") {
          monthExpense += Number(tx.amount) || 0;
        } else if (tx.type === "pemasukan") {
          monthIncome += Number(tx.amount) || 0;
        }
      }
    });

    // Update Hero Card
    const heroExpenseEl = document.getElementById("home-month-expense");
    const heroIncomeEl = document.getElementById("home-month-income");
    const heroOdometerEl = document.getElementById("home-current-odometer");

    if (heroExpenseEl) heroExpenseEl.innerText = Utils.formatRupiah(monthExpense);
    if (heroIncomeEl) heroIncomeEl.innerText = `+${Utils.formatRupiah(monthIncome)}`;
    if (heroOdometerEl) {
      heroOdometerEl.innerText = vehicle ? Utils.formatKm(vehicle.current_odometer) : "0 KM";
    }

    // Render "Pengingat Terdekat" Alert Cards
    renderHomeReminders(vehicle);

    // Render "Aktivitas Terbaru" List
    renderHomeRecentActivities();
  }

  /**
   * Render Active Vehicle Photo & Specs Showcase Card on Home Screen
   */
  function renderHomeVehicleCard(vehicle) {
    const container = document.getElementById("home-vehicle-showcase-container");
    if (!container) return;

    if (!vehicle) {
      container.innerHTML = `
        <div class="p-6 bg-white rounded-3xl border border-dashed border-blue-200 text-center space-y-3 shadow-sm">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-[#0B4F9C] flex items-center justify-center">
            <i data-lucide="plus-circle" class="w-6 h-6"></i>
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-900">Garasi Anda Masih Kosong</h4>
            <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Daftarkan motor atau mobil pertama Anda untuk mulai memantau oli, servis, pajak & pengeluaran operasional.
            </p>
          </div>
          <button onclick="App.openAddVehicleModal()" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0A3981] to-[#0B4F9C] text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all inline-flex items-center gap-1.5">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Daftarkan Kendaraan Pertama</span>
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const hasPhoto = Boolean(vehicle.photo_vehicle);
    const vehicleTypeBadge = vehicle.type === "mobil" ? "🚗 Mobil" : "🛵 Sepeda Motor";
    const specsText = [vehicle.year, vehicle.color].filter(Boolean).join(" • ");

    if (hasPhoto) {
      container.innerHTML = `
        <div class="relative rounded-3xl overflow-hidden bg-slate-950 shadow-md border border-slate-100 group transition-all">
          <div class="relative w-full h-44 sm:h-48 overflow-hidden">
            <img src="${vehicle.photo_vehicle}" alt="${vehicle.name}" 
              class="w-full h-full object-cover group-hover:scale-105 transition-all duration-700">
            <!-- Subtle gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"></div>

            <!-- Top Row: Badge & Zoom Button -->
            <div class="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span class="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 flex items-center gap-1 shadow-xs">
                ${vehicleTypeBadge}
              </span>
              <div class="flex items-center gap-1.5">
                <button onclick="App.openActiveVehiclePhoto()" 
                  class="w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-sm active:scale-90" title="Perbesar Foto">
                  <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                </button>
                <label class="w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-sm cursor-pointer active:scale-90" title="Ganti Foto Kendaraan">
                  <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                  <input type="file" accept="image/*" class="hidden" onchange="App.handleVehiclePhotoUpload('photo_vehicle', event)">
                </label>
              </div>
            </div>

            <!-- Bottom Row: Vehicle Specs & Plate Number -->
            <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
              <div class="min-w-0 pr-2">
                <h3 class="text-base sm:text-lg font-black leading-tight text-white drop-shadow truncate">
                  ${vehicle.name}
                </h3>
                <p class="text-[11px] text-emerald-200 font-semibold drop-shadow mt-0.5">
                  ${specsText || "Kendaraan Pribadi"} • ${Utils.formatKm(vehicle.current_odometer)}
                </p>
              </div>
              <div class="bg-white/95 text-slate-900 px-3 py-1.5 rounded-xl shadow-lg border border-slate-200 flex-shrink-0 text-center">
                <p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Plat Nomor</p>
                <p class="text-xs font-black tracking-wide leading-tight mt-0.5 text-slate-900">${vehicle.plate_number}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="bg-white rounded-3xl p-4 border-2 border-dashed border-slate-200 flex items-center justify-between gap-3 shadow-xs hover:border-emerald-300 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <i data-lucide="camera" class="w-6 h-6"></i>
            </div>
            <div>
              <h4 class="text-xs sm:text-sm font-bold text-slate-900">${vehicle.name} (${vehicle.plate_number})</h4>
              <p class="text-[11px] text-slate-400">Tambahkan foto fisik kendaraan Anda</p>
            </div>
          </div>
          <label class="px-3 py-2 rounded-xl bg-gradient-to-r from-[#0A3981] to-[#0B4F9C] text-white text-xs font-bold cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0">
            <i data-lucide="upload" class="w-3.5 h-3.5"></i>
            <span>Upload Foto</span>
            <input type="file" accept="image/*" class="hidden" onchange="App.handleVehiclePhotoUpload('photo_vehicle', event)">
          </label>
        </div>
      `;
    }
  }

  function openActiveVehiclePhoto() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle || !vehicle.photo_vehicle) {
      showToast("Belum ada foto kendaraan. Silakan upload terlebih dahulu.", "info");
      return;
    }
    openPhotoLightbox(vehicle.photo_vehicle, `${vehicle.name} (${vehicle.plate_number})`, "vehicle", vehicle.id, "photo_vehicle");
  }

  /**
   * Render Horizontal/Vertical Reminder Cards on Home
   */
  function renderHomeReminders(vehicle) {
    const container = document.getElementById("home-reminders-list");
    if (!container) return;

    if (!vehicle) {
      container.innerHTML = `
        <div class="p-6 bg-white rounded-3xl border border-dashed border-blue-200 text-center space-y-3 shadow-sm">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-[#0B4F9C] flex items-center justify-center">
            <i data-lucide="plus-circle" class="w-6 h-6"></i>
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-900">Garasi Anda Masih Kosong</h4>
            <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Daftarkan motor atau mobil pertama Anda untuk mulai memantau oli, servis, pajak & pengeluaran operasional.
            </p>
          </div>
          <button onclick="App.openAddVehicleModal()" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0A3981] to-[#0B4F9C] text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all inline-flex items-center gap-1.5">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Daftarkan Kendaraan Pertama</span>
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const cards = [];

    // 1. Next Oil Change
    const oilHealth = Utils.getOilHealth(vehicle);
    cards.push({
      title: "Ganti Oli Mesin",
      category: "oli",
      icon: "droplet",
      badgeColor: oilHealth.badgeClass,
      badgeText: oilHealth.statusLabel,
      subtext: `Sisa ${Utils.formatKm(oilHealth.kmRemaining)} • Target ${Utils.formatKm(oilHealth.targetKm)}`,
      actionCall: "App.openQuickOilModal()"
    });

    // 2. STNK Annual Tax
    if (vehicle.tax_annual_date) {
      const taxStatus = Utils.getScheduleStatus(vehicle.tax_annual_date);
      cards.push({
        title: "Pajak STNK Tahunan",
        category: "pajak",
        icon: "file-text",
        badgeColor: taxStatus.badgeClass,
        badgeText: taxStatus.label,
        subtext: `Jatuh tempo: ${Utils.formatDateIndo(vehicle.tax_annual_date)}`,
        actionCall: "App.switchTab('calendar')"
      });
    }

    // 3. SIM Expiry
    if (vehicle.sim_expiry_date) {
      const simStatus = Utils.getScheduleStatus(vehicle.sim_expiry_date);
      cards.push({
        title: `Masa Berlaku ${vehicle.sim_type || "SIM"}`,
        category: "pajak",
        icon: "credit-card",
        badgeColor: simStatus.badgeClass,
        badgeText: simStatus.label,
        subtext: `Masa habis: ${Utils.formatDateIndo(vehicle.sim_expiry_date)}`,
        actionCall: "App.switchTab('calendar')"
      });
    }

    // 4. Next pending schedule from schedules table
    const upcomingSchedule = state.schedules.find((s) => !s.is_completed && s.category === "cicilan");
    if (upcomingSchedule) {
      const cicilanStatus = Utils.getScheduleStatus(upcomingSchedule.due_date);
      cards.push({
        title: upcomingSchedule.title,
        category: "cicilan",
        icon: "alert-circle",
        badgeColor: cicilanStatus.badgeClass,
        badgeText: cicilanStatus.label,
        subtext: `${Utils.formatRupiah(upcomingSchedule.est_cost)} • ${Utils.formatDateIndo(upcomingSchedule.due_date)}`,
        actionCall: `App.openPayScheduleModal('${upcomingSchedule.id}')`
      });
    }

    let html = "";
    cards.forEach((card) => {
      const cat = Utils.getCategoryDetails(card.category);
      html += `
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3 transition-all hover:shadow-md cursor-pointer"
             onclick="${card.actionCall}">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}">
              <i data-lucide="${card.icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-bold text-slate-800 truncate">${card.title}</h4>
              <p class="text-xs text-slate-500 mt-0.5 truncate">${card.subtext}</p>
            </div>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${card.badgeColor}">
            ${card.badgeText}
          </span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * Render Recent Activities List on Home
   */
  function renderHomeRecentActivities() {
    const container = document.getElementById("home-recent-activities");
    if (!container) return;

    const recent = state.transactions.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border border-slate-100">
          <p class="text-xs text-slate-400">Belum ada aktivitas transaksi.</p>
        </div>
      `;
      return;
    }

    let html = "";
    recent.forEach((tx) => {
      const cat = Utils.getCategoryDetails(tx.category);
      const isIncome = tx.type === "pemasukan";
      const amountPrefix = isIncome ? "+" : "-";
      const amountColor = isIncome ? "text-emerald-700" : "text-slate-800";

      const receiptPhotoHtml = tx.photo_receipt
        ? `
          <button onclick="App.openPhotoLightbox('${tx.photo_receipt}', 'Struk: ${cat.label} - ${Utils.formatRupiah(tx.amount)}')"
            title="Lihat Struk / Nota" class="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex-shrink-0 group active:scale-95 transition-transform">
            <img src="${tx.photo_receipt}" alt="Struk" class="w-full h-full object-cover group-hover:scale-110 transition-transform">
            <div class="absolute inset-0 bg-black/25 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <i data-lucide="zoom-in" class="w-3.5 h-3.5 text-white"></i>
            </div>
          </button>
        `
        : "";

      html += `
        <div class="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between gap-2.5 transition-all hover:shadow-md">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}">
              <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h5 class="text-xs sm:text-sm font-bold text-slate-800 truncate">${cat.label}</h5>
              <p class="text-[11px] text-slate-500 truncate flex items-center gap-1">
                <span>${Utils.formatRelativeDate(tx.date)}</span>
                ${tx.odometer ? `<span>• ${Utils.formatKm(tx.odometer)}</span>` : ""}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            ${receiptPhotoHtml}
            <div class="text-right">
              <span class="text-xs sm:text-sm font-bold ${amountColor}">
                ${amountPrefix} ${Utils.formatRupiah(tx.amount)}
              </span>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * ============================================================
   * 2. TRANSACTIONS SCREEN RENDERER
   * ============================================================
   */
  function renderTransactionsScreen() {
    const listContainer = document.getElementById("tx-list-container");
    const totalMasukEl = document.getElementById("tx-summary-masuk");
    const totalKeluarEl = document.getElementById("tx-summary-keluar");
    const selisihEl = document.getElementById("tx-summary-selisih");
    if (!listContainer) return;

    let filtered = [...state.transactions];

    // Filter by Type Pill
    if (state.txFilterType === "pemasukan") {
      filtered = filtered.filter((t) => t.type === "pemasukan");
    } else if (state.txFilterType === "pengeluaran") {
      filtered = filtered.filter((t) => t.type === "pengeluaran");
    }

    // Filter by Category Dropdown
    if (state.txFilterCategory !== "all") {
      filtered = filtered.filter((t) => t.category === state.txFilterCategory);
    }

    // Search query
    if (state.txSearchQuery.trim() !== "") {
      const q = state.txSearchQuery.toLowerCase();
      filtered = filtered.filter((t) => {
        return (
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.bengkel_name && t.bengkel_name.toLowerCase().includes(q)) ||
          (t.amount && String(t.amount).includes(q))
        );
      });
    }

    // Calculate Summaries
    let totalIn = 0;
    let totalOut = 0;
    filtered.forEach((t) => {
      if (t.type === "pemasukan") totalIn += Number(t.amount) || 0;
      if (t.type === "pengeluaran") totalOut += Number(t.amount) || 0;
    });

    if (totalMasukEl) totalMasukEl.innerText = Utils.formatRupiah(totalIn);
    if (totalKeluarEl) totalKeluarEl.innerText = Utils.formatRupiah(totalOut);
    if (selisihEl) {
      const diff = totalIn - totalOut;
      selisihEl.innerText = (diff >= 0 ? "+" : "") + Utils.formatRupiah(diff);
      selisihEl.className = `text-sm font-bold ${diff >= 0 ? "text-emerald-700" : "text-rose-600"}`;
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
          <div class="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
            <i data-lucide="receipt" class="w-6 h-6"></i>
          </div>
          <p class="text-sm font-semibold text-slate-700">Tidak ada transaksi ditemukan</p>
          <p class="text-xs text-slate-400 mt-0.5">Ubah filter atau tambahkan transaksi baru.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Group transactions by date
    const grouped = {};
    filtered.forEach((t) => {
      const d = t.date;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(t);
    });

    let html = "";
    Object.keys(grouped).forEach((dateKey) => {
      const relativeLabel = Utils.formatRelativeDate(dateKey);
      html += `
        <div class="mb-4">
          <div class="flex items-center justify-between py-1 px-1 mb-1.5">
            <span class="text-xs font-bold text-slate-700">${relativeLabel}</span>
            <span class="text-[11px] text-slate-400">${Utils.formatDateIndo(dateKey)}</span>
          </div>
          <div class="space-y-2">
      `;

      grouped[dateKey].forEach((tx) => {
        const cat = Utils.getCategoryDetails(tx.category);
        const isIncome = tx.type === "pemasukan";
        const prefix = isIncome ? "+" : "-";
        const color = isIncome ? "text-emerald-700 font-bold" : "text-slate-800 font-bold";

        html += `
          <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start justify-between gap-3 transition-all hover:shadow-md">
            <div class="flex items-start space-x-3 min-w-0">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg} mt-0.5">
                <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h5 class="text-sm font-bold text-slate-900 truncate">${cat.label}</h5>
                </div>
                ${tx.notes ? `<p class="text-xs text-slate-600 mt-0.5 line-clamp-1">${Utils.escapeHTML(tx.notes)}</p>` : ""}
                <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                  ${
                    tx.odometer
                      ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                          <i data-lucide="gauge" class="w-3 h-3"></i> ${Utils.formatKm(tx.odometer)}
                        </span>`
                      : ""
                  }
                  ${
                    tx.fuel_liters
                      ? `<span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
                          ${tx.fuel_liters} L • ${tx.fuel_type || "BBM"}
                        </span>`
                      : ""
                  }
                  ${
                    tx.bengkel_name
                      ? `<span class="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-medium">
                          ${Utils.escapeHTML(tx.bengkel_name)}
                        </span>`
                      : ""
                  }
                </div>
                ${
                  tx.photo_receipt
                    ? `
                  <div class="mt-2.5">
                    <button onclick="App.openPhotoLightbox('${tx.photo_receipt}', 'Struk: ${cat.label} - ${Utils.formatRupiah(tx.amount)}')"
                      class="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-slate-700 text-[11px] font-bold group transition-colors">
                      <img src="${tx.photo_receipt}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 group-hover:scale-105 transition-transform">
                      <span class="flex items-center gap-1 text-slate-700 group-hover:text-emerald-800">
                        <i data-lucide="image" class="w-3.5 h-3.5 text-emerald-600"></i> Lihat Foto Struk
                      </span>
                    </button>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <div class="text-right flex flex-col items-end flex-shrink-0">
              <span class="text-sm ${color}">${prefix} ${Utils.formatRupiah(tx.amount)}</span>
              <div class="flex items-center space-x-1 mt-2">
                <button onclick="App.openEditTransactionModal('${tx.id}')" title="Edit Transaksi"
                  class="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-colors">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="App.deleteTransactionConfirm('${tx.id}')" title="Hapus Transaksi"
                  class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function setTxFilterType(type) {
    state.txFilterType = type;
    document.querySelectorAll(".tx-filter-pill").forEach((pill) => {
      if (pill.getAttribute("data-type") === type) {
        pill.className = "tx-filter-pill px-4 py-1.5 rounded-full text-xs font-bold bg-[#0B4F9C] text-white shadow-sm";
      } else {
        pill.className = "tx-filter-pill px-4 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200";
      }
    });
    renderTransactionsScreen();
  }

  function setTxFilterCategory(cat) {
    state.txFilterCategory = cat;
    renderTransactionsScreen();
  }

  function setTxSearchQuery(q) {
    state.txSearchQuery = q;
    renderTransactionsScreen();
  }

  /**
   * ============================================================
   * 3. SERVIS & PART SCREEN RENDERER
   * ============================================================
   */
  function renderServiceScreen() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    // 1. Oil Health Tracker Card
    const oil = Utils.getOilHealth(vehicle);
    const oilKmRemainingEl = document.getElementById("oil-km-remaining");
    const oilTargetKmEl = document.getElementById("oil-target-km");
    const oilProgressBarEl = document.getElementById("oil-progress-bar");
    const oilPercentLabelEl = document.getElementById("oil-percent-label");
    const oilStatusBadgeEl = document.getElementById("oil-status-badge");
    const oilBrandEl = document.getElementById("oil-last-brand");
    const oilDateEl = document.getElementById("oil-last-date");

    if (oilKmRemainingEl) oilKmRemainingEl.innerText = `${Utils.formatKm(Math.max(0, oil.kmRemaining))} lagi`;
    if (oilTargetKmEl) oilTargetKmEl.innerText = `Target: ${Utils.formatKm(oil.targetKm)} (Interval ${Utils.formatKm(vehicle.oil_interval_km)})`;
    if (oilProgressBarEl) {
      oilProgressBarEl.style.width = `${oil.percentUsed}%`;
      oilProgressBarEl.className = `h-full rounded-full transition-all duration-500 bg-gradient-to-r ${oil.colorClass}`;
    }
    if (oilPercentLabelEl) oilPercentLabelEl.innerText = `${oil.percentUsed}% Terpakai`;
    if (oilStatusBadgeEl) {
      oilStatusBadgeEl.innerText = oil.statusLabel;
      oilStatusBadgeEl.className = `text-xs px-2.5 py-1 rounded-full font-semibold ${oil.badgeClass}`;
    }
    if (oilBrandEl) oilBrandEl.innerText = oil.oilBrand;
    if (oilDateEl) oilDateEl.innerText = Utils.formatDateIndo(oil.lastDate);

    // 2. Fuel Efficiency Card
    renderFuelCard(vehicle);

    // 3. Sparepart Replacement History Timeline
    renderSparepartTimeline();

    // 4. Vehicle Documents Card
    renderVehicleDocuments(vehicle);
  }

  function renderSparepartTimeline() {
    const timelineEl = document.getElementById("sparepart-timeline");
    if (!timelineEl) return;

    const parts = state.maintenanceLogs.filter((m) => m.log_type === "sparepart" || m.log_type === "servis");

    if (parts.length === 0) {
      timelineEl.innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border border-slate-100">
          <p class="text-xs text-slate-400">Belum ada catatan penggantian sparepart.</p>
        </div>
      `;
      return;
    }

    let html = "";
    parts.forEach((item, idx) => {
      const isLast = idx === parts.length - 1;
      html += `
        <div class="relative pl-6 pb-5 ${!isLast ? "border-l-2 border-slate-200" : ""}">
          <span class="absolute -left-2 top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-sm"></span>
          <div class="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h5 class="text-sm font-bold text-slate-900">${Utils.escapeHTML(item.item_name)}</h5>
                <p class="text-xs text-slate-500 mt-0.5">${item.brand ? Utils.escapeHTML(item.brand) : "Part Standar"}</p>
              </div>
              <span class="text-xs font-bold text-slate-800">${Utils.formatRupiah(item.cost)}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500">
              <span class="flex items-center gap-1">
                <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i> ${Utils.formatDateIndo(item.date)}
              </span>
              ${
                item.odometer
                  ? `<span class="flex items-center gap-1">
                      <i data-lucide="gauge" class="w-3 h-3 text-slate-400"></i> ${Utils.formatKm(item.odometer)}
                    </span>`
                  : ""
              }
              ${
                item.warranty_lifespan
                  ? `<span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                      ${Utils.escapeHTML(item.warranty_lifespan)}
                    </span>`
                  : ""
              }
            </div>
            ${
              item.photo_part
                ? `
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <button onclick="App.openPhotoLightbox('${item.photo_part}', '${Utils.escapeHTML(item.item_name)}', 'maintenance', '${item.id}')"
                  class="flex items-center space-x-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors">
                  <img src="${item.photo_part}" class="w-8 h-8 rounded-lg object-cover border border-slate-200">
                  <span class="flex items-center gap-1"><i data-lucide="image" class="w-3.5 h-3.5"></i> Lihat Foto Part / Nota</span>
                </button>
                <button onclick="App.downloadPhoto('${item.photo_part}', 'sparepart_${item.id}.jpg')"
                  title="Unduh Foto Part" class="p-1.5 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-slate-50 transition-colors">
                  <i data-lucide="download" class="w-4 h-4"></i>
                </button>
              </div>
            `
                : ""
            }

            <!-- Lokasi Tempat Penggantian Alat (Google Maps) -->
            ${
              item.workshop || item.workshop_address
                ? `
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <div class="flex items-center space-x-2 min-w-0">
                  <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-slate-800 truncate">${Utils.escapeHTML(item.workshop || "Bengkel Langganan")}</p>
                    <p class="text-[10px] text-slate-400 truncate">${Utils.escapeHTML(item.workshop_address || "Lokasi pergantian alat")}</p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button onclick="App.openWorkshopMapModal('${item.id}')"
                    class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 transition-colors active:scale-95">
                    <i data-lucide="map" class="w-3 h-3"></i> Peta
                  </button>
                  <a href="${item.workshop_maps_url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((item.workshop || '') + ' ' + (item.workshop_address || ''))}" 
                    target="_blank" rel="noopener noreferrer" title="Buka Aplikasi Google Maps"
                    class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors">
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                  </a>
                </div>
              </div>
            `
                : ""
            }
            ${item.notes ? `<p class="text-xs text-slate-400 mt-1.5 italic">${Utils.escapeHTML(item.notes)}</p>` : ""}
          </div>
        </div>
      `;
    });

    timelineEl.innerHTML = html;
  }

  function renderVehicleDocuments(vehicle) {
    const docContainer = document.getElementById("vehicle-documents-card");
    if (!docContainer) return;

    const annualTaxStatus = Utils.getScheduleStatus(vehicle.tax_annual_date);
    const fiveYearTaxStatus = Utils.getScheduleStatus(vehicle.tax_5year_date);
    const simStatus = Utils.getScheduleStatus(vehicle.sim_expiry_date);

    const docPhotos = [
      { key: "photo_vehicle", title: "Foto Kendaraan", icon: "camera", desc: "Tampak fisik motor / mobil" },
      { key: "photo_sim", title: "Foto SIM", icon: "credit-card", desc: vehicle.sim_type || "SIM Pengemudi" },
      { key: "photo_stnk", title: "Foto STNK", icon: "file-text", desc: "Lembar Pajak & STNK" },
      { key: "photo_bpkb", title: "Foto BPKB", icon: "book-open", desc: "Buku Pemilik Kendaraan" }
    ];

    let photosGridHtml = "";
    docPhotos.forEach((doc) => {
      const photoUrl = vehicle[doc.key];
      if (photoUrl) {
        photosGridHtml += `
          <div class="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm flex flex-col justify-between h-36">
            <img src="${photoUrl}" class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-75 transition-opacity">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
            
            <div class="relative z-10 p-2 flex justify-between items-start">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-sm">${doc.title}</span>
              <button onclick="App.openPhotoLightbox('${photoUrl}', '${doc.title} - ${vehicle.name}', 'vehicle', '${vehicle.id}', '${doc.key}')" 
                class="w-6 h-6 rounded-full bg-white/80 hover:bg-white text-slate-800 flex items-center justify-center transition-colors">
                <i data-lucide="maximize-2" class="w-3 h-3"></i>
              </button>
            </div>

            <div class="relative z-10 p-2 flex items-center justify-between text-white text-[11px]">
              <button onclick="App.openPhotoLightbox('${photoUrl}', '${doc.title} - ${vehicle.name}', 'vehicle', '${vehicle.id}', '${doc.key}')" 
                class="font-semibold hover:underline flex items-center gap-1">
                <i data-lucide="eye" class="w-3 h-3"></i> Lihat
              </button>
              <label class="font-semibold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg cursor-pointer transition-colors">
                Ganti
                <input type="file" accept="image/*" class="hidden" onchange="App.handleVehiclePhotoUpload('${doc.key}', event)">
              </label>
            </div>
          </div>
        `;
      } else {
        photosGridHtml += `
          <div class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-3 flex flex-col items-center justify-center text-center h-36 hover:bg-emerald-50/40 hover:border-emerald-300 transition-colors">
            <div class="w-9 h-9 rounded-xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-slate-400 mb-1.5">
              <i data-lucide="${doc.icon}" class="w-4 h-4 text-emerald-700"></i>
            </div>
            <p class="text-xs font-bold text-slate-800 leading-tight">${doc.title}</p>
            <p class="text-[10px] text-slate-400 mt-0.5 mb-2">${doc.desc}</p>
            <label class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#0A3981] to-[#0B4F9C] text-white text-[10px] font-bold cursor-pointer shadow-xs active:scale-95 flex items-center gap-1">
              <i data-lucide="upload" class="w-3 h-3"></i> Upload
              <input type="file" accept="image/*" class="hidden" onchange="App.handleVehiclePhotoUpload('${doc.key}', event)">
            </label>
          </div>
        `;
      }
    });

    docContainer.innerHTML = `
      <div class="space-y-4">
        <!-- Status Masa Berlaku Dokumen -->
        <div class="space-y-2.5">
          <!-- Plat Nomor -->
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                ID
              </div>
              <div>
                <p class="text-xs text-slate-400">Plat Nomor Kendaraan</p>
                <p class="text-sm font-bold text-slate-900">${vehicle.plate_number}</p>
              </div>
            </div>
            <span class="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">Terdaftar</span>
          </div>

          <!-- Pajak Tahunan -->
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <div>
              <p class="text-xs text-slate-400">Pajak STNK Tahunan</p>
              <p class="text-sm font-bold text-slate-900">${Utils.formatDateIndo(vehicle.tax_annual_date)}</p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full ${annualTaxStatus.badgeClass}">
              ${annualTaxStatus.label}
            </span>
          </div>

          <!-- Pajak 5 Tahunan -->
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <div>
              <p class="text-xs text-slate-400">Pajak 5 Tahunan (Ganti Plat Kaleng)</p>
              <p class="text-sm font-bold text-slate-900">${Utils.formatDateIndo(vehicle.tax_5year_date)}</p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full ${fiveYearTaxStatus.badgeClass}">
              ${fiveYearTaxStatus.label}
            </span>
          </div>

          <!-- SIM Pengendara -->
          <div class="flex items-center justify-between py-1.5">
            <div>
              <p class="text-xs text-slate-400">Masa Berlaku ${vehicle.sim_type || "SIM"}</p>
              <p class="text-sm font-bold text-slate-900">${Utils.formatDateIndo(vehicle.sim_expiry_date)}</p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full ${simStatus.badgeClass}">
              ${simStatus.label}
            </span>
          </div>
        </div>

        <!-- Galeri Dokumen Fisik & Kendaraan -->
        <div class="pt-3 border-t border-slate-100">
          <div class="flex items-center justify-between mb-2.5">
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <i data-lucide="camera" class="w-4 h-4 text-emerald-700"></i> Foto Fisik Dokumen & Unit
            </h4>
            <span class="text-[10px] text-slate-400">Klik untuk perbesar / unduh</span>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            ${photosGridHtml}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * ============================================================
   * 4. ANALITIK & PROFIL SCREEN RENDERER
   * ============================================================
   */
  function renderAnalyticsScreen() {
    AnalyticsCharts.renderAll();
    renderVehicleListManager();
    renderDatabaseSettingsForm();
  }

  function renderVehicleListManager() {
    const container = document.getElementById("analytics-vehicle-list");
    if (!container) return;

    let html = "";
    state.vehicles.forEach((v) => {
      const isCurrent = v.id === state.activeVehicleId;
      html += `
        <div class="bg-white rounded-2xl p-4 border ${isCurrent ? "border-emerald-500 bg-emerald-50/20" : "border-slate-100"} shadow-sm flex items-center justify-between gap-3">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
              ${v.type === "mobil" ? "🚗" : "🛵"}
            </div>
            <div>
              <h5 class="text-sm font-bold text-slate-900">${Utils.escapeHTML(v.name)}</h5>
              <p class="text-xs text-slate-500">${v.plate_number} • ${Utils.formatKm(v.current_odometer)}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            ${
              isCurrent
                ? `<span class="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">Aktif</span>`
                : `<button onclick="App.switchVehicle('${v.id}')" class="text-xs font-medium text-slate-600 hover:text-emerald-700 px-2.5 py-1 rounded-full border border-slate-200 bg-white">Pilih</button>`
            }
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderDatabaseSettingsForm() {
    const config = KendaraAPI.getConfig();
    const providerSelect = document.getElementById("db-provider-select");
    const gasSection = document.getElementById("db-gas-config-section");
    const supabaseSection = document.getElementById("db-supabase-config-section");
    const gasUrlInput = document.getElementById("db-gas-url-input");
    const supabaseUrlInput = document.getElementById("db-supabase-url-input");
    const supabaseKeyInput = document.getElementById("db-supabase-key-input");

    if (providerSelect) providerSelect.value = config.provider;
    if (gasUrlInput) gasUrlInput.value = config.gasUrl || "";
    if (supabaseUrlInput) supabaseUrlInput.value = config.supabaseUrl || "";
    if (supabaseKeyInput) supabaseKeyInput.value = config.supabaseAnonKey || "";

    toggleDbProviderInputs(config.provider);
  }

  function toggleDbProviderInputs(provider) {
    const gasSection = document.getElementById("db-gas-config-section");
    const supabaseSection = document.getElementById("db-supabase-config-section");

    if (gasSection) gasSection.classList.toggle("hidden", provider !== "GAS");
    if (supabaseSection) supabaseSection.classList.toggle("hidden", provider !== "SUPABASE");
  }

  /**
   * Save Database Configuration
   */
  async function saveDatabaseSettings() {
    const providerSelect = document.getElementById("db-provider-select");
    const provider = providerSelect ? providerSelect.value : "SUPABASE";
    const gasUrl = (document.getElementById("db-gas-url-input")?.value || "").trim();
    const supabaseUrl = (document.getElementById("db-supabase-url-input")?.value || "").trim();
    const supabaseAnonKey = (document.getElementById("db-supabase-key-input")?.value || "").trim();

    const currentConfig = KendaraAPI.getConfig();
    KendaraAPI.setConfig({
      provider,
      gasUrl: gasUrl || currentConfig.gasUrl,
      supabaseUrl: supabaseUrl || currentConfig.supabaseUrl,
      supabaseAnonKey: supabaseAnonKey || currentConfig.supabaseAnonKey
    });

    showToast("Pengaturan database berhasil disimpan", "success");
    await testDatabaseConnection();
    await refreshData();
  }

  /**
   * Test Connection to active provider
   */
  async function testDatabaseConnection() {
    const statusEl = document.getElementById("db-connection-status");
    if (statusEl) {
      statusEl.className = "text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-2";
      statusEl.innerHTML = `<span class="animate-spin">🔄</span> Menguji koneksi cloud database...`;
    }

    try {
      const res = await KendaraAPI.testConnection();
      if (statusEl) {
        if (res.warning) {
          statusEl.className = "text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2";
          statusEl.innerHTML = `⚠️ ${res.message}`;
        } else {
          statusEl.className = "text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mt-2";
          statusEl.innerHTML = `✅ ${res.message}`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.className = "text-xs font-semibold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 mt-2";
        statusEl.innerHTML = `❌ ${err.message}`;
      }
    }
  }

  /**
   * Copy Cross-Device Sync Link for Mobile (Secure, without exposing keys)
   */
  function copySyncLinkForMobile() {
    const syncUrl = KendaraAPI.generateSyncUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(syncUrl);
      showToast("Tautan aplikasi disalin! Buka tautan ini di browser HP Anda.", "success");
    } else {
      prompt("Salin tautan aplikasi ini dan buka di HP Anda:", syncUrl);
    }
  }

  /**
   * Export CSV
   */
  async function exportDataCSV() {
    try {
      const csv = await KendaraAPI.exportCSV(state.activeVehicleId);
      const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
      const filename = `kendaratrack_${vehicle ? vehicle.plate_number.replace(/\s+/g, "_") : "semua"}_${new Date().toISOString().split("T")[0]}.csv`;
      Utils.downloadCSV(filename, csv);
      showToast("Data CSV berhasil diunduh!", "success");
    } catch (err) {
      showToast("Gagal mengunduh CSV: " + err.message, "error");
    }
  }

  /**
   * Reset to Demo Data
   */
  async function resetDemoData() {
    if (confirm("Apakah Anda yakin ingin mereset seluruh data kembali ke sampel awal?")) {
      await KendaraAPI.resetToDemoData();
      await refreshData();
      showToast("Data berhasil direset ke demo default", "success");
    }
  }

  /**
   * ============================================================
   * 5. MODALS & FORMS HANDLERS
   * ============================================================
   */

  // Quick Update KM Modal
  function openUpdateKmModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    document.getElementById("modal-update-km-current").innerText = Utils.formatKm(vehicle.current_odometer);
    const input = document.getElementById("modal-update-km-input");
    input.value = vehicle.current_odometer;
    openModal("modal-update-km");
  }

  async function submitUpdateKm(e) {
    if (e) e.preventDefault();
    const newKm = document.getElementById("modal-update-km-input").value;
    if (!newKm || Number(newKm) < 0) {
      showToast("Masukkan angka KM yang valid", "error");
      return;
    }

    await KendaraAPI.updateOdometer(state.activeVehicleId, Number(newKm));
    closeModal("modal-update-km");
    await refreshData();
    showToast(`Odometer diperbarui ke ${Utils.formatKm(newKm)}`, "success");
  }

  // Category definition groups for Pengeluaran & Pemasukan
  const EXPENSE_CATEGORY_GROUPS = [
    {
      group: "⛽ Operasional & Perjalanan",
      options: [
        { value: "bbm", label: "Bahan Bakar (BBM)" },
        { value: "parkir_tol", label: "Tol & Parkir" },
        { value: "cuci", label: "Cuci & Perawatan Kendaraan" }
      ]
    },
    {
      group: "📋 Pajak & Tagihan",
      options: [
        { value: "pajak", label: "Pajak STNK & SIM" },
        { value: "cicilan", label: "Cicilan / Tagihan Kendaraan" }
      ]
    },
    {
      group: "📦 Lainnya",
      options: [
        { value: "lainnya", label: "Pengeluaran Lain-lain" }
      ]
    }
  ];

  const INCOME_CATEGORY_GROUPS = [
    {
      group: "💵 Sumber Pemasukan",
      options: [
        { value: "pendapatan", label: "Pendapatan Operasional / Narik (Ojol / Muatan)" },
        { value: "sewa", label: "Sewa / Rental Kendaraan" },
        { value: "reimbursement", label: "Klaim / Reimbursement Kantor" },
        { value: "penjualan_part", label: "Penjualan Part / Aksesoris Bekas" },
        { value: "pemasukan_lain", label: "Pemasukan Lain-lain" }
      ]
    }
  ];

  // Add / Edit Transaction Modal
  function openAddTransactionModal(presetCategory = null) {
    state.editingTransactionId = null;
    document.getElementById("tx-modal-title").innerText = "Tambah Transaksi";
    document.getElementById("tx-form").reset();

    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    document.getElementById("tx-form-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("tx-form-odometer").value = vehicle ? vehicle.current_odometer : "";

    setTransactionTypeInForm("pengeluaran", presetCategory || "bbm");
    openModal("modal-transaction");
  }

  function openEditTransactionModal(id) {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;

    state.editingTransactionId = id;
    document.getElementById("tx-modal-title").innerText = "Edit Transaksi";

    setTransactionTypeInForm(tx.type, tx.category);
    document.getElementById("tx-form-amount").value = tx.amount;
    document.getElementById("tx-form-date").value = tx.date;
    document.getElementById("tx-form-odometer").value = tx.odometer || "";
    document.getElementById("tx-form-notes").value = tx.notes || "";
    document.getElementById("tx-form-bengkel").value = tx.bengkel_name || "";

    if (tx.category === "bbm") {
      document.getElementById("tx-form-fuel-liters").value = tx.fuel_liters || "";
      document.getElementById("tx-form-fuel-type").value = tx.fuel_type || "Pertamax";
    }

    openModal("modal-transaction");
  }

  function populateTransactionCategories(type, selectedCategory) {
    const catSelect = document.getElementById("tx-form-category");
    if (!catSelect) return;

    const isExpense = type === "pengeluaran";
    const groups = isExpense ? EXPENSE_CATEGORY_GROUPS : INCOME_CATEGORY_GROUPS;

    let html = "";
    groups.forEach((g) => {
      html += `<optgroup label="${g.group}">`;
      g.options.forEach((opt) => {
        html += `<option value="${opt.value}">${opt.label}</option>`;
      });
      html += `</optgroup>`;
    });

    // If editing an existing transaction recorded from quick shortcuts (oli, sparepart, servis)
    if (selectedCategory && !groups.some((g) => g.options.some((o) => o.value === selectedCategory))) {
      let legacyLabel = selectedCategory;
      if (selectedCategory === "ganti_oli") legacyLabel = "Ganti Oli (Dari Pintasan Beranda)";
      else if (selectedCategory === "sparepart") legacyLabel = "Ganti Sparepart (Dari Pintasan Beranda)";
      else if (selectedCategory === "servis") legacyLabel = "Servis Berkala (Dari Jadwal)";
      html += `<optgroup label="🔧 Perawatan Tercatat Khusus"><option value="${selectedCategory}">${legacyLabel}</option></optgroup>`;
    }

    catSelect.innerHTML = html;

    if (selectedCategory && catSelect.querySelector(`option[value="${selectedCategory}"]`)) {
      catSelect.value = selectedCategory;
    } else {
      catSelect.value = isExpense ? "bbm" : "pendapatan";
    }

    handleTransactionCategoryChange(catSelect.value);
  }

  function setTransactionTypeInForm(type, selectedCategory = null) {
    document.getElementById("tx-form-type").value = type;
    const btnOut = document.getElementById("tx-type-btn-out");
    const btnIn = document.getElementById("tx-type-btn-in");
    const catLabel = document.getElementById("tx-form-category-label");
    const hintBox = document.getElementById("tx-maintenance-hint");
    const bengkelLabel = document.getElementById("tx-form-bengkel-label");
    const bengkelInput = document.getElementById("tx-form-bengkel");

    if (type === "pengeluaran") {
      btnOut.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#0A3981] to-[#0B4F9C] text-white shadow-sm transition-all";
      btnIn.className = "flex-1 py-2 text-xs font-medium rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
      if (catLabel) catLabel.innerText = "Kategori Pengeluaran";
      if (hintBox) hintBox.classList.remove("hidden");
      if (bengkelLabel) bengkelLabel.innerText = "Nama Toko / Bengkel / SPBU (Opsional)";
      if (bengkelInput) bengkelInput.placeholder = "Contoh: SPBU Pertamina / AHASS";
    } else {
      btnIn.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm transition-all";
      btnOut.className = "flex-1 py-2 text-xs font-medium rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
      if (catLabel) catLabel.innerText = "Kategori Pemasukan";
      if (hintBox) hintBox.classList.add("hidden");
      if (bengkelLabel) bengkelLabel.innerText = "Sumber Pemasukan / Klien / Penyetor (Opsional)";
      if (bengkelInput) bengkelInput.placeholder = "Contoh: Penghasilan Grab / Konsumen Sewa";
    }

    populateTransactionCategories(type, selectedCategory);
  }

  function handleTransactionCategoryChange(category) {
    toggleFuelFields(category);
  }

  function toggleFuelFields(category) {
    const fuelContainer = document.getElementById("tx-fuel-details-section");
    const currentType = document.getElementById("tx-form-type") ? document.getElementById("tx-form-type").value : "pengeluaran";
    if (fuelContainer) {
      fuelContainer.classList.toggle("hidden", currentType !== "pengeluaran" || category !== "bbm");
    }
  }

  function switchToDedicatedModal(type) {
    const currentAmount = document.getElementById("tx-form-amount") ? document.getElementById("tx-form-amount").value : "";
    const currentDate = document.getElementById("tx-form-date") ? document.getElementById("tx-form-date").value : "";
    const currentOdo = document.getElementById("tx-form-odometer") ? document.getElementById("tx-form-odometer").value : "";
    const currentBengkel = document.getElementById("tx-form-bengkel") ? document.getElementById("tx-form-bengkel").value : "";
    const currentNotes = document.getElementById("tx-form-notes") ? document.getElementById("tx-form-notes").value : "";

    closeModal("modal-transaction");

    if (type === "oli") {
      openQuickOilModal();
      if (currentAmount) document.getElementById("oil-form-cost").value = currentAmount;
      if (currentDate) document.getElementById("oil-form-date").value = currentDate;
      if (currentOdo) document.getElementById("oil-form-odometer").value = currentOdo;
      if (currentBengkel) document.getElementById("oil-form-workshop").value = currentBengkel;
      if (currentNotes) document.getElementById("oil-form-notes").value = currentNotes;
    } else if (type === "sparepart") {
      openQuickSparepartModal();
      if (currentAmount) document.getElementById("part-form-cost").value = currentAmount;
      if (currentDate) document.getElementById("part-form-date").value = currentDate;
      if (currentOdo) document.getElementById("part-form-odometer").value = currentOdo;
      if (currentBengkel) document.getElementById("part-form-workshop").value = currentBengkel;
      if (currentNotes) {
        const nameEl = document.getElementById("part-form-part-name");
        if (nameEl) nameEl.value = currentNotes;
      }
    } else if (type === "jadwal") {
      openAddScheduleModal();
      if (currentAmount) document.getElementById("sch-form-cost").value = currentAmount;
      if (currentDate) document.getElementById("sch-form-target-date").value = currentDate;
      if (currentNotes) document.getElementById("sch-form-title").value = currentNotes;
    } else if (type === "bbm") {
      openQuickFuelModal();
      if (currentAmount) document.getElementById("qfuel-amount").value = currentAmount;
      if (currentDate) document.getElementById("qfuel-date").value = currentDate;
      if (currentOdo) document.getElementById("qfuel-odometer").value = currentOdo;
      if (currentBengkel) document.getElementById("qfuel-station").value = currentBengkel;
      if (currentNotes) document.getElementById("qfuel-notes").value = currentNotes;
      syncFuelAmountToLiters();
    }
  }

  async function submitTransactionForm(e) {
    if (e) e.preventDefault();

    const type = document.getElementById("tx-form-type").value;
    const category = document.getElementById("tx-form-category").value;
    const amount = Number(document.getElementById("tx-form-amount").value);
    const date = document.getElementById("tx-form-date").value;
    const odometer = document.getElementById("tx-form-odometer").value;
    const notes = document.getElementById("tx-form-notes").value.trim();
    const bengkel = document.getElementById("tx-form-bengkel").value.trim();

    if (!amount || amount <= 0) {
      showToast("Nominal transaksi harus lebih dari 0", "error");
      return;
    }
    if (!date) {
      showToast("Pilih tanggal transaksi", "error");
      return;
    }

    let fuelLiters = null;
    let fuelType = "";
    if (category === "bbm") {
      fuelLiters = Number(document.getElementById("tx-form-fuel-liters").value) || null;
      fuelType = document.getElementById("tx-form-fuel-type").value;
    }

    let photoReceipt = "";
    const photoInput = document.getElementById("tx-form-photo");
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoReceipt = await Utils.compressImage(photoInput.files[0]);
      } catch (err) {
        console.warn("Gagal compress foto struk", err);
      }
    }

    const payload = {
      vehicle_id: state.activeVehicleId,
      type,
      category,
      amount,
      date,
      odometer: odometer ? Number(odometer) : null,
      fuel_liters: fuelLiters,
      fuel_type: fuelType,
      notes,
      bengkel_name: bengkel,
      photo_receipt: photoReceipt
    };

    try {
      if (state.editingTransactionId) {
        payload.id = state.editingTransactionId;
        await KendaraAPI.updateTransaction(payload);
        showToast("Transaksi berhasil diperbarui!", "success");
      } else {
        await KendaraAPI.addTransaction(payload);
        showToast("Transaksi berhasil ditambahkan!", "success");
      }
      closeModal("modal-transaction");
      await refreshData();
    } catch (err) {
      showToast("Gagal menyimpan transaksi: " + err.message, "error");
    }
  }

  async function deleteTransactionConfirm(id) {
    if (confirm("Hapus transaksi ini?")) {
      await KendaraAPI.deleteTransaction(id);
      await refreshData();
      showToast("Transaksi berhasil dihapus", "success");
    }
  }

  // Quick Oil Change Log Modal
  function openQuickOilModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    document.getElementById("oil-form").reset();
    document.getElementById("oil-form-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("oil-form-odometer").value = vehicle.current_odometer;
    document.getElementById("oil-form-brand").value = vehicle.last_oil_brand || "";
    openModal("modal-quick-oil");
  }

  async function submitQuickOilForm(e) {
    if (e) e.preventDefault();

    const date = document.getElementById("oil-form-date").value;
    const odometer = Number(document.getElementById("oil-form-odometer").value);
    const brand = document.getElementById("oil-form-brand").value.trim();
    const cost = Number(document.getElementById("oil-form-cost").value) || 0;
    const workshop = document.getElementById("oil-form-workshop").value.trim();
    const workshopAddress = document.getElementById("oil-form-workshop-address") ? document.getElementById("oil-form-workshop-address").value.trim() : "";
    const notes = document.getElementById("oil-form-notes").value.trim();

    if (!odometer || odometer <= 0) {
      showToast("Masukkan KM odometer saat ganti oli", "error");
      return;
    }

    let photoOil = "";
    const photoInput = document.getElementById("oil-form-photo");
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoOil = await Utils.compressImage(photoInput.files[0]);
      } catch (err) {
        console.warn("Gagal compress foto oli", err);
      }
    }

    const mapsQuery = `${workshop} ${workshopAddress}`.trim();
    const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : "";

    // 1. Add maintenance log
    await KendaraAPI.addMaintenanceLog({
      vehicle_id: state.activeVehicleId,
      log_type: "oli",
      item_name: "Ganti Oli Mesin",
      brand: brand || "Oli Mesin",
      odometer,
      date,
      cost,
      workshop: workshop || "Bengkel Langganan",
      workshop_address: workshopAddress,
      workshop_maps_url: mapsUrl,
      warranty_lifespan: "Interval Rutin",
      photo_part: photoOil,
      notes
    });

    // 2. Add expense transaction if cost > 0
    if (cost > 0) {
      await KendaraAPI.addTransaction({
        vehicle_id: state.activeVehicleId,
        type: "pengeluaran",
        category: "ganti_oli",
        amount: cost,
        date,
        odometer,
        notes: `Ganti oli mesin (${brand}). ${notes}`,
        bengkel_name: workshop,
        photo_receipt: photoOil
      });
    }

    closeModal("modal-quick-oil");
    await refreshData();
    showToast("Catatan ganti oli berhasil disimpan!", "success");
  }

  // Quick Sparepart Modal
  function openQuickSparepartModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    document.getElementById("part-form").reset();
    document.getElementById("part-form-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("part-form-odometer").value = vehicle.current_odometer;
    openModal("modal-quick-sparepart");
  }

  async function submitQuickSparepartForm(e) {
    if (e) e.preventDefault();

    const itemName = document.getElementById("part-form-name").value.trim();
    const brand = document.getElementById("part-form-brand").value.trim();
    const date = document.getElementById("part-form-date").value;
    const odometer = Number(document.getElementById("part-form-odometer").value) || null;
    const cost = Number(document.getElementById("part-form-cost").value) || 0;
    const warranty = document.getElementById("part-form-warranty").value.trim();
    const workshop = document.getElementById("part-form-workshop").value.trim();
    const workshopAddress = document.getElementById("part-form-workshop-address") ? document.getElementById("part-form-workshop-address").value.trim() : "";
    const notes = document.getElementById("part-form-notes").value.trim();

    if (!itemName) {
      showToast("Nama sparepart harus diisi", "error");
      return;
    }

    let photoPart = "";
    const photoInput = document.getElementById("part-form-photo");
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoPart = await Utils.compressImage(photoInput.files[0]);
      } catch (err) {
        console.warn("Gagal compress foto part", err);
      }
    }

    const mapsQuery = `${workshop} ${workshopAddress}`.trim();
    const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : "";

    // 1. Add maintenance log
    await KendaraAPI.addMaintenanceLog({
      vehicle_id: state.activeVehicleId,
      log_type: "sparepart",
      item_name: itemName,
      brand,
      odometer,
      date,
      cost,
      workshop: workshop || "Bengkel Sparepart",
      workshop_address: workshopAddress,
      workshop_maps_url: mapsUrl,
      warranty_lifespan: warranty,
      photo_part: photoPart,
      notes
    });

    // 2. Add expense transaction
    if (cost > 0) {
      await KendaraAPI.addTransaction({
        vehicle_id: state.activeVehicleId,
        type: "pengeluaran",
        category: "sparepart",
        amount: cost,
        date,
        odometer,
        notes: `Ganti sparepart: ${itemName} (${brand}). ${notes}`,
        bengkel_name: workshop,
        photo_receipt: photoPart
      });
    }

    closeModal("modal-quick-sparepart");
    await refreshData();
    showToast("Catatan sparepart berhasil disimpan!", "success");
  }

  // ============================================================
  // Fuel (BBM) Consumption & Efficiency Analytics Engine
  // ============================================================

  function getFuelAnalytics(vehicleId) {
    const targetVehicleId = vehicleId || state.activeVehicleId;
    const vehicle = state.vehicles.find((v) => v.id === targetVehicleId);

    // Get all fuel transactions for this vehicle
    const bbmTxs = (state.transactions || []).filter(
      (tx) => tx.vehicle_id === targetVehicleId && tx.category === "bbm" && tx.type === "pengeluaran"
    );

    // Sort ascending by odometer (or date if odometer matches)
    const sorted = [...bbmTxs].sort((a, b) => {
      const odoA = Number(a.odometer) || 0;
      const odoB = Number(b.odometer) || 0;
      if (odoA !== odoB) return odoA - odoB;
      return new Date(a.date) - new Date(b.date);
    });

    let totalDeltaKm = 0;
    let totalLiters = 0;
    let totalCost = 0;
    let monthlyLiters = 0;
    let monthlyCost = 0;

    const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
    const historyWithMetrics = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = i > 0 ? sorted[i - 1] : null;
      const liters = Number(current.fuel_liters) || 0;
      const amount = Number(current.amount) || 0;

      totalLiters += liters;
      totalCost += amount;

      if (current.date && current.date.startsWith(currentYearMonth)) {
        monthlyLiters += liters;
        monthlyCost += amount;
      }

      let deltaKm = null;
      let kmPerLiter = null;
      let costPerKm = null;

      if (prev && current.odometer && prev.odometer) {
        const diff = Number(current.odometer) - Number(prev.odometer);
        if (diff > 0) {
          deltaKm = diff;
          if (liters > 0) {
            kmPerLiter = Math.round((diff / liters) * 10) / 10;
            costPerKm = Math.round(amount / diff);
            totalDeltaKm += diff;
          }
        }
      }

      historyWithMetrics.push({
        ...current,
        deltaKm,
        kmPerLiter,
        costPerKm
      });
    }

    // Overall average efficiency
    let avgKmLiter = null;
    let avgCostPerKm = null;

    if (totalDeltaKm > 0 && totalLiters > 0) {
      let litersForDeltas = 0;
      for (let i = 1; i < historyWithMetrics.length; i++) {
        if (historyWithMetrics[i].deltaKm) {
          litersForDeltas += Number(historyWithMetrics[i].fuel_liters) || 0;
        }
      }
      if (litersForDeltas > 0) {
        avgKmLiter = Math.round((totalDeltaKm / litersForDeltas) * 10) / 10;
        avgCostPerKm = Math.round(totalCost / totalDeltaKm);
      }
    } else if (historyWithMetrics.length > 0) {
      // If only 1 entry or initial entry, provide standard vehicle benchmark
      avgKmLiter = vehicle && vehicle.type === "mobil" ? 13.5 : 42.5;
      avgCostPerKm = vehicle && vehicle.type === "mobil" ? 950 : 285;
    }

    // Status label and badge
    let statusLabel = "Cukup Irit";
    let badgeClass = "bg-blue-100 text-blue-800";

    const isMobil = vehicle && vehicle.type === "mobil";
    const thresholdHigh = isMobil ? 14 : 42;
    const thresholdLow = isMobil ? 9 : 32;

    if (!avgKmLiter || historyWithMetrics.length <= 1) {
      statusLabel = historyWithMetrics.length === 1 ? "Perlu 1 Isi Lagi" : "Belum Ada Data";
      badgeClass = "bg-slate-100 text-slate-700";
    } else if (avgKmLiter >= thresholdHigh) {
      statusLabel = "Sangat Irit";
      badgeClass = "bg-emerald-100 text-emerald-800";
    } else if (avgKmLiter >= thresholdLow) {
      statusLabel = "Normal / Standar";
      badgeClass = "bg-blue-100 text-blue-800";
    } else {
      statusLabel = "Cukup Boros";
      badgeClass = "bg-amber-100 text-amber-800";
    }

    return {
      vehicle,
      avgKmLiter,
      avgCostPerKm,
      monthlyLiters,
      monthlyCost,
      totalLiters,
      totalCost,
      totalDeltaKm,
      statusLabel,
      badgeClass,
      history: historyWithMetrics.reverse()
    };
  }

  function renderFuelCard(vehicle) {
    if (!vehicle) return;
    const fuel = getFuelAnalytics(vehicle.id);
    const kmPerLEl = document.getElementById("fuel-card-km-per-l");
    const costPerKmEl = document.getElementById("fuel-card-cost-per-km");
    const monthlyLitersEl = document.getElementById("fuel-card-monthly-liters");
    const badgeEl = document.getElementById("fuel-card-badge");

    if (kmPerLEl) kmPerLEl.innerText = fuel.avgKmLiter ? `${fuel.avgKmLiter} KM/L` : "- KM/L";
    if (costPerKmEl) costPerKmEl.innerText = fuel.avgCostPerKm ? Utils.formatRupiah(fuel.avgCostPerKm) : "Rp -";
    if (monthlyLitersEl) monthlyLitersEl.innerText = `${fuel.monthlyLiters.toFixed(1)} L`;
    if (badgeEl) {
      badgeEl.innerText = fuel.statusLabel;
      badgeEl.className = `text-xs px-2.5 py-1 rounded-full font-semibold ${fuel.badgeClass}`;
    }
  }

  function openFuelHubModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    const fuel = getFuelAnalytics(vehicle.id);

    // Vehicle Title
    const nameEl = document.getElementById("fuel-hub-vehicle-name");
    if (nameEl) nameEl.innerText = `${vehicle.name} • ${vehicle.plate_number}`;

    // Top 4 Metrics
    const avgEffEl = document.getElementById("fuel-hub-avg-efficiency");
    const ratingBadgeEl = document.getElementById("fuel-hub-rating-badge");
    const costPerKmEl = document.getElementById("fuel-hub-cost-per-km");
    const monthlyLitersEl = document.getElementById("fuel-hub-monthly-liters");
    const monthlyCostEl = document.getElementById("fuel-hub-monthly-cost");
    const totalLitersEl = document.getElementById("fuel-hub-total-liters");
    const totalCostEl = document.getElementById("fuel-hub-total-cost");

    if (avgEffEl) avgEffEl.innerText = fuel.avgKmLiter ? `${fuel.avgKmLiter} KM/L` : "- KM/L";
    if (ratingBadgeEl) {
      ratingBadgeEl.innerText = fuel.statusLabel;
      ratingBadgeEl.className = `inline-block text-[10px] px-2 py-0.5 mt-1 rounded-full font-bold ${fuel.badgeClass}`;
    }
    if (costPerKmEl) costPerKmEl.innerText = fuel.avgCostPerKm ? Utils.formatRupiah(fuel.avgCostPerKm) : "Rp -";
    if (monthlyLitersEl) monthlyLitersEl.innerText = `${fuel.monthlyLiters.toFixed(2)} L`;
    if (monthlyCostEl) monthlyCostEl.innerText = Utils.formatRupiah(fuel.monthlyCost);
    if (totalLitersEl) totalLitersEl.innerText = `${fuel.totalLiters.toFixed(2)} L`;
    if (totalCostEl) totalCostEl.innerText = Utils.formatRupiah(fuel.totalCost);

    // Pre-fill instant calculator with last 2 logs if available
    const calcOdoStart = document.getElementById("calc-odo-start");
    const calcOdoEnd = document.getElementById("calc-odo-end");
    const calcLiters = document.getElementById("calc-liters");
    const calcCost = document.getElementById("calc-cost");
    const calcResultBox = document.getElementById("calc-result-box");
    if (calcResultBox) calcResultBox.classList.add("hidden");

    if (fuel.history && fuel.history.length >= 2) {
      const latest = fuel.history[0];
      const prev = fuel.history[1];
      if (calcOdoStart && !calcOdoStart.value) calcOdoStart.value = prev.odometer || "";
      if (calcOdoEnd && !calcOdoEnd.value) calcOdoEnd.value = latest.odometer || "";
      if (calcLiters && !calcLiters.value) calcLiters.value = latest.fuel_liters || "";
      if (calcCost && !calcCost.value) calcCost.value = latest.amount || "";
    } else if (calcOdoEnd && !calcOdoEnd.value && vehicle.current_odometer) {
      calcOdoEnd.value = vehicle.current_odometer;
    }

    // Render Refueling History List
    renderFuelHistoryList(fuel.history);

    openModal("modal-fuel-hub");
    if (window.lucide) lucide.createIcons();
  }

  function renderFuelHistoryList(history) {
    const listEl = document.getElementById("fuel-history-list");
    const countEl = document.getElementById("fuel-log-count");
    if (!listEl) return;

    if (countEl) countEl.innerText = `${history.length} Catatan`;

    if (!history || history.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <i data-lucide="fuel" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
          <p class="text-xs font-semibold text-slate-600">Belum ada riwayat pengisian bensin.</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Catat bensin pertama Anda untuk mulai memantau efisiensi KM/Liter.</p>
          <button type="button" onclick="App.closeModal('modal-fuel-hub'); App.openQuickFuelModal();"
            class="mt-3 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0B4F9C] text-xs font-bold hover:bg-blue-100 transition-colors">
            + Catat Sekarang
          </button>
        </div>
      `;
      return;
    }

    let html = "";
    history.forEach((item) => {
      const fuelType = item.fuel_type || "Bahan Bakar";
      const station = item.bengkel_name || "SPBU";
      const odoStr = item.odometer ? Utils.formatKm(item.odometer) : "-";
      const effBadge = item.kmPerLiter
        ? `<span class="px-2 py-0.5 text-[10px] rounded-lg font-bold bg-emerald-100 text-emerald-800">${item.kmPerLiter} KM/L</span>`
        : `<span class="px-2 py-0.5 text-[10px] rounded-lg font-medium bg-slate-100 text-slate-500">Isi Pertama</span>`;

      const deltaBadge = item.deltaKm
        ? `<span class="text-[10px] font-semibold text-blue-600">+${item.deltaKm} KM</span>`
        : "";

      html += `
        <div class="p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-xs transition-shadow space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-[#0B4F9C] flex items-center justify-center font-bold text-xs flex-shrink-0">
                <i data-lucide="fuel" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <h5 class="text-xs font-bold text-slate-900 truncate">${Utils.escapeHTML(fuelType)}</h5>
                <p class="text-[10px] text-slate-500 truncate">${Utils.escapeHTML(station)} • ${Utils.formatDateIndo(item.date)}</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              ${effBadge}
              <p class="text-xs font-black text-slate-900 mt-1">${Utils.formatRupiah(item.amount)}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-slate-50 text-[10px] text-slate-500">
            <span>Odo: <strong class="text-slate-700">${odoStr}</strong> ${deltaBadge ? `(${deltaBadge})` : ""}</span>
            <span>Liter: <strong class="text-slate-700">${item.fuel_liters ? item.fuel_liters + " L" : "-"}</strong> ${item.costPerKm ? `• ${Utils.formatRupiah(item.costPerKm)}/KM` : ""}</span>
          </div>

          ${item.notes ? `<p class="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded-lg">"${Utils.escapeHTML(item.notes)}"</p>` : ""}
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function toggleFuelCalculator() {
    const body = document.getElementById("fuel-calc-body");
    const toggleText = document.getElementById("calc-toggle-text");
    if (!body || !toggleText) return;

    if (body.classList.contains("hidden")) {
      body.classList.remove("hidden");
      toggleText.innerText = "Tutup";
    } else {
      body.classList.add("hidden");
      toggleText.innerText = "Buka";
    }
  }

  function calculateFuelEfficiencyManual() {
    const odoStart = Number(document.getElementById("calc-odo-start").value);
    const odoEnd = Number(document.getElementById("calc-odo-end").value);
    const liters = Number(document.getElementById("calc-liters").value);
    const cost = Number(document.getElementById("calc-cost").value) || 0;
    const resultBox = document.getElementById("calc-result-box");
    const resultKml = document.getElementById("calc-result-kml");
    const resultExtra = document.getElementById("calc-result-extra");

    if (!odoStart || !odoEnd || !liters || liters <= 0) {
      showToast("Lengkapi Odometer Awal, Baru, dan Jumlah Liter", "error");
      return;
    }

    const delta = odoEnd - odoStart;
    if (delta <= 0) {
      showToast("Odometer Baru harus lebih besar dari Odometer Awal", "error");
      return;
    }

    const kml = (delta / liters).toFixed(1);
    let extraText = `(Jarak: ${delta} KM, Konsumsi: ${liters} L)`;

    if (cost > 0) {
      const rpPerKm = Math.round(cost / delta);
      extraText += ` • Biaya: ${Utils.formatRupiah(rpPerKm)}/KM`;
    }

    if (resultKml) resultKml.innerText = `${kml} KM/L`;
    if (resultExtra) resultExtra.innerText = extraText;
    if (resultBox) resultBox.classList.remove("hidden");
  }

  function openQuickFuelModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    const form = document.getElementById("quick-fuel-form");
    if (form) form.reset();

    const dateEl = document.getElementById("qfuel-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];

    const odoEl = document.getElementById("qfuel-odometer");
    if (odoEl) odoEl.value = vehicle.current_odometer || "";

    const hintEl = document.getElementById("qfuel-last-odo-hint");
    if (hintEl) hintEl.innerText = `Terakhir: ${Utils.formatKm(vehicle.current_odometer || 0)}`;

    const fullTankEl = document.getElementById("qfuel-full-tank");
    if (fullTankEl) fullTankEl.checked = true;

    openModal("modal-quick-fuel");
    if (window.lucide) lucide.createIcons();
  }

  function handleFuelTypeChange() {
    syncFuelAmountToLiters();
  }

  function syncFuelAmountToLiters() {
    const typeSelect = document.getElementById("qfuel-fuel-type");
    const amountEl = document.getElementById("qfuel-amount");
    const litersEl = document.getElementById("qfuel-liters");
    if (!typeSelect || !amountEl || !litersEl) return;

    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const pricePerLiter = Number(selectedOption.getAttribute("data-price")) || 0;
    const amount = Number(amountEl.value) || 0;

    if (pricePerLiter > 0 && amount > 0) {
      const calculatedLiters = (amount / pricePerLiter).toFixed(2);
      litersEl.value = calculatedLiters;
    }
  }

  function syncFuelLitersToAmount() {
    const typeSelect = document.getElementById("qfuel-fuel-type");
    const amountEl = document.getElementById("qfuel-amount");
    const litersEl = document.getElementById("qfuel-liters");
    if (!typeSelect || !amountEl || !litersEl) return;

    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const pricePerLiter = Number(selectedOption.getAttribute("data-price")) || 0;
    const liters = Number(litersEl.value) || 0;

    if (pricePerLiter > 0 && liters > 0) {
      const calculatedAmount = Math.round(liters * pricePerLiter);
      amountEl.value = calculatedAmount;
    }
  }

  async function submitQuickFuelForm(e) {
    if (e) e.preventDefault();

    const date = document.getElementById("qfuel-date").value;
    const odometer = Number(document.getElementById("qfuel-odometer").value);
    const fuelTypeSelect = document.getElementById("qfuel-fuel-type");
    const fuelType = fuelTypeSelect ? fuelTypeSelect.value : "Pertamax";
    const pricePerLiter = fuelTypeSelect ? Number(fuelTypeSelect.options[fuelTypeSelect.selectedIndex]?.getAttribute("data-price")) || 0 : 0;
    const amount = Number(document.getElementById("qfuel-amount").value);
    const liters = Number(document.getElementById("qfuel-liters").value);
    const station = document.getElementById("qfuel-station").value.trim();
    const isFullTank = document.getElementById("qfuel-full-tank")?.checked ?? true;
    const notesInput = document.getElementById("qfuel-notes").value.trim();

    if (!odometer || odometer <= 0) {
      showToast("Masukkan KM odometer pengisian bensin", "error");
      return;
    }

    if (!amount || amount <= 0) {
      showToast("Masukkan total biaya pengisian", "error");
      return;
    }

    if (!liters || liters <= 0) {
      showToast("Masukkan jumlah liter", "error");
      return;
    }

    let photoReceipt = "";
    const photoInput = document.getElementById("qfuel-photo");
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoReceipt = await Utils.compressImage(photoInput.files[0]);
      } catch (err) {
        console.warn("Gagal compress foto struk BBM", err);
      }
    }

    const fullTankNote = isFullTank ? "[Full Tank]" : "[Isi Sebagian]";
    const combinedNotes = `${fullTankNote} ${fuelType} ${liters}L. ${notesInput}`.trim();

    // 1. Add transaction
    await KendaraAPI.addTransaction({
      vehicle_id: state.activeVehicleId,
      type: "pengeluaran",
      category: "bbm",
      amount,
      date,
      odometer,
      fuel_liters: liters,
      fuel_price_per_liter: pricePerLiter,
      fuel_type: fuelType,
      bengkel_name: station || "SPBU",
      notes: combinedNotes,
      photo_receipt: photoReceipt
    });

    // 2. Update vehicle current odometer if higher
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (vehicle && odometer > (vehicle.current_odometer || 0)) {
      await KendaraAPI.updateVehicle(vehicle.id, { current_odometer: odometer });
    }

    closeModal("modal-quick-fuel");
    await refreshData();
    showToast("Pengisian bensin berhasil dicatat!", "success");

    // If fuel hub modal was open, refresh its view
    const fuelHubEl = document.getElementById("modal-fuel-hub");
    if (fuelHubEl && !fuelHubEl.classList.contains("hidden")) {
      openFuelHubModal();
    }
  }

  // ============================================================
  // Fleet Tracking (GPS Real-Time Trip & Visit Logger)
  // ============================================================

  function initFleetTracking() {
    const savedActiveTrip = localStorage.getItem("kendaratrack_active_trip");
    if (savedActiveTrip) {
      try {
        state.activeTrip = JSON.parse(savedActiveTrip);
        resumeActiveTrip();
      } catch (e) {
        console.warn("Gagal parse active trip", e);
      }
    }
    updateActiveTripUI();
  }

  function resumeActiveTrip() {
    if (!state.activeTrip) return;
    state.gpsPermissionGranted = true;
    startGpsWatcher();
    startTripTimer();
    updateActiveTripUI();
  }

  function updateActiveTripUI() {
    const banner = document.getElementById("home-active-trip-banner");
    const pulseBadge = document.getElementById("badge-gps-pulse");
    const setupControls = document.getElementById("fleet-setup-controls");
    const activeControls = document.getElementById("fleet-active-controls");
    const liveStatusText = document.getElementById("fleet-live-status-text");
    const livePulseDot = document.getElementById("fleet-live-pulse-dot");

    if (state.activeTrip) {
      if (banner) banner.classList.remove("hidden");
      if (pulseBadge) pulseBadge.classList.remove("hidden");
      if (setupControls) setupControls.classList.add("hidden");
      if (activeControls) activeControls.classList.remove("hidden");
      if (liveStatusText) liveStatusText.innerText = "STATUS: MEREKAM PERJALANAN";
      if (livePulseDot) {
        livePulseDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping";
      }
      updateLiveHud();
    } else {
      if (banner) banner.classList.add("hidden");
      if (pulseBadge) pulseBadge.classList.add("hidden");
      if (setupControls) setupControls.classList.remove("hidden");
      if (activeControls) activeControls.classList.add("hidden");
      if (liveStatusText) liveStatusText.innerText = "STATUS: STANDBY";
      if (livePulseDot) {
        livePulseDot.className = "w-2.5 h-2.5 rounded-full bg-slate-500";
      }
    }
  }

  function openFleetModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    const nameEl = document.getElementById("fleet-vehicle-name");
    if (nameEl) nameEl.innerText = `${vehicle.name} • ${vehicle.plate_number}`;

    // GPS Status Box
    const permBox = document.getElementById("fleet-gps-permission-box");
    const readyBox = document.getElementById("fleet-gps-ready-box");

    if (state.gpsPermissionGranted) {
      if (permBox) permBox.classList.add("hidden");
      if (readyBox) readyBox.classList.remove("hidden");
    } else {
      if (permBox) permBox.classList.remove("hidden");
      if (readyBox) readyBox.classList.add("hidden");
    }

    updateActiveTripUI();
    renderFleetTripsList();

    if (!state.fleetActiveTab) state.fleetActiveTab = "live";
    switchFleetTab(state.fleetActiveTab);

    openModal("modal-fleet-tracking");
    if (window.lucide) lucide.createIcons();
  }

  function switchFleetTab(tabName) {
    state.fleetActiveTab = tabName;

    const btnLive = document.getElementById("fleet-tab-btn-live");
    const btnHistory = document.getElementById("fleet-tab-btn-history");
    const btnMap = document.getElementById("fleet-tab-btn-map");

    const contentLive = document.getElementById("fleet-tab-content-live");
    const contentHistory = document.getElementById("fleet-tab-content-history");
    const contentMap = document.getElementById("fleet-tab-content-map");

    [btnLive, btnHistory, btnMap].forEach((btn) => {
      if (btn) btn.className = "py-2 rounded-xl text-slate-500 hover:text-slate-800 transition-all";
    });
    [contentLive, contentHistory, contentMap].forEach((c) => {
      if (c) c.classList.add("hidden");
    });

    if (tabName === "live") {
      if (btnLive) btnLive.className = "py-2 rounded-xl bg-white text-slate-900 shadow-2xs font-bold transition-all";
      if (contentLive) contentLive.classList.remove("hidden");
      updateActiveTripUI();
    } else if (tabName === "history") {
      if (btnHistory) btnHistory.className = "py-2 rounded-xl bg-white text-slate-900 shadow-2xs font-bold transition-all";
      if (contentHistory) contentHistory.classList.remove("hidden");
      renderFleetTripsList();
    } else if (tabName === "map") {
      if (btnMap) btnMap.className = "py-2 rounded-xl bg-white text-slate-900 shadow-2xs font-bold transition-all";
      if (contentMap) contentMap.classList.remove("hidden");
      renderTripMap(state.selectedMapTrip ? state.selectedMapTrip.id : null);
    }

    if (window.lucide) lucide.createIcons();
  }

  function requestGPSPermission() {
    if (!navigator.geolocation) {
      showToast("Perangkat Anda tidak mendukung Geolocation / GPS", "error");
      return;
    }

    showToast("Mengunci sinyal satelit GPS...", "info");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.gpsPermissionGranted = true;
        state.currentGpsPosition = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy)
        };

        const permBox = document.getElementById("fleet-gps-permission-box");
        const readyBox = document.getElementById("fleet-gps-ready-box");
        const coordsText = document.getElementById("fleet-gps-coords-text");

        if (permBox) permBox.classList.add("hidden");
        if (readyBox) readyBox.classList.remove("hidden");
        if (coordsText) {
          coordsText.innerText = `${state.currentGpsPosition.lat}, ${state.currentGpsPosition.lng} (±${state.currentGpsPosition.accuracy}m)`;
        }

        showToast("GPS Terkunci Akurat! Siap mulai perjalanan.", "success");
      },
      (err) => {
        state.gpsPermissionGranted = false;
        showToast("Akses GPS ditolak / nonaktif: " + err.message, "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function startTripTracking() {
    if (!state.gpsPermissionGranted) {
      requestGPSPermission();
      showToast("Wajib mengizinkan GPS untuk melacak perjalanan armada!", "error");
      return;
    }

    const titleInput = document.getElementById("fleet-input-title");
    const purposeSelect = document.getElementById("fleet-input-purpose");
    const driverInput = document.getElementById("fleet-input-driver");

    const title = titleInput ? titleInput.value.trim() : "";
    const purpose = purposeSelect ? purposeSelect.value : "dinas";
    const driver = driverInput ? driverInput.value.trim() : "Driver";

    const now = new Date();
    const startTimeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    state.activeTrip = {
      id: "trip-" + Date.now(),
      vehicle_id: state.activeVehicleId,
      title: title || "Perjalanan Operasional Armada",
      purpose,
      driver: driver || "Driver",
      date: now.toISOString().split("T")[0],
      start_time: startTimeStr,
      start_timestamp: Date.now(),
      end_time: null,
      duration_minutes: 0,
      distance_km: 0,
      avg_speed_kmh: 0,
      max_speed_kmh: 0,
      start_lat: state.currentGpsPosition ? state.currentGpsPosition.lat : -7.2655,
      start_lng: state.currentGpsPosition ? state.currentGpsPosition.lng : 112.7483,
      end_lat: null,
      end_lng: null,
      status: "active",
      visits: [],
      path: state.currentGpsPosition ? [[state.currentGpsPosition.lat, state.currentGpsPosition.lng]] : [],
      notes: ""
    };

    localStorage.setItem("kendaratrack_active_trip", JSON.stringify(state.activeTrip));

    startGpsWatcher();
    startTripTimer();
    updateActiveTripUI();
    showToast("Pelacakan GPS dimulai! Riwayat rute & kunjungan sedang direkam.", "success");
  }

  function startGpsWatcher() {
    if (state.gpsWatchId) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
    }

    if (!navigator.geolocation) return;

    state.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        onGpsLocationUpdate(pos);
      },
      (err) => {
        console.warn("GPS watch position error", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );
  }

  function onGpsLocationUpdate(pos) {
    if (!state.activeTrip) return;

    const lat = Number(pos.coords.latitude.toFixed(6));
    const lng = Number(pos.coords.longitude.toFixed(6));
    const speedRaw = pos.coords.speed; // m/s
    const speedKmh = speedRaw ? Math.round(speedRaw * 3.6) : 0;

    state.currentGpsPosition = { lat, lng, speed: speedKmh };

    const path = state.activeTrip.path;
    let delta = 0;

    if (path.length > 0) {
      const lastPoint = path[path.length - 1];
      delta = Utils.calculateHaversineDistance(lastPoint[0], lastPoint[1], lat, lng);
    }

    if (delta >= 0.01 || path.length === 0) {
      state.activeTrip.distance_km = Math.round((state.activeTrip.distance_km + delta) * 100) / 100;
      state.activeTrip.path.push([lat, lng]);
    }

    if (speedKmh > (state.activeTrip.max_speed_kmh || 0)) {
      state.activeTrip.max_speed_kmh = speedKmh;
    }

    localStorage.setItem("kendaratrack_active_trip", JSON.stringify(state.activeTrip));
    updateLiveHud(speedKmh);
  }

  function startTripTimer() {
    if (state.tripTimerInterval) {
      clearInterval(state.tripTimerInterval);
    }

    state.tripTimerInterval = setInterval(() => {
      if (!state.activeTrip) {
        clearInterval(state.tripTimerInterval);
        return;
      }

      const elapsedMs = Date.now() - (state.activeTrip.start_timestamp || Date.now());
      const totalSec = Math.floor(elapsedMs / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      const timeStr = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      state.activeTrip.duration_minutes = Math.round(totalSec / 60);

      const liveTimerEl = document.getElementById("fleet-live-timer");
      const homeTimerEl = document.getElementById("home-trip-duration");

      if (liveTimerEl) liveTimerEl.innerText = timeStr;
      if (homeTimerEl) homeTimerEl.innerText = timeStr;
    }, 1000);
  }

  function updateLiveHud(currentSpeed = 0) {
    if (!state.activeTrip) return;

    const speedEl = document.getElementById("fleet-live-speed");
    const distEl = document.getElementById("fleet-live-distance");
    const visitsCountEl = document.getElementById("fleet-live-visits-count");
    const maxSpeedEl = document.getElementById("fleet-live-max-speed");
    const homeStatsEl = document.getElementById("home-trip-stats");

    if (speedEl) speedEl.innerHTML = `${currentSpeed} <span class="text-xs font-normal text-slate-400">km/h</span>`;
    if (distEl) distEl.innerHTML = `${state.activeTrip.distance_km.toFixed(2)} <span class="text-xs font-normal text-slate-400">KM</span>`;
    if (visitsCountEl) visitsCountEl.innerText = `${(state.activeTrip.visits || []).length} Lokasi Kunjungan`;
    if (maxSpeedEl) maxSpeedEl.innerText = `Maks: ${state.activeTrip.max_speed_kmh || 0} km/h`;
    if (homeStatsEl) {
      homeStatsEl.innerText = `Jarak: ${state.activeTrip.distance_km.toFixed(2)} KM • ${currentSpeed} km/h`;
    }
  }

  function openAddVisitModal() {
    if (!state.activeTrip) {
      showToast("Mulai perjalanan terlebih dahulu untuk mencatat kunjungan", "error");
      return;
    }

    const form = document.getElementById("fleet-visit-form");
    if (form) form.reset();

    const timeEl = document.getElementById("visit-input-time");
    if (timeEl) {
      timeEl.value = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }

    openModal("modal-add-visit");
    if (window.lucide) lucide.createIcons();
  }

  function submitAddVisit(e) {
    if (e) e.preventDefault();
    if (!state.activeTrip) return;

    const name = document.getElementById("visit-input-name").value.trim();
    const category = document.getElementById("visit-input-category").value;
    const time = document.getElementById("visit-input-time").value;
    const address = document.getElementById("visit-input-address").value.trim();
    const notes = document.getElementById("visit-input-notes").value.trim();

    if (!name) {
      showToast("Nama toko / klien harus diisi", "error");
      return;
    }

    const currentLat = state.currentGpsPosition ? state.currentGpsPosition.lat : -7.2655;
    const currentLng = state.currentGpsPosition ? state.currentGpsPosition.lng : 112.7483;

    const visit = {
      id: "vis-" + Date.now(),
      place_name: name,
      category,
      time: time || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      address: address || `Koordinat: ${currentLat}, ${currentLng}`,
      lat: currentLat,
      lng: currentLng,
      notes,
      photo: ""
    };

    if (!state.activeTrip.visits) state.activeTrip.visits = [];
    state.activeTrip.visits.push(visit);

    localStorage.setItem("kendaratrack_active_trip", JSON.stringify(state.activeTrip));
    updateLiveHud();

    closeModal("modal-add-visit");
    showToast(`Kunjungan "${name}" berhasil dicatat!`, "success");
  }

  async function stopTripTracking() {
    if (!state.activeTrip) return;

    const trip = state.activeTrip;

    if (state.gpsWatchId) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
      state.gpsWatchId = null;
    }
    if (state.tripTimerInterval) {
      clearInterval(state.tripTimerInterval);
      state.tripTimerInterval = null;
    }

    const now = new Date();
    trip.end_time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    trip.end_lat = state.currentGpsPosition ? state.currentGpsPosition.lat : trip.start_lat;
    trip.end_lng = state.currentGpsPosition ? state.currentGpsPosition.lng : trip.start_lng;
    trip.status = "completed";

    if (trip.distance_km <= 0 && trip.path.length <= 1) {
      trip.distance_km = 4.5;
    }

    if (trip.duration_minutes > 0) {
      trip.avg_speed_kmh = Math.round(trip.distance_km / (trip.duration_minutes / 60));
    } else {
      trip.avg_speed_kmh = 28;
    }

    const vehicle = state.vehicles.find((v) => v.id === trip.vehicle_id);
    const syncOdo = confirm(
      `Perjalanan Selesai!\n\n` +
      `• Total Jarak: ${trip.distance_km.toFixed(1)} KM\n` +
      `• Durasi: ${Utils.formatDuration(trip.duration_minutes || 1)}\n` +
      `• Jumlah Kunjungan: ${(trip.visits || []).length} Lokasi\n\n` +
      `Tambahkan jarak ${trip.distance_km.toFixed(1)} KM ini ke Odometer kendaraan Anda?`
    );

    if (syncOdo && vehicle) {
      const newOdo = Math.round((vehicle.current_odometer || 0) + trip.distance_km);
      await KendaraAPI.updateVehicle(vehicle.id, { current_odometer: newOdo });
      vehicle.current_odometer = newOdo;
    }

    await KendaraAPI.saveTrip(trip);

    state.activeTrip = null;
    localStorage.removeItem("kendaratrack_active_trip");

    state.trips = await KendaraAPI.getTrips(state.activeVehicleId);
    state.selectedMapTrip = trip;

    updateActiveTripUI();
    showToast("Riwayat perjalanan armada berhasil disimpan!", "success");

    switchFleetTab("history");
  }

  function renderFleetTripsList() {
    const listEl = document.getElementById("fleet-trips-list");
    const totalTripsEl = document.getElementById("fleet-stat-total-trips");
    const totalKmEl = document.getElementById("fleet-stat-total-km");
    const totalVisitsEl = document.getElementById("fleet-stat-total-visits");
    if (!listEl) return;

    const trips = (state.trips || []).filter((t) => t.vehicle_id === state.activeVehicleId);

    let sumKm = 0;
    let sumVisits = 0;
    trips.forEach((t) => {
      sumKm += Number(t.distance_km) || 0;
      sumVisits += (t.visits || []).length;
    });

    if (totalTripsEl) totalTripsEl.innerText = `${trips.length} Trip`;
    if (totalKmEl) totalKmEl.innerText = `${sumKm.toFixed(1)} KM`;
    if (totalVisitsEl) totalVisitsEl.innerText = `${sumVisits} Klien`;

    if (trips.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <i data-lucide="navigation" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
          <p class="text-xs font-semibold text-slate-600">Belum ada riwayat perjalanan armada.</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Mulai perjalanan pertama dengan mengaktifkan GPS.</p>
        </div>
      `;
      return;
    }

    let html = "";
    trips.forEach((trip) => {
      const visitCount = (trip.visits || []).length;
      const visitBadge = visitCount > 0
        ? `<span class="px-2 py-0.5 text-[10px] rounded-md font-bold bg-amber-100 text-amber-800">📍 ${visitCount} Kunjungan</span>`
        : `<span class="px-2 py-0.5 text-[10px] rounded-md font-medium bg-slate-100 text-slate-500">Non-Stop</span>`;

      html += `
        <div class="p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-sm transition-all space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h5 class="text-xs font-bold text-slate-900">${Utils.escapeHTML(trip.title)}</h5>
              <p class="text-[10px] text-slate-500">${Utils.formatDateIndo(trip.date)} • ${trip.start_time || "08:00"} - ${trip.end_time || "Selesai"}</p>
            </div>
            ${visitBadge}
          </div>

          <div class="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-xl text-center text-[10px]">
            <div>
              <span class="text-slate-400 block font-semibold">Jarak</span>
              <strong class="text-emerald-700 text-xs font-black">${trip.distance_km ? trip.distance_km.toFixed(1) : 0} KM</strong>
            </div>
            <div class="border-x border-slate-200">
              <span class="text-slate-400 block font-semibold">Durasi</span>
              <strong class="text-slate-700 font-bold">${Utils.formatDuration(trip.duration_minutes)}</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Rata-rata</span>
              <strong class="text-slate-700 font-bold">${trip.avg_speed_kmh || 30} km/h</strong>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 gap-1.5">
            <button type="button" onclick="App.viewTripMap('${trip.id}')"
              class="flex-1 py-1.5 rounded-xl bg-blue-50 text-[#0B4F9C] text-[11px] font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
              <i data-lucide="map" class="w-3.5 h-3.5"></i>
              <span>Lihat Rute di Peta</span>
            </button>
            <button type="button" onclick="App.deleteTripConfirm('${trip.id}')"
              class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function viewTripMap(tripId) {
    const trip = (state.trips || []).find((t) => t.id === tripId);
    if (!trip) return;
    state.selectedMapTrip = trip;
    switchFleetTab("map");
  }

  function renderTripMap(tripId) {
    const trips = (state.trips || []).filter((t) => t.vehicle_id === state.activeVehicleId);
    let trip = tripId ? trips.find((t) => t.id === tripId) : state.selectedMapTrip;
    if (!trip && trips.length > 0) trip = trips[0];

    const titleEl = document.getElementById("fleet-map-trip-title");
    const subEl = document.getElementById("fleet-map-trip-subtitle");
    const visitsListEl = document.getElementById("fleet-map-visits-list");

    if (!trip) {
      if (titleEl) titleEl.innerText = "Belum ada rute untuk ditampilkan";
      return;
    }

    state.selectedMapTrip = trip;

    if (titleEl) titleEl.innerText = `${trip.title} (${trip.distance_km.toFixed(1)} KM)`;
    if (subEl) subEl.innerText = `${Utils.formatDateIndo(trip.date)} • ${trip.start_time} - ${trip.end_time}`;

    if (visitsListEl) {
      const visits = trip.visits || [];
      if (visits.length === 0) {
        visitsListEl.innerHTML = `<p class="text-[11px] text-slate-400 italic">Tidak ada catatan kunjungan / singgah pada rute ini.</p>`;
      } else {
        let vHtml = "";
        visits.forEach((v, idx) => {
          vHtml += `
            <div class="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-2 text-xs">
              <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                ${idx + 1}
              </span>
              <div class="min-w-0">
                <h6 class="font-bold text-slate-900 truncate">${Utils.escapeHTML(v.place_name)} <span class="text-[10px] text-slate-500 font-normal">(${v.time || ""})</span></h6>
                ${v.notes ? `<p class="text-[10px] text-slate-600 truncate">${Utils.escapeHTML(v.notes)}</p>` : ""}
              </div>
            </div>
          `;
        });
        visitsListEl.innerHTML = vHtml;
      }
    }

    setTimeout(() => {
      initOrUpdateLeafletMap(trip);
    }, 150);
  }

  function initOrUpdateLeafletMap(trip) {
    const mapDiv = document.getElementById("fleet-leaflet-map");
    if (!mapDiv || typeof L === "undefined") return;

    const path = trip.path && trip.path.length > 0
      ? trip.path
      : [[trip.start_lat || -7.2655, trip.start_lng || 112.7483]];

    if (!state.leafletMapInstance) {
      state.leafletMapInstance = L.map("fleet-leaflet-map", {
        zoomControl: true,
        attributionControl: false
      }).setView(path[0], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(state.leafletMapInstance);
    } else {
      state.leafletMapInstance.eachLayer((layer) => {
        if (!layer._url) {
          state.leafletMapInstance.removeLayer(layer);
        }
      });
    }

    const map = state.leafletMapInstance;

    if (path.length > 1) {
      const polyline = L.polyline(path, {
        color: "#0B4F9C",
        weight: 5,
        opacity: 0.85,
        lineJoin: "round"
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else {
      map.setView(path[0], 14);
    }

    const startIcon = L.divIcon({
      html: `<div style="background:#10B981;color:white;border:2px solid white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);">A</div>`,
      className: "",
      iconSize: [24, 24]
    });
    L.marker(path[0], { icon: startIcon }).addTo(map).bindPopup(`<b>Titik Berangkat (Start)</b><br>${trip.start_time}`);

    if (path.length > 1) {
      const endIcon = L.divIcon({
        html: `<div style="background:#EF4444;color:white;border:2px solid white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);">B</div>`,
        className: "",
        iconSize: [24, 24]
      });
      L.marker(path[path.length - 1], { icon: endIcon }).addTo(map).bindPopup(`<b>Titik Selesai (Finish)</b><br>${trip.end_time || ""}`);
    }

    const visits = trip.visits || [];
    visits.forEach((v, idx) => {
      if (v.lat && v.lng) {
        const visitIcon = L.divIcon({
          html: `<div style="background:#F59E0B;color:white;border:2px solid white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${idx + 1}</div>`,
          className: "",
          iconSize: [26, 26]
        });
        L.marker([v.lat, v.lng], { icon: visitIcon })
          .addTo(map)
          .bindPopup(`<b>Kunjungan #${idx + 1}: ${Utils.escapeHTML(v.place_name)}</b><br>Jam: ${v.time || "-"}<br><em>${Utils.escapeHTML(v.notes || "")}</em>`);
      }
    });

    map.invalidateSize();
  }

  function openActiveTripInGoogleMaps() {
    const trip = state.selectedMapTrip;
    if (!trip) return;

    if (trip.path && trip.path.length > 0) {
      const origin = `${trip.path[0][0]},${trip.path[0][1]}`;
      const dest = `${trip.path[trip.path.length - 1][0]},${trip.path[trip.path.length - 1][1]}`;

      const waypoints = (trip.visits || [])
        .filter((v) => v.lat && v.lng)
        .map((v) => `${v.lat},${v.lng}`)
        .join("|");

      let gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
      if (waypoints) {
        gmapsUrl += `&waypoints=${encodeURIComponent(waypoints)}`;
      }
      window.open(gmapsUrl, "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${trip.start_lat || -7.2655},${trip.start_lng || 112.7483}`, "_blank");
    }
  }

  async function deleteTripConfirm(id) {
    if (confirm("Hapus riwayat perjalanan ini?")) {
      await KendaraAPI.deleteTrip(id);
      state.trips = await KendaraAPI.getTrips(state.activeVehicleId);
      renderFleetTripsList();
      showToast("Riwayat perjalanan dihapus", "info");
    }
  }

  // Quick Schedule / Reminder Modal
  function openAddScheduleModal() {
    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
    if (!vehicle) return;

    state.editingScheduleId = null;
    const titleEl = document.getElementById("sch-modal-title");
    const submitTextEl = document.getElementById("sch-modal-submit-text");
    if (titleEl) titleEl.innerText = "Tambah Jadwal Pengingat";
    if (submitTextEl) submitTextEl.innerText = "Simpan Jadwal";

    document.getElementById("sch-form").reset();
    document.getElementById("sch-form-id").value = "";
    document.getElementById("sch-form-date").value = new Date().toISOString().split("T")[0];
    openModal("modal-add-schedule");
  }

  function openEditScheduleModal(scheduleId) {
    const sch = state.schedules.find((s) => s.id === scheduleId);
    if (!sch) return;

    state.editingScheduleId = scheduleId;
    const titleEl = document.getElementById("sch-modal-title");
    const submitTextEl = document.getElementById("sch-modal-submit-text");
    if (titleEl) titleEl.innerText = "Edit Jadwal Pengingat";
    if (submitTextEl) submitTextEl.innerText = "Perbarui Jadwal";

    document.getElementById("sch-form-id").value = sch.id;
    document.getElementById("sch-form-title").value = sch.title || "";
    document.getElementById("sch-form-category").value = sch.category || "oli";
    document.getElementById("sch-form-date").value = sch.due_date || "";
    document.getElementById("sch-form-km").value = sch.target_odometer || "";
    document.getElementById("sch-form-cost").value = sch.est_cost || "";
    document.getElementById("sch-form-recurring").checked = Boolean(sch.is_recurring);
    document.getElementById("sch-form-recur-months").value = sch.recurring_interval_months || 12;
    document.getElementById("sch-form-notes").value = sch.notes || "";

    openModal("modal-add-schedule");
    if (window.lucide) lucide.createIcons();
  }

  async function deleteScheduleConfirm(scheduleId) {
    const sch = state.schedules.find((s) => s.id === scheduleId);
    const title = sch ? ` "${sch.title}"` : "";
    if (confirm(`Apakah Anda yakin ingin menghapus jadwal pengingat${title}?`)) {
      try {
        await KendaraAPI.deleteSchedule(scheduleId);
        await refreshData();
        if (window.Calendar) Calendar.render();
        showToast("Jadwal pengingat berhasil dihapus.", "info");
      } catch (err) {
        showToast("Gagal menghapus jadwal: " + err.message, "error");
      }
    }
  }

  async function submitScheduleForm(e) {
    if (e) e.preventDefault();

    const title = document.getElementById("sch-form-title").value.trim();
    const category = document.getElementById("sch-form-category").value;
    const dueDate = document.getElementById("sch-form-date").value;
    const targetKm = document.getElementById("sch-form-km").value;
    const cost = Number(document.getElementById("sch-form-cost").value) || 0;
    const isRecurring = document.getElementById("sch-form-recurring").checked;
    const recurMonths = Number(document.getElementById("sch-form-recur-months").value) || 12;
    const notes = document.getElementById("sch-form-notes").value.trim();

    if (!title || !dueDate) {
      showToast("Judul dan tanggal jatuh tempo harus diisi", "error");
      return;
    }

    if (state.editingScheduleId) {
      await KendaraAPI.updateSchedule({
        id: state.editingScheduleId,
        vehicle_id: state.activeVehicleId,
        title,
        category,
        due_date: dueDate,
        target_odometer: targetKm ? Number(targetKm) : null,
        est_cost: cost,
        is_recurring: isRecurring,
        recurring_interval_months: recurMonths,
        notes
      });
      showToast("Jadwal pengingat berhasil diperbarui!", "success");
    } else {
      await KendaraAPI.addSchedule({
        vehicle_id: state.activeVehicleId,
        title,
        category,
        due_date: dueDate,
        target_odometer: targetKm ? Number(targetKm) : null,
        est_cost: cost,
        is_recurring: isRecurring,
        recurring_interval_months: recurMonths,
        notes
      });
      showToast("Pengingat berhasil dijadwalkan!", "success");
    }

    state.editingScheduleId = null;
    closeModal("modal-add-schedule");
    await refreshData();
    if (window.Calendar) Calendar.render();
  }

  // Selesai & Bayar Modal for schedules
  function openPayScheduleModal(scheduleId) {
    const sch = state.schedules.find((s) => s.id === scheduleId);
    if (!sch) return;

    const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);

    document.getElementById("pay-sch-id").value = sch.id;
    document.getElementById("pay-sch-title").innerText = sch.title;
    document.getElementById("pay-sch-category-label").innerText = Utils.getCategoryDetails(sch.category).label;
    document.getElementById("pay-sch-amount").value = sch.est_cost || 0;
    document.getElementById("pay-sch-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("pay-sch-odometer").value = vehicle ? vehicle.current_odometer : "";
    document.getElementById("pay-sch-notes").value = sch.notes || "";

    openModal("modal-pay-schedule");
  }

  async function submitPayScheduleForm(e) {
    if (e) e.preventDefault();

    const scheduleId = document.getElementById("pay-sch-id").value;
    const amount = Number(document.getElementById("pay-sch-amount").value);
    const date = document.getElementById("pay-sch-date").value;
    const odometer = document.getElementById("pay-sch-odometer").value;
    const bengkel = document.getElementById("pay-sch-bengkel").value.trim();
    const notes = document.getElementById("pay-sch-notes").value.trim();

    try {
      await KendaraAPI.completeSchedule(scheduleId, {
        amount,
        date,
        odometer: odometer ? Number(odometer) : null,
        bengkel_name: bengkel,
        notes
      });

      closeModal("modal-pay-schedule");
      await refreshData();
      showToast("Jadwal diselesaikan & dicatat ke pengeluaran!", "success");
    } catch (err) {
      showToast("Gagal menyelesaikan jadwal: " + err.message, "error");
    }
  }

  // Add Vehicle Modal
  function openAddVehicleModal() {
    document.getElementById("vehicle-form").reset();
    openModal("modal-add-vehicle");
  }

  async function submitAddVehicleForm(e) {
    if (e) e.preventDefault();

    const name = document.getElementById("veh-form-name").value.trim();
    const plate = document.getElementById("veh-form-plate").value.trim().toUpperCase();
    const type = document.getElementById("veh-form-type").value;
    const year = Number(document.getElementById("veh-form-year").value) || new Date().getFullYear();
    const km = Number(document.getElementById("veh-form-km").value) || 0;
    const oilInterval = Number(document.getElementById("veh-form-oil-interval").value) || (type === "mobil" ? 10000 : 3000);
    const taxAnnual = document.getElementById("veh-form-tax-annual").value;
    const tax5Year = document.getElementById("veh-form-tax-5year").value;
    const simType = document.getElementById("veh-form-sim-type").value;
    const simExpiry = document.getElementById("veh-form-sim-expiry").value;

    if (!name || !plate) {
      showToast("Nama kendaraan dan Plat Nomor wajib diisi", "error");
      return;
    }

    let photoVeh = "";
    let photoSim = "";
    let photoStnk = "";
    let photoBpkb = "";

    const fileVeh = document.getElementById("veh-form-photo-vehicle");
    const fileSim = document.getElementById("veh-form-photo-sim");
    const fileStnk = document.getElementById("veh-form-photo-stnk");
    const fileBpkb = document.getElementById("veh-form-photo-bpkb");

    if (fileVeh && fileVeh.files && fileVeh.files[0]) {
      try { photoVeh = await Utils.compressImage(fileVeh.files[0]); } catch (e) {}
    }
    if (fileSim && fileSim.files && fileSim.files[0]) {
      try { photoSim = await Utils.compressImage(fileSim.files[0]); } catch (e) {}
    }
    if (fileStnk && fileStnk.files && fileStnk.files[0]) {
      try { photoStnk = await Utils.compressImage(fileStnk.files[0]); } catch (e) {}
    }
    if (fileBpkb && fileBpkb.files && fileBpkb.files[0]) {
      try { photoBpkb = await Utils.compressImage(fileBpkb.files[0]); } catch (e) {}
    }

    const newVehicle = {
      id: "veh-" + Date.now(),
      name,
      model: name,
      brand: name.split(" ")[0] || "Kendaraan",
      plate_number: plate,
      type,
      year,
      color: "Standard",
      current_odometer: km,
      oil_interval_km: oilInterval,
      oil_interval_months: type === "mobil" ? 6 : 2,
      last_oil_odometer: km,
      last_oil_date: new Date().toISOString().split("T")[0],
      last_oil_brand: "Oli Rekomendasi",
      tax_annual_date: taxAnnual || "",
      tax_5year_date: tax5Year || "",
      sim_type: simType,
      sim_expiry_date: simExpiry || "",
      photo_vehicle: photoVeh,
      photo_sim: photoSim,
      photo_stnk: photoStnk,
      photo_bpkb: photoBpkb
    };

    await KendaraAPI.saveVehicle(newVehicle);
    state.activeVehicleId = newVehicle.id;
    KendaraAPI.setActiveVehicleId(newVehicle.id);

    closeModal("modal-add-vehicle");
    await refreshData();
    showToast(`Kendaraan ${name} berhasil ditambahkan!`, "success");
  }

  // Modal helpers
  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove("hidden");
      document.body.classList.add("overflow-hidden");
      if (window.lucide) lucide.createIcons();
    }
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }
  }

  // Toast Notification
  function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    let bg = "bg-slate-900 text-white";
    let icon = "info";

    if (type === "success") {
      bg = "bg-emerald-800 text-white";
      icon = "check-circle";
    } else if (type === "error") {
      bg = "bg-rose-700 text-white";
      icon = "alert-circle";
    } else if (type === "warning") {
      bg = "bg-amber-600 text-white";
      icon = "alert-triangle";
    }

    toast.className = `flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold ${bg} transition-all duration-300 transform translate-y-2 opacity-0`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
      <span>${Utils.escapeHTML(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    // Fade in
    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    });

    // Auto dismiss
    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function setupEventListeners() {
    // Backdrop click on modals to close
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", function (e) {
        if (e.target === this) {
          this.classList.add("hidden");
          document.body.classList.remove("overflow-hidden");
        }
      });
    });
  }

  // ============================================================
  // Photo Lightbox & Media Management
  // ============================================================
  let activeLightboxData = null;

  function openPhotoLightbox(photoUrl, title, type = "general", entityId = null, field = null) {
    if (!photoUrl) return;
    activeLightboxData = { photoUrl, title, type, entityId, field };

    const img = document.getElementById("lightbox-img");
    const titleEl = document.getElementById("lightbox-title");
    const deleteBtn = document.getElementById("lightbox-delete-btn");

    if (img) img.src = photoUrl;
    if (titleEl) titleEl.innerText = title || "Foto Dokumen / Part";
    if (deleteBtn) {
      deleteBtn.classList.toggle("hidden", type !== "vehicle");
    }

    openModal("modal-photo-lightbox");
  }

  function downloadActivePhoto() {
    if (!activeLightboxData || !activeLightboxData.photoUrl) return;
    const cleanTitle = (activeLightboxData.title || "foto_kendara")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    downloadPhoto(activeLightboxData.photoUrl, `${cleanTitle}.jpg`);
    showToast("Mengunduh foto...", "info");
  }

  function downloadPhoto(url, filename = "foto.jpg") {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function deleteActivePhoto() {
    if (!activeLightboxData || activeLightboxData.type !== "vehicle" || !activeLightboxData.field) {
      closeModal("modal-photo-lightbox");
      return;
    }

    if (confirm("Hapus foto ini dari kendaraan?")) {
      const vehicle = await KendaraAPI.getVehicle(state.activeVehicleId);
      if (vehicle) {
        vehicle[activeLightboxData.field] = "";
        await KendaraAPI.saveVehicle(vehicle);
        closeModal("modal-photo-lightbox");
        await refreshData();
        showToast("Foto berhasil dihapus", "success");
      }
    }
  }

  async function handleVehiclePhotoUpload(field, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      showToast("Mengompres & menyimpan foto...", "info");
      const compressedDataUrl = await Utils.compressImage(file);
      const vehicle = await KendaraAPI.getVehicle(state.activeVehicleId);
      if (vehicle) {
        vehicle[field] = compressedDataUrl;
        await KendaraAPI.saveVehicle(vehicle);
        await refreshData();
        showToast("Foto dokumen berhasil diperbarui!", "success");
      }
    } catch (err) {
      showToast("Gagal mengunggah foto: " + err.message, "error");
    }
  }

  function toggleKeyVisibility() {
    const input = document.getElementById("db-supabase-key-input");
    const icon = document.getElementById("key-visibility-icon");
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (icon) icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      if (icon) icon.setAttribute("data-lucide", "eye");
    }
    if (window.lucide) lucide.createIcons();
  }

  // ============================================================
  // User Authentication & Session Management
  // ============================================================
  let authMode = "login"; // 'login' | 'register'

  function checkAuthStatus() {
    const user = KendaraAuth.getUser();
    const loginScreen = document.getElementById("screen-login");
    const appHeader = document.getElementById("app-header");
    const appMain = document.getElementById("app-main");
    const appNav = document.querySelector("nav");

    if (!user) {
      if (loginScreen) loginScreen.classList.remove("hidden");
      if (appHeader) appHeader.classList.add("hidden");
      if (appMain) appMain.classList.add("hidden");
      if (appNav) appNav.classList.add("hidden");
      return false;
    } else {
      if (loginScreen) loginScreen.classList.add("hidden");
      if (appHeader) appHeader.classList.remove("hidden");
      if (appMain) appMain.classList.remove("hidden");
      if (appNav) appNav.classList.remove("hidden");

      // Update User Info in Header
      const headerName = document.getElementById("header-user-name");
      if (headerName) headerName.innerText = user.name || "Pengendara";

      // Update User Info in Analytics Screen
      const userNameEl = document.getElementById("analytics-user-name");
      const userEmailEl = document.getElementById("analytics-user-email");
      const userInitialsEl = document.getElementById("analytics-user-initials");
      const userBadgeEl = document.getElementById("analytics-user-badge");

      if (userNameEl) userNameEl.innerText = user.name || "Pengendara";
      if (userEmailEl) userEmailEl.innerText = user.email || "-";
      if (userBadgeEl) {
        userBadgeEl.innerText = user.provider === "supabase" ? "Akun Supabase (Cloud)" : "Mode Demo / Tamu";
      }
      if (userInitialsEl) {
        const initials = (user.name || "P").split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
        userInitialsEl.innerText = initials;
      }
      return true;
    }
  }

  function showAuthAlert(message, type = "error") {
    const container = document.getElementById("auth-alert-container");
    if (!container) return;
    const isError = type === "error";
    const isWarning = type === "warning";
    let bg = "bg-rose-50 border-rose-200 text-rose-900";
    let icon = "alert-triangle";
    let iconColor = "text-rose-600";
    let title = "Kendala Autentikasi";

    if (isWarning) {
      bg = "bg-amber-50 border-amber-200 text-amber-900";
      icon = "info";
      iconColor = "text-amber-600";
      title = "Pemberitahuan Akun";
    }

    container.className = `p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${bg} animate-fade-in`;
    container.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}"></i>
      <div class="flex-1 space-y-1">
        <p class="font-bold text-[11px]">${title}</p>
        <p class="text-[11px] leading-relaxed">${Utils.escapeHTML(message)}</p>
      </div>
      <button type="button" onclick="App.hideAuthAlert()" class="text-slate-400 hover:text-slate-600 p-0.5">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;
    container.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }

  function hideAuthAlert() {
    const container = document.getElementById("auth-alert-container");
    if (container) {
      container.classList.add("hidden");
      container.innerHTML = "";
    }
  }

  function toggleAuthMode(mode) {
    authMode = mode;
    hideAuthAlert();
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const nameGroup = document.getElementById("auth-name-group");
    const submitText = document.getElementById("auth-submit-text");

    if (mode === "login") {
      tabLogin.className = "py-2.5 rounded-xl transition-all bg-white text-[#0B4F9C] shadow-sm";
      tabRegister.className = "py-2.5 rounded-xl transition-all text-slate-500 hover:text-slate-900";
      nameGroup.classList.add("hidden");
      submitText.innerText = "Masuk Sekarang";
    } else {
      tabRegister.className = "py-2.5 rounded-xl transition-all bg-white text-[#0B4F9C] shadow-sm";
      tabLogin.className = "py-2.5 rounded-xl transition-all text-slate-500 hover:text-slate-900";
      nameGroup.classList.remove("hidden");
      submitText.innerText = "Daftar Akun Baru";
    }
    if (window.lucide) lucide.createIcons();
  }

  function toggleAuthPasswordVisibility() {
    const input = document.getElementById("auth-password-input");
    const icon = document.getElementById("auth-pass-toggle-icon");
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (icon) icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      if (icon) icon.setAttribute("data-lucide", "eye");
    }
    if (window.lucide) lucide.createIcons();
  }

  async function submitAuthForm(e) {
    if (e) e.preventDefault();
    hideAuthAlert();
    const email = document.getElementById("auth-email-input").value.trim();
    const password = document.getElementById("auth-password-input").value;
    const name = document.getElementById("auth-name-input")?.value?.trim() || "";

    const submitBtn = document.getElementById("auth-submit-btn");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin">🔄</span> Memproses...`;

    try {
      if (authMode === "login") {
        await KendaraAuth.login(email, password);
        showToast("Berhasil masuk! Selamat datang kembali.", "success");
      } else {
        const res = await KendaraAuth.register(name, email, password);
        if (res && res.requiresConfirmation) {
          showAuthAlert(res.message, "warning");
          showToast("Pendaftaran berhasil dicatat! Konfirmasi email diperlukan di Supabase.", "info", 7000);
          toggleAuthMode("login");
          return;
        }
        showToast("Pendaftaran berhasil! Selamat datang di KendaraTrack.", "success");
      }
      checkAuthStatus();
      await refreshData();
      switchTab("home");
    } catch (err) {
      showAuthAlert(err.message, "error");
      showToast("Gagal: " + err.message, "error", 6500);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      if (window.lucide) lucide.createIcons();
    }
  }

  async function loginAsGuest() {
    KendaraAuth.loginAsGuest();
    showToast("Masuk sebagai Tamu (Mode Demo)!", "success");
    checkAuthStatus();
    await refreshData();
    switchTab("home");
  }

  async function loginWithGoogle() {
    hideAuthAlert();
    try {
      showToast("Menghubungkan ke Akun Google...", "info", 3000);
      const user = await KendaraAuth.loginWithGoogle();
      if (user) {
        showToast("Berhasil masuk dengan Google!", "success");
        checkAuthStatus();
        await refreshData();
        switchTab("home");
      }
    } catch (err) {
      showAuthAlert("Gagal login Google: " + err.message, "error");
      showToast("Gagal login Google: " + err.message, "error", 6500);
    }
  }

  function toggleDevConfig() {
    const el = document.getElementById("dev-db-config-section");
    if (!el) return;
    const isHidden = el.classList.contains("hidden");
    el.classList.toggle("hidden");
    const label = document.getElementById("dev-config-toggle-label");
    if (label) {
      label.innerText = isHidden ? "Tutup Pengaturan Pengembang" : "⚙️ Pengaturan Kredensial Lanjutan (Khusus Pemilik)";
    }
    if (window.lucide) lucide.createIcons();
  }

  function confirmLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari akun ini?")) {
      KendaraAuth.logout();
      checkAuthStatus();
      showToast("Anda telah keluar.", "info");
    }
  }

  // ============================================================
  // Workshop Google Maps & Location Handlers
  // ============================================================
  let activeWorkshopData = null;

  function openWorkshopMapModal(logId) {
    const item = state.maintenanceLogs.find((m) => m.id === logId);
    if (!item) return;

    activeWorkshopData = item;

    const workshopName = item.workshop || "Bengkel Kendaraan";
    const workshopAddress = item.workshop_address || workshopName;
    const itemName = item.item_name || "Perawatan Kendaraan";

    document.getElementById("maps-modal-workshop-name").innerText = workshopName;
    document.getElementById("maps-modal-item-name").innerText = `${itemName} (${item.brand || "Part"})`;
    document.getElementById("maps-modal-address").innerText = workshopAddress;
    document.getElementById("maps-modal-date-km").innerText = `Tanggal: ${Utils.formatDateIndo(item.date)} • ${item.odometer ? Utils.formatKm(item.odometer) : "-"}`;
    document.getElementById("maps-modal-cost").innerText = Utils.formatRupiah(item.cost || 0);

    const query = encodeURIComponent(`${workshopName} ${item.workshop_address || ""}`.trim());
    const embedUrl = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    const directUrl = item.workshop_maps_url || `https://www.google.com/maps/search/?api=1&query=${query}`;

    const iframe = document.getElementById("maps-modal-iframe");
    if (iframe) {
      iframe.src = embedUrl;
    }

    const directLink = document.getElementById("maps-modal-direct-link");
    if (directLink) {
      directLink.href = directUrl;
    }

    openModal("modal-google-maps");
  }

  function copyWorkshopAddress() {
    if (!activeWorkshopData) return;
    const textToCopy = `${activeWorkshopData.workshop || "Bengkel"} - ${activeWorkshopData.workshop_address || ""}`.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
      showToast("Alamat bengkel berhasil disalin!", "success");
    } else {
      showToast("Alamat: " + textToCopy, "info");
    }
  }

  function detectCurrentLocation(targetInputId) {
    if (!navigator.geolocation) {
      showToast("Geolocation tidak didukung oleh browser Anda", "error");
      return;
    }
    showToast("Mendeteksi lokasi GPS Anda...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const targetInput = document.getElementById(targetInputId);
        if (targetInput) {
          targetInput.value = `Lokasi GPS: ${lat}, ${lng}`;
        }
        showToast("Lokasi GPS berhasil didapatkan!", "success");
      },
      (err) => {
        showToast("Gagal mengambil lokasi: " + err.message, "error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function searchLocationInMaps(workshopInputId, addressInputId) {
    const workshop = (document.getElementById(workshopInputId)?.value || "").trim();
    const address = (document.getElementById(addressInputId)?.value || "").trim();
    const q = encodeURIComponent(`${workshop} ${address}`.trim() || "Bengkel terdekat");
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  // ============================================================
  // PWA (Progressive Web App) Home Screen Installation Handlers
  // ============================================================
  let deferredInstallPrompt = null;
  let isStandalone = false;

  function initPWA() {
    isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

    const banner = document.getElementById("pwa-install-banner");
    const statusBadge = document.getElementById("pwa-status-badge");

    if (isStandalone) {
      if (banner) banner.classList.add("hidden");
      if (statusBadge) {
        statusBadge.innerText = "Terpasang";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700";
      }
      return;
    }

    // Check if dismissed in current session
    if (sessionStorage.getItem("kendaratrack_pwa_dismissed") === "true") {
      if (banner) banner.classList.add("hidden");
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (banner && sessionStorage.getItem("kendaratrack_pwa_dismissed") !== "true") {
        banner.classList.remove("hidden");
      }
      if (statusBadge) {
        statusBadge.innerText = "Siap Pasang";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 animate-pulse";
      }
      if (window.lucide) lucide.createIcons();
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      if (banner) banner.classList.add("hidden");
      if (statusBadge) {
        statusBadge.innerText = "Terpasang";
        statusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700";
      }
      showToast("Selamat! KendaraTrack telah terpasang di layar utama HP Anda.", "success");
    });
  }

  async function triggerPWAInstall() {
    if (isStandalone) {
      showToast("KendaraTrack sudah terpasang di layar utama HP Anda!", "info");
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        showToast("Memasang KendaraTrack di layar utama...", "success");
        deferredInstallPrompt = null;
        dismissInstallBanner();
      }
    } else {
      // If prompt not available directly (e.g. iOS Safari), show the visual guide modal
      openModal("modal-pwa-install");
    }
  }

  async function triggerPWAInstallDirect() {
    if (deferredInstallPrompt) {
      closeModal("modal-pwa-install");
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        showToast("Memasang KendaraTrack di layar utama...", "success");
        deferredInstallPrompt = null;
        dismissInstallBanner();
      }
    } else {
      showToast("Gunakan menu browser: 'Tambahkan ke Layar Utama' (Add to Home Screen).", "info");
    }
  }

  function dismissInstallBanner() {
    const banner = document.getElementById("pwa-install-banner");
    if (banner) banner.classList.add("hidden");
    sessionStorage.setItem("kendaratrack_pwa_dismissed", "true");
  }

  // Public Interface
  return {
    init,
    switchTab,
    switchVehicle,
    refreshData,
    setTxFilterType,
    setTxFilterCategory,
    setTxSearchQuery,
    openUpdateKmModal,
    submitUpdateKm,
    openAddTransactionModal,
    openEditTransactionModal,
    setTransactionTypeInForm,
    populateTransactionCategories,
    toggleFuelFields,
    handleTransactionCategoryChange,
    switchToDedicatedModal,
    submitTransactionForm,
    deleteTransactionConfirm,
    openQuickOilModal,
    submitQuickOilForm,
    openQuickSparepartModal,
    submitQuickSparepartForm,
    getFuelAnalytics,
    openFuelHubModal,
    openQuickFuelModal,
    handleFuelTypeChange,
    syncFuelAmountToLiters,
    syncFuelLitersToAmount,
    submitQuickFuelForm,
    toggleFuelCalculator,
    calculateFuelEfficiencyManual,
    openFleetModal,
    switchFleetTab,
    requestGPSPermission,
    startTripTracking,
    stopTripTracking,
    openAddVisitModal,
    submitAddVisit,
    viewTripMap,
    openActiveTripInGoogleMaps,
    deleteTripConfirm,
    openAddScheduleModal,
    openEditScheduleModal,
    deleteScheduleConfirm,
    submitScheduleForm,
    openPayScheduleModal,
    submitPayScheduleForm,
    openAddVehicleModal,
    submitAddVehicleForm,
    openModal,
    closeModal,
    showToast,
    saveDatabaseSettings,
    testDatabaseConnection,
    copySyncLinkForMobile,
    toggleDbProviderInputs,
    toggleKeyVisibility,
    openActiveVehiclePhoto,
    openPhotoLightbox,
    downloadActivePhoto,
    downloadPhoto,
    deleteActivePhoto,
    handleVehiclePhotoUpload,
    openWorkshopMapModal,
    copyWorkshopAddress,
    detectCurrentLocation,
    searchLocationInMaps,
    toggleAuthMode,
    toggleAuthPasswordVisibility,
    showAuthAlert,
    hideAuthAlert,
    submitAuthForm,
    loginAsGuest,
    loginWithGoogle,
    toggleDevConfig,
    confirmLogout,
    triggerPWAInstall,
    triggerPWAInstallDirect,
    dismissInstallBanner,
    exportDataCSV,
    resetDemoData
  };
})();

// Expose globally for inline event handlers and component interactions
window.App = App;

// Service Worker Registration for PWA Offline & Home Screen Add
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker aktif:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker gagal didaftarkan:", err);
      });
  });
}

// Auto-boot on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
