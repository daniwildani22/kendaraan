/**
 * =========================================================================
 * KENDARATRACK - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * =========================================================================
 * 
 * PANDUAN DEPLOYMENT KE GOOGLE APPS SCRIPT:
 * 1. Buat Google Spreadsheet baru di https://sheets.new (Beri nama: "KendaraTrack Database").
 * 2. Di menu atas spreadsheet, klik: Extensions (Ekstensi) > Apps Script.
 * 3. Hapus semua kode default di editor, lalu copy-paste SELURUH isi file ini.
 * 4. Klik ikon Save (Simpan).
 * 5. Untuk inisialisasi awal, pilih fungsi "setupSheets" di dropdown atas lalu klik "Run".
 *    (Izinkan akses/permission jika diminta oleh Google).
 * 6. Klik tombol "Deploy" di kanan atas > pilih "New deployment".
 * 7. Pilih tipe: "Web app" (ikon gear/roda gigi).
 * 8. Isi konfigurasi:
 *    - Description: KendaraTrack API v1
 *    - Execute as: "Me" (email Anda)
 *    - Who has access: "Anyone" (Siapa saja, penting agar Web App bisa fetch tanpa popup login Google)
 * 9. Klik "Deploy", lalu copy URL Web App yang dihasilkan (akhiran /exec).
 * 10. Buka aplikasi KendaraTrack di browser > Tab [Analitik & Profil] > Pengaturan Database
 *     > Pilih "Google Apps Script" > Tempelkan Web App URL > Klik "Simpan & Uji Koneksi".
 * =========================================================================
 */

const SHEET_NAMES = {
  VEHICLES: "vehicles",
  TRANSACTIONS: "transactions",
  MAINTENANCE: "maintenance_logs",
  SCHEDULES: "schedules"
};

// Header definitions for automatic sheet creation
const HEADERS = {
  vehicles: [
    "id", "name", "model", "brand", "plate_number", "type", "year",
    "color", "current_odometer", "fuel_tank_capacity", "oil_interval_km",
    "oil_interval_months", "last_oil_odometer", "last_oil_date", "last_oil_brand",
    "tax_annual_date", "tax_5year_date", "sim_type", "sim_expiry_date",
    "photo_vehicle", "photo_sim", "photo_stnk", "photo_bpkb"
  ],
  transactions: [
    "id", "vehicle_id", "type", "category", "amount", "date",
    "odometer", "fuel_liters", "fuel_price_per_liter", "fuel_type",
    "notes", "bengkel_name", "photo_receipt", "created_at"
  ],
  maintenance_logs: [
    "id", "vehicle_id", "log_type", "item_name", "brand",
    "part_code", "odometer", "date", "cost", "workshop",
    "workshop_address", "workshop_maps_url",
    "warranty_lifespan", "photo_part", "notes"
  ],
  schedules: [
    "id", "vehicle_id", "title", "category", "due_date",
    "target_odometer", "est_cost", "notes", "is_recurring",
    "recurring_interval_months", "recurring_interval_km", "is_completed", "completed_at"
  ]
};

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "ping";
    const vehicleId = e && e.parameter && e.parameter.vehicle_id;

    if (action === "ping") {
      return jsonResponse({
        status: "success",
        message: "Google Apps Script KendaraTrack API aktif & terhubung!",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "get_all") {
      setupSheets();
      return jsonResponse({
        status: "success",
        data: {
          vehicles: getSheetData(SHEET_NAMES.VEHICLES),
          transactions: getSheetData(SHEET_NAMES.TRANSACTIONS, "vehicle_id", vehicleId),
          maintenance_logs: getSheetData(SHEET_NAMES.MAINTENANCE, "vehicle_id", vehicleId),
          schedules: getSheetData(SHEET_NAMES.SCHEDULES, "vehicle_id", vehicleId)
        }
      });
    }

    if (action === "get_vehicles") {
      return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.VEHICLES) });
    }

    if (action === "get_transactions") {
      return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.TRANSACTIONS, "vehicle_id", vehicleId) });
    }

    if (action === "get_maintenance_logs") {
      return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.MAINTENANCE, "vehicle_id", vehicleId) });
    }

    if (action === "get_schedules") {
      return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.SCHEDULES, "vehicle_id", vehicleId) });
    }

    return jsonResponse({ status: "error", message: "Aksi tidak dikenali: " + action });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  try {
    setupSheets();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action;

    switch (action) {
      case "init_database":
        setupSheets(true);
        return jsonResponse({ status: "success", message: "Database sheets berhasil diinisialisasi" });

      case "get_vehicles":
        return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.VEHICLES) });

      case "save_vehicle":
        saveRow(SHEET_NAMES.VEHICLES, body.vehicle, "id");
        return jsonResponse({ status: "success", data: body.vehicle });

      case "delete_vehicle":
        deleteRow(SHEET_NAMES.VEHICLES, "id", body.id);
        return jsonResponse({ status: "success", message: "Kendaraan dihapus" });

      case "update_odometer":
        updateOdometerInSheet(body.vehicleId, body.newKm);
        return jsonResponse({ status: "success", message: "Odometer berhasil diperbarui" });

      case "get_transactions":
        return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.TRANSACTIONS, "vehicle_id", body.vehicleId) });

      case "add_transaction":
        saveRow(SHEET_NAMES.TRANSACTIONS, body.transaction, "id");
        if (body.transaction.odometer && body.transaction.vehicle_id) {
          updateOdometerInSheet(body.transaction.vehicle_id, body.transaction.odometer);
        }
        return jsonResponse({ status: "success", data: body.transaction });

      case "update_transaction":
        saveRow(SHEET_NAMES.TRANSACTIONS, body.transaction, "id");
        return jsonResponse({ status: "success", data: body.transaction });

      case "delete_transaction":
        deleteRow(SHEET_NAMES.TRANSACTIONS, "id", body.id);
        return jsonResponse({ status: "success", message: "Transaksi dihapus" });

      case "get_maintenance_logs":
        return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.MAINTENANCE, "vehicle_id", body.vehicleId) });

      case "add_maintenance_log":
        saveRow(SHEET_NAMES.MAINTENANCE, body.log, "id");
        if (body.log.log_type === "oli" && body.log.vehicle_id) {
          updateOilDataInSheet(body.log.vehicle_id, body.log.odometer, body.log.date, body.log.brand);
        }
        return jsonResponse({ status: "success", data: body.log });

      case "delete_maintenance_log":
        deleteRow(SHEET_NAMES.MAINTENANCE, "id", body.id);
        return jsonResponse({ status: "success", message: "Log servis dihapus" });

      case "get_schedules":
        return jsonResponse({ status: "success", data: getSheetData(SHEET_NAMES.SCHEDULES, "vehicle_id", body.vehicleId) });

      case "add_schedule":
        saveRow(SHEET_NAMES.SCHEDULES, body.schedule, "id");
        return jsonResponse({ status: "success", data: body.schedule });

      case "update_schedule":
        saveRow(SHEET_NAMES.SCHEDULES, body.schedule, "id");
        return jsonResponse({ status: "success", data: body.schedule });

      case "complete_schedule":
        const result = handleCompleteSchedule(body.id, body.paymentData);
        return jsonResponse({ status: "success", data: result });

      case "sync_seed_data":
        // Sync full seed data from frontend
        if (body.seed) {
          if (body.seed.vehicles) body.seed.vehicles.forEach(v => saveRow(SHEET_NAMES.VEHICLES, v, "id"));
          if (body.seed.transactions) body.seed.transactions.forEach(t => saveRow(SHEET_NAMES.TRANSACTIONS, t, "id"));
          if (body.seed.maintenance) body.seed.maintenance.forEach(m => saveRow(SHEET_NAMES.MAINTENANCE, m, "id"));
          if (body.seed.schedules) body.seed.schedules.forEach(s => saveRow(SHEET_NAMES.SCHEDULES, s, "id"));
        }
        return jsonResponse({ status: "success", message: "Seed data berhasil disinkronkan ke Google Sheet" });

      default:
        return jsonResponse({ status: "error", message: "Aksi POST tidak dikenali: " + action });
    }
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Setup and format all 4 sheets automatically
 */
function setupSheets(forceReset = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach((key) => {
    let sheet = ss.getSheetByName(key);
    if (!sheet) {
      sheet = ss.insertSheet(key);
    }
    if (forceReset || sheet.getLastRow() === 0) {
      sheet.clear();
      const headerRow = HEADERS[key];
      sheet.appendRow(headerRow);

      // Formatting header: Emerald theme
      const headerRange = sheet.getRange(1, 1, 1, headerRow.length);
      headerRange.setBackground("#0F5132");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
  });

  // Remove default "Sheet1" if empty
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }
}

/**
 * Read all rows from a sheet as JSON objects
 */
function getSheetData(sheetName, filterKey = null, filterValue = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const results = [];
  data.forEach((row) => {
    const item = {};
    let hasData = false;
    headers.forEach((header, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      if (val !== "" && val !== null && val !== undefined) {
        hasData = true;
      }
      item[header] = val;
    });

    if (hasData) {
      if (!filterKey || !filterValue || item[filterKey] === filterValue) {
        results.push(item);
      }
    }
  });

  return results;
}

/**
 * Insert or update a row by primary key (id)
 */
function saveRow(sheetName, itemObj, primaryKey = "id") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(sheetName);
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const pkIndex = headers.indexOf(primaryKey);

  if (pkIndex === -1) {
    throw new Error(`Kolom primary key '${primaryKey}' tidak ditemukan pada sheet '${sheetName}'`);
  }

  const lastRow = sheet.getLastRow();
  let existingRow = -1;

  if (lastRow > 1) {
    const pkValues = sheet.getRange(2, pkIndex + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < pkValues.length; i++) {
      if (String(pkValues[i][0]) === String(itemObj[primaryKey])) {
        existingRow = i + 2;
        break;
      }
    }
  }

  const rowData = headers.map((header) => {
    let val = itemObj[header];
    if (val === undefined || val === null) return "";
    return val;
  });

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/**
 * Delete a row by column value
 */
function deleteRow(sheetName, key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colIndex = headers.indexOf(key);
  if (colIndex === -1) return;

  const colValues = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  for (let i = colValues.length - 1; i >= 0; i--) {
    if (String(colValues[i][0]) === String(value)) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

/**
 * Update current odometer for a vehicle in vehicles sheet
 */
function updateOdometerInSheet(vehicleId, newKm) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.VEHICLES);
  if (!sheet) return;

  const vehicles = getSheetData(SHEET_NAMES.VEHICLES);
  const target = vehicles.find(v => String(v.id) === String(vehicleId));
  if (target) {
    if (Number(newKm) > Number(target.current_odometer || 0)) {
      target.current_odometer = Number(newKm);
      saveRow(SHEET_NAMES.VEHICLES, target, "id");
    }
  }
}

/**
 * Update oil service status in vehicles sheet
 */
function updateOilDataInSheet(vehicleId, odometer, date, brand) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vehicles = getSheetData(SHEET_NAMES.VEHICLES);
  const target = vehicles.find(v => String(v.id) === String(vehicleId));
  if (target) {
    target.last_oil_odometer = Number(odometer) || target.last_oil_odometer;
    target.last_oil_date = date;
    if (brand) target.last_oil_brand = brand;
    if (Number(odometer) > Number(target.current_odometer || 0)) {
      target.current_odometer = Number(odometer);
    }
    saveRow(SHEET_NAMES.VEHICLES, target, "id");
  }
}

/**
 * Handle Complete Schedule & Auto-Renew
 */
function handleCompleteSchedule(scheduleId, paymentData) {
  const schedules = getSheetData(SHEET_NAMES.SCHEDULES);
  const target = schedules.find(s => String(s.id) === String(scheduleId));
  if (!target) throw new Error("Jadwal tidak ditemukan: " + scheduleId);

  target.is_completed = true;
  target.completed_at = new Date().toISOString();
  saveRow(SHEET_NAMES.SCHEDULES, target, "id");

  // Record payment transaction
  let txRecord = null;
  if (paymentData) {
    txRecord = {
      id: "tx-" + Date.now(),
      vehicle_id: target.vehicle_id,
      type: "pengeluaran",
      category: paymentData.category || target.category || "servis",
      amount: Number(paymentData.amount) || Number(target.est_cost) || 0,
      date: paymentData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      odometer: paymentData.odometer || "",
      fuel_liters: "",
      fuel_price_per_liter: "",
      fuel_type: "",
      notes: "Pembayaran " + target.title + ". " + (paymentData.notes || ""),
      bengkel_name: paymentData.bengkel_name || "",
      created_at: new Date().toISOString()
    };
    saveRow(SHEET_NAMES.TRANSACTIONS, txRecord, "id");

    if (target.category === "oli") {
      const mntLog = {
        id: "mnt-" + Date.now(),
        vehicle_id: target.vehicle_id,
        log_type: "oli",
        item_name: target.title,
        brand: paymentData.oil_brand || "Oli Mesin",
        part_code: "",
        odometer: paymentData.odometer || "",
        date: paymentData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        cost: Number(paymentData.amount) || Number(target.est_cost) || 0,
        workshop: paymentData.bengkel_name || "Bengkel",
        warranty_lifespan: "Interval Rutin",
        notes: "Ganti oli terjadwal dari pengingat"
      };
      saveRow(SHEET_NAMES.MAINTENANCE, mntLog, "id");
      updateOilDataInSheet(target.vehicle_id, paymentData.odometer, mntLog.date, mntLog.brand);
    }
  }

  // Create next recurring schedule if enabled
  let nextSchedule = null;
  if (target.is_recurring == true || target.is_recurring == "true") {
    const curDate = new Date(target.due_date);
    const months = Number(target.recurring_interval_months) || 12;
    curDate.setMonth(curDate.getMonth() + months);

    let nextTargetKm = "";
    if (target.target_odometer && target.recurring_interval_km) {
      nextTargetKm = Number(target.target_odometer) + Number(target.recurring_interval_km);
    }

    nextSchedule = {
      id: "sch-" + Date.now(),
      vehicle_id: target.vehicle_id,
      title: target.title,
      category: target.category,
      due_date: Utilities.formatDate(curDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      target_odometer: nextTargetKm,
      est_cost: target.est_cost,
      notes: target.notes,
      is_recurring: true,
      recurring_interval_months: target.recurring_interval_months,
      recurring_interval_km: target.recurring_interval_km,
      is_completed: false,
      completed_at: ""
    };
    saveRow(SHEET_NAMES.SCHEDULES, nextSchedule, "id");
  }

  return { completed: target, nextSchedule: nextSchedule, txRecord: txRecord };
}

/**
 * Return formatted JSON response with CORS headers
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
