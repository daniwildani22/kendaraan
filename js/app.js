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
    editingScheduleId: null
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
    const isLoggedIn = checkAuthStatus();
    if (!isLoggedIn) {
      if (window.lucide) lucide.createIcons();
      return;
    }

    state.activeVehicleId = KendaraAPI.getActiveVehicleId();
    updateGreetingText();
    await refreshData();
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

    // Render active screen
    renderCurrentTab();
    renderVehicleDropdown();
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

    // 2. Sparepart Replacement History Timeline
    renderSparepartTimeline();

    // 3. Vehicle Documents Card
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
    const provider = document.getElementById("db-provider-select").value;
    const gasUrl = document.getElementById("db-gas-url-input").value.trim();
    const supabaseUrl = document.getElementById("db-supabase-url-input").value.trim();
    const supabaseAnonKey = document.getElementById("db-supabase-key-input").value.trim();

    KendaraAPI.setConfig({
      provider,
      gasUrl,
      supabaseUrl,
      supabaseAnonKey
    });

    showToast("Pengaturan database disimpan", "success");
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
      statusEl.innerHTML = `<span class="animate-spin">🔄</span> Menguji koneksi...`;
    }

    // Auto-update config dari input form sebelum menguji
    const provider = document.getElementById("db-provider-select").value;
    const gasUrl = (document.getElementById("db-gas-url-input").value || "").trim();
    const supabaseUrl = (document.getElementById("db-supabase-url-input").value || "").trim();
    const supabaseAnonKey = (document.getElementById("db-supabase-key-input").value || "").trim();

    KendaraAPI.setConfig({
      provider,
      gasUrl,
      supabaseUrl,
      supabaseAnonKey
    });

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
   * Copy Cross-Device Sync Link for Mobile
   */
  function copySyncLinkForMobile() {
    const config = KendaraAPI.getConfig();
    if (config.provider === "LOCAL_DEMO") {
      showToast("Pilih provider Supabase dan simpan pengaturan terlebih dahulu.", "info");
      return;
    }
    if (!config.supabaseUrl && !config.gasUrl) {
      showToast("Isi URL dan Key database terlebih dahulu!", "error");
      return;
    }
    const syncUrl = KendaraAPI.generateSyncUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(syncUrl);
      showToast("Tautan sinkronisasi disalin! Kirim ke WhatsApp dan buka di HP Anda.", "success");
    } else {
      prompt("Salin tautan sinkronisasi ini dan buka di HP Anda:", syncUrl);
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
  function showToast(message, type = "info") {
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
    }, 3200);
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

  function toggleAuthMode(mode) {
    authMode = mode;
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const nameGroup = document.getElementById("auth-name-group");
    const submitText = document.getElementById("auth-submit-text");

    if (mode === "login") {
      tabLogin.className = "py-2.5 rounded-xl transition-all bg-white text-emerald-800 shadow-sm";
      tabRegister.className = "py-2.5 rounded-xl transition-all text-slate-500 hover:text-slate-900";
      nameGroup.classList.add("hidden");
      submitText.innerText = "Masuk Sekarang";
    } else {
      tabRegister.className = "py-2.5 rounded-xl transition-all bg-white text-emerald-800 shadow-sm";
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
        await KendaraAuth.register(name, email, password);
        showToast("Pendaftaran berhasil! Selamat datang di KendaraTrack.", "success");
      }
      checkAuthStatus();
      await refreshData();
      switchTab("home");
    } catch (err) {
      showToast("Gagal: " + err.message, "error");
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
    submitAuthForm,
    loginAsGuest,
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
