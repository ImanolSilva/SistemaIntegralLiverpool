/**** INICIO DEL CÓDIGO JS ****/

let workbook; 
const datosSheetName = 'DATOS';
const registrosSheetName = 'REGISTROS';
const excesoSheetName = 'MERCANCIA DE MÁS';

// Simular roles
let isAdmin = false;

// Archivos subidos (localStorage)
let adminFiles = [];

// Elementos del DOM
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const seccionRegistro = document.getElementById('seccionRegistro');
const skuInput = document.getElementById('skuInput');
const skuForm = document.getElementById('skuForm');
const descargarBtn = document.getElementById('descargarBtn');
const borrarBtn = document.getElementById('borrarBtn');

const adminUploadSection = document.getElementById('adminUploadSection');
const userFilePickerSection = document.getElementById('userFilePickerSection');
const fileSelect = document.getElementById('fileSelect');
const loadFileBtn = document.getElementById('loadFileBtn');

// NUEVO: para mostrar la lista con “Eliminar archivo”
const adminFilesList = document.getElementById('adminFilesList');
const adminFilesContainer = document.getElementById('adminFilesContainer');

// ---------------------------------------------------
// Al cargar la página
// ---------------------------------------------------
window.addEventListener('DOMContentLoaded', function () {
  // ¿Eres admin?
  isAdmin = confirm("¿Eres administrador?\nAceptar = Sí, Cancelar = No");

  // Cargar los archivos subidos
  loadAdminFilesFromStorage();

  // Si admin => ve “Subir archivos” + “Lista de archivos” + “Elegir archivo”
  // Si usuario => no ve “Subir archivos”, pero sí “Elegir archivo”
  if (isAdmin) {
    adminUploadSection.style.display = '';
    userFilePickerSection.style.display = '';
    // También mostramos la lista de archivos subidos
    if (adminFilesList) adminFilesList.style.display = '';
    renderAdminFilesList(); // <-- dibujamos la lista
  } else {
    // Usuario normal no sube => ocultamos
    adminUploadSection.style.display = 'none';
    userFilePickerSection.style.display = '';
    if (adminFilesList) adminFilesList.style.display = 'none'; 
    // No puede borrar datos
    if (borrarBtn) {
      borrarBtn.style.display = 'none';
    }
  }

  // Rellenar el <select> con adminFiles
  renderFileSelectOptions();

  // Cargar registros locales
  const registrosGuardados = localStorage.getItem('registrosData');
  if (registrosGuardados) {
    if (!workbook) {
      workbook = XLSX.utils.book_new();
    }
    const registrosJson = JSON.parse(registrosGuardados);
    const nuevaHojaRegistros = XLSX.utils.json_to_sheet(registrosJson);
    workbook.Sheets[registrosSheetName] = nuevaHojaRegistros;

    if (!workbook.SheetNames.includes(registrosSheetName)) {
      workbook.SheetNames.push(registrosSheetName);
    }

    // Mostrar sección “Registrar”
    seccionRegistro.style.display = '';
    descargarBtn.disabled = false;

    console.log('Datos registrados cargados desde LocalStorage.');
  }

  enfocarFormulario();
});

// ---------------------------------------------------
// Enfocar SKU
// ---------------------------------------------------
function enfocarFormulario() {
  if (skuInput) skuInput.focus();
}

// ---------------------------------------------------
// Manejo de Archivos para ADMIN (subir + drag&drop)
// ---------------------------------------------------
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

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const fileData = e.target.result;
      Swal.fire({
        title: 'Nombre para este archivo',
        input: 'text',
        inputLabel: 'Ej. "Inventario-Agosto"',
        showCancelButton: true
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const fileName = result.value.trim();
          if (!fileName) {
            Swal.fire('Operación cancelada', '', 'info');
            return;
          }
          // Checar duplicado
          const existe = adminFiles.some(
            f => f.name.toLowerCase() === fileName.toLowerCase()
          );
          if (existe) {
            Swal.fire({
              icon: 'error',
              title: 'Nombre duplicado',
              text: `Ya existe un archivo llamado "${fileName}".`,
            });
            return;
          }
          // Convertir arrayBuffer -> base64
          const base64 = arrayBufferToBase64(fileData);
          adminFiles.push({ name: fileName, dataBase64: base64 });
          saveAdminFilesToStorage();

          Swal.fire({
            icon: 'success',
            title: 'Archivo guardado',
            text: `El archivo se subió como "${fileName}".`
          });
          // Actualizamos <select> y la lista
          renderFileSelectOptions();
          renderAdminFilesList();
        }
      });
    } catch (error) {
      console.error('Error al leer el archivo:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al leer el archivo',
        text: 'Verifica que sea un archivo Excel válido.'
      });
    }
  };
  reader.readAsArrayBuffer(file);
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// ---------------------------------------------------
// Guardar y Cargar adminFiles en localStorage
// ---------------------------------------------------
function saveAdminFilesToStorage() {
  localStorage.setItem('adminFiles', JSON.stringify(adminFiles));
}
function loadAdminFilesFromStorage() {
  const stored = localStorage.getItem('adminFiles');
  if (stored) {
    adminFiles = JSON.parse(stored);
  }
}

// ---------------------------------------------------
// Renderizar la lista de archivos en <select>
/// Para que Admin/Usuario pueda elegir
// ---------------------------------------------------
function renderFileSelectOptions() {
  fileSelect.innerHTML = '<option value="">-- Selecciona un archivo --</option>';
  adminFiles.forEach((fileObj) => {
    const opt = document.createElement('option');
    opt.value = fileObj.name;
    opt.textContent = fileObj.name;
    fileSelect.appendChild(opt);
  });
}

// ---------------------------------------------------
// Renderizar la lista de archivos con botón “Eliminar”
// (Sólo Admin la ve, en <div id="adminFilesContainer"> )
// ---------------------------------------------------
function renderAdminFilesList() {
    if (!isAdmin || !adminFilesContainer) return;
    if (!adminFiles.length) {
      adminFilesContainer.innerHTML = '<p class="text-muted">No hay archivos subidos.</p>';
      return;
    }
    let html = '';
    adminFiles.forEach((fileObj, idx) => {
      html += `
        <div class="col-sm-6 col-md-4 col-lg-3">
          <div class="card mb-3 shadow-sm">
            <div class="card-body d-flex flex-column justify-content-between">
              <h5 class="card-title">
                <i class="bi bi-file-earmark-excel"></i> ${fileObj.name}
              </h5>
              <button 
                class="btn btn-sm btn-outline-danger mt-2"
                onclick="deleteAdminFile(${idx})"
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
  
  

// Función para eliminar un archivo subido
function deleteAdminFile(index) {
  const fileName = adminFiles[index].name;
  Swal.fire({
    title: `¿Eliminar el archivo "${fileName}"?`,
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      adminFiles.splice(index, 1);
      saveAdminFilesToStorage();
      // Refrescamos el <select> y la tabla:
      renderFileSelectOptions();
      renderAdminFilesList();
      
      Swal.fire('Eliminado', `El archivo "${fileName}" ha sido eliminado.`, 'success');
    }
  });
}

// ---------------------------------------------------
// Botón “Cargar Archivo Elegido”
// ---------------------------------------------------
if (loadFileBtn) {
  loadFileBtn.addEventListener('click', function () {
    const chosenName = fileSelect.value;
    if (!chosenName) {
      Swal.fire({
        icon: 'info',
        title: 'No has seleccionado ningún archivo'
      });
      return;
    }
    const fileObj = adminFiles.find(f => f.name === chosenName);
    if (!fileObj) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el archivo en la lista.'
      });
      return;
    }
    const arrayBuffer = base64ToArrayBuffer(fileObj.dataBase64);
    loadWorkbookFromArrayBuffer(arrayBuffer);
  });
}
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------
// Cargar en workbook (SheetJS)
/// Muestra “seccionRegistro” y habilita descargar
// ---------------------------------------------------
function loadWorkbookFromArrayBuffer(arrayBuffer) {
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
    if (!workbook.Sheets[datosSheetName]) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `El archivo no contiene una hoja llamada '${datosSheetName}'.`
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
    enfocarFormulario();
  } catch (error) {
    console.error('Error al parsear el archivo:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo leer el archivo. Verifica que sea un archivo Excel válido.'
    });
  }
}

// ---------------------------------------------------
// Registrar SKUs, Excesos, etc.
// ---------------------------------------------------
if (skuForm) {
  skuForm.addEventListener('submit', function (event) {
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

    if (!workbook || !workbook.Sheets[datosSheetName]) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El archivo de datos no se ha cargado correctamente.'
      });
      return;
    }

    const datosSheet = workbook.Sheets[datosSheetName];
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
        text: `El SKU ${valorSku} no se encuentra en la hoja ${datosSheetName}.`
      });
      skuInput.value = '';
      return;
    }

    const piezasObjetivo = parseInt(item.PIEZAS) || 0;
    const hojaOrigen = item.HOJA || 'Desconocida';

    // Obtener o crear la hoja REGISTROS
    const registrosSheet = workbook.Sheets[registrosSheetName];
    const registrosJson = XLSX.utils.sheet_to_json(
      registrosSheet || XLSX.utils.json_to_sheet([])
    );

    let registro = registrosJson.find(
      row => 
        row.SKU &&
        row.SKU.toString().trim().toUpperCase() === valorSku
    );

    if (!registro) {
      registro = {
        SKU: item.SKU,
        DESCRIPCION: item.DESCRIPCION || '',
        PIEZAS: 0,
        HOJA: hojaOrigen,
        ESTATUS: ''
      };
      registrosJson.push(registro);
    }

    // Checar meta
    if (registro.PIEZAS >= piezasObjetivo) {
      registrarExceso(item, valorSku, hojaOrigen);
    } else {
      registrarPieza(registro, registrosJson, piezasObjetivo, resultadoDiv);
    }

    skuInput.value = '';
    enfocarFormulario();
  });
}

function registrarPieza(registro, registrosJson, piezasObjetivo, resultadoDiv) {
  registro.PIEZAS += 1;
  registro.ESTATUS =
    registro.PIEZAS >= piezasObjetivo
      ? 'Completo'
      : `Cantidad faltante: ${piezasObjetivo - registro.PIEZAS}`;

  const nuevaHojaRegistros = XLSX.utils.json_to_sheet(registrosJson);
  workbook.Sheets[registrosSheetName] = nuevaHojaRegistros;
  localStorage.setItem('registrosData', JSON.stringify(registrosJson));

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
  enfocarFormulario();
}

function registrarExceso(item, sku, hojaOrigen) {
  if (!workbook.Sheets[excesoSheetName]) {
    workbook.Sheets[excesoSheetName] = XLSX.utils.json_to_sheet([]);
    workbook.SheetNames.push(excesoSheetName);
  }
  const excesoSheet = workbook.Sheets[excesoSheetName];
  const excesoJson = XLSX.utils.sheet_to_json(excesoSheet);

  let registroExceso = excesoJson.find(
    row => row.SKU && row.SKU.toString().trim().toUpperCase() === sku
  );
  if (registroExceso) {
    if (!registroExceso.PIEZAS_EXCESO) {
      registroExceso.PIEZAS_EXCESO = 1;
    } else {
      registroExceso.PIEZAS_EXCESO += 1;
    }
  } else {
    registroExceso = {
      SKU: sku,
      DESCRIPCION: item.DESCRIPCION || '',
      HOJA: hojaOrigen,
      ESTADO: 'Exceso',
      PIEZAS_EXCESO: 1
    };
    excesoJson.push(registroExceso);
  }
  const nuevaHojaExceso = XLSX.utils.json_to_sheet(excesoJson);
  workbook.Sheets[excesoSheetName] = nuevaHojaExceso;

  Swal.fire({
    icon: 'warning',
    title: 'Exceso de piezas',
    text: `El SKU ${sku} ha superado la meta. Se incrementa el exceso en 1.`
  });
}

// ---------------------------------------------------
// Botones Borrar y Descargar
// ---------------------------------------------------
if (borrarBtn) {
  borrarBtn.addEventListener('click', function () {
    if (!isAdmin) {
      return;
    }
    Swal.fire({
      title: '¿Estás seguro de que deseas borrar todos los datos registrados?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        delete workbook.Sheets[registrosSheetName];
        delete workbook.Sheets[excesoSheetName];
        workbook.SheetNames = workbook.SheetNames.filter(
          (name) => name !== registrosSheetName && name !== excesoSheetName
        );

        localStorage.removeItem('registrosData');

        const resultadoDiv = document.getElementById('resultado');
        if (resultadoDiv) {
          resultadoDiv.innerHTML = '';
        }

        if (descargarBtn) {
          descargarBtn.disabled = true;
        }

        Swal.fire({
          icon: 'success',
          title: 'Datos borrados',
          text: 'Los datos registrados han sido borrados exitosamente.'
        });
        enfocarFormulario();
      }
    });
  });
}

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
    const workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([workbookOut], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registro_actualizado.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  });
}
/**** FIN DEL CÓDIGO JS ****/
