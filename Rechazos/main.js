/*****************************************************
 * ========== CONFIGURACIÓN DE FIREBASE ==========
 *****************************************************/
const firebaseConfig = { apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE", authDomain: "loginliverpool.firebaseapp.com", projectId: "loginliverpool", storageBucket: "loginliverpool.appspot.com", messagingSenderId: "704223815941", appId: "1:704223815941:web:c871525230fb61caf96f6c", measurementId: "G-QFEPQ4TSPY" };
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");
const db = firebase.firestore();
const auth = firebase.auth();

/*****************************************************
 * ========== VARIABLES GLOBALES ==========
 *****************************************************/
const AppState = {
    relacionesData: null,
    usuariosData: [],
    allRechazosEnExcel: [],
    rechazosGlobal: [],
    selectedFileData: null,
    isAdmin: false,
    fileVersion: "1",
    pendingChanges: {},
    isSyncing: false
};
let adminBossFilter = "";
const ADMIN_UIDS = ["doxhVo1D3aYQqqkqgRgfJ4qcKcU2", "OaieQ6cGi7TnW0nbxvlk2oyLaER2", "jYhYVprQWkNO7ZP2tF8B222Il6f1", "KnbBtaMqEgQ2sXwZTuKPgcxfD5G3", "9Votnc6ZeYWgrQfSr2eQzC0ZdH82", "GL9JK2L8ZlhxNMOElhVuGvQlcmM2", "6IdpyY2fbSPwiA13mtqTp0HOjMm2"];
const autoSaveTimers = {};

/*****************************************************
 * ========== MANEJO DE CACHÉ Y SINCRONIZACIÓN ==========
 *****************************************************/
function queueChange(remision, field, value) {
    if (!remision) return;
    console.log(`En cola para autoguardado: Remisión ${remision}, Campo: ${field}`);
    if (!AppState.pendingChanges[remision]) {
        AppState.pendingChanges[remision] = {};
    }
    AppState.pendingChanges[remision][field] = value;
    localStorage.setItem('pendingChanges', JSON.stringify(AppState.pendingChanges));
    updateSyncStatus('pending');
}

function loadPendingChanges() {
    const savedChanges = localStorage.getItem('pendingChanges');
    if (savedChanges) {
        AppState.pendingChanges = JSON.parse(savedChanges);
        console.log("Cambios pendientes cargados desde localStorage.", AppState.pendingChanges);
        if (Object.keys(AppState.pendingChanges).length > 0) {
            updateSyncStatus('pending');
        }
    }
}

function updateSyncStatus(status) {
    const statusIndicator = document.getElementById('syncStatus');
    if (!statusIndicator) return;
    switch (status) {
        case 'syncing':
            statusIndicator.innerHTML = `<i class="bi bi-arrow-repeat"></i> Guardando...`;
            statusIndicator.className = 'text-warning';
            break;
        case 'synced':
            statusIndicator.innerHTML = `<i class="bi bi-check-circle-fill"></i> Autoguardado.`;
            statusIndicator.className = 'text-success';
            break;
        case 'pending':
            statusIndicator.innerHTML = `<i class="bi bi-pencil-fill"></i> Cambios sin guardar...`;
            statusIndicator.className = 'text-info';
            break;
        case 'error':
            statusIndicator.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> Error al guardar.`;
            statusIndicator.className = 'text-danger';
            break;
        default:
            statusIndicator.innerHTML = '';
            break;
    }
}

async function syncPendingChanges(isAutoSave = false) {
    if (Object.keys(AppState.pendingChanges).length === 0 || AppState.isSyncing) {
        return;
    }
    AppState.isSyncing = true;
    if(isAutoSave) {
        updateSyncStatus('syncing');
    } else {
        Swal.fire({ title: 'Guardando Cambios...', html: 'Por favor, espera.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    }

    try {
        const fileRef = AppState.selectedFileData?.ref;
        if (!fileRef) throw new Error("No hay un archivo de referencia seleccionado.");
        const metadata = await fileRef.getMetadata();
        const serverVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
        if (serverVersion !== AppState.fileVersion) {
            throw new Error("Conflicto de versiones. Por favor, recarga la página para obtener los cambios más recientes.");
        }
        const url = await fileRef.getDownloadURL();
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets["Rechazos"];
        if (!sheet) throw new Error("La hoja 'Rechazos' no fue encontrada en el archivo.");
        let excelData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const updatesMap = new Map(Object.entries(AppState.pendingChanges));
        let hasChanges = false;
        excelData = excelData.map(row => {
            const remision = row.Remisión?.toString();
            if (remision && updatesMap.has(remision)) {
                const updates = updatesMap.get(remision);
                Object.keys(updates).forEach(field => {
                    if (row[field] !== updates[field]) {
                        row[field] = updates[field];
                        hasChanges = true;
                    }
                });
            }
            return row;
        });

        if (!hasChanges) {
            console.log("No se encontraron cambios netos para sincronizar.");
            AppState.pendingChanges = {};
            localStorage.removeItem('pendingChanges');
            if (isAutoSave) updateSyncStatus('synced');
            else Swal.close();
            AppState.isSyncing = false;
            return;
        }

        const newSheet = XLSX.utils.json_to_sheet(excelData);
        workbook.Sheets["Rechazos"] = newSheet;
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const newBlob = new Blob([wbout], { type: "application/octet-stream" });
        const newVersion = (parseInt(serverVersion) + 1).toString();
        await fileRef.put(newBlob, { customMetadata: { version: newVersion } });
        AppState.fileVersion = newVersion;
        AppState.pendingChanges = {};
        localStorage.removeItem('pendingChanges');
        
        if (isAutoSave) {
            updateSyncStatus('synced');
        } else {
            showAlert("success", "¡Guardado!", "Todos tus cambios han sido guardados correctamente.");
        }

    } catch (error) {
        console.error("Error durante la sincronización:", error);
        showAlert("error", "Error al Sincronizar", error.message);
        if (isAutoSave) updateSyncStatus('error');
    } finally {
        AppState.isSyncing = false;
        if (!isAutoSave && Swal.isVisible()) {
            Swal.close();
        }
    }
}

/*****************************************************
 * ========== FUNCIONES AUXILIARES Y DE LÓGICA ==========
 *****************************************************/
const NOT_FOUND_GIFS = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHRjZjM3aWR1eGFyNTBhY3ptcDdhZTJwMTAzamptMjNyZGhudzExNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/IpKxfPy33hMRy/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHRjZjM3aWR1eGFyNTBhY3ptcDdhZTJwMTAzamptMjNyZGhudzExNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ViZylgfPSfJFm/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3Z3hkajZkemQ5ZTJoa2g1YXp6bWYycWlpbzFoMjdhanh5MDA0cjkyNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/dSeTdOmmA1u8e0LBsx/giphy.gif'
];

function getRandomNotFoundGif() {
    const randomIndex = Math.floor(Math.random() * NOT_FOUND_GIFS.length);
    return NOT_FOUND_GIFS[randomIndex];
}

function showAlert(icon, title, text = '', config = {}) { const defaultConfig = { toast: true, position: "top-end", showConfirmButton: false, timer: 3000, timerProgressBar: true, didOpen: (toast) => { toast.addEventListener('mouseenter', Swal.stopTimer); toast.addEventListener('mouseleave', Swal.resumeTimer); } }; return Swal.fire({ icon, title, text, ...defaultConfig, ...config }); }
function setUIForRole(isAdmin) { document.getElementById("dropzone").classList.toggle("hidden", !isAdmin); }
function fixEncoding(str) { if (!str) return ""; try { return decodeURIComponent(escape(str)); } catch { return str; } }
function isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }
function parseExcelDate(value) { if (!value) return ""; if (typeof value === "number") { const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000)); return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); } const parsed = Date.parse(value); if (!isNaN(parsed)) { const dateObj = new Date(parsed); return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); } return value; }
function showSection(sectionId) { const section = document.getElementById(sectionId); if (section) { section.classList.remove('hidden'); setTimeout(() => section.classList.add('visible'), 50); } }

function loadDynamicImage(sku, seccion, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `<div class="d-flex align-items-center justify-content-center" style="height: 150px;"><div class="spinner-border text-secondary" role="status"></div></div>`;
    
    const imageUrl = `https://ss${seccion}.liverpool.com.mx/lg/${sku}.jpg`;
    
    const fallbackImageHTML = `<img src="${getRandomNotFoundGif()}" alt="Imagen de producto no encontrada" class="img-fluid rounded" style="max-height: 150px; width: 100%; object-fit: cover;">`;
    
    const img = new Image();
    img.src = imageUrl;
    img.className = "img-fluid rounded";
    img.style.maxHeight = "200px";
    
    img.onload = () => {
        container.innerHTML = '';
        container.appendChild(img);
    };
    
    img.onerror = () => {
        container.innerHTML = fallbackImageHTML;
    };
}

async function loadStaticExcelFiles() { try { const [userResponse, relResponse] = await Promise.all([fetch("../ArchivosExcel/Usuarios.xlsx"), fetch("../ArchivosExcel/relaciones.xlsx")]); if (!userResponse.ok) console.error("No se encontró Usuarios.xlsx"); const userBlob = await userResponse.blob(); const userData = await userBlob.arrayBuffer(); const userWorkbook = XLSX.read(userData, { type: "array" }); const userSheet = userWorkbook.Sheets["Usuarios"]; if (userSheet) AppState.usuariosData = XLSX.utils.sheet_to_json(userSheet, { defval: "" }); if (!relResponse.ok) console.error("No se encontró relaciones.xlsx"); const relBlob = await relResponse.blob(); const relData = await relBlob.arrayBuffer(); const relWorkbook = XLSX.read(relData, { type: "array" }); const relSheet = relWorkbook.Sheets["Usuarios"]; if (relSheet) AppState.relacionesData = XLSX.utils.sheet_to_json(relSheet); } catch (error) { console.error("Error al cargar archivos estáticos:", error); showAlert("error", "Error Crítico", "No se pudieron cargar los archivos de configuración."); } }

/*****************************************************
 * ========== INICIO DE APP Y MANEJO DE EVENTOS ==========
 *****************************************************/
document.addEventListener("DOMContentLoaded", () => {
    const preloader = document.querySelector('.preloader');
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById("correoUsuario").innerHTML = `<i class="bi bi-person-circle me-2"></i>${user.email}`;
            AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
            loadPendingChanges();
            setUIForRole(AppState.isAdmin);
            await loadStaticExcelFiles();
            await loadFilesFromFirebase();
            showSection('file-selection-section');
        } else {
            window.location.href = "../Login/login.html";
        }
        preloader.classList.add('hidden');
    });
    setupEventListeners();
});


// ===== SECCIÓN MODIFICADA (INICIO) =====
// Se ha mejorado el listener para que el ícono de comentario cambie de forma más visible.
function setupEventListeners() {
    document.getElementById("logout-btn").addEventListener("click", () => auth.signOut());
    document.getElementById("confirmFileSelection").addEventListener("click", () => { if (AppState.selectedFileData) { showAlert("success", "Archivo Confirmado", `Cargando reportes...`); document.getElementById("file-selection-section").style.display = "none"; loadRechazosFileBasedOnRole(); showSection('tools-section'); showSection('content-section'); } else { showAlert("warning", "Atención", "Debes seleccionar un archivo."); } });
    const dropzone = document.getElementById("dropzone");
    if (dropzone) { const handleFileSelect = (file) => { if (file) { checkExistingFile().then(exists => { if (exists) { showAlert("warning", "Archivo existente", "Ya hay un archivo cargado. Elimina el actual."); } else { handleFileUpload(file); } }); } }; dropzone.addEventListener("click", () => { if (!AppState.isAdmin) return; const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = ".xlsx, .xls"; fileInput.onchange = (e) => handleFileSelect(e.target.files[0]); fileInput.click(); }); }
    document.addEventListener("click", (e) => { const target = e.target.closest("[data-action]"); if (!target) return; const action = target.dataset.action; const rowIndex = target.dataset.rowIndex; if (action === "choose-photo") { choosePhoto(rowIndex); } else if (action === "delete-photo") { deletePhoto(rowIndex); } });
    
    document.addEventListener("input", (e) => {
        if (e.target.classList.contains("comentario-input")) {
            const rowIndex = e.target.dataset.rowIndex;
            const newComment = e.target.value;
            
            // Lógica para guardar el cambio
            if (AppState.rechazosGlobal[rowIndex]) {
                const remision = AppState.rechazosGlobal[rowIndex].Remisión;
                AppState.rechazosGlobal[rowIndex].Comentarios = newComment;
                queueChange(remision, 'Comentarios', newComment);
            }
            
            // Lógica para actualizar el ícono del comentario
            const indicator = document.querySelector(`#heading-${rowIndex} .comment-indicator`);
            if (indicator) {
                if (newComment.trim() !== "") {
                    indicator.classList.remove('bi-chat-left-text');
                    indicator.classList.add('bi-chat-left-text-fill', 'text-primary'); // Ícono relleno y de color
                    indicator.title = 'Tiene comentarios';
                } else {
                    indicator.classList.remove('bi-chat-left-text-fill', 'text-primary');
                    indicator.classList.add('bi-chat-left-text'); // Ícono de contorno
                    indicator.title = 'Sin comentarios';
                }
            }

            // Lógica para el autoguardado
            if (autoSaveTimers[rowIndex]) clearTimeout(autoSaveTimers[rowIndex]);
            autoSaveTimers[rowIndex] = setTimeout(() => syncPendingChanges(true), 2000);
        }
    });
}
// ===== SECCIÓN MODIFICADA (FIN) =====

/*****************************************************
 * ========== MANEJO DE ARCHIVOS (FIREBASE) ==========
 *****************************************************/
async function checkExistingFile() { const storageRef = storage.ref("uploads"); const fileList = await storageRef.listAll(); return fileList.items.some(item => item.name.toLowerCase() === "rechazos.xlsx"); }
async function loadFilesFromFirebase() { try { const storageRef = storage.ref("uploads"); const fileList = await storageRef.listAll(); const files = fileList.items.filter(item => item.name.toLowerCase() === "rechazos.xlsx").map(item => ({ name: item.name, ref: item })); if (files.length > 0) { renderFileSelectOptions(files); if (AppState.isAdmin) { renderFilesManagement(files); } const metadata = await files[0].ref.getMetadata(); AppState.fileVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1"; } else { showAlert("warning", "Sin archivo", "No se encontró 'rechazos.xlsx'. Un administrador debe subirlo."); } } catch (error) { console.error("Error al listar archivos de Firebase:", error); showAlert("error", "Error de Red", "No se pudo conectar con Firebase."); } }
function renderFileSelectOptions(files) { const container = document.getElementById("fileListContainer"); container.innerHTML = files.map(file => `<div class="card file-card mb-2" style="border-radius: 12px;"><div class="card-body d-flex justify-content-between align-items-center p-3"><div><i class="bi bi-file-earmark-excel-fill me-2 text-success fs-4"></i><span class="fw-bold">${file.name}</span></div><button class="btn btn-pill btn-pill-sm btn-select">Seleccionar</button></div></div>`).join(''); container.querySelectorAll('.btn-select').forEach((button, index) => { button.addEventListener('click', () => { AppState.selectedFileData = files[index]; document.getElementById("selectedFileFeedback").textContent = `Archivo seleccionado: ${files[index].name}`; document.getElementById("confirmFileSelection").disabled = false; container.querySelectorAll('.file-card').forEach(card => card.style.border = "1px solid var(--gris-medio)"); button.closest('.file-card').style.border = "2px solid var(--rosa-principal)"; }); }); }
async function renderFilesManagement(files) { if (!files.length) return; const container = document.getElementById("filesManagementContainer"); const file = files[0]; const metadata = await file.ref.getMetadata().catch(() => ({})); const version = (metadata.customMetadata && metadata.customMetadata.version) || "N/A"; container.innerHTML = `<div class="file-management-card"> <div class="d-flex justify-content-between align-items-start mb-3"> <div> <h5 class="mb-1 text-dark"><i class="bi bi-file-earmark-excel-fill me-2 text-success"></i>${file.name}</h5> <span class="badge bg-secondary">Versión: ${version}</span> </div> </div> <p class="text-muted small">Acciones de administrador.</p> <div class="d-flex flex-wrap gap-2"> <button class="btn btn-pill btn-pill-sm btn-download" id="adminDownloadBtn"><i class="bi bi-download"></i> Descargar</button> <button class="btn btn-pill btn-pill-sm btn-email" id="adminEmailBtn"><i class="bi bi-envelope"></i> Enviar</button> <button class="btn btn-pill btn-pill-sm btn-delete" id="adminDeleteBtn"><i class="bi bi-trash"></i> Eliminar</button> </div> </div>`; document.getElementById('adminDownloadBtn').addEventListener('click', async () => { const url = await file.ref.getDownloadURL(); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); }); document.getElementById('adminEmailBtn').addEventListener('click', sendFileByEmail); document.getElementById('adminDeleteBtn').addEventListener('click', async () => { const { isConfirmed } = await Swal.fire({ title: '¿Estás seguro?', text: `El archivo "${file.name}" se borrará permanentemente.`, icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--rojo-peligro)', cancelButtonColor: 'var(--gris-oscuro)', confirmButtonText: 'Sí, ¡Eliminar!', cancelButtonText: 'Cancelar' }); if (isConfirmed) { Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() }); try { await file.ref.delete(); showAlert("success", "Eliminado", "El archivo ha sido eliminado."); setTimeout(() => location.reload(), 1500); } catch (error) { showAlert("error", "Error", "No se pudo eliminar el archivo."); } } }); }
async function handleFileUpload(file) { const { isConfirmed } = await Swal.fire({ title: '¿Subir este archivo?', text: `Se cargará "${file.name}" como el nuevo archivo de rechazos.`, icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, subir' }); if (isConfirmed) { const fileRef = storage.ref("uploads/rechazos.xlsx"); const uploadTask = fileRef.put(file, { customMetadata: { version: "1" } }); Swal.fire({ title: 'Subiendo archivo...', html: `<div class="progress"><div id="upload-progress-bar" class="progress-bar" role="progressbar" style="width: 0%; background-color: var(--rosa-principal);"></div></div>`, allowOutsideClick: false, showConfirmButton: false }); uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; document.getElementById('upload-progress-bar').style.width = progress + '%'; }, (error) => { Swal.close(); showAlert("error", "Error de subida", error.message); }, () => { Swal.close(); showAlert("success", "Éxito", "Archivo subido correctamente."); setTimeout(() => location.reload(), 1500); }); } }
async function sendFileByEmail() { if (!AppState.selectedFileData?.ref) { return showAlert("error", "Error", "No hay un archivo seleccionado."); } const fileUrl = await AppState.selectedFileData.ref.getDownloadURL(); const subject = encodeURIComponent("Archivo de Rechazos - Liverpool"); const body = encodeURIComponent(`Hola,\n\nSe comparte el enlace de descarga para el archivo de rechazos actualizado:\n\n${fileUrl}\n\nSaludos.`); window.location.href = `mailto:?subject=${subject}&body=${body}`; }

/*****************************************************
 * ========== MANEJO DE FOTOS (VERSIÓN MEJORADA) ==========
 *****************************************************/
function choosePhoto(rowIndex) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const remisionData = AppState.rechazosGlobal[rowIndex];
        if (!remisionData) {
            console.error("No se encontraron datos para el índice de fila:", rowIndex);
            showAlert("error", "Error Interno", "No se pudieron obtener los datos del reporte. Recarga la página.");
            return;
        }

        const remision = remisionData.Remisión || `evidencia_${Date.now()}`;
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
        const filename = `uploads/evidencias/${remision}_${cleanFileName}`;
        const storageRef = storage.ref(filename);

        Swal.fire({
            title: 'Subiendo foto...',
            html: 'Por favor, espera.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            null, 
            (error) => {
                console.error("Error al subir foto:", error);
                Swal.close();
                showAlert("error", "Error al subir", `No se pudo guardar la evidencia. Código: ${error.code}`);
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                    AppState.rechazosGlobal[rowIndex].Fotos = downloadURL;
                    updatePhotoPreview(rowIndex, downloadURL);
                    queueChange(remision, 'Fotos', downloadURL);
                    if (autoSaveTimers[rowIndex]) clearTimeout(autoSaveTimers[rowIndex]);
                    autoSaveTimers[rowIndex] = setTimeout(() => syncPendingChanges(true), 500);
                    
                    Swal.close();
                    showAlert('success', '¡Evidencia Guardada!', 'La foto se subió correctamente y se guardará en breve.');
                });
            }
        );
    };

    fileInput.click();
}

function deletePhoto(rowIndex) { Swal.fire({ title: '¿Estás seguro?', text: "La foto de evidencia se eliminará permanentemente.", icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--rojo-peligro)', cancelButtonColor: 'var(--gris-oscuro)', confirmButtonText: 'Sí, ¡Eliminar!', cancelButtonText: 'Cancelar' }).then((result) => { if (result.isConfirmed) { const photoUrl = AppState.rechazosGlobal[rowIndex].Fotos; if (photoUrl && photoUrl.startsWith('https://firebasestorage.googleapis.com')) { const photoRef = storage.refFromURL(photoUrl); photoRef.delete().catch(err => console.error("Error al borrar de Storage:", err)); } const remision = AppState.rechazosGlobal[rowIndex].Remisión; AppState.rechazosGlobal[rowIndex].Fotos = ""; updatePhotoPreview(rowIndex, ""); queueChange(remision, 'Fotos', ''); Swal.fire('¡Eliminada!', 'La foto ha sido eliminada.', 'success'); } }); }

function updatePhotoPreview(rowIndex, url) {
    const previewContainer = document.getElementById(`evidencia-preview-${rowIndex}`);
    if (!previewContainer) return;

    if (url && url.trim() !== "") {
        previewContainer.innerHTML = `
            <div class="evidence-thumbnail-container">
                <a href="${url}" target="_blank" title="Ver imagen completa">
                    <img src="${url}" alt="Evidencia" class="evidence-thumbnail">
                </a>
            </div>
            <div class="evidence-actions">
                <button class="btn btn-pill btn-pill-sm btn-photo" data-action="choose-photo" data-row-index="${rowIndex}"><i class="bi bi-camera-fill"></i> Cambiar</button>
                <button class="btn btn-pill btn-pill-sm btn-delete" data-action="delete-photo" data-row-index="${rowIndex}"><i class="bi bi-trash-fill"></i> Eliminar</button>
            </div>`;
    } else {
        previewContainer.innerHTML = `
            <div class="evidence-placeholder-gif" data-action="choose-photo" data-row-index="${rowIndex}" style="cursor: pointer;">
                <img src="${getRandomNotFoundGif()}" alt="Sin evidencia" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">
                <span class="mt-2 fw-bold text-muted">Agregar Evidencia</span>
            </div>`;
    }
}


/*****************************************************
 * ========== LÓGICA DE VISUALIZACIÓN DE DATOS ==========
 *****************************************************/
async function loadRechazosFileBasedOnRole() { if (!AppState.relacionesData) { return showAlert("error", "Error de datos", "No se pudo cargar la información de relaciones."); } let secciones = []; if (!AppState.isAdmin) { const correoUsuario = auth.currentUser.email; const usuarioData = AppState.relacionesData.filter(row => row.Correo === correoUsuario); if (usuarioData.length === 0) { return showAlert("error", "Acceso denegado", "No se encontró información para este usuario."); } usuarioData.forEach(row => { for (const key in row) { if (key.toLowerCase().includes('sección') && row[key]) { secciones = secciones.concat(row[key].toString().split(',').map(s => s.trim())); } } }); secciones = [...new Set(secciones.filter(Boolean))]; } loadRechazosFile(secciones); }
async function loadRechazosFile(secciones) { try { const archivoRechazosRef = AppState.selectedFileData?.ref; if (!archivoRechazosRef) throw new Error("No se ha seleccionado un archivo de rechazos."); const url = await archivoRechazosRef.getDownloadURL(); const response = await fetch(url); const data = await response.arrayBuffer(); const workbook = XLSX.read(data, { type: "array" }); const sheet = workbook.Sheets["Rechazos"]; if (!sheet) return showAlert("error", "Error de Formato", "No existe la hoja 'Rechazos' en el Excel."); AppState.allRechazosEnExcel = XLSX.utils.sheet_to_json(sheet, { defval: "" }); const updatesMap = new Map(Object.entries(AppState.pendingChanges)); if (updatesMap.size > 0) { AppState.allRechazosEnExcel.forEach(row => { const remision = row.Remisión?.toString(); if (remision && updatesMap.has(remision)) { const updates = updatesMap.get(remision); Object.assign(row, updates); } }); } let rechazosFiltrados = AppState.allRechazosEnExcel; if (AppState.isAdmin) { renderBossFilter(rechazosFiltrados); if (adminBossFilter) { rechazosFiltrados = rechazosFiltrados.filter(row => fixEncoding(row["Jefatura"]) === adminBossFilter); } } else if (secciones.length > 0) { rechazosFiltrados = rechazosFiltrados.filter(row => row.Sección && secciones.includes(row.Sección.toString().trim())); } renderRechazos(rechazosFiltrados); } catch (error) { console.error("Error al cargar rechazos.xlsx:", error); showAlert("error", "Error de Carga", "No se pudo procesar el archivo 'rechazos.xlsx'."); } }
function renderBossFilter(allRechazos) { const container = document.getElementById("bossFilterContainer"); const jefesUnicos = [...new Set(allRechazos.map(r => fixEncoding(r["Jefatura"])).filter(Boolean))]; container.innerHTML = `<h5><i class="bi bi-person-video3 me-2"></i>Filtrar por Jefatura</h5><select class="form-select" id="bossFilterSelect"><option value="">Mostrar Todas</option>${jefesUnicos.map(j => `<option value="${j}">${j}</option>`).join('')}</select>`; const select = document.getElementById('bossFilterSelect'); select.value = adminBossFilter; select.addEventListener("change", (e) => { adminBossFilter = e.target.value; const filtrados = adminBossFilter ? AppState.allRechazosEnExcel.filter(row => fixEncoding(row["Jefatura"]) === adminBossFilter) : AppState.allRechazosEnExcel; renderRechazos(filtrados); }); }
function renderRechazos(rechazosData) { const container = document.getElementById("rechazosContainer"); AppState.rechazosGlobal = rechazosData.map((item, index) => ({ ...item, _rowIndex: index, Comentarios: item.Comentarios || "", Fotos: item.Fotos || "" })); if (!rechazosData.length) { container.innerHTML = `<div class="alert alert-info text-center"><i class="bi bi-info-circle-fill"></i> No hay reportes que coincidan con tu filtro actual.</div>`; return; } container.innerHTML = `<div class="accordion" id="rechazosAccordion">${AppState.rechazosGlobal.map(renderRechazoItem).join('')}</div>`; AppState.rechazosGlobal.forEach((rechazo, i) => { loadDynamicImage(rechazo.Sku, rechazo.Sección, `imgContainer-${rechazo.Sku}-${i}`); updatePhotoPreview(rechazo._rowIndex, rechazo.Fotos); }); }

// ===== SECCIÓN MODIFICADA (INICIO) =====
// Se ajusta la función para renderizar el ícono de comentario correcto desde el inicio.
function renderRechazoItem(rechazo, i) {
    const { _rowIndex, Remisión, Sku, Sección } = rechazo;
    const fecha = parseExcelDate(rechazo["Fecha y Hora Rechazo"]) || "N/A";
    const descripcionSku = fixEncoding(rechazo["Descripción Sku"]) || "N/A";
    const piezas = fixEncoding(rechazo.Piezas) || "N/A";
    const jefatura = fixEncoding(rechazo.Jefatura) || "N/A";
    const usuarioRechazo = fixEncoding(rechazo["Usuario de Rechazo"]) || "N/A";
    const user = AppState.usuariosData.find(u => u.Usuarios && u.Usuarios.toString().trim().toLowerCase() === usuarioRechazo.toLowerCase());
    const usuarioName = user?.Nombre || usuarioRechazo;
    const hasComment = (rechazo.Comentarios || "").trim() !== "";
    
    // Define la clase del ícono y el título según si hay o no un comentario
    const commentIconClass = hasComment ? 'bi-chat-left-text-fill text-primary' : 'bi-chat-left-text';
    const commentTitle = hasComment ? 'Tiene comentarios' : 'Sin comentarios';

    const productoSlug = descripcionSku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const liverpoolUrl = `https://www.liverpool.com.mx/tienda/pdp/producto/${Sku}`;

    const createDetailRow = (icon, label, value) => `
        <div class="detail-row d-flex justify-content-between align-items-center py-2 px-1">
            <div class="d-flex align-items-center">
                <i class="bi ${icon} text-muted me-3"></i>
                <span class="text-muted">${label}</span>
            </div>
            <strong class="text-dark text-end">${value}</strong>
        </div>
    `;

    return `
    <div class="accordion-item report-card" id="item-${_rowIndex}">
        <h2 class="accordion-header" id="heading-${_rowIndex}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${_rowIndex}">
                <div class="badge bg-dark rounded-pill">${Remisión}</div>
                <div class="report-summary">
                    <div class="sku-title" title="${descripcionSku}">${descripcionSku}</div>
                    <div class="user-info"><i class="bi bi-person"></i> ${usuarioName}</div>
                </div>
                <i class="bi ${commentIconClass} comment-indicator" title="${commentTitle}"></i>
            </button>
        </h2>
        <div id="collapse-${_rowIndex}" class="accordion-collapse collapse" data-bs-parent="#rechazosAccordion">
            <div class="accordion-body">
                <div class="row g-4">
                    <div class="col-lg-7">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="mb-0 fw-bold">Detalles del Rechazo</h5>
                            <a href="${liverpoolUrl}" target="_blank" class="btn btn-sm btn-outline-dark rounded-pill">
                                <i class="bi bi-box-arrow-up-right"></i> Ver en liverpool.com.mx
                            </a>
                        </div>
                        
                        <div class="details-list-container border rounded p-2">
                            ${createDetailRow('bi-upc-scan', 'SKU', Sku)}
                            ${createDetailRow('bi-box-seam', 'Piezas', piezas)}
                            ${createDetailRow('bi-calendar-event', 'Fecha', fecha)}
                            ${createDetailRow('bi-tag-fill', 'Sección', Sección)}
                            ${createDetailRow('bi-person-workspace', 'Jefatura', jefatura)}
                        </div>
                        
                        <div class="mt-4">
                            <label for="comentario-${_rowIndex}" class="form-label fw-bold"><i class="bi bi-chat-left-dots-fill"></i> Comentarios:</label>
                            <textarea id="comentario-${_rowIndex}" rows="4" class="form-control comentario-input" data-row-index="${_rowIndex}" placeholder="Añade tus comentarios aquí...">${rechazo.Comentarios}</textarea>
                        </div>
                    </div>
                    <div class="col-lg-5">
                        <div class="evidence-section">
                            <h6 class="mb-3"><i class="bi bi-camera-fill me-2"></i>Evidencia</h6>
                            <div id="imgContainer-${Sku}-${i}" class="product-image-container mb-3"></div>
                            <div id="evidencia-preview-${_rowIndex}" class="evidence-preview-container"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}
// ===== SECCIÓN MODIFICADA (FIN) =====