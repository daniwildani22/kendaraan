/**
 * KendaraTrack - Interactive Calendar Component
 * Monthly calendar grid with color-coded dot badges and reactive agenda list
 */

const Calendar = (function () {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-11
  let selectedDateStr = null; // YYYY-MM-DD or null for all month
  let activeFilter = "semua"; // 'semua' | 'pending' | 'completed'

  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function init() {
    render();
  }

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    selectedDateStr = null;
    render();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    selectedDateStr = null;
    render();
  }

  function goToToday() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    const day = String(now.getDate()).padStart(2, "0");
    const m = String(currentMonth + 1).padStart(2, "0");
    selectedDateStr = `${currentYear}-${m}-${day}`;
    render();
  }

  function selectDate(dateStr) {
    if (selectedDateStr === dateStr) {
      selectedDateStr = null; // Toggle off if clicked again
    } else {
      selectedDateStr = dateStr;
    }
    render();
  }

  function setFilter(filter) {
    activeFilter = filter;
    renderAgenda();
  }

  async function render() {
    const calendarHeaderEl = document.getElementById("cal-month-title");
    const calendarGridEl = document.getElementById("cal-days-grid");
    if (!calendarHeaderEl || !calendarGridEl) return;

    calendarHeaderEl.innerText = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    // Get active vehicle and schedules
    const activeVehicleId = KendaraAPI.getActiveVehicleId();
    const schedules = await KendaraAPI.getSchedules(activeVehicleId);

    // Group schedules by date in current month
    const schedulesByDate = {};
    schedules.forEach((sch) => {
      const d = sch.due_date;
      if (!schedulesByDate[d]) schedulesByDate[d] = [];
      schedulesByDate[d].push(sch);
    });

    // Calendar math
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
    const todayDate = today.getDate();

    let gridHtml = "";

    // Previous month spacer days
    for (let x = firstDayIndex; x > 0; x--) {
      const prevDate = daysInPrevMonth - x + 1;
      gridHtml += `
        <div class="h-10 flex items-center justify-center text-xs text-slate-300 select-none">
          ${prevDate}
        </div>
      `;
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayPad = String(day).padStart(2, "0");
      const monthPad = String(currentMonth + 1).padStart(2, "0");
      const dateStr = `${currentYear}-${monthPad}-${dayPad}`;

      const isToday = isCurrentMonth && day === todayDate;
      const isSelected = selectedDateStr === dateStr;

      const daySchedules = schedulesByDate[dateStr] || [];

      // Determine dots
      let dotsHtml = "";
      if (daySchedules.length > 0) {
        dotsHtml = '<div class="flex items-center justify-center space-x-1 mt-0.5">';
        daySchedules.forEach((s) => {
          let dotColor = "bg-emerald-500";
          if (s.category === "pajak") dotColor = "bg-rose-500";
          else if (s.category === "cicilan") dotColor = "bg-amber-500";
          else if (s.category === "oli") dotColor = "bg-emerald-500";
          else dotColor = "bg-blue-500";

          if (s.is_completed) dotColor = "bg-slate-300";

          dotsHtml += `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>`;
        });
        dotsHtml += "</div>";
      }

      let btnClass = "text-slate-700 hover:bg-slate-100";
      if (isSelected) {
        btnClass = "bg-gradient-to-br from-[#0F5132] to-[#198754] text-white shadow-md font-semibold";
      } else if (isToday) {
        btnClass = "border border-emerald-500 text-emerald-800 font-bold bg-emerald-50/50";
      }

      gridHtml += `
        <button onclick="Calendar.selectDate('${dateStr}')" 
          class="h-11 rounded-xl flex flex-col items-center justify-center transition-all relative ${btnClass}">
          <span class="text-xs leading-none">${day}</span>
          ${dotsHtml}
        </button>
      `;
    }

    calendarGridEl.innerHTML = gridHtml;
    renderAgenda(schedules);
  }

  function renderAgenda(cachedSchedules = null) {
    const agendaContainer = document.getElementById("cal-agenda-list");
    const agendaSubtitle = document.getElementById("cal-agenda-subtitle");
    if (!agendaContainer) return;

    const renderItems = (schedules) => {
      // Filter by vehicle
      const activeVehicleId = KendaraAPI.getActiveVehicleId();
      let list = schedules.filter((s) => s.vehicle_id === activeVehicleId);

      if (selectedDateStr) {
        list = list.filter((s) => s.due_date === selectedDateStr);
        if (agendaSubtitle) {
          agendaSubtitle.innerHTML = `Jadwal untuk tanggal <span class="font-bold text-slate-800">${Utils.formatDateIndo(selectedDateStr, true)}</span> <button onclick="Calendar.selectDate(null)" class="text-xs text-emerald-700 underline ml-2">Lihat Semua Bulan Ini</button>`;
        }
      } else {
        const monthPad = String(currentMonth + 1).padStart(2, "0");
        const prefix = `${currentYear}-${monthPad}`;
        list = list.filter((s) => s.due_date.startsWith(prefix));
        if (agendaSubtitle) {
          agendaSubtitle.innerHTML = `Semua jadwal bulan <span class="font-bold text-slate-800">${MONTH_NAMES[currentMonth]} ${currentYear}</span>`;
        }
      }

      // Filter by status tab
      if (activeFilter === "pending") {
        list = list.filter((s) => !s.is_completed);
      } else if (activeFilter === "completed") {
        list = list.filter((s) => s.is_completed);
      }

      if (list.length === 0) {
        agendaContainer.innerHTML = `
          <div class="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
            <div class="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
              <i data-lucide="calendar-check" class="w-6 h-6"></i>
            </div>
            <p class="text-sm font-semibold text-slate-700">Tidak ada pengingat</p>
            <p class="text-xs text-slate-400 mt-0.5">Semua jadwal Anda aman & tertib!</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      let html = "";
      list.forEach((item) => {
        const cat = Utils.getCategoryDetails(item.category);
        const statusMeta = Utils.getScheduleStatus(item.due_date);

        const isDone = item.is_completed;
        const badgeText = isDone ? "Selesai" : statusMeta.label;
        const badgeClass = isDone
          ? "bg-slate-100 text-slate-600 border border-slate-200"
          : statusMeta.badgeClass;

        html += `
          <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all hover:shadow-md ${isDone ? "opacity-75" : ""}">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center ${cat.bg}">
                  <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-slate-900 ${isDone ? "line-through text-slate-500" : ""}">${Utils.escapeHTML(item.title)}</h4>
                  <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>${Utils.formatDateIndo(item.due_date)}</span>
                    ${item.target_odometer ? `<span>• Target ${Utils.formatKm(item.target_odometer)}</span>` : ""}
                  </p>
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${badgeClass}">
                ${badgeText}
              </span>
            </div>

            <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span class="text-slate-400">Estimasi Biaya:</span>
                <span class="font-bold text-slate-800 ml-1">${Utils.formatRupiah(item.est_cost)}</span>
              </div>
              <div>
                ${
                  !isDone
                    ? `
                  <button onclick="window.App.openPayScheduleModal('${item.id}')"
                    class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0F5132] to-[#198754] text-white font-medium hover:opacity-95 shadow-sm flex items-center gap-1.5">
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                    <span>Selesai & Bayar</span>
                  </button>
                `
                    : `
                  <span class="text-emerald-700 font-semibold flex items-center gap-1">
                    <i data-lucide="check" class="w-4 h-4"></i> Lunas
                  </span>
                `
                }
              </div>
            </div>
          </div>
        `;
      });

      agendaContainer.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    };

    if (cachedSchedules) {
      renderItems(cachedSchedules);
    } else {
      KendaraAPI.getSchedules().then(renderItems);
    }
  }

  return {
    init,
    prevMonth,
    nextMonth,
    goToToday,
    selectDate,
    setFilter,
    render
  };
})();

window.Calendar = Calendar;
