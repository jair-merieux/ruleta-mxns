// SECUENCIA DE COLORES SOLICITADA
const COLOR_SEQUENCE = ["#afcc46", "#00abe6", "#ffffff"];

function getSequentialColor(index) {
  return COLOR_SEQUENCE[index % COLOR_SEQUENCE.length];
}

const RULETAS = {
  herramientas: {
    title: "Herramientas Digitales",
    subtitle: "Área de Etiquetado - Días Hábiles de Prueba",
    items: [
      { label: "1 Día Hábil", weight: 4 },
      { label: "2 Días Hábiles", weight: 3 },
      { label: "3 Días Hábiles", weight: 3 },
      { label: "5 Días Hábiles", weight: 2 },
      { label: "7 Días Hábiles", weight: 2 },
      { label: "10 Días Hábiles", weight: 1 },
      
      { label: "1 Día Hábil", weight: 4 },
      { label: "2 Días Hábiles", weight: 3 },
      { label: "3 Días Hábiles", weight: 3 },
      { label: "5 Días Hábiles", weight: 2 },
      { label: "7 Días Hábiles", weight: 2 },
      { label: "10 Días Hábiles", weight: 1 }
    ].map((item, index) => ({
      ...item,
      color: getSequentialColor(index)
    }))
  },
  fssc: {
    title: "Auditoría FSSC 22000",
    subtitle: "Descuento Especial en Auditoría",
    items: [
      { label: "1% Desc.", weight: 4 },
      { label: "2% Desc.", weight: 3 },
      { label: "3% Desc.", weight: 3 },
      { label: "4% Desc.", weight: 2 },
      { label: "5% Desc.", weight: 2 },
      { label: "8% Desc.", weight: 1 },

      { label: "1% Desc.", weight: 4 },
      { label: "2% Desc.", weight: 3 },
      { label: "3% Desc.", weight: 3 },
      { label: "4% Desc.", weight: 2 },
      { label: "5% Desc.", weight: 2 },
      { label: "8% Desc.", weight: 1 }
    ].map((item, index) => ({
      ...item,
      color: getSequentialColor(index)
    }))
  }
};

// ESTADO GLOBAL
let currentParticipant = null;
let currentRouletteKey = "herramientas";
let selectedServiceKey = "herramientas";
let isSpinning = false;
let currentRotation = 0;
let totalWeightSum = 0;

// SENSOR
let chargeStartTime = 0;
let chargeInterval = null;
let currentPower = 0;
const MAX_CHARGE_TIME = 2500;

// BBDD LOCAL (IndexedDB)
let db;
const dbRequest = indexedDB.open("RuletaEventosDB", 1);

dbRequest.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("participantes")) {
    db.createObjectStore("participantes", { keyPath: "id", autoIncrement: true });
  }
};
dbRequest.onsuccess = (e) => { 
  db = e.target.result; 
  renderAdminTable();
};

// AUDIO
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTickSound(velocity) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(400 + Math.min(velocity * 500, 600), audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.04);
}

// DOM
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spin-btn");
const powerBar = document.getElementById("power-bar");

// NAVEGACIÓN
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(screenId).classList.remove("hidden");
  
  if (screenId === "screen-admin") {
    renderAdminTable();
  }
}

function selectService(key) {
  selectedServiceKey = key;
  document.getElementById("btn-service-herramientas").classList.toggle("active", key === "herramientas");
  document.getElementById("btn-service-fssc").classList.toggle("active", key === "fssc");
}

function startExperience(e) {
  e.preventDefault();

  currentParticipant = {
    firstname: document.getElementById("user-firstname").value.trim(),
    lastname: document.getElementById("user-lastname").value.trim(),
    email: document.getElementById("user-email").value.trim(),
    company: document.getElementById("user-company").value.trim(),
    service: selectedServiceKey
  };

  currentRouletteKey = currentParticipant.service;

  document.getElementById("participant-tag").innerText = `${currentParticipant.firstname} (${currentParticipant.company})`;
  document.getElementById("wheel-title").innerText = RULETAS[currentRouletteKey].title;
  document.getElementById("wheel-subtitle").innerText = RULETAS[currentRouletteKey].subtitle;

  showScreen("screen-game");
  drawWheel();
}

function goToHome() {
  if (isSpinning) return;
  closeModal();
  document.getElementById("start-form").reset();
  selectService("herramientas");
  showScreen("screen-welcome");
  currentParticipant = null;
}

function retryGame() {
  closeModal();
  currentRotation = 0;
  drawWheel();
}

// DIBUJO DE RULETA CON CORTE LIMPIO
function drawWheel() {
  const data = RULETAS[currentRouletteKey];
  totalWeightSum = data.items.reduce((acc, item) => acc + item.weight, 0);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(currentRotation);

  let currentStartAngle = 0;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const sliceAngle = (item.weight / totalWeightSum) * (2 * Math.PI);

    ctx.beginPath();
    ctx.fillStyle = item.color;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, currentStartAngle, currentStartAngle + sliceAngle);
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = (item.color.toLowerCase() === "#ffffff") ? "#0a4479" : "#ffffff";
    ctx.font = item.weight === 1 ? "bold 13px sans-serif" : "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.rotate(currentStartAngle + sliceAngle / 2);
    ctx.fillText(item.label, radius - 15, 0);
    ctx.restore();

    currentStartAngle += sliceAngle;
  }

  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#0a4479";
  ctx.stroke();

  ctx.restore();
}

// SENSOR Y FÍSICA
function startCharging(e) {
  if (e) e.preventDefault();
  if (isSpinning) return;

  chargeStartTime = performance.now();
  spinBtn.classList.add("charging");
  spinBtn.innerText = "CARGANDO...";

  chargeInterval = setInterval(() => {
    const elapsed = performance.now() - chargeStartTime;
    currentPower = Math.min(elapsed / MAX_CHARGE_TIME, 1);
    powerBar.style.width = `${currentPower * 100}%`;
  }, 16);
}

function releaseAndSpin(e) {
  if (e) e.preventDefault();
  if (isSpinning || !chargeStartTime) return;

  clearInterval(chargeInterval);
  spinBtn.classList.remove("charging");
  spinBtn.innerText = "MANTÉN PRESIONADO";

  const finalPower = Math.max(currentPower, 0.2);
  setTimeout(() => { powerBar.style.width = "0%"; }, 300);

  chargeStartTime = 0;
  currentPower = 0;

  spinWheelWithPower(finalPower);
}

function spinWheelWithPower(power) {
  isSpinning = true;
  spinBtn.disabled = true;

  let velocity = 0.25 + (power * 0.45);
  const friction = 0.982 + (power * 0.008);
  const stopThreshold = 0.0005;

  let lastSectorIndex = -1;

  function animate() {
    velocity *= friction;
    currentRotation += velocity;
    drawWheel();

    const normalizedAngle = (2 * Math.PI - (currentRotation % (2 * Math.PI)) + (3 * Math.PI / 2)) % (2 * Math.PI);
    const currentSectorIndex = getSectorIndexAtAngle(normalizedAngle);

    if (currentSectorIndex !== lastSectorIndex) {
      playTickSound(velocity);
      lastSectorIndex = currentSectorIndex;
    }

    if (velocity > stopThreshold) {
      requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      spinBtn.disabled = false;
      finishGame(currentSectorIndex);
    }
  }

  requestAnimationFrame(animate);
}

function getSectorIndexAtAngle(angle) {
  const data = RULETAS[currentRouletteKey];
  let accumulatedAngle = 0;

  for (let i = 0; i < data.items.length; i++) {
    const sliceAngle = (data.items[i].weight / totalWeightSum) * (2 * Math.PI);
    if (angle >= accumulatedAngle && angle < accumulatedAngle + sliceAngle) {
      return i;
    }
    accumulatedAngle += sliceAngle;
  }
  return 0;
}

// RESULTADOS
function finishGame(winningIndex) {
  const data = RULETAS[currentRouletteKey];
  const wonPrize = data.items[winningIndex].label;

  const record = {
    nombre: `${currentParticipant.firstname} ${currentParticipant.lastname}`,
    correo: currentParticipant.email,
    empresa: currentParticipant.company,
    servicio: data.title,
    premio: wonPrize,
    notas: "",
    fecha: new Date().toLocaleString()
  };

  const tx = db.transaction(["participantes"], "readwrite");
  tx.objectStore("participantes").add(record);

  document.getElementById("prize-greeting").innerText = `¡Felicidades, ${currentParticipant.firstname} ${currentParticipant.lastname}!`;
  document.getElementById("prize-badge").innerText = wonPrize;
  document.getElementById("modal-prize").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-prize").classList.add("hidden");
}

// LÓGICA DE ADMINISTRACIÓN (INCLUYE CORREO Y NOTAS)
function renderAdminTable() {
  const tbody = document.getElementById("history-body");
  if (!tbody || !db) return;
  tbody.innerHTML = "";

  const tx = db.transaction(["participantes"], "readonly");
  const request = tx.objectStore("participantes").getAll();

  request.onsuccess = () => {
    const data = request.result;
    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.nombre}</td>
        <td>${row.correo || "-"}</td>
        <td>${row.empresa}</td>
        <td>${row.servicio}</td>
        <td><strong>${row.premio}</strong></td>
        <td>${row.notas || "-"}</td>
        <td>${row.fecha}</td>
        <td>
          <button class="btn-action-edit" onclick="editRecord(${row.id})">Editar</button>
          <button class="btn-action-delete" onclick="deleteRecord(${row.id})">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };
}

function handleAdminFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("admin-record-id").value;
  const firstname = document.getElementById("admin-firstname").value.trim();
  const lastname = document.getElementById("admin-lastname").value.trim();
  const email = document.getElementById("admin-email").value.trim();
  const company = document.getElementById("admin-company").value.trim();
  const service = document.getElementById("admin-service").value;
  const prize = document.getElementById("admin-prize").value.trim();
  const notes = document.getElementById("admin-notes").value.trim();

  const record = {
    nombre: `${firstname} ${lastname}`,
    correo: email,
    empresa: company,
    servicio: service,
    premio: prize,
    notas: notes,
    fecha: new Date().toLocaleString()
  };

  const tx = db.transaction(["participantes"], "readwrite");
  const store = tx.objectStore("participantes");

  if (id) {
    record.id = parseInt(id);
    store.put(record);
  } else {
    store.add(record);
  }

  tx.oncomplete = () => {
    resetAdminForm();
    renderAdminTable();
  };
}

function editRecord(id) {
  const tx = db.transaction(["participantes"], "readonly");
  const request = tx.objectStore("participantes").get(id);

  request.onsuccess = () => {
    const data = request.result;
    if (!data) return;

    const nameParts = data.nombre.split(" ");
    document.getElementById("admin-record-id").value = data.id;
    document.getElementById("admin-firstname").value = nameParts[0] || "";
    document.getElementById("admin-lastname").value = nameParts.slice(1).join(" ") || "";
    document.getElementById("admin-email").value = data.correo || "";
    document.getElementById("admin-company").value = data.empresa;
    document.getElementById("admin-service").value = data.servicio;
    document.getElementById("admin-prize").value = data.premio;
    document.getElementById("admin-notes").value = data.notas || "";

    document.getElementById("admin-form-title").innerText = "Editar Participante";
    document.getElementById("admin-save-btn").innerText = "Actualizar Registro";
    document.getElementById("admin-cancel-btn").classList.remove("hidden");
  };
}

function resetAdminForm() {
  document.getElementById("admin-form").reset();
  document.getElementById("admin-record-id").value = "";
  document.getElementById("admin-form-title").innerText = "Agregar / Editar Participante";
  document.getElementById("admin-save-btn").innerText = "Guardar Registro";
  document.getElementById("admin-cancel-btn").classList.add("hidden");
}

function deleteRecord(id) {
  if (confirm("¿Seguro que deseas eliminar este registro?")) {
    const tx = db.transaction(["participantes"], "readwrite");
    tx.objectStore("participantes").delete(id);
    tx.oncomplete = () => renderAdminTable();
  }
}

function exportToCSV() {
  const tx = db.transaction(["participantes"], "readonly");
  const request = tx.objectStore("participantes").getAll();

  request.onsuccess = () => {
    const data = request.result;
    if (data.length === 0) {
      alert("No hay registros almacenados.");
      return;
    }

    let csv = "ID,Nombre,Correo,Empresa,Servicio,Premio,Notas,Fecha\n";
    data.forEach(row => {
      csv += `"${row.id}","${row.nombre}","${row.correo || ""}","${row.empresa}","${row.servicio}","${row.premio}","${row.notas || ""}","${row.fecha}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes_ruleta_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };
}

// LISTENERS
spinBtn.addEventListener("mousedown", startCharging);
spinBtn.addEventListener("mouseup", releaseAndSpin);
spinBtn.addEventListener("mouseleave", releaseAndSpin);
spinBtn.addEventListener("touchstart", startCharging, { passive: false });
spinBtn.addEventListener("touchend", releaseAndSpin, { passive: false });


// URL de tu Google Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzo_APUyAltqoP_y5KwqoB0R75nVVMUa1jld0CWZ7U6pg7cJ-M_flfTT-gzEkB8EY67/exec";
const DEVICE_NAME = "Tablet-01"; // Cambia este nombre en cada tablet (ej. Tablet-02)

// ENVIAR EVENTOS PENDIENTES A GOOGLE SHEETS
async function syncWithGoogleSheets() {
  if (!navigator.onLine || !db) return;

  const tx = db.transaction(["participantes"], "readonly");
  const request = tx.objectStore("participantes").getAll();

  request.onsuccess = async () => {
    const records = request.result;
    // Filtrar solo los registros o eventos que aún no se han enviado
    const pendingEvents = records.filter(r => !r.synced);

    if (pendingEvents.length === 0) return;

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(pendingEvents)
      });

      // Marcar los eventos enviados como sincronizados localmente
      const writeTx = db.transaction(["participantes"], "readwrite");
      const store = writeTx.objectStore("participantes");
      
      pendingEvents.forEach(r => {
        r.synced = true;
        store.put(r);
      });

      console.log(`${pendingEvents.length} evento(s) registrado(s) en Google Sheets de forma segura.`);
    } catch (err) {
      console.error("Error al sincronizar con Google Sheets:", err);
    }
  };
}

// 1. REGISTRO DE NUEVO PARTICIPANTE (RULETA)
function finishGame(winningIndex) {
  const data = RULETAS[currentRouletteKey];
  const wonPrize = data.items[winningIndex].label;

  const record = {
    accion: "NUEVO",
    dispositivo: DEVICE_NAME,
    nombre: `${currentParticipant.firstname} ${currentParticipant.lastname}`,
    correo: currentParticipant.email,
    empresa: currentParticipant.company,
    servicio: data.title,
    premio: wonPrize,
    notas: "",
    fecha: new Date().toLocaleString(),
    synced: false
  };

  const tx = db.transaction(["participantes"], "readwrite");
  tx.objectStore("participantes").add(record);

  tx.oncomplete = () => {
    if (navigator.onLine) syncWithGoogleSheets();
  };

  document.getElementById("prize-greeting").innerText = `¡Felicidades, ${currentParticipant.firstname} ${currentParticipant.lastname}!`;
  document.getElementById("prize-badge").innerText = wonPrize;
  document.getElementById("modal-prize").classList.remove("hidden");
}

// 2. EDICIÓN / AGREGAR NOTAS DESDE EL PANEL ADMIN
function handleAdminFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("admin-record-id").value;
  const firstname = document.getElementById("admin-firstname").value.trim();
  const lastname = document.getElementById("admin-lastname").value.trim();
  const email = document.getElementById("admin-email").value.trim();
  const company = document.getElementById("admin-company").value.trim();
  const service = document.getElementById("admin-service").value;
  const prize = document.getElementById("admin-prize").value.trim();
  const notes = document.getElementById("admin-notes").value.trim();

  const record = {
    accion: id ? "EDICION" : "NUEVO_MANUAL",
    dispositivo: DEVICE_NAME,
    nombre: `${firstname} ${lastname}`,
    correo: email,
    empresa: company,
    servicio: service,
    premio: prize,
    notas: notes,
    fecha: new Date().toLocaleString(),
    synced: false
  };

  const tx = db.transaction(["participantes"], "readwrite");
  const store = tx.objectStore("participantes");

  if (id) {
    record.id = parseInt(id);
    store.put(record);
  } else {
    store.add(record);
  }

  tx.oncomplete = () => {
    resetAdminForm();
    renderAdminTable();
    if (navigator.onLine) syncWithGoogleSheets();
  };
}

// 3. SOLICITUD DE ELIMINACIÓN (REGISTRA EL EVENTO SIN BORRAR EN LA NUBE)
function deleteRecord(id) {
  if (confirm("¿Marcar este registro como eliminado?")) {
    const tx = db.transaction(["participantes"], "readonly");
    const request = tx.objectStore("participantes").get(id);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) return;

      // Crear un evento de eliminación pendiente para Google Sheets
      const deleteEvent = {
        ...record,
        id: record.id,
        accion: "SOLICITUD_ELIMINACION",
        dispositivo: DEVICE_NAME,
        notas: `[SOLICITUD DE BORRADO] ${record.notas || ""}`,
        synced: false
      };

      // Eliminar localmente pero enviar la bitácora de borrado a Sheets
      const delTx = db.transaction(["participantes"], "readwrite");
      delTx.objectStore("participantes").delete(id);
      
      delTx.oncomplete = () => {
        renderAdminTable();
        // Enviar notificación de eliminación a Google Sheets
        if (navigator.onLine) {
          fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify([deleteEvent])
          });
        }
      };
    };
  }
}

// LISTENERS DE RED
window.addEventListener("online", syncWithGoogleSheets);
window.addEventListener("load", () => {
  setTimeout(syncWithGoogleSheets, 2000);
});