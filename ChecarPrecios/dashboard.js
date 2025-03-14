/*****************************************************
 *  ========== LISTA DE ADMINISTRADORES ==========
 *****************************************************/
const adminUIDs = [
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
  "doxhVo1D3aYQqqkqgRgfJ4qcKcU2",
];

/*****************************************************
 *  ========== VARIABLES GLOBALES ==========
 *****************************************************/
let storeGlobal = null;
let roleGlobal = null;
let bossGlobal = null;       // si es vendedor => su jefe
let userNameGlobal = null;   // Para mostrar el nombre en "subido por"
let selectedFileIdGlobal = null;
let workbook = null;
let unsubscribePricesChecked = null;

// Arreglo global de archivos (para filtrar en el cliente)
let allFiles = [];

/*****************************************************
 *  ========== ELEMENTOS DEL DOM ==========
 *****************************************************/
const logoutButton = document.getElementById("logout-btn");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const seccionRegistro = document.getElementById("seccionRegistro");
const skuInput = document.getElementById("skuInput");
const skuForm = document.getElementById("skuForm");
const descargarBtn = document.getElementById("descargarBtn");
const loadFileBtn = document.getElementById("loadFileBtn");
const selectedFileName = document.getElementById("selectedFileName");
const borrarBtn = document.getElementById("borrarBtn");
const confirmFileSelection = document.getElementById("confirmFileSelection");
const adminUploadSection = document.getElementById("adminUploadSection");
const fileListContainer = document.getElementById("fileListContainer");

/*****************************************************
 *  ========== LOGOUT ==========
 *****************************************************/
logoutButton.addEventListener("click", () => {
  auth.signOut()
    .then(() => {
      Swal.fire("Sesión cerrada", "Has cerrado sesión correctamente.", "success")
        .then(() => { window.location.href = "../Login/login.html"; });
    })
    .catch((error) => {
      Swal.fire("Error al cerrar sesión", error.message, "error");
    });
});

/*****************************************************
 *  ========== onAuthStateChanged ==========
 *****************************************************/
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    Swal.fire({
      icon: "warning",
      title: "No Autenticado",
      text: "Debes iniciar sesión para acceder."
    }).then(() => {
      window.location.href = "../Login/login.html";
    });
    return;
  }
  console.log("Usuario autenticado:", user.uid);

  // Determinar si es admin por UID
  const isAdminGlobal = adminUIDs.includes(user.uid);

  if (isAdminGlobal) {
    // Admin
    storeGlobal = "Admin";
    roleGlobal = "admin";
    bossGlobal = "";
    userNameGlobal = "Admin";
    console.log("Usuario es Admin");
  } else {
    // Buscar su doc en Firestore
    const userDoc = await db.collection("usuarios").doc(user.uid).get();
    if (!userDoc.exists) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No se encontró tu registro de tienda/rol. Contacta al administrador."
      }).then(() => {
        window.location.href = "../Login/login.html";
      });
      adminUploadSection.style.display = "none";
      borrarBtn.style.display = "none";
      return;
    }
    const data = userDoc.data();
    storeGlobal = data.store || "SinStore";
    roleGlobal = data.role || "vendedor";
    bossGlobal = data.boss || "";
    userNameGlobal = data.name || "SinNombre";

    // ========= NUEVO: Revisar status =========
    const status = data.status || "";
    if (status !== "aprobado") {
      // Si NO está aprobado, redirigimos
      Swal.fire({
        icon: "info",
        title: "Acceso Restringido",
        text: "Tu cuenta no está aprobada. Por favor, espera la autorización del administrador."
      }).then(() => {
        window.location.href = "../Login/login.html";
      });
      return;
    }

    console.log("storeGlobal:", storeGlobal, "roleGlobal:", roleGlobal, "bossGlobal:", bossGlobal, "userNameGlobal:", userNameGlobal);
  }

  // Mostrar/ocultar secciones según rol
  if (["admin", "jefe", "auxiliar"].includes(roleGlobal)) {
    adminUploadSection.style.display = "block";
    borrarBtn.style.display = "block";
  } else {
    adminUploadSection.style.display = "none";
    borrarBtn.style.display = "none";
  }

  // Cargar archivos
  await fetchAllFiles();  
  renderFilesFiltered();
});


/*****************************************************
 *  ========== DESCARGA TODOS LOS ARCHIVOS (SIN FILTRO) ==========
 *  (Evita "requires an index" al no hacer where(boss,store))
 *****************************************************/
async function fetchAllFiles() {
  try {
    // Obtenemos TODOS los docs, ordenados por uploadedAt
    // (si "orderBy" + "uploadedAt" te exige un índice, quítalo y ordénalo en el cliente)
    const snap = await db.collection("files").orderBy("uploadedAt","desc").get();
    allFiles = [];
    snap.forEach(doc => {
      const d = doc.data();
      allFiles.push({
        id: doc.id,
        name: d.name || "",
        url: d.url || "",
        store: d.store || "",
        uploadedBy: d.uploadedBy || "",
        uploadedAt: d.uploadedAt || null,
        boss: d.boss || ""
      });
    });
    console.log("Archivos totales descargados:", allFiles.length);
  } catch (error) {
    console.error("Error al obtener archivos:", error);
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/*****************************************************
 *  ========== FILTRA Y RENDERIZA LOS ARCHIVOS ==========
 *****************************************************/
function renderFilesFiltered() {
  // Filtrado en el cliente
  let filtered = [...allFiles];

  if (roleGlobal === "admin") {
    // Admin no filtra
  } else if (["jefe", "auxiliar"].includes(roleGlobal)) {
    // Mismo store
    filtered = filtered.filter(f => f.store === storeGlobal);
  } else if (roleGlobal === "vendedor") {
    // Mismo store + boss
    filtered = filtered.filter(f => f.store === storeGlobal && f.boss === bossGlobal);
  }

  // Render
  renderFileSelectOptions(filtered);
}

/*****************************************************
 *  ========== RENDERIZAR LISTA DE ARCHIVOS ==========
 *****************************************************/
function renderFileSelectOptions(archivos) {
  if (!fileListContainer) return;

  fileListContainer.innerHTML = "";
  if (archivos.length === 0) {
    fileListContainer.innerHTML = '<p class="text-muted">No hay archivos disponibles.</p>';
    return;
  }

  archivos.forEach(fileObj => {
    const item = document.createElement("div");
    item.className = "list-group-item d-flex justify-content-between align-items-center flex-wrap";

    const info = document.createElement("div");
    info.textContent = `${fileObj.name} [${fileObj.store}] - Subido por: ${fileObj.uploadedBy}`;

    const btnsDiv = document.createElement("div");

    // Botón Seleccionar
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "btn btn-sm btn-primary me-2";
    selectBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
    selectBtn.addEventListener("click", () => {
      fileListContainer.querySelectorAll(".list-group-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      selectedFileIdGlobal = fileObj.id;
      selectedFileName.textContent = fileObj.name;
      confirmFileSelection.disabled = false;
      console.log("Archivo seleccionado:", fileObj.name, "ID:", fileObj.id);
    });
    btnsDiv.appendChild(selectBtn);

    // Botón Eliminar (solo admin/jefe/auxiliar)
    if (["admin", "jefe", "auxiliar"].includes(roleGlobal)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.addEventListener("click", () => eliminarArchivoSeleccionado(fileObj.id));
      btnsDiv.appendChild(deleteBtn);
    }

    item.appendChild(info);
    item.appendChild(btnsDiv);
    fileListContainer.appendChild(item);
  });
}

/*****************************************************
 *  ========== SUBIR ARCHIVO (DRAG & DROP) ==========
 *****************************************************/
async function handleFile(file) {
  const user = auth.currentUser;
  if (!user) {
    Swal.fire({ icon: "error", title: "No Autenticado", text: "Inicia sesión." });
    return;
  }
  if (!file) {
    Swal.fire({ icon: "warning", title: "Sin Archivo", text: "Selecciona un archivo para subir." });
    return;
  }

  // Solo admin, jefe, auxiliar pueden subir
  if (!["admin", "jefe", "auxiliar"].includes(roleGlobal)) {
    Swal.fire({ icon: "warning", title: "Sin permisos", text: "No puedes subir archivos." });
    return;
  }

  // Si es auxiliar => elegir jefe
  let chosenBoss = "";
  if (roleGlobal === "auxiliar") {
    chosenBoss = await chooseBossForAuxiliar();
    if (chosenBoss === null) {
      // canceló
      Swal.fire({ icon: "info", title: "Cancelado", text: "No se subió ningún archivo." });
      return;
    }
  }

  console.log("Subiendo archivo:", file.name);
  const storageRef = storage.ref();
  const filePath = `uploads/${Date.now()}_${file.name}`;
  const fileRef = storageRef.child(filePath);

  Swal.fire({ title: "Subiendo archivo...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    await fileRef.put(file);
    const url = await fileRef.getDownloadURL();

    // "uploadedBy" = userNameGlobal + (rol)
    const uploaderName = `${userNameGlobal} (${roleGlobal})`;

    let finalBoss = "";
    if (roleGlobal === "jefe") {
      finalBoss = user.uid;
    } else if (roleGlobal === "auxiliar") {
      finalBoss = chosenBoss || "NoEsta";
    } else {
      // admin => sin boss
      finalBoss = "";
    }

    await db.collection("files").add({
      name: file.name,
      url,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy: uploaderName,
      store: storeGlobal,
      boss: finalBoss
    });

    Swal.fire({ icon: "success", title: "Archivo subido", text: "El archivo se subió correctamente." });

    // Recargar la lista
    await fetchAllFiles();
    renderFilesFiltered();
  } catch (error) {
    console.error("Error al subir archivo:", error);
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/*****************************************************
 *  ========== FUNCIÓN: ELEGIR JEFE (AUXILIAR) ==========
 *****************************************************/
async function chooseBossForAuxiliar() {
  try {
    // Obtener jefes en la misma tienda
    const snap = await db.collection("usuarios")
      .where("store","==", storeGlobal)
      .where("role","==","jefe")
      .where("status","==","aprobado")
      .get();
    if (snap.empty) {
      // No hay jefes
      // Ofrecemos subir con boss="NoEsta" o cancelar
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "No hay jefes en tu tienda",
        text: "¿Deseas subir el archivo sin jefe?",
        showCancelButton: true,
        confirmButtonText: "Subir sin jefe",
        cancelButtonText: "Cancelar"
      });
      if (isConfirmed) {
        return "NoEsta";
      } else {
        return null; // Cancela
      }
    }

    // Construir <option> para sweetalert
    let htmlOptions = "<option value=''>--Selecciona Jefe--</option>";
    snap.forEach(doc => {
      const d = doc.data();
      const bossName = d.name || d.email || "Jefe";
      htmlOptions += `<option value="${doc.id}">${bossName}</option>`;
    });

    const { value: selectedBoss } = await Swal.fire({
      title: "Selecciona Jefe",
      html: `
        <select id="auxBossSelect" class="form-select">
          ${htmlOptions}
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const sel = document.getElementById("auxBossSelect");
        return sel.value;
      }
    });

    if (!selectedBoss) {
      // no eligió
      return null;
    }
    return selectedBoss;
  } catch (error) {
    console.error("Error al elegir jefe:", error);
    return null;
  }
}

/*****************************************************
 *  ========== DRAG & DROP EVENTOS ==========
 *****************************************************/
if (dropzone) {
  dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  dropzone.addEventListener("click", () => {
    if (fileInput) fileInput.click();
  });
}
if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });
}

/*****************************************************
 *  ========== ELIMINAR ARCHIVO ==========
 *****************************************************/
async function eliminarArchivoSeleccionado(fileId) {
  if (!["admin", "jefe", "auxiliar"].includes(roleGlobal)) {
    Swal.fire({ icon: "warning", title: "Sin permisos", text: "No puedes eliminar archivos." });
    return;
  }
  try {
    const fileDoc = await db.collection("files").doc(fileId).get();
    if (!fileDoc.exists) {
      Swal.fire({ icon: "error", title: "Error", text: "El archivo no existe en la base de datos." });
      return;
    }
    const fileData = fileDoc.data();
    const fileUrl = fileData.url;

    // Eliminar subcolección 'prices_checked'
    const pricesCheckedSnap = await db.collection("files").doc(fileId).collection("prices_checked").get();
    if (!pricesCheckedSnap.empty) {
      const batch = db.batch();
      pricesCheckedSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    // Eliminar doc principal
    await db.collection("files").doc(fileId).delete();

    // Eliminar archivo en Storage
    if (fileUrl) {
      const storageRef = storage.refFromURL(fileUrl);
      await storageRef.delete();
    }

    Swal.fire({ icon: "success", title: "Eliminado", text: "Archivo y SKUs eliminados." });

    // Si estaba seleccionado
    if (selectedFileIdGlobal === fileId) {
      selectedFileIdGlobal = null;
      workbook = null;
      seccionRegistro.style.display = "none";
      descargarBtn.disabled = true;
      selectedFileName.textContent = "No se ha seleccionado ningún archivo.";
      loadFileBtn.disabled = true;
      if (unsubscribePricesChecked) {
        unsubscribePricesChecked();
        unsubscribePricesChecked = null;
      }
    }

    // Quitar de allFiles y volver a render
    allFiles = allFiles.filter(f => f.id !== fileId);
    renderFilesFiltered();
  } catch (error) {
    console.error("Error al eliminar archivo:", error);
    Swal.fire({ icon: "error", title: "Error", text: `No se pudo eliminar el archivo. ${error.message}` });
  }
}

/*****************************************************
 *  ========== CONFIRMAR SELECCIÓN DE ARCHIVO ==========
 *****************************************************/
if (confirmFileSelection) {
  confirmFileSelection.addEventListener("click", () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: "warning", title: "No se ha seleccionado ningún archivo", text: "Elige un archivo para continuar." });
      return;
    }
    const activeItem = document.querySelector(".list-group-item.active");
    const fileName = activeItem ? activeItem.querySelector("div").textContent : "No seleccionado";
    selectedFileName.textContent = fileName;

    const fileSelectionModal = bootstrap.Modal.getInstance(document.getElementById("fileSelectionModal"));
    if (fileSelectionModal) {
      fileSelectionModal.hide();
      document.activeElement.blur();
    }

    loadFileBtn.disabled = false;
  });
}

/*****************************************************
 *  ========== BOTÓN "CARGAR ARCHIVO ELEGIDO" ==========
 *****************************************************/
if (loadFileBtn) {
  loadFileBtn.addEventListener("click", async () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: "info", title: "No has seleccionado ningún archivo" });
      return;
    }
    try {
      const doc = await db.collection("files").doc(selectedFileIdGlobal).get();
      if (!doc.exists) {
        Swal.fire({ icon: "error", title: "Error", text: "No se encontró el archivo en la lista." });
        return;
      }
      const data = doc.data();
      workbook = null;

      const arrayBuffer = await base64ToArrayBufferFromURL(data.url);
      await loadWorkbookFromArrayBuffer(arrayBuffer, selectedFileIdGlobal);

      seccionRegistro.style.display = "block";
      loadFileBtn.disabled = true;

      await setupPricesCheckedListener(selectedFileIdGlobal);
    } catch (error) {
      console.error("Error al cargar el archivo:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar el archivo seleccionado." });
    }
  });
}

/*****************************************************
 *  ========== BOTÓN BORRAR (solo admin/jefe/auxiliar) ==========
 *****************************************************/
if (borrarBtn) {
  borrarBtn.addEventListener("click", async () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: "error", title: "Error", text: "No has seleccionado ningún archivo." });
      return;
    }
    if (!["admin", "jefe", "auxiliar"].includes(roleGlobal)) {
      Swal.fire({ icon: "warning", title: "Sin permisos", text: "No puedes eliminar archivos." });
      return;
    }
    const fileId = selectedFileIdGlobal;
    Swal.fire({
      title: "¿Estás seguro?",
      text: "Esto eliminará el archivo y todos sus SKUs verificados.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    }).then(async (result) => {
      if (result.isConfirmed) {
        await eliminarArchivoSeleccionado(fileId);
      }
    });
  });
}

/*****************************************************
 *  ========== SKU INPUT: DETECTAR 10+ DÍGITOS ==========
 *****************************************************/
skuInput.addEventListener("input", () => {
  if (skuInput.value.length >= 10) {
    skuForm.requestSubmit();
  }
});

/*****************************************************
 *  ========== FORMULARIO SKU (VERIFICAR) ==========
 *****************************************************/
skuForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const valorSku = skuInput.value.trim().toUpperCase();

  if (!valorSku) {
    Swal.fire({ icon: "warning", title: "Aviso", text: "Ingresa un SKU válido." });
    return;
  }

  if (!workbook || !workbook.Sheets["DATOS"]) {
    Swal.fire({ icon: "error", title: "Error", text: "No se ha cargado la hoja 'DATOS' en el Excel." });
    return;
  }

  const datosSheet = workbook.Sheets["DATOS"];
  const datosJson = XLSX.utils.sheet_to_json(datosSheet);

  const item = datosJson.find(row =>
    row.SKU && row.SKU.toString().trim().toUpperCase() === valorSku
  );
  if (!item) {
    Swal.fire({ icon: "error", title: "SKU no encontrado", text: `El SKU ${valorSku} no está en la hoja 'DATOS'.` });
    skuInput.value = "";
    return;
  }

  const descripcion = item.DESCRIPCION || "Sin descripción";
  const piezas = item.PIEZAS || "N/A";
  const precio = item.PRECIO || "Sin precio";

  if (!selectedFileIdGlobal) {
    Swal.fire({ icon: "error", title: "Archivo No Seleccionado", text: "Selecciona un archivo." });
    return;
  }

  const priceCheckRef = db.collection("files").doc(selectedFileIdGlobal).collection("prices_checked").doc(valorSku);
  const docSnap = await priceCheckRef.get();
  if (docSnap.exists) {
    const data = docSnap.data();
    Swal.fire({
      icon: "info",
      title: "SKU ya verificado",
      text: `El SKU ${valorSku} ya fue verificado. Precio: $${data.PRECIO}.`
    });
    skuInput.value = "";
    return;
  }

  const confirmResult = await Swal.fire({
    title: "Verificar Precio",
    html: `
      <p><strong>SKU:</strong> ${valorSku}</p>
      <p><strong>Descripción:</strong> ${descripcion}</p>
      <p><strong>Piezas:</strong> ${piezas}</p>
      <p><strong>Precio:</strong> $${precio}</p>
      <hr>
      <p>¿El precio en la etiqueta está correcto?</p>
    `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Es correcto",
    cancelButtonText: "Está mal"
  });
  const sacarEtiquetas = confirmResult.isConfirmed ? "NO SACAR ETIQUETA" : "SI SACAR ETIQUETA";

  await priceCheckRef.set({
    SKU: valorSku,
    DESCRIPCION: descripcion,
    PIEZAS: piezas,
    PRECIO: precio,
    SACAR_ETIQUETAS: sacarEtiquetas,
    FECHA_REGISTRO: firebase.firestore.FieldValue.serverTimestamp()
  });

  await reconstruirHojaPreciosChecados(selectedFileIdGlobal, workbook);

  Swal.fire({
    icon: "success",
    title: "Artículo Verificado",
    text: `El SKU ${valorSku} se registró correctamente. SACAR_ETIQUETAS = ${sacarEtiquetas}`
  });
  skuInput.value = "";
});

/*****************************************************
 *  ========== FUNCIONES AUXILIARES ==========
 *****************************************************/
async function base64ToArrayBufferFromURL(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error al obtener arrayBuffer:", error);
    Swal.fire({ icon: "error", title: "Error", text: "No se pudo obtener el archivo." });
    return null;
  }
}

function eliminarHojaPreciosChecados(wb) {
  if (wb.Sheets["PRECIOS CHECADOS"]) {
    delete wb.Sheets["PRECIOS CHECADOS"];
  }
  wb.SheetNames = wb.SheetNames.filter(n => n !== "PRECIOS CHECADOS");
}

async function reconstruirHojaPreciosChecados(fileId, wb) {
  eliminarHojaPreciosChecados(wb);
  const snapshot = await db.collection("files").doc(fileId).collection("prices_checked").get();
  if (snapshot.empty) {
    wb.Sheets["PRECIOS CHECADOS"] = XLSX.utils.json_to_sheet([]);
    wb.SheetNames.push("PRECIOS CHECADOS");
    return;
  }
  const arr = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    arr.push({
      SKU: d.SKU || "",
      DESCRIPCION: d.DESCRIPCION || "",
      PIEZAS: d.PIEZAS || "N/A",
      PRECIO: d.PRECIO || "Sin precio",
      SACAR_ETIQUETAS: d.SACAR_ETIQUETAS || "NO"
    });
  });
  const sheet = XLSX.utils.json_to_sheet(arr);
  wb.Sheets["PRECIOS CHECADOS"] = sheet;
  wb.SheetNames.push("PRECIOS CHECADOS");
}

async function loadWorkbookFromArrayBuffer(arrayBuffer, fileId) {
  if (!arrayBuffer) {
    Swal.fire({ icon: "error", title: "Error", text: "No se pudo obtener el archivo." });
    return null;
  }
  try {
    if (arrayBuffer.byteLength === 0) {
      throw new Error("El archivo está vacío.");
    }
    const newWb = XLSX.read(arrayBuffer, { type: "array" });

    if (!newWb.Sheets["DATOS"]) {
      Swal.fire({ icon: "error", title: "Error", text: "No existe la hoja 'DATOS' en el Excel." });
      return null;
    }

    await reconstruirHojaPreciosChecados(fileId, newWb);
    workbook = newWb;

    seccionRegistro.style.display = "block";
    descargarBtn.disabled = false;

    Swal.fire({
      icon: "success",
      title: "Archivo Cargado",
      text: "El archivo Excel se cargó correctamente."
    });
    return newWb;
  } catch (error) {
    console.error("Error al parsear Excel:", error);
    Swal.fire({ icon: "error", title: "Error", text: error.message });
    return null;
  }
}

/*****************************************************
 *  ========== BOTÓN DESCARGAR ==========
 *****************************************************/
if (descargarBtn) {
  descargarBtn.addEventListener("click", async () => {
    if (!selectedFileIdGlobal) {
      Swal.fire({ icon: "warning", title: "Sin Archivo", text: "Selecciona un archivo primero." });
      return;
    }
    if (!workbook) {
      Swal.fire({ icon: "error", title: "Error", text: "No hay ningún libro de Excel cargado." });
      return;
    }
    try {
      const wbOut = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], { type: "application/octet-stream" });
      const fileDoc = await db.collection("files").doc(selectedFileIdGlobal).get();
      if (!fileDoc.exists) {
        Swal.fire({ icon: "error", title: "Error", text: "No se encontró el archivo en Firestore." });
        return;
      }
      const fileData = fileDoc.data();
      const originalUrl = fileData.url;
      const storageRef = storage.refFromURL(originalUrl);

      await storageRef.put(blob);
      const updatedUrl = await storageRef.getDownloadURL();
      await db.collection("files").doc(selectedFileIdGlobal).update({ url: updatedUrl });

      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = "precios_checados_actualizado.xlsx";
      a.click();
      URL.revokeObjectURL(localUrl);

      Swal.fire({
        icon: "success",
        title: "Archivo Actualizado",
        text: "El archivo se actualizó y descargó correctamente."
      });
    } catch (error) {
      console.error("Error al subir/descargar Excel:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo actualizar el archivo." });
    }
  });
}

/*****************************************************
 *  ========== LISTENER TIEMPO REAL 'prices_checked' ==========
 *****************************************************/
async function setupPricesCheckedListener(fileId) {
  if (unsubscribePricesChecked) unsubscribePricesChecked();
  unsubscribePricesChecked = db.collection("files").doc(fileId).collection("prices_checked")
    .onSnapshot(snapshot => {
      const arr = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        arr.push({
          SKU: d.SKU || "",
          DESCRIPCION: d.DESCRIPCION || "",
          PIEZAS: d.PIEZAS || "N/A",
          PRECIO: d.PRECIO || "Sin precio",
          SACAR_ETIQUETAS: d.SACAR_ETIQUETAS || "NO"
        });
      });
      if (workbook) {
        eliminarHojaPreciosChecados(workbook);
        const sheet = XLSX.utils.json_to_sheet(arr);
        workbook.Sheets["PRECIOS CHECADOS"] = sheet;
        workbook.SheetNames.push("PRECIOS CHECADOS");
        console.log("Hoja PRECIOS CHECADOS actualizada con snapshot:", arr);

        Swal.fire({
          icon: "info",
          title: "Actualización",
          text: "El archivo se actualizó con las últimas verificaciones."
        });
      }
    }, error => {
      console.error("Error en listener prices_checked:", error);
    });
}
