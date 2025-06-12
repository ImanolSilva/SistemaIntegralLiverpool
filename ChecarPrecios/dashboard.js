// =================================================================
// ARCHIVO: dashboard.js (Versión Final Corregida)
// LÓGICA PARA LA PÁGINA DE CHECAR PRECIOS
// =================================================================

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
    authDomain: "loginliverpool.firebaseapp.com",
    projectId: "loginliverpool",
    storageBucket: "loginliverpool.appspot.com",
    messagingSenderId: "704223815941",
    appId: "1:704223815941:web:c871525230fb61caf96f6c",
    measurementId: "G-QFEPQ4TSPY",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const storage = firebase.storage();
const db = firebase.firestore();
const auth = firebase.auth();

// ========== ESTADO GLOBAL DE LA APLICACIÓN ==========
const AppState = {
    user: null,
    role: "vendedor",
    store: null,
    boss: null,
    userName: null,
    allFiles: [],
    selectedFile: null,
    workbook: null,
    unsubscribeListener: null,
};

// ========== ELEMENTOS DEL DOM ==========
const UIElements = {
    logoutBtn: document.getElementById("logout-btn"),
    adminUploadSection: document.getElementById("adminUploadSection"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    chooseFileBtn: document.getElementById("chooseFileBtn"),
    fileListContainer: document.getElementById("fileListContainer"),
    confirmFileSelectionBtn: document.getElementById("confirmFileSelection"),
    selectedFileNameDisplay: document.getElementById("selectedFileName"),
    loadFileBtn: document.getElementById("loadFileBtn"),
    seccionRegistro: document.getElementById("seccionRegistro"),
    skuForm: document.getElementById("skuForm"),
    skuInput: document.getElementById("skuInput"),
    resultadoDiv: document.getElementById("resultado"),
    descargarBtn: document.getElementById("descargarBtn"),
    borrarBtn: document.getElementById("borrarBtn"),
};

// ========== INICIALIZACIÓN DE LA APLICACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(handleAuthChange);
    initEventListeners();
});

// (El resto de la lógica hasta handleSKUVerification no ha cambiado)
async function handleAuthChange(user) { if (!user) { showAuthAlert("Debes iniciar sesión para acceder.", () => { window.location.href = '../Login/login.html'; }); return; } AppState.user = user; try { await fetchUserProfile(user.uid); updateUIForRole(); await fetchAndRenderFiles(); } catch (error) { showAuthAlert(error.message, () => { auth.signOut(); window.location.href = "../Login/login.html"; }); } }
async function fetchUserProfile(uid) { const adminUIDs = ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2"]; if (adminUIDs.includes(uid)) { AppState.role = "admin"; AppState.store = "Admin"; AppState.userName = "Administrador"; AppState.boss = ""; return; } const userDoc = await db.collection("usuarios").doc(uid).get(); if (!userDoc.exists) throw new Error("No se encontró tu registro de usuario. Contacta al administrador."); const data = userDoc.data(); if (data.status !== "aprobado") throw new Error("Tu cuenta no está aprobada. Por favor, espera la autorización."); AppState.role = data.role || "vendedor"; AppState.store = data.store || "Sin Tienda"; AppState.userName = data.name || "Sin Nombre"; AppState.boss = data.boss || ""; }
function updateUIForRole() { const canUpload = ["admin", "jefe", "auxiliar"].includes(AppState.role); UIElements.adminUploadSection.style.display = canUpload ? "block" : "none"; UIElements.borrarBtn.style.display = canUpload ? "inline-flex" : "none"; }
async function fetchAndRenderFiles() { try { const snap = await db.collection("files").orderBy("uploadedAt", "desc").get(); AppState.allFiles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); let filteredFiles = [...AppState.allFiles]; if (AppState.role === "jefe" || AppState.role === "auxiliar") { filteredFiles = AppState.allFiles.filter(f => f.store === AppState.store); } else if (AppState.role === "vendedor") { filteredFiles = AppState.allFiles.filter(f => f.store === AppState.store && f.boss === AppState.boss); } renderFileList(filteredFiles); } catch (error) { console.error("Error al obtener archivos:", error); showErrorAlert("No se pudieron cargar los archivos de precios."); } }
function renderFileList(files) { const container = UIElements.fileListContainer; container.innerHTML = ""; if (files.length === 0) { container.innerHTML = '<p class="text-center text-muted">No hay archivos disponibles para tu rol y tienda.</p>'; return; } files.forEach(file => { const canDelete = ["admin", "jefe", "auxiliar"].includes(AppState.role); const uploadedDate = file.uploadedAt?.toDate().toLocaleDateString() || 'Fecha desconocida'; const itemHTML = `<div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3"><div class="flex-grow-1"><h6 class="mb-1"><i class="bi bi-file-earmark-excel-fill text-success"></i> ${file.name}</h6><small class="text-muted">Tienda: ${file.store} | Por: ${file.uploadedBy} | ${uploadedDate}</small></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary select-btn"><i class="bi bi-check-lg"></i></button>${canDelete ? `<button class="btn btn-sm btn-outline-danger delete-btn"><i class="bi bi-trash"></i></button>` : ''}</div></div>`; const itemEl = document.createElement('div'); itemEl.innerHTML = itemHTML; itemEl.querySelector('.select-btn').addEventListener('click', () => { document.querySelectorAll('#fileListContainer .list-group-item').forEach(el => el.classList.remove('active')); itemEl.querySelector('.list-group-item').classList.add('active'); AppState.selectedFile = file; UIElements.confirmFileSelectionBtn.disabled = false; }); if (canDelete) { itemEl.querySelector('.delete-btn').addEventListener('click', () => deleteFile(file.id, file.url)); } container.appendChild(itemEl); }); }
function renderSKUResult(item) { UIElements.resultadoDiv.innerHTML = `<div class="alert alert-success d-flex flex-column gap-2"><h4 class="alert-heading"><i class="bi bi-check-circle-fill"></i> ¡SKU Encontrado!</h4><p class="mb-0"><strong>SKU:</strong> ${item.SKU}</p><p class="mb-0"><strong>Descripción:</strong> ${item.DESCRIPCION || "N/A"}</p><p class="mb-0"><strong>Precio:</strong> $${item.PRECIO || "N/A"}</p></div>`; }
function renderSKUNotFound(sku) { UIElements.resultadoDiv.innerHTML = `<div class="alert alert-danger"><h4 class="alert-heading"><i class="bi bi-x-octagon-fill"></i> SKU no encontrado</h4><p class="mb-0">El SKU <strong>${sku}</strong> no fue encontrado en el archivo cargado.</p></div>`; }
function initEventListeners() { UIElements.logoutBtn.addEventListener("click", () => auth.signOut()); UIElements.dropzone.addEventListener('click', () => UIElements.fileInput.click()); UIElements.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); UIElements.dropzone.classList.add('dragover'); }); UIElements.dropzone.addEventListener('dragleave', () => UIElements.dropzone.classList.remove('dragover')); UIElements.dropzone.addEventListener('drop', (e) => { e.preventDefault(); UIElements.dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]); }); UIElements.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileUpload(e.target.files[0]); }); UIElements.confirmFileSelectionBtn.addEventListener('click', () => { if (AppState.selectedFile) { UIElements.selectedFileNameDisplay.textContent = `Archivo seleccionado: ${AppState.selectedFile.name}`; UIElements.loadFileBtn.disabled = false; bootstrap.Modal.getInstance(document.getElementById('fileSelectionModal')).hide(); } }); UIElements.loadFileBtn.addEventListener('click', loadSelectedFile); UIElements.skuForm.addEventListener('submit', handleSKUVerification); UIElements.skuInput.addEventListener("input", () => { if (UIElements.skuInput.value.length >= 10) UIElements.skuForm.requestSubmit(); }); UIElements.descargarBtn.addEventListener('click', downloadUpdatedRegistry); UIElements.borrarBtn.addEventListener('click', confirmDeleteSessionData); }
async function handleFileUpload(file) { if (!file) return; showLoadingAlert('Subiendo archivo...'); let bossId = AppState.role === 'jefe' ? AppState.user.uid : AppState.boss; if (AppState.role === 'auxiliar') { const chosenBoss = await chooseBossForAuxiliar(); if (chosenBoss === null) { Swal.close(); return; } bossId = chosenBoss; } try { const filePath = `precios/${Date.now()}_${file.name}`; const fileRef = storage.ref(filePath); await fileRef.put(file); const url = await fileRef.getDownloadURL(); await db.collection("files").add({ name: file.name, url, uploadedAt: firebase.firestore.FieldValue.serverTimestamp(), uploadedBy: `${AppState.userName} (${AppState.role})`, store: AppState.store, boss: bossId, }); showSuccessAlert('¡Éxito!', 'El archivo se ha subido correctamente.'); await fetchAndRenderFiles(); } catch (error) { showErrorAlert(`Hubo un problema al subir el archivo: ${error.message}`); } }
async function loadSelectedFile() { if (!AppState.selectedFile) { showInfoAlert('Primero debes seleccionar un archivo.'); return; } showLoadingAlert('Cargando y procesando archivo...'); try { const response = await fetch(AppState.selectedFile.url); const arrayBuffer = await response.arrayBuffer(); const wb = XLSX.read(arrayBuffer, { type: 'array' }); if (!wb.Sheets["DATOS"]) { throw new Error("El archivo Excel no contiene una hoja llamada 'DATOS'."); } AppState.workbook = wb; await setupRealtimeListener(AppState.selectedFile.id); UIElements.seccionRegistro.style.display = 'block'; UIElements.skuInput.focus(); showSuccessAlert('¡Archivo Cargado!', 'Ya puedes comenzar a verificar SKUs.'); } catch (error) { showErrorAlert(`No se pudo procesar el archivo Excel: ${error.message}`); } }

/**
 * ======== FUNCIÓN CORREGIDA 1 ========
 * Maneja la verificación de un SKU, guardando los datos correctos en Firestore.
 */
async function handleSKUVerification(e) {
    e.preventDefault();
    const skuValue = UIElements.skuInput.value.trim().toUpperCase();
    if (!skuValue) return;

    if (!AppState.workbook) { return showErrorAlert('No hay un archivo Excel cargado.'); }

    const sheet = AppState.workbook.Sheets["DATOS"];
    const data = XLSX.utils.sheet_to_json(sheet);
    const item = data.find(row => String(row.SKU).trim().toUpperCase() === skuValue);
    
    UIElements.skuInput.value = '';
    UIElements.skuInput.focus();

    if (!item) {
        renderSKUNotFound(skuValue);
        return;
    }
    renderSKUResult(item);

    const checkRef = db.collection("files").doc(AppState.selectedFile.id).collection("prices_checked").doc(skuValue);
    const docSnap = await checkRef.get();
    if (docSnap.exists) {
        showInfoAlert('Este SKU ya fue verificado anteriormente en esta sesión.');
        return;
    }

    const { value: isCorrect } = await Swal.fire({
        title: 'Verificar Precio',
        html: `¿El precio en la etiqueta de <strong>$${item.PRECIO}</strong> para <strong>${item.DESCRIPCION}</strong> es correcto?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg"></i> Es Correcto',
        cancelButtonText: '<i class="bi bi-x-lg"></i> Es Incorrecto',
        confirmButtonColor: '#43A047',
        cancelButtonColor: '#e53935',
    });

    if (typeof isCorrect === 'boolean') {
        await checkRef.set({
            ...item,
            SACAR_ETIQUETAS: isCorrect ? "NO" : "SI",
            // CORRECCIÓN 1: Guardar la fecha del servidor como timestamp
            FECHA_REGISTRO: firebase.firestore.FieldValue.serverTimestamp(),
            // CORRECCIÓN 2: Guardar el correo del usuario en lugar del nombre
            VERIFICADO_POR: AppState.user.email 
        });
        showSuccessAlert('Registro Guardado', `El SKU ${skuValue} se ha verificado.`);
    }
}

async function deleteFile(fileId, fileUrl) { const { isConfirmed } = await Swal.fire({ title: '¿Estás seguro?', text: "¡Esta acción eliminará el archivo y todos sus registros permanentemente!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' }); if (!isConfirmed) return; showLoadingAlert('Eliminando archivo...'); try { const pricesCheckedSnap = await db.collection("files").doc(fileId).collection("prices_checked").get(); const batch = db.batch(); pricesCheckedSnap.forEach(doc => batch.delete(doc.ref)); await batch.commit(); await db.collection("files").doc(fileId).delete(); if (fileUrl) await storage.refFromURL(fileUrl).delete(); showSuccessAlert('¡Eliminado!', 'El archivo y sus datos han sido eliminados.'); if (AppState.selectedFile && AppState.selectedFile.id === fileId) { AppState.selectedFile = null; AppState.workbook = null; UIElements.seccionRegistro.style.display = 'none'; UIElements.selectedFileNameDisplay.textContent = 'No se ha seleccionado ningún archivo.'; UIElements.loadFileBtn.disabled = true; } await fetchAndRenderFiles(); } catch (error) { showErrorAlert(`No se pudo eliminar el archivo: ${error.message}`); } }
function confirmDeleteSessionData() { Swal.fire({ title: '¿Limpiar registros de esta sesión?', text: "Esta acción no se puede deshacer.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, limpiar' }).then(async (result) => { if (result.isConfirmed) { showInfoAlert('Funcionalidad en desarrollo', 'La limpieza de sesión se implementará próximamente.'); } }); }

/**
 * ======== FUNCIÓN CORREGIDA 2 ========
 * Escucha cambios en tiempo real y formatea los datos para el Excel.
 */
async function setupRealtimeListener(fileId) {
    if (AppState.unsubscribeListener) AppState.unsubscribeListener();

    AppState.unsubscribeListener = db.collection("files").doc(fileId).collection("prices_checked")
        .orderBy("FECHA_REGISTRO", "desc")
        .onSnapshot(snapshot => {
            if (!AppState.workbook) return;

            // CORRECCIÓN 3: Mapear y formatear los datos antes de crear la hoja
            const checkedData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    SKU: data.SKU,
                    DESCRIPCION: data.DESCRIPCION,
                    PRECIO: data.PRECIO,
                    PIEZAS: data.PIEZAS,
                    SACAR_ETIQUETAS: data.SACAR_ETIQUETAS,
                    VERIFICADO_POR: data.VERIFICADO_POR,
                    // Convierte el timestamp de Firestore a una fecha legible
                    FECHA_REGISTRO: data.FECHA_REGISTRO ? data.FECHA_REGISTRO.toDate().toLocaleString('es-MX') : 'N/A'
                };
            });
            
            const sheetName = "PRECIOS CHECADOS";
            if (AppState.workbook.SheetNames.includes(sheetName)) {
                delete AppState.workbook.Sheets[sheetName];
                AppState.workbook.SheetNames = AppState.workbook.SheetNames.filter(name => name !== sheetName);
            }

            const newSheet = XLSX.utils.json_to_sheet(checkedData);
            AppState.workbook.Sheets[sheetName] = newSheet;
            if (!AppState.workbook.SheetNames.includes(sheetName)) {
                AppState.workbook.SheetNames.push(sheetName);
            }

            UIElements.descargarBtn.disabled = checkedData.length === 0;
            console.log('Hoja de precios checados actualizada en tiempo real.');
        }, error => {
            console.error("Error en listener de precios:", error);
            showErrorAlert("Se perdió la conexión en tiempo real con la base de datos.");
        });
}

async function chooseBossForAuxiliar() { showLoadingAlert('Buscando jefes disponibles...'); const snap = await db.collection("usuarios").where("store", "==", AppState.store).where("role", "==", "jefe").where("status", "==", "aprobado").get(); if (snap.empty) { Swal.close(); const { isConfirmed } = await Swal.fire({ icon: "warning", title: "No hay jefes en tu tienda", text: "¿Deseas subir el archivo sin asignarlo a un jefe?", showCancelButton: true, confirmButtonText: "Subir sin asignar", cancelButtonText: "Cancelar" }); return isConfirmed ? "SIN_JEFE" : null; } const inputOptions = {}; snap.forEach(doc => { inputOptions[doc.id] = doc.data().name || doc.data().email; }); const { value: bossId } = await Swal.fire({ title: 'Asignar a un Jefe', text: 'Como auxiliar, debes seleccionar para qué jefe estás subiendo este archivo.', input: 'select', inputOptions, inputPlaceholder: 'Selecciona un jefe', showCancelButton: true, confirmButtonText: 'Confirmar' }); return bossId || null; }
function showAuthAlert(text, callback) { Swal.fire({ icon: 'warning', title: 'Acceso Denegado', text, allowOutsideClick: false }).then(callback); }
function showLoadingAlert(title) { Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); }
function showSuccessAlert(title, text = '') { Swal.fire({ icon: 'success', title, text, timer: 1500, showConfirmButton: false }); }
function showErrorAlert(text) { Swal.fire({ icon: 'error', title: 'Oops...', text }); }
function showInfoAlert(text) { Swal.fire({ icon: 'info', title: 'Atención', text }); }

// Función de descarga sin cambios en su lógica principal, solo el nombre del archivo
async function downloadUpdatedRegistry() {
    if (!AppState.workbook) { return showInfoAlert('No hay datos para descargar. Carga un archivo primero.'); }
    const sheet = AppState.workbook.Sheets["PRECIOS CHECADOS"];
    if (!sheet || !sheet['!ref']) { return showInfoAlert('No hay precios verificados en esta sesión para descargar.'); }
    
    // Nombre de archivo seguro
    const originalName = AppState.selectedFile ? AppState.selectedFile.name.replace(/\.xlsx?$/i, '') : 'Registro_Precios';
    const updatedFileName = `ACTUALIZADO_${originalName}.xlsx`;

    try {
        XLSX.writeFile(AppState.workbook, updatedFileName);
    } catch (error) {
        console.error("Error al generar el archivo para descarga:", error);
        showErrorAlert("Ocurrió un error al intentar generar el archivo de descarga.");
    }
}