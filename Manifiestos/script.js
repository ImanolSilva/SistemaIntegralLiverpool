(function () {
            // MEJORA: Utilidades globales optimizadas
            const Utils = {
                showLoading() {
                    document.getElementById('globalLoading').style.display = 'flex';
                },
                
                hideLoading() {
                    document.getElementById('globalLoading').style.display = 'none';
                },
                
                debounce(func, wait) {
                    let timeout;
                    return function executedFunction(...args) {
                        const later = () => {
                            clearTimeout(timeout);
                            func(...args);
                        };
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                    };
                },
                
                isMobile() {
                    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                },
                
                handleError(error, context = '') {
                    console.error(`Error en ${context}:`, error);
                    
                    let message = 'Ha ocurrido un error inesperado.';
                    
                    if (error.code === 'permission-denied') {
                        message = 'No tienes permisos para realizar esta acción.';
                    } else if (error.code === 'network-request-failed') {
                        message = 'Error de conexión. Verifica tu internet.';
                    } else if (error.message) {
                        message = error.message;
                    }
                    
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: message,
                        confirmButtonColor: '#E6007E'
                    });
                }
            };

            document.addEventListener('DOMContentLoaded', () => {
                document.querySelector('.main-container').removeAttribute('aria-hidden');
                AOS.init();
                const hamburgerBtn = document.getElementById('hamburger-btn');
                const menuLateral = document.getElementById('menuLateral');

                if (hamburgerBtn && menuLateral) {
                    menuLateral.addEventListener('show.bs.offcanvas', () => {
                        hamburgerBtn.classList.add('open');
                    });

                    menuLateral.addEventListener('hide.bs.offcanvas', () => {
                        hamburgerBtn.classList.remove('open');
                    });
                }
                    const menuResumenSemanal = document.getElementById('menuResumenSemanal');
    if (menuResumenSemanal) {
        menuResumenSemanal.addEventListener('click', async (event) => {
            event.preventDefault(); // Detiene el comportamiento por defecto del enlace (no recarga la página)

            // Cierra el menú lateral si está abierto (mejora la experiencia de usuario)
            const offcanvasElement = document.getElementById('menuLateral');
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasElement);
            if (offcanvasInstance) {
                offcanvasInstance.hide();
            }

            // Llama a tu función principal de resumen semanal
            await generarResumenSemanal();

            // Opcional: Actualiza la clase 'active' para resaltar el elemento del menú actual
            document.querySelectorAll('.offcanvas .nav-link').forEach(link => {
                link.classList.remove('active');
            });
            menuResumenSemanal.classList.add('active');
        });
    }

                /***************************************************
                 * CONFIGURACIÓN DE FIREBASE
                 ***************************************************/
                const firebaseConfig = {
                    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
                    authDomain: "loginliverpool.firebaseapp.com",
                    projectId: "loginliverpool",
                    storageBucket: "loginliverpool.appspot.com",
                    messagingSenderId: "704223815941",
                    appId: "1:704223815941:web:c871525230fb61caf96f6c",
                    measurementId: "G-QFEPQ4TSPY"
                };
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                const db = firebase.firestore();
                const auth = firebase.auth();
                const storage = firebase.app().storage("gs://loginliverpool.firebasestorage.app");

                /***************************************************
                 * VARIABLES GLOBALES
                 ***************************************************/
                const ADMIN_UID = "OaieQ6cGi7TnW0nbxvlk2oyLaER2";
                let currentUser = null;
                let currentUserStore = null;
                let currentUserRole = null;
                let currentContenedor = null;
                let currentContainerRecords = [];
                let excelDataGlobal = {};
                let currentFileName = "";
                let currentEmployeeNumber = "";
                let debounceTimerBusqueda = null;
                let debounceTimerScan = null;
                let allFilesList = null;
                let globalContainerMap = {};
                let currentDanioSKU = null;
                let permissions = {
                    canScan: false,
                    canUpload: false,
                    canGenerateReport: false,
                    canArchive: false,
                    hasFullAccess: false
                };

                const calculateProStatistics = (data) => {
                    let tSAP = 0;
                    // Renombrada para mayor claridad: esto almacenará la suma de los artículos escaneados HASTA su cantidad SAP.
                    let tSCAN_for_expected = 0;
                    let falt = 0;
                    let exc = 0; // Esto acumulará el total de excedentes

                    const contF = {}, contE = {}, secF = {}, secE = {};

                    data.forEach(r => {
                        const sap = Number(r.SAP) || 0;
                        const scan = Number(r.SCANNER) || 0;
                        const cont = (r.CONTENEDOR || 'SIN NOMBRE').toUpperCase().trim();
                        const sec = (r.SECCION || 'Sin sección').toString().trim();

                        tSAP += sap;

                        // Calcula los artículos correctamente escaneados: solo hasta la cantidad SAP para cada SKU.
                        tSCAN_for_expected += Math.min(scan, sap);

                        if (scan < sap) {
                            const diff = sap - scan;
                            falt += diff;
                            contF[cont] = (contF[cont] || 0) + diff;
                            secF[sec] = (secF[sec] || 0) + diff;
                        } else if (scan > sap) {
                            const diff = scan - sap;
                            exc += diff; // Acumula el excedente para el conteo total de excedentes
                            contE[cont] = (contE[cont] || 0) + diff;
                            secE[sec] = (secE[sec] || 0) + diff;
                        }
                    });

                    // El avance debe calcularse en función de `tSCAN_for_expected` (lo escaneado correctamente)
                    const av = tSAP ? Math.round((tSCAN_for_expected / tSAP) * 100) : 0;

                    const getTopItems = (obj) => Object.entries(obj)
                        .sort(([, a], [, b]) => b - a);

                    return {
                        totalSAP: tSAP,
                        totalSCAN: tSCAN_for_expected, // Este es el valor corregido
                        faltantes: falt,
                        excedentes: exc,
                        avance: av,
                        totalSKUs: data.length,
                        topContenedoresFaltantes: getTopItems(contF),
                        topSeccionesFaltantes: getTopItems(secF),
                        topContenedoresExcedentes: getTopItems(contE),
                        topSeccionesExcedentes: getTopItems(secE),
                    };
                };

                function formatFecha(d) {
                    if (d instanceof Date && !isNaN(d.getTime())) {
                        const dd = String(d.getDate()).padStart(2, "0");
                        const mm = String(d.getMonth() + 1).padStart(2, "0");
                        const yy = d.getFullYear();
                        return `${dd}/${mm}/${yy}`;
                    }
                    if (typeof d === "string") {
                        let dateObj = new Date(d);
                        if (!isNaN(dateObj.getTime())) {
                            let correctedDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
                            return `${String(correctedDate.getDate()).padStart(2, "0")}/${String(correctedDate.getMonth() + 1).padStart(2, "0")}/${correctedDate.getFullYear()}`;
                        }
                        return d;
                    }
                    if (typeof d === "number") {
                        let dateObj = new Date(Math.round((d - 25569) * 86400 * 1000));
                        let correctedDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
                        return `${String(correctedDate.getDate()).padStart(2, "0")}/${String(correctedDate.getMonth() + 1).padStart(2, "0")}/${correctedDate.getFullYear()}`;
                    }
                    return "";
                }
                async function reconstructManifestDataFromFirebase(manifestoId) {
                    try {
                        const manifestDoc = await db.collection('manifiestos').doc(manifestoId).get();
                        if (!manifestDoc.exists) {
                            throw new Error(`El documento del manifiesto con ID ${manifestoId} no existe.`);
                        }

                        const manifestData = manifestDoc.data();
                        const folder = manifestData.store;
                        const fileName = manifestData.fileName;

                        if (!folder || !fileName) {
                            throw new Error(`El documento ${manifestoId} no tiene información de tienda o nombre de archivo.`);
                        }

                        const url = await storage.ref(`Manifiestos/${folder}/${fileName}`).getDownloadURL();
                        const buffer = await (await fetch(url)).arrayBuffer();
                        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
                        const baseData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                        let reconstructedData = JSON.parse(JSON.stringify(baseData));

                        reconstructedData.forEach(row => {
                            row.SCANNER = 0;
                            row.DANIO_CANTIDAD = 0;
                            row.DANIO_FOTO_URL = "";
                            row.LAST_SCANNED_BY = "";
                            row.ENTREGADO_A = "";
                            row.FECHA_ESCANEO = "";
                        });

                        const scansSnapshot = await db.collection('manifiestos').doc(manifestoId).collection('scans').orderBy('scannedAt').get();

                        const newItems = new Map();
                        const deletedSkus = new Set();

                        scansSnapshot.docs.forEach(doc => {
                            const scan = doc.data();
                            const skuUpper = String(scan.sku || "").toUpperCase();

                            // --- INICIO DE LA CORRECCIÓN CLAVE ---
                            // La clave única de una fila es la combinación de SKU y CONTENEDOR.
                            // Antes, solo buscaba por SKU. Ahora busca por ambos.
                            const containerUpper = String(scan.container || "").trim().toUpperCase();

                            if (scan.type === 'delete') {
                                // Para eliminar, buscamos la fila específica que se quiere borrar
                                let recordToDelete = reconstructedData.find(r =>
                                    String(r.SKU || "").toUpperCase() === skuUpper &&
                                    String(r.CONTENEDOR || "").trim().toUpperCase() === containerUpper
                                );
                                // Si la encontramos (es un artículo nuevo añadido y luego borrado), la marcamos.
                                if (recordToDelete && (Number(recordToDelete.SAP) || 0) === 0) {
                                    deletedSkus.add(`${skuUpper}|${containerUpper}`);
                                }
                                return;
                            }

                            // Busca la fila exacta que coincide con el SKU Y el Contenedor del escaneo.
                            let record = reconstructedData.find(r =>
                                String(r.SKU || "").toUpperCase() === skuUpper &&
                                String(r.CONTENEDOR || "").trim().toUpperCase() === containerUpper
                            );
                            // --- FIN DE LA CORRECCIÓN CLAVE ---

                            if (record) {
                                if (deletedSkus.has(`${skuUpper}|${containerUpper}`)) return;

                                switch (scan.type) {
                                    case 'subtract':
                                        record.SCANNER = (Number(record.SCANNER) || 0) - (Number(scan.quantity) || 1);
                                        break;
                                    case 'damage':
                                        record.DANIO_CANTIDAD = (Number(record.DANIO_CANTIDAD) || 0) + (Number(scan.quantity) || 1);
                                        if (scan.photoURL) record.DANIO_FOTO_URL = scan.photoURL;
                                        break;
                                    default:
                                        record.SCANNER = (Number(record.SCANNER) || 0) + (Number(scan.quantity) || 1);
                                }

                                record.LAST_SCANNED_BY = scan.user || "Desconocido";
                                record.ENTREGADO_A = scan.employee || record.ENTREGADO_A;
                                if (scan.scannedAt) record.FECHA_ESCANEO = scan.scannedAt.toDate();

                            } else if (scan.type === 'add') {
                                const newItemKey = `${skuUpper}|${containerUpper}`;
                                if (deletedSkus.has(newItemKey)) return;

                                const refBaseRow = reconstructedData.length > 0 ? reconstructedData[0] : {};
                                let newItem = newItems.get(newItemKey);

                                if (!newItem) {
                                    newItem = { ...refBaseRow, SKU: scan.sku, SAP: 0, SCANNER: 0, DANIO_CANTIDAD: 0 };
                                }

                                newItem.SCANNER += (Number(scan.quantity) || 1);
                                newItem.DESCRIPCION = scan.description || "ARTÍCULO NUEVO";
                                newItem.CONTENEDOR = scan.container || refBaseRow.CONTENEDOR || "N/A";
                                newItem.LAST_SCANNED_BY = scan.user || "Desconocido";
                                newItem.ENTREGADO_A = scan.employee || newItem.ENTREGADO_A;
                                if (scan.scannedAt) newItem.FECHA_ESCANEO = scan.scannedAt.toDate();

                                newItems.set(newItemKey, newItem);
                            }
                        });

                        // Filtramos los artículos borrados
                        reconstructedData = reconstructedData.filter(r => {
                            const key = `${String(r.SKU || "").toUpperCase()}|${String(r.CONTENEDOR || "").trim().toUpperCase()}`;
                            return !deletedSkus.has(key);
                        });

                        newItems.forEach(item => reconstructedData.push(item));

                        excelDataGlobal[manifestoId] = { data: reconstructedData, ...manifestData };

                        return { data: reconstructedData, ...manifestData };

                    } catch (error) {
                        console.error(`Error al reconstruir datos para el manifiesto ${manifestoId}:`, error);
                        throw new Error("No se pudieron reconstruir los datos del manifiesto desde Firebase.");
                    }
                }
                /***************************************************
                 * REFERENCIAS DEL DOM
                 ***************************************************/
                const logoutBtn = document.getElementById("logout-btn");
                const userInfoEl = document.getElementById("userInfo");
                const employeeNumberInput = document.getElementById("employeeNumberInput");
                const restoInterfaz = document.getElementById("restoInterfaz");
                const uploadAndSearchSection = document.getElementById("uploadAndSearchSection");
                const dropzone = document.getElementById("dropzone");
                const fileInput = document.getElementById("fileInput");
                const selectedFileNameEl = document.getElementById("selectedFileName");
                const uploadFileBtn = document.getElementById("uploadFileBtn");
                const uploadProgressContainer = document.getElementById("uploadProgressContainer");
                const uploadProgressBar = document.getElementById("uploadProgressBar");
                const btnVerArchivos = document.getElementById("btnVerArchivos");
                const inputBusqueda = document.getElementById("inputBusqueda");
                const containerResultsSection = document.getElementById("containerResultsSection");
                const containerDetailsEl = document.getElementById("containerDetails");
                const selectedFileToWorkEl = document.getElementById("selectedFileToWork");
                const lastUserUpdateEl = document.getElementById("lastUserUpdate");
                const scanEntrySection = document.getElementById("scanEntrySection");
                const inputScanCode = document.getElementById("inputScanCode");
                const btnCerrarContenedor = document.getElementById("btnCerrarContenedor");
                const btnRegistrarManual = document.getElementById("btnRegistrarManual");
                const btnCambiarEmpleado = document.getElementById("btnCambiarEmpleado");
                const btnCambiarContenedor = document.getElementById("btnCambiarContenedor");
                const modalDanios = new bootstrap.Modal(document.getElementById("modalDanios"));
                const danioCantidadInput = document.getElementById("danioCantidad");
                const danioFotoInput = document.getElementById("danioFoto");
                const btnGuardarDanio = document.getElementById("btnGuardarDanio");
                const uploadColumn = document.getElementById("upload-column");

                /***************************************************
                 * AUTH / LOGOUT
                 ***************************************************/
                auth.onAuthStateChanged(async (user) => {
                    if (!user) {
                        window.location.href = "../Login/login.html";
                        return;
                    }
                    currentUser = user;
                    try {
                        const docSnap = await db.collection("usuarios").doc(user.uid).get();
                        const isAdmin = user.uid === ADMIN_UID;

                        if (isAdmin || (docSnap.exists && docSnap.data().status === "aprobado")) {
                            const data = docSnap.data() || {};
                            currentUserStore = isAdmin ? "ALL" : (data.store || "");
                            currentUserRole = isAdmin ? "admin" : (data.role || "vendedor");

                            const userName = data.name || (isAdmin ? 'Admin' : 'Usuario');
                            userInfoEl.textContent = `Usuario: ${userName} (Tienda: ${currentUserStore}, Rol: ${currentUserRole})`;

                            switch (currentUserRole) {
                                case 'vendedor':
                                    permissions.canScan = true;
                                    break;
                                case 'auxiliar':
                                    permissions.canScan = true;
                                    permissions.canUpload = true;
                                    permissions.canGenerateReport = true;
                                    break;
                                case 'jefe':
                                    permissions.canScan = true;
                                    permissions.canUpload = true;
                                    permissions.canGenerateReport = true;
                                    permissions.canArchive = true;
                                    break;
                                case 'admin':
                                    permissions.hasFullAccess = true;
                                    break;
                            }
                            if (permissions.hasFullAccess) {
                                permissions = {
                                    canScan: true,
                                    canUpload: true,
                                    canGenerateReport: true,
                                    canArchive: true,
                                    hasFullAccess: true
                                };
                            }

                            if (permissions.canScan || permissions.hasFullAccess) {
                                uploadAndSearchSection.style.display = 'block';
                            } else {
                                uploadAndSearchSection.style.display = 'none';
                            }
                            if (uploadColumn) {
                                if (permissions.canUpload || permissions.hasFullAccess) {
                                    uploadColumn.style.display = 'block';
                                } else {
                                    uploadColumn.style.display = 'none';
                                }
                            }
                        } else {
                            Swal.fire({
                                icon: 'info',
                                title: 'Acceso Denegado',
                                text: 'Tu cuenta no está aprobada. Contacta al administrador.'
                            }).then(() => auth.signOut());
                        }
                    } catch (error) {
                        console.error("Error de autenticación:", error);
                        auth.signOut();
                    }
                });

                logoutBtn.addEventListener("click", () => {
                    auth.signOut().then(() => window.location.href = "../Login/login.html")
                        .catch(e => console.error(e));
                });

                /***************************************************
                        * SECCIÓN: SUBIR ARCHIVO MANIFIESTO + BARRA DE PROGRESO (CON VALIDACIÓN)
                        ***************************************************/
                dropzone.addEventListener('click', () => fileInput.click());
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = 'var(--rosa-principal)';
                });
                dropzone.addEventListener('dragleave', () => {
                    dropzone.style.borderColor = '#ced4da';
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = '#ced4da';
                    if (e.dataTransfer.files.length) {
                        fileInput.files = e.dataTransfer.files;
                        const file = fileInput.files[0];
                        if (file) {
                            selectedFileNameEl.textContent = file.name;
                            uploadFileBtn.disabled = false;
                        }
                    }
                });

                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (!file) return;
                    selectedFileNameEl.textContent = file.name;
                    uploadFileBtn.disabled = false;
                });

                uploadFileBtn.addEventListener('click', async () => {
                    const file = fileInput.files[0];
                    if (!file) return;

                    uploadFileBtn.disabled = true;

                    // --- CAMBIO CLAVE ---
                    // Forzamos que todos los archivos se guarden en la carpeta "0042".
                    const folder = "0042";
                    const storageRef = storage.ref(`Manifiestos/${folder}/${file.name}`);
                    // --- FIN DEL CAMBIO ---

                    try {
                        // PRIMERO: Verificamos si ya existe un archivo con ese nombre en la carpeta correcta
                        await storageRef.getDownloadURL();

                        // Si existe, mostramos un error
                        Swal.fire({
                            icon: 'error',
                            title: 'Archivo Duplicado',
                            text: `Ya existe un manifiesto con el nombre "${file.name}" en la tienda 0042.`
                        });
                        uploadFileBtn.disabled = false;
                        return;

                    } catch (error) {
                        // Si getDownloadURL() falla con 'storage/object-not-found', significa que el archivo NO existe.
                        // ¡Podemos proceder a subirlo!
                        if (error.code === 'storage/object-not-found') {
                            uploadProgressContainer.style.display = 'block';
                            const uploadTask = storageRef.put(file);

                            uploadTask.on('state_changed',
                                snapshot => {
                                    const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                                    uploadProgressBar.style.width = percent + '%';
                                    uploadProgressBar.textContent = percent + '%';
                                    uploadProgressBar.setAttribute('aria-valuenow', percent);
                                },
                                uploadError => {
                                    console.error(uploadError);
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Error de Subida',
                                        text: 'Ocurrió un error al subir el archivo.'
                                    });
                                    uploadProgressContainer.style.display = 'none';
                                    uploadFileBtn.disabled = false;
                                },
                                async () => {
                                    // Una vez subido, obtenemos los metadatos y creamos el registro en Firestore
                                    try {
                                        const reader = new FileReader();
                                        reader.readAsArrayBuffer(file);
                                        reader.onload = async (e) => {
                                            const data = new Uint8Array(e.target.result);
                                            const workbook = XLSX.read(data, { type: 'array' });
                                            const firstSheetName = workbook.SheetNames[0];
                                            const worksheet = workbook.Sheets[firstSheetName];
                                            const json = XLSX.utils.sheet_to_json(worksheet);
                                            const numeroManifiesto = (json.length > 0 && json[0].MANIFIESTO) ? String(json[0].MANIFIESTO) : "N/A";

                                            // Usamos el nombre del archivo como ID del documento, ya que ahora es único por carpeta.
                                            await db.collection('manifiestos').doc(file.name).set({
                                                fileName: file.name,
                                                store: folder,
                                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                                lastUser: currentUser.email || currentUser.uid,
                                                numeroManifiesto: numeroManifiesto,
                                                closedContainers: {} // Inicializamos el mapa de contenedores cerrados
                                            }, { merge: true });

                                            Swal.fire({
                                                icon: 'success',
                                                title: '¡Éxito!',
                                                text: `El manifiesto "${file.name}" fue subido y procesado correctamente.`
                                            });

                                            // Limpiamos la interfaz de subida
                                            uploadProgressContainer.style.display = 'none';
                                            uploadProgressBar.style.width = '0%';
                                            selectedFileNameEl.textContent = '';
                                            fileInput.value = '';
                                            uploadFileBtn.disabled = true;
                                        };
                                    } catch (readError) {
                                        console.error("Error al leer el excel para metadatos:", readError);
                                        Swal.fire('Error al Procesar', 'El archivo se subió, pero no se pudieron leer sus datos internos.', 'error');
                                    }
                                }
                            );
                        } else {
                            // Otro tipo de error de Storage
                            console.error("Error de Storage:", error);
                            Swal.fire('Error Inesperado', 'No se pudo verificar el archivo en la nube.', 'error');
                            uploadFileBtn.disabled = false;
                        }
                    }
                });

                /***************************************************
                 * DETECCIÓN DE EMPLEADO (8 dígitos)
                 ***************************************************/
                const debounce = (func, delay = 400) => {
                    let timeoutId;
                    return (...args) => {
                        clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => {
                            func.apply(this, args);
                        }, delay);
                    };
                };

                employeeNumberInput.addEventListener("input", debounce(() => {
                    const restoInterfaz = document.getElementById("restoInterfaz");
                    const inputScanCode = document.getElementById("inputScanCode");
                    const val = employeeNumberInput.value.trim();

                    if (!restoInterfaz || !inputScanCode) {
                        console.error("Error Crítico: No se encontraron 'restoInterfaz' o 'inputScanCode'.");
                        return;
                    }

                    if (/^\d{8}$/.test(val)) {
                        currentEmployeeNumber = val;
                        restoInterfaz.style.display = "block";
                        inputScanCode.disabled = false;
                        inputScanCode.focus();
                    } else {
                        currentEmployeeNumber = "";
                        restoInterfaz.style.display = "none";
                        inputScanCode.disabled = true;
                    }
                }));

                btnCambiarEmpleado.addEventListener("click", () => {
                    Swal.fire({
                        title: "Cambiar Empleado",
                        input: "text",
                        inputLabel: "Ingrese el nuevo número de empleado",
                        inputPlaceholder: "Debe contener 8 dígitos...",
                        inputAttributes: {
                            maxlength: 8,
                            autocapitalize: "off",
                            autocorrect: "off"
                        },
                        showCancelButton: true,
                        confirmButtonText: 'Confirmar',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#43A047',
                        cancelButtonColor: '#6c757d',
                        customClass: {
                            popup: 'animated animate__fadeInDown'
                        },
                        preConfirm: (value) => {
                            if (!/^\d{8}$/.test(value)) {
                                Swal.showValidationMessage("El número debe contener exactamente 8 dígitos numéricos");
                                return false;
                            }
                            return value;
                        }
                    }).then(result => {
                        if (result.isConfirmed) {
                            currentEmployeeNumber = result.value.trim();
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                icon: 'success',
                                title: 'Número actualizado con éxito',
                                html: `Ahora se usará: <strong>${currentEmployeeNumber}</strong>`,
                                showConfirmButton: false,
                                timer: 2500
                            });
                            restoInterfaz.style.display = "block";
                            inputScanCode.disabled = false;
                            inputScanCode.focus();
                        }
                    });
                });

                /***************************************************
                 * LISTAR / DESCARGAR / ELIMINAR MANIFIESTOS
                 ***************************************************/
                const SUPER_ADMINS = ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2"];

                btnVerArchivos.addEventListener("click", listarArchivos);
                async function listarArchivos() {
                    Swal.fire({
                        title: '<i class="bi bi-stars" style="color: var(--rosa-principal);"></i> Desplegando Centro de Comando...',
                        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0;">
                <div class="epic-loader"></div>
                <p class="text-muted fw-bold mt-2">Sincronizando con la flota de manifiestos de la tienda 0042...</p>
                <p class="text-muted small">Calculando vectores de progreso. ¡Prepárate!</p>
            </div>
            <style>
                .epic-loader { width: 60px; height: 60px; border-radius: 50%; background: conic-gradient(from 180deg at 50% 50%, #E6007E, #0d6efd, #ffc107, #E6007E); animation: spin 1.2s linear infinite; -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - 8px), #000 0); mask: radial-gradient(farthest-side, #0000 calc(100% - 8px), #000 0); }
                @keyframes spin { to { transform: rotate(1turn); } }
            </style>
        `,
                        allowOutsideClick: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    try {
                        let query = db.collection('manifiestos').where('store', '==', '0042');
                        const manifestosSnapshot = await query.orderBy('createdAt', 'desc').get();

                        if (manifestosSnapshot.empty) {
                            return Swal.fire("Sin Manifiestos", "No se encontraron archivos para la tienda 0042.", "info");
                        }

                        let totalContenedoresCerrados = 0;
                        let totalPiezasEscaneadas = 0;
                        let failedManifestsDuringList = []; // Array para almacenar los manifiestos que fallaron al procesarse

                        // Usamos Promise.allSettled para procesar todos los manifiestos de forma concurrente.
                        // Esto permite que el proceso continúe incluso si algunos manifiestos tienen errores,
                        // y nos permite capturar cuáles fallaron.
                        const results = await Promise.allSettled(
                            manifestosSnapshot.docs.map(async (doc) => {
                                try {
                                    const metadata = doc.data();
                                    const reconstructedData = await reconstructManifestDataFromFirebase(doc.id); // Esta función ya popula excelDataGlobal
                                    const stats = calculateProStatistics(reconstructedData.data);

                                    totalPiezasEscaneadas += stats.totalSCAN;
                                    if (reconstructedData.closedContainers) {
                                        totalContenedoresCerrados += Object.values(reconstructedData.closedContainers).filter(isClosed => isClosed === true).length;
                                    }

                                    // Devolvemos el objeto de manifiesto procesado
                                    return {
                                        id: doc.id,
                                        name: metadata.fileName,
                                        folder: metadata.store,
                                        createdAt: metadata.createdAt ? metadata.createdAt.toDate() : new Date(0),
                                        progreso: {
                                            totalSAP: stats.totalSAP,
                                            totalSCAN: stats.totalSCAN,
                                            avance: stats.avance,
                                            faltantes: stats.faltantes,
                                            excedentes: stats.excedentes,
                                        },
                                    };
                                } catch (e) {
                                    // Si falla la reconstrucción de un manifiesto, lo registramos y devolvemos null
                                    console.error(`Falló al procesar el manifiesto ${doc.id} durante la lista:`, e);
                                    failedManifestsDuringList.push({ id: doc.id, error: e.message || 'Error desconocido' });
                                    return null; // Este null será filtrado después
                                }
                            })
                        );

                        // Filtramos los resultados nulos para obtener solo los manifiestos que se procesaron correctamente
                        const archivosValidos = results.map(result => result.status === 'fulfilled' ? result.value : null).filter(a => a !== null);

                        // CORRECCIÓN CLAVE: El conteo total de manifiestos se toma directamente del snapshot de Firebase.
                        const totalManifiestosEnFirebase = manifestosSnapshot.docs.length;

                        // Los manifiestos destacados y el ordenamiento para la visualización siguen usando archivosValidos
                        const topArchivos = [...archivosValidos].sort((a, b) => b.progreso.totalSCAN - a.progreso.totalSCAN).slice(0, 2);
                        const topArchivosSet = new Set(topArchivos.map(f => f.name));

                        archivosValidos.sort((a, b) => b.createdAt - a.createdAt); // Ordenar para la visualización en tarjetas

                        // Mensaje para manifiestos que fallaron al procesarse
                        let failedProcessingAlertHTML = '';
                        if (failedManifestsDuringList.length > 0) {
                            const failedNames = failedManifestsDuringList.map(f => `<strong>${f.id}</strong>`).join(', ');
                            failedProcessingAlertHTML = `
                <div class="mt-3 alert alert-danger p-3 small" role="alert" style="border-radius: 12px; box-shadow: 0 4px 10px rgba(220,53,69,0.1);">
                    <h6 class="alert-heading"><i class="bi bi-exclamation-triangle-fill me-2"></i>¡Problemas al procesar manifiestos!</h6>
                    <p class="mb-0">Algunos manifiestos no se pudieron cargar completamente para su análisis en el dashboard. Esto podría deberse a un formato incorrecto o datos corruptos en el archivo Excel.</p>
                    <hr class="my-2" style="border-color: rgba(255,255,255,0.3);">
                    <p class="mb-0">Manifiestos afectados: ${failedNames}. Por favor, revisa la consola del navegador para más detalles técnicos.</p>
                </div>`;
                        }

                        const dashboardHTML = `
    <style>
      /* === DASHBOARD PRO - ESTILO MODERNO Y LIMPIO === */
      .dashboard-pro-container {
        --color-primary: #E6007E;
        --color-secondary: #0d6efd;
        --color-success: #198754;
        --color-danger: #dc3545;
        --color-warning: #ffc107;
        --color-info: #6f42c1;
        --color-bg: #fff;
        --color-border: #e9ecef;
        --color-muted: #6c757d;
        --radius: 18px;
        --shadow: 0 8px 32px #e6007e11;
        --shadow-hover: 0 12px 40px rgba(0,0,0,0.12);
        --font-main: 'Poppins', system-ui, Arial, sans-serif;
      }
      .dashboard-pro-container {
        font-family: var(--font-main);
        background: linear-gradient(135deg, var(--color-bg) 80%, #e6007e08 100%);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        padding: 2.2rem 1.5rem 2.5rem 1.5rem;
        margin: 0 auto;
        max-width: 1400px;
      }
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e6007e22;
      }
      .dashboard-header .title {
        font-size: 2.1rem;
        font-weight: 800;
        color: var(--color-primary);
        display: flex;
        align-items: center;
        gap: 0.7rem;
        margin: 0;
      }
      .dashboard-header .title .material-icons {
        font-size: 2.5rem;
        color: var(--color-secondary);
      }
      .search-filter-controls {
        display: flex;
        gap: 1.2rem;
        align-items: center;
      }
      .search-filter-controls .form-control,
      .search-filter-controls .form-select {
        max-width: 240px;
        border-radius: 12px;
        border: 2px solid #e6007e22;
        font-size: 1rem;
        padding: 0.5rem 1rem;
        transition: border-color .3s, box-shadow .3s;
      }
      .search-filter-controls .form-select { max-width: 170px; }
      .search-filter-controls .form-control:focus,
      .search-filter-controls .form-select:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px #e6007e22;
        outline: none;
      }
      .global-stats-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px,1fr));
        gap: 1.5rem;
        padding: 2.2rem 0 2.2rem 0;
      }
      .global-stat-card {
        display: flex;
        align-items: center;
        gap: 1.2rem;
        background: var(--color-bg);
        padding: 1.3rem 1.1rem;
        border-radius: 14px;
        border: 1px solid var(--color-border);
        transition: transform .3s, box-shadow .3s;
        box-shadow: 0 2px 8px #e6007e11;
      }
      .global-stat-card:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: var(--shadow-hover);
      }
      .global-stat-card .stat-icon {
        font-size: 2.5rem;
        padding: 0.7rem;
        border-radius: 50%;
        display: grid;
        place-items: center;
      }
      .stat-icon.icon-manifiestos { background: #6f42c11a; color: #6f42c1; }
      .stat-icon.icon-contenedores { background: #dc35451a; color: #dc3545; }
      .stat-icon.icon-piezas { background: #1987541a; color: #198754; }
      .global-stat-card .stat-content { line-height: 1.2; }
      .global-stat-card .stat-value {
        font-size: 2.1rem;
        font-weight: 700;
        color: #343a40;
      }
      .global-stat-card .stat-label {
        font-size: 0.97rem;
        color: var(--color-muted);
        font-weight: 500;
      }
      #manifestCardsContainer { padding-top: 1rem; }
      .filter-results-counter {
        display: inline-block;
        margin-left: 1rem;
        font-size: 1rem;
        color: var(--color-primary);
        font-weight: 600;
        opacity: 0;
        transition: opacity .3s;
        vertical-align: middle;
      }
      .filter-results-counter.show { opacity: 1; }
      @media (max-width: 900px) {
        .dashboard-pro-container { padding: 1.2rem .5rem; }
        .dashboard-header { flex-direction: column; align-items: flex-start; }
        .search-filter-controls { width: 100%; flex-direction: column; align-items: stretch; }
        .search-filter-controls .form-control, .search-filter-controls .form-select { max-width: 100%; }
      }
      @media (max-width: 600px) {
        .global-stats-container { grid-template-columns: 1fr; gap: .7rem; }
        .global-stat-card { min-width: 120px; padding: .7rem .3rem; }
      }
    </style>
    <div class="dashboard-pro-container">
      <header class="dashboard-header">
        <h2 class="title">
          <i class="material-icons">view_quilt</i>
          Centro de Manifiestos (Tienda 0042)
        </h2>
        <div class="search-filter-controls">
          <input type="text" id="dashboardSearchInput" class="form-control" placeholder="Buscar por nombre..." aria-label="Buscar manifiesto por nombre">
          <select id="statusFilter" class="form-select" aria-label="Filtrar manifiestos por estado" title="Selecciona un estado para filtrar">
            <option value="Todos">📋 Todos los estados</option>
            <option value="Sin Iniciar">⏸️ Sin Iniciar</option>
            <option value="En Progreso">🔄 En Progreso</option>
            <option value="Avanzado">⚡ Avanzado</option>
            <option value="Completo">✅ Completo</option>
            <option value="Con Sobrantes">📦 Con Sobrantes</option>
            <option value="Accion Requerida">⚠️ Acción Requerida</option>
          </select>
        </div>
      </header>
      <div class="global-stats-container">
        <div class="global-stat-card">
          <i class="bi bi-shop-window stat-icon icon-manifiestos"></i>
          <div class="stat-content">
            <div class="stat-value">${totalManifiestosEnFirebase}</div>
            <div class="stat-label">Manifiestos en Tienda</div>
          </div>
        </div>
        <div class="global-stat-card">
          <i class="bi bi-lock-fill stat-icon icon-contenedores"></i>
          <div class="stat-content">
            <div class="stat-value">${totalContenedoresCerrados}</div>
            <div class="stat-label">Contenedores Cerrados</div>
          </div>
        </div>
        <div class="global-stat-card">
          <i class="bi bi-qr-code-scan stat-icon icon-piezas"></i>
          <div class="stat-content">
            <div class="stat-value">${totalPiezasEscaneadas.toLocaleString('es-MX')}</div>
            <div class="stat-label">Piezas Escaneadas (Total)</div>
          </div>
        </div>
      </div>
      ${failedProcessingAlertHTML}
      <div id="manifestCardsContainer" class="manifest-cards-container"></div>
    </div>
`;
                        await Swal.fire({
                            html: dashboardHTML,
                            width: '95%',
                            customClass: { popup: 'dashboard-modal' },
                            showConfirmButton: false,
                            showCloseButton: true,
                            didOpen: () => {
                                const searchInput = document.getElementById('dashboardSearchInput');
                                const statusFilter = document.getElementById('statusFilter');
                                const btnResumenSemanal = document.getElementById('btnResumenSemanal');
                                if (btnResumenSemanal) {
                                    btnResumenSemanal.addEventListener('click', generarResumenSemanal);
                                }
                                const renderizar = () => {
                                    const searchTerm = searchInput.value.toLowerCase();
                                    const statusFiltro = statusFilter.value;
                                    const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;
                                    
                                    // Actualizar indicador visual del filtro
                                    statusFilter.setAttribute('data-filtered', statusFiltro !== 'Todos');
                                    
                                    const archivosFiltrados = archivosValidos.filter(file => {
                                        const isOld = (new Date() - file.createdAt) > fiveDaysInMillis;
                                        let searchMatch = file.name.toLowerCase().includes(searchTerm);

                                        let estadoArchivo;
                                        if (file.progreso.totalSAP === 0 && file.progreso.totalSCAN === 0) {
                                            estadoArchivo = "Sin Iniciar";
                                        } else if (file.progreso.avance >= 100) {
                                            estadoArchivo = (file.progreso.excedentes > 0) ? "Con Sobrantes" : "Completo";
                                        } else if (file.progreso.avance >= 50) {
                                            estadoArchivo = "Avanzado";
                                        } else if (file.progreso.avance > 0) {
                                            estadoArchivo = "En Progreso";
                                        } else {
                                            estadoArchivo = "Sin Iniciar";
                                        }

                                        let statusMatch = true;
                                        if (statusFiltro === 'Accion Requerida') statusMatch = isOld;
                                        else if (statusFiltro !== 'Todos') statusMatch = estadoArchivo === statusFiltro;
                                        return searchMatch && statusMatch;
                                    });
                                    
                                    // Actualizar contador de resultados
                                    updateResultsCounter(archivosFiltrados.length, archivosValidos.length, statusFiltro);
                                    
                                    const container = document.getElementById('manifestCardsContainer');
                                    if (archivosFiltrados.length === 0) {
                                        container.innerHTML = `
                                            <div class="text-center p-5 text-muted w-100">
                                                <h4><i class="material-icons">search_off</i> Sin resultados</h4>
                                                <p>No se encontraron manifiestos que coincidan con tu búsqueda.</p>
                                                ${statusFiltro !== 'Todos' ? `<button class="btn btn-outline-primary btn-sm mt-2" onclick="document.getElementById('statusFilter').value='Todos'; document.getElementById('statusFilter').dispatchEvent(new Event('change'));">
                                                    <i class="material-icons">clear</i> Limpiar filtros
                                                </button>` : ''}
                                            </div>`;
                                    } else {
                                        container.innerHTML = archivosFiltrados.map(file => renderItems(file, topArchivosSet.has(file.name))).join('');
                                    }
                                };
                                searchInput.addEventListener('keyup', renderizar);
                                statusFilter.addEventListener('change', renderizar);
                                // Nueva función para actualizar contador de resultados
                                function updateResultsCounter(filtered, total, currentFilter) {
                                    let counter = document.querySelector('.filter-results-counter');
                                    
                                    if (!counter) {
                                        counter = document.createElement('div');
                                        counter.className = 'filter-results-counter';
                                        statusFilter.parentNode.appendChild(counter);
                                    }
                                    
                                    if (currentFilter !== 'Todos') {
                                        counter.innerHTML = `<i class="material-icons">filter_list</i> ${filtered} de ${total}`;
                                        counter.classList.add('show');
                                    } else {
                                        counter.classList.remove('show');
                                    }
                                }
                                
                                renderizar();
                            }
                        });

                    } catch (err) {
                        console.error("Error al listar archivos:", err);
                        Swal.fire("Error Inesperado", "No se pudo listar los archivos.", "error");
                    }
                }


                function renderItems(file, isDestacado) {
                    const p = file.progreso;
                    const ultimaModificacion = formatFecha(file.createdAt);
                    const diasDesdeSubida = Math.floor((new Date() - file.createdAt) / (1000 * 60 * 60 * 24));

                    let estadoInfo;
                    if (p.avance >= 100) {
                        estadoInfo = (p.totalSCAN > p.totalSAP) ? { texto: 'Con Sobrantes', clase: 'con-sobrantes' } : { texto: 'Completo', clase: 'completo' };
                    } else if (p.avance >= 50) {
                        estadoInfo = { texto: 'Avanzado', clase: 'avanzado' };
                    } else if (p.avance > 0) {
                        estadoInfo = { texto: 'En Progreso', clase: 'en-progreso' };
                    } else {
                        estadoInfo = { texto: 'Sin Iniciar', clase: 'sin-iniciar' };
                    }

                    const isOld = diasDesdeSubida > 5;
                    const actionButtons = [];

                    if (permissions.canScan) {
                        actionButtons.push(`<button class="btn btn-sm btn-primary" onclick="verDashboardArchivo('${file.folder}','${file.name}')" title="Ver análisis detallado y abrir contenedor" aria-label="Abrir ${file.name}">
            <i class="bi bi-box-arrow-in-right fs-5"></i>
        </button>`);
                    }

                    if (permissions.canGenerateReport) {
                        // ✅ Este es el botón que ejecuta toda la nueva lógica
                        actionButtons.push(`<button class="btn btn-sm btn-success text-white" onclick="window.generarReportesYCorreo('${file.folder}','${file.name}')" title="Generar reportes (Excel, PDF, Captura) y enviar por correo" aria-label="Generar reportes y correo para ${file.name}">
            <i class="bi bi-envelope-paper-heart-fill fs-5"></i>
        </button>`);

                        actionButtons.push(`<button class="btn btn-sm btn-danger" onclick="window.generatePdfReport('${file.folder}','${file.name}')" title="Generar reporte PDF" aria-label="Generar PDF para ${file.name}">
            <i class="bi bi-file-earmark-pdf-fill fs-5"></i>
        </button>`);
                    }

                    if (permissions.canArchive) {
                        actionButtons.push(`<button class="btn btn-sm btn-secondary" onclick="window.archivarManifiesto('${file.name}', '${file.folder}')" title="Archivar este manifiesto" aria-label="Archivar manifiesto ${file.name}">
            <i class="bi bi-archive-fill fs-5"></i>
        </button>`);
                    }

                    let statusClass = isOld ? 'is-archivable' : `status-${estadoInfo.clase}`;

                    // Calcular el total escaneado correcto (sin excedente)
                    let totalScanCorrecto = p.totalSCAN;
                    if (file.data && Array.isArray(file.data)) {
                        file.data.forEach(row => {
                            const sap = Number(row.SAP) || 0;
                            const scan = Number(row.SCANNER) || 0;
                            totalScanCorrecto += Math.min(scan, sap);
                        });
                    } else if (p.totalSCAN && p.totalSAP) {
                        // Fallback si no hay data detallada, usar el menor valor
                        totalScanCorrecto = Math.min(p.totalSCAN, p.totalSAP);
                    } else {
                        totalScanCorrecto = p.totalSCAN || 0;
                    }

                    return `
        <div class="manifest-card-pro ${statusClass}">
            ${isDestacado ? `<div class="badge-destacado"><i class="bi bi-fire"></i> Destacado</div>` : ''}
            ${isOld ? `<div class="archivable-notice">ACCIÓN REQUERIDA (Subido hace ${diasDesdeSubida} días)</div>` : ''}
            <div class="card-header">
                <div class="file-name">${file.name}</div>
                <div class="file-store">Tienda: <strong>${file.folder}</strong> | Subido: ${ultimaModificacion}</div>
            </div>
            <div class="card-body">
                <div class="progress-preview">
                    <div class="progress-title">
                        <span>Progreso de Escaneo</span>
                        <span>${p.avance}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${p.avance}%;"></div>
                    </div>
                </div>
                <div class="card-stats">
                    <div>
                        <div class="stat-value">${totalScanCorrecto.toLocaleString()} / ${p.totalSAP.toLocaleString()}</div>
                        <div class="stat-label">Escaneado vs. SAP</div>
                    </div>
                    <div>
                        <span class="status-tag ${estadoInfo.clase}">${estadoInfo.texto}</span>
                        <div class="stat-label">Estado</div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                ${actionButtons.join('')}
            </div>
        </div>`;
                }

                window.archivarManifiesto = async (fileName, folder) => {
                    const {
                        isConfirmed
                    } = await Swal.fire({
                        title: '¿Archivar Manifiesto?',
                        html: `Esto moverá <strong>${fileName}</strong> a una carpeta de archivados y lo quitará de esta vista. Esta acción es difícil de revertir. ¿Continuar?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, Archivar',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#dc3545'
                    });

                    if (isConfirmed) {
                        Swal.fire({
                            title: 'Archivando...',
                            text: 'Por favor espera.',
                            allowOutsideClick: false,
                            didOpen: () => Swal.showLoading()
                        });

                        try {
                            const originalRef = storage.ref(`Manifiestos/${folder}/${fileName}`);
                            const archivedRef = storage.ref(`Archivados/${folder}/${fileName}`);
                            const url = await originalRef.getDownloadURL();
                            const blob = await (await fetch(url)).blob();

                            await archivedRef.put(blob);
                            await originalRef.delete();
                            await db.collection('manifiestos').doc(fileName).delete();

                            await Swal.fire('¡Archivado!', 'El manifiesto ha sido archivado con éxito.', 'success');

                            listarArchivos();
                        } catch (error) {
                            console.error("Error al archivar:", error);
                            Swal.fire('Error', 'No se pudo completar el archivado del manifiesto.', 'error');
                        }
                    }
                };
                window.verDashboardArchivo = async (folder, fileName) => {
                    try {
                        // --- INICIO DE LA FUNCIÓN CORREGIDA ---
                        const calculateProStatistics = (data) => {
                            let tSAP = 0;
                            let tSCAN_for_expected = 0; // Escaneos correctos (de piezas con SAP > 0)
                            let exc = 0; // Excedentes totales

                            const faltantesPorSeccion = {};
                            const excedentesPorSeccion = {};

                            data.forEach(r => {
                                const sap = Number(r.SAP) || 0;
                                const scan = Number(r.SCANNER) || 0;
                                const cont = (r.CONTENEDOR || 'SIN NOMBRE').toUpperCase().trim();
                                const sec = (r.SECCION || 'Sin sección').toString().trim();

                                tSAP += sap;

                                if (sap > 0) {
                                    // Es un artículo esperado
                                    const found_expected = Math.min(scan, sap);
                                    tSCAN_for_expected += found_expected;

                                    if (scan > sap) {
                                        const excess_amount = scan - sap;
                                        exc += excess_amount;
                                        if (!excedentesPorSeccion[sec]) {
                                            excedentesPorSeccion[sec] = { total: 0, contenedores: {} };
                                        }
                                        excedentesPorSeccion[sec].total += excess_amount;
                                        excedentesPorSeccion[sec].contenedores[cont] = (excedentesPorSeccion[sec].contenedores[cont] || 0) + excess_amount;
                                    }
                                } else {
                                    // Es un artículo nuevo/excedente (SAP = 0)
                                    exc += scan;
                                    if (scan > 0) {
                                        if (!excedentesPorSeccion[sec]) {
                                            excedentesPorSeccion[sec] = { total: 0, contenedores: {} };
                                        }
                                        excedentesPorSeccion[sec].total += scan;
                                        excedentesPorSeccion[sec].contenedores[cont] = (excedentesPorSeccion[sec].contenedores[cont] || 0) + scan;
                                    }
                                }

                                if (scan < sap) {
                                    const missing_amount = sap - scan;
                                    if (!faltantesPorSeccion[sec]) {
                                        faltantesPorSeccion[sec] = { total: 0, contenedores: {} };
                                    }
                                    faltantesPorSeccion[sec].total += missing_amount;
                                    faltantesPorSeccion[sec].contenedores[cont] = (faltantesPorSeccion[sec].contenedores[cont] || 0) + missing_amount;
                                }
                            });

                            const falt = tSAP - tSCAN_for_expected; // Los faltantes se calculan sobre lo esperado
                            const av = tSAP > 0 ? Math.round((tSCAN_for_expected / tSAP) * 100) : 0;

                            const sortDetailedBreakdown = (obj) => {
                                const sortedSections = Object.entries(obj).sort(([, a], [, b]) => b.total - a.total);
                                sortedSections.forEach(([, sectionData]) => {
                                    sectionData.contenedores = Object.entries(sectionData.contenedores).sort(([, a], [, b]) => b - a);
                                });
                                return sortedSections;
                            };

                            return {
                                totalSAP: tSAP,
                                totalSCAN: tSCAN_for_expected, // Devolvemos el conteo correcto de escaneos esperados
                                faltantes: falt,
                                excedentes: exc,
                                avance: av, // Devolvemos el avance correcto
                                totalSKUs: data.length,
                                faltantesDetallado: sortDetailedBreakdown(faltantesPorSeccion),
                                excedentesDetallado: sortDetailedBreakdown(excedentesPorSeccion),
                            };
                        };
                        // --- FIN DE LA FUNCIÓN CORREGIDA ---

                        await reconstructManifestDataFromFirebase(fileName);
                        const datos = excelDataGlobal[fileName].data;
                        const stats = calculateProStatistics(datos);

                        const statColors = {
                            total: { bg: 'linear-gradient(135deg, #E6007E 0%, #fff 100%)', icon: 'apps', color: '#E6007E' },
                            expected: { bg: 'linear-gradient(135deg, #6f42c1 0%, #fff 100%)', icon: 'inventory', color: '#6f42c1' },
                            scanned: { bg: 'linear-gradient(135deg, #198754 0%, #fff 100%)', icon: 'task_alt', color: '#198754' },
                            missing: { bg: 'linear-gradient(135deg, #dc3545 0%, #fff 100%)', icon: 'remove_circle', color: '#dc3545' },
                            excess: { bg: 'linear-gradient(135deg, #ffc107 0%, #fff 100%)', icon: 'add_circle', color: '#ffc107' }
                        };

                        const createProStatCard = (title, value, iconKey, className) => {
                            const colorObj = statColors[className] || statColors.total;
                            return `
                        <div class="stat-card ${className} animate__animated animate__fadeInUp" style="
                                display: flex; align-items: center; justify-content: center;
                                gap: 1.2rem; box-shadow: 0 8px 24px rgba(0,0,0,0.10);
                                border-left: 8px solid ${colorObj.color}; background: ${colorObj.bg};
                                transition: transform 0.3s cubic-bezier(.4,2,.3,1); text-align: center;">
                            <div class="stat-icon d-flex align-items-center justify-content-center" style="
                                    background: ${colorObj.bg}; border-radius: 50%; width: 56px; height: 56px;
                                    box-shadow: 0 4px 16px ${colorObj.color}22; animation: bounceIn 1s;">
                                <i class="material-icons" style="font-size: 2.5rem; color: ${colorObj.color}; filter: drop-shadow(0 2px 4px ${colorObj.color}33);">${colorObj.icon}</i>
                            </div>
                            <div class="stat-info" style="flex: 1;">
                                <div class="stat-value" style="font-size: 2.5rem; font-weight: 800; color: #343a40; margin-bottom: 4px; letter-spacing: 1px; text-shadow: 0 2px 8px ${colorObj.color}11; animation: pulse 1.2s;">
                                    ${value.toLocaleString('es-MX')}
                                </div>
                                <div class="stat-title" style="font-size: 1.05rem; color: ${colorObj.color}; font-weight: 700; letter-spacing: 0.5px;">
                                    ${title}
                                </div>
                            </div>
                        </div>
                        <style>
                            @keyframes bounceIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 80% { transform: scale(0.95); } 100% { transform: scale(1); } }
                            @keyframes pulse { 0% { text-shadow: 0 0 0 #e6007e11; } 50% { text-shadow: 0 4px 16px #e6007e33; } 100% { text-shadow: 0 2px 8px #e6007e11; } }
                        </style>`;
                        };

                        const createKeyInsightsPanel = (stats) => {
                            const createAccordionItems = (items, type) => {
                                if (items.length === 0) return `<div class="text-center p-3 text-muted">No hay ${type === 'faltantes' ? 'faltantes' : 'excedentes'} que reportar.</div>`;

                                return items.map(([sectionName, data], index) => {
                                    const accordionId = `accordion-${type}-${index}`;
                                    const color = type === 'faltantes' ? '#dc3545' : '#ffc107';
                                    const icon = type === 'faltantes' ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle';

                                    const containerList = data.contenedores.map(([contName, qty]) => `
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <span><i class="bi bi-box-seam me-2"></i>${contName}</span>
                                    <span class="badge" style="background-color: ${color};">${qty.toLocaleString('es-MX')} pz.</span>
                                </li>
                            `).join('');

                                    return `
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="heading-${accordionId}">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}" aria-expanded="false" aria-controls="collapse-${accordionId}">
                                            <i class="bi ${icon} me-2" style="color: ${color};"></i>
                                            <strong>${sectionName}</strong>
                                            <span class="ms-auto me-3 badge rounded-pill" style="background-color: ${color}; font-size: 0.9rem;">Total: ${data.total.toLocaleString('es-MX')} pz.</span>
                                        </button>
                                    </h2>
                                    <div id="collapse-${accordionId}" class="accordion-collapse collapse" aria-labelledby="heading-${accordionId}">
                                        <div class="accordion-body">
                                            <h6 class="text-muted">Desglose por Contenedor:</h6>
                                            <ul class="list-group list-group-flush">${containerList}</ul>
                                        </div>
                                    </div>
                                </div>`;
                                }).join('');
                            };

                            return `
                        <div class="key-insights-panel" style="background: linear-gradient(135deg,#f8f9fa 80%,#e6007e08 100%); border-radius: 18px; box-shadow: 0 8px 32px rgba(230,0,126,0.07); padding: 2rem 1.5rem; margin-top: 1rem;">
                            <h4 style="display:flex;align-items:center;gap:12px;font-size:1.5rem;font-weight:800;color:#E6007E;margin-bottom:2rem;justify-content:center;"><i class="bi bi-lightbulb" style="font-size:2rem;color:#E6007E;opacity:0.7;"></i> Insights Clave del Manifiesto</h4>
                            <div class="row gx-5">
                                <div class="col-lg-6">
                                    <h5 class="text-center mb-3" style="color: #dc3545;">Análisis de Faltantes</h5>
                                    <div class="accordion" id="accordionFaltantes">${createAccordionItems(stats.faltantesDetallado, 'faltantes')}</div>
                                </div>
                                <div class="col-lg-6 mt-4 mt-lg-0">
                                    <h5 class="text-center mb-3" style="color: #ffc107;">Análisis de Excedentes</h5>
                                    <div class="accordion" id="accordionExcedentes">${createAccordionItems(stats.excedentesDetallado, 'excedentes')}</div>
                                </div>
                            </div>
                        </div>`;
                        };

                        const isComplete = stats.avance >= 100 && stats.faltantes === 0;
                        const statusClass = isComplete ? 'is-success' : 'is-warning';
                        const statusMessage = isComplete ? `<i class="material-icons">celebration</i> ¡Manifiesto completo! Excelente trabajo 🎉` : `<i class="material-icons">warning</i> Aún falta un ${100 - stats.avance}% por completar. ¡Ánimo!`;

                        const canvasId = `grafico_pro_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                        const dashboardHTML = `
                    <div class="analisis-dashboard-pro" style="max-width:1200px;margin:0 auto;padding:2.5rem 1.5rem;background:linear-gradient(135deg,#fff 80%,#e6007e10 100%);border-radius:32px;box-shadow:0 12px 40px rgba(230,0,126,0.10);">
                        <div class="status-message ${statusClass}" style="justify-content:center;text-align:center;font-size:1.25rem;border-radius:12px;margin-bottom:2rem;box-shadow:0 2px 8px #e6007e11;">${statusMessage}</div>
                        <div class="stats-grid stats-grid-responsive" style="margin:0 auto;max-width:950px;gap:2rem;">
                            ${createProStatCard('SKUs Totales', stats.totalSKUs, 'apps', 'total')}
                            ${createProStatCard('Piezas Esperadas (SAP)', stats.totalSAP, 'inventory', 'expected')}
                            ${createProStatCard('Piezas Escaneadas', stats.totalSCAN, 'task_alt', 'scanned')}
                            ${createProStatCard('Piezas Faltantes', stats.faltantes, 'error', 'missing')}
                            ${createProStatCard('Piezas Excedentes', stats.excedentes, 'add_shopping_cart', 'excess')}
                        </div>
                        <div class="progress-container" style="margin:2.5rem auto 2.5rem auto;max-width:520px;height:32px;box-shadow:0 2px 8px #e6007e11;">
                            <div class="progress-fill ${isComplete ? 'bg-success' : 'bg-primary'}" style="width:${stats.avance}%;font-size:1.25rem;justify-content:center;align-items:center;height:100%;border-radius:32px;"><span style="font-weight:700;">${stats.avance}%</span></div>
                        </div>
                        <div class="dashboard-main-layout" style="display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:2.5rem;">
                            <div class="chart-container" style="flex:1 1 350px;max-width:400px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border-radius:20px;box-shadow:0 4px 24px #e6007e11;padding:2rem 1rem;">
                                <canvas id="${canvasId}" style="margin:0 auto;display:block;max-width:340px;max-height:340px;"></canvas>
                                <div style="text-align:center;margin-top:1.2rem;font-size:1.05rem;color:#6c757d;"><i class="material-icons" style="vertical-align:middle;color:#0d6efd;">pie_chart</i><span>Distribución de piezas</span></div>
                            </div>
                            <div style="flex:2 1 600px;max-width:700px;">${createKeyInsightsPanel(stats)}</div>
                        </div>
                    </div>
                    <style>
                        .analisis-dashboard-pro{background:linear-gradient(135deg,#fff 80%,#e6007e10 100%);border-radius:32px;box-shadow:0 12px 40px rgba(230,0,126,0.10);padding:2.5rem 1.5rem}.stats-grid.stats-grid-responsive{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:2rem;justify-content:center;margin-bottom:2rem}.stat-card{min-width:210px;max-width:260px;width:100%;padding:1.2rem 1rem;margin:0 auto;box-sizing:border-box}.stat-card .stat-value{font-size:2.2rem!important;font-weight:800;color:#343a40;margin-bottom:4px;letter-spacing:1px;text-shadow:0 2px 8px #e6007e11;animation:pulse 1.2s}.stat-card .stat-title{font-size:1rem!important;color:inherit;font-weight:700;letter-spacing:.5px}.stat-card .stat-icon{width:48px!important;height:48px!important;font-size:2rem!important}.progress-container{box-shadow:0 2px 8px #e6007e11;height:32px;border-radius:32px;background:#f8f9fa;overflow:hidden}.progress-fill{height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.25rem;transition:width .5s cubic-bezier(.4,2,.3,1);background:linear-gradient(90deg,#e6007e 0%,#0d6efd 100%)}.dashboard-main-layout{margin-top:2rem;gap:2.5rem}.chart-container{background:#fff;border-radius:20px;box-shadow:0 4px 24px #e6007e11;padding:2rem 1rem;min-width:320px}@media (max-width:900px){.dashboard-main-layout{flex-direction:column;gap:1.5rem}.chart-container,.key-insights-panel{max-width:100%!important}.analisis-dashboard-pro{padding:1.2rem .5rem}.stats-grid.stats-grid-responsive{grid-template-columns:1fr 1fr;gap:1rem}.stat-card{min-width:160px;max-width:100%;padding:1rem .5rem}}@media (max-width:600px){.stats-grid.stats-grid-responsive{grid-template-columns:1fr;gap:.7rem}.stat-card{min-width:120px;padding:.7rem .3rem}}
                    </style>`;

                        Swal.fire({
                            title: `<div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem;">
                        <i class="bi bi-bar-chart-line-fill" style="font-size: 2.5rem; color: var(--rosa-principal);"></i>
                        <div>
                            <h2 style="font-size: 1.7rem; font-weight: 700; color: var(--texto-principal); margin: 0;">Análisis PRO</h2>
                            <p style="font-size: 1rem; color: #6c757d; margin: 0;">${fileName}</p>
                        </div>
                        </div>`,
                            html: dashboardHTML,
                            width: '98vw',
                            maxWidth: '1400px',
                            padding: '0',
                            showCloseButton: true,
                            showConfirmButton: false,
                            customClass: {
                                popup: 'dashboard-modal animate__animated animate__fadeInUp',
                                header: 'p-3 border-bottom-0'
                            },
                            grow: 'row',
                            didOpen: () => {
                                const chartContainer = document.getElementById(canvasId);
                                if (chartContainer) {
                                    chartContainer.height = 340;
                                    chartContainer.width = 340;
                                    const ctx = chartContainer.getContext('2d');
                                    new Chart(ctx, {
                                        type: 'doughnut',
                                        data: {
                                            labels: ['Correcto', 'Faltante', 'Excedente'],
                                            datasets: [{
                                                data: [stats.totalSCAN - stats.excedentes, stats.faltantes, stats.excedentes],
                                                backgroundColor: ['#20c997', '#e53935', '#ffb22d'],
                                                borderColor: '#ffffff',
                                                borderWidth: 8,
                                                hoverOffset: 20,
                                                hoverBorderColor: '#f8f9fa'
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            cutout: '75%',
                                            animation: { duration: 0 }, // Crucial para la captura de pantalla
                                            plugins: {
                                                legend: {
                                                    position: 'bottom',
                                                    labels: {
                                                        padding: 25,
                                                        usePointStyle: true,
                                                        pointStyle: 'rectRounded',
                                                        font: { size: 14, family: 'Poppins', weight: '600' },
                                                        color: '#495057'
                                                    }
                                                },
                                                tooltip: {
                                                    enabled: true,
                                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                    titleColor: 'var(--rosa-principal)',
                                                    bodyColor: '#ffffff',
                                                    borderColor: 'var(--rosa-principal)',
                                                    borderWidth: 1,
                                                    padding: 12,
                                                    cornerRadius: 8,
                                                    callbacks: {
                                                        label: c => ` ${c.label}: ${c.raw.toLocaleString('es-MX')} piezas`
                                                    }
                                                }
                                            }
                                        },
                                        plugins: [{
                                            id: 'doughnut-center-text',
                                            beforeDraw: function (chart) {
                                                const { width, height, ctx } = chart;
                                                ctx.restore();
                                                const fontSize = (height / 110).toFixed(2);
                                                ctx.font = `700 ${fontSize}em Poppins`;
                                                ctx.textBaseline = "middle";
                                                const text = `${stats.avance}%`;
                                                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                                                const textY = height / 2;
                                                ctx.fillStyle = '#343a40';
                                                ctx.fillText(text, textX, textY);
                                                ctx.save();
                                            }
                                        }]
                                    });
                                }
                            }
                        });

                    } catch (e) {
                        console.error("Error al generar dashboard PRO:", e);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error Inesperado',
                            text: 'No se pudo generar el dashboard del archivo.'
                        });
                    }
                };
                /**
/**
 * FUNCIÓN GENERATEPDFREPORT - VERSIÓN SIN ICONOS ULTRA PROFESIONAL
 * Genera un reporte PDF con diseño corporativo profesional, dashboard visual y análisis por jefaturas
 */
window.generatePdfReport = async function(folder, name) {
    try {
        // El manifestoId es el name del archivo
        const manifestoId = name;
        
        // Cargar datos del manifiesto desde Firebase
        const manifestData = await reconstructManifestDataFromFirebase(manifestoId);
        if (!manifestData || !manifestData.data) {
            throw new Error("No se encontró el manifiesto especificado");
        }

        // --- Cargar información de jefes desde Secciones.xlsx ---
        const seccionToJefeMap = new Map();
        try {
            const seccionesURL = await storage.ref('ExcelManifiestos/Secciones.xlsx').getDownloadURL();
            const seccionesBuffer = await (await fetch(seccionesURL)).arrayBuffer();
            const seccionesWB = XLSX.read(seccionesBuffer, { type: 'array' });

            const findSheetName = (workbook) => {
                const possibleNames = ["jefatura sil", "jefaturaa"];
                return workbook.SheetNames.find(sheet => possibleNames.includes(sheet.trim().toLowerCase())) || workbook.SheetNames[0];
            };
            const sheetName = findSheetName(seccionesWB);
            if (!sheetName) throw new Error(`No se encontró una hoja de cálculo en Secciones.xlsx.`);

            const worksheet = seccionesWB.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            if (data.length < 1) throw new Error(`La hoja "${sheetName}" está vacía.`);

            let headerRowIndex = -1, seccionIndex = -1, jefaturaIndex = -1;
            for (let i = 0; i < Math.min(5, data.length); i++) {
                const headers = data[i].map(h => String(h || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
                const tempSeccionIndex = headers.indexOf('seccion');
                const tempJefaturaIndex = headers.indexOf('jefatura');
                if (tempSeccionIndex !== -1 && tempJefaturaIndex !== -1) {
                    headerRowIndex = i; seccionIndex = tempSeccionIndex; jefaturaIndex = tempJefaturaIndex;
                    break;
                }
            }

            if (headerRowIndex === -1) throw new Error(`No se encontraron las columnas "Seccion" y "Jefatura".`);

            for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                const seccion = String(row[seccionIndex] || '').trim().toUpperCase();
                const jefe = String(row[jefaturaIndex] || 'Sin Asignar').trim();
                if (seccion) seccionToJefeMap.set(seccion, jefe);
            }
        } catch (error) {
            console.warn("Error al cargar información de jefes:", error);
        }

        // Calcular estadísticas
        const stats = calculateProStatistics(manifestData.data);

        // Función helper para convertir los arrays de estadísticas al formato esperado
        const formatTopItems = (topArray, type) => {
            if (!Array.isArray(topArray)) return [];
            return topArray.map(([name, count]) => ({
                [type === 'container' ? 'container' : 'section']: name,
                missing: count,
                percentage: stats.totalSAP > 0 ? (count / stats.totalSAP) * 100 : 0
            }));
        };

        // Convertir las estadísticas al formato esperado
        const topMissingContainers = formatTopItems(stats.topContenedoresFaltantes || [], 'container');
        const allMissingSections = formatTopItems(stats.topSeccionesFaltantes || [], 'section');
        const topExcessContainers = formatTopItems(stats.topContenedoresExcedentes || [], 'container');

        // Calcular estadísticas por jefe
        const jefaturaStats = new Map();
        manifestData.data.forEach(row => {
            const seccion = String(row.SECCION || '').trim().toUpperCase();
            const jefe = seccionToJefeMap.get(seccion) || 'Sin Asignar';
            const sap = Number(row.SAP || 0);
            const scan = Number(row.SCANNER || 0);
            const diferencia = scan - sap;

            if (!jefaturaStats.has(jefe)) {
                jefaturaStats.set(jefe, {
                    totalSAP: 0,
                    totalSCAN: 0,
                    faltantes: 0,
                    excedentes: 0,
                    secciones: new Set()
                });
            }

            const jefeData = jefaturaStats.get(jefe);
            jefeData.totalSAP += sap;
            jefeData.totalSCAN += scan;
            if (diferencia < 0) jefeData.faltantes += Math.abs(diferencia);
            if (diferencia > 0) jefeData.excedentes += diferencia;
            jefeData.secciones.add(seccion);
        });

        // Obtener fecha y hora actual
        const now = new Date();
        const fechaCompleta = now.toLocaleDateString('es-MX', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const horaCompleta = now.toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // Crear el PDF usando pdfMake con diseño ULTRA PROFESIONAL SIN ICONOS
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [35, 85, 35, 85],
            info: {
                title: `Dashboard Ejecutivo Premium - ${name}`,
                author: 'Sistema Integral de Gestión Liverpool',
                subject: 'Dashboard Ejecutivo y Análisis Estratégico de Inventario',
                keywords: 'dashboard, ejecutivo, manifiesto, inventario, análisis, liverpool, jefaturas, premium'
            },
            
            // Header Premium
            header: function(currentPage, pageCount) {
                return {
                    margin: [35, 15, 35, 0],
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    columns: [
                                        {
                                            width: '*',
                                            stack: [
                                                { 
                                                    text: 'LIVERPOOL', 
                                                    style: 'headerBrandMain',
                                                    margin: [0, 0, 0, 2]
                                                },
                                                { 
                                                    text: 'DASHBOARD EJECUTIVO PREMIUM', 
                                                    style: 'headerBrandSub'
                                                }
                                            ]
                                        },
                                        {
                                            width: 'auto',
                                            stack: [
                                                { 
                                                    text: `Página ${currentPage} de ${pageCount}`, 
                                                    style: 'pageNumber',
                                                    alignment: 'right'
                                                },
                                                { 
                                                    text: fechaCompleta, 
                                                    style: 'headerDate',
                                                    alignment: 'right'
                                                }
                                            ]
                                        }
                                    ],
                                    fillColor: '#FFFFFF',
                                    margin: [15, 10, 15, 10]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: function() { return 3; },
                        vLineWidth: function() { return 3; },
                        hLineColor: function() { return '#E6007E'; },
                        vLineColor: function() { return '#E6007E'; }
                    }
                };
            },
            
            // Footer Premium
            footer: function(currentPage, pageCount) {
                return {
                    margin: [35, 0, 35, 15],
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                { 
                                    text: `Sistema Integral de Gestión Liverpool | Generado el ${fechaCompleta} a las ${horaCompleta} | Confidencial`,
                                    style: 'footerPremium',
                                    alignment: 'center',
                                    fillColor: '#F8F9FA',
                                    margin: [10, 8, 10, 8]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: function() { return 2; },
                        vLineWidth: function() { return 2; },
                        hLineColor: function() { return '#E6007E'; },
                        vLineColor: function() { return '#E6007E'; }
                    }
                };
            },

            content: [
                // === PORTADA ESPECTACULAR ===
                {
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    stack: [
                                        {
                                            text: 'DASHBOARD EJECUTIVO',
                                            style: 'portadaTitle',
                                            alignment: 'center',
                                            margin: [0, 20, 0, 10]
                                        },
                                        {
                                            text: 'ANÁLISIS ESTRATÉGICO DE INVENTARIO',
                                            style: 'portadaSubtitle',
                                            alignment: 'center',
                                            margin: [0, 0, 0, 15]
                                        },
                                        {
                                            table: {
                                                widths: ['*'],
                                                body: [
                                                    [
                                                        {
                                                            text: `${name.replace(/\.xlsx$/i, '')}`,
                                                            style: 'manifestoName',
                                                            alignment: 'center',
                                                            fillColor: '#E6007E',
                                                            color: 'white',
                                                            margin: [20, 15, 20, 15]
                                                        }
                                                    ]
                                                ]
                                            },
                                            layout: 'noBorders',
                                            margin: [50, 0, 50, 15]
                                        },
                                        {
                                            text: `TIENDA: ${folder}`,
                                            style: 'tiendaInfo',
                                            alignment: 'center',
                                            margin: [0, 0, 0, 20]
                                        }
                                    ],
                                    fillColor: '#FAFBFC',
                                    margin: [25, 25, 25, 25]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: function() { return 4; },
                        vLineWidth: function() { return 4; },
                        hLineColor: function() { return '#E6007E'; },
                        vLineColor: function() { return '#E6007E'; }
                    },
                    margin: [0, 0, 0, 30]
                },

                // === MÉTRICAS PRINCIPALES ESPECTACULARES ===
                {
                    text: 'MÉTRICAS PRINCIPALES',
                    style: 'sectionTitlePremium',
                    margin: [0, 0, 0, 20]
                },
                {
                    columns: [
                        {
                            width: '23%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'TOTAL', 
                                                    style: 'metricLabel',
                                                    color: '#2196F3',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 8]
                                                },
                                                { 
                                                    text: stats.totalSKUs.toLocaleString(), 
                                                    style: 'metricNumber',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: 'SKUs', 
                                                    style: 'metricSubLabel',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#E3F2FD',
                                            margin: [12, 18, 12, 18]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 3,
                                vLineWidth: () => 3,
                                hLineColor: () => '#2196F3',
                                vLineColor: () => '#2196F3'
                            }
                        },
                        { width: '2%', text: '' },
                        {
                            width: '23%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'ESPERADO', 
                                                    style: 'metricLabel',
                                                    color: '#9C27B0',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 8]
                                                },
                                                { 
                                                    text: stats.totalSAP.toLocaleString(), 
                                                    style: 'metricNumber',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: 'UNIDADES', 
                                                    style: 'metricSubLabel',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#F3E5F5',
                                            margin: [12, 18, 12, 18]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 3,
                                vLineWidth: () => 3,
                                hLineColor: () => '#9C27B0',
                                vLineColor: () => '#9C27B0'
                            }
                        },
                        { width: '2%', text: '' },
                        {
                            width: '23%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'ESCANEADO', 
                                                    style: 'metricLabel',
                                                    color: '#4CAF50',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 8]
                                                },
                                                { 
                                                    text: stats.totalSCAN.toLocaleString(), 
                                                    style: 'metricNumber',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: 'UNIDADES', 
                                                    style: 'metricSubLabel',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#E8F5E8',
                                            margin: [12, 18, 12, 18]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 3,
                                vLineWidth: () => 3,
                                hLineColor: () => '#4CAF50',
                                vLineColor: () => '#4CAF50'
                            }
                        },
                        { width: '2%', text: '' },
                        {
                            width: '25%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'PROGRESO', 
                                                    style: 'metricLabel',
                                                    color: '#FF9800',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 8]
                                                },
                                                { 
                                                    text: `${stats.avance}%`, 
                                                    style: 'metricNumber',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: 'COMPLETADO', 
                                                    style: 'metricSubLabel',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#FFF3E0',
                                            margin: [12, 18, 12, 18]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 3,
                                vLineWidth: () => 3,
                                hLineColor: () => '#FF9800',
                                vLineColor: () => '#FF9800'
                            }
                        }
                    ],
                    margin: [0, 0, 0, 30]
                },

                // === INDICADORES DE ESTADO ===
                {
                    text: 'INDICADORES DE ESTADO',
                    style: 'sectionTitlePremium',
                    margin: [0, 0, 0, 20]
                },
                {
                    columns: [
                        {
                            width: '48%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'FALTANTES', 
                                                    style: 'indicatorTitle',
                                                    color: '#DC3545',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 10]
                                                },
                                                { 
                                                    text: stats.faltantes.toLocaleString(), 
                                                    style: 'indicatorNumber',
                                                    color: '#DC3545',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: `${((stats.faltantes / stats.totalSAP) * 100).toFixed(2)}% del total`, 
                                                    style: 'indicatorPercent',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#F8D7DA',
                                            margin: [15, 20, 15, 20]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 2,
                                vLineWidth: () => 2,
                                hLineColor: () => '#DC3545',
                                vLineColor: () => '#DC3545'
                            }
                        },
                        { width: '4%', text: '' },
                        {
                            width: '48%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            stack: [
                                                { 
                                                    text: 'EXCEDENTES', 
                                                    style: 'indicatorTitle',
                                                    color: '#FFC107',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 10]
                                                },
                                                { 
                                                    text: stats.excedentes.toLocaleString(), 
                                                    style: 'indicatorNumber',
                                                    color: '#FFC107',
                                                    alignment: 'center',
                                                    margin: [0, 0, 0, 5]
                                                },
                                                { 
                                                    text: `${((stats.excedentes / stats.totalSAP) * 100).toFixed(2)}% del total`, 
                                                    style: 'indicatorPercent',
                                                    alignment: 'center'
                                                }
                                            ],
                                            fillColor: '#FFF3CD',
                                            margin: [15, 20, 15, 20]
                                        }
                                    ]
                                ]
                            },
                            layout: {
                                hLineWidth: () => 2,
                                vLineWidth: () => 2,
                                hLineColor: () => '#FFC107',
                                vLineColor: () => '#FFC107'
                            }
                        }
                    ],
                    margin: [0, 0, 0, 30]
                },

                // === ANÁLISIS POR JEFATURAS PREMIUM ===
                {
                    text: 'ANÁLISIS POR JEFATURAS',
                    style: 'sectionTitlePremium',
                    margin: [0, 0, 0, 20]
                },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'JEFE', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' },
                                { text: 'ESPERADO', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' },
                                { text: 'ESCANEADO', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' },
                                { text: 'FALTANTES', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' },
                                { text: 'EXCEDENTES', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' },
                                { text: 'SECCIONES', style: 'tableHeaderPremium', fillColor: '#E6007E', color: 'white' }
                            ],
                            ...Array.from(jefaturaStats.entries())
                                .sort((a, b) => b[1].faltantes - a[1].faltantes)
                                .map(([jefe, data], index) => [
                                    { text: jefe, style: 'tableCell', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: data.totalSAP.toLocaleString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: data.totalSCAN.toLocaleString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: data.faltantes.toLocaleString(), style: 'tableCellNumber', color: data.faltantes > 0 ? '#DC3545' : '#28A745', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: data.excedentes.toLocaleString(), style: 'tableCellNumber', color: data.excedentes > 0 ? '#FFC107' : '#28A745', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: data.secciones.size.toString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' }
                                ])
                        ]
                    },
                    layout: {
                        hLineWidth: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? 2 : 1; },
                        vLineWidth: function() { return 1; },
                        hLineColor: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? '#E6007E' : '#DEE2E6'; },
                        vLineColor: function() { return '#DEE2E6'; }
                    },
                    margin: [0, 0, 0, 30]
                },

                // === TOP 15 CONTENEDORES FALTANTES ===
                ...(topMissingContainers.length > 0 ? [
                    {
                        text: 'TOP 15 CONTENEDORES CON FALTANTES',
                        style: 'sectionTitlePremium',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['auto', '*', 'auto', 'auto'],
                            body: [
                                [
                                    { text: 'No.', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'CONTENEDOR', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'FALTANTES', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'PORCENTAJE', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' }
                                ],
                                ...topMissingContainers.slice(0, 15).map((item, index) => [
                                    { text: (index + 1).toString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.container, style: 'tableCell', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.missing.toLocaleString(), style: 'tableCellNumber', color: '#DC3545', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: `${item.percentage.toFixed(2)}%`, style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' }
                                ])
                            ]
                        },
                        layout: {
                            hLineWidth: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? 2 : 1; },
                            vLineWidth: function() { return 1; },
                            hLineColor: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? '#DC3545' : '#DEE2E6'; },
                            vLineColor: function() { return '#DEE2E6'; }
                        },
                        margin: [0, 0, 0, 30]
                    }
                ] : []),

                // === TODAS LAS SECCIONES CON FALTANTES ===
                ...(allMissingSections.length > 0 ? [
                    {
                        text: 'TODAS LAS SECCIONES CON FALTANTES',
                        style: 'sectionTitlePremium',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['auto', '*', 'auto', 'auto'],
                            body: [
                                [
                                    { text: 'No.', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'SECCIÓN', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'FALTANTES', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' },
                                    { text: 'PORCENTAJE', style: 'tableHeaderPremium', fillColor: '#DC3545', color: 'white' }
                                ],
                                ...allMissingSections.map((item, index) => [
                                    { text: (index + 1).toString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.section, style: 'tableCell', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.missing.toLocaleString(), style: 'tableCellNumber', color: '#DC3545', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: `${item.percentage.toFixed(2)}%`, style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' }
                                ])
                            ]
                        },
                        layout: {
                            hLineWidth: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? 2 : 1; },
                            vLineWidth: function() { return 1; },
                            hLineColor: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? '#DC3545' : '#DEE2E6'; },
                            vLineColor: function() { return '#DEE2E6'; }
                        },
                        margin: [0, 0, 0, 30]
                    }
                ] : []),

                // === TOP 10 CONTENEDORES EXCEDENTES (si existen) ===
                ...(topExcessContainers.length > 0 ? [
                    {
                        text: 'TOP 10 CONTENEDORES CON EXCEDENTES',
                        style: 'sectionTitlePremium',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['auto', '*', 'auto', 'auto'],
                            body: [
                                [
                                    { text: 'No.', style: 'tableHeaderPremium', fillColor: '#FFC107', color: 'white' },
                                    { text: 'CONTENEDOR', style: 'tableHeaderPremium', fillColor: '#FFC107', color: 'white' },
                                    { text: 'EXCEDENTES', style: 'tableHeaderPremium', fillColor: '#FFC107', color: 'white' },
                                    { text: 'PORCENTAJE', style: 'tableHeaderPremium', fillColor: '#FFC107', color: 'white' }
                                ],
                                ...topExcessContainers.slice(0, 10).map((item, index) => [
                                    { text: (index + 1).toString(), style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.container, style: 'tableCell', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: item.missing.toLocaleString(), style: 'tableCellNumber', color: '#FFC107', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' },
                                    { text: `${item.percentage.toFixed(2)}%`, style: 'tableCellNumber', fillColor: index % 2 === 0 ? '#F8F9FA' : '#FFFFFF' }
                                ])
                            ]
                        },
                        layout: {
                            hLineWidth: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? 2 : 1; },
                            vLineWidth: function() { return 1; },
                            hLineColor: function(i, node) { return i === 0 || i === 1 || i === node.table.body.length ? '#FFC107' : '#DEE2E6'; },
                            vLineColor: function() { return '#DEE2E6'; }
                        },
                        margin: [0, 0, 0, 30]
                    }
                ] : []),

                // === RESUMEN ESTADÍSTICO DETALLADO ===
                {
                    text: 'RESUMEN ESTADÍSTICO DETALLADO',
                    style: 'sectionTitlePremium',
                    margin: [0, 0, 0, 20]
                },
                {
                    table: {
                        widths: ['*', '*'],
                        body: [
                            [
                                {
                                    stack: [
                                        { text: 'ANÁLISIS DE PRECISIÓN DE INVENTARIO', style: 'summaryTitle', margin: [0, 0, 0, 10] },
                                        { text: `Precisión General: ${stats.avance}%`, style: 'summaryItem' },
                                        { text: `SKUs Procesados: ${stats.totalSKUs.toLocaleString()}`, style: 'summaryItem' },
                                        { text: `Unidades Esperadas: ${stats.totalSAP.toLocaleString()}`, style: 'summaryItem' },
                                        { text: `Unidades Escaneadas: ${stats.totalSCAN.toLocaleString()}`, style: 'summaryItem' },
                                        { text: `Diferencia Total: ${(stats.totalSCAN - stats.totalSAP).toLocaleString()}`, style: 'summaryItem' }
                                    ],
                                    fillColor: '#F8F9FA',
                                    margin: [15, 15, 15, 15]
                                },
                                {
                                    stack: [
                                        { text: 'DISTRIBUCIÓN DE DISCREPANCIAS', style: 'summaryTitle', margin: [0, 0, 0, 10] },
                                        { text: `Faltantes: ${stats.faltantes.toLocaleString()} (${((stats.faltantes / stats.totalSAP) * 100).toFixed(2)}%)`, style: 'summaryItem', color: '#DC3545' },
                                        { text: `Excedentes: ${stats.excedentes.toLocaleString()} (${((stats.excedentes / stats.totalSAP) * 100).toFixed(2)}%)`, style: 'summaryItem', color: '#FFC107' },
                                        { text: `Contenedores con Faltantes: ${topMissingContainers.length}`, style: 'summaryItem' },
                                        { text: `Secciones con Faltantes: ${allMissingSections.length}`, style: 'summaryItem' },
                                        { text: `Contenedores con Excedentes: ${topExcessContainers.length}`, style: 'summaryItem' }
                                    ],
                                    fillColor: '#F8F9FA',
                                    margin: [15, 15, 15, 15]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 2,
                        vLineWidth: () => 2,
                        hLineColor: () => '#E6007E',
                        vLineColor: () => '#E6007E'
                    },
                    margin: [0, 0, 0, 30]
                },

                // === CONCLUSIONES Y RECOMENDACIONES MEJORADAS ===
                {
                    text: 'CONCLUSIONES EJECUTIVAS Y PLAN DE ACCIÓN',
                    style: 'sectionTitlePremium',
                    margin: [0, 0, 0, 20]
                },
                {
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    stack: [
                                        { text: 'ANÁLISIS EJECUTIVO', style: 'conclusionTitle', margin: [0, 0, 0, 15] },
                                        { 
                                            text: stats.avance >= 95 ? 
                                                'EXCELENTE: El inventario presenta una precisión excepcional. Se recomienda mantener los procesos actuales.' :
                                                stats.avance >= 85 ? 
                                                'BUENO: El inventario muestra una precisión aceptable con oportunidades de mejora en áreas específicas.' :
                                                stats.avance >= 70 ? 
                                                'REGULAR: Se requiere atención inmediata en las discrepancias identificadas para mejorar la precisión.' :
                                                'CRÍTICO: Se necesita una revisión completa del proceso de inventario y acciones correctivas urgentes.',
                                            style: 'conclusionText',
                                            margin: [0, 0, 0, 15]
                                        },
                                        { text: 'RECOMENDACIONES ESTRATÉGICAS', style: 'conclusionTitle', margin: [0, 0, 0, 15] },
                                        { 
                                            ul: [
                                                stats.faltantes > stats.excedentes ? 
                                                    'Priorizar la búsqueda de productos faltantes en las secciones identificadas' :
                                                    'Revisar procesos de recepción para reducir excedentes',
                                                'Implementar controles adicionales en los contenedores con mayor discrepancia',
                                                'Capacitar al personal de las jefaturas con mayor número de faltantes',
                                                'Establecer un programa de auditorías periódicas en las secciones críticas',
                                                'Mejorar la comunicación entre jefaturas para optimizar la distribución de inventario'
                                            ],
                                            style: 'recommendationList'
                                        }
                                    ],
                                    fillColor: '#F0F8FF',
                                    margin: [20, 20, 20, 20]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 3,
                        vLineWidth: () => 3,
                        hLineColor: () => '#E6007E',
                        vLineColor: () => '#E6007E'
                    },
                    margin: [0, 0, 0, 20]
                },

                // === INFORMACIÓN DE GENERACIÓN ===
                {
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    text: `Reporte generado automáticamente el ${fechaCompleta} a las ${horaCompleta} | Sistema Integral de Gestión Liverpool`,
                                    style: 'generationInfo',
                                    alignment: 'center',
                                    fillColor: '#F8F9FA',
                                    margin: [10, 10, 10, 10]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 1,
                        vLineWidth: () => 1,
                        hLineColor: () => '#DEE2E6',
                        vLineColor: () => '#DEE2E6'
                    }
                }
            ],

            // === ESTILOS PREMIUM ULTRA PROFESIONALES ===
            styles: {
                // Headers y Branding
                headerBrandMain: { fontSize: 16, bold: true, color: '#E6007E' },
                headerBrandSub: { fontSize: 10, color: '#6C757D' },
                pageNumber: { fontSize: 9, color: '#6C757D' },
                headerDate: { fontSize: 8, color: '#6C757D' },
                footerPremium: { fontSize: 8, color: '#6C757D', italics: true },

                // Portada
                portadaTitle: { fontSize: 28, bold: true, color: '#E6007E' },
                portadaSubtitle: { fontSize: 16, color: '#6C757D' },
                manifestoName: { fontSize: 18, bold: true },
                tiendaInfo: { fontSize: 14, color: '#495057' },

                // Títulos de Sección
                sectionTitlePremium: { fontSize: 16, bold: true, color: '#E6007E', margin: [0, 20, 0, 10] },

                // Métricas
                metricLabel: { fontSize: 11, bold: true },
                metricNumber: { fontSize: 24, bold: true, color: '#212529' },
                metricSubLabel: { fontSize: 9, color: '#6C757D' },

                // Indicadores
                indicatorTitle: { fontSize: 14, bold: true },
                indicatorNumber: { fontSize: 20, bold: true },
                indicatorPercent: { fontSize: 10, color: '#6C757D' },

                // Tablas
                tableHeaderPremium: { fontSize: 11, bold: true, alignment: 'center' },
                tableCell: { fontSize: 10, margin: [5, 5, 5, 5] },
                tableCellNumber: { fontSize: 10, alignment: 'right', margin: [5, 5, 5, 5] },

                // Resumen
                summaryTitle: { fontSize: 12, bold: true, color: '#E6007E' },
                summaryItem: { fontSize: 10, margin: [0, 2, 0, 2] },

                // Conclusiones
                conclusionTitle: { fontSize: 14, bold: true, color: '#E6007E' },
                conclusionText: { fontSize: 11, lineHeight: 1.4 },
                recommendationList: { fontSize: 10, lineHeight: 1.3 },

                // Información de generación
                generationInfo: { fontSize: 8, color: '#6C757D', italics: true }
            }
        };

        // Generar y descargar el PDF
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.download(`Dashboard_Ejecutivo_${name.replace(/\.xlsx$/i, '')}_${folder}_${now.toISOString().slice(0, 10)}.pdf`);

        console.log("PDF generado exitosamente");
        return true;

    } catch (error) {
        console.error("Error al generar el PDF:", error);
        alert("Error al generar el PDF: " + error.message);
        return false;
    }
};
/**
 * ✅ SOLUCIÓN FINAL (V.5.3) - ASUNTO CON FECHA DE SUBIDA
 * Integra el mensaje específico del usuario, un resumen claro y añade la fecha al asunto del correo.
 */
window.generarReportesYCorreo = async (folder, name) => {
    Swal.fire({
        title: 'Generando Reporte de Alta Calidad...',
        html: 'Este proceso puede tardar un momento. Por favor, espera.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });

    try {
        // --- Lógica inicial para obtener datos y generar archivos (sin cambios) ---
        const manifest = await reconstructManifestDataFromFirebase(name);
        const stats = calculateProStatistics(manifest.data);
        
        const uploadDate = manifest.createdAt ? new Date(manifest.createdAt.toDate()) : new Date();
        const formattedDate = uploadDate.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        await window.downloadFile(folder, name);
        await window.generatePdfReport(folder, name);

        Swal.close();
        await window.verDashboardArchivo(folder, name);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const dashboardModal = document.querySelector('.swal2-popup.dashboard-modal');
        if (!dashboardModal) throw new Error("No se pudo encontrar el modal del dashboard.");

        const contentToCapture = dashboardModal.querySelector('.analisis-dashboard-pro');
        if (!contentToCapture) throw new Error("No se pudo encontrar el contenido del dashboard.");

        // --- Lógica de captura de imagen (sin cambios) ---
        const statCards = contentToCapture.querySelectorAll('.stat-card');
        const originalCardStyles = new Map();
        const solidColors = {
            total: '#E6007E', expected: '#6f42c1', scanned: '#198754',
            missing: '#dc3545', excess: '#ffc107'
        };
        statCards.forEach(card => {
            originalCardStyles.set(card, {
                card: card.style.cssText,
                value: card.querySelector('.stat-value')?.style.cssText || '',
                title: card.querySelector('.stat-title')?.style.cssText || ''
            });
            const classList = Array.from(card.classList);
            const colorClass = ['total', 'expected', 'scanned', 'missing', 'excess'].find(c => classList.includes(c));
            const solidColor = solidColors[colorClass] || '#dddddd';
            card.style.cssText += `background:#fdfdfd!important;box-shadow:none!important;animation:none!important;transition:none!important;`;
            const valueEl = card.querySelector('.stat-value');
            if (valueEl) valueEl.style.cssText += `color:#212529!important;`;
            const titleEl = card.querySelector('.stat-title');
            if (titleEl) titleEl.style.cssText += `color:${solidColor}!important;`;
        });
        const canvas = await html2canvas(contentToCapture, {
            scale: 3, backgroundColor: '#FFFFFF', useCORS: true, logging: false,
            scrollX: 0, scrollY: -window.scrollY
        });
        statCards.forEach(card => {
            const original = originalCardStyles.get(card);
            if (original) {
                card.style.cssText = original.card;
                const valueEl = card.querySelector('.stat-value');
                if (valueEl) valueEl.style.cssText = original.value;
                const titleEl = card.querySelector('.stat-title');
                if (titleEl) titleEl.style.cssText = original.title;
            }
        });
        const imageURL = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = `Dashboard_${name.replace(/\.xlsx$/i, '')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.close();

        // ==================================================================
        // --- INICIO DE SECCIÓN DE CORREO ACTUALIZADA ---
        // ==================================================================

        const nombreBaseArchivo = name.replace(/\.xlsx$/i, '');

        const correos = [
            'bplopezr@liverpool.com.mx', 'eirojas@liverpool.com.mx', 'babanuelosr@liverpool.com.mx',
            'amoralesp@liverpool.com.mx', 'agavila@liverpool.com.mx', 'jjmendozaa@liverpool.com.mx',
            'jfdominguezb@liverpool.com.mx', 'yymatasm@liverpool.com.mx', 'mireyesb@liverpool.com.mx',
            'lcastillor@liverpool.com.mx', 'oamuedanov@liverpool.com.mx', 'ecoronadoh@liverpool.com.mx',
            'edcastilloj@liverpool.com.mx', 'jgonzalezs14@liverpool.com.mx', 'ygtiripitig@liverpool.com.mx'
        ].join(',');

        // Asunto actualizado para incluir la fecha de subida
        const asunto = `Análisis de Manifiesto: ${nombreBaseArchivo} - ${formattedDate}`;
        
        // Cuerpo del correo (sin cambios respecto a la versión anterior)
        const cuerpo = `
Buenas tardes, jefes:

Les comparto el manifiesto ${nombreBaseArchivo} para su análisis y acción correspondiente.
En el archivo PDF adjunto podrán encontrar el detalle de las secciones y contenedores con faltantes, todo debidamente señalado.
Asimismo, en el archivo Excel se incluyen todos los datos para su revisión.

Quedo atento a cualquier comentario o indicación.
Saludos.

--------------------------------------------------
RESUMEN DE CIFRAS
--------------------------------------------------
- Avance del Proceso: ${stats.avance}%
- Artículos Esperados: ${stats.totalSAP}
- Artículos Escaneados: ${stats.totalSCAN}
- Faltantes: ${stats.faltantes}
- Excedentes: ${stats.excedentes}
--------------------------------------------------
`;

        const mailtoLink = `mailto:${correos}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

        setTimeout(() => {
            window.location.href = mailtoLink;
        }, 500);

        Swal.fire({
            icon: 'success',
            title: '¡Proceso completado!',
            html: `Se han descargado los 3 reportes.<br><b>Por favor, adjúntalos manualmente al correo que se acaba de abrir.</b>`,
            confirmButtonText: '¡Excelente!'
        });

    } catch (error) {
        console.error("Error en el proceso de reporte y correo:", error);
        Swal.fire('¡Error!', 'Ocurrió un problema durante el proceso. Revisa la consola para más detalles.', 'error');
    }
};

                /**
                 * ✅ VERSIÓN FINAL (17.0) - ¡SOLUCIÓN FINAL Y ROBUSTA PARA CAMPOS VACÍOS!
                 * Maneja DAÑO_CANTIDAD y DAÑO_FOTO_URL para que queden vacíos si no hay información.
                 * - MANIFIESTO, SKU, EUROPEO, ENTREGADO_A: Numérico entero SIN separador de miles (formato Excel '0').
                 * - CONTENEDOR: Siempre TEXTO (sin conversiones numéricas).
                 * - SAP, SCANNER, DIFERENCIA: Numérico con separador de miles (formato Excel '#,##0').
                 * - DAÑO_CANTIDAD: Numérico sin comas (formato '0'), o vacío si es 0/null/undefined/cadena vacía.
                 * - DAÑO_FOTO_URL: Texto, o vacío si es null/undefined/cadena vacía.
                 */
                window.downloadFile = async function (folder, name) {
                    const manifestoId = name;
                    if (!manifestoId) return Swal.fire('Error', 'No se ha seleccionado manifiesto.', 'error');

                    // --- VERIFICACIÓN CRÍTICA: ¿xlsx-js-style está cargado? ---
                    try {
                        const test_wb = XLSX.utils.book_new();
                        const test_ws = XLSX.utils.aoa_to_sheet([["Test"]]);
                        const cell = test_ws['A1'];
                        cell.s = { fill: { fgColor: { rgb: "FF0000" } } };
                    } catch (e) {
                        console.error("Error al verificar xlsx-js-style:", e);
                        return Swal.fire(
                            'Error de Configuración',
                            'Parece que la librería "xlsx-js-style" no está cargada correctamente o en la versión adecuada. ' +
                            'Asegúrate de que `xlsx.full.min.js` se cargue primero y luego `xlsx.bundle.js` de "xlsx-js-style".',
                            'error'
                        );
                    }
                    // --- FIN VERIFICACIÓN CRÍTICA ---

                    Swal.fire({
                        title: 'Generando Reporte Profesional...',
                        html: 'Creando dashboard y hojas de análisis. Por favor, espera.',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });

                    try {
                        // --- Paso 1: Cargar y procesar el archivo de Jefaturas ---
                        const seccionToJefeMap = new Map();
                        try {
                            const seccionesURL = await storage.ref('ExcelManifiestos/Secciones.xlsx').getDownloadURL();
                            const seccionesBuffer = await (await fetch(seccionesURL)).arrayBuffer();
                            const seccionesWB = XLSX.read(seccionesBuffer, { type: 'array' });

                            const findSheetName = (workbook) => {
                                const possibleNames = ["jefatura sil", "jefaturaa"];
                                return workbook.SheetNames.find(sheet => possibleNames.includes(sheet.trim().toLowerCase())) || workbook.SheetNames[0];
                            };
                            const sheetName = findSheetName(seccionesWB);
                            if (!sheetName) throw new Error(`No se encontró una hoja de cálculo en Secciones.xlsx.`);

                            const worksheet = seccionesWB.Sheets[sheetName];
                            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                            if (data.length < 1) throw new Error(`La hoja "${sheetName}" está vacía.`);

                            let headerRowIndex = -1, seccionIndex = -1, jefaturaIndex = -1;
                            for (let i = 0; i < Math.min(5, data.length); i++) {
                                const headers = data[i].map(h => String(h || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
                                const tempSeccionIndex = headers.indexOf('seccion');
                                const tempJefaturaIndex = headers.indexOf('jefatura');
                                if (tempSeccionIndex !== -1 && tempJefaturaIndex !== -1) {
                                    headerRowIndex = i; seccionIndex = tempSeccionIndex; jefaturaIndex = tempJefaturaIndex;
                                    break;
                                }
                            }

                            if (headerRowIndex === -1) throw new Error(`No se encontraron las columnas "Seccion" y "Jefatura".`);

                            for (let i = headerRowIndex + 1; i < data.length; i++) {
                                const row = data[i];
                                const seccion = String(row[seccionIndex] || '').trim().toUpperCase();
                                const jefe = String(row[jefaturaIndex] || 'Sin Asignar').trim();
                                if (seccion) seccionToJefeMap.set(seccion, jefe);
                            }
                        } catch (error) {
                            throw new Error("Error al leer Secciones.xlsx: " + error.message);
                        }

                        // --- Paso 2: Obtener y procesar datos del manifiesto ---
                        const manifest = await reconstructManifestDataFromFirebase(manifestoId);

                        // --- DEFINICIÓN CLAVE DE CÓMO SE PROCESAN Y CATEGORIZAN LAS COLUMNAS ---
                        // Columnas que deben ser NUMEROS con separador de miles (ej. 1,234)
                        const numericWithCommaFormatKeys = ['SAP', 'SCANNER', 'DIFERENCIA']; // Se añade DIFERENCIA aquí
                        // Columnas que deben ser NUMEROS largos SIN separador de miles (ej. 5007636731).
                        // Se incluyen aquí 'DAÑO_CANTIDAD' para tratarlo como número.
                        const numericNoCommaFormatKeys = ['MANIFIESTO', 'SKU', 'EUROPEO', 'ENTREGADO_A', 'DAÑO_CANTIDAD'];
                        // Columnas que SIEMPRE deben ser TEXTO (ej. Q0084429, URLs).
                        // Se incluye aquí 'DAÑO_FOTO_URL'.
                        const textFormatKeys = ['CONTENEDOR', 'SECCION', 'JEFATURA', 'DAÑO_FOTO_URL'];

                        const augmentedData = manifest.data.map(row => {
                            const newRow = {};

                            // Mapear los nombres de las columnas a sus valores en el row, independientemente del casing
                            const findValueByKey = (obj, keyName) => {
                                const foundKey = Object.keys(obj).find(k => k.trim().toUpperCase() === keyName.toUpperCase());
                                return foundKey ? obj[foundKey] : undefined;
                            };

                            for (const originalKey in row) {
                                const upperKey = originalKey.trim().toUpperCase();
                                let value = row[originalKey];

                                // === LÓGICA PRINCIPAL PARA DEJAR CAMPOS VACÍOS ===
                                // Si el valor es null, undefined, o un string vacío/solo espacios
                                // O si es DAÑO_CANTIDAD y su valor es 0 (que se convertiría a 00/01/1900)
                                if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ||
                                    (upperKey === 'DAÑO_CANTIDAD' && (value === 0 || value === '0'))) { // Condición específica para DAÑO_CANTIDAD
                                    newRow[originalKey] = null; // Establecer a null para que quede vacío en Excel
                                    continue; // Saltar al siguiente campo
                                }
                                // === FIN LÓGICA PRINCIPAL PARA DEJAR CAMPOS VACÍOS ===


                                if (textFormatKeys.includes(upperKey)) {
                                    newRow[originalKey] = String(value); // Asegurar que es string si tiene algún valor
                                    continue;
                                }

                                if (typeof value === 'string') {
                                    // Para columnas que deben ser números, limpiar y convertir
                                    const cleanedValue = value.replace(/,/g, ''); // Eliminar todas las comas del string original
                                    const numValue = Number(cleanedValue);

                                    if (isNaN(numValue)) {
                                        // Si después de limpiar comas, NO es un número válido, mantenerlo como string
                                        newRow[originalKey] = String(value);
                                    } else {
                                        // Si es un número válido, convertirlo
                                        newRow[originalKey] = numValue;
                                    }
                                } else {
                                    // Si ya es un número o cualquier otro tipo, mantenerlo
                                    newRow[originalKey] = value;
                                }
                            }

                            // Añadir la jefatura como antes
                            const seccionKey = Object.keys(newRow).find(k => k.trim().toUpperCase() === 'SECCION');
                            const seccionValue = seccionKey ? newRow[seccionKey] : '';
                            const seccion = String(seccionValue || '').trim().toUpperCase();
                            const jefe = seccionToJefeMap.get(seccion) || 'Sin Jefe Asignado';
                            newRow.JEFATURA = jefe;

                            // Añadir la columna DIFERENCIA
                            const sapValue = Number(findValueByKey(newRow, 'SAP') || 0);
                            const scannerValue = Number(findValueByKey(newRow, 'SCANNER') || 0);
                            newRow.DIFERENCIA = scannerValue - sapValue;

                            return newRow;
                        });

                        // Asegurarse de que JEFATURA esté en la primera posición para la vista en Excel (esto es por el .sort)
                        augmentedData.sort((a, b) => {
                            const jefaturaA = a.JEFATURA || ''; // Manejar si JEFATURA es null
                            const jefaturaB = b.JEFATURA || ''; // Manejar si JEFATURA es null
                            const skuA = String(a.SKU || ''); // Manejar si SKU es null
                            const skuB = String(b.SKU || ''); // Manejar si SKU es null
                            return jefaturaA.localeCompare(jefaturaB) || skuA.localeCompare(skuB);
                        });


                        // --- Paso 3: Crear el libro de Excel y definir estilos ---
                        const wb = XLSX.utils.book_new();
                        const commonBorderStyle = { style: "thin", color: { rgb: "C0C0C0" } }; // Borde gris claro

                        const styles = {
                            mainHeader: {
                                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
                                fill: { fgColor: { rgb: "333333" } }, // Fondo gris oscuro
                                alignment: { horizontal: "center", vertical: "center" },
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            analysisHeader: {
                                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
                                fill: { fgColor: { rgb: "0056b3" } }, // Fondo azul
                                alignment: { horizontal: "center", vertical: "center" },
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            dataRowEven: {
                                fill: { fgColor: { rgb: "F0F0F0" } }, // Gris claro para filas pares
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            dataRowOdd: {
                                fill: { fgColor: { rgb: "FFFFFF" } }, // Blanco para filas impares
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            dashTitle: { font: { sz: 18, bold: true, color: { rgb: "E6007E" } } },
                            dashSubtitle: { font: { sz: 11, italic: true, color: { rgb: "6c757d" } } },
                            dashHeader: { font: { sz: 14, bold: true, color: { rgb: "000000" } } },
                            metricLabel: { font: { bold: true, color: { rgb: "6c757d" } }, alignment: { horizontal: "right" } },
                            metricValue: { font: { sz: 12, bold: true }, alignment: { horizontal: "left" } },
                            metricPositive: { font: { sz: 12, bold: true, color: { rgb: "28a745" } }, alignment: { horizontal: "left" } },
                            metricNegative: { font: { sz: 12, bold: true, color: { rgb: "dc3545" } }, alignment: { horizontal: "left" } },

                            // Nuevos estilos para la columna DIFERENCIA en "Reporte por Jefatura"
                            diffOk: { // Verde para 0
                                font: { bold: true, color: { rgb: "28a745" } }, // Color verde
                                fill: { fgColor: { rgb: "D4EDDA" } }, // Fondo verde claro
                                alignment: { horizontal: "center", vertical: "center" },
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            diffNegative: { // Rojo para faltantes
                                font: { bold: true, color: { rgb: "DC3545" } }, // Color rojo
                                fill: { fgColor: { rgb: "F8D7DA" } }, // Fondo rojo claro
                                alignment: { horizontal: "center", vertical: "center" },
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            diffPositive: { // Amarillo para excedentes
                                font: { bold: true, color: { rgb: "856404" } }, // Color amarillo oscuro (para contraste)
                                fill: { fgColor: { rgb: "FFF3CD" } }, // Fondo amarillo claro
                                alignment: { horizontal: "center", vertical: "center" },
                                border: { top: commonBorderStyle, bottom: commonBorderStyle, left: commonBorderStyle, right: commonBorderStyle }
                            },
                            dashDate: { font: { sz: 11, italic: true, color: { rgb: "6c757d" } }, alignment: { horizontal: "center" } } // Style for the date
                        };

                        // --- Función de ayuda para aplicar estilos a una hoja ---
                        const applyTableStyles = (ws, headerStyle, dataEvenStyle, dataOddStyle, numHeaderRows = 1) => {
                            if (!ws['!ref']) return;

                            const range = XLSX.utils.decode_range(ws['!ref']);
                            const numCols = range.e.c - range.s.c + 1;

                            // Aplicar estilos de encabezado
                            for (let r = 0; r < numHeaderRows; r++) {
                                for (let c = 0; c < numCols; c++) {
                                    const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
                                    if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
                                    ws[cellRef].s = headerStyle;
                                }
                            }

                            // Aplicar estilos de fila de datos (colores alternos y bordes)
                            for (let r = numHeaderRows; r <= range.e.r; r++) {
                                for (let c = 0; c < numCols; c++) {
                                    const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
                                    // No crear celda si el valor es null para dejarla vacía
                                    if (ws[cellRef] === undefined || ws[cellRef].v === null) {
                                        continue; // Si el valor es null/undefined, la celda ya está vacía, no aplicar estilos
                                    }

                                    // Solo aplicar estilo de fila si no es una celda de diferencia con estilo especial
                                    // We check if the cell already has one of our custom styles (diffOk, diffNegative, diffPositive)
                                    const hasCustomDiffStyle = ws[cellRef].s && (ws[cellRef].s === styles.diffOk || ws[cellRef].s === styles.diffNegative || ws[cellRef].s === styles.diffPositive);

                                    if (!ws[cellRef].s || (ws[cellRef].s !== headerStyle && !hasCustomDiffStyle)) {
                                        ws[cellRef].s = (r % 2 === 0) ? dataEvenStyle : dataOddStyle;
                                    } else if (!ws[cellRef].s && !hasCustomDiffStyle) { // Fallback if for some reason no style is present
                                        ws[cellRef].s = (r % 2 === 0) ? dataEvenStyle : dataOddStyle;
                                    }
                                }
                            }

                            // Autoajustar ancho de columnas
                            ws['!cols'] = [];
                            for (let C = 0; C < numCols; ++C) {
                                let max_width = 0;
                                for (let R = 0; R <= range.e.r; ++R) {
                                    const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
                                    if (cell && cell.v != null) {
                                        const cell_text = String(cell.v);
                                        const lines = cell_text.split(/\r\n|\r|\n/);
                                        const longest_line = lines.reduce((max, line) => Math.max(max, line.length), 0);
                                        max_width = Math.max(max_width, longest_line);
                                    }
                                }
                                ws['!cols'][C] = { wch: Math.min(60, Math.max(8, max_width + 2)) };
                            }

                            // Inmovilizar paneles (primera fila)
                            ws['!freeze'] = {
                                xSplit: "0",
                                ySplit: "1",
                                topLeftCell: "A2",
                                activePane: "bottomLeft",
                                state: "frozen"
                            };
                        };

                        // --- Hoja 4: Dashboard (moved to be processed first) ---
                        const stats = calculateProStatistics(augmentedData);

                        // Accessing manifest.createdAt for the upload date
                        // Format: "16 de julio de 2025, 4:48:32 p.m. UTC-6"
                        const uploadDateString = manifest.createdAt;
                        let formattedUploadDate = 'Fecha no disponible';

                        if (uploadDateString) {
                            try {
                                // Parse the string and format it.
                                // The provided string format is quite specific.
                                // It's safer to attempt parsing and then formatting.
                                // Example: "16 de julio de 2025, 4:48:32 p.m. UTC-6"
                                // Let's try a robust way to parse it, handling potential variations.
                                // For a specific "DD de MMMM de YYYY, HH:mm:ss a.m./p.m. UTC-X" format, direct parsing might be tricky.
                                // A more universal approach is to extract components or rely on robust Date parsing.
                                // Given the format "16 de julio de 2025, 4:48:32 p.m. UTC-6",
                                // we'll try to create a Date object and then format it to a readable string.

                                // For simplicity, if the string format is always consistent and recognized by Date.parse,
                                // we can do this:
                                const dateParts = uploadDateString.match(/(\d+) de (.+) de (\d{4}), (\d+):(\d+):(\d+) (a\.m\.|p\.m\.) UTC([+-]\d+)/i);
                                if (dateParts) {
                                    const day = parseInt(dateParts[1]);
                                    const monthName = dateParts[2].toLowerCase();
                                    const year = parseInt(dateParts[3]);
                                    let hour = parseInt(dateParts[4]);
                                    const minute = parseInt(dateParts[5]);
                                    const second = parseInt(dateParts[6]);
                                    const ampm = dateParts[7];
                                    const utcOffset = dateParts[8]; // e.g., -6

                                    const monthNames = {
                                        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
                                        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
                                    };
                                    const month = monthNames[monthName];

                                    if (ampm === 'p.m.' && hour !== 12) {
                                        hour += 12;
                                    } else if (ampm === 'a.m.' && hour === 12) {
                                        hour = 0; // 12 AM is 00:00
                                    }

                                    // Construct a date string that `new Date()` can parse reliably, e.g., "YYYY-MM-DDTHH:mm:ss"
                                    // Adjust hour for UTC offset if needed, but for display, local time is fine.
                                    // For reliable UTC conversion, you might need a library or more complex logic.
                                    // For now, let's form a date string that new Date() can mostly handle.
                                    const dateObj = new Date(year, month, day, hour, minute, second);
                                    // Add the UTC offset (e.g. for UTC-6, add 6 hours to get to UTC)
                                    // This is if you want to store/display in UTC. If you want the local time, Date object handles it.
                                    // dateObj.setHours(dateObj.getHours() - parseInt(utcOffset)); // If you want to convert to UTC from given local time

                                    formattedUploadDate = dateObj.toLocaleDateString('es-ES', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: true // To show AM/PM
                                    });

                                } else {
                                    // Fallback if the specific regex doesn't match, try direct Date parsing
                                    const dateObj = new Date(uploadDateString);
                                    if (!isNaN(dateObj)) { // Check if date is valid
                                        formattedUploadDate = dateObj.toLocaleDateString('es-ES', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: true // To show AM/PM
                                        });
                                    }
                                }
                            } catch (error) {
                                console.warn("Could not parse upload date string:", uploadDateString, error);
                                formattedUploadDate = 'Fecha no disponible (Error al procesar)';
                            }
                        }


                        let dashboardData = [
                            [{ v: "⭐️ Dashboard de Manifiesto", s: styles.dashTitle }],
                            [{ v: `Archivo: ${manifestoId}`, s: styles.dashSubtitle }],
                            [{ v: `Fecha de Carga: ${formattedUploadDate}`, s: styles.dashDate }], // Added upload date
                            [], // Empty row for spacing
                            [{ v: "📊 MÉTRICAS GENERALES", s: styles.dashHeader }],
                            [{ v: "📥 Total Piezas (SAP):", s: styles.metricLabel }, { v: stats.totalSAP, s: styles.metricValue, z: '#,##0' }],
                            [{ v: "✅ Total Piezas Escaneadas:", s: styles.metricLabel }, { v: stats.totalSCAN, s: styles.metricValue, z: '#,##0' }],
                            [{ v: "⚠️ Diferencia Total:", s: styles.metricLabel }, { v: stats.totalSCAN - stats.totalSAP, s: (stats.totalSCAN - stats.totalSAP < 0 ? styles.metricNegative : styles.metricPositive), z: '#,##0' }],
                            [{ v: "🎯 Progreso General:", s: styles.metricLabel }, { v: stats.avance / 100, s: styles.metricPositive, z: '0.00%' }],
                            [], // Empty row for spacing
                            [{ v: "🚨 PUNTOS CRÍTICOS (FALTANTES)", s: styles.dashHeader }],
                            [{ v: "📦 Contenedores:", s: styles.metricLabel }, { v: "Piezas", s: styles.metricLabel }],
                            ...stats.topContenedoresFaltantes.map(item => [null, { v: `${item[0]}:`, s: { alignment: { horizontal: "right" } } }, { v: item[1], s: styles.metricNegative, t: 'n', z: '#,##0' }]),
                            [], // Empty row for spacing
                            [{ v: "📂 Secciones:", s: styles.metricLabel }, { v: "Piezas", s: styles.metricLabel }],
                            ...stats.topSeccionesFaltantes.map(item => [null, { v: `${item[0]}:`, s: { alignment: { horizontal: "right" } } }, { v: item[1], s: styles.metricNegative, t: 'n', z: '#,##0' }]),
                            [], // Empty row for spacing
                            [{ v: "📈 PUNTOS DE OPORTUNIDAD (EXCEDENTES)", s: styles.dashHeader }],
                            [{ v: "📦 Contenedores:", s: styles.metricLabel }, { v: "Piezas", s: styles.metricLabel }],
                            ...stats.topContenedoresExcedentes.map(item => [null, { v: `${item[0]}:`, s: { alignment: { horizontal: "right" } } }, { v: item[1], s: styles.metricPositive, t: 'n', z: '#,##0' }]),
                            [], // Empty row for spacing
                            [{ v: "📂 Secciones:", s: styles.metricLabel }, { v: "Piezas", s: styles.metricLabel }],
                            ...stats.topSeccionesExcedentes.map(item => [null, { v: `${item[0]}:`, s: { alignment: { horizontal: "right" } } }, { v: item[1], s: styles.metricPositive, t: 'n', z: '#,##0' }]),
                        ];
                        const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
                        wsDash['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }];
                        // Update merges to account for the new date row and shifted content
                        const baseRowShift = 1; // Due to adding one extra line (Fecha de Carga)
                        wsDash['!merges'] = [
                            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
                            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
                            { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // Merge for the date row
                            { s: { r: 3 + baseRowShift, c: 0 }, e: { r: 3 + baseRowShift, c: 2 } }, // Shifted 'MÉTRICAS GENERALES'
                            { s: { r: 9 + baseRowShift, c: 0 }, e: { r: 9 + baseRowShift, c: 2 } }, // Shifted 'PUNTOS CRÍTICOS'
                            { s: { r: 9 + stats.topContenedoresFaltantes.length + 2 + baseRowShift, c: 0 }, e: { r: 9 + stats.topContenedoresFaltantes.length + 2 + baseRowShift, c: 2 } }, // Shifted 'Secciones:' header
                            { s: { r: 9 + stats.topContenedoresFaltantes.length + 2 + stats.topSeccionesFaltantes.length + 2 + baseRowShift, c: 0 }, e: { r: 9 + stats.topContenedoresFaltantes.length + 2 + stats.topSeccionesFaltantes.length + 2 + baseRowShift, c: 2 } } // Shifted 'PUNTOS DE OPORTUNIDAD'
                        ];

                        XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard"); // Add dashboard first

                        // --- Hoja 1: Reporte por Jefatura ---
                        const wsMain = XLSX.utils.json_to_sheet(augmentedData);
                        if (augmentedData.length > 0) {
                            // Asegúrate de que los encabezados se generen correctamente incluyendo 'DIFERENCIA'
                            const headers = Object.keys(augmentedData[0]);
                            XLSX.utils.sheet_add_aoa(wsMain, [headers], { origin: "A1" });

                            const headerKeysMain = headers; // Ya tenemos los encabezados en el orden correcto
                            const headerKeysUpper = headerKeysMain.map(key => key.toUpperCase());

                            const diffColIndex = headerKeysUpper.indexOf('DIFERENCIA'); // Obtener el índice de la columna DIFERENCIA

                            for (let r = 1; r <= augmentedData.length; r++) { // Empezar desde la fila 1 (después del encabezado)
                                // Aplicar formato para números con comas (SAP, SCANNER)
                                numericWithCommaFormatKeys.forEach(colName => {
                                    if (colName === 'DIFERENCIA') return; // Se manejará aparte
                                    const colIndex = headerKeysUpper.indexOf(colName.toUpperCase());
                                    if (colIndex !== -1) {
                                        const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: r });
                                        if (wsMain[cellRef] && wsMain[cellRef].t === 'n') {
                                            wsMain[cellRef].z = '#,##0'; // Formato con separador de miles
                                        }
                                    }
                                });

                                // Aplicar formato para números sin comas (MANIFIESTO, SKU, EUROPEO, ENTREGADO_A, DAÑO_CANTIDAD)
                                numericNoCommaFormatKeys.forEach(colName => {
                                    const colIndex = headerKeysUpper.indexOf(colName.toUpperCase());
                                    if (colIndex !== -1) {
                                        const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: r });
                                        if (wsMain[cellRef] && wsMain[cellRef].t === 'n') { // Asegurarse de que es tipo número
                                            wsMain[cellRef].z = '0'; // Formato entero sin separador de miles
                                        }
                                    }
                                });

                                // Asegurar que las columnas de texto permanezcan como tal y sin formato numérico
                                textFormatKeys.forEach(colName => {
                                    const colIndex = headerKeysUpper.indexOf(colName.toUpperCase());
                                    if (colIndex !== -1) {
                                        const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: r });
                                        if (wsMain[cellRef]) { // Solo si la celda existe (no es null/undefined)
                                            wsMain[cellRef].t = 's'; // Forzar tipo string
                                            delete wsMain[cellRef].z; // Eliminar cualquier formato numérico
                                        }
                                    }
                                });

                                // Lógica de color y texto para la columna DIFERENCIA
                                if (diffColIndex !== -1) {
                                    const cellRef = XLSX.utils.encode_cell({ c: diffColIndex, r: r });
                                    const cell = wsMain[cellRef];

                                    if (cell && cell.t === 'n') { // Si es una celda numérica
                                        const diffValue = cell.v;
                                        if (diffValue === 0) {
                                            cell.s = styles.diffOk;
                                            cell.v = "OK"; // Cambiar valor a "OK"
                                            cell.t = 's'; // Cambiar tipo a string
                                            delete cell.z; // Eliminar formato numérico
                                        } else if (diffValue < 0) {
                                            cell.s = styles.diffNegative;
                                            cell.v = `FALTANTE: ${Math.abs(diffValue)}`; // Cambiar valor a "FALTANTE: X"
                                            cell.t = 's'; // Cambiar tipo a string
                                            delete cell.z; // Eliminar formato numérico
                                        } else { // diffValue > 0
                                            cell.s = styles.diffPositive;
                                            cell.v = `EXCEDENTE: ${diffValue}`; // Cambiar valor a "EXCEDENTE: X"
                                            cell.t = 's'; // Cambiar tipo a string
                                            delete cell.z; // Eliminar formato numérico
                                        }
                                    } else if (cell && (cell.v === null || cell.v === undefined || cell.v === '')) {
                                        // If cell is empty or null, keep it without value and without specific diff style
                                        // applyTableStyles will handle borders and alternating row color
                                        continue;
                                    }
                                }
                            }

                            applyTableStyles(wsMain, styles.mainHeader, styles.dataRowEven, styles.dataRowOdd);
                            wsMain['!autofilter'] = { ref: wsMain['!ref'] };
                        }
                        XLSX.utils.book_append_sheet(wb, wsMain, "Reporte por Jefatura");

                        // --- Análisis por Contenedor y Sección ---
                        const analysisHeadersCont = ["Contenedor", "Jefatura(s)", "Piezas SAP", "Piezas Escaneadas", "Diferencia"];
                        const analysisHeadersSect = ["Sección", "Jefatura", "Piezas SAP", "Piezas Escaneadas", "Diferencia"];
                        const containerAnalysis = {}, sectionAnalysis = {};
                        augmentedData.forEach(row => {
                            const findKey = (obj, key) => Object.keys(obj).find(k => k.toUpperCase() === key.toUpperCase());
                            const cont = row[findKey(row, 'CONTENEDOR')];
                            const sect = row[findKey(row, 'SECCION')] || "N/A";
                            const sap = Number(row[findKey(row, 'SAP')] || 0);
                            const scanner = Number(row[findKey(row, 'SCANNER')] || 0);
                            const jefe = row.JEFATURA;
                            if (!containerAnalysis[cont]) containerAnalysis[cont] = { SAP: 0, SCANNER: 0, Jefes: new Set() };
                            containerAnalysis[cont].SAP += sap;
                            containerAnalysis[cont].SCANNER += scanner;
                            if (jefe !== 'Sin Jefe Asignado') containerAnalysis[cont].Jefes.add(jefe);
                            if (!sectionAnalysis[sect]) sectionAnalysis[sect] = { SAP: 0, SCANNER: 0 };
                            sectionAnalysis[sect].SAP += sap;
                            sectionAnalysis[sect].SCANNER += scanner;
                        });

                        // --- Hoja 2: Análisis por Contenedor ---
                        const wsContData = Object.entries(containerAnalysis).map(([key, val]) => ({ "Contenedor": key, "Jefatura(s)": [...val.Jefes].join(', '), "Piezas SAP": val.SAP, "Piezas Escaneadas": val.SCANNER, "Diferencia": val.SCANNER - val.SAP }));
                        const wsCont = XLSX.utils.json_to_sheet(wsContData, { header: analysisHeadersCont });
                        const numColsCont = analysisHeadersCont.length;
                        for (let r = 1; r <= wsContData.length; r++) {
                            // Formatear columnas numéricas con comas (Piezas SAP, Piezas Escaneadas, Diferencia)
                            const numericColsWithCommas_analysis = [2, 3, 4]; // Columnas Piezas SAP, Escaneadas, Diferencia
                            numericColsWithCommas_analysis.forEach(colIndex => {
                                if (numColsCont > colIndex) {
                                    const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: r });
                                    if (wsCont[cellRef] && wsCont[cellRef].t === 'n') {
                                        wsCont[cellRef].z = '#,##0';
                                    }
                                }
                            });
                            // Asegurar que 'Contenedor' sea texto
                            const contColIndex = analysisHeadersCont.indexOf('Contenedor');
                            if (contColIndex !== -1) {
                                const cellRef = XLSX.utils.encode_cell({ c: contColIndex, r: r });
                                if (wsCont[cellRef]) {
                                    wsCont[cellRef].t = 's'; // Asegurar que sea texto
                                    delete wsCont[cellRef].z; // Eliminar cualquier formato numérico
                                }
                            }
                        }
                        applyTableStyles(wsCont, styles.analysisHeader, styles.dataRowEven, styles.dataRowOdd);
                        wsCont['!autofilter'] = { ref: wsCont['!ref'] };
                        XLSX.utils.book_append_sheet(wb, wsCont, "Análisis por Cont.");

                        // --- Hoja 3: Análisis por Sección ---
                        const wsSectData = Object.entries(sectionAnalysis).map(([key, val]) => ({ "Sección": key, "Jefatura": seccionToJefeMap.get(key.toUpperCase()) || "Sin Jefe Asignado", "Piezas SAP": val.SAP, "Piezas Escaneadas": val.SCANNER, "Diferencia": val.SCANNER - val.SAP }));
                        const wsSect = XLSX.utils.json_to_sheet(wsSectData, { header: analysisHeadersSect });
                        const numColsSect = analysisHeadersSect.length;
                        for (let r = 1; r <= wsSectData.length; r++) {
                            // Formatear columnas numéricas con comas
                            const numericColsWithCommas_analysis = [2, 3, 4]; // Piezas SAP, Piezas Escaneadas, Diferencia
                            numericColsWithCommas_analysis.forEach(colIndex => {
                                if (numColsSect > colIndex) {
                                    const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: r });
                                    if (wsSect[cellRef] && wsSect[cellRef].t === 'n') {
                                        wsSect[cellRef].z = '#,##0';
                                    }
                                }
                            });
                        }
                        applyTableStyles(wsSect, styles.analysisHeader, styles.dataRowEven, styles.dataRowOdd);
                        wsSect['!autofilter'] = { ref: wsSect['!ref'] };
                        XLSX.utils.book_append_sheet(wb, wsSect, "Análisis por Secc.");

                        // --- Descargar el libro ---
                        XLSX.writeFile(wb, `Reporte_Completo_${manifestoId}.xlsx`);
                        Swal.close();

                    } catch (error) {
                        console.error("Error al generar reporte:", error);
                        Swal.fire('Error Inesperado', error.message, 'error');
                    }
                }
                function formatFecha(d) {
                    const dd = String(d.getDate()).padStart(2, "0");
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const yy = d.getFullYear();
                    return `${dd}/${mm}/${yy}`;
                }

                btnCambiarContenedor.addEventListener("click", () => {
                    if (!currentContenedor) {
                        Swal.fire({
                            title: "No hay Contenedor Activo",
                            html: `<div class="no-container-alert">
                                     <i class="material-icons">info_outline</i>
                                     <div>Para cambiar de contenedor, primero debes open uno.</div>
                                   </div>`,
                            icon: 'info',
                            confirmButtonText: "Entendido"
                        });
                        return;
                    }

                    const summaryHTML = getContainerSummaryDetailed(currentContainerRecords);
                    const containerStatus = getContainerStateFromRecords(currentContainerRecords);

                    let statusInfo = {
                        className: 'status-neutral',
                        title: 'Cambio de Contenedor'
                    };
                    if (containerStatus === "INCOMPLETO") {
                        statusInfo = {
                            className: 'status-incompleto',
                            title: 'Contenedor Incompleto'
                        };
                    } else if (containerStatus === "COMPLETO CON MERCANCÍA DE MÁS") {
                        statusInfo = {
                            className: 'status-excedente',
                            title: 'Contenedor con Excedente'
                        };
                    } else if (containerStatus === "COMPLETO") {
                        statusInfo = {
                            className: 'status-completo',
                            title: 'Contenedor Completo'
                        };
                    }

                    Swal.fire({
                        html: `
                            <div class="change-container-modal">
                                <div class="modal-header-status ${statusInfo.className}">
                                    <i class="material-icons">switch_account</i>
                                    <h3>${statusInfo.title}</h3>
                                </div>
                                <div class="modal-body-content">
                                    <div class="container-summary-card">
                                        <h4>
                                            <i class="material-icons">inventory_2</i>
                                            Resumen de: <strong>${currentContenedor}</strong>
                                        </h4>
                                        <div class="summary-content">
                                            ${summaryHTML}
                                        </div>
                                    </div>
                                    <p class="confirmation-prompt">
                                        <i class="material-icons">help_outline</i>
                                        ¿Estás seguro de que deseas cerrar y cambiar de contenedor?
                                    </p>
                                </div>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Sí, cambiar',
                        cancelButtonText: 'Cancelar',
                        width: "600px",
                        padding: 0,
                        showLoaderOnConfirm: true,
                        customClass: {
                            confirmButton: 'btn-confirm-custom',
                            cancelButton: 'btn-cancel-custom'
                        }
                    }).then(async (result) => {
                        if (!result.isConfirmed) return;

                        try {
                            await reuploadFileWithScannerChanges(currentFileName);
                        } catch (e) {
                            console.error("Error al guardar cambios antes de cambiar contenedor:", e);
                        }

                        currentContenedor = null;
                        currentContainerRecords = [];
                        selectedFileToWorkEl.textContent = "";

                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: '¡Listo! Contenedor cerrado.',
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => {
                            containerResultsSection.style.display = 'none';
                            scanEntrySection.style.display = 'none';
                            uploadAndSearchSection.style.display = 'block';
                            inputBusqueda.value = '';
                            inputBusqueda.focus();
                        });
                    });
                });
                btnCerrarContenedor.addEventListener('click', async () => {
                    if (!currentContenedor || !currentFileName) {
                        return Swal.fire('Error', 'No hay un contenedor activo para esta acción.', 'error');
                    }

                    const manifestData = excelDataGlobal[currentFileName];
                    const isCurrentlyClosed = manifestData.closedContainers?.[currentContenedor];
                    const actionText = isCurrentlyClosed ? 'reabrir' : 'cerrar';
                    const modalStatusClass = isCurrentlyClosed ? 'status-reopen' : 'status-close';
                    const modalTitle = isCurrentlyClosed ? 'Reabrir Contenedor' : 'Cerrar Contenedor';

                    const { isConfirmed } = await Swal.fire({
                        html: `
                    <div class="confirmation-modal-content">
                        <div class="modal-header-status ${modalStatusClass}">
                            <i class="material-icons">${isCurrentlyClosed ? 'lock_open' : 'lock'}</i>
                            <h3>${modalTitle}</h3>
                        </div>
                        <div class="summary-card">
                            ${getContainerSummaryDetailed(currentContainerRecords)}
                        </div>
                        <p class="main-text">¿Estás seguro de que deseas <strong>${actionText}</strong> el contenedor <strong>${currentContenedor}</strong>?</p>
                        ${isCurrentlyClosed ? '<p>Al reabrir, podrás seguir escaneando artículos.</p>' : '<p>Una vez cerrado, no podrás registrar más piezas en él hasta que lo reabras.</p>'}
                    </div>`,
                        showCancelButton: true,
                        confirmButtonText: `Sí, ${actionText}`,
                        cancelButtonText: 'Cancelar',
                        width: "600px",
                        padding: 0,
                        customClass: {
                            confirmButton: `btn-confirm-custom ${isCurrentlyClosed ? '' : 'btn-danger'}`,
                            cancelButton: 'btn-cancel-custom'
                        }
                    });

                    if (isConfirmed) {
                        Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                        const newClosedState = !isCurrentlyClosed;

                        try {
                            // Actualiza el estado en Firestore
                            const manifestDocRef = db.collection('manifiestos').doc(currentFileName);
                            await manifestDocRef.update({
                                [`closedContainers.${currentContenedor}`]: newClosedState,
                                lastUser: currentUser.email,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });

                            // Actualiza el estado local
                            manifestData.closedContainers[currentContenedor] = newClosedState;

                            // Actualiza la UI
                            inputScanCode.disabled = newClosedState;
                            btnCerrarContenedor.querySelector('span').textContent = newClosedState ? 'Reabrir' : 'Cerrar';
                            btnCerrarContenedor.querySelector('i.material-icons').textContent = newClosedState ? 'lock_open' : 'lock';

                            // Vuelve a renderizar las tarjetas con el nuevo estado (botones deshabilitados/habilitados)
                            mostrarDetallesContenedor(currentContainerRecords, newClosedState);

                            Swal.fire('¡Éxito!', `El contenedor ha sido ${actionText === 'cerrar' ? 'cerrado' : 'reabierto'}.`, 'success');

                        } catch (error) {
                            console.error("Error al actualizar el estado del contenedor:", error);
                            Swal.fire('Error', 'No se pudo actualizar el estado del contenedor en la base de datos.', 'error');
                        }
                    }
                });
                async function actualizarMetadatosManifiesto(fileName) {
                    if (!excelDataGlobal[fileName]) return;

                    const datos = excelDataGlobal[fileName].data;
                    if (!datos || datos.length === 0) return;

                    let totalSAP = 0;
                    let totalSCAN = 0;

                    datos.forEach(r => {
                        totalSAP += Number(r.SAP) || 0;
                        totalSCAN += Number(r.SCANNER) || 0;
                    });

                    const avance = totalSAP > 0 ? Math.round((totalSCAN / totalSAP) * 100) : (totalSCAN > 0 ? 100 : 0);

                    let estado = "Sin Iniciar";
                    if (avance >= 100) {
                        estado = (totalSCAN > totalSAP) ? "Completo con Excedentes" : "Completo";
                    } else if (avance >= 50) {
                        estado = "Avanzado";
                    } else if (avance > 0) {
                        estado = "En Progreso";
                    } else if (totalSAP > 0 && avance === 0) {
                        estado = "Faltantes Detectados";
                    }

                    const metadata = {
                        progreso: {
                            totalSAP,
                            totalSCAN,
                            avance,
                            estado
                        },
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastUser: currentUser.email || currentUser.uid
                    };

                    await db.collection('manifiestos').doc(fileName).set(metadata, {
                        merge: true
                    });
                }

                let containersMapGlobal = {};
                let skuContainerMapGlobal = {};

                const motivationalPhrases = [
                    "Analizando los datos...",
                    "Buscando coincidencias...",
                    "La eficiencia es clave. ¡Ya casi!",
                    "Revisando cada rincón digital...",
                    "El éxito es la suma de pequeños esfuerzos.",
                    "Un momento, estamos en ello...",
                    "Preparando la información para ti...",
                    "Tu próxima gran jugada está a un segundo."
                ];
                let loadingIntervalId = null;

                function showNotFoundAlert(type) {
                    Swal.fire({
                        html: `
                            <div class="epic-not-found-container animate__animated animate__bounceIn">
                                <div class="epic-icon-wrapper">
                                    <i class="bi bi-search"></i>
                                    <span class="question-mark">?</span>
                                </div>
                                <h2 class="epic-title">¡Búsqueda sin Éxito!</h2>
                                <p class="epic-message">
                                    No hemos encontrado ninguna coincidencia para el <strong>${type}</strong> que buscas en los manifiestos activos.
                                </p>
                                <div class="epic-suggestions">
                                    <h4 class="suggestions-title">¿Qué puedes hacer ahora?</h4>
                                    <ul>
                                        <li><i class="bi bi-spellcheck"></i> <strong>Verifica el código:</strong> Un solo dígito puede hacer la diferencia. ¡Revisa que esté perfecto!</li>
                                        <li><i class="bi bi-cloud-arrow-up-fill"></i> <strong>¿Es un manifiesto nuevo?</strong> Si es así, asegúrate de haberlo cargado primero en la sección de subida.</li>
                                        <li><i class="bi bi-question-circle-fill"></i> <strong>Contacta a soporte:</strong> Si estás seguro de que el código es correcto, podría haber un problema mayor.</li>
                                    </ul>
                                </div>
                            </div>
                            <style>
                                .epic-not-found-container {
                                    font-family: 'Poppins', sans-serif;
                                    padding: 1.5rem;
                                    text-align: center;
                                }
                                .epic-icon-wrapper {
                                    position: relative;
                                    width: 100px;
                                    height: 100px;
                                    margin: 0 auto 1.5rem;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: linear-gradient(145deg, #f8f9fa, #e9ecef);
                                    border-radius: 50%;
                                    border: 4px solid #fff;
                                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                                }
                                .epic-icon-wrapper .bi-search {
                                    font-size: 3.5rem;
                                    color: var(--rosa-principal);
                                    animation: pulse-search 2s infinite ease-in-out;
                                }
                                .epic-icon-wrapper .question-mark {
                                    position: absolute;
                                    top: 0px;
                                    right: 0px;
                                    width: 30px;
                                    height: 30px;
                                    background-color: #dc3545;
                                    color: white;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 1.2rem;
                                    font-weight: 700;
                                    border: 2px solid white;
                                    transform: rotate(10deg);
                                    animation: bounce-qmark 1.5s infinite;
                                }
                                @keyframes pulse-search {
                                    0% { transform: scale(1); }
                                    50% { transform: scale(1.1); }
                                    100% { transform: scale(1); }
                                }
                                @keyframes bounce-qmark {
                                    0%, 20%, 50%, 80%, 100% { transform: translateY(0) rotate(10deg); }
                                    40% { transform: translateY(-10px) rotate(10deg); }
                                    60% { transform: translateY(-5px) rotate(10deg); }
                                }
                                .epic-title {
                                    font-size: 1.8rem;
                                    font-weight: 700;
                                    color: var(--texto-principal);
                                    margin-bottom: 0.5rem;
                                }
                                .epic-message {
                                    font-size: 1rem;
                                    color: #6c757d;
                                    margin-bottom: 2rem;
                                }
                                .epic-suggestions {
                                    text-align: left;
                                    background-color: #f8f9fa;
                                    border-radius: var(--ios-border-radius);
                                    padding: 1.5rem;
                                    border-top: 4px solid var(--rosa-principal);
                                }
                                .suggestions-title {
                                    font-size: 1.1rem;
                                    font-weight: 600;
                                    color: var(--texto-principal);
                                    margin-bottom: 1rem;
                                }
                                .epic-suggestions ul {
                                    list-style: none;
                                    padding: 0;
                                    margin: 0;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 0.75rem;
                                }
                                .epic-suggestions li {
                                    display: flex;
                                    align-items: flex-start;
                                    gap: 0.75rem;
                                    font-size: 0.9rem;
                                    color: #495057;
                                }
                                .epic-suggestions .bi {
                                    font-size: 1.2rem;
                                    color: var(--rosa-principal);
                                    margin-top: 2px;
                                }
                            </style>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: '<i class="bi bi-arrow-repeat"></i> Entendido, reintentar',
                        confirmButtonColor: 'var(--rosa-principal)',
                        customClass: {
                            popup: 'p-0 border-0 shadow-lg',
                            htmlContainer: 'm-0',
                            actions: 'm-0 p-3 border-top',
                            confirmButton: 'btn btn-primary-main'
                        }
                    });
                }

                function createContainerResultCard(containerName, file, isClosed, onclickAction) {
                    return `
                    <div class="result-item-card">
                        <div class="item-info">
                            <div class="item-title">
                                <i class="material-icons text-primary">inventory_2</i>
                                ${containerName}
                                ${isClosed ? `<span class="status-badge is-closed">CERRADO</span>` : ''}
                            </div>
                            <div class="item-meta">
                                <strong>Archivo:</strong> ${file}
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm btn-choose" onclick="${onclickAction}">
                            <i class="material-icons">touch_app</i> Elegir
                        </button>
                    </div>`;
                }

                async function buscarContenedor(ref) {
                    const searchTerm = ref.trim().toUpperCase();
                    if (!searchTerm) return;

                    let candidates = await checkFileForReference(null, searchTerm, true);
                    if (!candidates || candidates.length === 0) return showNotFoundAlert("contenedor");

                    const foundChoices = [];
                    const uniqueCheck = new Set();

                    candidates.forEach(candidate => {
                        const fileName = candidate.fileName;
                        const uniqueContainersInFile = new Set(candidate.matchedRecords.map(r => String(r.CONTENEDOR || "").trim().toUpperCase()));

                        uniqueContainersInFile.forEach(containerName => {
                            if (containerName.includes(searchTerm)) {
                                const choiceKey = `${containerName}|${fileName}`;
                                if (!uniqueCheck.has(choiceKey)) {
                                    const recordsForThisContainer = excelDataGlobal[fileName].data.filter(rec => String(rec.CONTENEDOR || "").trim().toUpperCase() === containerName);
                                    const totalSKUs = recordsForThisContainer.length;
                                    const totalSAP = recordsForThisContainer.reduce((sum, rec) => sum + (Number(rec.SAP) || 0), 0);

                                    foundChoices.push({
                                        containerName,
                                        fileName,
                                        totalSKUs,
                                        totalSAP
                                    });
                                    uniqueCheck.add(choiceKey);
                                }
                            }
                        });
                    });

                    if (foundChoices.length === 0) return showNotFoundAlert("contenedor");

                    if (foundChoices.length === 1) {
                        Swal.close();
                        const choice = foundChoices[0];
                        realOpenFileManifiesto(choice.fileName, choice.containerName);
                        return;
                    }

                    const choiceHTML = foundChoices.map(choice => {
                        const isClosedData = excelDataGlobal[choice.fileName] && excelDataGlobal[choice.fileName].closedContainers && excelDataGlobal[choice.fileName].closedContainers[choice.containerName];
                        let statusHTML = '';
                        if (isClosedData) {
                            statusHTML = `<span class="status-badge is-closed" title="Cerrado por ${isClosedData}">CERRADO</span>`;
                        }

                        return `
                            <div class="result-item-card">
                                <div class="item-info">
                                    <div class="item-title">
                                        <i class="material-icons text-primary">inventory_2</i>
                                        ${choice.containerName} ${statusHTML}
                                    </div>
                                    <div class="item-meta">
                                        <span><strong>Archivo:</strong> ${choice.fileName}</span><br>
                                        <span><strong>SKUs:</strong> ${choice.totalSKUs} | <strong>Piezas SAP:</strong> ${choice.totalSAP}</span>
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-sm btn-choose" onclick="window.openContainerFromFile('${choice.containerName}', '${choice.fileName}')">
                                    <i class="material-icons">touch_app</i> Elegir
                                </button>
                            </div>`;
                    }).join('');

                    Swal.fire({
                        title: "Múltiples Coincidencias de Contenedor",
                        html: `<p>Se encontró "<strong>${searchTerm}</strong>" en varios lugares. Elige el correcto:</p><div class="results-list-container">${choiceHTML}</div>`,
                        showConfirmButton: false,
                        width: "700px",
                    });
                }

                async function buscarSKUenArchivos(sku) {
                    try {
                        let candidates = await checkFileForReference(null, sku, false);
                        if (!candidates || candidates.length === 0) {
                            return showNotFoundAlert("SKU");
                        }

                        const foundChoices = [];
                        const uniqueCheck = new Set();

                        candidates.forEach(candidate => {
                            const fileName = candidate.fileName;
                            candidate.matchedRecords.forEach(record => {
                                const containerName = String(record.CONTENEDOR || "").trim().toUpperCase();
                                if (!containerName) return;

                                const choiceKey = `${containerName}|${fileName}`;
                                if (!uniqueCheck.has(choiceKey)) {
                                    foundChoices.push({
                                        containerName,
                                        fileName,
                                        record
                                    });
                                    uniqueCheck.add(choiceKey);
                                }
                            });
                        });

                        if (foundChoices.length === 0) {
                            return showNotFoundAlert("SKU en algún contenedor válido");
                        }

                        if (foundChoices.length === 1) {
                            Swal.close();
                            const choice = foundChoices[0];
                            realOpenFileManifiesto(choice.fileName, choice.containerName);
                            return;
                        }

                        const choiceHTML = foundChoices.map(choice => {
                            const sap = choice.record.SAP || 0;
                            const desc = choice.record.DESCRIPCION || '(sin descripción)';
                            const isClosed = excelDataGlobal[choice.fileName]?.closedContainers?.[choice.containerName];
                            return `
                                <div class="result-item-card">
                                    <div class="item-info">
                                        <div class="item-title">
                                            <i class="material-icons text-primary">inventory_2</i>
                                            ${choice.containerName}
                                            ${isClosed ? `<span class="status-badge is-closed">CERRADO</span>` : ''}
                                        </div>
                                        <div class="item-meta">
                                            <span><strong>Archivo:</strong> ${choice.fileName}</span><br>
                                            <span><strong>Descripción:</strong> ${desc} | <strong>SAP:</strong> ${sap} pz.</span>
                                        </div>
                                    </div>
                                    <button class="btn btn-primary btn-sm btn-choose"
                                            onclick="window.openContainerFromFile('${choice.containerName}', '${choice.fileName}')">
                                        <i class="material-icons">touch_app</i> Elegir
                                    </button>
                                </div>`;
                        }).join('');

                        Swal.fire({
                            title: "SKU en Múltiples Ubicaciones",
                            html: `<p>Se encontró el SKU <strong>${sku}</strong> en varios lugares. Por favor, elige el correcto:</p>
                                   <div class="results-list-container">${choiceHTML}</div>`,
                            showConfirmButton: false,
                            width: "700px",
                        });

                    } catch (err) {
                        console.error("Error en buscarSKUenArchivos:", err);
                        Swal.fire({
                            icon: "error",
                            title: "Error Inesperado",
                            text: "Ocurrió un problema al buscar el SKU."
                        });
                    }
                }

                window.openContainerFromFile = (containerName, fileName) => {
                    Swal.close();
                    realOpenFileManifiesto(fileName, containerName);
                };

                window.selectContainerV2 = function (cont) {
                    const info = window.containersMapGlobal[cont];
                    if (info) {
                        Swal.close();
                        openContainerDirect({
                            fileName: info.fileName,
                            matchedRecords: info.records
                        }, 0);
                    }
                };

                const handleSearch = (value) => {
                    let val = value.trim().toUpperCase();
                    if (val.length < 5) return;

                    Swal.fire({
                        html: `
                            <div class="epic-loading-container">
                                <div class="radar-scanner">
                                    <div class="radar-icon-wrapper">
                                        <i class="bi bi-binoculars-fill"></i>
                                    </div>
                                </div>
                                <h2 class="epic-loading-title">Iniciando Protocolo de Búsqueda...</h2>
                                <p id="motivational-phrase" class="epic-loading-phrase"></p>
                                <div class="progress-bar-simulation">
                                    <div class="progress-bar-inner"></div>
                                </div>
                            </div>
                            <style>
                                .epic-loading-container {
                                    font-family: 'Poppins', sans-serif;
                                    padding: 2rem 1rem;
                                    text-align: center;
                                    overflow: hidden;
                                }
                                .radar-scanner {
                                    position: relative;
                                    width: 120px;
                                    height: 120px;
                                    margin: 0 auto 1.5rem;
                                    border-radius: 50%;
                                    background: radial-gradient(circle, rgba(230, 0, 126, 0.05) 0%, rgba(230, 0, 126, 0.15) 60%, transparent 70%);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                }
                                .radar-scanner::before, .radar-scanner::after {
                                    content: '';
                                    position: absolute;
                                    top: 50%;
                                    left: 50%;
                                    width: 100%;
                                    height: 100%;
                                    border-radius: 50%;
                                    transform: translate(-50%, -50%);
                                }
                                .radar-scanner::before {
                                    background: conic-gradient(from 0deg, transparent 0%, var(--rosa-principal) 20%, transparent 25%);
                                    animation: radar-sweep 2.5s linear infinite;
                                }
                                .radar-scanner::after {
                                    border: 2px solid rgba(230, 0, 126, 0.2);
                                    width: calc(100% + 10px);
                                    height: calc(100% + 10px);
                                    animation: radar-pulse 2.5s ease-out infinite;
                                }
                                @keyframes radar-sweep {
                                    from { transform: translate(-50%, -50%) rotate(0deg); }
                                    to { transform: translate(-50%, -50%) rotate(360deg); }
                                }
                                @keyframes radar-pulse {
                                    0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                                    50% { opacity: 1; }
                                    100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
                                }
                                .radar-icon-wrapper {
                                    width: 80px;
                                    height: 80px;
                                    border-radius: 50%;
                                    background: var(--blanco);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                                    z-index: 2;
                                    animation: icon-pulse 2s infinite ease-in-out;
                                }
                                .radar-icon-wrapper .bi-binoculars-fill {
                                    font-size: 2.5rem;
                                    color: var(--rosa-principal);
                                }
                                @keyframes icon-pulse {
                                    0% { transform: scale(1); }
                                    50% { transform: scale(1.05); }
                                    100% { transform: scale(1); }
                                }
                                .epic-loading-title {
                                    font-size: 1.5rem;
                                    font-weight: 700;
                                    color: var(--texto-principal);
                                    margin-bottom: 0.5rem;
                                }
                                .epic-loading-phrase {
                                    font-size: 1rem;
                                    color: #6c757d;
                                    height: 24px; /* Prevent layout shift */
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    transition: opacity 0.4s ease-in-out;
                                    opacity: 1;
                                }
                                .epic-loading-phrase.fade-out {
                                    opacity: 0;
                                }
                                .progress-bar-simulation {
                                    width: 80%;
                                    max-width: 300px;
                                    height: 8px;
                                    background-color: #e9ecef;
                                    border-radius: 8px;
                                    margin: 1.5rem auto 0;
                                    overflow: hidden;
                                }
                                .progress-bar-inner {
                                    width: 100%;
                                    height: 100%;
                                    background: linear-gradient(90deg, transparent, var(--rosa-principal), transparent);
                                    background-size: 200% 100%;
                                    animation: progress-sim 2s linear infinite;
                                }
                                @keyframes progress-sim {
                                    0% { background-position: 200% 0; }
                                    100% { background-position: -200% 0; }
                                }
                            </style>
                        `,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        customClass: {
                            popup: 'p-0 border-0 shadow-lg rounded-3'
                        },
                        didOpen: () => {
                            const phraseElement = document.getElementById('motivational-phrase');
                            if (phraseElement) {
                                let phraseIndex = 0;
                                phraseElement.textContent = motivationalPhrases[phraseIndex];

                                loadingIntervalId = setInterval(() => {
                                    phraseElement.classList.add('fade-out');

                                    setTimeout(() => {
                                        phraseIndex = (phraseIndex + 1) % motivationalPhrases.length;
                                        phraseElement.textContent = motivationalPhrases[phraseIndex];
                                        phraseElement.classList.remove('fade-out');
                                    }, 400); // Match transition duration

                                }, 2500); // Change phrase every 2.5 seconds
                            }
                        },
                        willClose: () => {
                            clearInterval(loadingIntervalId);
                        }
                    });

                    if (/^[A-Z]/.test(val) || /^[0-9]+[A-Z]+/.test(val)) {
                        buscarContenedor(val);
                    } else {
                        buscarSKUenArchivos(val);
                    }
                    inputBusqueda.value = "";
                };

                inputBusqueda.addEventListener("keyup", (event) => {
                    if (event.key === 'Enter') {
                        clearTimeout(debounceTimerBusqueda);
                        handleSearch(inputBusqueda.value);
                    } else {
                        clearTimeout(debounceTimerBusqueda);
                        debounceTimerBusqueda = setTimeout(() => {
                            handleSearch(inputBusqueda.value);
                        }, 600);
                    }
                });

                inputBusqueda.addEventListener("paste", (event) => {
                    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
                    setTimeout(() => {
                        handleSearch(pastedText);
                    }, 10);
                });

                window.selectContainer = function (cont) {
                    Swal.close();
                    const info = containersMap[cont];
                    openContainerDirect({
                        fileName: info[0].fileName,
                        matchedRecords: info.map(i => i.record)
                    }, 0);
                };

                window.selectSKUContainerV2 = function (cont) {
                    const info = window.skuContainerMapGlobal[cont];
                    if (info) {
                        Swal.close();
                        openContainerDirect({
                            fileName: info.fileName,
                            matchedRecords: info.records
                        }, 0);
                    }
                };

                async function processSingleFile(fileInfo) {
                    const fileName = fileInfo.ref.name;
                    if (excelDataGlobal[fileName]) {
                        return;
                    }

                    try {
                        const url = await storage.ref(`Manifiestos/${fileInfo.folderName}/${fileName}`).getDownloadURL();
                        const arrBuff = await (await fetch(url)).arrayBuffer();
                        const wb = XLSX.read(arrBuff, {
                            type: "array",
                            cellDates: true
                        });
                        const sheet = wb.SheetNames[0];
                        const dataJson = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);

                        const docSnap = await db.collection("manifiestos").doc(fileName).get();

                        let docData = docSnap.exists ? docSnap.data() : {};

                        excelDataGlobal[fileName] = {
                            data: dataJson,
                            lastUser: docData.lastUser || "",
                            lastUserStore: docData.lastUserStore || "",
                            lastUserRole: docData.lastUserRole || "",
                            closedContainers: docData.closedContainers || {},
                            uploadedAt: docData.updatedAt ? docData.updatedAt.toDate() : null
                        };
                    } catch (error) {
                        console.error(`Error procesando el archivo ${fileName}:`, error);
                    }
                }

                async function checkFileForReference(folderName, code) {
                    if (!allFilesList || allFilesList.length === 0) {
                        allFilesList = [];
                        const storeFolder = currentUserStore === "ALL" ? "" : currentUserStore;

                        if (storeFolder) {
                            const storeFiles = await storage.ref(`Manifiestos/${storeFolder}`).listAll();
                            storeFiles.items.forEach(itemRef => allFilesList.push({
                                folderName: storeFolder,
                                ref: itemRef
                            }));
                        } else {
                            const root = await storage.ref("Manifiestos").listAll();
                            for (const folderRef of root.prefixes) {
                                const storeFiles = await folderRef.listAll();
                                storeFiles.items.forEach(itemRef => allFilesList.push({
                                    folderName: folderRef.name,
                                    ref: itemRef
                                }));
                            }
                        }
                    }
                    const filesToProcess = allFilesList.filter(f => !excelDataGlobal[f.ref.name]);

                    if (filesToProcess.length > 0) {
                        const phraseElement = document.getElementById('motivational-phrase');
                        if (phraseElement) {
                            phraseElement.innerText = `Cargando ${filesToProcess.length} archivo(s) nuevos...`;
                        }
                        await Promise.all(filesToProcess.map(fileInfo => processSingleFile(fileInfo)));
                    }

                    const foundCandidates = [];
                    const searchCode = code.toUpperCase();

                    for (const f of allFilesList) {
                        const fileName = f.ref.name;
                        if (!excelDataGlobal[fileName]) continue;

                        const records = excelDataGlobal[fileName].data;
                        const matched = records.filter(r => {
                            const cont = String(r.CONTENEDOR || "").trim().toUpperCase();
                            const sku = String(r.SKU || "").trim().toUpperCase();
                            return cont.includes(searchCode) || sku.includes(searchCode);
                        });

                        if (matched.length > 0) {
                            foundCandidates.push({
                                folderName: f.folderName,
                                fileName,
                                matchedRecords: matched
                            });
                        }
                    }

                    return foundCandidates.length > 0 ? foundCandidates : null;
                }

                function openContainerDirect(candidate, recordIndex = 0) {
                    currentFileName = candidate.fileName;
                    let cont = String(candidate.matchedRecords[recordIndex]?.CONTENEDOR || "").trim().toUpperCase();
                    realOpenFileManifiesto(currentFileName, cont);
                }

                async function realOpenFileManifiesto(fileName, cont) {
                    Swal.fire({
                        title: 'Cargando y reconstruyendo...',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });
                    try {
                        if (!excelDataGlobal[fileName]?.data) {
                            let store = currentUserStore;
                            if (currentUserStore === 'ALL') {
                                const manifestDoc = await db.collection('manifiestos').doc(fileName).get();
                                store = manifestDoc.data()?.store;
                            }
                            if (!store) throw new Error(`No se pudo determinar la tienda para el archivo ${fileName}`);
                            const url = await storage.ref(`Manifiestos/${store}/${fileName}`).getDownloadURL();
                            const buffer = await (await fetch(url)).arrayBuffer();
                            const wb = XLSX.read(buffer, {
                                type: "array",
                                cellDates: true
                            });
                            excelDataGlobal[fileName] = {
                                data: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
                            };
                        }

                        const dataObj = excelDataGlobal[fileName];
                        const docSnap = await db.collection("manifiestos").doc(fileName).get();
                        dataObj.closedContainers = docSnap.exists ? (docSnap.data().closedContainers || {}) : {};
                        dataObj.lastUser = docSnap.exists ? (docSnap.data().lastUser || "Desconocido") : "Desconocido";

                        dataObj.data.forEach(row => {
                            row.SCANNER = 0;
                        });

                        const scansSnapshot = await db.collection('manifiestos').doc(fileName).collection('scans').where('container', '==', cont).orderBy('scannedAt').get();
                        const newItems = new Map();
                        const deletedSkus = new Set();
                        scansSnapshot.docs.forEach(doc => {
                            if (doc.data().type === 'delete') deletedSkus.add(doc.data().sku);
                        });

                        scansSnapshot.forEach(doc => {
                            const scan = doc.data();
                            if (deletedSkus.has(scan.sku)) return;
                            let record = dataObj.data.find(r => r.SKU === scan.sku && r.CONTENEDOR === scan.container);
                            if (record) {
                                scan.type === 'subtract' ? record.SCANNER-- : record.SCANNER++;
                                record.LAST_SCANNED_BY = scan.user;
                                if (scan.scannedAt) record.FECHA_ESCANEO = scan.scannedAt.toDate();
                            } else if (scan.type === 'add') {
                                if (newItems.has(scan.sku)) {
                                    newItems.get(scan.sku).SCANNER++;
                                } else {
                                    const ref = dataObj.data[0] || {};
                                    newItems.set(scan.sku, {
                                        FECHA: ref.FECHA,
                                        SECCION: ref.SECCION,
                                        MANIFIESTO: ref.MANIFIESTO,
                                        CONTENEDOR: cont,
                                        DESCRIPCION: "ARTÍCULO NUEVO (RECUPERADO)",
                                        SKU: scan.sku,
                                        SAP: 0,
                                        SCANNER: 1,
                                        LAST_SCANNED_BY: scan.user,
                                        FECHA_ESCANEO: scan.scannedAt?.toDate()
                                    });
                                }
                            }
                        });

                        dataObj.data = dataObj.data.filter(r => !deletedSkus.has(r.SKU));
                        newItems.forEach(item => dataObj.data.push(item));

                        currentContenedor = cont;
                        currentFileName = fileName;
                        currentContainerRecords = dataObj.data.filter(r => String(r.CONTENEDOR || "").trim().toUpperCase() === cont);

                        const uploadAndSearchSection = document.getElementById("uploadAndSearchSection");
                        if (uploadAndSearchSection) uploadAndSearchSection.style.display = "none";

                        const containerResultsSection = document.getElementById("containerResultsSection");
                        if (containerResultsSection) containerResultsSection.style.display = "block";

                        const scanEntrySection = document.getElementById("scanEntrySection");
                        if (scanEntrySection) scanEntrySection.style.display = "block";

                        const isClosed = dataObj.closedContainers?.[cont];

                        const selectedFileToWorkEl = document.getElementById("selectedFileToWork");
                        const lastUserUpdateEl = document.getElementById("lastUserUpdate");
                        const btnCerrarContenedor = document.getElementById("btnCerrarContenedor");
                        const inputScanCode = document.getElementById("inputScanCode");
                        const containerHeaderEl = document.getElementById("containerHeader");


                        if (selectedFileToWorkEl) selectedFileToWorkEl.textContent = fileName;
                        if (lastUserUpdateEl) lastUserUpdateEl.textContent = `Último cambio por: ${dataObj.lastUser}`;

                        if (btnCerrarContenedor) {
                            const btnSpan = btnCerrarContenedor.querySelector('span');
                            if (btnSpan) btnSpan.textContent = isClosed ? 'Reabrir' : 'Cerrar';
                            const btnIcon = btnCerrarContenedor.querySelector('i.material-icons');
                            if (btnIcon) btnIcon.textContent = isClosed ? 'lock_open' : 'lock';
                        }

                        if (inputScanCode) inputScanCode.disabled = !!isClosed;

                        if (containerHeaderEl) {
                            const headerSpan = containerHeaderEl.querySelector('span');
                            if (headerSpan) headerSpan.textContent = `Detalles de ${cont}`;
                        }

                        mostrarDetallesContenedor(currentContainerRecords, isClosed); // <-- Pasa la variable isClosed
                        if (inputScanCode) inputScanCode.focus();
                        Swal.close();

                    } catch (error) {
                        console.error("Error openendo manifiesto:", error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error de Carga',
                            text: 'No se pudo cargar la información.'
                        });
                    }
                }

                function showScanSuccessToast(sku, newCount) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: `+1 ${sku} (Total: ${newCount})`,
                        showConfirmButton: false,
                        timer: 1500,
                        customClass: {
                            popup: 'scan-success-toast'
                        }
                    });
                }

                function showScanErrorToast(title, text) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'error',
                        title: title,
                        text: text,
                        showConfirmButton: false,
                        timer: 2500,
                        customClass: {
                            popup: 'scan-error-toast'
                        }
                    });
                }

                function showAddItemConfirmation(code) {
                    return Swal.fire({
                        html: `
                            <div class="modal-header-status status-reopen" style="background-color: #9C27B0;">
                                <i class="material-icons">add_shopping_cart</i>
                                <h3>Artículo No Encontrado</h3>
                            </div>
                            <div class="confirmation-modal-content">
                                <p class="main-text">El artículo <strong>${code}</strong> no existe en este contenedor.</p>
                                <p>¿Deseas añadirlo como un nuevo registro con Cantidad SAP = 0?</p>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Sí, Añadir',
                        cancelButtonText: 'Cancelar',
                        width: "550px",
                        padding: 0,
                        customClass: {
                            confirmButton: 'btn-confirm-custom',
                            cancelButton: 'btn-cancel-custom'
                        }
                    });
                }

                function showMultipleMatchesModal(code, matchingRows) {
                    const html = matchingRows.map((row, idx) => `
                        <div class="result-item-card">
                            <div class="item-info">
                                <div class="item-title">
                                    <i class="material-icons text-primary">sell</i>
                                    ${row.SKU || 'SKU no definido'}
                                </div>
                                <div class="item-meta">
                                    <strong>Descripción:</strong> ${row.DESCRIPCION || '(sin descripción)'}
                                </div>
                            </div>
                            <button class="btn btn-primary btn-sm btn-choose" onclick="window.chooseRow(${idx})">
                                <i class="material-icons">touch_app</i> Seleccionar
                            </button>
                        </div>
                    `).join('');

                    Swal.fire({
                        title: "Múltiples Coincidencias",
                        html: `<p>Se encontraron varios registros para el código <strong>${code}</strong>. Por favor, selecciona el correcto:</p>
                               <div class="results-list-container">${html}</div>`,
                        showConfirmButton: false,
                        width: "650px"
                    });
                }


                async function incrementRowAndNotify(row, code) {
                    row.SCANNER = (Number(row.SCANNER) || 0) + 1;
                    row.FECHA_ESCANEO = new Date();
                    row.LAST_SCANNED_BY = currentUser.email || currentUser.uid;

                    showScanSuccessToast(row.SKU || code, row.SCANNER);

                    mostrarDetallesContenedor(currentContainerRecords);

                    await reuploadFileWithScannerChanges(selectedFileToWorkEl.textContent);
                }

                async function handleScanCode(code) {
                    if (!currentEmployeeNumber) return showScanErrorToast('Falta # de Empleado');
                    if (!currentContenedor) return showScanErrorToast('Sin Contenedor');
                    const fn = currentFileName;
                    const dataObj = excelDataGlobal[fn];
                    if (!dataObj || dataObj.closedContainers?.[currentContenedor]) return showScanErrorToast('Contenedor cerrado');

                    const codeUpper = code.trim().toUpperCase();
                    let targetRow = null;

                    // --- INICIO DE LA LÓGICA CORREGIDA ---

                    // 1. Encontrar TODAS las filas que coincidan con el SKU o código europeo en el contenedor actual.
                    const matchingRows = currentContainerRecords.filter(r =>
                        String(r.SKU || "").toUpperCase() === codeUpper ||
                        String(r.EUROPEO || "").toUpperCase() === codeUpper
                    );

                    if (matchingRows.length > 0) {
                        // 2. Hay coincidencias. Ahora buscamos de forma inteligente.
                        // Prioridad 1: Encontrar una fila que aún no esté completa (SCANNER < SAP).
                        targetRow = matchingRows.find(r => (Number(r.SCANNER) || 0) < (Number(r.SAP) || 0));

                        // Prioridad 2: Si todas las filas coincidentes ya están completas (o en exceso),
                        // asignamos el nuevo escaneo a la primera de ellas para marcarlo como un excedente real.
                        if (!targetRow) {
                            targetRow = matchingRows[0];
                        }

                        // Se encontró una fila (ya sea con faltantes o para registrar un exceso)
                        targetRow.SCANNER = (Number(targetRow.SCANNER) || 0) + 1;

                    } else {
                        // 3. No se encontró ninguna fila. Procedemos a preguntar si se quiere añadir como nuevo artículo.
                        const { isConfirmed } = await showAddItemConfirmation(codeUpper);
                        if (!isConfirmed) {
                            inputScanCode.value = "";
                            inputScanCode.focus();
                            return;
                        }
                        const ref = currentContainerRecords[0] || {};
                        targetRow = {
                            FECHA: ref.FECHA || new Date(),
                            SECCION: ref.SECCION || "N/A",
                            MANIFIESTO: ref.MANIFIESTO || "N/A",
                            CONTENEDOR: currentContenedor,
                            DESCRIPCION: "ARTÍCULO NUEVO",
                            SKU: codeUpper,
                            SAP: 0,
                            SCANNER: 1,
                            ENTREGADO_A: currentEmployeeNumber
                        };
                        dataObj.data.push(targetRow);
                        currentContainerRecords.push(targetRow);
                        Swal.fire('¡Agregado!', `El artículo ${targetRow.SKU} se añadió al contenedor.`, 'success');
                    }

                    // --- FIN DE LA LÓGICA CORREGIDA ---


                    // El resto de la función permanece igual: actualiza los datos y guarda en la base de datos.
                    Object.assign(targetRow, {
                        LAST_SCANNED_BY: currentUser.email,
                        FECHA_ESCANEO: new Date(),
                        ENTREGADO_A: currentEmployeeNumber
                    });

                    mostrarDetallesContenedor(currentContainerRecords);
                    showScanSuccessToast(targetRow.SKU, targetRow.SCANNER);

                    inputScanCode.value = "";
                    inputScanCode.focus();

                    try {
                        await db.collection('manifiestos').doc(fn).collection('scans').add({
                            sku: targetRow.SKU,
                            type: 'add',
                            quantity: 1,
                            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            employee: currentEmployeeNumber,
                            user: currentUser.email,
                            container: currentContenedor
                        });
                        await db.collection('manifiestos').doc(fn).set({
                            lastUser: currentUser.email,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    } catch (error) {
                        console.error("Error guardando escaneo en Firestore:", error);
                        showScanErrorToast('Error de Red', 'El escaneo no se guardó. Reinténtalo.');
                        targetRow.SCANNER -= 1; // Revertir el cambio local si falla la subida
                        mostrarDetallesContenedor(currentContainerRecords);
                    }
                }

                function scanInputHandler() {
                    let val = inputScanCode.value.trim().toUpperCase();
                    if (val && ((val.length >= 5 && val.length <= 10) || (val.length >= 12))) {
                        handleScanCode(val);
                        inputScanCode.value = "";
                    }
                }

                inputScanCode.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        clearTimeout(debounceTimerScan);
                        scanInputHandler();
                    }
                });

                inputScanCode.addEventListener("paste", (e) => {
                    e.preventDefault();
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    inputScanCode.value = pastedText;
                    scanInputHandler();
                });

                inputScanCode.addEventListener("keyup", (e) => {
                    if (e.key !== 'Enter') {
                        clearTimeout(debounceTimerScan);
                        debounceTimerScan = setTimeout(() => {
                            scanInputHandler();
                        }, 800);
                    }
                });

                function incrementRow(rowObj, code) {
                    const now = new Date();

                    rowObj.SCANNER = (rowObj.SCANNER || 0) + 1;
                    rowObj.LAST_SCANNED_BY = currentUser.email || currentUser.uid;
                    rowObj.FECHA_ESCANEO = now;

                    const dataObj = excelDataGlobal[currentFileName];
                    dataObj.lastUser = rowObj.LAST_SCANNED_BY;
                    excelDataGlobal[currentFileName] = dataObj;

                    currentContainerRecords = dataObj.data.filter(x =>
                        String(x.CONTENEDOR || "").trim().toUpperCase() === currentContenedor
                    );
                    
                    // Obtener el estado correcto del contenedor
                    const isContainerClosed = dataObj?.closedContainers?.[currentContenedor] || false;
                    mostrarDetallesContenedor(currentContainerRecords, isContainerClosed);

                    Swal.fire({
                        toast: true,
                        position: "top-end",
                        icon: "success",
                        title: `+1 para ${code}`,
                        showConfirmButton: false,
                        timer: 1500,
                        timerProgressBar: true
                    });
                }

                function mostrarDetallesContenedor(registros, isClosed = false) {
                    if (!registros) {
                        containerDetailsEl.innerHTML = "";
                        return;
                    }
                    registros.sort((a, b) => (a.SAP === 0) - (b.SAP === 0) || String(a.SKU || "").localeCompare(String(b.SKU || "")));

                    const cardsHTML = `<div class="details-list-container">
            ${registros.map(r => {
                        const sku = String(r.SKU || "").toUpperCase();
                        const SAP = Number(r.SAP) || 0;
                        const SCANNER = Number(r.SCANNER) || 0;
                        const esNuevo = SAP === 0;
                        let statusClass = '', diffText = '';

                        if (SCANNER === SAP) { statusClass = 'is-ok'; diffText = 'OK'; }
                        else if (SCANNER < SAP) { statusClass = 'is-missing'; diffText = `FALTA ${SAP - SCANNER}`; }
                        else { statusClass = 'is-excess'; diffText = `SOBRA ${SCANNER - SAP}`; }

                        let cardStatusClass = esNuevo ? 'is-new' : `status-${statusClass.substring(3)}`;

                        const disabledAttr = isClosed ? 'disabled' : '';

                        return `<div class="item-card ${cardStatusClass}" id="row-${sku}">
                    <div class="item-card-main">
                        <div class="sku-container">
                            <i class="bi bi-upc-scan sku-icon"></i>
                            <span class="sku">${sku}</span>
                        </div>
                        <span class="descripcion">${r.DESCRIPCION || "Sin descripción"}</span>
                    </div>
                    <div class="item-card-stats">
                        <div class="stat-item"><div class="label">SAP</div><div class="value">${SAP}</div></div>
                        <div class="stat-item"><div class="label">SCAN</div><div id="scanner-cell-${sku}" class="value">${SCANNER}</div></div>
                        <div class="stat-item"><div class="label">DIF.</div><div id="diff-cell-${sku}"><span class="diff-badge ${statusClass}">${diffText}</span></div></div>
                    </div>
                    <div class="item-card-actions">
                        <button class="btn-action btn-danio" data-sku="${sku}" title="Reportar daño" ${disabledAttr}><i class="bi bi-cone-striped"></i></button>
                        ${r.DANIO_FOTO_URL ? `<button class="btn-action btn-foto" data-url="${r.DANIO_FOTO_URL}" title="Ver foto"><i class="bi bi-image-fill"></i></button>` : ''}
                        ${r.DANIO_FOTO_URL ? `<button class="btn-action btn-eliminar-foto" data-sku="${sku}" data-url="${r.DANIO_FOTO_URL}" title="Eliminar foto de daño" ${disabledAttr}><i class="bi bi-trash2-fill"></i></button>` : ''}
                        <button class="btn-action btn-restar" data-sku="${sku}" title="Restar 1 pieza" ${disabledAttr}><i class="bi bi-dash-circle-fill"></i></button>
                        ${esNuevo ? `<button class="btn-action btn-eliminar" data-sku="${sku}" title="Eliminar artículo añadido" ${disabledAttr}><i class="bi bi-x-octagon-fill"></i></button>` : ''}
                    </div>
                    <div class="item-card-details">
                        <div class="detail-item" title="Sección"><i class="bi bi-folder2-open" style="color: #6f42c1;"></i><span>${r.SECCION || 'N/A'}</span></div>
                        <div class="detail-item" title="Manifiesto"><i class="bi bi-file-earmark-text" style="color: #fd7e14;"></i><span>${r.MANIFIESTO || 'N/A'}</span></div>
                        <div class="detail-item" title="Fecha de Último Escaneo"><i class="bi bi-calendar-check" style="color: #0d6efd;"></i><span>${r.FECHA_ESCANEO ? formatFecha(r.FECHA_ESCANEO) : 'Sin escanear'}</span></div>
                        <div class="detail-item" title="Último escaneo por"><i class="bi bi-person-check-fill" style="color: #198754;"></i><span>${r.LAST_SCANNED_BY || 'N/A'}</span></div>
                        <div class="detail-item" title="Entregado a empleado"><i class="bi bi-person-vcard" style="color: #E6007E;"></i><span>${r.ENTREGADO_A || 'N/A'}</span></div>
                        <div class="detail-item" title="Piezas con condición"><i class="bi bi-tools" style="color: #ffc107;"></i><span>${r.DANIO_CANTIDAD || '0'}</span></div>
                    </div>
                </div>`;
                    }).join('')}
        </div>
        <style>
            .sku-container {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.25rem;
            }
            .sku-icon {
                font-size: 1.5rem;
                color: var(--rosa-principal);
                opacity: 0.7;
            }
            .item-card-main .sku {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--texto-principal);
                letter-spacing: 0.5px;
            }
            .item-card-main .descripcion {
                font-size: 0.9rem;
                color: #6c757d;
                font-style: italic;
            }
            .details-list-container .btn-action i {
                font-size: 1.2rem;
            }
            .details-list-container .btn-action.btn-eliminar-foto { background-color: #6c757d; }
            .details-list-container .btn-action.btn-restar { background-color: #ff7f50; }
            .details-list-container .btn-action.btn-eliminar { background-color: #dc3545; }
            .item-card-details .bi { font-size: 1.1rem; }
        </style>
        `;

                    containerDetailsEl.innerHTML = cardsHTML;

                    if (containerDetailsEl.eventHandler) containerDetailsEl.removeEventListener('click', containerDetailsEl.eventHandler);

                    const eventHandler = async (event) => {
                        const target = event.target.closest('button');
                        if (!target) return;
                        const sku = target.dataset.sku;
                        const fn = currentFileName;

                        if (target.classList.contains('btn-restar')) {
                            const rowObj = currentContainerRecords.find(r => String(r.SKU || "").toUpperCase() === sku);
                            if (!rowObj || (rowObj.SCANNER || 0) <= 0) return;
                            rowObj.SCANNER--;
                            mostrarDetallesContenedor(currentContainerRecords, isClosed);
                            try {
                                await db.collection('manifiestos').doc(fn).collection('scans').add({
                                    sku: rowObj.SKU,
                                    type: 'subtract',
                                    scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                    employee: currentEmployeeNumber,
                                    user: currentUser.email,
                                    container: currentContenedor
                                });
                            } catch (error) {
                                showScanErrorToast('Error de Red', 'No se pudo guardar la resta.');
                                rowObj.SCANNER++;
                                mostrarDetallesContenedor(currentContainerRecords, isClosed);
                            }
                        } else if (target.classList.contains('btn-eliminar')) {
                            const {
                                isConfirmed
                            } = await Swal.fire({
                                title: '¿Estás seguro?',
                                html: `Se eliminará permanentemente el artículo <strong>${sku}</strong>.`,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                confirmButtonText: 'Sí, ¡Eliminar!'
                            });
                            if (isConfirmed) {
                                currentContainerRecords = currentContainerRecords.filter(r => !(String(r.SKU || "").toUpperCase() === sku && r.SAP === 0));
                                mostrarDetallesContenedor(currentContainerRecords, isClosed);

                                try {
                                    await db.collection('manifiestos').doc(fn).collection('scans').add({
                                        sku: sku,
                                        type: 'delete',
                                        scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                        employee: currentEmployeeNumber,
                                        user: currentUser.email,
                                        container: currentContenedor
                                    });
                                    Swal.fire('¡Eliminado!', `El artículo ${sku} ha sido marcado para eliminación.`, 'success');
                                } catch (error) {
                                    showScanErrorToast('Error de Red', 'No se pudo eliminar. Intenta de nuevo.');
                                    realOpenFileManifiesto(fn, currentContenedor);
                                }
                            }
                        } else if (target.classList.contains('btn-danio')) {
                            currentDanioSKU = sku;
                            danioCantidadInput.value = "1";
                            danioFotoInput.value = "";
                            modalDanios.show();
                        } else if (target.classList.contains('btn-foto')) {
                            window.open(target.dataset.url, "_blank");
                        } else if (target.classList.contains('btn-eliminar-foto')) {
                            const photoUrl = target.dataset.url;
                            const { isConfirmed } = await Swal.fire({
                                title: '¿Eliminar Foto?',
                                text: "Esta acción eliminará la foto de la nube permanentemente. No se puede deshacer.",
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#dc3545',
                                confirmButtonText: 'Sí, eliminarla',
                                cancelButtonText: 'Cancelar'
                            });

                            if (isConfirmed) {
                                Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                                try {
                                    const photoRef = storage.refFromURL(photoUrl);
                                    await photoRef.delete();

                                    const rowObj = currentContainerRecords.find(r => String(r.SKU || "").toUpperCase() === sku);
                                    if (rowObj) {
                                        rowObj.DANIO_FOTO_URL = "";
                                        // También se podría registrar esta acción en Firestore si fuera necesario
                                        await db.collection('manifiestos').doc(fn).collection('scans').add({
                                            sku: sku,
                                            type: 'delete_photo',
                                            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                            user: currentUser.email,
                                            container: currentContenedor
                                        });
                                    }

                                    mostrarDetallesContenedor(currentContainerRecords, isClosed);
                                    Swal.fire('¡Eliminada!', 'La foto ha sido eliminada con éxito.', 'success');
                                } catch (error) {
                                    console.error("Error al eliminar la foto:", error);
                                    Swal.fire('Error', 'No se pudo eliminar la foto. Es posible que ya no exista o haya un problema de red.', 'error');
                                }
                            }
                        }
                    };
                    containerDetailsEl.eventHandler = eventHandler;
                    containerDetailsEl.addEventListener('click', containerDetailsEl.eventHandler);
                }
                /***********************************************************
                 * MODAL DE CONDICIONES DE LA MCIA
                 ***********************************************************/
                btnGuardarDanio.addEventListener("click", async () => {
                    let cant = parseInt(danioCantidadInput.value) || 0;
                    if (!cant || cant < 1) {
                        return Swal.fire({
                            icon: "info",
                            title: "Cantidad inválida",
                            html: `<i class="material-icons" style="color:#2196F3;">info</i> Ingrese una cantidad válida.`
                        });
                    }
                    if (!currentDanioSKU) {
                        return Swal.fire({
                            icon: "info",
                            title: "Error interno",
                            html: `<i class="material-icons" style="color:#2196F3;">info</i> No se puede guardar condiciones sin SKU.`
                        });
                    }
                    let fn = currentFileName;
                    let rowObj = currentContainerRecords.find(r => String(r.SKU || "").toUpperCase() === currentDanioSKU);

                    if (!rowObj) {
                        return Swal.fire({ icon: "info", title: "No encontrado", text: "No se encontró el SKU en el contenedor." });
                    }

                    Swal.fire({ title: "Procesando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                    let fotoUrl = rowObj.DANIO_FOTO_URL || "";
                    const file = danioFotoInput.files[0];
                    if (file) {
                        const safeSKU = currentDanioSKU.replace(/[^a-zA-Z0-9]/g, '_');
                        const ts = Date.now();
                        const filePath = `Evidencias/${fn}/${currentContenedor}/${safeSKU}_${ts}.jpg`;
                        const ref = storage.ref(filePath);
                        const snap = await ref.put(file);
                        fotoUrl = await snap.ref.getDownloadURL();
                    }

                    rowObj.DANIO_CANTIDAD = (rowObj.DANIO_CANTIDAD || 0) + cant;
                    rowObj.DANIO_FOTO_URL = fotoUrl;

                    try {
                        await db.collection('manifiestos').doc(fn).collection('scans').add({
                            sku: currentDanioSKU,
                            type: 'damage',
                            quantity: cant,
                            photoURL: fotoUrl,
                            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            user: currentUser.email,
                            container: currentContenedor
                        });

                        // --- INICIO DE LA CORRECCIÓN ---
                        // Obtiene el estado actual del contenedor desde el objeto global.
                        const isContainerClosed = excelDataGlobal[fn]?.closedContainers?.[currentContenedor] || false;
                        // Pasa el estado correcto a la función.
                        mostrarDetallesContenedor(currentContainerRecords, isContainerClosed);
                        // --- FIN DE LA CORRECCIÓN ---

                        Swal.fire({ icon: "success", title: "Condiciones registradas", text: "Se guardó la información." });
                        modalDanios.hide();
                    } catch (e) {
                        console.error(e);
                        rowObj.DANIO_CANTIDAD -= cant; // Revertir si falla
                        Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar la información de condiciones." });
                    }
                });




                function getContainerAnalysis(records, closedContainers) {
                    let groups = {};
                    records.forEach(r => {
                        let c = String(r.CONTENEDOR || "").trim().toUpperCase() || "SIN CONTENEDOR";
                        if (!groups[c]) groups[c] = [];
                        groups[c].push(r);
                    });
                    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px;">`;
                    for (let c in groups) {
                        let closed = closedContainers && closedContainers[c] ? true : false;
                        html += `<div class="analysis-box" style="padding:10px;border-radius:8px;${closed ? "border:2px solid red;background:rgba(255,0,0,0.1);" : "border:1px solid rgba(255,255,255,0.5);background:rgba(0,0,0,0.1);"}">
                                    <h5 style="margin-bottom:8px;">
                                      <i class="material-icons" style="vertical-align:middle; font-size:1.3rem; ${closed ? "color:red;" : ""}">inventory_2</i>
                                      Contenedor: ${c} ${closed ? '<span style="color:red;font-weight:bold;">(CERRADO)</span>' : ''}
                                    </h5>
                                    ${getContainerSummaryDetailed(groups[c])}
                                  </div>`;
                    }
                    html += "</div>";
                    return html;
                }

                function getContainerSummaryDetailed(recs) {
                    let totalRecords = recs.length;
                    let workers = new Set();
                    let sapSum = 0,
                        scannedCorrectlySum = 0,
                        excessSum = 0,
                        missingSum = 0;

                    recs.forEach(r => {
                        const sap = Number(r.SAP) || 0;
                        const scanner = Number(r.SCANNER) || 0;
                        sapSum += sap;

                        if (scanner >= sap) {
                            scannedCorrectlySum += sap;
                            excessSum += (scanner - sap);
                        } else { // scanner < sap
                            scannedCorrectlySum += scanner;
                            missingSum += (sap - scanner);
                        }

                        if (r.LAST_SCANNED_BY) workers.add(r.LAST_SCANNED_BY);
                    });

                    let status = "INCOMPLETO";
                    let statusColor = "#E74C3C"; // Rojo para incompleto
                    let statusIcon = "bi-exclamation-triangle-fill";

                    if (missingSum === 0) {
                        if (excessSum > 0) {
                            status = "COMPLETO CON EXCEDENTES";
                            statusColor = "#F1C40F"; // Amarillo para excedentes
                            statusIcon = "bi-plus-circle-dotted";
                        } else {
                            status = "COMPLETO";
                            statusColor = "#2ECC71"; // Verde para completo
                            statusIcon = "bi-check-circle-fill";
                        }
                    }

                    return `
                        <style>
                            .summary-grid {
                                display: grid;
                                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                                gap: 1rem;
                                padding: 1rem;
                                background-color: #f8f9fa;
                                border-radius: 12px;
                            }
                            .summary-item {
                                display: flex;
                                align-items: center;
                                gap: 0.8rem;
                                background-color: #fff;
                                padding: 1rem;
                                border-radius: 8px;
                                border-left: 5px solid var(--rosa-principal);
                                box-shadow: 0 4px 12px rgba(0,0,0,0.07);
                                transition: transform 0.2s ease-in-out;
                            }
                            .summary-item:hover {
                                transform: translateY(-3px);
                            }
                            .summary-item.full-width {
                                grid-column: 1 / -1;
                            }
                            .summary-item i {
                                font-size: 2rem;
                                color: var(--rosa-principal);
                                opacity: 0.8;
                                flex-shrink: 0;
                            }
                            .summary-item .label {
                                font-size: 0.85rem;
                                color: #6c757d;
                                display: block;
                                font-weight: 500;
                                margin-bottom: 0.1rem;
                            }
                            .summary-item .value {
                                font-size: 1.4rem;
                                font-weight: 700;
                                color: var(--texto-principal);
                                line-height: 1.2;
                            }
                            .summary-item .value-badge {
                                font-size: 1rem;
                                font-weight: 600;
                                color: #fff;
                                padding: 0.4rem 1rem;
                                border-radius: 50px;
                                display: inline-block;
                            }
                            .status-item {
                                grid-column: 1 / -1;
                                justify-content: center;
                                border-color: ${statusColor};
                            }
                            .status-item i {
                                color: ${statusColor};
                                font-size: 2.2rem;
                            }
                        </style>
                        <div class="summary-grid">
                            <div class="summary-item status-item">
                                <i class="bi ${statusIcon}"></i>
                                <div>
                                    <span class="label">Estado del Contenedor</span>
                                    <span class="value-badge" style="background-color: ${statusColor};">${status}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="bi bi-tags-fill"></i>
                                <div>
                                    <span class="label">Total SKUs</span>
                                    <span class="value">${totalRecords.toLocaleString('es-MX')}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="bi bi-box-seam"></i>
                                <div>
                                    <span class="label">Piezas Esperadas</span>
                                    <span class="value">${sapSum.toLocaleString('es-MX')}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="bi bi-check-all"></i>
                                <div>
                                    <span class="label">Escaneado Correcto</span>
                                    <span class="value" style="color: #2ECC71;">${scannedCorrectlySum.toLocaleString('es-MX')}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="bi bi-exclamation-triangle"></i>
                                <div>
                                    <span class="label">Piezas Faltantes</span>
                                    <span class="value" style="color: #E74C3C;">${missingSum.toLocaleString('es-MX')}</span>
                                </div>
                            </div>
                             <div class="summary-item">
                                <i class="bi bi-plus-circle-dotted"></i>
                                <div>
                                    <span class="label">Piezas Excedentes</span>
                                    <span class="value" style="color: #F1C40F;">${excessSum.toLocaleString('es-MX')}</span>
                                </div>
                            </div>
                            <div class="summary-item full-width">
                                <i class="bi bi-people-fill"></i>
                                <div>
                                    <span class="label">Trabajado por</span>
                                    <span class="value" style="font-size: 1rem;">${Array.from(workers).join(", ") || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }

                function getContainerStateFromRecords(records) {
                    let totalMissing = 0,
                        totalExtra = 0,
                        completeCount = 0;
                    let totalRecords = records.length;
                    records.forEach(r => {
                        let sap = Number(r.SAP) || 0;
                        let sc = Number(r.SCANNER) || 0;
                        if (sc >= sap) {
                            completeCount++;
                            if (sc > sap) totalExtra += (sc - sap);
                        } else {
                            totalMissing += (sap - sc);
                        }
                    });
                    if (totalMissing === 0 && totalExtra > 0) {
                        return "COMPLETO CON MERCANCÍA DE MÁS";
                    } else if (completeCount === totalRecords && totalExtra === 0) {
                        return "COMPLETO";
                    }
                    return "INCOMPLETO";
                }

                function formatFecha(fecha) {
                    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
                        const dia = fecha.getDate().toString().padStart(2, "0");
                        const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
                        const anio = fecha.getFullYear();
                        return `${dia}/${mes}/${anio}`;
                    }
                    if (typeof fecha === "string") {
                        let d = new Date(fecha);
                        if (!isNaN(d.getTime())) {
                            let c = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                            let dd = c.getDate().toString().padStart(2, "0");
                            let mm = (c.getMonth() + 1).toString().padStart(2, "0");
                            let yy = c.getFullYear();
                            return `${dd}/${mm}/${yy}`;
                        }
                        return fecha;
                    }
                    if (typeof fecha === "number") {
                        let d = new Date(Math.round((fecha - 25569) * 86400 * 1000));
                        let c = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                        let dd = c.getDate().toString().padStart(2, "0");
                        let mm = (c.getMonth() + 1).toString().padStart(2, "0");
                        let yy = c.getFullYear();
                        return `${dd}/${mm}/${yy}`;
                    }
                    return "";
                }

                async function reuploadFileWithScannerChanges(fileName) {
                    let dataObj = excelDataGlobal[fileName];
                    let arr = dataObj.data;
                    let ws = XLSX.utils.json_to_sheet(arr);
                    let wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
                    let wbout = XLSX.write(wb, {
                        bookType: "xlsx",
                        type: "array"
                    });
                    let blob = new Blob([wbout], {
                        type: "application/octet-stream"
                    });

                    // ***** INICIO DE LA CORRECCIÓN IMPORTANTE *****
                    // Paso 1: Obtener la tienda original del manifiesto desde Firestore
                    const manifestDocRef = db.collection('manifiestos').doc(fileName);
                    const manifestDocSnap = await manifestDocRef.get();

                    let originalManifestStore = '0042'; // Valor por defecto seguro

                    if (manifestDocSnap.exists && manifestDocSnap.data().store) {
                        originalManifestStore = manifestDocSnap.data().store;
                    }

                    // Paso 2: Usar la tienda original del manifiesto para la ruta de Storage
                    let storageRef = storage.ref(`Manifiestos/${originalManifestStore}/${fileName}`);
                    // ***** FIN DE LA CORRECCIÓN IMPORTANTE *****

                    await storageRef.put(blob); // Sube el archivo a la carpeta correcta

                    // También asegúrate de que el documento en Firestore se actualice con la tienda correcta
                    // (la original), no con "ALL" si es un admin.
                    await db.collection('manifiestos')
                        .doc(fileName)
                        .set({
                            fileName,
                            store: originalManifestStore, // <--- Importante: Guarda la tienda original del manifiesto aquí también
                            lastUser: dataObj.lastUser,
                            lastUserStore: (dataObj.lastUserStore !== undefined) ? dataObj.lastUserStore : null,
                            lastUserRole: (dataObj.lastUserRole !== undefined) ? dataObj.lastUserRole : null,
                            closedContainers: dataObj.closedContainers || {},
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, {
                            merge: true
                        });
                }
            });
        })();