"use strict";

// =================================================================
// ARCHIVO: inventario.js (Versión Refactorizada y Mejorada)
// LÓGICA PARA LA PÁGINA DE CONTROL DE INVENTARIO
// =================================================================

// ========== CONFIGURACIÓN DE FIREBASE ==========
        const firebaseConfig = {
          apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
          authDomain: "loginliverpool.firebaseapp.com",
          projectId: "loginliverpool",
          storageBucket: "loginliverpool.appspot.com",
          messagingSenderId: "704223815941",
          appId: "1:704223815941:web:c871525230fb61caf96f6c",
          measurementId: "G-QFEPQ4TSPY"
        };
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        const db = firebase.firestore();
        const auth = firebase.auth();
        const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");

// ========== ESTADO Y VARIABLES GLOBALES ==========
const AppState = {
    currentUser: null,
    selectedFileName: "",
    inventoryData: [],
    currentMarbete: "",
    currentStep: 1,
    debounceTimeout: null,
    manualEditModal: null,
    viewSheetModal: null,
    adminUIDs: ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "V3gs0U4nKVeIZHvXEfIiNLXq2Sy1", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2"]
};

// ========== INICIALIZACIÓN DE LA APP ==========
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(handleAuthChange);
    initWizard();
});

/**
 * Maneja el cambio de estado de autenticación.
 * @param {firebase.User} user - El objeto de usuario de Firebase.
 */
function handleAuthChange(user) {
    if (!user) {
        Swal.fire({
            icon: "warning",
            title: "Acceso Denegado",
            text: "Debes iniciar sesión.",
            confirmButtonText: "Ir a Login",
            allowOutsideClick: false,
            allowEscapeKey: false
        }).then(() => {
            window.location.href = "../Login/login.html";
        });
    } else {
        AppState.currentUser = user;
        const adminSection = document.getElementById("adminUploadSection");
        if (adminSection) {
            adminSection.style.display = AppState.adminUIDs.includes(user.uid) ? "block" : "none";
        }
    }
}

/**
 * Inicializa todos los componentes y listeners del asistente.
 */
function initWizard() {
    AOS.init({ once: true, duration: 600 });
    
    // Inicializar Modales y Tooltips de Bootstrap
    AppState.manualEditModal = new bootstrap.Modal(document.getElementById('manualEditModal'));
    AppState.viewSheetModal = new bootstrap.Modal(document.getElementById('viewSheetModal'));
    new bootstrap.Tooltip(document.getElementById('fab-manual-edit'));

    // Cargar datos iniciales
    populateBossDropdowns();
    loadFileList();

    // Asignar Event Listeners
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    document.getElementById('nextBtn').addEventListener('click', handleNextStep);
    document.getElementById('backBtn').addEventListener('click', handlePreviousStep);
    document.getElementById("scanInput").addEventListener("input", handleScanInput);
    document.getElementById("fileList").addEventListener("change", loadSelectedFile);
    document.getElementById("bossFilterSelect").addEventListener("change", loadFileList);
    document.getElementById("confirmMarbeteBtn").addEventListener("click", confirmMarbete);
    
    const dropzone = document.getElementById("dropzone");
    dropzone.addEventListener("dragover", e => e.preventDefault());
    dropzone.addEventListener("drop", handleFileDrop);
    dropzone.onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = e => handleFileDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } });

    document.getElementById("fab-manual-edit").addEventListener("click", () => AppState.manualEditModal.show());
    document.getElementById("saveDataBtn").addEventListener("click", saveData);
    document.getElementById("downloadBtn").addEventListener("click", downloadFile);
    document.getElementById("viewSheetBtn").addEventListener("click", viewSheet);
    document.getElementById("searchMarbeteBtn").addEventListener("click", searchMarbete);
    document.getElementById("saveManualBtn").addEventListener("click", saveManualEdits);

    navigateToStep(1);
}

// ========== LÓGICA DEL ASISTENTE (WIZARD) ==========

function handleNextStep() {
    if (AppState.currentStep < 3) {
        if (AppState.currentStep === 2 && !AppState.currentMarbete) {
            return Swal.fire("Sin Marbete", "Debes confirmar un marbete para continuar.", "warning");
        }
        const summaryDiv = document.getElementById('scan-summary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `<i class="bi bi-info-circle-fill fs-4"></i><div>Archivo: <strong>${AppState.selectedFileName}</strong> <br> Marbete: <strong>${AppState.currentMarbete}</strong></div>`;
        }
        navigateToStep(AppState.currentStep + 1);
    }
}

function handlePreviousStep() {
    if (AppState.currentStep > 1) {
        navigateToStep(AppState.currentStep - 1);
    }
}

function navigateToStep(stepNumber) {
    AppState.currentStep = stepNumber;
    const steps = document.querySelectorAll('.wizard-step');
    const progressBar = document.getElementById('progressBar');
    
    steps.forEach(step => step.classList.remove('active'));
    document.getElementById(`step-${AppState.currentStep}`).classList.add('active');
    AOS.refresh();

    const progress = Math.max(0, ((AppState.currentStep - 1) / (steps.length - 1)) * 100);
    progressBar.style.width = `${progress}%`;

    document.getElementById('backBtn').style.visibility = AppState.currentStep > 1 ? 'visible' : 'hidden';
    document.getElementById('nextBtn').style.display = AppState.currentStep < steps.length ? 'block' : 'none';

    if (AppState.currentStep === 3) {
        document.getElementById('scanInput').focus();
    }
    validateStep();
}

function validateStep() {
    const nextBtn = document.getElementById('nextBtn');
    let isValid = false;
    switch (AppState.currentStep) {
        case 1: isValid = AppState.selectedFileName && AppState.inventoryData.length > 0; break;
        case 2: isValid = !!AppState.currentMarbete; break;
        case 3: isValid = true; break;
    }
    nextBtn.disabled = !isValid;
}

// ========== MANEJO DE DATOS Y FIREBASE ==========

async function populateBossDropdowns() {
    const bossUploadSelect = document.getElementById("bossUploadSelect");
    const bossFilterSelect = document.getElementById("bossFilterSelect");
    
    // Debería cargarse desde Firestore para ser dinámico
    const bosses = ["Adriana Prieto", "Alejandro Morales", "Alexis Ricardo", "Alfredo Encinas", "Ana Vazquez", "Beatriz Herrera", "Blanca Lopez", "Fernando Dominguez", "Heidi Jacquez", "Irene Rojas", "Liliana Castillo", "Martin Cabrera", "Sergio Lopez", "Xareni Espindola Perez", "Yanet Matas Manzano"];

    bossUploadSelect.innerHTML = '<option value="">Seleccione jefe</option>';
    bosses.sort().forEach(boss => bossUploadSelect.add(new Option(boss, boss)));
    
    bossFilterSelect.innerHTML = '<option value="Todos">Todos</option>';
    bosses.sort().forEach(boss => bossFilterSelect.add(new Option(boss, boss)));
}

async function loadFileList() {
    const fileListElem = document.getElementById("fileList");
    fileListElem.innerHTML = '<option value="">Cargando archivos...</option>';
    try {
        const listResult = await storage.ref("uploads").listAll();
        const bossFilter = document.getElementById("bossFilterSelect").value;
        
        const filesPromises = listResult.items.map(async fileRef => ({
            fileRef,
            meta: await fileRef.getMetadata().catch(() => null)
        }));
        const files = await Promise.all(filesPromises);

        fileListElem.innerHTML = '<option value="">Seleccione archivo...</option>';
        files
            .filter(item => item.meta && item.fileRef.name.toLowerCase().includes("inventario"))
            .forEach(item => {
                const jefe = item.meta.customMetadata?.jefe || "Sin Jefe";
                if (bossFilter === "Todos" || bossFilter === jefe) {
                    const option = new Option(item.fileRef.name.replace('Inventario_', ''), item.fileRef.name);
                    fileListElem.add(option);
                }
            });
    } catch (error) {
        console.error("Error cargando lista de archivos:", error);
        fileListElem.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function handleFileDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.toLowerCase().includes("inventario")) {
        return Swal.fire("Archivo Inválido", "El nombre del archivo debe contener la palabra 'Inventario_'.", "warning");
    }
    const selectedBoss = document.getElementById("bossUploadSelect").value;
    if (!selectedBoss) {
        return Swal.fire("Falta Jefe", "Debes seleccionar un jefe de área para el archivo.", "warning");
    }

    try {
        const fileRef = storage.ref(`uploads/${file.name}`);
        await fileRef.put(file, { customMetadata: { jefe: selectedBoss } });
        Swal.fire({ icon: "success", title: "¡Subido!", text: `'${file.name}' se ha subido correctamente.` });
        await loadFileList();
        document.getElementById('fileList').value = file.name;
        await loadSelectedFile();
    } catch (error) {
        console.error("Error en la subida:", error);
        Swal.fire("Error", "Ocurrió un problema al subir el archivo.", "error");
    }
}

async function loadSelectedFile() {
    AppState.selectedFileName = document.getElementById("fileList").value;
    const fab = document.getElementById('fab-manual-edit');

    if (!AppState.selectedFileName) {
        AppState.inventoryData = [];
        fab.classList.remove('visible');
        validateStep();
        return;
    }

    try {
        const fileRef = storage.ref(`uploads/${AppState.selectedFileName}`);
        const fileUrl = await fileRef.getDownloadURL();
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const invSheet = workbook.Sheets["Inventarios"] || XLSX.utils.json_to_sheet([]);
        
        AppState.inventoryData = XLSX.utils.sheet_to_json(invSheet);
        AppState.inventoryData.forEach(row => {
            row.OH = row.CANTIDAD_INVENTARIO !== undefined ? row.CANTIDAD_INVENTARIO : (row.OH || 0);
            delete row.CANTIDAD_INVENTARIO;
            row.SKU = row.SKU || "";
            row.DESCRIPCION = row.DESCRIPCION || "";
            row.PISO = row.PISO || 0;
            row.BODEGA = row.BODEGA || 0;
            row.AJUSTE = row.AJUSTE || 0;
            row.MARBETE = row.MARBETE || "";
        });

        Swal.fire({ icon: "success", title: "Archivo Cargado", text: `'${AppState.selectedFileName}' listo para trabajar.`, timer: 2000, showConfirmButton: false });
        fab.classList.add('visible');

        const docRef = db.collection('inventarios').doc(AppState.selectedFileName);
        await docRef.set({ data: AppState.inventoryData });
        docRef.onSnapshot(snapshot => {
            if (snapshot.exists) AppState.inventoryData = snapshot.data().data;
        });

    } catch (error) {
        console.error("Error cargando archivo seleccionado:", error);
        Swal.fire("Error", "No se pudo cargar o procesar el archivo seleccionado.", "error");
        AppState.selectedFileName = "";
        AppState.inventoryData = [];
        fab.classList.remove('visible');
    }
    validateStep();
}

function confirmMarbete() {
    const marbeteInput = document.getElementById("marbeteInput");
    const val = marbeteInput.value.trim();
    if (!val) {
        Swal.fire("Campo Vacío", "Por favor, ingresa un nombre o código para el marbete.", "warning");
        AppState.currentMarbete = "";
    } else {
        AppState.currentMarbete = val;
        Swal.fire({ icon: "success", title: "Marbete Confirmado", text: `Trabajando con el marbete: ${AppState.currentMarbete}`, timer: 2000, showConfirmButton: false });
    }
    validateStep();
}

function handleScanInput() {
    clearTimeout(AppState.debounceTimeout);
    const scanInput = document.getElementById("scanInput");
    if (scanInput.value.trim().length > 5) {
        AppState.debounceTimeout = setTimeout(handleScan, 300);
    }
}

function handleScan() {
    const scanInput = document.getElementById("scanInput");
    const code = scanInput.value.trim();

    if (!AppState.currentMarbete) {
        Swal.fire("Sin Marbete", "Debes confirmar un marbete antes de escanear.", "warning");
        scanInput.value = "";
        scanInput.focus();
        return;
    }

    let row = AppState.inventoryData.find(r => r.SKU?.toString().trim() === code);
    if (row) {
        if (!row.MARBETE || row.MARBETE === AppState.currentMarbete) {
            row.MARBETE = AppState.currentMarbete;
            const isPiso = document.getElementById("locationCheckbox").checked;
            isPiso ? row.PISO = (row.PISO || 0) + 1 : row.BODEGA = (row.BODEGA || 0) + 1;
        } else {
            let newRow = { ...row };
            newRow.MARBETE = AppState.currentMarbete;
            newRow.PISO = document.getElementById("locationCheckbox").checked ? 1 : 0;
            newRow.BODEGA = document.getElementById("locationCheckbox").checked ? 0 : 1;
            AppState.inventoryData.push(newRow);
            row = newRow;
        }
        row.AJUSTE = (row.PISO || 0) + (row.BODEGA || 0);
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 }).fire({ icon: 'success', title: `SKU ${code} sumado!` });
    } else {
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }).fire({ icon: 'error', title: `SKU ${code} no encontrado en el archivo.` });
    }
    scanInput.value = "";
    scanInput.focus();
}

async function saveData() {
    await updateInventariosSheet();
    Swal.fire("Guardado", "Los cambios han sido guardados en la nube.", "success");
}

async function updateInventariosSheet() {
    if (!AppState.selectedFileName) return;
    
    const finalArr = AppState.inventoryData.map(row => ({
        SKU: row.SKU, DESCRIPCION: row.DESCRIPCION, OH: row.OH,
        PISO: row.PISO, BODEGA: row.BODEGA, AJUSTE: row.AJUSTE, MARBETE: row.MARBETE
    }));
    
    const newWb = XLSX.utils.book_new();
    const newSheet = XLSX.utils.json_to_sheet(finalArr, { header: ["SKU", "DESCRIPCION", "OH", "PISO", "BODEGA", "AJUSTE", "MARBETE"] });
    XLSX.utils.book_append_sheet(newWb, newSheet, "Inventarios");
    
    const wbOut = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const fileRef = storage.ref(`uploads/${AppState.selectedFileName}`);
    const meta = await fileRef.getMetadata().catch(() => ({}));
    
    await fileRef.put(new Blob([wbOut]), { customMetadata: meta.customMetadata });
    await db.collection("inventarios").doc(AppState.selectedFileName).set({ data: finalArr });
}

function downloadFile() {
    if (!AppState.selectedFileName) {
        return Swal.fire("Error", "No hay un archivo seleccionado para descargar.", "error");
    }
    storage.ref(`uploads/${AppState.selectedFileName}`).getDownloadURL().then(url => {
        const a = document.createElement("a");
        a.href = url;
        a.download = AppState.selectedFileName;
        a.click();
    }).catch(error => {
        console.error("Error al obtener URL de descarga:", error);
        Swal.fire("Error", "No se pudo obtener el enlace de descarga del archivo.", "error");
    });
}

// ========== FUNCIONALIDAD DE MODALES ==========

function viewSheet() {
    if (!AppState.inventoryData.length) return;
    const tableBody = document.getElementById("viewSheetTableBody");
    const searchInput = document.getElementById("tableSearchInput");
    
    const renderTable = (data) => {
        tableBody.innerHTML = data.map(row => `<tr><td>${row.SKU||""}</td><td>${row.DESCRIPCION||""}</td><td>${row.OH||0}</td><td>${row.PISO||0}</td><td>${row.BODEGA||0}</td><td>${row.AJUSTE||0}</td><td>${row.MARBETE||""}</td></tr>`).join('');
    };

    renderTable(AppState.inventoryData);
    searchInput.value = "";
    searchInput.onkeyup = () => {
        const query = searchInput.value.trim().toLowerCase();
        const filteredData = query ? AppState.inventoryData.filter(row => row.SKU?.toString().toLowerCase().includes(query)) : AppState.inventoryData;
        renderTable(filteredData);
    };
    AppState.viewSheetModal.show();
}

function searchMarbete() {
    const searchValue = document.getElementById("manualMarbeteSearch").value.trim();
    if (!searchValue) return;
    const filteredRecords = AppState.inventoryData
        .map((row, index) => ({ ...row, _index: index }))
        .filter(row => row.MARBETE === searchValue);
    renderManualEditTable(filteredRecords);
}

function renderManualEditTable(records) {
    const resultsDiv = document.getElementById("manualEditResults");
    const saveBtn = document.getElementById("saveManualBtn");
    if (records.length === 0) {
        resultsDiv.innerHTML = "<p class='text-center text-muted'>No se encontraron registros con ese marbete.</p>";
        saveBtn.style.display = 'none';
        return;
    }
    let table = `<table class="table table-sm table-bordered table-hover"><thead><tr><th>SKU</th><th>PISO</th><th>BODEGA</th></tr></thead><tbody>`;
    records.forEach(rec => {
        table += `<tr><td>${rec.SKU}</td><td><input type="number" class="form-control form-control-sm" data-index="${rec._index}" data-field="PISO" value="${rec.PISO||0}"></td><td><input type="number" class="form-control form-control-sm" data-index="${rec._index}" data-field="BODEGA" value="${rec.BODEGA||0}"></td></tr>`;
    });
    table += '</tbody></table>';
    resultsDiv.innerHTML = table;
    saveBtn.style.display = 'block';
}

async function saveManualEdits() {
    document.querySelectorAll("#manualEditResults input").forEach(input => {
        const idx = input.dataset.index;
        const field = input.dataset.field;
        const row = AppState.inventoryData[idx];
        row[field] = parseInt(input.value, 10) || 0;
        row.AJUSTE = (row.PISO || 0) + (row.BODEGA || 0);
    });
    await updateInventariosSheet();
    Swal.fire("Guardado", "Los cambios manuales han sido guardados.", "success");
    searchMarbete(); // Refresh the table
}