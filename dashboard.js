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

// Especificar explícitamente el bucket de almacenamiento
const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");
// Inicializar Firestore y Auth
const db = firebase.firestore();
const auth = firebase.auth();

// ========== LISTA DE ADMINISTRADORES ==========
const adminUIDs = [
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
  "UID_ADMIN_2",
  // Añade aquí los UIDs de los administradores
];

// ========== ELEMENTOS DEL DOM ==========
const logoutButton = document.getElementById("logout-btn");
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const seccionRegistro = document.getElementById('seccionRegistro');
const skuInput = document.getElementById('skuInput');
const skuForm = document.getElementById('skuForm');
const descargarBtn = document.getElementById('descargarBtn');

const userFilePickerSection = document.getElementById('userFilePickerSection');
const loadFileBtn = document.getElementById('loadFileBtn');

const selectedFileName = document.getElementById('selectedFileName');

const borrarBtn = document.getElementById('borrarBtn'); // Botón para borrar datos registrados

// Variable para el workbook de Excel
let workbook = null;

// Variable global para almacenar el ID del archivo seleccionado
let selectedFileIdGlobal = null;

// Variable global para almacenar el estado de administrador
let isAdminGlobal = false;

// ========== FUNCIONES AUXILIARES ==========

// Función para convertir URL a ArrayBuffer
async function base64ToArrayBufferFromURL(url) {
  try {
    const response = await fetch(url);
    console.log('Estado de la respuesta:', response.status);
    console.log('Headers de la respuesta:', response.headers);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const contentType = response.headers.get('Content-Type');
    console.log('Content-Type:', contentType);
    const arrayBuffer = await response.arrayBuffer();

    // Convertir arrayBuffer a string para inspección
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer.slice(0, 100)); // Solo los primeros 100 caracteres
    console.log('Contenido del arrayBuffer (primeros 100 caracteres):', text);

    return arrayBuffer;
  } catch (error) {
    console.error('Error al obtener el arrayBuffer desde la URL:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener el contenido del archivo.'
    });
    return null;
  }
}

// ========== FUNCIONES PARA MOSTRAR SECCIONES ==========
function mostrarSeccionesAdmin() {
  // Mostrar la sección de carga de archivos para administradores
  const adminUploadSection = document.getElementById('adminUploadSection');
  if (adminUploadSection) {
    adminUploadSection.style.display = 'block';
  }

  // Mostrar el botón para borrar datos registrados
  if (borrarBtn) {
    borrarBtn.style.display = 'block';
  }
}

function mostrarSeccionesUsuario() {
  // Ocultar la sección de carga de archivos para administradores si está visible
  const adminUploadSection = document.getElementById('adminUploadSection');
  if (adminUploadSection) {
    adminUploadSection.style.display = 'none';
  }

  // Ocultar el botón para borrar datos registrados
  if (borrarBtn) {
    borrarBtn.style.display = 'none';
  }
}

// ========== FUNCION PARA ELIMINAR ARCHIVOS (ADMIN ONLY) ==========
async function deleteAdminFile(fileId) {
  try {
    // Obtener el documento del archivo en Firestore
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El archivo no existe en la base de datos.'
      });
      return;
    }

    const fileData = fileDoc.data();
    const fileUrl = fileData.url;

    // Confirmar la eliminación
    const confirm = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Quieres eliminar el archivo "${fileData.name}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) {
      return;
    }

    // Eliminar el archivo de Firebase Storage
    const storageRef = storage.refFromURL(fileUrl);
    await storageRef.delete();

    // Eliminar el documento de Firestore
    await db.collection('files').doc(fileId).delete();

    Swal.fire({
      icon: 'success',
      title: 'Archivo Eliminado',
      text: `El archivo "${fileData.name}" ha sido eliminado correctamente.`
    });

    // Actualizar la lista de archivos
    cargarArchivosDesdeFirestore();
  } catch (error) {
    console.error('Error al eliminar el archivo:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo eliminar el archivo. Detalles: ${error.message}`
    });
  }
}

// ========== FUNCION PARA RENDERIZAR OPCIONES DE ARCHIVOS ==========
function renderFileSelectOptions(archivos) {
  const fileListContainer = document.getElementById('fileListContainer');

  if (!fileListContainer) {
    console.error('El elemento con ID "fileListContainer" no existe en el DOM.');
    return;
  }

  fileListContainer.innerHTML = ''; // Limpiar contenido previo

  if (archivos.length === 0) {
    fileListContainer.innerHTML = '<p class="text-muted">No hay archivos disponibles.</p>';
    return;
  }

  archivos.forEach((fileObj) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'mb-2 mb-md-0';
    fileInfo.textContent = fileObj.name;

    const buttonsDiv = document.createElement('div');

    // Botón para seleccionar el archivo (Icono)
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'btn btn-sm btn-primary me-2';
    selectBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
    selectBtn.setAttribute('aria-label', 'Seleccionar archivo');
    selectBtn.addEventListener('click', function () {
      // Remover la clase 'active' de todos los elementos
      const allItems = fileListContainer.querySelectorAll('.list-group-item');
      allItems.forEach(item => item.classList.remove('active'));

      // Añadir la clase 'active' al elemento seleccionado
      this.parentElement.parentElement.classList.add('active');

      // Actualizar el archivo seleccionado
      selectedFileIdGlobal = fileObj.id;
      selectedFileName.textContent = fileObj.name;

      // Habilitar el botón de confirmar selección
      confirmFileSelection.disabled = false;
    });

    buttonsDiv.appendChild(selectBtn);

    // Si el usuario es administrador, añadir botón de eliminar (Icono)
    if (isAdminGlobal) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.setAttribute('aria-label', 'Eliminar archivo');
      deleteBtn.addEventListener('click', function () {
        deleteAdminFile(fileObj.id);
      });

      buttonsDiv.appendChild(deleteBtn);
    }

    fileItem.appendChild(fileInfo);
    fileItem.appendChild(buttonsDiv);

    fileListContainer.appendChild(fileItem);
  });
}

// ========== CARGAR ARCHIVOS DESDE FIRESTORE ==========
async function cargarArchivosDesdeFirestore() {
  try {
    const querySnapshot = await db.collection('files').orderBy('uploadedAt', 'desc').get();
    const archivos = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      archivos.push({
        id: doc.id,
        name: data.name,
        url: data.url
      });
    });
    renderFileSelectOptions(archivos);
  } catch (error) {
    console.error('Error al obtener archivos desde Firestore:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener la lista de archivos.'
    });
  }
}

// ========== CERRAR SESIÓN ==========
logoutButton.addEventListener("click", () => {
  auth.signOut()
    .then(() => {
      Swal.fire("Sesión cerrada", "Has cerrado sesión correctamente.", "success")
        .then(() => {
          window.location.href = "login.html"; // Cambia la ruta si es necesario
        });
    })
    .catch((error) => {
      Swal.fire("Error al cerrar sesión", error.message, "error");
    });
});

// ========== MANEJO DE ARCHIVOS (SUBIDA + DRAG&DROP) ==========
if (dropzone) {
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  dropzone.addEventListener('click', function () {
    if (fileInput) fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });
}

// ========== FUNCION PARA MANEJAR LA SUBIDA DE ARCHIVOS ==========
function handleFile(file) {
  const user = auth.currentUser;

  if (!user) {
    Swal.fire({
      icon: "error",
      title: "No Autenticado",
      text: "Debes iniciar sesión para subir archivos.",
    });
    return;
  }

  if (!file) {
    Swal.fire({
      icon: "warning",
      title: "Archivo No Seleccionado",
      text: "Por favor, selecciona un archivo para subir.",
    });
    return;
  }

  const storageRef = storage.ref();
  const filePath = `uploads/${Date.now()}_${file.name}`;
  const fileRef = storageRef.child(filePath);

  Swal.fire({
    title: "Subiendo archivo...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  fileRef
    .put(file)
    .then(() => {
      fileRef
        .getDownloadURL()
        .then((downloadURL) => {
          db.collection("files")
            .add({
              name: file.name,
              url: downloadURL,
              uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
              uploadedBy: user.uid,
            })
            .then(() => {
              Swal.fire({
                icon: "success",
                title: "Archivo subido",
                text: `El archivo "${file.name}" se ha subido correctamente.`,
              });
              cargarArchivosDesdeFirestore(); // Actualiza la lista de archivos
            })
            .catch((error) => {
              console.error("Error al guardar en Firestore:", error);
              Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo guardar la información del archivo en la base de datos.",
              });
            });
        })
        .catch((error) => {
          console.error("Error al obtener la URL del archivo:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo obtener la URL del archivo subido.",
          });
        });
    })
    .catch((error) => {
      console.error("Error al subir el archivo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `No se pudo subir el archivo. Detalles: ${error.message}`,
      });
    });
}

// ========== MANEJO DEL FORMULARIO DE REGISTRO DE SKU ==========
skuForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  const valorSku = skuInput.value.trim().toUpperCase();
  const resultadoDiv = document.getElementById('resultado');

  if (!valorSku) {
    Swal.fire({
      icon: 'warning',
      title: 'Aviso',
      text: 'Por favor, ingresa un SKU válido.'
    });
    return;
  }

  // Asegúrate de haber cargado el workbook (archivo Excel)
  if (!workbook || !workbook.Sheets['DATOS']) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'El archivo de datos no se ha cargado correctamente.'
    });
    return;
  }

  const datosSheet = workbook.Sheets['DATOS'];
  const datosJson = XLSX.utils.sheet_to_json(datosSheet);

  const item = datosJson.find(
    row => 
      row.SKU && 
      row.SKU.toString().trim().toUpperCase() === valorSku
  );
  if (!item) {
    Swal.fire({
      icon: 'error',
      title: 'SKU no encontrado',
      text: `El SKU ${valorSku} no se encuentra en la hoja DATOS.`
    });
    skuInput.value = '';
    return;
  }

  const piezasObjetivo = parseInt(item.PIEZAS) || 0;
  const hojaOrigen = item.HOJA || 'Desconocida';

  // Obtener la referencia al documento del archivo seleccionado
  const selectedFileId = selectedFileIdGlobal;
  if (!selectedFileId) {
    Swal.fire({
      icon: 'error',
      title: 'Archivo No Seleccionado',
      text: 'Por favor, selecciona un archivo para registrar el SKU.'
    });
    return;
  }

  const registroRef = db.collection('files').doc(selectedFileId).collection('records').doc(valorSku);
  const registroDoc = await registroRef.get();
  let registro = null;

  if (registroDoc.exists) {
    registro = registroDoc.data();
  } else {
    registro = {
      SKU: item.SKU,
      DESCRIPCION: item.DESCRIPCION || '',
      PIEZAS: 0,
      HOJA: hojaOrigen,
      ESTATUS: ''
    };
    await registroRef.set(registro);
  }

  // Checar meta
  if (registro.PIEZAS >= piezasObjetivo) {
    await registrarExceso(selectedFileId, item, valorSku, hojaOrigen, resultadoDiv);
  } else {
    await registrarPieza(registroRef, registro, piezasObjetivo, resultadoDiv);
  }

  skuInput.value = '';
});

// ========== FUNCIONES DE REGISTRO ==========
async function registrarPieza(registroRef, registro, piezasObjetivo, resultadoDiv) {
  registro.PIEZAS += 1;
  registro.ESTATUS =
    registro.PIEZAS >= piezasObjetivo
      ? 'Completo'
      : `Cantidad faltante: ${piezasObjetivo - registro.PIEZAS}`;

  // Actualizar en Firestore
  try {
    await registroRef.update(registro);
  } catch (error) {
    console.error('Error al actualizar el registro en Firestore:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo actualizar el registro en la base de datos.'
    });
    return;
  }

  // Actualizar la hoja REGISTROS en el workbook
  try {
    const registrosSheet = workbook.Sheets['REGISTROS'];
    const registrosJson = XLSX.utils.sheet_to_json(registrosSheet) || [];

    const index = registrosJson.findIndex(row => row.SKU.toString().trim().toUpperCase() === registro.SKU.toString().trim().toUpperCase());
    if (index !== -1) {
      registrosJson[index] = registro;
    } else {
      registrosJson.push(registro);
    }

    const nuevaHojaRegistros = XLSX.utils.json_to_sheet(registrosJson);
    workbook.Sheets['REGISTROS'] = nuevaHojaRegistros;
  } catch (error) {
    console.error('Error al actualizar la hoja REGISTROS en el workbook:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo actualizar la hoja REGISTROS en el archivo Excel.'
    });
    return;
  }

  // Actualizar la interfaz
  let alertClass = 'alert-info';
  if (registro.ESTATUS === 'Completo') {
    alertClass = 'alert-success';
  } else if (registro.ESTATUS.includes('Cantidad faltante')) {
    alertClass = 'alert-warning';
  }

  resultadoDiv.innerHTML = `
    <div class="alert ${alertClass}" role="alert">
      <strong>${registro.SKU}</strong> registrado.<br>
      Piezas: ${registro.PIEZAS}.<br>
      Estatus: <strong>${registro.ESTATUS}</strong>.<br>
      Hoja: <strong>${registro.HOJA || 'Desconocida'}</strong>.
    </div>
  `;
}

async function registrarExceso(fileId, item, sku, hojaOrigen, resultadoDiv) {
  const excesoRef = db.collection('files').doc(fileId).collection('mercancia_exceso').doc(sku);
  const excesoDoc = await excesoRef.get();
  let registroExceso = null;

  if (excesoDoc.exists) {
    registroExceso = excesoDoc.data();
    registroExceso.PIEZAS_EXCESO = (registroExceso.PIEZAS_EXCESO || 0) + 1;
  } else {
    registroExceso = {
      SKU: sku,
      DESCRIPCION: item.DESCRIPCION || '',
      HOJA: hojaOrigen,
      ESTADO: 'Exceso',
      PIEZAS_EXCESO: 1
    };
  }

  // Actualizar en Firestore
  try {
    await excesoRef.set(registroExceso);
  } catch (error) {
    console.error('Error al actualizar la mercancia excedente en Firestore:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo actualizar la mercancia excedente en la base de datos.'
    });
    return;
  }

  // Actualizar la hoja MERCANCIA DE MÁS en el workbook
  try {
    const excesoSheet = workbook.Sheets['MERCANCIA DE MÁS'];
    const excesoJson = XLSX.utils.sheet_to_json(excesoSheet) || [];

    const index = excesoJson.findIndex(row => row.SKU.toString().trim().toUpperCase() === registroExceso.SKU.toString().trim().toUpperCase());
    if (index !== -1) {
      excesoJson[index] = registroExceso;
    } else {
      excesoJson.push(registroExceso);
    }

    const nuevaHojaExceso = XLSX.utils.json_to_sheet(excesoJson);
    workbook.Sheets['MERCANCIA DE MÁS'] = nuevaHojaExceso;
  } catch (error) {
    console.error('Error al actualizar la hoja MERCANCIA DE MÁS en el workbook:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo actualizar la hoja MERCANCIA DE MÁS en el archivo Excel.'
    });
    return;
  }

  Swal.fire({
    icon: 'warning',
    title: 'Exceso de piezas',
    text: `El SKU ${sku} ha superado la meta. Se incrementa el exceso en 1.`
  });
}

// ========== FUNCION PARA GENERAR LA HOJA COMPARACION ==========
async function generarHojaComparacion() {
  try {
    // Verificar que las hojas DATOS y REGISTROS existen
    if (!workbook.Sheets['DATOS']) {
      throw new Error("La hoja 'DATOS' no existe en el libro.");
    }

    // Verificar que la hoja 'REGISTROS' existe, y si no, crearla
    if (!workbook.Sheets['REGISTROS']) {
      console.warn("La hoja 'REGISTROS' no existe en el libro. Se creará una nueva hoja 'REGISTROS'.");
      workbook.Sheets['REGISTROS'] = XLSX.utils.json_to_sheet([]);
      workbook.SheetNames.push('REGISTROS');
      console.log("Hoja 'REGISTROS' creada exitosamente.");
    }

    const datosJson = XLSX.utils.sheet_to_json(workbook.Sheets['DATOS']);

    // Obtener la referencia al documento del archivo seleccionado
    const selectedFileId = selectedFileIdGlobal;
    if (!selectedFileId) {
      throw new Error("No se ha seleccionado ningún archivo para generar la comparación.");
    }

    // Obtener los registros del archivo seleccionado
    const recordsSnapshot = await db.collection('files').doc(selectedFileId).collection('records').get();
    const registrosMap = {};
    recordsSnapshot.forEach(recordDoc => {
      registrosMap[recordDoc.id.toUpperCase()] = recordDoc.data();
    });

    const comparacionData = [];

    datosJson.forEach(dato => {
      const sku = dato.SKU.toString().trim().toUpperCase();

      const registro = registrosMap[sku];
      let estatus = '';

      if (registro) {
        if (registro.PIEZAS >= parseInt(dato.PIEZAS)) {
          estatus = 'Completo';
        } else {
          const faltantes = parseInt(dato.PIEZAS) - registro.PIEZAS;
          estatus = `Cantidad faltante: ${faltantes}`;
        }
      } else {
        estatus = 'No se escaneó';
      }

      comparacionData.push({
        SKU: sku,
        DESCRIPCION: dato.DESCRIPCION || '',
        PIEZAS_OBJETIVO: parseInt(dato.PIEZAS) || 0,
        PIEZAS_ESCANEADAS: registro ? registro.PIEZAS : 0,
        ESTATUS: estatus,
        HOJA: dato.HOJA || 'Desconocida'
      });
    });

    // Crear la hoja COMPARACION con formato
    const comparacionSheet = XLSX.utils.json_to_sheet(comparacionData, { header: ["SKU", "DESCRIPCION", "PIEZAS_OBJETIVO", "PIEZAS_ESCANEADAS", "ESTATUS", "HOJA"] });

    // Aplicar colores básicos basados en el estatus
    // Nota: XLSX.js tiene capacidades limitadas para estilos
    // Aquí se aplica un color de fondo simple basado en el estatus
    comparacionData.forEach((row, index) => {
      const rowIndex = index + 2; // +2 para considerar el encabezado y que Excel inicia en 1
      const estatus = row.ESTATUS;
      let fillColor = {};

      if (estatus === 'Completo') {
        fillColor = { patternType: "solid", fgColor: { rgb: "C6EFCE" } }; // Verde claro
      } else if (estatus.startsWith('Cantidad faltante')) {
        fillColor = { patternType: "solid", fgColor: { rgb: "FFEB9C" } }; // Amarillo claro
      } else if (estatus === 'No se escaneó') {
        fillColor = { patternType: "solid", fgColor: { rgb: "FFC7CE" } }; // Rojo claro
      }

      // Aplicar el color a la columna ESTATUS (E)
      if (fillColor.patternType) {
        const cellAddress = `E${rowIndex}`;
        if (comparacionSheet[cellAddress]) {
          comparacionSheet[cellAddress].s = {
            fill: fillColor
          };
        }
      }
    });

    // Establecer estilos de tabla (encabezados en negrita y color azul claro)
    const headerCells = ["A1", "B1", "C1", "D1", "E1", "F1"];
    headerCells.forEach(cell => {
      if (comparacionSheet[cell]) {
        comparacionSheet[cell].s = {
          font: { bold: true },
          fill: { patternType: "solid", fgColor: { rgb: "BDD7EE" } } // Azul claro
        };
      }
    });

    // Añadir la hoja COMPARACION al workbook
    workbook.Sheets['COMPARACION'] = comparacionSheet;

    // Si la hoja COMPARACION no está en SheetNames, añadirla
    if (!workbook.SheetNames.includes('COMPARACION')) {
      workbook.SheetNames.push('COMPARACION');
    }

    console.log('Hoja COMPARACION generada exitosamente.');
  } catch (error) {
    console.error('Error al generar la hoja COMPARACION:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo generar la hoja COMPARACION. Detalles: ${error.message}`
    });
    throw error; // Lanzar el error para que el catch en el evento de descarga lo maneje
  }
}

// ========== FUNCION PARA DESCARGAR EL LIBRO ACTUALIZADO ==========
if (descargarBtn) {
  descargarBtn.addEventListener('click', async function () {
    if (!workbook) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay ningún libro de Excel cargado.'
      });
      return;
    }

    try {
      // Generar la hoja COMPARACION antes de descargar
      await generarHojaComparacion();

      const workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([workbookOut], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'registro_actualizado.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al generar la hoja COMPARACION:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar la hoja COMPARACION.'
      });
    }
  });
}

// ========== MANEJO DEL BOTÓN "CARGAR ARCHIVO ELEGIDO" ==========
if (loadFileBtn) {
  loadFileBtn.addEventListener('click', async function () {
    const chosenId = selectedFileIdGlobal;
    if (!chosenId) {
      Swal.fire({
        icon: 'info',
        title: 'No has seleccionado ningún archivo'
      });
      return;
    }
    try {
      const doc = await db.collection('files').doc(chosenId).get();
      if (!doc.exists) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró el archivo en la lista.'
        });
        return;
      }
      const data = doc.data();
      console.log('URL del archivo seleccionado:', data.url);
      const arrayBuffer = await base64ToArrayBufferFromURL(data.url);
      loadWorkbookFromArrayBuffer(arrayBuffer);
    } catch (error) {
      console.error('Error al obtener el archivo desde Firestore:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el archivo seleccionado.'
      });
    }
  });
}

// ========== FUNCION PARA CARGAR EL WORKBOOK DESDE UN ArrayBuffer ==========
async function loadWorkbookFromArrayBuffer(arrayBuffer) {
  if (!arrayBuffer) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener el archivo.'
    });
    return;
  }
  try {
    // Verificar que el arrayBuffer tiene datos
    if (arrayBuffer.byteLength === 0) {
      throw new Error('El archivo está vacío.');
    }

    // Opcional: Verificar si los primeros bytes coinciden con el formato de Excel
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const header = String.fromCharCode(...bytes);
    if (!header.startsWith('PK')) { // Los archivos .xlsx comienzan con 'PK'
      throw new Error('El archivo no parece ser un archivo Excel válido.');
    }

    workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Verificar que la hoja 'DATOS' existe
    if (!workbook.Sheets['DATOS']) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `El archivo no contiene una hoja llamada 'DATOS'.`
      });
      return;
    }

    // Crear la hoja 'REGISTROS' si no existe
    if (!workbook.Sheets['REGISTROS']) {
      console.warn("La hoja 'REGISTROS' no existe en el libro. Se creará una nueva hoja 'REGISTROS'.");
      workbook.Sheets['REGISTROS'] = XLSX.utils.json_to_sheet([]);
      workbook.SheetNames.push('REGISTROS');
      console.log("Hoja 'REGISTROS' creada exitosamente.");
    }

    // Confirmar la existencia de 'REGISTROS'
    if (!workbook.Sheets['REGISTROS']) {
      throw new Error("La hoja 'REGISTROS' no pudo ser creada.");
    }

    console.log('Hojas en el workbook:', workbook.SheetNames);

    seccionRegistro.style.display = '';
    descargarBtn.disabled = false;

    Swal.fire({
      icon: 'success',
      title: 'Archivo Cargado',
      text: 'El archivo Excel se cargó correctamente.'
    });
    console.log('Archivo Excel cargado correctamente.');
  } catch (error) {
    console.error('Error al parsear el archivo:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo leer el archivo. Detalles: ${error.message}`
    });
  }
}

// ========== FUNCIÓN PARA BORRAR DATOS REGISTRADOS ==========
if (borrarBtn) { // Asegúrate de que 'borrarBtn' esté definido en tu HTML
  borrarBtn.addEventListener('click', async function () {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esto eliminará todos los registros de SKUs para el archivo seleccionado.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const selectedFileId = selectedFileIdGlobal;
        if (!selectedFileId) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se ha seleccionado ningún archivo.'
          });
          return;
        }
        try {
          // Obtener referencias a las subcolecciones
          const recordsRef = db.collection('files').doc(selectedFileId).collection('records');
          const excesoRef = db.collection('files').doc(selectedFileId).collection('mercancia_exceso');

          // Eliminar todas las entradas en 'records'
          await recordsRef.get().then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            return batch.commit();
          });

          // Eliminar todas las entradas en 'mercancia_exceso'
          await excesoRef.get().then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            return batch.commit();
          });

          // Obtener la URL del archivo antes de eliminar el documento
          const fileDoc = await db.collection('files').doc(selectedFileId).get();
          let fileUrl = null;
          if (fileDoc.exists) {
            fileUrl = fileDoc.data().url;
          }

          // Eliminar el documento principal en 'files'
          await db.collection('files').doc(selectedFileId).delete();

          // Eliminar el archivo de Firebase Storage
          if (fileUrl) {
            const storageRef = storage.refFromURL(fileUrl);
            await storageRef.delete();
          }

          // Eliminar las hojas 'REGISTROS', 'MERCANCIA DE MÁS' y 'COMPARACION' si existen en el workbook
          if (workbook && workbook.Sheets['REGISTROS']) delete workbook.Sheets['REGISTROS'];
          if (workbook && workbook.Sheets['MERCANCIA DE MÁS']) delete workbook.Sheets['MERCANCIA DE MÁS'];
          if (workbook && workbook.Sheets['COMPARACION']) delete workbook.Sheets['COMPARACION'];

          // Reiniciar el libro eliminando las hojas correspondientes de SheetNames
          if (workbook) {
            workbook.SheetNames = workbook.SheetNames.filter(sheet => 
              sheet !== 'REGISTROS' && 
              sheet !== 'MERCANCIA DE MÁS' && 
              sheet !== 'COMPARACION'
            );
          }

          // Actualizar la interfaz
          seccionRegistro.style.display = 'none';
          descargarBtn.disabled = true;
          document.getElementById('resultado').innerHTML = '';
          selectedFileName.textContent = 'No se ha seleccionado ningún archivo.';
          loadFileBtn.disabled = true;

          Swal.fire(
            'Eliminado',
            'Todos los datos de SKUs para el archivo seleccionado han sido eliminados.',
            'success'
          );
          cargarArchivosDesdeFirestore(); // Actualizar la lista de archivos
        } catch (error) {
          console.error('Error al eliminar datos de Firestore:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron eliminar los datos de la base de datos. Verifica los permisos y vuelve a intentarlo.'
          });
        }
      }
    });
  });
}

// ========== AUTENTICACIÓN Y VERIFICACIÓN ==========
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log(`UID del usuario autenticado: ${user.uid}`); // Verificar UID
    cargarArchivosDesdeFirestore(); // Cargar archivos al iniciar sesión
    console.log(`Usuario autenticado: ${user.email}`);

    // Verificar si el usuario es administrador
    isAdminGlobal = adminUIDs.includes(user.uid);
    if (isAdminGlobal) {
      mostrarSeccionesAdmin();
    } else {
      mostrarSeccionesUsuario();
    }
  } else {
    // Usuario no autenticado, redirigir al login
    Swal.fire({
      icon: "warning",
      title: "No Autenticado",
      text: "Debes iniciar sesión para acceder a esta página.",
      confirmButtonText: "Ir al Login",
      confirmButtonColor: "#3085d6"
    }).then(() => {
      window.location.href = "login.html"; // Cambia la ruta si es necesario
    });
  }
});

// ========== MANEJO DE LA SELECCIÓN DE ARCHIVO EN EL MODAL ==========
const confirmFileSelection = document.getElementById('confirmFileSelection');

if (confirmFileSelection) {
  confirmFileSelection.addEventListener('click', function () {
    if (!selectedFileIdGlobal) {
      Swal.fire({
        icon: 'warning',
        title: 'No se ha seleccionado ningún archivo',
        text: 'Por favor, selecciona un archivo para continuar.'
      });
      return;
    }

    // Obtener el nombre del archivo seleccionado
    const activeItem = document.querySelector('.list-group-item.active');
    const fileName = activeItem ? activeItem.querySelector('div').textContent : 'No seleccionado';

    // Actualizar el nombre del archivo seleccionado en la interfaz principal
    selectedFileName.textContent = fileName;

    // Cerrar el Modal
    const fileSelectionModal = bootstrap.Modal.getInstance(document.getElementById('fileSelectionModal'));
    fileSelectionModal.hide();

    // Habilitar el botón de cargar archivo
    loadFileBtn.disabled = false;
  });
}

// ========== EXPONER FUNCIONES GLOBALMENTE ==========
window.deleteAdminFile = deleteAdminFile;
