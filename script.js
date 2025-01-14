// Archivo: script.js

let workbook; // Variable para almacenar el libro de trabajo
const datosSheetName = 'DATOS';
const registrosSheetName = 'REGISTROS';

// Variables para elementos del DOM
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const seccionRegistro = document.getElementById('seccionRegistro');

// Variables para modales
const skuNoEncontradoModal = new bootstrap.Modal(document.getElementById('skuNoEncontradoModal'));
const confirmacionPiezaModal = new bootstrap.Modal(document.getElementById('confirmacionPiezaModal'));
const mensajeConfirmacionPieza = document.getElementById('mensajeConfirmacionPieza');
let confirmarPiezaCallback; // Función de callback para manejar la confirmación

// Función para manejar la carga del archivo
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        workbook = XLSX.read(data, { type: 'array' });

        // Verificar si la hoja DATOS existe
        if (!workbook.Sheets[datosSheetName]) {
            alert(`El archivo no contiene una hoja llamada '${datosSheetName}'.`);
            return;
        }

        // Opcional: Puedes cargar registros desde LocalStorage si lo deseas
        // ...

        // Mostrar la sección de registro
        seccionRegistro.style.display = '';

        // Habilitamos el botón de descarga
        document.getElementById('descargarBtn').disabled = false;
        console.log('Archivo Excel cargado correctamente.');
    };
    reader.onerror = function(error) {
        console.error('Error al leer el archivo:', error);
        alert('No se pudo leer el archivo. Por favor, verifica que sea un archivo Excel válido.');
    };
    reader.readAsArrayBuffer(file);
}

// Manejar eventos de arrastrar y soltar
dropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', function(e) {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Manejar clic en el dropzone para abrir el selector de archivos
dropzone.addEventListener('click', function() {
    fileInput.click();
});

// Manejar cambio en el input file
fileInput.addEventListener('change', function(e) {
    if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
    }
});

// Manejar el envío del formulario de SKU
document.getElementById('skuForm').addEventListener('submit', function(event) {
    event.preventDefault();

    let skuInput = document.getElementById('skuInput').value.trim().toUpperCase();
    let resultadoDiv = document.getElementById('resultado');

    if (!skuInput) {
        alert('Por favor, ingresa un SKU válido.');
        return;
    }

    // Verificar que el workbook y la hoja DATOS existan
    if (!workbook || !workbook.Sheets[datosSheetName]) {
        alert('El archivo de datos no se ha cargado correctamente.');
        return;
    }

    // Obtener la hoja DATOS
    let datosSheet = workbook.Sheets[datosSheetName];
    let datosJson = XLSX.utils.sheet_to_json(datosSheet);

    // Buscar el SKU en la hoja DATOS
    let item = datosJson.find(row => {
        if (row.SKU !== undefined && row.SKU !== null) {
            let sku = row.SKU.toString().trim().toUpperCase();
            return sku === skuInput;
        } else {
            return false;
        }
    });

    if (!item) {
        // Mostrar el modal de SKU no encontrado
        skuNoEncontradoModal.show();
        // Limpiar el campo de entrada
        document.getElementById('skuInput').value = '';
        return;
    }

    // Obtener el número de piezas objetivo para este SKU desde la hoja DATOS
    let piezasObjetivo = parseInt(item.PIEZAS) || 0;

    // Verificar que la hoja REGISTROS exista
    if (!workbook.Sheets[registrosSheetName]) {
        // Si no existe, creamos una nueva hoja con encabezados
        const registrosEncabezados = [['SKU', 'DESCRIPCION', 'PIEZAS']];
        const nuevaHojaRegistros = XLSX.utils.aoa_to_sheet(registrosEncabezados);
        workbook.Sheets[registrosSheetName] = nuevaHojaRegistros;
        if (!workbook.SheetNames.includes(registrosSheetName)) {
            workbook.SheetNames.push(registrosSheetName);
        }
    }

    // Obtener la hoja REGISTROS
    let registrosSheet = workbook.Sheets[registrosSheetName];
    let registrosJson = XLSX.utils.sheet_to_json(registrosSheet);

    // Buscar el SKU en la hoja REGISTROS
    let registro = registrosJson.find(row => {
        if (row.SKU !== undefined && row.SKU !== null) {
            let sku = row.SKU.toString().trim().toUpperCase();
            return sku === skuInput;
        } else {
            return false;
        }
    });

    let piezasActuales = 0;
    if (registro) {
        // Si ya existe, obtenemos la cantidad actual de piezas
        piezasActuales = parseInt(registro.PIEZAS) || 0;
    } else {
        // Si no existe, creamos un nuevo registro con piezas en 0
        registro = {
            SKU: item.SKU,
            DESCRIPCION: item.DESCRIPCION || '',
            PIEZAS: 0
        };
        registrosJson.push(registro);
    }

    // Verificar si se ha alcanzado el número de piezas objetivo
    if (piezasActuales >= piezasObjetivo) {
        // Preparar el mensaje de confirmación
        mensajeConfirmacionPieza.innerHTML = `El SKU <strong>${item.SKU}</strong> ya ha alcanzado el número de piezas objetivo (${piezasObjetivo}).<br>¿Deseas agregar una pieza adicional de todos modos?`;

        // Definir función de callback para cuando el usuario confirma
        confirmarPiezaCallback = function() {
            // Incrementar el número de piezas
            actualizarRegistroPiezas(registro, registrosJson, skuInput, resultadoDiv, item);
            // Cerrar el modal
            confirmacionPiezaModal.hide();
        };

        // Mostrar el modal de confirmación
        confirmacionPiezaModal.show();

    } else {
        // Incrementar el número de piezas directamente
        actualizarRegistroPiezas(registro, registrosJson, skuInput, resultadoDiv, item);
    }

    // Limpiar el campo de entrada
    document.getElementById('skuInput').value = '';
});

// Función para actualizar el registro de piezas
function actualizarRegistroPiezas(registro, registrosJson, skuInput, resultadoDiv, item) {
    // Incrementar el número de piezas
    registro.PIEZAS = (parseInt(registro.PIEZAS) || 0) + 1;

    // Actualizar el registro en registrosJson
    let indiceRegistro = registrosJson.findIndex(row => row.SKU && row.SKU.toString().trim().toUpperCase() === skuInput);
    if (indiceRegistro !== -1) {
        registrosJson[indiceRegistro] = registro;
    } else {
        registrosJson.push(registro);
    }

    // Actualizar la hoja REGISTROS con los nuevos datos
    let nuevaHojaRegistros = XLSX.utils.json_to_sheet(registrosJson);
    workbook.Sheets[registrosSheetName] = nuevaHojaRegistros;

    // Guardar registrosJson en LocalStorage
    localStorage.setItem('registrosData', JSON.stringify(registrosJson));

    resultadoDiv.innerHTML = `<div class="alert alert-success" role="alert">
        SKU <strong>${item.SKU}</strong> registrado exitosamente. Pieza(s): ${registro.PIEZAS}
    </div>`;
}

// Manejar el evento de confirmación de agregar pieza adicional
document.getElementById('confirmarPiezaBtn').addEventListener('click', function() {
    if (typeof confirmarPiezaCallback === 'function') {
        confirmarPiezaCallback();
    }
});

// Manejar el evento de cancelar en el modal de confirmación
document.getElementById('cancelarPiezaBtn').addEventListener('click', function() {
    // Cerrar el modal y restablecer la función de callback
    confirmarPiezaCallback = null;
});

// Manejar el evento click del botón de borrar registros
document.getElementById('borrarBtn').addEventListener('click', function() {
    let confirmacion = confirm('¿Estás seguro de que deseas borrar todos los datos registrados? Esta acción no se puede deshacer.');
    if (confirmacion) {
        // Eliminar los datos de REGISTROS en el workbook
        delete workbook.Sheets[registrosSheetName];
        workbook.SheetNames = workbook.SheetNames.filter(name => name !== registrosSheetName);

        // Eliminar los datos de REGISTROS del LocalStorage
        localStorage.removeItem('registrosData');

        // Limpiar el área de resultado
        document.getElementById('resultado').innerHTML = '';

        alert('Los datos registrados han sido borrados exitosamente.');

        console.log('Los datos de REGISTROS han sido borrados.');
    }
});

// Manejar el evento click del botón de descargar el Excel actualizado
document.getElementById('descargarBtn').addEventListener('click', function() {
    // Antes de descargar, aseguramos que los datos de REGISTROS estén actualizados en el workbook

    // Actualizar REGISTROS en el workbook
    let registrosLocal = localStorage.getItem('registrosData');
    if (registrosLocal) {
        let registrosJson = JSON.parse(registrosLocal);
        let nuevaHojaRegistros = XLSX.utils.json_to_sheet(registrosJson);
        workbook.Sheets[registrosSheetName] = nuevaHojaRegistros;

        // Aseguramos que REGISTROS esté en la lista de hojas
        if (!workbook.SheetNames.includes(registrosSheetName)) {
            workbook.SheetNames.push(registrosSheetName);
        }
    } else {
        // Si no hay datos de REGISTROS, eliminar la hoja del workbook
        delete workbook.Sheets[registrosSheetName];
        workbook.SheetNames = workbook.SheetNames.filter(name => name !== registrosSheetName);
    }

    let workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    let blob = new Blob([workbookOut], { type: 'application/octet-stream' });

    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'registro_actualizado.xlsx';
    a.click();
    URL.revokeObjectURL(url);
});
