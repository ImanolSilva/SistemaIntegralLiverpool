// ---------- FIREBASE CONFIGURACIÓN ----------
const firebaseConfig = {
    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
    authDomain: "loginliverpool.firebaseapp.com",
    projectId: "loginliverpool",
    storageBucket: "loginliverpool.appspot.com",
    messagingSenderId: "704223815941",
    appId: "1:704223815941:web:c871525230fb61caf96f6c",
    measurementId: "G-QFEPQ4TSPY"
};

// Initialize Firebase only if it hasn't been initialized already
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");

// 2. CONSTANTES Y REFERENCIAS
const MASTER_FILES_PATH = 'Entregas/ArchivosMaestros/';
const bodegaInput = document.getElementById('bodegaInput');
const containerInput = document.getElementById('containerInput');
const jefeInfoBox = document.getElementById('jefeInfoBox');
const progressBtn = document.getElementById('progressBtn');
const summaryBtn = document.getElementById('summaryBtn');
const logArea = document.getElementById('logArea');
const appContainer = document.getElementById('app-container');
const errorContainer = document.getElementById('error-container');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailSpan = document.getElementById('userEmail'); // Correctly referenced from offcanvas-footer
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');

// Modales (ensure these are correctly referenced from the HTML)
const progressModal = document.getElementById('progressModal');
const summaryModal = document.getElementById('summaryModal');
const fileSelectModal = document.getElementById('fileSelectModal');

// Elements inside modals
const closeModalBtns = document.querySelectorAll('.close-button');
const fileListUl = document.getElementById('fileList'); // For progressModal
const summaryFileListUl = document.getElementById('summaryFileList'); // For fileSelectModal
const jefeFilter = document.getElementById('jefeFilter');
const seccionFilter = document.getElementById('seccionFilter');
const dashboardContent = document.getElementById('dashboardContent');
const summaryGlobalStats = document.getElementById('summaryGlobalStats');
const summaryModalTitle = document.getElementById('summaryModalTitle');


// 3. VARIABLES GLOBALES
let currentUser = null;
let bodegaRelations = [];
let containerFiles = []; // Stores StorageReference objects
let dashboardData = new Map(); // Stores processed data for the dashboard

// 4. LÓGICA DE AUTENTICACIÓN Y ARRANQUE
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        appContainer.style.display = 'flex';
        errorContainer.style.display = 'none';
        if (userEmailSpan) userEmailSpan.textContent = `Usuario: ${currentUser.email}`;
        await initializeAppData();
    } else {
        currentUser = null;
        appContainer.style.display = 'none';
        errorContainer.style.display = 'block';
        if (userEmailSpan) userEmailSpan.textContent = `Usuario: No Autenticado`; // Clear or set default
    }
});

logoutBtn.addEventListener('click', () => auth.signOut());

// 5. LÓGICA DE LA APLICACIÓN
async function initializeAppData() {
    try {
        logToScreen("Inicializando sistema...");
        const [bodegasLoaded, filesListed] = await Promise.all([
            loadValidBodegas(),
            listContainerFiles()
        ]);

        if (bodegasLoaded) {
            bodegaInput.disabled = false;
            progressBtn.disabled = false;
            summaryBtn.disabled = false;
            bodegaInput.focus();
            if (filesListed) {
                logToScreen("Sistema listo. Ingrese el ID de la bodega.");
            }
        } else {
            throw new Error("No se pudieron cargar los datos de las bodegas.");
        }
    } catch (error) {
        logToScreen(`FATAL: ${error.message}`);
        console.error("Initialization error:", error);
    }
}

async function loadValidBodegas() {
    try {
        const url = await storage.ref('BodegasRelacion/RelacionBodegas.xlsx').getDownloadURL();
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se encontró el archivo Excel de bodegas.');
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = 'Bodegas';
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error(`No se encontró la hoja "${sheetName}".`);
        
        bodegaRelations = XLSX.utils.sheet_to_json(worksheet).map(row => ({
            Bodega: String(row['Bodega'] || '').trim().toUpperCase(),
            Jefatura: String(row['Jefatura'] || '').trim(),
            Seccion: String(row['Seccion'] || '').trim()
        }));

        if (bodegaRelations.length === 0) throw new Error("No se encontraron relaciones válidas.");
        logToScreen(`✔️ ${bodegaRelations.length} relaciones Bodega-Jefe-Sección cargadas.`);
        return true;
    } catch (error) {
        console.error("Error cargando relaciones:", error);
        logToScreen(`ERROR: ${error.message}`);
        return false;
    }
}

async function listContainerFiles() {
    try {
        const res = await storage.ref(MASTER_FILES_PATH).listAll();
        containerFiles = res.items; // Store file references
        if (containerFiles.length === 0) {
            logToScreen("ADVERTENCIA: No hay archivos de tarimas. Arrastra uno para empezar.");
            return false;
        }
        logToScreen(`✔️ ${containerFiles.length} archivos maestros listos.`);
        return true;
    } catch (error) {
        console.error("Error listando archivos:", error);
        logToScreen("ERROR: No se pudo acceder a los archivos maestros.");
        return false;
    }
}

// LÓGICA DE DRAG & DROP
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handleFileUpload(files);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFileUpload(fileInput.files); });

async function handleFileUpload(files) {
    if (!currentUser) {
        Swal.fire({ icon: 'error', title: 'Error de Autenticación', text: 'Debes iniciar sesión para subir archivos.' });
        return;
    }
    logToScreen(`Procesando ${files.length} archivo(s)...`);
    try {
        logToScreen("Iniciando proceso de limpieza y carga...");
        const deletionPromises = Array.from(files).map(file => deletePreviousEntriesForFile(file.name));
        await Promise.all(deletionPromises);
        logToScreen(`Subiendo ${files.length} archivo(s)...`);
        const uploadPromises = Array.from(files).map(file => {
            const fileRef = storage.ref(`${MASTER_FILES_PATH}${file.name}`);
            return fileRef.put(file);
        });
        await Promise.all(uploadPromises);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '¡Archivos cargados!', showConfirmButton: false, timer: 3000, timerProgressBar: true });
        fileInput.value = ''; // Clear the file input
        await listContainerFiles(); // Refresh the list of container files
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error en la Carga', text: 'No se pudieron subir los archivos.' });
        console.error("Error de carga o limpieza:", error);
    }
}

async function deletePreviousEntriesForFile(fileName) {
    logToScreen(`🧹 Limpiando registros antiguos para ${fileName}...`);
    const q = db.collection("entregasContenedores").where("archivoOrigen", "==", fileName);
    try {
        const querySnapshot = await q.get();
        if (querySnapshot.empty) return logToScreen(`No hay registros antiguos para ${fileName}.`);
        const batch = db.batch();
        querySnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        logToScreen(`✔️ ${querySnapshot.size} registro(s) antiguo(s) eliminado(s).`);
    } catch (error) {
        console.error(`Error al eliminar registros para ${fileName}:`, error);
        logToScreen(`🔥 ERROR: No se pudieron limpiar los registros antiguos.`);
        throw error; // Re-throw to propagate the error
    }
}

bodegaInput.addEventListener('change', () => {
    const bodegaId = bodegaInput.value.trim().toUpperCase();
    containerInput.disabled = true;
    jefeInfoBox.style.display = 'none';
    if (bodegaId.length === 0) {
        logToScreen("Ingrese un ID de bodega.");
        return;
    }

    const potentialJefes = [...new Set(bodegaRelations.filter(r => r.Bodega === bodegaId).map(r => r.Jefatura))];

    if (potentialJefes.length > 0) {
        jefeInfoBox.textContent = `Esta bodega pertenece a: ${potentialJefes.join(', ')}`;
        jefeInfoBox.style.display = 'block';
        logToScreen(`Bodega ${bodegaId} válida.`);
        containerInput.disabled = false;
        containerInput.focus();
    } else {
        logToScreen(`❌ ERROR: Bodega "${bodegaId}" no es válida.`);
        Swal.fire({
            icon: 'error',
            title: 'Bodega Inválida',
            text: `El ID de bodega "${bodegaId}" no está registrado o no tiene relaciones válidas.`
        });
        bodegaInput.select(); // Keep input selected for easy correction
    }
});

containerInput.addEventListener('input', () => {
    // Only trigger if a certain length is reached and input is enabled
    if (containerInput.value.trim().length >= 9 && !containerInput.disabled) {
        handleRegisterDelivery();
    }
});

async function handleRegisterDelivery() {
    const bodegaId = bodegaInput.value.trim().toUpperCase();
    const containerId = containerInput.value.trim().toUpperCase();

    if (!currentUser || bodegaId.length === 0 || containerId.length === 0) {
        logToScreen("ERROR: Asegúrese de que la bodega y el contenedor estén ingresados y haya iniciado sesión.");
        Swal.fire({
            icon: 'warning',
            title: 'Datos Incompletos',
            text: 'Por favor, ingrese el ID de la bodega y el contenedor.'
        });
        return;
    }

    // Disable input while processing to prevent multiple submissions
    containerInput.disabled = true;

    try {
        // 1. Check if container is already delivered
        const q = db.collection("entregasContenedores").where("contenedor", "==", containerId).limit(1);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data();
            Swal.fire({
                iconHtml: '<i class="bi bi-info-circle-fill text-warning fs-1"></i>',
                customClass: {
                    icon: 'no-border-outline' // Optional: remove outline around custom icon
                },
                title: 'Contenedor ya Entregado',
                html: `<ul class="list-group list-group-flush text-start mt-3">
                            <li class="list-group-item"><strong>Bodega:</strong> ${docData.bodega}</li>
                            <li class="list-group-item"><strong>Sección:</strong> ${docData.seccion}</li>
                            <li class="list-group-item"><strong>Jefe Responsable:</strong> ${docData.jefe}</li>
                            <li class="list-group-item"><strong>Entregado por:</strong> ${docData.usuario}</li>
                            <li class="list-group-item"><strong>Fecha:</strong> ${docData.fechaHora.toDate().toLocaleString('es-MX')}</li>
                        </ul>`,
                confirmButtonText: 'Entendido'
            });
            return; // Exit function as container is already processed
        }

        // 2. Find container in master files
        logToScreen(`🔎 Buscando ${containerId}...`);
        const result = await findContainerInFiles(containerId);

        if (!result) {
            logToScreen(`❌ ERROR: Contenedor ${containerId} NO ENCONTRADO en los archivos maestros.`);
            Swal.fire({ icon: 'error', title: 'Contenedor No Encontrado', text: `El contenedor "${containerId}" no se encontró en ningún archivo maestro cargado.` });
            return;
        }

        const seccionContenedor = String(result.row['SECCION'] || '').trim();
        if (!seccionContenedor) {
            logToScreen(`❌ ERROR: El contenedor ${containerId} no tiene una "SECCION" definida en su archivo maestro.`);
            Swal.fire({ icon: 'error', title: 'Sección Faltante', text: `El contenedor "${containerId}" no tiene una sección válida en el archivo maestro "${result.archivo}".` });
            return;
        }

        // 3. Validate bodega and section relationship
        const finalRelation = bodegaRelations.find(r => r.Bodega === bodegaId && r.Seccion === seccionContenedor);

        if (!finalRelation) {
            const validSectionsForBodega = bodegaRelations.filter(r => r.Bodega === bodegaId);
            const sectionsInfo = validSectionsForBodega.map(r => `Sección ${r.Seccion} (Jefe: ${r.Jefatura})`).join(', ');
            logToScreen(`❌ ERROR: La Sección "${seccionContenedor}" no corresponde a la Bodega "${bodegaId}".`);
            Swal.fire({
                icon: 'error',
                title: 'Sección Incorrecta para Bodega',
                html: `La sección "${seccionContenedor}" del contenedor no es válida para la bodega "${bodegaId}".<br><br>
                       ${sectionsInfo ? `Secciones válidas para esta bodega: ${sectionsInfo}.` : 'No se encontraron secciones válidas para esta bodega.'}`
            });
            return;
        }

        const jefeFinal = finalRelation.Jefatura;
        const fechaHoraEntrega = new Date();
        logToScreen(`Jefe definitivo: ${jefeFinal}`);

        // 4. Record delivery in Firestore
        const recordData = { 
            contenedor: String(result.row['CONTENEDOR']).toUpperCase(), 
            tarima: result.row['TARIMA'] || '', 
            manifiesto: result.row['MANIFIESTO'] || '', 
            seccion: seccionContenedor 
        };
        const deliveryRecord = { 
            ...recordData, 
            bodega: bodegaId, 
            jefe: jefeFinal, 
            usuario: currentUser.email, 
            fechaHora: firebase.firestore.Timestamp.fromDate(fechaHoraEntrega), // Store as Timestamp
            archivoOrigen: result.archivo 
        };
        await db.collection("entregasContenedores").add(deliveryRecord);
        logToScreen(`✅ Registrado: ${containerId} -> ${bodegaId}`);

        // 5. Update master Excel file in Storage
        logToScreen(`🔄 Actualizando archivo: ${result.archivo}...`);
        const actualizado = await actualizarArchivoMaestro(result.row, result.archivo, bodegaId, currentUser.email, fechaHoraEntrega);
        if (actualizado) {
            logToScreen(`✔️ Archivo actualizado.`);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '¡Entrega registrada!', showConfirmButton: false, timer: 2000, timerProgressBar: true });
        } else {
            Swal.fire({ icon: 'warning', title: 'Advertencia', text: `El contenedor se registró, pero no se pudo actualizar el archivo maestro "${result.archivo}".` });
        }

    } catch (error) {
        logToScreen("🔥 ERROR: Problema inesperado durante el registro.");
        console.error("Error en handleRegisterDelivery:", error);
        Swal.fire({ icon: 'error', title: 'Error de Registro', text: `Ocurrió un error al intentar registrar la entrega: ${error.message}` });
    } finally {
        // Always reset and re-enable input
        containerInput.value = '';
        containerInput.disabled = false;
        containerInput.focus();
    }
}

async function findContainerInFiles(containerId) {
    for (const fileRef of containerFiles) {
        try {
            const url = await fileRef.getDownloadURL();
            const response = await fetch(url);
            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            // Assuming the first sheet is always the one with data
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            for (const row of jsonData) {
                // Ensure 'CONTENEDOR' key exists and match case-insensitively
                if (row['CONTENEDOR'] && String(row['CONTENEDOR']).toUpperCase() === containerId) {
                    return { row: row, archivo: fileRef.name };
                }
            }
        } catch (error) { 
            console.warn(`No se pudo procesar ${fileRef.name}. Posiblemente no es un archivo Excel válido o está corrupto.`, error);
            logToScreen(`ADVERTENCIA: No se pudo leer ${fileRef.name}.`);
        }
    }
    return null; // Container not found in any file
}

async function actualizarArchivoMaestro(deliveredRow, fileName, bodegaId, responsableEmail, fechaHora) {
    const fileRef = storage.ref(`${MASTER_FILES_PATH}${fileName}`);
    try {
        // Get initial metadata to check for concurrency issues later
        let initialMetadata;
        try {
            initialMetadata = await fileRef.getMetadata();
        } catch (metaError) {
            if (metaError.code === 'storage/object-not-found') {
                logToScreen(`ADVERTENCIA: El archivo "${fileName}" no existe en Storage. Procediendo a crear uno nuevo si es el caso.`);
                // If file doesn't exist, proceed and create it later (this path is less common for "updating" a master file)
            } else {
                throw metaError;
            }
        }

        const url = await fileRef.getDownloadURL();
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        // Add default columns if they don't exist in the first row
        if (jsonData.length > 0) {
            const firstRow = jsonData[0];
            const hasEstatus = firstRow.hasOwnProperty('Estatus');
            const hasBodegaEntrega = firstRow.hasOwnProperty('Bodega_Entrega');
            const hasResponsableEntrega = firstRow.hasOwnProperty('Responsable_Entrega');
            const hasFechaHoraEntrega = firstRow.hasOwnProperty('Fecha_Hora_Entrega');

            if (!hasEstatus || !hasBodegaEntrega || !hasResponsableEntrega || !hasFechaHoraEntrega) {
                jsonData = jsonData.map(row => ({
                    ...row,
                    'Estatus': row['Estatus'] || 'NO ENTREGADO',
                    'Bodega_Entrega': row['Bodega_Entrega'] || '',
                    'Responsable_Entrega': row['Responsable_Entrega'] || '',
                    'Fecha_Hora_Entrega': row['Fecha_Hora_Entrega'] || ''
                }));
            }
        } else {
            // Handle case where file is empty but exists - this might indicate an issue with the master file itself
            logToScreen(`ADVERTENCIA: El archivo "${fileName}" está vacío.`);
            return false;
        }

        const containerIdToUpdate = String(deliveredRow['CONTENEDOR']).toUpperCase();
        let updated = false;

        jsonData = jsonData.map(row => {
            if (String(row['CONTENEDOR'] || '').toUpperCase() === containerIdToUpdate) {
                row['Estatus'] = 'ENTREGADO';
                row['Bodega_Entrega'] = bodegaId;
                row['Responsable_Entrega'] = responsableEmail;
                row['Fecha_Hora_Entrega'] = fechaHora.toLocaleString('es-MX');
                updated = true;
            }
            return row;
        });

        if (!updated) {
            logToScreen(`ADVERTENCIA: Contenedor ${containerIdToUpdate} no encontrado en el archivo "${fileName}" durante la actualización.`);
            return false;
        }

        const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Hoja1');
        
        // Check for concurrency before uploading
        if (initialMetadata) {
            const currentMetadata = await fileRef.getMetadata();
            // Compare the 'updated' timestamp to detect if the file was modified by another user
            if (initialMetadata.updated !== currentMetadata.updated) {
                logToScreen("‼️ ERROR DE CONCURRENCIA: El archivo fue modificado por otra persona. Tu cambio no se guardó en el archivo. ¡Registra el contenedor de nuevo!");
                Swal.fire({
                    icon: 'warning',
                    title: 'Conflicto de Edición',
                    text: `El archivo "${fileName}" fue modificado mientras lo procesabas. El estado del contenedor se guardó en la base de datos, pero el archivo maestro no se pudo actualizar. Por favor, vuelve a registrar el contenedor si deseas actualizar el archivo.`
                });
                return false; // Indicate that the file was not updated successfully due to concurrency
            }
        }

        const newExcelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
        await fileRef.put(new Blob([newExcelBuffer]));
        return true;
    } catch (error) {
        console.error("Error al actualizar archivo maestro:", error);
        logToScreen(`🔥 ERROR: No se pudo actualizar el archivo ${fileName}.`);
        return false;
    }
}


function resetInputs(clearBodega = true) {
    if (clearBodega) {
        bodegaInput.value = '';
        jefeInfoBox.style.display = 'none';
    }
    containerInput.value = '';
    containerInput.disabled = !clearBodega;
    if (clearBodega) bodegaInput.focus();
    else containerInput.focus();
}

const greenFill = { fgColor: { rgb: "C6EFCE" } };
const redFill = { fgColor: { rgb: "FFC7CE" } };

function applyRowStyles(worksheet, jsonData) {
    const headers = Object.keys(jsonData[0] || {}); // Get headers safely
    jsonData.forEach((row, rowIndex) => {
        if (row.hasOwnProperty('Estatus')) {
            const style = row['Estatus'] === 'ENTREGADO' ? { fill: greenFill } : { fill: redFill };
            headers.forEach((_, colIndex) => {
                const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex }); // +1 for 0-indexed to 1-indexed row in Excel
                if (worksheet[cellAddress]) {
                    if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {}; // Ensure style object exists
                    Object.assign(worksheet[cellAddress].s, style); // Apply fill style
                }
            });
        }
    });
}

async function handleDeleteFile(fileName) {
    const result = await Swal.fire({
        title: `¿Eliminar "${fileName}"?`,
        text: "Esta acción es irreversible y borrará el archivo y todos sus registros de entregas en la base de datos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, ¡eliminar!',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    logToScreen(`Eliminando ${fileName}...`);
    try {
        await deletePreviousEntriesForFile(fileName); // Delete related database entries first
        await storage.ref(`${MASTER_FILES_PATH}${fileName}`).delete(); // Then delete the file
        Swal.fire('¡Eliminado!', `El archivo ${fileName} ha sido eliminado.`, 'success');
        await listContainerFiles(); // Refresh the file list
        populateProgressModal(); // Update the progress modal
    } catch (error) {
        Swal.fire('Error', `No se pudo eliminar ${fileName}. Error: ${error.message}`, 'error');
        console.error("Error de eliminación:", error);
        logToScreen(`ERROR al eliminar ${fileName}: ${error.message}`);
    }
}

function populateProgressModal() {
    if (!fileListUl) {
        console.error("fileListUl not found.");
        return;
    }
    fileListUl.innerHTML = ''; // Clear previous list
    if (containerFiles.length === 0) {
        fileListUl.innerHTML = '<li class="list-group-item">No hay archivos maestros cargados.</li>';
    } else {
        containerFiles.forEach(fileRef => {
            const li = document.createElement('li');
            li.className = 'list-group-item file-list-item';

            const span = document.createElement('span');
            span.className = 'file-name';
            span.textContent = fileRef.name;
            span.onclick = async () => {
                logToScreen(`Preparando descarga de ${fileRef.name}...`);
                try {
                    const url = await fileRef.getDownloadURL();
                    const response = await fetch(url);
                    const data = await response.arrayBuffer();
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    
                    let jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // Add Jefe_Responsable column based on Bodega_Entrega and SECCION
                    jsonData = jsonData.map(row => {
                        const bodegaEntrega = String(row['Bodega_Entrega'] || '').trim().toUpperCase();
                        const seccion = String(row['SECCION'] || '').trim();
                        const finalRelation = bodegaRelations.find(r => r.Bodega === bodegaEntrega && r.Seccion === seccion);
                        return { ...row, "Jefe_Responsable": finalRelation ? finalRelation.Jefatura : 'N/A' };
                    });

                    const newWorksheet = XLSX.utils.json_to_sheet(jsonData);
                    applyRowStyles(newWorksheet, jsonData); // Apply colors based on Estatus

                    const newWorkbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Hoja1');
                    XLSX.writeFile(newWorkbook, `AVANCE_${fileRef.name}`);
                    logToScreen(`✔️ ${fileRef.name} descargado.`);
                } catch(e) {
                    logToScreen(`🔥 ERROR al descargar o procesar ${fileRef.name}.`);
                    console.error(e);
                    Swal.fire('Error de Descarga', `No se pudo descargar o procesar el archivo ${fileRef.name}.`, 'error');
                }
                progressModal.style.display = 'none'; // Close modal after download attempt
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-outline-danger delete-btn';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteBtn.title = `Eliminar ${fileRef.name}`;
            deleteBtn.onclick = () => handleDeleteFile(fileRef.name);

            li.appendChild(span);
            li.appendChild(deleteBtn);
            fileListUl.appendChild(li);
        });
    }
}

// Event listener for Progress Button (Gestionar Archivos)
if (progressBtn) {
    progressBtn.addEventListener('click', async () => {
        await listContainerFiles(); // Ensure file list is up-to-date
        populateProgressModal(); // Populate the modal with current files
        progressModal.style.display = 'flex'; // Show the modal
    });
}


// --- LÓGICA DEL DASHBOARD DE RESUMEN ---
async function generateSummaryData(fileRef) {
    let allContainers = [];
    try {
        const url = await fileRef.getDownloadURL();
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        allContainers = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    } catch (e) {
        console.warn(`No se pudo procesar ${fileRef.name} para el resumen.`, e);
        logToScreen(`ADVERTENCIA: No se pudo leer el archivo ${fileRef.name} para el resumen.`);
        return null;
    }
    
    dashboardData = new Map(); // Reset global dashboard data

    // Populate dashboardData structure
    allContainers.forEach(container => {
        const seccion = String(container.SECCION || '').trim();
        const relation = bodegaRelations.find(r => r.Seccion === seccion);

        if (relation) {
            const jefe = relation.Jefatura;
            // Initialize map for jefe if it doesn't exist
            if (!dashboardData.has(jefe)) {
                dashboardData.set(jefe, new Map());
            }
            // Initialize map for section if it doesn't exist for this jefe
            if (!dashboardData.get(jefe).has(seccion)) {
                dashboardData.get(jefe).set(seccion, { entregados: [], pendientes: [] });
            }

            const containerData = { 
                id: String(container.CONTENEDOR || '').toUpperCase(), 
                bodega: String(container.Bodega_Entrega || '').toUpperCase() // Include bodega info for dashboard detail
            };

            // Categorize based on 'Estatus' (or lack thereof, assuming pending if no status or not 'ENTREGADO')
            if (String(container.Estatus || '').toUpperCase() === 'ENTREGADO') {
                dashboardData.get(jefe).get(seccion).entregados.push(containerData);
            } else {
                dashboardData.get(jefe).get(seccion).pendientes.push(containerData); // Keep full containerData for pending too
            }
        }
    });
    return allContainers.length; // Return total number of containers processed
}

// --- DASHBOARD ÉPICO Y ALERTA MINI ---
function renderDashboard(jefeF = '', seccionF = '') {
    if (!dashboardContent) {
        console.error("dashboardContent not found.");
        return;
    }
    dashboardContent.innerHTML = '';
    let totalEntregados = 0;
    let totalPendientes = 0;
    
    // Iterate through dashboardData to render cards
    dashboardData.forEach((sections, jefe) => {
        // Apply jefe filter
        if (jefeF && jefe !== jefeF) return;

        sections.forEach((data, section) => {
            // Apply section filter
            if (seccionF && section !== seccionF) return;

            const card = createSectionCard(jefe, section, data);
            if (card) {
                dashboardContent.appendChild(card);
                totalEntregados += data.entregados.length;
                totalPendientes += data.pendientes.length;
            }
        });
    });

    // Update global stats display
    const totalGlobal = totalEntregados + totalPendientes;
    const globalPerc = totalGlobal > 0 ? (totalEntregados / totalGlobal) * 100 : 0;

    let alertMsg, alertColor;
    if (globalPerc === 100) {
        alertMsg = '¡Meta Cumplida! 🏆';
        alertColor = 'var(--verde-completo)';
    } else if (globalPerc >= 75) {
        alertMsg = '¡Recta final! 🚀';
        alertColor = 'var(--naranja-aviso)';
    } else if (globalPerc >= 50) {
        alertMsg = 'Buen ritmo 💪';
        alertColor = 'var(--rosa-principal)';
    } else if (globalPerc > 0) {
        alertMsg = '¡Vamos equipo! ⚡️';
        alertColor = 'var(--rosa-principal)'; // Still encouraging
    } else {
        alertMsg = 'Aún no hay progreso';
        alertColor = 'var(--texto-secundario)'; // Grey for no progress
    }

    if (summaryGlobalStats) {
        summaryGlobalStats.innerHTML = `
            <div class="epic-alert-mini" style="color:${alertColor};border-left-color:${alertColor};background:${alertColor}20;">
                <i class="bi bi-lightning-charge-fill me-2"></i>${alertMsg}
            </div>
            <div class="d-flex justify-content-center gap-4 align-items-center flex-wrap mt-3">
                <div>
                    <div class="epic-stat-number">${totalEntregados}</div>
                    <div class="epic-stat-label">Entregados</div>
                </div>
                <div>
                    <div class="epic-stat-number text-danger">${totalPendientes}</div>
                    <div class="epic-stat-label">Pendientes</div>
                </div>
                <div>
                    <div class="epic-stat-number" style="color:var(--rosa-principal)">${totalGlobal}</div>
                    <div class="epic-stat-label">Total</div>
                </div>
            </div>
        `;
    }
}

function createSectionCard(jefe, section, data) {
    const total = data.entregados.length + data.pendientes.length;
    if (total === 0) return null; // Don't create card if no containers for this section

    const percentage = total > 0 ? (data.entregados.length / total) * 100 : 0;
    const isCompleted = percentage === 100;
    const progressColor = isCompleted ? 'var(--verde-completo)' : 'var(--rosa-principal)';
    const bgColor = isCompleted ? '#e7ffef' : '#fff'; // Lighter background for completed

    const card = document.createElement('div');
    card.className = `col`; // Bootstrap column
    card.innerHTML = `
        <div class="dashboard-card-epic" style="border-color:${progressColor}; background-color:${bgColor};">
            <div class="d-flex align-items-center justify-content-between">
                <div class="card-title h6 mb-0">${jefe} <span class="fw-normal text-muted">- Sección ${section}</span></div>
                <span style="font-size:1.4em;">${isCompleted ? '🏆' : percentage >= 75 ? '🚀' : percentage >= 50 ? '⚡️' : '⏳'}</span>
            </div>
            <div class="d-flex align-items-center gap-3 mt-2">
                <svg width="40" height="40" viewbox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" stroke-width="3"/>
                    <circle cx="18" cy="18" r="16" fill="none"
                        stroke="${progressColor}" stroke-width="3"
                        stroke-dasharray="${2 * Math.PI * 16}"
                        stroke-dashoffset="${2 * Math.PI * 16 * (1-percentage/100)}"
                        stroke-linecap="round"
                        style="transition:stroke-dashoffset 0.8s; transform: rotate(-90deg); transform-origin: center;" />
                    <text x="18" y="22" text-anchor="middle" font-size="0.7em" fill="${progressColor}" font-weight="700">${Math.round(percentage)}%</text>
                </svg>
                <div>
                    <div class="card-text"><strong>${data.entregados.length}</strong> / ${total} entregados</div>
                    <div style="color:${progressColor};font-weight:700;font-size:.9em;">${isCompleted ? '¡Completado!' : `${data.pendientes.length} Pendiente(s)`}</div>
                </div>
            </div>
            <details class="mt-2">
                <summary style="cursor:pointer;color:var(--rosa-principal);font-weight:600;font-size:.93em;">Ver detalle</summary>
                ${data.entregados.length > 0 ? `<div class="cont-list-title"><i class="bi bi-box-seam cont-ent"></i> Entregados:</div>
                    <div class="cont-list" style="font-size:.90em;word-break:break-all;">${data.entregados.map(c=>`<span class="cont-ent">${c.id}${c.bodega ? ` (${c.bodega})` : ''}</span>`).join(', ')}</div>` : ""}
                ${data.pendientes.length > 0 ? `<div class="cont-list-title"><i class="bi bi-exclamation-diamond cont-pend"></i> Pendientes:</div>
                    <div class="cont-list" style="font-size:.90em;word-break:break-all;">${data.pendientes.map(c=>`<span class="cont-pend">${c.id}</span>`).join(', ')}</div>` : ""}
            </details>
        </div>
    `;
    return card;
}

function populateSelect(selectElement, options, placeholder) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectElement.appendChild(option);
    });
}

async function selectFileForSummary(fileRef) {
    if (!fileSelectModal || !summaryModal || !summaryModalTitle) {
        console.error("One or more summary modal elements not found.");
        return;
    }

    fileSelectModal.style.display = 'none'; // Close file selection modal
    logToScreen(`Generando resumen para ${fileRef.name}...`);
    summaryModalTitle.textContent = `Resumen de Avance: ${fileRef.name}`;
    
    const totalContainers = await generateSummaryData(fileRef);
    
    if (totalContainers === null) {
        Swal.fire('Error', `No se pudo procesar el archivo ${fileRef.name}. Asegúrese de que sea un archivo Excel válido.`, 'error');
        return;
    }
    
    // Populate jefe filter
    const jefes = Array.from(dashboardData.keys()).sort();
    populateSelect(jefeFilter, jefes, '-- Todos los Jefes --');
    
    // Reset and disable section filter
    if (seccionFilter) {
        seccionFilter.innerHTML = '<option value="">-- Todas las Secciones --</option>';
        seccionFilter.disabled = true;
    }
    if (jefeFilter) jefeFilter.value = ''; // Reset jefe filter to default

    renderDashboard(); // Render initial dashboard without filters
    summaryModal.style.display = 'flex'; // Show the summary dashboard modal
    logToScreen(`✔️ Resumen para ${fileRef.name} listo.`);
}

// Event listener for Summary Button
if (summaryBtn) {
    summaryBtn.addEventListener('click', async () => {
        await listContainerFiles(); // Ensure file list is up-to-date
        if (!summaryFileListUl) {
            console.error("summaryFileListUl not found.");
            return;
        }
        summaryFileListUl.innerHTML = ''; // Clear previous list
        if (containerFiles.length === 0) {
            Swal.fire('Sin Archivos', 'Primero debes subir un archivo de tarimas para generar un resumen.', 'info');
            return;
        }

        const fragment = document.createDocumentFragment();
        containerFiles.forEach(fileRef => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.style.cursor = 'pointer';
            li.textContent = fileRef.name;
            li.onclick = () => selectFileForSummary(fileRef); // Pass fileRef directly
            fragment.appendChild(li);
        });
        summaryFileListUl.appendChild(fragment);
        fileSelectModal.style.display = 'flex'; // Show the file selection modal
    });
}

// Event listeners for filters
if (jefeFilter) {
    jefeFilter.addEventListener('change', () => {
        const selectedJefe = jefeFilter.value;
        if (selectedJefe && dashboardData.has(selectedJefe)) {
            const sections = Array.from(dashboardData.get(selectedJefe).keys()).sort();
            populateSelect(seccionFilter, sections, '-- Todas las Secciones --');
            if (seccionFilter) seccionFilter.disabled = false;
        } else {
            if (seccionFilter) {
                seccionFilter.innerHTML = '<option value="">-- Todas las Secciones --</option>';
                seccionFilter.disabled = true;
            }
        }
        if (seccionFilter) seccionFilter.value = ''; // Reset section filter
        renderDashboard(selectedJefe, ''); // Re-render with only jefe filter
    });
}

if (seccionFilter) {
    seccionFilter.addEventListener('change', () => {
        renderDashboard(jefeFilter.value, seccionFilter.value); // Re-render with both filters
    });
}

// --- MODALES ---
function closeAllModals() {
    // Check if modals exist before trying to access style
    if (progressModal) progressModal.style.display = 'none';
    if (summaryModal) summaryModal.style.display = 'none';
    if (fileSelectModal) fileSelectModal.style.display = 'none';
}

// Add event listeners to all close buttons
closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));

// Close modals when clicking outside of them
window.addEventListener('click', (event) => {
    // Check if the clicked target is one of the modal backgrounds
    if (event.target === progressModal || event.target === summaryModal || event.target === fileSelectModal) {
        closeAllModals();
    }
});

function logToScreen(message) {
    if (!logArea) return;
    if (logArea.style.display === 'none') {
        logArea.style.display = 'block';
    }
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toLocaleTimeString('es-MX')}] ${message}`; // Use es-MX for Spanish time format
    logArea.appendChild(logEntry); // Add to bottom
    logArea.scrollTop = logArea.scrollHeight; // Auto-scroll to bottom
}

// Initial calls when script loads (after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
    // This part is handled by auth.onAuthStateChanged.
    // The initial state of appContainer and errorContainer is set there.
});