/**
 * KendaraTrack - Centralized Data Layer (Repository / Adapter Pattern)
 * Seamless migration between:
 * 1. LOCAL_DEMO (LocalStorage with rich Indonesian seed data)
 * 2. GAS (Google Apps Script Web App JSON API)
 * 3. SUPABASE (Supabase PostgreSQL REST API)
 */

const KendaraAPI = (function () {
  const CONFIG_KEY = "kendaratrack_app_config";
  const STORAGE_KEYS = {
    VEHICLES: "kendaratrack_vehicles",
    TRANSACTIONS: "kendaratrack_transactions",
    MAINTENANCE: "kendaratrack_maintenance",
    SCHEDULES: "kendaratrack_schedules",
    ACTIVE_VEHICLE: "kendaratrack_active_vehicle_id"
  };

  // Default configuration
  let config = {
    provider: "LOCAL_DEMO", // 'LOCAL_DEMO' | 'GAS' | 'SUPABASE'
    gasUrl: "",
    supabaseUrl: "",
    supabaseAnonKey: ""
  };

  // Load saved config if exists
  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        config = { ...config, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load config from localStorage", e);
    }
  }

  // Save configuration
  function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  // Initialize seed data for LOCAL_DEMO if storage is empty
  function initLocalStorageIfNeeded() {
    if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(SEED_VEHICLES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE)) {
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(SEED_MAINTENANCE_LOGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SCHEDULES)) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(SEED_SCHEDULES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_VEHICLE)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE, "veh-001");
    }
  }

  loadConfig();
  initLocalStorageIfNeeded();

  /* ============================================================
     LOCAL STORAGE ADAPTER
     ============================================================ */
  const LocalAdapter = {
    async getVehicles() {
      const data = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      return data ? JSON.parse(data) : [];
    },

    async saveVehicle(vehicle) {
      const vehicles = await this.getVehicles();
      const existingIdx = vehicles.findIndex((v) => v.id === vehicle.id);
      if (existingIdx >= 0) {
        vehicles[existingIdx] = { ...vehicles[existingIdx], ...vehicle };
      } else {
        vehicle.id = vehicle.id || "veh-" + Date.now();
        vehicles.push(vehicle);
      }
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      return vehicle;
    },

    async deleteVehicle(id) {
      let vehicles = await this.getVehicles();
      vehicles = vehicles.filter((v) => v.id !== id);
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      return true;
    },

    async updateOdometer(vehicleId, newKm) {
      const vehicles = await this.getVehicles();
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (vehicle) {
        vehicle.current_odometer = Number(newKm);
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      }
      return vehicle;
    },

    async getTransactions(vehicleId = null) {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      let list = data ? JSON.parse(data) : [];
      if (vehicleId) {
        list = list.filter((t) => t.vehicle_id === vehicleId);
      }
      // Sort newest first
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addTransaction(tx) {
      const list = await this.getTransactions();
      tx.id = tx.id || "tx-" + Date.now();
      tx.created_at = tx.created_at || new Date().toISOString();
      list.unshift(tx);
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));

      // Auto update vehicle odometer if tx has higher odometer
      if (tx.odometer && tx.vehicle_id) {
        const vehicles = await this.getVehicles();
        const v = vehicles.find((item) => item.id === tx.vehicle_id);
        if (v && Number(tx.odometer) > (v.current_odometer || 0)) {
          v.current_odometer = Number(tx.odometer);
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
        }
      }

      return tx;
    },

    async updateTransaction(tx) {
      const list = await this.getTransactions();
      const idx = list.findIndex((t) => t.id === tx.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...tx };
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
        return list[idx];
      }
      throw new Error("Transaksi tidak ditemukan");
    },

    async deleteTransaction(id) {
      let list = await this.getTransactions();
      list = list.filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
      return true;
    },

    async getMaintenanceLogs(vehicleId = null) {
      const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
      let list = data ? JSON.parse(data) : [];
      if (vehicleId) {
        list = list.filter((m) => m.vehicle_id === vehicleId);
      }
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addMaintenanceLog(log) {
      const list = await this.getMaintenanceLogs();
      log.id = log.id || "mnt-" + Date.now();
      list.unshift(log);
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(list));

      // If oil replacement, update vehicle last_oil_odometer and last_oil_date
      if (log.log_type === "oli" && log.vehicle_id) {
        const vehicles = await this.getVehicles();
        const v = vehicles.find((item) => item.id === log.vehicle_id);
        if (v) {
          v.last_oil_odometer = Number(log.odometer) || v.last_oil_odometer;
          v.last_oil_date = log.date;
          if (log.brand) v.last_oil_brand = log.brand;
          if (Number(log.odometer) > (v.current_odometer || 0)) {
            v.current_odometer = Number(log.odometer);
          }
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
        }
      }

      return log;
    },

    async deleteMaintenanceLog(id) {
      let list = await this.getMaintenanceLogs();
      list = list.filter((m) => m.id !== id);
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(list));
      return true;
    },

    async getSchedules(vehicleId = null) {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      let list = data ? JSON.parse(data) : [];
      if (vehicleId) {
        list = list.filter((s) => s.vehicle_id === vehicleId);
      }
      // Sort upcoming first
      return list.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    },

    async addSchedule(sch) {
      const list = await this.getSchedules();
      sch.id = sch.id || "sch-" + Date.now();
      sch.is_completed = false;
      sch.completed_at = null;
      list.push(sch);
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(list));
      return sch;
    },

    async updateSchedule(sch) {
      const list = await this.getSchedules();
      const idx = list.findIndex((s) => s.id === sch.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...sch };
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(list));
        return list[idx];
      }
      throw new Error("Jadwal tidak ditemukan");
    },

    async completeSchedule(id, paymentData = null) {
      const schedules = await this.getSchedules();
      const sch = schedules.find((s) => s.id === id);
      if (!sch) throw new Error("Jadwal tidak ditemukan");

      sch.is_completed = true;
      sch.completed_at = new Date().toISOString();

      // Record transaction if paymentData provided
      let txRecord = null;
      if (paymentData) {
        txRecord = await this.addTransaction({
          vehicle_id: sch.vehicle_id,
          type: "pengeluaran",
          category: paymentData.category || sch.category || "servis",
          amount: Number(paymentData.amount) || Number(sch.est_cost) || 0,
          date: paymentData.date || new Date().toISOString().split("T")[0],
          odometer: paymentData.odometer || null,
          fuel_liters: null,
          fuel_price_per_liter: null,
          notes: `Pembayaran ${sch.title}. ${paymentData.notes || ""}`.trim(),
          bengkel_name: paymentData.bengkel_name || ""
        });

        // If it was an oil change, create maintenance log too
        if (sch.category === "oli") {
          await this.addMaintenanceLog({
            vehicle_id: sch.vehicle_id,
            log_type: "oli",
            item_name: sch.title,
            brand: paymentData.oil_brand || "Oli Mesin",
            odometer: paymentData.odometer || null,
            date: paymentData.date || new Date().toISOString().split("T")[0],
            cost: Number(paymentData.amount) || Number(sch.est_cost) || 0,
            workshop: paymentData.bengkel_name || "Bengkel",
            notes: "Ganti oli terjadwal dari pengingat"
          });
        }
      }

      // Auto-generate next recurring schedule if enabled
      let nextSchedule = null;
      if (sch.is_recurring) {
        const currentDate = new Date(sch.due_date);
        const monthsToAdd = sch.recurring_interval_months || 12;
        currentDate.setMonth(currentDate.getMonth() + monthsToAdd);

        const nextDueDate = currentDate.toISOString().split("T")[0];
        let nextTargetKm = null;
        if (sch.target_odometer && sch.recurring_interval_km) {
          nextTargetKm = Number(sch.target_odometer) + Number(sch.recurring_interval_km);
        }

        nextSchedule = {
          id: "sch-" + Date.now(),
          vehicle_id: sch.vehicle_id,
          title: sch.title,
          category: sch.category,
          due_date: nextDueDate,
          target_odometer: nextTargetKm,
          est_cost: sch.est_cost,
          notes: sch.notes,
          is_recurring: true,
          recurring_interval_months: sch.recurring_interval_months,
          recurring_interval_km: sch.recurring_interval_km,
          is_completed: false,
          completed_at: null
        };
        schedules.push(nextSchedule);
      }

      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
      return { completedSchedule: sch, nextSchedule, txRecord };
    }
  };

  /* ============================================================
     GOOGLE APPS SCRIPT ADAPTER
     ============================================================ */
  const GasAdapter = {
    async callGAS(action, payload = {}) {
      if (!config.gasUrl) {
        throw new Error("URL Google Apps Script belum dikonfigurasi di Pengaturan.");
      }
      try {
        const response = await fetch(config.gasUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8" // GAS handles text/plain with JSON body seamlessly without CORS preflight issues
          },
          body: JSON.stringify({ action, ...payload })
        });
        const result = await response.json();
        if (result.status === "error") {
          throw new Error(result.message || "Gagal memproses request Google Apps Script");
        }
        return result.data;
      } catch (err) {
        console.warn("GAS call failed, falling back to local replica:", err.message);
        // Fallback gracefully to local adapter on network error
        throw err;
      }
    },

    async getVehicles() {
      try {
        const res = await this.callGAS("get_vehicles");
        return res || LocalAdapter.getVehicles();
      } catch (e) {
        return LocalAdapter.getVehicles();
      }
    },

    async saveVehicle(vehicle) {
      try {
        await this.callGAS("save_vehicle", { vehicle });
      } catch (e) {
        console.warn("GAS save failed:", e);
      }
      return LocalAdapter.saveVehicle(vehicle);
    },

    async deleteVehicle(id) {
      try {
        await this.callGAS("delete_vehicle", { id });
      } catch (e) {
        console.warn("GAS delete failed:", e);
      }
      return LocalAdapter.deleteVehicle(id);
    },

    async updateOdometer(vehicleId, newKm) {
      try {
        await this.callGAS("update_odometer", { vehicleId, newKm });
      } catch (e) {
        console.warn("GAS update odometer failed:", e);
      }
      return LocalAdapter.updateOdometer(vehicleId, newKm);
    },

    async getTransactions(vehicleId = null) {
      try {
        const res = await this.callGAS("get_transactions", { vehicleId });
        return res || LocalAdapter.getTransactions(vehicleId);
      } catch (e) {
        return LocalAdapter.getTransactions(vehicleId);
      }
    },

    async addTransaction(tx) {
      try {
        await this.callGAS("add_transaction", { transaction: tx });
      } catch (e) {
        console.warn("GAS add tx failed:", e);
      }
      return LocalAdapter.addTransaction(tx);
    },

    async updateTransaction(tx) {
      try {
        await this.callGAS("update_transaction", { transaction: tx });
      } catch (e) {
        console.warn("GAS update tx failed:", e);
      }
      return LocalAdapter.updateTransaction(tx);
    },

    async deleteTransaction(id) {
      try {
        await this.callGAS("delete_transaction", { id });
      } catch (e) {
        console.warn("GAS delete tx failed:", e);
      }
      return LocalAdapter.deleteTransaction(id);
    },

    async getMaintenanceLogs(vehicleId = null) {
      try {
        const res = await this.callGAS("get_maintenance_logs", { vehicleId });
        return res || LocalAdapter.getMaintenanceLogs(vehicleId);
      } catch (e) {
        return LocalAdapter.getMaintenanceLogs(vehicleId);
      }
    },

    async addMaintenanceLog(log) {
      try {
        await this.callGAS("add_maintenance_log", { log });
      } catch (e) {
        console.warn("GAS add log failed:", e);
      }
      return LocalAdapter.addMaintenanceLog(log);
    },

    async deleteMaintenanceLog(id) {
      try {
        await this.callGAS("delete_maintenance_log", { id });
      } catch (e) {
        console.warn("GAS delete log failed:", e);
      }
      return LocalAdapter.deleteMaintenanceLog(id);
    },

    async getSchedules(vehicleId = null) {
      try {
        const res = await this.callGAS("get_schedules", { vehicleId });
        return res || LocalAdapter.getSchedules(vehicleId);
      } catch (e) {
        return LocalAdapter.getSchedules(vehicleId);
      }
    },

    async addSchedule(sch) {
      try {
        await this.callGAS("add_schedule", { schedule: sch });
      } catch (e) {
        console.warn("GAS add schedule failed:", e);
      }
      return LocalAdapter.addSchedule(sch);
    },

    async updateSchedule(sch) {
      try {
        await this.callGAS("update_schedule", { schedule: sch });
      } catch (e) {
        console.warn("GAS update schedule failed:", e);
      }
      return LocalAdapter.updateSchedule(sch);
    },

    async completeSchedule(id, paymentData = null) {
      try {
        await this.callGAS("complete_schedule", { id, paymentData });
      } catch (e) {
        console.warn("GAS complete schedule failed:", e);
      }
      return LocalAdapter.completeSchedule(id, paymentData);
    }
  };

  /* ============================================================
     SUPABASE REST ADAPTER (Phase 2)
     ============================================================ */
  const SupabaseAdapter = {
    getHeaders() {
      const key = (config.supabaseAnonKey || "").trim();
      return {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation"
      };
    },

    async fetchSupabase(endpoint, options = {}) {
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error("Supabase URL / Anon Key belum dikonfigurasi.");
      }
      // Bersihkan URL dari trailing slash atau path ekstra
      let baseUrl = config.supabaseUrl.trim().replace(/\/+$/, "");
      if (baseUrl.endsWith("/rest/v1")) {
        baseUrl = baseUrl.substring(0, baseUrl.length - 8);
      }
      const url = `${baseUrl}/rest/v1/${endpoint}`;
      
      let response;
      try {
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...(options.headers || {})
          }
        });
      } catch (networkErr) {
        throw new Error(`Tidak dapat menghubungi server (${networkErr.message}). Periksa URL project atau koneksi internet Anda.`);
      }

      if (!response.ok) {
        let errMsg = `Supabase Error (${response.status})`;
        try {
          const err = await response.json();
          errMsg = err.message || err.error_description || err.error || errMsg;
          if (errMsg.includes("relation") && errMsg.includes("does not exist")) {
            errMsg = "Tabel belum dibuat di Supabase. Silakan buka SQL Editor di Supabase dan jalankan file 'supabase_schema.sql'.";
          }
        } catch (e) {
          const text = await response.text();
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }

      // Jika response kosong (seperti method HEAD atau 204 No Content)
      if (response.status === 204 || (options.method && options.method.toUpperCase() === "HEAD")) {
        return null;
      }

      const rawText = await response.text();
      return rawText ? JSON.parse(rawText) : null;
    },

    async getVehicles() {
      try {
        return await this.fetchSupabase("vehicles?select=*");
      } catch (e) {
        console.warn("Supabase fetch failed, fallback to local:", e);
        return LocalAdapter.getVehicles();
      }
    },

    async saveVehicle(vehicle) {
      try {
        const res = await this.fetchSupabase("vehicles", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(vehicle)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.saveVehicle(vehicle);
      }
    },

    async deleteVehicle(id) {
      try {
        await this.fetchSupabase(`vehicles?id=eq.${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Supabase delete failed:", e);
      }
      return LocalAdapter.deleteVehicle(id);
    },

    async updateOdometer(vehicleId, newKm) {
      try {
        await this.fetchSupabase(`vehicles?id=eq.${vehicleId}`, {
          method: "PATCH",
          body: JSON.stringify({ current_odometer: Number(newKm) })
        });
      } catch (e) {
        console.warn(e);
      }
      return LocalAdapter.updateOdometer(vehicleId, newKm);
    },

    async getTransactions(vehicleId = null) {
      try {
        const query = vehicleId
          ? `transactions?vehicle_id=eq.${vehicleId}&order=date.desc`
          : "transactions?order=date.desc";
        return await this.fetchSupabase(query);
      } catch (e) {
        return LocalAdapter.getTransactions(vehicleId);
      }
    },

    async addTransaction(tx) {
      try {
        const res = await this.fetchSupabase("transactions", {
          method: "POST",
          body: JSON.stringify(tx)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.addTransaction(tx);
      }
    },

    async updateTransaction(tx) {
      try {
        const res = await this.fetchSupabase(`transactions?id=eq.${tx.id}`, {
          method: "PATCH",
          body: JSON.stringify(tx)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.updateTransaction(tx);
      }
    },

    async deleteTransaction(id) {
      try {
        await this.fetchSupabase(`transactions?id=eq.${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn(e);
      }
      return LocalAdapter.deleteTransaction(id);
    },

    async getMaintenanceLogs(vehicleId = null) {
      try {
        const query = vehicleId
          ? `maintenance_logs?vehicle_id=eq.${vehicleId}&order=date.desc`
          : "maintenance_logs?order=date.desc";
        return await this.fetchSupabase(query);
      } catch (e) {
        return LocalAdapter.getMaintenanceLogs(vehicleId);
      }
    },

    async addMaintenanceLog(log) {
      try {
        const res = await this.fetchSupabase("maintenance_logs", {
          method: "POST",
          body: JSON.stringify(log)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.addMaintenanceLog(log);
      }
    },

    async deleteMaintenanceLog(id) {
      try {
        await this.fetchSupabase(`maintenance_logs?id=eq.${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn(e);
      }
      return LocalAdapter.deleteMaintenanceLog(id);
    },

    async getSchedules(vehicleId = null) {
      try {
        const query = vehicleId
          ? `schedules?vehicle_id=eq.${vehicleId}&order=due_date.asc`
          : "schedules?order=due_date.asc";
        return await this.fetchSupabase(query);
      } catch (e) {
        return LocalAdapter.getSchedules(vehicleId);
      }
    },

    async addSchedule(sch) {
      try {
        const res = await this.fetchSupabase("schedules", {
          method: "POST",
          body: JSON.stringify(sch)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.addSchedule(sch);
      }
    },

    async updateSchedule(sch) {
      try {
        const res = await this.fetchSupabase(`schedules?id=eq.${sch.id}`, {
          method: "PATCH",
          body: JSON.stringify(sch)
        });
        return res[0];
      } catch (e) {
        return LocalAdapter.updateSchedule(sch);
      }
    },

    async completeSchedule(id, paymentData = null) {
      return LocalAdapter.completeSchedule(id, paymentData);
    }
  };

  // Helper to pick active adapter
  function getAdapter() {
    if (config.provider === "GAS") return GasAdapter;
    if (config.provider === "SUPABASE") return SupabaseAdapter;
    return LocalAdapter;
  }

  // Public facade API
  return {
    getConfig() {
      return { ...config };
    },

    setConfig(newConfig) {
      saveConfig(newConfig);
    },

    getActiveVehicleId() {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_VEHICLE) || "veh-001";
    },

    setActiveVehicleId(id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE, id);
    },

    async resetToDemoData() {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(SEED_VEHICLES));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(SEED_MAINTENANCE_LOGS));
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(SEED_SCHEDULES));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE, "veh-001");
      return true;
    },

    // Vehicle repository
    getVehicles() {
      return getAdapter().getVehicles();
    },

    async getVehicle(id) {
      const list = await getAdapter().getVehicles();
      return list.find((v) => v.id === id) || null;
    },

    saveVehicle(vehicle) {
      return getAdapter().saveVehicle(vehicle);
    },

    deleteVehicle(id) {
      return getAdapter().deleteVehicle(id);
    },

    updateOdometer(vehicleId, newKm) {
      return getAdapter().updateOdometer(vehicleId, newKm);
    },

    // Transactions repository
    getTransactions(vehicleId = null) {
      return getAdapter().getTransactions(vehicleId);
    },

    addTransaction(tx) {
      return getAdapter().addTransaction(tx);
    },

    updateTransaction(tx) {
      return getAdapter().updateTransaction(tx);
    },

    deleteTransaction(id) {
      return getAdapter().deleteTransaction(id);
    },

    // Maintenance repository
    getMaintenanceLogs(vehicleId = null) {
      return getAdapter().getMaintenanceLogs(vehicleId);
    },

    addMaintenanceLog(log) {
      return getAdapter().addMaintenanceLog(log);
    },

    deleteMaintenanceLog(id) {
      return getAdapter().deleteMaintenanceLog(id);
    },

    // Schedules repository
    getSchedules(vehicleId = null) {
      return getAdapter().getSchedules(vehicleId);
    },

    addSchedule(sch) {
      return getAdapter().addSchedule(sch);
    },

    updateSchedule(sch) {
      return getAdapter().updateSchedule(sch);
    },

    completeSchedule(id, paymentData = null) {
      return getAdapter().completeSchedule(id, paymentData);
    },

    // Test API Connection
    async testConnection() {
      if (config.provider === "LOCAL_DEMO") {
        return { success: true, message: "Penyimpanan Lokal Aktif (Demo Seed Siap Pakai)" };
      } else if (config.provider === "GAS") {
        if (!config.gasUrl) throw new Error("URL Google Apps Script belum diisi!");
        const testRes = await fetch(config.gasUrl + "?action=ping");
        const json = await testRes.json();
        return { success: true, message: "Terhubung ke Google Spreadsheet! " + (json.message || "") };
      } else if (config.provider === "SUPABASE") {
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
          throw new Error("Supabase URL atau Anon Key belum diisi!");
        }
        
        let baseUrl = config.supabaseUrl.trim().replace(/\/+$/, "");
        if (baseUrl.endsWith("/rest/v1")) {
          baseUrl = baseUrl.substring(0, baseUrl.length - 8);
        }

        // Test langsung endpoint tabel vehicles
        const testUrl = `${baseUrl}/rest/v1/vehicles?select=id&limit=1`;
        let response;
        try {
          response = await fetch(testUrl, {
            headers: SupabaseAdapter.getHeaders()
          });
        } catch (netErr) {
          throw new Error(`Koneksi gagal (${netErr.message}). Pastikan URL project benar dan internet aktif.`);
        }

        if (response.ok) {
          return { success: true, message: "Terhubung ke Supabase Database & Tabel Siap Digunakan!" };
        }

        // Analisis respons error dari Supabase PostgREST
        const rawText = await response.text();
        let errMsg = rawText;
        try {
          const jsonErr = JSON.parse(rawText);
          errMsg = jsonErr.message || jsonErr.error_description || jsonErr.error || rawText;
        } catch (e) {}

        if (response.status === 404 || errMsg.includes("vehicles") || errMsg.includes("schema cache") || errMsg.includes("relation")) {
          return {
            success: true,
            warning: true,
            message: "Terhubung ke Supabase! Namun tabel 'vehicles' belum dibuat. Silakan buka menu SQL Editor di Supabase dan jalankan script 'supabase_schema.sql'."
          };
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(`Supabase menolak akses (401/403): ${errMsg || "Anon Key tidak valid."}`);
        } else {
          throw new Error(`Supabase Error (${response.status}): ${errMsg}`);
        }
      }
    },

    // Export Data as CSV
    async exportCSV(vehicleId = null) {
      const txs = await this.getTransactions(vehicleId);
      const mnts = await this.getMaintenanceLogs(vehicleId);

      let csv = "ID,Tanggal,Jenis,Kategori,Nominal (Rp),Odometer (KM),BBM (Liter),Catatan,Bengkel/Penyedia\n";
      txs.forEach((t) => {
        csv += `"${t.id}","${t.date}","${t.type}","${t.category}","${t.amount}","${t.odometer || ""}","${t.fuel_liters || ""}","${(t.notes || "").replace(/"/g, '""')}","${(t.bengkel_name || "").replace(/"/g, '""')}"\n`;
      });

      csv += "\n--- RIWAYAT SERVIS & SPAREPART ---\n";
      csv += "ID,Tanggal,Jenis Servis,Nama Item,Merk/Part,Odometer (KM),Biaya (Rp),Garansi/Interval,Bengkel,Catatan\n";
      mnts.forEach((m) => {
        csv += `"${m.id}","${m.date}","${m.log_type}","${m.item_name}","${m.brand || ""}","${m.odometer || ""}","${m.cost || 0}","${m.warranty_lifespan || ""}","${(m.workshop || "").replace(/"/g, '""')}","${(m.notes || "").replace(/"/g, '""')}"\n`;
      });

      return csv;
    }
  };
})();

/**
 * KendaraAuth - Client-Side Authentication Manager
 * Integrates with Supabase Auth or Local/Demo Session
 */
const KendaraAuth = (function () {
  const AUTH_KEY = "kendaratrack_auth_user";

  function getUser() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }

  async function login(email, password) {
    if (!email || !password) {
      throw new Error("Email dan password wajib diisi!");
    }
    const cleanEmail = email.trim().toLowerCase();
    const config = KendaraAPI.getConfig();

    if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
      const baseUrl = config.supabaseUrl.trim().replace(/\/+$/, "");
      try {
        const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": config.supabaseAnonKey
          },
          body: JSON.stringify({ email: cleanEmail, password })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error_description || data.msg || data.message || "Gagal masuk ke Supabase");
        }
        const userObj = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || cleanEmail.split("@")[0],
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
          token: data.access_token,
          provider: "supabase"
        };
        setUser(userObj);
        return userObj;
      } catch (err) {
        throw err;
      }
    }

    // Local / Demo Login Simulation
    const namePart = cleanEmail.split("@")[0].replace(/[._]/g, " ");
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const userObj = {
      id: "usr-" + Date.now(),
      email: cleanEmail,
      name: formattedName || "Pengendara",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
      token: "local-jwt-" + Date.now(),
      provider: "local"
    };
    setUser(userObj);
    return userObj;
  }

  async function register(name, email, password) {
    if (!name || !email || !password) {
      throw new Error("Nama, email, dan password wajib diisi!");
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const config = KendaraAPI.getConfig();

    if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
      const baseUrl = config.supabaseUrl.trim().replace(/\/+$/, "");
      try {
        const response = await fetch(`${baseUrl}/auth/v1/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": config.supabaseAnonKey
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            data: { name: cleanName }
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error_description || data.msg || data.message || "Gagal mendaftar ke Supabase");
        }
        const userObj = {
          id: data.user?.id || "usr-" + Date.now(),
          email: cleanEmail,
          name: cleanName,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
          token: data.access_token || "pending_confirmation",
          provider: "supabase"
        };
        setUser(userObj);
        return userObj;
      } catch (err) {
        throw err;
      }
    }

    // Local registration
    const userObj = {
      id: "usr-" + Date.now(),
      email: cleanEmail,
      name: cleanName,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
      token: "local-jwt-" + Date.now(),
      provider: "local"
    };
    setUser(userObj);
    return userObj;
  }

  function loginAsGuest() {
    const guestUser = {
      id: "usr-guest-001",
      email: "budi.pengendara@gmail.com",
      name: "Budi Pengendara",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80",
      token: "guest-token-session",
      provider: "guest"
    };
    setUser(guestUser);
    return guestUser;
  }

  function logout() {
    setUser(null);
  }

  return {
    getUser,
    setUser,
    login,
    register,
    loginAsGuest,
    logout
  };
})();

window.KendaraAPI = KendaraAPI;
window.KendaraAuth = KendaraAuth;
