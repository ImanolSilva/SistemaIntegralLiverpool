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
  rechazosGlobal: [],           // Filas filtradas para el usuario (para el accordion)
  selectedFileData: null,       // Objeto { name, ref } del archivo "rechazos.xlsx" activo
  isAdmin: false,               // Indica si el usuario es admin
  fileVersion: "1"              // Versión del archivo (para control de concurrencia)
};

// Lista de UIDs de administradores
const ADMIN_UIDS = [
  "doxhVo1D3aYQqqkqgRgfJ4qcKcU2",
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2"
];

// Objeto para almacenar temporizadores de auto-guardado (por fila)
const autoSaveTimers = {};

/*****************************************************
 *  ========== FUNCIONES AUXILIARES ==========
 *****************************************************/
function showAlert(icon, title, text) {
  return Swal.fire({ icon, title, text });
}

function setUIForRole(isAdmin) {
  const dropzone = document.getElementById("dropzone");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");
  if (dropzone) {
    dropzone.style.display = isAdmin ? "block" : "none";
  }
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

/**
 * Carga la imagen de forma dinámica en el contenedor indicado.
 */
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
    const successMsg = document.createElement("div");
    successMsg.textContent = "Imagen cargada correctamente";
    successMsg.style.color = "green";
    successMsg.style.fontSize = "0.9rem";
    container.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
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

/**
 * Carga Usuarios.xlsx y almacena la información en AppState.usuariosData.
 */
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
  // Se espera que en el HTML existan los elementos con id: "logout-btn", "confirmFileSelection", "dropzone", "saveCommentsBtn", "downloadRechazosBtn", "correoUsuario"
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
    const selectedFileNameElem = document.getElementById("selectedFileName");
    if (!selectedFileNameElem) return;
    const selectedFileName = selectedFileNameElem.textContent;
    if (selectedFileName && AppState.selectedFileData) {
      showAlert("success", "Archivo Confirmado", `El archivo seleccionado es: ${selectedFileName}`);
      const dropzoneElement = document.getElementById("dropzone");
      if (dropzoneElement) {
        dropzoneElement.style.display = "none";
      }
      if (AppState.isAdmin) {
        loadRechazosFile();
      } else {
        loadRelacionesFile();
      }
    } else {
      showAlert("warning", "Atención", "Debes seleccionar un archivo antes de continuar.");
    }
  });

  // Botón para guardar cambios (agregué un icono en el HTML, por ejemplo: <i class="bi bi-save"></i> Guardar cambios)
  saveCommentsBtn.addEventListener("click", saveAllComments);

  /* Eventos para el dropzone (solo para administradores) */
  if (dropzone) {
    // Se agrega un icono de subida junto con el mensaje
    dropzone.classList.add("dropzone-style");
    dropzone.innerHTML = `<i class="bi bi-cloud-upload-fill" style="font-size: 2rem; color: #007bff;"></i>
                          <p>Arrastra y suelta el archivo aquí o haz clic para seleccionarlo.</p>`;

    dropzone.addEventListener("click", () => {
      if (!AppState.isAdmin) return;
      checkExistingFile().then(exists => {
        if (exists) {
          showAlert("warning", "Archivo existente", "Ya hay un archivo cargado. Elimina el archivo actual para poder subir uno nuevo.");
        } else {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".xlsx, .xls";
          fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
              handleFileUpload(file);
            }
          });
          fileInput.click();
        }
      });
    });

    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("dropzone-dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dropzone-dragover");
    });

    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("dropzone-dragover");
      if (!AppState.isAdmin) return;
      const file = event.dataTransfer.files[0];
      if (file) {
        checkExistingFile().then(exists => {
          if (exists) {
            showAlert("warning", "Archivo existente", "Ya hay un archivo cargado. Elimina el archivo actual para poder subir uno nuevo.");
          } else {
            handleFileUpload(file);
          }
        });
      }
    });
  }

  if (downloadRechazosBtn) {
    downloadRechazosBtn.addEventListener("click", downloadRechazosFile);
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const correoElem = document.getElementById("correoUsuario");
      if (correoElem) correoElem.innerText = user.email;
      AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
      console.log(`El usuario actual es ${AppState.isAdmin ? "ADMIN" : "USUARIO normal"}`);
      setUIForRole(AppState.isAdmin);
      await loadUsuariosFile();
      await loadFilesFromFirebase();
    } else {
      const correoElem = document.getElementById("correoUsuario");
      if (correoElem) correoElem.innerText = "No hay usuario logueado";
      window.location.href = "../Login/login.html";
    }
  });
});

/*****************************************************
 *  ========== MANEJO DE ARCHIVOS EN FIREBASE ==========
 *****************************************************/

/**
 * Verifica si ya existe un archivo "rechazos.xlsx" en Firebase.
 */
async function checkExistingFile() {
  try {
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const existingFile = fileList.items.find(item => item.name.toLowerCase() === "rechazos.xlsx");
    return !!existingFile;
  } catch (error) {
    console.error("Error al verificar archivo existente:", error);
    return false;
  }
}

async function loadFilesFromFirebase() {
  try {
    await showAlert("info", "Cargando archivos...", "Recuperando archivo de Firebase Storage");
    const storageRef = storage.ref("uploads");
    const fileList = await storageRef.listAll();
    const files = [];
    fileList.items.forEach(item => {
      if (item.name.toLowerCase() === "rechazos.xlsx") {
        files.push({ name: item.name, ref: item });
      }
    });
    if (files.length > 0) {
      renderFileSelectOptions(files);
      if (AppState.isAdmin) {
        renderFilesManagement(files);
      }
      try {
        const metadata = await files[0].ref.getMetadata();
        AppState.fileVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
      } catch (err) {
        AppState.fileVersion = "1";
      }
      showAlert("success", "Archivo cargado", "Se encontró el archivo 'rechazos.xlsx' en Firebase");
    } else {
      showAlert("warning", "Sin archivo", "No se encontró ningún archivo 'rechazos.xlsx' en Firebase");
    }
  } catch (error) {
    console.error("Error al listar archivos:", error);
    showAlert("error", "Error", "Hubo un problema al cargar el archivo de Firebase");
  }
}

/**
 * Renderiza la lista de archivos para selección mostrando el estado asignado.
 */
async function renderFileSelectOptions(files) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";
  
  // Usamos tarjetas (cards) con efecto fade-in
  files.forEach(async file => {
    const card = document.createElement("div");
    card.className = "card mb-2 shadow-sm fade-in";
    
    const cardBody = document.createElement("div");
    cardBody.className = "card-body d-flex justify-content-between align-items-center";
    
    const fileInfo = document.createElement("div");
    // Se agrega un icono de archivo Excel
    fileInfo.innerHTML = `<i class="bi bi-file-earmark-excel me-2" style="color: #28a745;"></i>${file.name}`;
    
    // Obtener metadata y estado
    let metadata, estado = "";
    try {
      metadata = await file.ref.getMetadata();
      estado = (metadata.customMetadata && metadata.customMetadata.estado) || "";
    } catch (error) {
      console.error("Error al obtener metadata para", file.name, error);
    }
    
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.style.marginLeft = "10px";
    if (estado === "trabajar") {
      badge.innerHTML = `<i class="bi bi-check-circle me-1"></i>A trabajar`;
      badge.style.backgroundColor = "green";
    } else if (estado === "paso") {
      badge.innerHTML = `<i class="bi bi-info-circle me-1"></i>Ya pasó`;
      badge.style.backgroundColor = "orange";
    } else {
      badge.innerHTML = `<i class="bi bi-question-circle me-1"></i>Sin estado`;
      badge.style.backgroundColor = "gray";
    }
    fileInfo.appendChild(badge);
    
    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-sm btn-primary";
    selectBtn.innerHTML = `<i class="bi bi-check-lg me-1"></i>Seleccionar`;
    selectBtn.addEventListener("click", () => {
      document.getElementById("selectedFileName").textContent = `Seleccionado: ${file.name}`;
      document.getElementById("confirmFileSelection").disabled = false;
      AppState.selectedFileData = file;
    });
    
    cardBody.appendChild(fileInfo);
    cardBody.appendChild(selectBtn);
    card.appendChild(cardBody);
    fileListContainer.appendChild(card);
  });
}

/**
 * Panel de administración: muestra el archivo "rechazos.xlsx" en una tarjeta con controles.
 */
async function renderFilesManagement(files) {
  let managementContainer = document.getElementById("filesManagementContainer");
  if (!managementContainer) {
    managementContainer = document.createElement("div");
    managementContainer.id = "filesManagementContainer";
    const fileListContainer = document.getElementById("fileListContainer");
    fileListContainer.parentNode.insertBefore(managementContainer, fileListContainer.nextSibling);
  }
  managementContainer.innerHTML = "<h3 class='mb-3'>Administración del Archivo 'Rechazos'</h3>";
  
  const file = files[0]; // Sólo existe un archivo
  let metadata;
  try {
    metadata = await file.ref.getMetadata();
  } catch (err) {
    console.error("Error al obtener metadata del archivo", file.name, err);
    metadata = {};
  }
  const estado = (metadata.customMetadata && metadata.customMetadata.estado) || "";
  
  const card = document.createElement("div");
  card.className = "card mb-3 shadow-sm fade-in";
  
  const cardBody = document.createElement("div");
  cardBody.className = "card-body d-flex flex-column";
  
  const headerRow = document.createElement("div");
  headerRow.className = "d-flex justify-content-between align-items-center mb-2";
  const nameEl = document.createElement("h5");
  nameEl.className = "card-title mb-0";
  // Se agrega un icono de Excel en el título
  nameEl.innerHTML = `<i class="bi bi-file-earmark-excel me-2" style="color: #28a745;"></i>${file.name}`;
  headerRow.appendChild(nameEl);
  
  const badge = document.createElement("span");
  badge.className = "badge";
  if (estado === "trabajar") {
    badge.innerHTML = `<i class="bi bi-check-circle me-1"></i>A trabajar`;
    badge.style.backgroundColor = "green";
  } else if (estado === "paso") {
    badge.innerHTML = `<i class="bi bi-info-circle me-1"></i>Ya pasó`;
    badge.style.backgroundColor = "orange";
  } else {
    badge.innerHTML = `<i class="bi bi-question-circle me-1"></i>Sin estado`;
    badge.style.backgroundColor = "gray";
  }
  headerRow.appendChild(badge);
  cardBody.appendChild(headerRow);
  
  // Selector de estado
  const stateRow = document.createElement("div");
  stateRow.className = "mb-2";
  const label = document.createElement("label");
  label.className = "form-label me-2";
  label.innerHTML = `<i class="bi bi-toggle-off me-1"></i>Estado:`;
  const selectEstado = document.createElement("select");
  selectEstado.className = "form-select d-inline-block";
  selectEstado.style.width = "150px";
  const options = [
    { value: "", text: "Sin estado" },
    { value: "trabajar", text: "A trabajar" },
    { value: "paso", text: "Ya pasó" }
  ];
  options.forEach(opt => {
    const optionEl = document.createElement("option");
    optionEl.value = opt.value;
    optionEl.textContent = opt.text;
    if (opt.value === estado) {
      optionEl.selected = true;
    }
    selectEstado.appendChild(optionEl);
  });
  selectEstado.addEventListener("change", async (e) => {
    const newEstado = e.target.value;
    try {
      await file.ref.updateMetadata({
        customMetadata: { estado: newEstado, version: AppState.fileVersion }
      });
      showAlert("success", "Actualizado", `Estado actualizado a ${newEstado || "Sin estado"}`);
      if (newEstado === "trabajar") {
        badge.innerHTML = `<i class="bi bi-check-circle me-1"></i>A trabajar`;
        badge.style.backgroundColor = "green";
      } else if (newEstado === "paso") {
        badge.innerHTML = `<i class="bi bi-info-circle me-1"></i>Ya pasó`;
        badge.style.backgroundColor = "orange";
      } else {
        badge.innerHTML = `<i class="bi bi-question-circle me-1"></i>Sin estado`;
        badge.style.backgroundColor = "gray";
      }
    } catch (error) {
      console.error("Error actualizando estado:", error);
      showAlert("error", "Error", "No se pudo actualizar el estado del archivo.");
    }
  });
  stateRow.appendChild(label);
  stateRow.appendChild(selectEstado);
  cardBody.appendChild(stateRow);
  
  // Botones de acción: Descargar y Eliminar
  const actionRow = document.createElement("div");
  actionRow.className = "d-flex justify-content-end";
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "btn btn-sm btn-outline-secondary me-2";
  downloadBtn.innerHTML = `<i class="bi bi-download me-1"></i>Descargar`;
  downloadBtn.addEventListener("click", async () => {
    try {
      const url = await file.ref.getDownloadURL();
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error al descargar el archivo:", error);
      showAlert("error", "Error", "No se pudo descargar el archivo.");
    }
  });
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-sm btn-outline-danger";
  deleteBtn.innerHTML = `<i class="bi bi-trash me-1"></i>Eliminar`;
  deleteBtn.addEventListener("click", async () => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "El archivo se eliminará de forma permanente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (result.isConfirmed) {
      try {
        await file.ref.delete();
        showAlert("success", "Eliminado", "El archivo se eliminó correctamente.");
        loadFilesFromFirebase();
      } catch (error) {
        console.error("Error al eliminar el archivo:", error);
        showAlert("error", "Error", "No se pudo eliminar el archivo.");
      }
    }
  });
  actionRow.appendChild(downloadBtn);
  actionRow.appendChild(deleteBtn);
  cardBody.appendChild(actionRow);
  card.appendChild(cardBody);
  managementContainer.appendChild(card);
}

/*****************************************************
 *  ========== SUBIR ARCHIVO (SI NO HAY EXISTENTE) ==========
 *****************************************************/
async function handleFileUpload(file) {
  if (!file || !AppState.isAdmin) return;
  const exists = await checkExistingFile();
  if (exists) {
    return showAlert("warning", "Archivo existente", "Ya hay un archivo cargado. Elimina el archivo actual para poder subir uno nuevo.");
  }
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "Se subirá el archivo y se usará como único archivo de trabajo.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, subir",
    cancelButtonText: "Cancelar"
  });
  if (result.isConfirmed) {
    try {
      await showAlert("info", "Subiendo...", "El archivo se está subiendo.");
      const fileRef = storage.ref("uploads/rechazos.xlsx");
      await fileRef.put(file, { customMetadata: { version: "1" } });
      await loadFilesFromFirebase();
      showAlert("success", "Guardado", "El archivo se guardó correctamente.");
    } catch (error) {
      console.error("Error en handleFileUpload:", error);
      showAlert("error", "Error", "No se pudo subir el archivo.");
    }
  }
}

/*****************************************************
 *  ========== CAPTURAR Y SUBIR FOTO ==========
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
    await verifyImage(downloadURL);
    AppState.rechazosGlobal[rowIndex].Fotos = downloadURL;
    updatePhotoPreview(rowIndex, downloadURL);
    showAlert("success", "Foto guardada", "La foto se ha guardado correctamente.");
  } catch (error) {
    console.error("Error al subir/verificar la foto:", error);
    showAlert("error", "Error", "No se pudo subir o verificar la foto correctamente.");
  }
}

function verifyImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => reject(new Error("La imagen no se pudo cargar correctamente."));
    img.src = url;
  });
}

function updatePhotoPreview(rowIndex, url) {
  const previewContainer = document.getElementById(`evidencia-preview-${rowIndex}`);
  if (previewContainer) {
    if (url.trim() !== "") {
      previewContainer.innerHTML = `
        <img src="${url}" alt="Evidencia" class="img-fluid mb-2" style="max-width:200px;">
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-secondary cambiar-foto-btn me-2" data-row-index="${rowIndex}">
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
 *  ========== MANEJO DE ARCHIVOS EXCEL ==========
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
        return showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
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
 *  ========== FILTRAR POR JEFE (ADMIN) ==========
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
        <i class="bi bi-exclamation-triangle-fill"></i>
        No se encontraron rechazos para la selección actual.
      </div>`;
    return;
  }
  const accordion = document.createElement("div");
  accordion.className = "accordion fade-in";
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
    const headerButtonClass = `accordion-button collapsed ${comentarios.trim() !== "" ? "has-comment-header" : ""}`;
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
        <i class="bi bi-file-earmark-text me-2"></i>
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
        <i class="bi bi-calendar2 me-1"></i> <strong>Fecha:</strong> ${fecha}
      </div>
      <p>
        <i class="bi bi-diagram-2 me-1"></i>
        <strong>Sección:</strong> ${seccion} <br>
        <i class="bi bi-tags me-1"></i>
        <strong>SKU:</strong> ${sku} <br>
        <i class="bi bi-card-text me-1"></i>
        <strong>Descripción SKU:</strong> ${descripcionSku} <br>
        <i class="bi bi-box-seam me-1"></i>
        <strong>Piezas:</strong> ${piezas} <br>
        <i class="bi bi-person me-1"></i>
        <strong>Usuario de Rechazo:</strong> ${usuarioName} <br>
        <i class="bi bi-person-gear me-1"></i>
        <strong>Jefatura:</strong> ${jefatura}
      </p>
      <div class="text-center mb-3" id="imgContainer-${sku}-${i}">
        <!-- Imagen del SKU -->
      </div>
      <div class="text-center mb-3">
        <a href="${searchUrl}" target="_blank" class="btn btn-outline-secondary btn-sm me-2">
          <i class="bi bi-search"></i> Buscar en Liverpool
        </a>
        <a href="${googleSearchUrl}" target="_blank" class="btn btn-outline-danger btn-sm">
          <i class="bi bi-google"></i> Buscar en Google
        </a>
      </div>
      <div id="evidencia-preview-${rechazo._rowIndex}" class="text-center mb-3">
        ${evidencia.trim() !== "" 
          ? `
            <img src="${evidencia}" alt="Evidencia" class="img-fluid mb-2" style="max-width:200px;">
            <div>
              <button class="btn btn-sm btn-outline-secondary cambiar-foto-btn me-2" data-row-index="${rechazo._rowIndex}">
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
        <i class="bi bi-chat-left-dots me-1"></i>
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
    loadDynamicImage(sku, seccion, `imgContainer-${sku}-${i}`);
  });
}

/*****************************************************
 *  ========== AUTO-GUARDADO DE COMENTARIOS ==========
 *****************************************************/
document.addEventListener("input", (e) => {
  if (e.target && e.target.classList.contains("comentario-input")) {
    const rowIndex = e.target.getAttribute("data-row-index");
    const newComment = e.target.value;
    if (AppState.rechazosGlobal[rowIndex]) {
      AppState.rechazosGlobal[rowIndex].Comentarios = newComment;
      console.log(`Nuevo comentario para rowIndex=${rowIndex}: ${newComment}`);
    }
    e.target.classList.toggle("has-comment", newComment.trim() !== "");
    const headerButton = document.querySelector(`#heading-${rowIndex} button`);
    if (headerButton) {
      headerButton.classList.toggle("has-comment-header", newComment.trim() !== "");
    }
    if (autoSaveTimers[rowIndex]) {
      clearTimeout(autoSaveTimers[rowIndex]);
    }
    autoSaveTimers[rowIndex] = setTimeout(() => {
      autoSaveComment(rowIndex);
    }, 2000);
  }
});

async function autoSaveComment(rowIndex) {
  try {
    await saveAllComments(); // Guarda sin recargar la página
    console.log(`Comentario de la fila ${rowIndex} guardado automáticamente.`);
  } catch (error) {
    console.error("Error en auto-guardado:", error);
  }
}

/*****************************************************
 *  ========== EVENTOS DE CLIC ==========
 *****************************************************/
document.addEventListener("click", (e) => {
  if (e.target && (e.target.classList.contains("agregar-foto-btn") || e.target.classList.contains("cambiar-foto-btn"))) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    capturePhoto(rowIndex);
  }
  if (e.target && e.target.classList.contains("eliminar-foto-btn")) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    console.log(`Se solicita eliminar la foto de la fila ${rowIndex}`);
    // Aquí podrías implementar deletePhoto(rowIndex)
  }
});

/*****************************************************
 *  ========== DESCARGAR ARCHIVO ==========
 *****************************************************/
async function downloadRechazosFile() {
  if (!AppState.isAdmin) return;
  try {
    const storageRef = storage.ref("uploads/");
    const fileList = await storageRef.listAll();
    const archivoRechazos = fileList.items.find(item => item.name.toLowerCase() === "rechazos.xlsx");
    if (!archivoRechazos) {
      return showAlert("error", "Archivo no encontrado", "No se encontró 'rechazos.xlsx' en Firebase.");
    }
    const url = await archivoRechazos.getDownloadURL();
    const link = document.createElement("a");
    link.href = url;
    link.download = archivoRechazos.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error al descargar:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx'");
  }
}

/*****************************************************
 *  ========== GUARDAR COMENTARIOS (SIN RECARGAR) ==========
 *****************************************************/
async function saveAllComments() {
  try {
    await showAlert("info", "Guardando cambios...", "Por favor espera");
    const fileRef = AppState.selectedFileData.ref;
    if (!fileRef) {
      return showAlert("error", "Archivo no encontrado", "No se encontró el archivo seleccionado en Firebase.");
    }
    // Control de concurrencia: verificamos la versión
    const metadata = await fileRef.getMetadata();
    const currentVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
    if (currentVersion !== AppState.fileVersion) {
      return showAlert("error", "Conflicto", "El archivo ha sido modificado por otro usuario. Recargue la información antes de guardar sus cambios.");
    }
    
    const url = await fileRef.getDownloadURL();
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
        // Incrementamos la versión
        const newVersion = (parseInt(currentVersion) + 1).toString();
        await fileRef.delete();
        const newFileRef = storage.ref("uploads/rechazos.xlsx");
        await newFileRef.put(newBlob, { customMetadata: { ...metadata.customMetadata, version: newVersion } });
        AppState.selectedFileData = { name: "rechazos.xlsx", ref: newFileRef };
        AppState.fileVersion = newVersion;
        showAlert("success", "Guardado", "Los cambios se han guardado correctamente.");
        loadFilesFromFirebase();
        if (AppState.isAdmin) {
          loadRechazosFile();
        }
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
