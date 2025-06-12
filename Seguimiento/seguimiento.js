"use strict";

// =================================================================
// ARCHIVO: seguimiento.js (Versión Refactorizada y Mejorada)
// LÓGICA PARA LA PÁGINA DE SEGUIMIENTO DE ARTÍCULOS
// =================================================================

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
    authDomain: "loginliverpool.firebaseapp.com",
    projectId: "loginliverpool",
    storageBucket: "loginliverpool.appspot.com",
    messagingSenderId: "704223815941",
    appId: "1:704223815941:web:c871525230fb61caf96f6c"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const storage = firebase.storage();
const db = firebase.firestore();
const auth = firebase.auth();

// ========== ESTADO Y ELEMENTOS DEL DOM ==========
let articlesCache = []; // Caché local para la búsqueda
const UIElements = {
    articleForm: document.getElementById("articleForm"),
    articlesTableBody: document.getElementById("articlesTable"),
    searchInput: document.getElementById("searchInput"),
    previewContainer: document.getElementById("previewContainer"),
    fotoInput: document.getElementById("fotoInput"),
    saveBtn: document.getElementById("saveBtn"),
    downloadExcelBtn: document.getElementById("downloadExcelBtn"),
    photoModal: new bootstrap.Modal(document.getElementById("photoModal")),
    modalImage: document.getElementById("modalImage"),
    logoutBtn: document.getElementById('logout-btn'),
};

// ========== INICIALIZACIÓN ==========
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = "../Login/login.html";
        }
    });
    initEventListeners();
    listenForArticles();
});

// ========== MANEJO DE EVENTOS ==========
function initEventListeners() {
    UIElements.articleForm.addEventListener("submit", saveArticle);
    UIElements.searchInput.addEventListener("input", filterTable);
    UIElements.logoutBtn.addEventListener('click', () => auth.signOut());
    UIElements.downloadExcelBtn.addEventListener('click', downloadExcel);
    UIElements.fotoInput.addEventListener('change', previewImage);
}

// ========== LÓGICA DE FIREBASE Y DATOS ==========

/**
 * Escucha cambios en la colección de artículos en tiempo real.
 */
function listenForArticles() {
    db.collection("articulos").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        articlesCache = []; // Limpiar caché
        UIElements.articlesTableBody.innerHTML = ''; // Limpiar tabla actual
        snapshot.forEach(doc => {
            const article = doc.data();
            articlesCache.push(article);
            renderArticleRow(article, doc.id);
        });
    }, error => {
        console.error("Error escuchando cambios:", error);
        Swal.fire('Error', 'No se pudo conectar para recibir actualizaciones en tiempo real.', 'error');
    });
}

/**
 * Guarda un nuevo artículo o actualiza uno existente.
 * @param {Event} e - Evento del formulario.
 */
async function saveArticle(e) {
    e.preventDefault();
    const sku = document.getElementById("skuInput").value.trim();
    const fotoFile = UIElements.fotoInput.files[0];

    if (!sku) {
        return Swal.fire('Campo Requerido', 'El campo SKU es obligatorio.', 'warning');
    }

    setLoadingButton(true);

    try {
        let fotoUrl = "";
        if (fotoFile) {
            const filePath = `articulos/${Date.now()}_${fotoFile.name}`;
            const fileRef = storage.ref(filePath);
            const snapshot = await fileRef.put(fotoFile);
            fotoUrl = await snapshot.ref.getDownloadURL();
        }

        const articleData = {
            sku,
            cantidad: document.getElementById("cantidadInput").value.trim(),
            jefe: document.getElementById("jefeInput").value.trim(),
            usuario: document.getElementById("usuarioInput").value.trim(),
            status: "enproceso",
            ajuste: document.getElementById("ajusteInput").value.trim(),
            fechaRegistro: new Date().toISOString(),
            fechaFinal: null,
            fotoUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("articulos").add(articleData);

        Swal.fire('¡Éxito!', 'Artículo guardado correctamente.', 'success');
        UIElements.articleForm.reset();
        clearImagePreview();

    } catch (error) {
        console.error("Error al guardar:", error);
        Swal.fire('Error', 'No se pudo guardar el artículo.', 'error');
    } finally {
        setLoadingButton(false);
    }
}

/**
 * Actualiza el estado de un artículo en Firestore.
 * @param {string} docId - ID del documento.
 * @param {string} newStatus - Nuevo estado ('enproceso' o 'terminado').
 */
async function updateArticleStatus(docId, newStatus) {
    const updateData = { status: newStatus };
    if (newStatus === "terminado") {
        updateData.fechaFinal = new Date().toISOString();
    }
    try {
        await db.collection("articulos").doc(docId).update(updateData);
        Swal.fire({ icon: 'success', title: 'Estado actualizado', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el estado.', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
    }
}

/**
 * Elimina un artículo de Firestore y Storage.
 * @param {string} docId - ID del documento.
 * @param {string} fotoUrl - URL de la foto para borrarla de Storage.
 */
async function deleteArticle(docId, fotoUrl) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    });

    if (isConfirmed) {
        try {
            await db.collection("articulos").doc(docId).delete();
            if (fotoUrl) {
                await storage.refFromURL(fotoUrl).delete().catch(err => console.warn("La imagen no se pudo borrar de Storage (quizás ya no existía):", err));
            }
            Swal.fire('¡Eliminado!', 'El artículo ha sido eliminado.', 'success');
        } catch (error) {
            console.error("Error al eliminar:", error);
            Swal.fire('Error', 'No se pudo eliminar el artículo.', 'error');
        }
    }
}

// ========== MANIPULACIÓN DEL DOM Y UI ==========

/**
 * Renderiza o actualiza una fila en la tabla.
 * @param {object} article - Datos del artículo.
 * @param {string} docId - ID del documento en Firestore.
 */
function renderArticleRow(article, docId) {
    const existingRow = document.querySelector(`tr[data-id='${docId}']`);
    const tr = existingRow || document.createElement("tr");
    tr.setAttribute("data-id", docId);

    // Formatear fechas para visualización
    const fechaRegistro = article.fechaRegistro ? new Date(article.fechaRegistro).toLocaleString('es-MX') : '-';
    const fechaFinal = article.fechaFinal ? new Date(article.fechaFinal).toLocaleString('es-MX') : '-';
    
    // Generar HTML de la fila
    tr.innerHTML = `
        <td data-label="SKU">${article.sku}</td>
        <td data-label="Cant.">${article.cantidad}</td>
        <td data-label="Jefe">${article.jefe}</td>
        <td data-label="Usuario">${article.usuario}</td>
        <td data-label="Foto">${article.fotoUrl ? `<img src="${article.fotoUrl}" alt="Foto" class="img-thumbnail">` : 'N/A'}</td>
        <td data-label="Estado"></td>
        <td data-label="Ajuste">${article.ajuste || '-'}</td>
        <td data-label="Registro">${fechaRegistro}</td>
        <td data-label="Final">${fechaFinal}</td>
        <td data-label="Acciones"></td>`;

    // Crear y añadir elementos interactivos
    const statusCell = tr.cells[5];
    const actionsCell = tr.cells[9];
    statusCell.appendChild(createStatusSelect(article.status, docId));
    actionsCell.appendChild(createDeleteButton(docId, article.fotoUrl));
    
    // Añadir listener para ampliar imagen
    const img = tr.querySelector('img');
    if (img) {
        img.addEventListener('click', () => showImageModal(article.fotoUrl));
    }
    
    // Añadir al DOM si es una fila nueva
    if (!existingRow) {
        UIElements.articlesTableBody.prepend(tr);
    }
}

function createStatusSelect(status, docId) {
    const select = document.createElement("select");
    select.className = "form-select form-select-sm status-select";
    select.innerHTML = `
        <option value="enproceso" ${status === "enproceso" ? "selected" : ""}>En Proceso</option>
        <option value="terminado" ${status === "terminado" ? "selected" : ""}>Terminado</option>`;
    select.disabled = status === "terminado";
    select.addEventListener("change", (e) => updateArticleStatus(docId, e.target.value));
    return select;
}

function createDeleteButton(docId, fotoUrl) {
    const button = document.createElement("button");
    button.className = "btn btn-danger btn-sm";
    button.innerHTML = '<i class="bi bi-trash"></i>';
    button.addEventListener("click", () => deleteArticle(docId, fotoUrl));
    return button;
}

function filterTable() {
    const filter = UIElements.searchInput.value.toLowerCase();
    const rows = UIElements.articlesTableBody.getElementsByTagName("tr");
    Array.from(rows).forEach(row => {
        const jefeCell = row.cells[2];
        if (jefeCell) {
            row.style.display = jefeCell.textContent.toLowerCase().includes(filter) ? "" : "none";
        }
    });
}

function setLoadingButton(isLoading) {
    if (isLoading) {
        UIElements.saveBtn.disabled = true;
        UIElements.saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;
    } else {
        UIElements.saveBtn.disabled = false;
        UIElements.saveBtn.innerHTML = `<i class="bi bi-save me-2"></i> Guardar Artículo`;
    }
}

function previewImage() {
    const file = UIElements.fotoInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            UIElements.previewContainer.innerHTML = `<img src="${e.target.result}" class="img-thumbnail mt-2" width="150" alt="Vista previa"/>`;
        };
        reader.readAsDataURL(file);
    }
}

function clearImagePreview() {
    UIElements.previewContainer.innerHTML = "";
}

function showImageModal(url) {
    UIElements.modalImage.src = url;
    UIElements.photoModal.show();
}

// ========== FUNCIONALIDAD DE EXCEL ==========
function downloadExcel() {
    if (articlesCache.length === 0) {
        return Swal.fire('Sin Datos', 'No hay artículos para exportar.', 'info');
    }
    const dataToExport = articlesCache.map(article => ({
        SKU: article.sku,
        Cantidad: article.cantidad,
        Jefe: article.jefe,
        Usuario: article.usuario,
        Estado: article.status,
        Ajuste: article.ajuste,
        'Fecha de Registro': article.fechaRegistro ? new Date(article.fechaRegistro).toLocaleString('es-MX') : '-',
        'Fecha de Finalización': article.fechaFinal ? new Date(article.fechaFinal).toLocaleString('es-MX') : '-',
        'URL de Foto': article.fotoUrl
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Seguimiento");
    XLSX.writeFile(workbook, "Seguimiento_Articulos.xlsx");
}