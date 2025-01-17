// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
    authDomain: "loginliverpool.firebaseapp.com",
    projectId: "loginliverpool",
    storageBucket: "loginliverpool.firebasestorage.app", // Asegúrate de que el bucket es correcto
    messagingSenderId: "704223815941",
    appId: "1:704223815941:web:c871525230fb61caf96f6c",
    measurementId: "G-QFEPQ4TSPY",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ========== LISTA DE UID DE ADMINISTRADORES ==========
const adminUIDs = [
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
  // Agrega más UIDs de administradores si es necesario
];

// ========== ELEMENTOS DEL DOM ==========
const logoutButton = document.getElementById("logout-btn");
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const seccionRegistro = document.getElementById('seccionRegistro');
const skuInput = document.getElementById('skuInput');
const skuForm = document.getElementById('skuForm');
const descargarBtn = document.getElementById('descargarBtn');

const adminUploadSection = document.getElementById('adminUploadSection');
const userFilePickerSection = document.getElementById('userFilePickerSection');
const fileSelect = document.getElementById('fileSelect');
const loadFileBtn = document.getElementById('loadFileBtn');

const adminFilesContainer = document.getElementById('adminFilesContainer');

// Variable para el workbook de Excel
let workbook;

// Variable para determinar si el usuario es administrador
let isAdmin = false;

// ========== AUTENTICACIÓN Y VERIFICACIÓN DE ROL ==========
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Verificar si el usuario es administrador
    if (adminUIDs.includes(user.uid)) {
      isAdmin = true;
      mostrarSeccionesAdmin();
      await cargarArchivosDesdeFirestore(); // Cargar archivos al iniciar sesión como admin
      // Nota: No cargar datos desde Firestore aquí, ya que el workbook aún no está cargado
    } else {
      isAdmin = false;
      mostrarSeccionesUsuario();
      await cargarArchivosDesdeFirestore(); // Cargar archivos para usuarios normales
      // Nota: No cargar datos desde Firestore aquí, ya que el workbook aún no está cargado
    }
    console.log(`Usuario autenticado: ${user.email}`);
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

// ========== FUNCIONES PARA MOSTRAR U OCULTAR SECCIONES ==========
function mostrarSeccionesAdmin() {
  adminUploadSection.style.display = '';
  userFilePickerSection.style.display = '';
  adminFilesContainer.style.display = '';
}

function mostrarSeccionesUsuario() {
  adminUploadSection.style.display = 'none';
  userFilePickerSection.style.display = '';
  adminFilesContainer.style.display = 'none';
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

// ========== MANEJO DE ARCHIVOS PARA ADMIN (SUBIDA + DRAG&DROP) ==========
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
  console.log('Usuario actual:', user);
  
  if (!user) {
    Swal.fire({
      icon: 'error',
      title: 'No Autenticado',
      text: 'Debes iniciar sesión para subir archivos.'
    });
    return;
  }

  if (!isAdmin) {
    Swal.fire({
      icon: 'error',
      title: 'Permiso Denegado',
      text: 'Solo los administradores pueden subir archivos.'
    });
    return;
  }

  if (!file) {
    Swal.fire({
      icon: 'warning',
      title: 'Archivo No Seleccionado',
      text: 'Por favor, selecciona un archivo para subir.'
    });
    return;
  }

  const storageRef = storage.ref();
  const fileRef = storageRef.child(`uploads/${Date.now()}_${file.name}`); // Ruta correcta
  console.log(`Referencia del archivo: ${fileRef.fullPath}`);

  Swal.fire({
    title: 'Subiendo archivo...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const uploadTask = fileRef.put(file);

  uploadTask.on('state_changed', 
    (snapshot) => {
      // Opcional: Puedes agregar código para mostrar el progreso de la subida
    }, 
    (error) => {
      console.error('Error al subir el archivo a Firebase Storage:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al subir el archivo',
        text: `No se pudo subir el archivo. Detalles: ${error.message}`
      });
    }, 
    () => {
      // Subida completada exitosamente
      uploadTask.snapshot.ref.getDownloadURL()
        .then((downloadURL) => {
          console.log('URL de descarga obtenida:', downloadURL);
          // Guardar la URL en Firestore
          db.collection('files').add({
            name: file.name,
            url: downloadURL,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            uploadedBy: auth.currentUser.uid
          })
            .then(() => {
              Swal.fire({
                icon: 'success',
                title: 'Archivo subido',
                text: `El archivo "${file.name}" se ha subido correctamente.`
              });
              cargarArchivosDesdeFirestore();
            })
            .catch(error => {
              console.error('Error al guardar en Firestore:', error);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo guardar la información del archivo en la base de datos.'
              });
            });
        })
        .catch(error => {
          console.error('Error al obtener la URL del archivo:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener la URL del archivo subido.'
          });
        });
    }
  );
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
    if (isAdmin) {
      renderAdminFilesList(archivos);
    }
  } catch (error) {
    console.error('Error al obtener archivos desde Firestore:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener la lista de archivos.'
    });
  }
}

// ========== FUNCION PARA CARGAR DATOS DESDE FIRESTORE ==========
async function cargarDatosDesdeFirestore() {
  try {
    // Verificar que el workbook esté cargado
    if (!workbook) {
      throw new Error('El workbook no está cargado.');
    }

    // Cargar registros
    const registrosSnapshot = await db.collection('registros').get();
    const registrosJson = [];
    registrosSnapshot.forEach(doc => {
      registrosJson.push(doc.data());
    });
    // Actualizar la hoja REGISTROS en el workbook
    const registrosSheet = XLSX.utils.json_to_sheet(registrosJson);
    workbook.Sheets['REGISTROS'] = registrosSheet;
    if (!workbook.SheetNames.includes('REGISTROS')) {
      workbook.SheetNames.push('REGISTROS');
    }

    // Cargar mercancia_exceso
    const mercanciaExcesoSnapshot = await db.collection('mercancia_exceso').get();
    const mercanciaExcesoJson = [];
    mercanciaExcesoSnapshot.forEach(doc => {
      mercanciaExcesoJson.push(doc.data());
    });
    // Actualizar la hoja MERCANCIA DE MÁS en el workbook
    const mercanciaExcesoSheet = XLSX.utils.json_to_sheet(mercanciaExcesoJson);
    workbook.Sheets['MERCANCIA DE MÁS'] = mercanciaExcesoSheet;
    if (!workbook.SheetNames.includes('MERCANCIA DE MÁS')) {
      workbook.SheetNames.push('MERCANCIA DE MÁS');
    }

    console.log('Datos de Firestore cargados correctamente.');
  } catch (error) {
    console.error('Error al cargar datos desde Firestore:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudieron cargar los datos desde la base de datos.'
    });
  }
}

// ========== RENDERIZAR OPCIONES EN SELECT ==========
function renderFileSelectOptions(archivos) {
  fileSelect.innerHTML = '<option value="">-- Selecciona un archivo --</option>';
  archivos.forEach((fileObj) => {
    const opt = document.createElement('option');
    opt.value = fileObj.id; // Usamos el ID del documento como valor
    opt.textContent = fileObj.name;
    fileSelect.appendChild(opt);
  });
}

// ========== RENDERIZAR LISTA DE ARCHIVOS PARA ADMIN ==========
function renderAdminFilesList(archivos) {
  if (!isAdmin || !adminFilesContainer) return;
  if (!archivos.length) {
    adminFilesContainer.innerHTML = '<p class="text-muted">No hay archivos subidos.</p>';
    return;
  }
  let html = '';
  archivos.forEach((fileObj) => {
    html += `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="card mb-3 shadow-sm">
          <div class="card-body d-flex flex-column justify-content-between">
            <h5 class="card-title">
              <i class="bi bi-file-earmark-excel"></i> ${fileObj.name}
            </h5>
            <a href="${fileObj.url}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">
              <i class="bi bi-download"></i> Descargar
            </a>
            <button 
              class="btn btn-sm btn-outline-danger mt-2"
              onclick="deleteAdminFile('${fileObj.id}', '${fileObj.url}')"
            >
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
      </div>
    `;
  });
  adminFilesContainer.innerHTML = html;
}

// ========== FUNCIÓN PARA ELIMINAR ARCHIVOS (FIRESTORE Y STORAGE) ==========
function deleteAdminFile(fileId, fileUrl) {
  Swal.fire({
    title: `¿Eliminar este archivo?`,
    text: 'Esta acción eliminará el archivo de Firebase Storage y la base de datos.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      // Eliminar el archivo de Firebase Storage
      const storageRef = storage.refFromURL(fileUrl);
      storageRef.delete()
        .then(() => {
          // Eliminar el documento de Firestore
          db.collection('files').doc(fileId).delete()
            .then(() => {
              Swal.fire('Eliminado', 'El archivo ha sido eliminado exitosamente.', 'success');
              cargarArchivosDesdeFirestore();
            })
            .catch((error) => {
              console.error('Error al eliminar el archivo de Firestore:', error);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo eliminar el archivo de la base de datos.'
              });
            });
        })
        .catch((error) => {
          console.error('Error al eliminar el archivo de Firebase Storage:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo eliminar el archivo de Firebase Storage.'
          });
        });
    }
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

  // Obtener o crear el registro en Firestore
  const registroRef = db.collection('registros').doc(valorSku);
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
    await registrarExceso(item, valorSku, hojaOrigen);
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
    let registrosJson = XLSX.utils.sheet_to_json(registrosSheet) || [];

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

async function registrarExceso(item, sku, hojaOrigen) {
  const excesoRef = db.collection('mercancia_exceso').doc(sku);
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
    let excesoJson = XLSX.utils.sheet_to_json(excesoSheet) || [];

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

// ========== FUNCION PARA DESCARGAR EL LIBRO ACTUALIZADO ==========
if (descargarBtn) {
  descargarBtn.addEventListener('click', function () {
    if (!workbook) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay ningún libro de Excel cargado.'
      });
      return;
    }

    // Generar la hoja COMPARACION antes de descargar
    generarHojaComparacion()
      .then(() => {
        const workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([workbookOut], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'registro_actualizado.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Error al generar la hoja COMPARACION:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo generar la hoja COMPARACION.'
        });
      });
  });
}

// ========== FUNCION PARA GENERAR LA HOJA COMPARACION ==========
async function generarHojaComparacion() {
  try {
    // Verificar que las hojas DATOS y REGISTROS existen
    if (!workbook.Sheets['DATOS']) {
      throw new Error("La hoja 'DATOS' no existe en el libro.");
    }
    if (!workbook.Sheets['REGISTROS']) {
      throw new Error("La hoja 'REGISTROS' no existe en el libro.");
    }

    const datosJson = XLSX.utils.sheet_to_json(workbook.Sheets['DATOS']);

    // Obtener los datos de Firestore
    const [registrosSnapshot, mercanciaExcesoSnapshot] = await Promise.all([
      db.collection('registros').get(),
      db.collection('mercancia_exceso').get()
    ]);

    const registrosMap = {};
    registrosSnapshot.forEach(doc => {
      registrosMap[doc.id.toString().trim().toUpperCase()] = doc.data();
    });

    const mercanciaExcesoMap = {};
    mercanciaExcesoSnapshot.forEach(doc => {
      mercanciaExcesoMap[doc.id.toString().trim().toUpperCase()] = doc.data();
    });

    // Generar los datos para la hoja COMPARACION
    const comparacionData = datosJson.map(dato => {
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

      return {
        SKU: sku,
        DESCRIPCION: dato.DESCRIPCION || '',
        PIEZAS_OBJETIVO: parseInt(dato.PIEZAS) || 0,
        PIEZAS_ESCANEADAS: registro ? registro.PIEZAS : 0,
        ESTATUS: estatus,
        HOJA: dato.HOJA || 'Desconocida'
      };
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

// ========== MANEJO DEL BOTÓN "CARGAR ARCHIVO ELEGIDO" ==========
if (loadFileBtn) {
  loadFileBtn.addEventListener('click', async function () {
    const chosenId = fileSelect.value;
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

// ========== FUNCION PARA CONVERTIR URL A ArrayBuffer ==========
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

// ========== FUNCION PARA CARGAR EL WORKBOOK ==========
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
document.getElementById('borrarBtn').addEventListener('click', async function () {
  Swal.fire({
    title: '¿Estás seguro?',
    text: "Esto eliminará todos los registros de SKUs.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        // Eliminar todas las entradas en 'registros' y 'mercancia_exceso'
        const registrosSnapshot = await db.collection('registros').get();
        const mercanciaExcesoSnapshot = await db.collection('mercancia_exceso').get();

        const batch = db.batch();

        registrosSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });

        mercanciaExcesoSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('Todos los registros y mercancia excedente han sido eliminados de Firestore.');

        // Eliminar las hojas 'REGISTROS', 'MERCANCIA DE MÁS' y 'COMPARACION' si existen
        delete workbook.Sheets['REGISTROS'];
        delete workbook.Sheets['MERCANCIA DE MÁS'];
        delete workbook.Sheets['COMPARACION'];

        // Reiniciar el libro eliminando las hojas correspondientes de SheetNames
        workbook.SheetNames = workbook.SheetNames.filter(sheet => 
          sheet !== 'REGISTROS' && 
          sheet !== 'MERCANCIA DE MÁS' && 
          sheet !== 'COMPARACION'
        );

        // Actualizar la interfaz
        seccionRegistro.style.display = 'none';
        descargarBtn.disabled = true;
        document.getElementById('resultado').innerHTML = '';

        Swal.fire(
          'Eliminado',
          'Todos los datos de SKUs han sido eliminados.',
          'success'
        );
      } catch (error) {
        console.error('Error al eliminar datos de Firestore:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron eliminar los datos de la base de datos.'
        });
      }
    }
  });
});
