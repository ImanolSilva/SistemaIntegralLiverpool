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
    if (isAutoSave) {
        updateSyncStatus('syncing');
    } else {
        Swal.fire({ title: 'Guardando Cambios...', html: 'Por favor, espera.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    }

    try {
        const fileRef = AppState.selectedFileData?.ref;
        if (!fileRef) throw new Error("No hay un archivo de referencia seleccionado.");
        
        const metadata = await fileRef.getMetadata();
        const serverVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
        
        if (serverVersion !== AppState.fileVersion && isAutoSave) {
            console.warn("Conflicto de versiones detectado durante autoguardado. Se reintentará en el próximo cambio.");
            AppState.isSyncing = false;
            updateSyncStatus('error'); // Muestra un error para que el usuario sepa que su último cambio no se guardó
            return;
        } else if (serverVersion !== AppState.fileVersion) {
             throw new Error("Conflicto de versiones. Por favor, recarga la página para obtener los cambios más recientes.");
        }

        const url = await fileRef.getDownloadURL();
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets["Rechazos"];
        if (!sheet) throw new Error("La hoja 'Rechazos' no fue encontrada en el archivo.");
        
        let excelData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        // --- INICIO DE LA CORRECCIÓN CLAVE ---
        // Aplicamos los cambios pendientes a una COPIA de los datos originales
        // para confirmar que realmente hay algo que guardar.
        let hasChanges = false;
        const updatesMap = new Map(Object.entries(AppState.pendingChanges));

        excelData.forEach(row => {
            const remision = row.Remisión?.toString();
            if (remision && updatesMap.has(remision)) {
                const updates = updatesMap.get(remision);
                for (const field in updates) {
                    // Comparamos el valor del archivo original con el cambio pendiente
                    if (row[field] !== updates[field]) {
                        row[field] = updates[field]; // Aplicamos el cambio
                        hasChanges = true;
                    }
                }
            }
        });
        // --- FIN DE LA CORRECCIÓN CLAVE ---

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
        
        AppState.fileVersion = newVersion; // Actualizamos la versión local
        AppState.allRechazosEnExcel = excelData; // Actualizamos los datos en memoria con los guardados
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
    
    document.getElementById("confirmFileSelection").addEventListener("click", () => {
        if (AppState.selectedFileData) {
            showAlert("success", "Archivo Confirmado", `Cargando reportes...`);
            document.getElementById("file-selection-section").style.display = "none";
            loadRechazosFileBasedOnRole();
            showSection('tools-section');
            showSection('content-section');
        } else {
            showAlert("warning", "Atención", "Debes seleccionar un archivo.");
        }
    });

    // ===== INICIO DE LA SECCIÓN CORREGIDA =====
    const dropzone = document.getElementById("dropzone");
    if (dropzone) {
        // Esta función ahora es más simple
        const handleFileSelect = (file) => {
            if (file) {
                // Ya no llamamos a checkExistingFile().
                // Directamente procesamos la subida del nuevo archivo.
                handleFileUpload(file);
            }
        };

        // El resto del listener no cambia
        dropzone.addEventListener("click", () => {
            if (!AppState.isAdmin) return;
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".xlsx, .xls";
            fileInput.onchange = (e) => handleFileSelect(e.target.files[0]);
            fileInput.click();
        });
        // Aquí también puedes agregar los listeners de 'dragover', 'dragleave', y 'drop' si los necesitas.
    }
    // ===== FIN DE LA SECCIÓN CORREGIDA =====

    document.getElementById("generarDashboardTotalBtn").addEventListener("click", () => generarDashboard());
    document.getElementById("generarDashboardRangoBtn").addEventListener("click", generarDashboardPorRango);

    document.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;
        const action = target.dataset.action;
        const rowIndex = target.dataset.rowIndex;
        if (action === "choose-photo") {
            choosePhoto(rowIndex);
        } else if (action === "delete-photo") {
            deletePhoto(rowIndex);
        }
    });
    
    // ===== SECCIÓN MODIFICADA (INICIO) =====
    document.addEventListener("change", (e) => { // Cambiamos de "input" a "change"
        if (e.target.classList.contains("status-select")) { // Buscamos la nueva clase
            const rowIndex = e.target.dataset.rowIndex;
            const newStatus = e.target.value;
            
            // Lógica para guardar el cambio
            if (AppState.rechazosGlobal[rowIndex]) {
                const remision = AppState.rechazosGlobal[rowIndex].Remisión;
                AppState.rechazosGlobal[rowIndex].Status = newStatus; // Guardamos en el campo 'Status'
                queueChange(remision, 'Status', newStatus); // Encolamos el cambio para el campo 'Status'
            }
            
            // Lógica para actualizar el badge de estado en el encabezado del acordeón
            const headerBadge = document.querySelector(`#heading-${rowIndex} .badge`);
            if(headerBadge) {
                const statusColors = { /* ... (copia el mismo objeto de colores de renderRechazoItem) ... */ };
                headerBadge.style.backgroundColor = statusColors[newStatus] || 'var(--gris-oscuro)';
                headerBadge.textContent = newStatus;
            }

            // Lógica para el autoguardado (sin cambios)
            if (autoSaveTimers[rowIndex]) clearTimeout(autoSaveTimers[rowIndex]);
            autoSaveTimers[rowIndex] = setTimeout(() => syncPendingChanges(true), 2000);
        }
    });
}

/*****************************************************
 * ========== MANEJO DE ARCHIVOS (FIREBASE) ==========
 *****************************************************/
async function checkExistingFile() { const storageRef = storage.ref("uploads"); const fileList = await storageRef.listAll(); return fileList.items.some(item => item.name.toLowerCase() === "rechazos.xlsx"); }
async function loadFilesFromFirebase() {
    try {
        const storageRef = storage.ref("uploads");
        const fileList = await storageRef.listAll();

        // --- INICIO DEL CAMBIO CLAVE ---
        // Filtramos la lista de archivos para incluir solo aquellos que contienen "rechazos" en su nombre.
        // Usamos toLowerCase() para que no importe si es "Rechazos", "rechazos", etc.
        const rechazosItems = fileList.items.filter(item => 
            item.name.toLowerCase().includes('rechazos')
        );
        // --- FIN DEL CAMBIO CLAVE ---

        // Ahora, basamos todas las comprobaciones en la lista ya filtrada.
        if (rechazosItems.length === 0) {
            showAlert("warning", "Sin archivos", "No se encontró ningún reporte de 'Rechazos'. Un administrador debe subir el primero.");
            // Ocultamos el panel de gestión si no hay archivos que gestionar
            const mgmtContainer = document.getElementById("filesManagementContainer");
            if (mgmtContainer) mgmtContainer.innerHTML = "";
            return;
        }

        // Obtenemos los metadatos solo de los archivos de rechazos
        const filesWithMetadata = await Promise.all(
            rechazosItems.map(async (item) => {
                const metadata = await item.getMetadata();
                return {
                    name: item.name,
                    ref: item,
                    timeCreated: new Date(metadata.timeCreated),
                    version: (metadata.customMetadata && metadata.customMetadata.version) || "1"
                };
            })
        );

        // Ordenamos los archivos del más reciente al más antiguo
        filesWithMetadata.sort((a, b) => b.timeCreated - a.timeCreated);
        
        renderFileSelectOptions(filesWithMetadata);

        if (AppState.isAdmin) {
            // La función de gestión ya recibe la lista filtrada, por lo que no necesita cambios.
            renderFilesManagement(filesWithMetadata);
        }
        
    } catch (error) {
        console.error("Error al listar archivos de Firebase:", error);
        showAlert("error", "Error de Red", "No se pudo conectar con Firebase.");
    }
}

function renderFileSelectOptions(files) { const container = document.getElementById("fileListContainer"); container.innerHTML = files.map(file => `<div class="card file-card mb-2" style="border-radius: 12px;"><div class="card-body d-flex justify-content-between align-items-center p-3"><div><i class="bi bi-file-earmark-excel-fill me-2 text-success fs-4"></i><span class="fw-bold">${file.name}</span></div><button class="btn btn-pill btn-pill-sm btn-select">Seleccionar</button></div></div>`).join(''); container.querySelectorAll('.btn-select').forEach((button, index) => { button.addEventListener('click', () => { AppState.selectedFileData = files[index]; document.getElementById("selectedFileFeedback").textContent = `Archivo seleccionado: ${files[index].name}`; document.getElementById("confirmFileSelection").disabled = false; container.querySelectorAll('.file-card').forEach(card => card.style.border = "1px solid var(--gris-medio)"); button.closest('.file-card').style.border = "2px solid var(--rosa-principal)"; }); }); }
async function renderFilesManagement(files) {
    if (!files.length) return;

    const container = document.getElementById("filesManagementContainer");

    const filesHTML = files.map(file => `
        <tr>
            <td>
                <i class="bi bi-file-earmark-excel-fill text-success"></i>
                <span class="fw-bold ms-2">${file.name}</span>
            </td>
            <td><span class="badge bg-secondary">Versión: ${file.version}</span></td>
            <td>${file.timeCreated.toLocaleDateString()}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger btn-pill-sm admin-delete-btn" data-filename="${file.name}" title="Eliminar archivo">
                    <i class="bi bi-trash"></i> Eliminar
                </button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="file-management-card">
            <h5 class="mb-3 text-dark"><i class="bi bi-shield-lock-fill me-2"></i>Gestión de Archivos (Admin)</h5>
            <div class="table-responsive">
                <table class="table table-hover table-sm small">
                    <thead>
                        <tr>
                            <th>Nombre del Archivo</th>
                            <th>Versión</th>
                            <th>Fecha de Subida</th>
                            <th class="text-end">Acción</th>
                        </tr>
                    </thead>
                    <tbody>${filesHTML}</tbody>
                </table>
            </div>
        </div>`;

    document.querySelectorAll('.admin-delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const fileName = e.currentTarget.dataset.filename;
            const fileRef = storage.ref(`uploads/${fileName}`);

            const { isConfirmed } = await Swal.fire({
                title: '¿Estás seguro?',
                text: `El archivo "${fileName}" se borrará permanentemente.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'var(--rojo-peligro)',
                cancelButtonColor: 'var(--gris-oscuro)',
                confirmButtonText: 'Sí, ¡Eliminar!',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                try {
                    await fileRef.delete();
                    showAlert("success", "Eliminado", "El archivo ha sido eliminado.");
                    setTimeout(() => location.reload(), 1500);
                } catch (error) {
                    showAlert("error", "Error", "No se pudo eliminar el archivo.");
                }
            }
        });
    });

}async function handleFileUpload(file) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Subir este archivo?',
        text: `Se cargará "${file.name}" como un nuevo reporte de rechazos.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, subir'
    });

    if (isConfirmed) {
        // --- INICIO DEL CAMBIO CLAVE ---
        // Generamos un nombre de archivo único con fecha y hora
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const newFileName = `Rechazos_${timestamp}.xlsx`;
        
        const fileRef = storage.ref(`uploads/${newFileName}`);
        // --- FIN DEL CAMBIO CLAVE ---

        const uploadTask = fileRef.put(file, { customMetadata: { version: "1" } });

        Swal.fire({
            title: 'Subiendo archivo...',
            html: `<div class="progress"><div id="upload-progress-bar" class="progress-bar" role="progressbar" style="width: 0%; background-color: var(--rosa-principal);"></div></div>`,
            allowOutsideClick: false,
            showConfirmButton: false
        });

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                document.getElementById('upload-progress-bar').style.width = progress + '%';
            },
            (error) => {
                Swal.close();
                showAlert("error", "Error de subida", error.message);
            },
            () => {
                Swal.close();
                showAlert("success", "Éxito", "Archivo subido correctamente.");
                setTimeout(() => location.reload(), 1500); // Recargamos para ver el nuevo archivo en la lista
            }
        );
    }
}async function sendFileByEmail() { if (!AppState.selectedFileData?.ref) { return showAlert("error", "Error", "No hay un archivo seleccionado."); } const fileUrl = await AppState.selectedFileData.ref.getDownloadURL(); const subject = encodeURIComponent("Archivo de Rechazos - Liverpool"); const body = encodeURIComponent(`Hola,\n\nSe comparte el enlace de descarga para el archivo de rechazos actualizado:\n\n${fileUrl}\n\nSaludos.`); window.location.href = `mailto:?subject=${subject}&body=${body}`; }

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
            <div class="evidence-placeholder" data-action="choose-photo" data-row-index="${rowIndex}" style="cursor: pointer; text-align: center; padding: 20px; border: 2px dashed #dee2e6; border-radius: 8px;">
                <button class="btn btn-pill btn-pill-sm btn-primary">
                    <i class="bi bi-camera-fill me-2"></i>Agregar Evidencia
                </button>
            </div>`;
    }
}


/*****************************************************
 * ========== LÓGICA DE VISUALIZACIÓN DE DATOS ==========
 *****************************************************/
async function loadRechazosFileBasedOnRole() { if (!AppState.relacionesData) { return showAlert("error", "Error de datos", "No se pudo cargar la información de relaciones."); } let secciones = []; if (!AppState.isAdmin) { const correoUsuario = auth.currentUser.email; const usuarioData = AppState.relacionesData.filter(row => row.Correo === correoUsuario); if (usuarioData.length === 0) { return showAlert("error", "Acceso denegado", "No se encontró información para este usuario."); } usuarioData.forEach(row => { for (const key in row) { if (key.toLowerCase().includes('sección') && row[key]) { secciones = secciones.concat(row[key].toString().split(',').map(s => s.trim())); } } }); secciones = [...new Set(secciones.filter(Boolean))]; } loadRechazosFile(secciones); }
async function loadRechazosFile(secciones) {
    try {
        const archivoRechazosRef = AppState.selectedFileData?.ref;
        if (!archivoRechazosRef) throw new Error("No se ha seleccionado un archivo de rechazos.");

        // --- INICIO DE LA CORRECCIÓN CLAVE ---
        // Obtenemos los metadatos PRIMERO para saber la versión del archivo
        const metadata = await archivoRechazosRef.getMetadata();
        AppState.fileVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
        console.log(`Versión del archivo establecida en: ${AppState.fileVersion}`);
        // --- FIN DE LA CORRECCIÓN CLAVE ---
        
        const url = await archivoRechazosRef.getDownloadURL();
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets["Rechazos"];
        
        if (!sheet) return showAlert("error", "Error de Formato", "No existe la hoja 'Rechazos' en el Excel.");
        
        AppState.allRechazosEnExcel = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const updatesMap = new Map(Object.entries(AppState.pendingChanges));
        if (updatesMap.size > 0) {
            console.log("Aplicando cambios pendientes a los datos cargados...");
            AppState.allRechazosEnExcel.forEach(row => {
                const remision = row.Remisión?.toString();
                if (remision && updatesMap.has(remision)) {
                    const updates = updatesMap.get(remision);
                    Object.assign(row, updates);
                }
            });
        }

        let rechazosFiltrados = AppState.allRechazosEnExcel;

        if (AppState.isAdmin) {
            renderBossFilter(rechazosFiltrados);
            if (adminBossFilter) {
                rechazosFiltrados = rechazosFiltrados.filter(row => fixEncoding(row["Jefatura"]) === adminBossFilter);
            }
        } else if (secciones.length > 0) {
            rechazosFiltrados = rechazosFiltrados.filter(row => row.Sección && secciones.includes(row.Sección.toString().trim()));
        }
        
        renderRechazos(rechazosFiltrados);

    } catch (error) {
        console.error("Error al cargar rechazos.xlsx:", error);
        showAlert("error", "Error de Carga", "No se pudo procesar el archivo 'rechazos.xlsx'.");
    }
}
function renderBossFilter(allRechazos) { const container = document.getElementById("bossFilterContainer"); const jefesUnicos = [...new Set(allRechazos.map(r => fixEncoding(r["Jefatura"])).filter(Boolean))]; container.innerHTML = `<h5><i class="bi bi-person-video3 me-2"></i>Filtrar por Jefatura</h5><select class="form-select" id="bossFilterSelect"><option value="">Mostrar Todas</option>${jefesUnicos.map(j => `<option value="${j}">${j}</option>`).join('')}</select>`; const select = document.getElementById('bossFilterSelect'); select.value = adminBossFilter; select.addEventListener("change", (e) => { adminBossFilter = e.target.value; const filtrados = adminBossFilter ? AppState.allRechazosEnExcel.filter(row => fixEncoding(row["Jefatura"]) === adminBossFilter) : AppState.allRechazosEnExcel; renderRechazos(filtrados); }); }
function renderRechazos(rechazosData) { const container = document.getElementById("rechazosContainer"); AppState.rechazosGlobal = rechazosData.map((item, index) => ({ ...item, _rowIndex: index, Comentarios: item.Comentarios || "", Fotos: item.Fotos || "" })); if (!rechazosData.length) { container.innerHTML = `<div class="alert alert-info text-center"><i class="bi bi-info-circle-fill"></i> No hay reportes que coincidan con tu filtro actual.</div>`; return; } container.innerHTML = `<div class="accordion" id="rechazosAccordion">${AppState.rechazosGlobal.map(renderRechazoItem).join('')}</div>`; AppState.rechazosGlobal.forEach((rechazo, i) => { loadDynamicImage(rechazo.Sku, rechazo.Sección, `imgContainer-${rechazo.Sku}-${i}`); updatePhotoPreview(rechazo._rowIndex, rechazo.Fotos); }); }

// ===== SECCIÓN MODIFICADA (INICIO) =====
// Se ajusta la función para renderizar el ícono de comentario correcto desde el inicio.
// ===== INICIO DE LA FUNCIÓN ACTUALIZADA =====
function renderRechazoItem(rechazo, i) {
    const { _rowIndex, Remisión, Sku, Sección } = rechazo;
    const fecha = parseExcelDate(rechazo["Fecha y Hora Rechazo"]) || "N/A";
    const descripcionSku = fixEncoding(rechazo["Descripción Sku"]) || "N/A";
    const piezas = fixEncoding(rechazo.Piezas) || "N/A";
    const jefatura = fixEncoding(rechazo.Jefatura) || "N/A";
    const usuarioRechazo = fixEncoding(rechazo["Usuario de Rechazo"]) || "N/A";
    const user = AppState.usuariosData.find(u => u.Usuarios && u.Usuarios.toString().trim().toLowerCase() === usuarioRechazo.toLowerCase());
    const usuarioName = user?.Nombre || usuarioRechazo;

    // Lógica de Estado (Nueva)
    const estadosPosibles = ["Sin Estado", "Sí encontrada", "No encontrada", "Encontrada en exhibición", "Encontrada Merma"];
    const estadoActual = rechazo.Status || "Sin Estado";

    const statusColors = {
        "Sí encontrada": "var(--verde-exito)",
        "No encontrada": "var(--rojo-peligro)",
        "Encontrada en exhibición": "var(--azul-info)",
        "Encontrada Merma": "#ff9800",
        "Sin Estado": "var(--gris-oscuro)"
    };
    
    const opcionesHTML = estadosPosibles.map(opt => 
        `<option value="${opt}" ${estadoActual === opt ? 'selected' : ''}>${opt}</option>`
    ).join('');

    // Lógica de URLs de Búsqueda (Restaurada)
    let liverpoolUrl = "#";
    if (/^\d{10,}$/.test(Sku)) {
        liverpoolUrl = `https://www.liverpool.com.mx/tienda/pdp/producto/${Sku}`;
    } else if (Sku && Sku.toString().trim() !== "") {
        liverpoolUrl = `https://www.liverpool.com.mx/tienda/busca?busqueda=${encodeURIComponent(Sku)}`;
    } else if (descripcionSku && descripcionSku !== "N/A") {
        liverpoolUrl = `https://www.liverpool.com.mx/tienda/busca?busqueda=${encodeURIComponent(descripcionSku)}`;
    }

    let googleQuerySku = Sku && Sku.toString().trim() !== "" ? Sku : descripcionSku;
    const googleUrlSku = `https://www.google.com/search?q=${encodeURIComponent(googleQuerySku)}`;
    const googleUrlDesc = descripcionSku && descripcionSku !== "N/A" ? `https://www.google.com/search?q=${encodeURIComponent(descripcionSku)}` : "#";

    // Función auxiliar para crear filas de detalles (Restaurada)
    const createDetailRow = (icon, label, value) => `
        <div class="detail-row d-flex justify-content-between align-items-center py-2 px-1 flex-wrap">
            <div class="d-flex align-items-center gap-2">
                <i class="bi ${icon} text-secondary me-2" title="${label}"></i>
                <span class="text-muted small">${label}</span>
            </div>
            <strong class="text-dark text-end small">${value}</strong>
        </div>
    `;

    // Estructura HTML Completa
    return `
    <div class="accordion-item report-card shadow-sm mb-3 rounded-4 border-0" id="item-${_rowIndex}">
        <h2 class="accordion-header" id="heading-${_rowIndex}">
            <button class="accordion-button collapsed px-2 py-2 d-flex flex-row align-items-center gap-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${_rowIndex}">
                <span class="badge rounded-pill me-2" style="background-color: ${statusColors[estadoActual]}; min-width: 120px; font-size: 0.75rem;">${estadoActual}</span>
                <div class="report-summary flex-grow-1 d-flex flex-column flex-md-row align-items-md-center gap-2">
                    <span class="sku-title fw-semibold" title="${descripcionSku}">${descripcionSku}</span>
                    <span class="user-info text-muted small"><i class="bi bi-person"></i> ${usuarioName}</span>
                </div>
                <span class="ms-2 badge bg-dark rounded-pill">${Remisión}</span>
            </button>
        </h2>
        <div id="collapse-${_rowIndex}" class="accordion-collapse collapse" data-bs-parent="#rechazosAccordion">
            <div class="accordion-body px-2 py-3">
                <div class="row g-3">
                    <div class="col-12 col-lg-7">
                        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                            <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-info-circle me-2"></i>Detalles del Rechazo</h5>
                            <div class="d-flex gap-2">
                                <a href="${liverpoolUrl}" target="_blank" class="btn btn-sm btn-outline-dark rounded-pill d-flex align-items-center gap-1" title="Ver producto en Liverpool">
                                    <i class="bi bi-box-arrow-up-right"></i> <span class="d-none d-md-inline">Ver en Liverpool</span>
                                </a>
                                <a href="${googleUrlSku}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill d-flex align-items-center gap-1" title="Buscar en Google por SKU">
                                    <i class="bi bi-google"></i> <span class="d-none d-md-inline">Google SKU</span>
                                </a>
                                <a href="${googleUrlDesc}" target="_blank" class="btn btn-sm btn-outline-success rounded-pill d-flex align-items-center gap-1" title="Buscar en Google por descripción">
                                    <i class="bi bi-google"></i> <span class="d-none d-md-inline">Google Descripción</span>
                                </a>
                            </div>
                        </div>
                        <div class="details-list-container border rounded-3 p-2 bg-light">
                            ${createDetailRow('bi-upc-scan', 'SKU', Sku)}
                            ${createDetailRow('bi-box-seam', 'Piezas', piezas)}
                            ${createDetailRow('bi-calendar-event', 'Fecha', fecha)}
                            ${createDetailRow('bi-tag-fill', 'Sección', Sección)}
                            ${createDetailRow('bi-person-workspace', 'Jefatura', jefatura)}
                        </div>
                        <div class="mt-3">
                            <label for="status-${_rowIndex}" class="form-label fw-bold text-dark">
                                <i class="bi bi-check-circle-fill"></i> Estado del Rechazo:
                            </label>
                            <select id="status-${_rowIndex}" class="form-select status-select rounded-3 shadow-sm" data-row-index="${_rowIndex}">
                                ${opcionesHTML}
                            </select>
                        </div>
                    </div>
                    <div class="col-12 col-lg-5">
                        <div class="evidence-section">
                            <h6 class="mb-2 fw-bold text-dark"><i class="bi bi-camera-fill me-2"></i>Evidencia</h6>
                            <div id="imgContainer-${Sku}-${i}" class="product-image-container mb-2 w-100 d-flex justify-content-center"></div>
                            <div id="evidencia-preview-${_rowIndex}" class="evidence-preview-container w-100"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}
// NUEVA FUNCIÓN para manejar el clic del botón de rango de fechas
async function generarDashboardPorRango() {
    const fechaInicioStr = document.getElementById('fechaInicio').value;
    const fechaFinStr = document.getElementById('fechaFin').value;

    if (!fechaInicioStr || !fechaFinStr) {
        showAlert("warning", "Fechas incompletas", "Por favor, selecciona una fecha de inicio y una de fin.");
        return;
    }

    const fechaInicio = new Date(fechaInicioStr);
    // Añadimos un día a la fecha de fin para incluir todo el día seleccionado
    const fechaFin = new Date(fechaFinStr);
    fechaFin.setDate(fechaFin.getDate() + 1);

    if (fechaInicio > fechaFin) {
        showAlert("error", "Rango inválido", "La fecha de inicio no puede ser posterior a la fecha de fin.");
        return;
    }
    
    // Llamamos a la función principal pasándole las fechas
    generarDashboard({ fechaInicio, fechaFin });
}

async function generarDashboard(dateRange = null) {
    Swal.fire({
        title: 'Generando Comparativa de Rendimiento...',
        html: 'Analizando el historial completo de reportes.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const storageRef = storage.ref("uploads");
        const fileList = await storageRef.listAll();
        const rechazosItems = fileList.items.filter(item => item.name.toLowerCase().includes('rechazos'));

        if (rechazosItems.length === 0) {
            return Swal.fire("Sin Datos", "No se encontraron archivos de 'Rechazos' para analizar.", "info");
        }

        let todosLosRechazosHistoricos = [];
        await Promise.all(rechazosItems.map(async (fileRef) => {
            const url = await fileRef.getDownloadURL();
            const data = await (await fetch(url)).arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets["Rechazos"];
            if (sheet) {
                todosLosRechazosHistoricos.push(...XLSX.utils.sheet_to_json(sheet, { defval: "" }));
            }
        }));
        
        const statsHistoricas = agregarDatosPorJefatura(todosLosRechazosHistoricos);

        if (statsHistoricas.length === 0) {
            return Swal.fire("Sin Datos", "No se encontraron jefaturas en los archivos para generar el reporte.", "info");
        }

        // Encontrar el máximo de piezas rechazadas para usarlo como el 100% de "mal desempeño"
        const maxPiezasRechazadas = Math.max(...statsHistoricas.map(j => j.totalPiezas).filter(p => p > 0));

        // Calcular el porcentaje de rendimiento para cada jefe
        const datosConRendimiento = statsHistoricas.map(jefeData => {
            const rendimiento = maxPiezasRechazadas > 0 ? 100 - (jefeData.totalPiezas / maxPiezasRechazadas) * 100 : 100;
            return {
                ...jefeData,
                rendimiento: parseFloat(rendimiento.toFixed(1))
            };
        }).sort((a, b) => b.rendimiento - a.rendimiento); // Ordenar por mejor rendimiento

        renderDashboardUI(datosConRendimiento);

    } catch (error) {
        console.error("Error generando dashboard:", error);
        Swal.fire("Error", "No se pudo generar el dashboard. Revisa la consola.", "error");
    }
}
// La función auxiliar 'agregarDatosPorJefatura' no necesita cambios


function agregarDatosPorJefatura(rechazos) {
    const stats = {};
    const estadosPosibles = ["Sí encontrada", "No encontrada", "Encontrada en exhibición", "Encontrada Merma", "Sin Estado"];

    rechazos.forEach(rechazo => {
        const jefatura = fixEncoding(rechazo.Jefatura) || "Sin Asignar";
        const estado = rechazo.Status || "Sin Estado";
        const piezas = Number(rechazo.Piezas) || 0;

        if (!stats[jefatura]) {
            stats[jefatura] = { totalReportes: 0, totalPiezas: 0, statusCounts: {}, statusPieces: {} };
            estadosPosibles.forEach(s => {
                stats[jefatura].statusCounts[s] = 0;
                stats[jefatura].statusPieces[s] = 0;
            });
        }

        stats[jefatura].totalPiezas += piezas;
        stats[jefatura].totalReportes += 1;
        
        if (estadosPosibles.includes(estado)) {
            stats[jefatura].statusCounts[estado] += 1;
            stats[jefatura].statusPieces[estado] += piezas;
        }
    });

    return Object.entries(stats).map(([jefe, data]) => ({
        jefe, ...data
    }));
}

function renderDashboardUI(dataConRendimiento, dateRange) {
    let title = "<strong>Dashboard de Productividad (Historial Completo)</strong>";
    if (dateRange) {
        const fechaFinCorrecta = new Date(dateRange.fechaFin.getTime() - 86400000); 
        title = `<strong>Dashboard de Productividad (${dateRange.fechaInicio.toLocaleDateString('es-MX')} - ${fechaFinCorrecta.toLocaleDateString('es-MX')})</strong>`;
    }

    const modalHTML = `
        <style>
            .nav-pills .nav-link { font-weight: 600; color: #495057; border-radius: 50px; padding: 0.5rem 1.5rem; transition: all 0.3s ease; }
            .nav-pills .nav-link.active { color: #fff; background-color: var(--rosa-principal); box-shadow: 0 4px 15px rgba(230, 0, 126, 0.4); }
            .tab-content { background-color: #f8f9fa; border-radius: 16px; margin-top: 1rem; }
            .leaderboard-item { display: flex; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; }
            .leaderboard-name { font-weight: 500; color: #343a40; width: 180px; text-align: right; margin-right: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .progress-container { flex-grow: 1; display: flex; align-items: center; }
            .progress { height: 25px; width: 100%; border-radius: 5px; background-color: #e9ecef; overflow: visible; position: relative; }
            .progress-bar { font-weight: bold; font-size: 0.8rem; text-align: left; padding-left: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.15) inset; }
            .percentage-label { font-weight: 700; color: #343a40; margin-left: 1rem; width: 50px; }
            .stat-card-lg { background-color: #fff; border-radius: 16px; padding: 1.5rem; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.07); transition: all 0.3s ease; }
            .stat-card-lg:hover { transform: translateY(-5px); box-shadow: 0 12px 30px rgba(0,0,0,0.1); }
            .stat-card-lg .icon { font-size: 3rem; }
            .stat-card-lg .total { font-size: 3.5rem; font-weight: 700; line-height: 1.1; }
            .chart-card { background-color: #fff; padding: 1.5rem; border-radius: 16px; height: 300px; box-shadow: 0 8px 25px rgba(0,0,0,0.07); }
        </style>
        <div class="container-fluid">
            <ul class="nav nav-pills justify-content-center mb-3" id="dashboardTab" role="tablist">
                <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#rendimiento" type="button"><i class="bi bi-trophy-fill me-2"></i>Rendimiento</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#desglose" type="button"><i class="bi bi-pie-chart-fill me-2"></i>Análisis de Estados</button></li>
                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabla" type="button"><i class="bi bi-table me-2"></i>Tabla Completa</button></li>
            </ul>
            <div class="tab-content p-3" id="dashboardTabContent">
                <div class="tab-pane fade show active" id="rendimiento" role="tabpanel">
                    <div class="p-3 rounded-3" style="background-color: #fff; box-shadow: 0 8px 25px rgba(0,0,0,0.07);">
                        </div>
                </div>
                <div class="tab-pane fade" id="desglose" role="tabpanel">
                    <div class="row g-4">
                        <div class="col-12 col-md-6">
                            <div class="stat-card-lg text-success"><i class="bi bi-check-circle-fill icon"></i><div id="totalSiEncontrada" class="total">0</div><div>Piezas "Sí Encontradas"</div></div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="stat-card-lg text-danger"><i class="bi bi-x-circle-fill icon"></i><div id="totalNoEncontrada" class="total">0</div><div>Piezas "No Encontradas"</div></div>
                        </div>
                        <div class="col-12 mt-4"><hr></div>
                        <div class="col-12 col-xl-6"><div class="chart-card"><canvas id="exhibicionChart"></canvas></div></div>
                        <div class="col-12 col-xl-6"><div class="chart-card"><canvas id="mermaChart"></canvas></div></div>
                    </div>
                </div>
                <div class="tab-pane fade" id="tabla" role="tabpanel">
                    </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: title,
        html: modalHTML,
        width: '95%',
        maxWidth: '1200px',
        showCloseButton: true,
        showConfirmButton: false,
        didOpen: () => {
            // --- Lógica para Pestaña 1: Rendimiento ---
            const rendimientoContainer = document.querySelector('#rendimiento .p-3');
            rendimientoContainer.innerHTML = dataConRendimiento.map((item) => {
                let colorClass;
                if (item.rendimiento >= 85) colorClass = 'bg-success';
                else if (item.rendimiento >= 60) colorClass = 'bg-warning text-dark';
                else colorClass = 'bg-danger';
                return `
                <div class="leaderboard-item">
                    <div class="leaderboard-name" title="${item.jefe}">${item.jefe}</div>
                    <div class="progress-container">
                        <div class="progress">
                            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${item.rendimiento}%;"></div>
                        </div>
                        <div class="percentage-label">${item.rendimiento.toFixed(1)}%</div>
                    </div>
                </div>`;
            }).join('');

            // --- Lógica para Pestaña 2: Desglose de Estados ---
            const createStatusChart = (canvasId, statusName, color, data, titleText) => {
                const chartData = data
                    .map(j => ({ jefe: j.jefe, piezas: j.statusPieces[statusName] || 0 }))
                    .filter(j => j.piezas > 0)
                    .sort((a, b) => b.piezas - a.piezas);

                if (chartData.length === 0) {
                    document.getElementById(canvasId).parentElement.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted">No hay datos para "${statusName}".</div>`;
                    return;
                }
                new Chart(document.getElementById(canvasId).getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: chartData.map(d => d.jefe),
                        datasets: [{ label: 'Piezas', data: chartData.map(d => d.piezas), backgroundColor: color, borderRadius: 4 }]
                    },
                    options: {
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, title: { display: true, text: titleText, font: { weight: 'bold', size: 14 } }, tooltip: { callbacks: { label: (c) => ` Piezas: ${c.raw.toLocaleString('es-MX')}` } } },
                        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
                    }
                });
            };
            
            document.getElementById('totalSiEncontrada').textContent = dataConRendimiento.reduce((sum, j) => sum + j.statusPieces['Sí encontrada'], 0).toLocaleString('es-MX');
            document.getElementById('totalNoEncontrada').textContent = dataConRendimiento.reduce((sum, j) => sum + j.statusPieces['No encontrada'], 0).toLocaleString('es-MX');
            createStatusChart('exhibicionChart', 'Encontrada en exhibición', 'rgba(13, 110, 253, 0.8)', dataConRendimiento, 'Top Jefes - En Exhibición');
            createStatusChart('mermaChart', 'Encontrada Merma', 'rgba(255, 193, 7, 0.8)', dataConRendimiento, 'Top Jefes - En Merma');

            // --- Lógica para Pestaña 3: Tabla de Datos ---
            const tablaContainer = document.querySelector('#tabla');
            const tablaHTML = `
                <h5 class="fw-bold"><i class="bi bi-table me-2"></i>Resumen por Jefatura</h5>
                <div class="table-responsive" style="max-height: 450px;">
                    <table class="table table-striped table-hover table-sm">
                        <thead class="table-dark" style="position: sticky; top: 0;">
                            <tr>
                                <th>Jefatura</th>
                                <th class="text-center">Sí Encontrada</th>
                                <th class="text-center">No Encontrada</th>
                                <th class="text-center">Exhibición</th>
                                <th class="text-center">Merma</th>
                                <th class="text-center">Total Reportes</th>
                                <th class="text-center">Total Piezas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dataConRendimiento.map(item => `
                                <tr>
                                    <td>${item.jefe}</td>
                                    <td class="text-center">${item.statusCounts['Sí encontrada'].toLocaleString('es-MX')}</td>
                                    <td class="text-center">${item.statusCounts['No encontrada'].toLocaleString('es-MX')}</td>
                                    <td class="text-center">${item.statusCounts['Encontrada en exhibición'].toLocaleString('es-MX')}</td>
                                    <td class="text-center">${item.statusCounts['Encontrada Merma'].toLocaleString('es-MX')}</td>
                                    <td class="text-center fw-bold">${item.totalReportes.toLocaleString('es-MX')}</td>
                                    <td class="text-center table-secondary fw-bold">${item.totalPiezas.toLocaleString('es-MX')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            tablaContainer.innerHTML = tablaHTML;
        }
    });
}