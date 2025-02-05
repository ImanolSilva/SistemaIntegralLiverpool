/*****************************************************
 *  ========== CONFIGURACIÓN DE FIREBASE ==========
 *****************************************************/
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

const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");
const db = firebase.firestore();
const auth = firebase.auth();

/*****************************************************
 *  ========== VARIABLES GLOBALES ==========
 *****************************************************/
const AppState = {
  relacionesData: null,         // Data de "relaciones.xlsx"
  usuariosData: [],             // Data de "Usuarios.xlsx"
  allRechazosEnExcel: [],       // Todas las filas de "rechazos.xlsx"
  rechazosGlobal: [],           // Filas filtradas para el usuario
  selectedFileData: null,       // Archivo "rechazos" seleccionado
  isAdmin: false                // Indica si el usuario es admin
};

// Lista actualizada de UIDs de administradores
const ADMIN_UIDS = [
  "V3gs0U4nKVeIZHvXEfIiNLXq2Sy1",
  "doxhVo1D3aYQqqkqgRgfJ4qcKcU2",
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2"
];

/*****************************************************
 *  ========== FUNCIONES AUXILIARES ==========
 *****************************************************/
 
function showAlert(icon, title, text) {
  return Swal.fire({ icon, title, text });
}

function setUIForRole(isAdmin) {
  const dropzone = document.getElementById("dropzone");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");
  dropzone.style.display = isAdmin ? "block" : "none";
  if (downloadRechazosBtn) {
    downloadRechazosBtn.style.display = isAdmin ? "inline-block" : "none";
  }
}

function fixEncoding(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

function loadDynamicImage(sku, seccion, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const imageUrl = `https://ss${seccion}.liverpool.com.mx/xl/${sku}.jpg`;
  const funnyImageUrl = "https://michelacosta.com/wp-content/uploads/2017/03/Cristiano-llorando.gif";
  
  const imgElement = document.createElement("img");
  imgElement.alt = "Imagen del artículo";
  imgElement.className = "img-fluid";
  imgElement.style.maxWidth = "200px";
  imgElement.style.display = "none";

  const fallbackElement = document.createElement("div");
  fallbackElement.className = "no-image";
  fallbackElement.style.display = "none";
  fallbackElement.style.textAlign = "center";
  fallbackElement.style.fontWeight = "bold";
  fallbackElement.style.padding = "10px";
  fallbackElement.style.border = "2px dashed #ff4081";
  fallbackElement.style.color = "#ff4081";
  fallbackElement.style.borderRadius = "10px";

  container.appendChild(imgElement);
  container.appendChild(fallbackElement);

  imgElement.src = imageUrl;
  imgElement.onload = function() {
    this.style.display = "block";
    fallbackElement.style.display = "none";
  };

  imgElement.onerror = function() {
    imgElement.style.display = "none";
    fallbackElement.innerHTML = `
      <div>
        <img src="${funnyImageUrl}" alt="Imagen graciosa" style="max-width: 100px; margin-bottom: 10px;">
        <p>¡Ups! No se encontró la imagen original. ¡Mira esto!</p>
      </div>
    `;
    fallbackElement.style.display = "block";
  };
}

async function loadUsuariosFile() {
  try {
    const response = await fetch("../ArchivosExcel/Usuarios.xlsx");
    if (!response.ok) throw new Error("No se encontró Usuarios.xlsx");
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Usuarios"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Usuarios' en Usuarios.xlsx");
        return;
      }
      AppState.usuariosData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar Usuarios.xlsx:", error);
    showAlert("error", "Error", "No se pudo cargar el archivo 'Usuarios.xlsx'");
  }
}

/*****************************************************
 *  ========== EVENTOS DOMContentLoaded ==========
 *****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  const logoutButton = document.getElementById("logout-btn");
  const confirmFileSelection = document.getElementById("confirmFileSelection");
  const dropzone = document.getElementById("dropzone");
  const saveCommentsBtn = document.getElementById("saveCommentsBtn");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");

  logoutButton.addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "../Login/login.html";
    });
  });

  confirmFileSelection.addEventListener("click", () => {
    const selectedFileName = document.getElementById("selectedFileName").textContent;
    if (selectedFileName && AppState.selectedFileData) {
      showAlert("success", "Archivo Confirmado", `El archivo seleccionado es: ${selectedFileName}`);
      if (AppState.isAdmin) {
        loadRechazosFile();
      } else {
        loadRelacionesFile();
      }
    } else {
      showAlert("warning", "Atención", "Debes seleccionar un archivo antes de continuar.");
    }
  });

  saveCommentsBtn.addEventListener("click", saveAllComments);

  dropzone.addEventListener("click", () => {
    if (!AppState.isAdmin) return;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".xlsx, .xls";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      handleFileUpload(file);
    });
    fileInput.click();
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    if (!AppState.isAdmin) return;
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  if (downloadRechazosBtn) {
    downloadRechazosBtn.addEventListener("click", downloadRechazosFile);
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById("correoUsuario").innerText = user.email;
      AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
      console.log(`El usuario actual es ${AppState.isAdmin ? "ADMIN" : "USUARIO normal"}`);
      setUIForRole(AppState.isAdmin);
      await loadUsuariosFile();
      await loadFilesFromFirebase();
    } else {
      document.getElementById("correoUsuario").innerText = "No hay usuario logueado";
      window.location.href = "../Login/login.html";
    }
  });
});

/*****************************************************
 *  ========== FUNCIONES PARA MANEJO DE ARCHIVOS ==========
 *****************************************************/
async function loadFilesFromFirebase() {
  try {
    await showAlert("info", "Cargando archivos...", "Recuperando archivos de Firebase Storage");
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const files = [];
    fileList.items.forEach(item => {
      if (item.name.toLowerCase().includes("rechazos")) {
        const cleanName = item.name.replace(/^\d+/g, "").replace(/_/g, " ").replace(".xlsx", "");
        files.push({ name: cleanName, ref: item });
      }
    });
    if (files.length > 0) {
      renderFileSelectOptions(files);
      showAlert("success", "Archivos cargados", "Se encontraron archivos 'rechazos' en Firebase");
    } else {
      showAlert("warning", "Sin archivos", "No se encontraron archivos de 'rechazos' en Firebase");
    }
  } catch (error) {
    console.error("Error al listar archivos:", error);
    showAlert("error", "Error", "Hubo un problema al cargar archivos de Firebase");
  }
}

function renderFileSelectOptions(files) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";
  files.forEach(file => {
    const fileItem = document.createElement("div");
    fileItem.className = "list-group-item d-flex justify-content-between";
    const fileInfo = document.createElement("div");
    fileInfo.textContent = file.name;
    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-primary btn-sm";
    selectBtn.textContent = "Seleccionar";
    selectBtn.addEventListener("click", () => {
      document.getElementById("selectedFileName").textContent = `Seleccionado: ${file.name}`;
      document.getElementById("confirmFileSelection").disabled = false;
      AppState.selectedFileData = file;
    });
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(selectBtn);
    fileListContainer.appendChild(fileItem);
  });
}

async function downloadPreviousFile() {
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const existingFile = fileList.items.find(item =>
      item.name.toLowerCase().includes("rechazos")
    );
    if (existingFile) {
      const url = await existingFile.getDownloadURL();
      const link = document.createElement("a");
      link.href = url;
      link.download = existingFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await showAlert("success", "Archivo Descargado", "El archivo anterior ha sido descargado.");
    }
  } catch (error) {
    console.error("Error al descargar archivo previo:", error);
    showAlert("error", "Error", "No se pudo descargar el archivo anterior.");
  }
}

async function deletePreviousFile() {
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const existingFile = fileList.items.find(item =>
      item.name.toLowerCase().includes("rechazos")
    );
    if (existingFile) {
      await existingFile.delete();
      console.log("Archivo previo eliminado.");
    }
  } catch (error) {
    console.error("Error al eliminar archivo previo:", error);
  }
}

async function handleFileUpload(file) {
  if (!file || !AppState.isAdmin) return;
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "Esto descargará y eliminará el archivo 'rechazos' anterior.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, subir",
    cancelButtonText: "Cancelar"
  });
  if (result.isConfirmed) {
    try {
      await downloadPreviousFile();
      await showAlert("info", "Subiendo...", "El archivo se está subiendo.");
      await deletePreviousFile();
      const fileRef = storage.ref(`uploads/rechazos.xlsx`);
      await fileRef.put(file);
      await loadFilesFromFirebase();
      window.location.reload();
    } catch (error) {
      console.error("Error en handleFileUpload:", error);
      showAlert("error", "Error", "No se pudo subir el archivo.");
    }
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA CAPTURAR Y SUBIR FOTO ==========
 *****************************************************/
function capturePhoto(rowIndex) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.setAttribute("capture", "environment");
  fileInput.style.display = "none";
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadPhoto(file, rowIndex);
    }
  });
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

async function uploadPhoto(file, rowIndex) {
  try {
    const remision = AppState.rechazosGlobal[rowIndex].Remisión || "sinRemision";
    const timestamp = Date.now();
    const filename = `uploads/evidencias/evidencia_${remision}_${timestamp}.jpg`;
    const storageRef = storage.ref(filename);
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    AppState.rechazosGlobal[rowIndex].Fotos = downloadURL;
    updatePhotoPreview(rowIndex, downloadURL);
    showAlert("success", "Foto guardada", "La foto se ha guardado correctamente.");
  } catch (error) {
    console.error("Error al subir la foto:", error);
    showAlert("error", "Error", "No se pudo subir la foto.");
  }
}

function deletePhoto(rowIndex) {
  // Se actualiza el estado para borrar la URL de la foto y se actualiza la previsualización
  AppState.rechazosGlobal[rowIndex].Fotos = "";
  updatePhotoPreview(rowIndex, "");
  showAlert("success", "Foto eliminada", "La foto se ha eliminado correctamente.");
}

function updatePhotoPreview(rowIndex, url) {
  const previewContainer = document.getElementById(`evidencia-preview-${rowIndex}`);
  if (previewContainer) {
    if (url.trim() !== "") {
      previewContainer.innerHTML = `
        <img src="${url}" alt="Evidencia" class="img-fluid" style="max-width:200px;">
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-secondary cambiar-foto-btn" data-row-index="${rowIndex}">
            <i class="bi bi-camera"></i> Cambiar Foto
          </button>
          <button class="btn btn-sm btn-outline-danger eliminar-foto-btn" data-row-index="${rowIndex}">
            <i class="bi bi-trash"></i> Eliminar Foto
          </button>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <button class="btn btn-outline-primary btn-sm agregar-foto-btn" data-row-index="${rowIndex}">
          <i class="bi bi-camera"></i> Agregar Foto
        </button>
      `;
    }
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA MANEJO DE ARCHIVOS EXCEL ==========
 *****************************************************/
async function loadRelacionesFile() {
  const filePath = "../ArchivosExcel/relaciones.xlsx";
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("No se encontró relaciones.xlsx");
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Usuarios"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Usuarios' en relaciones.xlsx");
        return;
      }
      AppState.relacionesData = XLSX.utils.sheet_to_json(sheet);
      const correoUsuario = auth.currentUser.email;
      const usuarioData = AppState.relacionesData.filter(row => row.Correo === correoUsuario);
      if (usuarioData.length === 0) {
        showAlert("error", "Error", "No se encontró info para este usuario en 'relaciones'.");
        return;
      }
      let secciones = [];
      usuarioData.forEach(row => {
        if (row.Sección) {
          secciones = secciones.concat(row.Sección.toString().split(",").map(s => s.trim()));
        }
        for (let i = 1; i <= 5; i++) {
          if (row[`Sección ${i}`]) {
            secciones = secciones.concat(row[`Sección ${i}`].toString().split(",").map(s => s.trim()));
          }
        }
      });
      secciones = [...new Set(secciones)];
      loadRechazosFile(secciones);
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar relaciones.xlsx:", error);
    showAlert("error", "Error", "No se pudo cargar el archivo 'relaciones.xlsx'");
  }
}

async function loadRechazosFile(secciones) {
  try {
    const archivoRechazos = AppState.selectedFileData.ref;
    if (!archivoRechazos) {
      showAlert("warning", "Archivo no encontrado", "No se encontró el archivo seleccionado en Firebase");
      return;
    }
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets["Rechazos"];
      if (!sheet) {
        showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
        return;
      }
      AppState.allRechazosEnExcel = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      let rechazosFiltrados = AppState.allRechazosEnExcel;
      if (secciones && secciones.length > 0) {
        rechazosFiltrados = AppState.allRechazosEnExcel.filter(row => {
          return secciones.some(seccion =>
            row.Sección && row.Sección.toString().trim() === seccion.toString().trim()
          );
        });
      }
      renderRechazos(rechazosFiltrados);
      if (AppState.isAdmin) {
        renderBossFilter(AppState.allRechazosEnExcel);
      }
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar rechazos.xlsx:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx' desde Firebase");
  }
}

/*****************************************************
 *  ========== FUNCIONES PARA FILTRAR POR JEFE (ADMIN) ==========
 *****************************************************/
function renderBossFilter(allRechazos) {
  let container = document.getElementById("bossFilterContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "bossFilterContainer";
    const rechazosContainer = document.getElementById("rechazosContainer");
    rechazosContainer.parentNode.insertBefore(container, rechazosContainer);
  }
  container.innerHTML = "";
  const jefesUnicos = [...new Set(allRechazos.map(r => r["Jefatura"]).filter(j => j && j.trim() !== ""))];
  const select = document.createElement("select");
  select.className = "form-select mb-3";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todos los Jefes";
  select.appendChild(allOption);
  jefesUnicos.forEach(jefe => {
    const option = document.createElement("option");
    option.value = jefe;
    option.textContent = jefe;
    select.appendChild(option);
  });
  container.appendChild(select);
  select.addEventListener("change", (e) => {
    const selectedJefe = e.target.value;
    let filtrados = AppState.allRechazosEnExcel;
    if (selectedJefe && selectedJefe.trim() !== "") {
      filtrados = AppState.allRechazosEnExcel.filter(row => row["Jefatura"] === selectedJefe);
    }
    renderRechazos(filtrados);
  });
}

/*****************************************************
 *  ========== RENDERIZAR ACORDEÓN ==========
 *****************************************************/
function renderRechazos(rechazosFiltrados) {
  const rechazosContainer = document.getElementById("rechazosContainer");
  rechazosContainer.innerHTML = "";
  AppState.rechazosGlobal = rechazosFiltrados.map((item, index) => ({
    ...item,
    _rowIndex: index,
    Comentarios: item.Comentarios || ""
  }));
  if (AppState.rechazosGlobal.length === 0) {
    rechazosContainer.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle-fill icon-pink"></i>
        No se encontraron rechazos para la selección actual.
      </div>`;
    return;
  }
  const accordion = document.createElement("div");
  accordion.className = "accordion";
  accordion.id = "rechazosAccordion";
  AppState.rechazosGlobal.forEach((rechazo, i) => {
    const fecha = fixEncoding(rechazo["Fecha y Hora de Asignación"] || "");
    const seccion = fixEncoding(rechazo["Sección"] || "");
    const remision = fixEncoding(rechazo["Remisión"] || "");
    const sku = fixEncoding(rechazo["Sku"] || "");
    const descripcionSku = fixEncoding(rechazo["Descripción Sku"] || "");
    const piezas = fixEncoding(rechazo["Piezas"] || "");
    
    let usuarioCode = fixEncoding(rechazo["Usuario de Rechazo"] || "");
    const userCodeNormalized = usuarioCode.trim().toLowerCase();
    let usuarioName = usuarioCode;
    if (AppState.usuariosData && AppState.usuariosData.length > 0) {
      const foundUser = AppState.usuariosData.find(u => {
        return u.Usuarios &&
          u.Usuarios.toString().trim().toLowerCase() === userCodeNormalized;
      });
      if (foundUser && foundUser.Nombre) {
        usuarioName = foundUser.Nombre;
      }
    }
    
    const jefatura = fixEncoding(rechazo["Jefatura"] || "");
    const comentarios = fixEncoding(rechazo["Comentarios"] || "");
    const evidencia = fixEncoding(rechazo["Fotos"] || "");
    const headingId = `heading-${i}`;
    const collapseId = `collapse-${i}`;
    const headerButtonClass = `accordion-button collapsed gap-2 ${comentarios.trim() !== "" ? "has-comment-header" : ""}`;
    const accordionItem = document.createElement("div");
    accordionItem.className = "accordion-item mb-2";
    const header = document.createElement("h2");
    header.className = "accordion-header";
    header.id = headingId;
    header.innerHTML = `
      <button 
        class="${headerButtonClass}" 
        type="button" 
        data-bs-toggle="collapse"
        data-bs-target="#${collapseId}"
        aria-expanded="false"
        aria-controls="${collapseId}"
      >
        <i class="bi bi-file-earmark-text icon-pink"></i>
        <strong>Remisión:</strong> ${remision}
      </button>
    `;
    const collapseDiv = document.createElement("div");
    collapseDiv.id = collapseId;
    collapseDiv.className = "accordion-collapse collapse";
    collapseDiv.setAttribute("aria-labelledby", headingId);
    const body = document.createElement("div");
    body.className = "accordion-body";
    const searchUrl = `https://www.liverpool.com.mx/tienda?s=${sku}`;
    const googleSearchUrl = `https://www.google.com/search?q=site:liverpool.com.mx+${sku}`;
    const textareaClass = comentarios.trim() !== ""
      ? "form-control comentario-input has-comment"
      : "form-control comentario-input";
    body.innerHTML = `
      <div class="mb-2 text-muted">
        <i class="bi bi-calendar2 icon-pink"></i> <strong>Fecha:</strong> ${fecha}
      </div>
      <p class="mb-2">
        <i class="bi bi-diagram-2 icon-pink"></i>
        <strong>Sección:</strong> ${seccion} <br>
        <i class="bi bi-tags icon-pink"></i>
        <strong>SKU:</strong> ${sku} <br>
        <i class="bi bi-card-text icon-pink"></i>
        <strong>Descripción SKU:</strong> ${descripcionSku} <br>
        <i class="bi bi-box-seam icon-pink"></i>
        <strong>Piezas:</strong> ${piezas} <br>
        <i class="bi bi-person icon-pink"></i>
        <strong>Usuario de Rechazo:</strong> ${usuarioName} <br>
        <i class="bi bi-person-gear icon-pink"></i>
        <strong>Jefatura:</strong> ${jefatura}
      </p>
      <div class="text-center mb-3" id="imgContainer-${sku}">
        <!-- Imagen del SKU -->
      </div>
      <div class="text-center mb-3">
        <a href="${searchUrl}" target="_blank" class="btn btn-outline-secondary">Buscar en Liverpool</a>
        <a href="${googleSearchUrl}" target="_blank" class="btn btn-outline-danger">Buscar en Google</a>
      </div>
      <div id="evidencia-preview-${rechazo._rowIndex}" class="text-center mb-3">
        ${evidencia.trim() !== "" 
          ? `
            <img src="${evidencia}" alt="Evidencia" class="img-fluid" style="max-width:200px;">
            <div class="mt-2">
              <button class="btn btn-sm btn-outline-secondary cambiar-foto-btn" data-row-index="${rechazo._rowIndex}">
                <i class="bi bi-camera"></i> Cambiar Foto
              </button>
              <button class="btn btn-sm btn-outline-danger eliminar-foto-btn" data-row-index="${rechazo._rowIndex}">
                <i class="bi bi-trash"></i> Eliminar Foto
              </button>
            </div>
          `
          : `<button class="btn btn-outline-primary btn-sm agregar-foto-btn" data-row-index="${rechazo._rowIndex}">
               <i class="bi bi-camera"></i> Agregar Foto
             </button>`
        }
      </div>
      <label for="comentario-${rechazo._rowIndex}" class="form-label fw-semibold">
        <i class="bi bi-chat-left-dots icon-pink me-1"></i>
        Comentarios:
      </label>
      <textarea
        id="comentario-${rechazo._rowIndex}"
        rows="3"
        class="${textareaClass}"
        data-row-index="${rechazo._rowIndex}"
      >${comentarios}</textarea>
    `;
    collapseDiv.appendChild(body);
    accordionItem.appendChild(header);
    accordionItem.appendChild(collapseDiv);
    accordion.appendChild(accordionItem);
    rechazosContainer.appendChild(accordion);
    loadDynamicImage(sku, seccion, `imgContainer-${sku}`);
  });
}

document.addEventListener("input", (e) => {
  if (e.target && e.target.classList.contains("comentario-input")) {
    const rowIndex = e.target.getAttribute("data-row-index");
    const newComment = e.target.value;
    if (AppState.rechazosGlobal[rowIndex]) {
      AppState.rechazosGlobal[rowIndex].Comentarios = newComment;
      console.log(`Nuevo comentario para rowIndex=${rowIndex}: ${newComment}`);
    }
    if (newComment.trim() !== "") {
      e.target.classList.add("has-comment");
    } else {
      e.target.classList.remove("has-comment");
    }
    const headerButton = document.querySelector(`#heading-${rowIndex} button`);
    if (headerButton) {
      if (newComment.trim() !== "") {
        headerButton.classList.add("has-comment-header");
      } else {
        headerButton.classList.remove("has-comment-header");
      }
    }
  }
});

document.addEventListener("click", (e) => {
  if (e.target && (e.target.classList.contains("agregar-foto-btn") || e.target.classList.contains("cambiar-foto-btn"))) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    capturePhoto(rowIndex);
  }
  if (e.target && e.target.classList.contains("eliminar-foto-btn")) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    deletePhoto(rowIndex);
  }
});

async function downloadRechazosFile() {
  if (!AppState.isAdmin) return;
  try {
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (!archivoRechazos) {
      return showAlert("error", "Archivo no encontrado", "No se encontró 'rechazos' en Firebase.");
    }
    const url = await archivoRechazos.getDownloadURL();
    const link = document.createElement("a");
    link.href = url;
    link.download = "rechazos.xlsx"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error al descargar:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx'");
  }
}

async function saveAllComments() {
  try {
    await showAlert("info", "Guardando cambios...", "Por favor espera");
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase().includes("rechazos"));
    if (!archivoRechazos) {
      return showAlert("error", "Archivo no encontrado", "No se encontró 'rechazos' en Firebase.");
    }
    const url = await archivoRechazos.getDownloadURL();
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets["Rechazos"];
        if (!sheet) {
          return showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
        }
        let actualRechazos = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const comentariosEditados = {};
        AppState.rechazosGlobal.forEach(fila => {
          if (fila.Remisión) {
            comentariosEditados[fila.Remisión] = fila.Comentarios || "";
          }
        });
        // Fusionar cambios: Actualizamos Comentarios y Fotos usando el valor de AppState (incluso si es cadena vacía)
        actualRechazos = actualRechazos.map(row => {
          if (row.Remisión && comentariosEditados.hasOwnProperty(row.Remisión)) {
            const updated = AppState.rechazosGlobal.find(f => f.Remisión === row.Remisión);
            return { 
              ...row, 
              Comentarios: comentariosEditados[row.Remisión],
              Fotos: updated ? updated.Fotos : row.Fotos
            };
          }
          return row;
        });
        const newSheet = XLSX.utils.json_to_sheet(actualRechazos);
        workbook.Sheets["Rechazos"] = newSheet;
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const newBlob = new Blob([wbout], { type: "application/octet-stream" });
        await archivoRechazos.delete();
        await storage.ref("uploads/rechazos.xlsx").put(newBlob);
        showAlert("success", "Éxito", "Los comentarios se han guardado correctamente.")
          .then(() => window.location.reload());
      } catch (error) {
        console.error("Error al actualizar comentarios:", error);
        showAlert("error", "Error", "No se pudo actualizar el archivo con comentarios.");
      }
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error general al guardar comentarios:", error);
    showAlert("error", "Error", "No se pudieron guardar los comentarios.");
  }
}
