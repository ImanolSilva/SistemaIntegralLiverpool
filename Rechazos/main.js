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
  relacionesData: null,
  usuariosData: [],
  allRechazosEnExcel: [],
  rechazosGlobal: [],
  selectedFileData: null,
  isAdmin: false,
  fileVersion: "1",
};

let isSaving = false;
let adminBossFilter = "";
const ADMIN_UIDS = [
  "doxhVo1D3aYQqqkqgRgfJ4qcKcU2",
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
];
const autoSaveTimers = {};

/*****************************************************
 *  ========== INYECTAR ESTILOS PERSONALIZADOS ==========
 *****************************************************/
function injectCustomStyles() {
  const css = `
    /* ====== LIQUID DOT (efecto onda) ====== */
    .liquid-dot {
      position: relative;
      width: 14px; /* Tamaño fijo para consistencia */
      height: 14px; 
      background: #28a745; /* punto verde */
      border-radius: 50%;
      margin-left: 0.5rem;
      overflow: hidden;
    }
    .liquid-dot::before,
    .liquid-dot::after {
      content: "";
      position: absolute;
      width: 200%;
      height: 200%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      border-radius: 50%;
      background-color: rgba(255,255,255,0.3);
      animation: liquidDotRipple 2.5s infinite ease-in-out;
    }
    .liquid-dot::after {
      animation-delay: 1.25s;
    }
    @keyframes liquidDotRipple {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      70% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
      100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
    }

    /* ====== Spinner (guardando) ====== */
    .saving-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ccc;
      border-top: 2px solid #28a745;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-left: 8px;
      vertical-align: middle;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* ====== Icono de comentario ====== */
    .comment-icon {
      color: #17a2b8; /* azul clarito */
      margin-left: 0.5rem;
      font-size: 1rem; /* tamaño fijo para consistencia */
    }

    /* ====== Remisión Liquid Efecto ====== */
    .remision-liquid {
      display: inline-block;
      position: relative;
      padding: 4px 10px;
      background: #fff;
      border: 2px solid #E6007E;
      border-radius: 12px;
      color: #E6007E;
      font-weight: 700;
      margin-left: 6px;
      overflow: hidden;
    }
    .remision-liquid::before,
    .remision-liquid::after {
      content: "";
      position: absolute;
      width: 200%;
      height: 200%;
      top: -100%;
      left: -100%;
      background: rgba(230, 0, 126, 0.15);
      border-radius: 50%;
      animation: liquidRemision 6s infinite linear;
    }
    .remision-liquid::after {
      animation-delay: 3s;
    }
    @keyframes liquidRemision {
      0% { transform: translate(0, 0) scale(0.7); }
      50% { transform: translate(50%, 50%) scale(1.2); }
      100% { transform: translate(0, 0) scale(0.7); }
    }

    /* ====== Ajustes responsivos mínimos ====== */
    @media (max-width: 576px) {
      .accordion-button { font-size: 0.9rem; }
      .accordion-body { font-size: 0.9rem; }
      .comment-icon { font-size: 0.9rem; }
    }
  `;
  if (!document.getElementById("custom-styles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "custom-styles";
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

/*****************************************************
 *  ========== FUNCIONES AUXILIARES ==========
 *****************************************************/
function showAlert(icon, title, text, config = {}) {
  const defaultConfig = {
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
  };
  return Swal.fire({ icon, title, text, ...defaultConfig, ...config });
}

function setUIForRole(isAdmin) {
  const dropzone = document.getElementById("dropzone");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");
  if (dropzone) dropzone.style.display = isAdmin ? "block" : "none";
  if (downloadRechazosBtn)
    downloadRechazosBtn.style.display = isAdmin ? "inline-block" : "none";
}

function fixEncoding(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/*****************************************************
 *  ========== CARGA DINÁMICA DE IMÁGENES ==========
 *****************************************************/
function loadDynamicImage(sku, seccion, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const imageUrl = `https://ss${seccion}.liverpool.com.mx/xl/${sku}.jpg`;
  const funnyImageUrl = "https://michelacosta.com/wp-content/uploads/2017/03/Cristiano-llorando.gif";

  const imgElement = document.createElement("img");
  imgElement.alt = "Imagen del artículo";
  imgElement.className = "img-fluid rounded";
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
  imgElement.onload = function () {
    this.style.display = "block";
    fallbackElement.style.display = "none";
    const successMsg = document.createElement("div");
    successMsg.textContent = "Imagen cargada correctamente";
    successMsg.style.color = "green";
    successMsg.style.fontSize = "0.9rem";
    container.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
  };

  imgElement.onerror = function () {
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

/*****************************************************
 *  ========== CARGAR ARCHIVOS EXCEL ==========
 *****************************************************/
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
      // Si el usuario es admin, se omite el filtrado por relaciones
      if (ADMIN_UIDS.includes(auth.currentUser.uid)) {
        loadRechazosFile([]);
        return;
      }
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

/*****************************************************
 *  ========== DOMContentLoaded PRINCIPAL ==========
 *****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Inyecta los estilos personalizados
  injectCustomStyles();

  const logoutButton = document.getElementById("logout-btn");
  const confirmFileSelection = document.getElementById("confirmFileSelection");
  const dropzone = document.getElementById("dropzone");
  const saveCommentsBtn = document.getElementById("saveCommentsBtn");
  const downloadRechazosBtn = document.getElementById("downloadRechazosBtn");

  // Cerrar sesión
  logoutButton.addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "../Login/login.html";
    });
  });

  // Confirmar selección de archivo
  confirmFileSelection.addEventListener("click", () => {
    const selectedFileNameElem = document.getElementById("selectedFileName");
    if (!selectedFileNameElem) return;
    const selectedFileName = selectedFileNameElem.textContent;
    if (selectedFileName && AppState.selectedFileData) {
      showAlert("success", "Archivo Confirmado", `El archivo seleccionado es: ${selectedFileName}`);
      const dropzoneElement = document.getElementById("dropzone");
      if (dropzoneElement) dropzoneElement.style.display = "none";
      loadRelacionesFile();
    } else {
      showAlert("warning", "Atención", "Debes seleccionar un archivo antes de continuar.");
    }
  });

  // Guardar comentarios manualmente
  saveCommentsBtn.addEventListener("click", () => saveAllComments());

  /********************
   * CONFIGURACIÓN DEL DROPZONE
   ********************/
  if (dropzone) {
    dropzone.innerHTML = `
      <i class="bi bi-cloud-upload-fill" style="font-size: 2rem; color: #007bff;"></i>
      <p>Arrastra y suelta el archivo aquí o haz clic para seleccionarlo.</p>
    `;
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
            if (file) handleFileUpload(file);
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

  // Manejo del estado de autenticación
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const correoElem = document.getElementById("correoUsuario");
      if (correoElem) correoElem.innerText = user.email;
      AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
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
      if (AppState.isAdmin) renderFilesManagement(files);
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

async function renderFileSelectOptions(files) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";

  files.forEach(async (file) => {
    // Card principal con sombra suave y borde minimalista
    const card = document.createElement("div");
    card.className = "card mb-2 shadow-sm fade-in border-0";
    card.style.transition = "transform 0.2s ease, box-shadow 0.2s";
    card.onmouseover = () => {
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
    };
    card.onmouseout = () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
    };

    // Cuerpo de la card
    const cardBody = document.createElement("div");
    cardBody.className = "card-body d-flex justify-content-between align-items-center p-3";

    // Información del archivo
    const fileInfo = document.createElement("div");
    fileInfo.innerHTML = `
      <i class="bi bi-file-earmark-excel me-2" style="color:#28a745; font-size:1.2rem;"></i>
      <span class="fw-bold">${file.name}</span>
    `;

    // Botón para seleccionar el archivo
    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-sm btn-primary";
    selectBtn.innerHTML = `<i class="bi bi-check-lg me-1"></i> Seleccionar`;
    selectBtn.addEventListener("click", () => {
      document.getElementById("selectedFileName").textContent = `Seleccionado: ${file.name}`;
      document.getElementById("confirmFileSelection").disabled = false;
      AppState.selectedFileData = file;
    });

    // Añadimos la info y el botón al cuerpo de la card
    cardBody.appendChild(fileInfo);
    cardBody.appendChild(selectBtn);

    // Ensamblamos la card
    card.appendChild(cardBody);
    fileListContainer.appendChild(card);
  });
}

async function renderFilesManagement(files) {
  let managementContainer = document.getElementById("filesManagementContainer");
  if (!managementContainer) {
    managementContainer = document.createElement("div");
    managementContainer.id = "filesManagementContainer";
    const fileListContainer = document.getElementById("fileListContainer");
    fileListContainer.parentNode.insertBefore(managementContainer, fileListContainer.nextSibling);
  }
  
  // Card principal con header en degradado
  managementContainer.innerHTML = `
    <div class="card shadow-sm mb-4">
      <div class="card-header" style="background: linear-gradient(135deg, #E6007E, #F8BBD0); border: none;">
        <h4 class="mb-0 text-white">
          <i class="bi bi-file-earmark-excel me-2"></i>
          Administración del Archivo 'Rechazos'
        </h4>
      </div>
      <div class="card-body p-3" id="filesManagementContent"></div>
    </div>
  `;
  
  const contentContainer = document.getElementById("filesManagementContent");
  const file = files[0];
  let metadata = {};
  try {
    metadata = await file.ref.getMetadata();
  } catch (err) {
    console.error("Error al obtener metadata:", err);
  }
  
  // Card para mostrar la información del archivo
  const fileCard = document.createElement("div");
  fileCard.className = "card mb-3 border-0";
  fileCard.style.backgroundColor = "#ffffff";
  
  const cardBody = document.createElement("div");
  cardBody.className = "card-body d-flex flex-column p-3";
  
  // Encabezado de la card
  const headerRow = document.createElement("div");
  headerRow.className = "d-flex justify-content-between align-items-center mb-3";
  headerRow.innerHTML = `
    <h5 class="card-title mb-0" style="color: #E6007E;">
      <i class="bi bi-file-earmark-excel me-2" style="color:#28a745;"></i> ${file.name}
    </h5>
    <span class="text-muted" style="font-size: 0.9rem;">
      Versión: ${(metadata.customMetadata && metadata.customMetadata.version) || "1"}
    </span>
  `;
  cardBody.appendChild(headerRow);
  
  // Grupo de botones de acción con colores vibrantes y minimalistas
  const actionRow = document.createElement("div");
  // Se añade la clase personalizada "action-row" para estilos en móviles
  actionRow.className = "d-flex action-row justify-content-end gap-2 flex-wrap";
  
  // Inyectar estilos para botones en móviles (100% ancho, mismos tamaños)
  const style = document.createElement("style");
  style.innerHTML = `
    @media (max-width: 576px) {
      .action-row {
        flex-direction: column;
      }
      .action-row > button {
        width: 100%;
        max-width: 100%;
        margin-bottom: 0.5rem;
        text-align: center;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Estilos base para botones
  const btnStyle = "border-radius: 30px; font-weight: 600; padding: 0.5rem 1.2rem; transition: all 0.3s ease;";
  const btnHoverStyle = "transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15);";
  
  // Botón Descargar (rosa vibrante)
  const downloadBtn = document.createElement("button");
  downloadBtn.style.cssText = btnStyle + "background-color: #E6007E; color: #fff; border: none;";
  downloadBtn.innerHTML = `<i class="bi bi-download me-1"></i> Descargar`;
  downloadBtn.addEventListener("mouseover", () => {
    downloadBtn.style.cssText = btnStyle + "background-color: #D4006F; color: #fff; border: none; " + btnHoverStyle;
  });
  downloadBtn.addEventListener("mouseout", () => {
    downloadBtn.style.cssText = btnStyle + "background-color: #E6007E; color: #fff; border: none;";
  });
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
  
  // Botón Enviar por correo (verde vibrante)
  const emailBtn = document.createElement("button");
  emailBtn.style.cssText = btnStyle + "background-color: #28a745; color: #fff; border: none;";
  emailBtn.innerHTML = `<i class="bi bi-envelope me-1"></i> Enviar por correo`;
  emailBtn.addEventListener("mouseover", () => {
    emailBtn.style.cssText = btnStyle + "background-color: #218838; color: #fff; border: none; " + btnHoverStyle;
  });
  emailBtn.addEventListener("mouseout", () => {
    emailBtn.style.cssText = btnStyle + "background-color: #28a745; color: #fff; border: none;";
  });
  emailBtn.addEventListener("click", sendFileByEmail);
  
  // Botón Eliminar (rojo vibrante)
  const deleteBtn = document.createElement("button");
  deleteBtn.style.cssText = btnStyle + "background-color: #dc3545; color: #fff; border: none;";
  deleteBtn.innerHTML = `<i class="bi bi-trash me-1"></i> Eliminar`;
  deleteBtn.addEventListener("mouseover", () => {
    deleteBtn.style.cssText = btnStyle + "background-color: #c82333; color: #fff; border: none; " + btnHoverStyle;
  });
  deleteBtn.addEventListener("mouseout", () => {
    deleteBtn.style.cssText = btnStyle + "background-color: #dc3545; color: #fff; border: none;";
  });
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
      Swal.fire({
         title: 'Eliminando archivo...',
         html: 'Por favor espere',
         allowOutsideClick: false,
         allowEscapeKey: false,
         didOpen: () => Swal.showLoading()
      });
      try {
         await file.ref.delete();
         Swal.close();
         showAlert("success", "Eliminado", "El archivo se eliminó correctamente.");
         location.reload();
      } catch (error) {
         Swal.close();
         console.error("Error al eliminar el archivo:", error);
         showAlert("error", "Error", "No se pudo eliminar el archivo.");
      }
    }
  });
  
  actionRow.append(downloadBtn, emailBtn, deleteBtn);
  cardBody.appendChild(actionRow);
  fileCard.appendChild(cardBody);
  contentContainer.appendChild(fileCard);
}


/*****************************************************
 *  ========== FILTRO POR JEFE (SOLO PARA ADMIN) ==========
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
  const jefesUnicos = [...new Set(allRechazos.map(r => fixEncoding(r["Jefatura"])).filter(j => j && j.trim() !== ""))];
  const select = document.createElement("select");
  select.className = "form-select mb-3";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todos los Jefes";
  select.appendChild(allOption);
  jefesUnicos.forEach(jefatura => {
    const option = document.createElement("option");
    option.value = jefatura;
    option.textContent = jefatura;
    select.appendChild(option);
  });
  select.value = adminBossFilter;
  container.appendChild(select);
  select.addEventListener("change", (e) => {
    adminBossFilter = e.target.value;
    let filtrados = allRechazos;
    if (adminBossFilter && adminBossFilter.trim() !== "") {
      filtrados = allRechazos.filter(row => fixEncoding(row["Jefatura"]) === adminBossFilter);
    }
    renderRechazos(filtrados);
  });
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
      const fileRef = storage.ref("uploads/rechazos.xlsx");
      const uploadTask = fileRef.put(file, { customMetadata: { version: "1" } });
      Swal.fire({
        title: 'Subiendo archivo...',
        html: '<div id="progress-container" style="width: 100%; background: #eee;"><div id="progress-bar" style="width: 0%; height: 20px; background: green;"></div></div>',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false
      });
      uploadTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        document.getElementById('progress-bar').style.width = progress + '%';
      }, (error) => {
        Swal.close();
        showAlert("error", "Error", "No se pudo subir el archivo.");
      }, () => {
        Swal.close();
        showAlert("success", "Guardado", "El archivo se guardó correctamente.");
        location.reload();
      });
    } catch (error) {
      console.error("Error en handleFileUpload:", error);
      showAlert("error", "Error", "No se pudo subir el archivo.");
    }
  }
}

/*****************************************************
 *  ========== SUBIR Y ELIMINAR FOTO ==========
 *****************************************************/
function choosePhoto(rowIndex) {
  Swal.fire({
    title: 'Subir foto',
    text: '¿Deseas usar la cámara o seleccionar de la galería?',
    icon: 'question',
    showDenyButton: true,
    confirmButtonText: 'Cámara',
    denyButtonText: 'Galería',
  }).then((result) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    if (result.isConfirmed && isMobile()) {
      fileInput.setAttribute("capture", "environment");
    }
    fileInput.style.display = "none";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) uploadPhoto(file, rowIndex);
    });
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  });
}

async function uploadPhoto(file, rowIndex) {
  try {
    const remision = AppState.rechazosGlobal[rowIndex].Remisión || "sinRemision";
    const timestamp = Date.now();
    const filename = `uploads/evidencias/evidencia_${remision}_${timestamp}.jpg`;
    const storageRef = storage.ref(filename);
    Swal.fire({
      title: "Subiendo foto...",
      text: "Por favor espera un momento.",
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    await verifyImage(downloadURL);
    AppState.rechazosGlobal[rowIndex].Fotos = downloadURL;
    updatePhotoPreview(rowIndex, downloadURL);

    Swal.close();
    showAlert("success", "Foto guardada", "La foto se ha guardado correctamente.");
    await saveAllComments(true);
  } catch (error) {
    console.error("Error al subir/verificar la foto:", error);
    Swal.close();
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
      const imageUrl = `${url}?cb=${Date.now()}`;
      previewContainer.innerHTML = `
        <img src="${imageUrl}" alt="Evidencia" class="img-fluid rounded mb-2" style="max-width:200px;">
        <div>
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

async function deletePhoto(rowIndex) {
  const photoUrl = AppState.rechazosGlobal[rowIndex].Fotos;
  if (!photoUrl) return;
  try {
    const photoRef = storage.refFromURL(photoUrl);
    await photoRef.getMetadata(); 
    await photoRef.delete();
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.warn("El archivo ya no existe en Firebase Storage, se actualizará el estado local.");
    } else {
      console.error("Error al eliminar la foto:", error);
      showAlert("error", "Error", "No se pudo eliminar la foto.");
      return;
    }
  }
  AppState.rechazosGlobal[rowIndex].Fotos = "";
  updatePhotoPreview(rowIndex, "");
  showAlert("success", "Eliminado", "La foto se eliminó correctamente.");
  await saveAllComments(true);
}

/*****************************************************
 *  ========== MANEJO DE ARCHIVOS EXCEL (RECHAZOS) ==========
 *****************************************************/
async function loadRechazosFile(secciones) {
  try {
    const archivoRechazos = AppState.selectedFileData?.ref;
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
        rechazosFiltrados = rechazosFiltrados.filter(row =>
          secciones.some(seccion => row.Sección && row.Sección.toString().trim() === seccion.toString().trim())
        );
      }

      if (AppState.isAdmin) {
        renderBossFilter(AppState.allRechazosEnExcel);
        if (adminBossFilter && adminBossFilter.trim() !== "") {
          rechazosFiltrados = AppState.allRechazosEnExcel.filter(row => row["Jefatura"] === adminBossFilter);
        }
      }

      renderRechazos(rechazosFiltrados);
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error al cargar rechazos.xlsx:", error);
    showAlert("error", "Error", "No se pudo descargar 'rechazos.xlsx' desde Firebase");
  }
}

/*****************************************************
 *  ========== RENDERIZAR REMISIONES (ACORDEÓN) ==========
 *  - Contenido alineado a la izquierda
 *  - Imagen a la derecha
 *  - Remisión, punto verde y ícono de mensaje con tamaño y ubicación fijos
 *  - Colapsado por defecto
 *****************************************************/function renderRechazos(rechazosFiltrados) {
  const container = document.getElementById("rechazosContainer");
  container.innerHTML = "";
  
  // Actualizamos el estado global de remisiones
  AppState.rechazosGlobal = rechazosFiltrados.map((item, index) => ({
    ...item,
    _rowIndex: index,
    Comentarios: item.Comentarios || ""
  }));
  
  if (!AppState.rechazosGlobal.length) {
    container.innerHTML = `
      <div class="alert alert-warning text-center">
        <i class="bi bi-exclamation-triangle-fill"></i> No se encontraron reportes para la selección actual.
      </div>`;
    return;
  }
  
  // Acordeón para agrupar las remisiones
  const accordion = document.createElement("div");
  accordion.className = "accordion";
  accordion.id = "rechazosAccordion";
  
  AppState.rechazosGlobal.forEach((rechazo, i) => {
    // Variables
    const fecha = fixEncoding(rechazo["Fecha y Hora de Asignación"] || "");
    const seccion = fixEncoding(rechazo["Sección"] || "");
    const remision = fixEncoding(rechazo["Remisión"] || "");
    const sku = fixEncoding(rechazo["Sku"] || "");
    const descripcionSku = fixEncoding(rechazo["Descripción Sku"] || "");
    const piezas = fixEncoding(rechazo["Piezas"] || "");
    let usuarioCode = fixEncoding(rechazo["Usuario de Rechazo"] || "");
    const userCodeNormalized = usuarioCode.trim().toLowerCase();
    let usuarioName = usuarioCode;
    if (AppState.usuariosData.length) {
      const foundUser = AppState.usuariosData.find(u =>
        u.Usuarios && u.Usuarios.toString().trim().toLowerCase() === userCodeNormalized
      );
      if (foundUser?.Nombre) usuarioName = foundUser.Nombre;
    }
    const jefatura = fixEncoding(rechazo["Jefatura"] || "");
    const hasComment = rechazo.Comentarios.trim() !== "";
    
    // Indicador de estado: verde si tiene comentarios, rojo si no
    const stateIndicator = `
      <span style="
        display:inline-block; 
        width:12px; 
        height:12px; 
        border-radius:50%; 
        background-color:${hasComment ? "#28a745" : "#dc3545"};
        margin-left:0.5rem;">
      </span>
    `;
    
    // Estructura del acordeón
    const accordionItem = document.createElement("div");
    accordionItem.className = "accordion-item mb-3 border-0";
    
    // Header
    const header = document.createElement("h2");
    header.className = "accordion-header";
    header.id = `heading-${i}`;
    
    const headerButton = document.createElement("button");
    headerButton.className = "accordion-button collapsed";
    headerButton.type = "button";
    headerButton.setAttribute("data-bs-toggle", "collapse");
    headerButton.setAttribute("data-bs-target", `#collapse-${i}`);
    headerButton.setAttribute("aria-expanded", "false");
    headerButton.setAttribute("aria-controls", `collapse-${i}`);
    headerButton.style.backgroundColor = "#fff";
    headerButton.style.border = "1px solid #E6007E";
    headerButton.style.borderRadius = "10px";
    headerButton.style.fontWeight = "600";
    headerButton.style.padding = "1rem";
    headerButton.style.transition = "transform 0.3s ease";
    headerButton.onmouseover = () => headerButton.style.transform = "scale(1.02)";
    headerButton.onmouseout = () => headerButton.style.transform = "scale(1)";
    
    headerButton.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100">
        <div>
          <span>Reporte:</span>
          <span style="
            padding: 0.25rem 0.75rem;
            background-color: #E6007E;
            color: #fff;
            border-radius: 20px;
            margin-left:0.5rem;">
            ${remision}
          </span>
        </div>
        <div class="d-flex align-items-center">
          ${stateIndicator}
          ${
            hasComment
              ? `<i class="bi bi-chat-dots-fill ms-2" style="color:#17a2b8;" title="Tiene comentarios"></i>`
              : ""
          }
        </div>
      </div>
    `;
    header.appendChild(headerButton);
    accordionItem.appendChild(header);
    
    // Contenido del acordeón
    const collapseDiv = document.createElement("div");
    collapseDiv.id = `collapse-${i}`;
    collapseDiv.className = "accordion-collapse collapse";
    collapseDiv.setAttribute("aria-labelledby", `heading-${i}`);
    collapseDiv.setAttribute("data-bs-parent", "#rechazosAccordion");
    
    const bodyDiv = document.createElement("div");
    bodyDiv.className = "accordion-body p-4";
    bodyDiv.style.backgroundColor = "#fdfdfd";
    
    // Aquí definimos la fila (row) con align-items-start
    bodyDiv.innerHTML = `
      <div class="row g-3 align-items-start">
        <!-- Columna de Datos (Lista) -->
        <div class="col-md-7">
          <ul class="list-unstyled mb-0">
            <li class="mb-1"><strong>Fecha:</strong> ${fecha}</li>
            <li class="mb-1"><strong>Sección:</strong> ${seccion}</li>
            <li class="mb-1"><strong>SKU:</strong> ${sku}</li>
            <li class="mb-1"><strong>Descripción:</strong> ${descripcionSku}</li>
            <li class="mb-1"><strong>Piezas:</strong> ${piezas}</li>
            <li class="mb-1"><strong>Usuario:</strong> ${usuarioName}</li>
            <li class="mb-1"><strong>Jefatura:</strong> ${jefatura}</li>
          </ul>
          
          <!-- Botones de búsqueda -->
          <div class="mt-3">
            <a
              href="https://www.liverpool.com.mx/tienda?s=${sku}"
              target="_blank"
              class="btn btn-sm btn-outline-secondary me-2"
            >
              <i class="bi bi-search"></i> Ver en Liverpool
            </a>
            <a
              href="https://www.google.com/search?q=site:liverpool.com.mx+${sku}"
              target="_blank"
              class="btn btn-sm btn-outline-danger"
            >
              <i class="bi bi-google"></i> Buscar en Google
            </a>
          </div>
          
          <!-- Comentarios -->
          <div class="mt-3">
            <label
              for="comentario-${rechazo._rowIndex}"
              class="form-label fw-semibold"
            >
              <i class="bi bi-chat-left-dots me-1"></i> Comentarios:
            </label>
            <textarea
              id="comentario-${rechazo._rowIndex}"
              rows="3"
              class="form-control comentario-input ${
                rechazo.Comentarios.trim() !== "" ? "has-comment" : ""
              }"
              data-row-index="${rechazo._rowIndex}"
            >${rechazo.Comentarios}</textarea>
          </div>
        </div>
        
        <!-- Columna de Imagen y Acciones -->
        <div class="col-md-5 text-center">
          <div id="imgContainer-${sku}-${i}" class="mb-3"></div>
          <div id="evidencia-preview-${rechazo._rowIndex}">
            ${
              rechazo.Fotos && rechazo.Fotos.trim() !== ""
                ? `
                  <img
                    src="${rechazo.Fotos}"
                    alt="Evidencia"
                    class="img-fluid rounded mb-2"
                    style="max-width:180px;"
                  >
                  <div>
                    <button
                      class="btn btn-sm btn-outline-secondary cambiar-foto-btn me-2"
                      data-row-index="${rechazo._rowIndex}"
                    >
                      <i class="bi bi-camera"></i> Cambiar
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger eliminar-foto-btn"
                      data-row-index="${rechazo._rowIndex}"
                    >
                      <i class="bi bi-trash"></i> Eliminar
                    </button>
                  </div>
                `
                : `
                  <button
                    class="btn btn-sm btn-outline-primary agregar-foto-btn"
                    data-row-index="${rechazo._rowIndex}"
                  >
                    <i class="bi bi-camera"></i> Agregar Foto
                  </button>
                `
            }
          </div>
        </div>
      </div>
    `;
    
    collapseDiv.appendChild(bodyDiv);
    accordionItem.appendChild(collapseDiv);
    accordion.appendChild(accordionItem);
    
    // Carga dinámica de la imagen
    setTimeout(() => loadDynamicImage(sku, seccion, `imgContainer-${sku}-${i}`), 50);
  });
  
  container.appendChild(accordion);
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
    }
    e.target.classList.toggle("has-comment", newComment.trim() !== "");

    // Actualizar encabezado (punto e ícono si hay comentario)
    const heading = document.getElementById(`heading-${rowIndex}`);
    if (heading) {
      const button = heading.querySelector("button");
      if (button) {
        const existingDot = button.querySelector(".liquid-dot");
        const existingIcon = button.querySelector(".comment-icon");
        if (newComment.trim() !== "") {
          if (!existingDot) {
            const dotSpan = document.createElement("span");
            dotSpan.className = "liquid-dot";
            button.appendChild(dotSpan);
          }
          if (!existingIcon) {
            const icon = document.createElement("i");
            icon.className = "bi bi-chat-dots-fill comment-icon";
            icon.title = "Hay comentarios";
            button.appendChild(icon);
          }
        } else {
          if (existingDot) existingDot.remove();
          if (existingIcon) existingIcon.remove();
        }
      }
    }

    // Programar auto-guardado
    if (autoSaveTimers[rowIndex]) clearTimeout(autoSaveTimers[rowIndex]);
    autoSaveTimers[rowIndex] = setTimeout(() => {
      autoSaveComment(rowIndex);
    }, 3000);
  }
});

async function autoSaveComment(rowIndex) {
  // Spinner en el encabezado
  const heading = document.getElementById(`heading-${rowIndex}`);
  let spinner;
  if (heading) {
    const button = heading.querySelector("button");
    if (button) {
      spinner = document.createElement("span");
      spinner.className = "saving-spinner";
      button.appendChild(spinner);
    }
  }
  try {
    await saveAllComments(true);
    console.log(`Autosave: comentario de la fila ${rowIndex} guardado.`);
  } catch (error) {
    console.error("Error en auto-guardado:", error);
  } finally {
    if (spinner) spinner.remove();
  }
}

/*****************************************************
 *  ========== EVENTOS DE CLIC (FOTOS) ==========
 *****************************************************/
document.addEventListener("click", (e) => {
  if (e.target && (e.target.classList.contains("agregar-foto-btn") || e.target.classList.contains("cambiar-foto-btn"))) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    choosePhoto(rowIndex);
  }
  if (e.target && e.target.classList.contains("eliminar-foto-btn")) {
    const rowIndex = parseInt(e.target.getAttribute("data-row-index"));
    deletePhoto(rowIndex);
  }
});

/*****************************************************
 *  ========== DESCARGAR ARCHIVO (ADMIN) ==========
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
 *  ========== ENVIAR ARCHIVO POR CORREO (ADMIN) ==========
 *****************************************************/
async function sendFileByEmail() {
  if (!AppState.isAdmin) return;
  try {
    if (!AppState.selectedFileData || !AppState.selectedFileData.ref) {
      return showAlert("error", "Error", "No se ha seleccionado ningún archivo.");
    }
    const defaultRecipients = "agavila@liverpool.com.mx,babanuelosr@liverpool.com.mx";
    const fileRef = AppState.selectedFileData.ref;
    const fileUrl = await fileRef.getDownloadURL();
    const subject = encodeURIComponent("Envío de Archivo - Rechazos");
    const body = encodeURIComponent(
`Estimado/a,

Adjunto encontrarás el enlace para descargar el archivo de rechazos:

${fileUrl}

Quedo a tu disposición para cualquier consulta o aclaración.

Atentamente,
[Tu Nombre]`
    );
    const mailtoLink = `mailto:${defaultRecipients}?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
    showAlert("success", "Abrir correo", "Se ha abierto su cliente de correo para enviar el mensaje.");
  } catch (error) {
    console.error("Error al enviar el archivo por correo:", error);
    showAlert("error", "Error", "No se pudo abrir el cliente de correo.");
  }
}

/*****************************************************
 *  ========== GUARDAR COMENTARIOS (SIN RECARGAR) ==========
 *****************************************************/
async function saveAllComments(silent = false) {
  if (isSaving) return;
  isSaving = true;
  try {
    if (!silent) {
      await showAlert("info", "Guardando cambios...", "Por favor espera", { timer: 3000, timerProgressBar: false });
    }
    const fileRef = AppState.selectedFileData?.ref;
    if (!fileRef) {
      isSaving = false;
      if (!silent) showAlert("error", "Archivo no encontrado", "No se encontró el archivo seleccionado en Firebase.");
      return;
    }
    const metadata = await fileRef.getMetadata();
    const currentVersion = (metadata.customMetadata && metadata.customMetadata.version) || "1";
    if (currentVersion !== AppState.fileVersion) {
      isSaving = false;
      if (!silent) showAlert("error", "Conflicto", "El archivo ha sido modificado por otro usuario. Recargue la información antes de guardar sus cambios.");
      return;
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
          isSaving = false;
          if (!silent) showAlert("error", "Error", "No existe la hoja 'Rechazos' en el Excel");
          return;
        }
        let actualRechazos = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const comentariosEditados = {};
        const fotosEditadas = {};

        AppState.rechazosGlobal.forEach(fila => {
          if (fila.Remisión) {
            comentariosEditados[fila.Remisión] = fila.Comentarios || "";
            fotosEditadas[fila.Remisión] = fila.Fotos || "";
          }
        });

        // Actualizar datos en la hoja
        actualRechazos = actualRechazos.map(row => {
          if (row.Remisión && comentariosEditados.hasOwnProperty(row.Remisión)) {
            return {
              ...row,
              Comentarios: comentariosEditados[row.Remisión],
              Fotos: fotosEditadas[row.Remisión] ?? row.Fotos
            };
          }
          return row;
        });

        // Reescribir la hoja "Rechazos"
        const newSheet = XLSX.utils.json_to_sheet(actualRechazos);
        workbook.Sheets["Rechazos"] = newSheet;
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const newBlob = new Blob([wbout], { type: "application/octet-stream" });

        // Subir de nuevo el archivo con nueva versión
        const newVersion = (parseInt(currentVersion) + 1).toString();
        await fileRef.put(newBlob, { customMetadata: { version: newVersion } });
        AppState.selectedFileData = { name: "rechazos.xlsx", ref: fileRef };
        AppState.fileVersion = newVersion;

        if (!silent) {
          showAlert("success", "Guardado", "Los cambios se han guardado correctamente.");
        } else {
          console.log("Autosave: cambios guardados.");
        }
      } catch (error) {
        console.error("Error al actualizar comentarios:", error);
        if (!silent) showAlert("error", "Error", "No se pudo actualizar el archivo con comentarios.");
      } finally {
        isSaving = false;
      }
    };
    reader.readAsBinaryString(blob);
  } catch (error) {
    console.error("Error general al guardar comentarios:", error);
    if (!silent) showAlert("error", "Error", "No se pudieron guardar los comentarios.");
    isSaving = false;
  }
}
