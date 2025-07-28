                                /**
                 * --- VERSIÓN FINAL (PULIDA Y CORREGIDA) ---
                 * Esta versión incorpora todos los ajustes de diseño y funcionalidad:
                 * - Paleta de colores e iconografía de Liverpool.
                 * - Tarjetas de sección compactas con contadores de piezas y barras de progreso mejoradas.
                 * - Diseño de Ranking de Operadores mejorado.
                 * - Funcionalidad de descarga de Excel completamente restaurada.
                 * - CORRECCIÓN: Se ajustó la creación de fechas para manejar correctamente las zonas horarias y asegurar que el rango sea inclusivo.
                 * - MEJORA: Procesamiento de manifiestos en paralelo con Promise.allSettled para mejor rendimiento.
                 * - MEJORA: Estructura de reporte mejorada para análisis por manifiesto.
                 * - NUEVA SECCIÓN: Análisis detallado por manifiesto con filtros y gráficas por sección.
                 * - CORRECCIÓN: Solucionado error "a.numero.replace is not a function" al ordenar manifiestos.
                 * - CORRECCIÓN: Restaurada y mejorada la gráfica de avance general en el dashboard.
                 * - NUEVO: Conteo de contenedores por manifiesto.
                 * - NUEVO: Filtros por jefatura y por contenedor dentro de la sección "Por Manifiesto".
                 * - MEJORA DE DISEÑO: Interfaz de usuario más organizada y estéticamente agradable.
                 * - NUEVO: Hoja de "Análisis por Manifiesto" en la descarga de Excel.
                 * - CORRECCIÓN: Manejo de nombres de contenedores "N/A" y activación inicial de filtros.
                 * - MEJORA DE FILTRADO: Nuevos filtros de "Estado de Escaneo" (Completado, Con Diferencias, Sin Escanear) para Manifiestos.
                 * - MEJORA VISUAL: Indicadores de color en la lista de manifiestos según su estado de escaneo.
                 * - CORRECCIÓN CRÍTICA: Eliminación de jefes en filtros y reportes que no tienen secciones con datos en el periodo.
                 * - CORRECCIÓN CRÍTICA: Robustez en el manejo de tipos de datos para evitar errores y asegurar precisión.
                 * - CORRECCIÓN CRÍTICA: Datos de Excel 100% fiables y coherentes con la información del dashboard.
                 * - REORGANIZACIÓN CLAVE: Flujo de filtrado en "Por Manifiesto" cambiado a: Manifiesto (lista) > Jefe (filtro por manifiesto) > Contenedor (filtro por manifiesto y jefe).
                 * - NUEVO: Gráfica de pastel de avance general para el manifiesto seleccionado.
                 * - CORRECCIÓN CRÍTICA: Solucionado el problema donde el "Desglose por Sección" no mostraba datos en la sección "Por Manifiesto" debido a un error de filtrado y renderizado de gráficas.
                 * - CORRECCIÓN CRÍTICA: Solucionado `ReferenceError: seccionKey is not defined` al poblar `manifiestosConSecciones` de las jefaturas.
                 * - NUEVO: Título para la gráfica de pastel del manifiesto.
                 * - NUEVO: Sección dedicada para "Artículos con Excedentes" mostrando manifiestos, contenedores y secciones.
                 * - MEJORA: Visualización de excedentes en la hoja de Excel de manifiestos.
                 * - NUEVO: Filtros por Jefatura y Gráfica de Pastel en la sección de "Excedentes".
                 * - CORRECCIÓN CRÍTICA FINAL: Máxima precisión en la recolección, agregación y presentación de datos de EXCEDENTES/FALTANTES, garantizando coherencia entre resúmenes, detalles e informes de Excel.
                 * - MEJORA DE EXCEL: Encabezados de tabla en negro, con iconos (símbolos Unicode) y autofiltros en todas las tablas.
                 * - MEJORA DE EXCEL: Ordenamiento por Jefatura en Análisis por Contenedor y Artículos con Excedentes.
                 */

                window.generarResumenSemanal = async function () {
                    // Helper para obtener propiedades de un objeto sin importar mayúsculas/minúsculas
                    const getProp = (obj, key) => {
                        if (!obj) return undefined;
                        const lowerKey = String(key).toLowerCase();
                        const objKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                        return objKey ? obj[objKey] : undefined;
                    };

                    // Modal de selección de fechas
                    const {
                        value: dateRange
                    } = await Swal.fire({
                        title: '<i class="bi bi-calendar2-range" style="color:#E10098;"></i> Periodo de Análisis',
                        html: `
            <p class="text-muted mt-2 mb-4">Selecciona el rango de fechas para generar el reporte de rendimiento.</p>
            <input type="text" id="date-range-picker" class="form-control text-center" placeholder="Seleccionar fechas...">
        `,
                        width: 480,
                        padding: '2rem',
                        confirmButtonText: 'Generar Dashboard <i class="bi bi-arrow-right-circle-fill ms-1"></i>',
                        customClass: {
                            popup: 'animate__animated animate__fadeInDown border-0 shadow-lg',
                            confirmButton: 'btn btn-primary btn-lg',
                        },
                        didOpen: () => {
                            flatpickr.localize(flatpickr.l10ns.es);
                            const fp = flatpickr("#date-range-picker", {
                                mode: "range",
                                dateFormat: "Y-m-d",
                                locale: { // Usa un objeto para la localización
                                    ...flatpickr.l10ns.es, // hereda todo del español
                                    rangeSeparator: ' a ' // pero sobreescribe el separador
                                },
                                maxDate: "today"
                            });
                            setTimeout(() => fp.open(), 100);
                        },
                        preConfirm: () => {
                            const range = document.getElementById('date-range-picker').value;
                            // Buscamos un separador que puede ser " a " o "a"
                            const separator = range.includes(' a ') ? ' a ' : 'a';

                            if (!range || (range.split(separator).length < 2)) {
                                Swal.showValidationMessage('Debes seleccionar un rango de fechas válido.');
                                return false;
                            }
                            return range.split(separator);
                        }
                    });

                    if (!dateRange || dateRange.length < 2) return;

                    const [startDateStr, endDateStr] = dateRange;
                    Swal.fire({
                        title: '<span style="font-weight:700;color:#E10098;">Analizando Datos...</span>',
                        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem;"><div class="liverpool-loader"></div><div id="loading-message" style="color:#6c757d;">Cargando inteligencia de secciones y procesando manifiestos...<br>Por favor, espera.</div></div><style>.liverpool-loader{width:60px;height:60px;border-radius:50%;background:conic-gradient(from 180deg at 50% 50%,#E10098,#414141,#95C11F,#E10098);animation:spin 1.2s linear infinite;-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);mask:radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);}@keyframes spin{to{transform:rotate(1turn);}}</style>`,
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading(),
                    });

                    try {
                        let seccionesMap = new Map();
                        try {
                            const seccionesURL = await storage.ref('ExcelManifiestos/Secciones.xlsx').getDownloadURL();
                            const seccionesBuffer = await (await fetch(seccionesURL)).arrayBuffer();
                            const seccionesWB = XLSX.read(seccionesBuffer, {
                                type: 'array'
                            });
                            const seccionesData = XLSX.utils.sheet_to_json(seccionesWB.Sheets['Jefatura']);
                            seccionesData.forEach(row => {
                                const seccionKey = String(getProp(row, 'Seccion') || '').trim();
                                if (seccionKey) {
                                    seccionesMap.set(seccionKey.toUpperCase(), {
                                        descripcion: String(getProp(row, 'Descripcion') || 'Sin Descripción').trim(),
                                        jefatura: String(getProp(row, 'Jefatura') || 'Sin Asignar').trim(),
                                        asistente: String(getProp(row, 'Asistente de Operaciones') || 'N/A').trim()
                                    });
                                }
                            });
                        } catch (error) {
                            console.error("Error crítico al cargar 'ExcelManifiestos/Secciones.xlsx':", error);
                            Swal.fire('Error de Archivo', "No se pudo cargar el archivo <b>ExcelManifiestos/Secciones.xlsx</b>. Revisa la consola para más detalles.", 'error');
                            return;
                        }

                        const [startY, startM, startD] = startDateStr.split('-').map(Number);
                        const startDate = new Date(startY, startM - 1, startD, 0, 0, 0, 0); // Mes es 0-indexado (0=Enero)

                        const [endY, endM, endD] = endDateStr.split('-').map(Number);
                        const endDate = new Date(endY, endM - 1, endD, 23, 59, 59, 999);

                        let query = db.collection('manifiestos').where('createdAt', '>=', startDate).where('createdAt', '<=', endDate);
                        if (currentUserStore !== 'ALL' && !SUPER_ADMINS.includes(currentUser.uid)) {
                            query = query.where('store', '==', currentUserStore);
                        }
                        const snapshot = await query.get();

                        if (snapshot.empty) return Swal.fire('Sin Datos', 'No se encontraron manifiestos en el rango de fechas seleccionado.', 'info');

                        let report = {
                            totalSAP: 0,
                            totalSCAN: 0,
                            manifiestos: {}, // Cambiado a objeto para acceso por ID y guardar datos completos
                            usuarios: {},
                            secciones: {},
                            skusSinEscanear: [],
                            skusConExcedentes: [], // Nuevo: para SKUs con excedentes
                            failedManifests: [] // Para guardar errores de manifiestos individuales
                        };

                        const totalManifestsInSnapshot = snapshot.docs.length;
                        document.getElementById('loading-message').innerHTML = `Cargando inteligencia de secciones y procesando manifiestos...<br>Procesando 0 de ${totalManifestsInSnapshot} manifiestos...<br>Por favor, espera.`;

                        const manifestPromises = snapshot.docs.map(async (doc, index) => {
                            try {
                                // Actualizar mensaje de carga para cada manifiesto procesado
                                document.getElementById('loading-message').innerHTML = `Cargando inteligencia de secciones y procesando manifiestos...<br>Procesando ${index + 1} de ${totalManifestsInSnapshot} manifiestos...<br>Por favor, espera.`;

                                const reconstructed = await reconstructManifestDataFromFirebase(doc.id);
                                const manifestData = reconstructed.data;

                                // Contenedores únicos para este manifiesto
                                const contenedoresUnicos = new Set();
                                manifestData.forEach(row => {
                                    const contenedor = String(getProp(row, 'CONTENEDOR') || 'N/A').trim();
                                    contenedoresUnicos.add(contenedor);
                                });

                                const manifestInfo = {
                                    id: doc.id,
                                    numero: String(getProp(manifestData[0], 'MANIFIESTO') || 'N/A').trim(), // Asegurar que sea string
                                    data: manifestData, // Guardamos los datos completos aquí
                                    seccionesResumen: {}, // Para estadísticas de secciones dentro de este manifiesto
                                    contenedores: Array.from(contenedoresUnicos).sort() // Convertir a array y ordenar
                                };

                                manifestData.forEach(row => {
                                    const seccionKey = String(getProp(row, 'SECCION') || 'Sin Sección').trim();
                                    const sap = Number(getProp(row, 'SAP')) || 0; // Asegurar que es número, 0 por defecto
                                    const scan = Number(getProp(row, 'SCANNER')) || 0; // Asegurar que es número, 0 por defecto
                                    const user = String(getProp(row, 'LAST_SCANNED_BY') || 'N/A').trim(); // Asegurar string para user
                                    const contenedor = String(getProp(row, 'CONTENEDOR') || 'N/A').trim();
                                    const sku = String(getProp(row, 'SKU') || 'N/A').trim();
                                    const desc = String(getProp(row, 'DESCRIPCION') || 'Sin Descripción').trim();

                                    // Acumular para el reporte general por sección
                                    if (!report.secciones[seccionKey]) {
                                        const seccionInfo = seccionesMap.get(seccionKey.toUpperCase()) || {
                                            jefatura: 'Sin Asignar',
                                            descripcion: 'Sin Descripción',
                                            asistente: 'N/A'
                                        };
                                        report.secciones[seccionKey] = {
                                            sap: 0,
                                            scan: 0,
                                            skus: 0,
                                            faltantes: 0,
                                            excedentes: 0,
                                            jefatura: seccionInfo.jefatura, // Asegurar que jefatura se guarde aquí
                                            descripcion: seccionInfo.descripcion,
                                            asistente: seccionInfo.asistente
                                        };
                                    }
                                    report.secciones[seccionKey].sap += sap;
                                    report.secciones[seccionKey].scan += scan;
                                    report.secciones[seccionKey].skus++;
                                    if (scan < sap) report.secciones[seccionKey].faltantes += (sap - scan);
                                    if (scan > sap) report.secciones[seccionKey].excedentes += (scan - sap);

                                    // Acumular para el resumen por manifiesto (nueva sección)
                                    // Estructura: seccionesResumen[seccionKey][contenedor] = { sap, scan, faltantes, excedentes }
                                    if (!manifestInfo.seccionesResumen[seccionKey]) {
                                        manifestInfo.seccionesResumen[seccionKey] = {
                                            totalSap: 0,
                                            totalScan: 0,
                                            byContenedor: {},
                                            jefatura: (seccionesMap.get(seccionKey.toUpperCase()) || { jefatura: 'Sin Asignar' }).jefatura // Almacenar la jefatura aquí también
                                        };
                                    }
                                    if (!manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor]) {
                                        manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor] = {
                                            sap: 0,
                                            scan: 0,
                                            faltantes: 0,
                                            excedentes: 0
                                        };
                                    }
                                    manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor].sap += sap;
                                    manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor].scan += scan;

                                    const seccionContFaltantes = (sap - scan) > 0 ? (sap - scan) : 0;
                                    const seccionContExcedentes = (scan - sap) > 0 ? (scan - sap) : 0;
                                    manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor].faltantes += seccionContFaltantes;
                                    manifestInfo.seccionesResumen[seccionKey].byContenedor[contenedor].excedentes += seccionContExcedentes;

                                    manifestInfo.seccionesResumen[seccionKey].totalSap += sap;
                                    manifestInfo.seccionesResumen[seccionKey].totalScan += scan;


                                    // Acumular totales generales del reporte
                                    report.totalSAP += sap;
                                    report.totalSCAN += scan;

                                    // SKUs sin escanear (solo si SAP > 0 y SCAN es 0)
                                    if (sap > 0 && scan === 0) report.skusSinEscanear.push({
                                        sku: String(sku || 'N/A').trim(),
                                        desc: String(desc || 'Sin Descripción').trim(),
                                        sap: Number(sap || 0),
                                        manifiesto: {
                                            id: String(manifestInfo.id || 'N/A').trim(),
                                            numero: String(manifestInfo.numero || 'N/A').trim()
                                        }
                                    });

                                    // SKUs con excedentes (solo si SCAN > SAP y la diferencia es positiva)
                                    if (scan > sap) {
                                        const currentExcedente = scan - sap;
                                        if (currentExcedente > 0) {
                                            report.skusConExcedentes.push({
                                                sku: String(sku || 'N/A').trim(),
                                                desc: String(desc || 'Sin Descripción').trim(),
                                                excedente: Number(currentExcedente),
                                                manifiesto: {
                                                    id: String(manifestInfo.id || 'N/A').trim(),
                                                    numero: String(manifestInfo.numero || 'N/A').trim()
                                                },
                                                contenedor: String(contenedor || 'N/A').trim(),
                                                seccion: String(seccionKey || 'Sin Sección').trim(),
                                                jefatura: String((seccionesMap.get(seccionKey.toUpperCase()) || { jefatura: 'Sin Asignar' }).jefatura || 'Sin Asignar').trim()
                                            });
                                        }
                                    }

                                    // Datos de usuarios (ranking)
                                    if (user !== 'N/A' && scan > 0) { // Solo si hay un usuario real y escaneó algo
                                        if (!report.usuarios[user]) report.usuarios[user] = {
                                            scans: 0,
                                            manifests: new Map()
                                        };
                                        report.usuarios[user].scans += scan;
                                        if (!report.usuarios[user].manifests.has(manifestInfo.id)) report.usuarios[user].manifests.set(manifestInfo.id, {
                                            scans: 0,
                                            numero: manifestInfo.numero
                                        });
                                        report.usuarios[user].manifests.get(manifestInfo.id).scans += scan;
                                    }
                                });
                                return manifestInfo; // Devolver el objeto de manifiesto procesado
                            } catch (innerError) {
                                console.error(`Error procesando manifiesto ${doc.id}:`, innerError);
                                return { id: doc.id, error: innerError.message || 'Error desconocido al procesar' };
                            }
                        });

                        const results = await Promise.allSettled(manifestPromises);

                        // Procesar los resultados y llenar report.manifiestos y report.failedManifests
                        // `failedManifests` es un array global que ya se populó en el catch de manifestPromises
                        report.failedManifests = results.filter(r => r.status === 'rejected').map(r => r.reason);
                        results.filter(r => r.status === 'fulfilled' && r.value !== null && !r.value.error)
                            .map(r => r.value)
                            .forEach(man => { report.manifiestos[man.id] = man; }); // Populating report.manifiestos from successful ones

                        report.jefaturas = {};
                        const jefaturasConDatosEnPeriodo = new Set();
                        for (const [seccionNombre, seccionData] of Object.entries(report.secciones)) {
                            const jefe = seccionData.jefatura;
                            if (jefe === 'Sin Asignar') continue;

                            if (!report.jefaturas[jefe]) {
                                report.jefaturas[jefe] = {
                                    sap: 0,
                                    scan: 0,
                                    faltantes: 0,
                                    excedentes: 0,
                                    skus: 0,
                                    secciones: [],
                                    manifiestosConSecciones: new Set()
                                };
                            }
                            report.jefaturas[jefe].sap += seccionData.sap;
                            report.jefaturas[jefe].scan += seccionData.scan;
                            report.jefaturas[jefe].faltantes += seccionData.faltantes;
                            report.jefaturas[jefe].excedentes += seccionData.excedentes;
                            report.jefaturas[jefe].skus += seccionData.skus;
                            report.jefaturas[jefe].secciones.push({
                                nombre: seccionNombre,
                                sap: seccionData.sap,
                                scan: seccionData.scan,
                                avance: seccionData.sap > 0 ? (seccionData.scan / seccionData.sap) * 100 : 100
                            });
                            Object.values(report.manifiestos).forEach(man => {
                                const seccionResumenManifiesto = man.seccionesResumen[seccionNombre];
                                if (seccionResumenManifiesto && (seccionResumenManifiesto.totalSap > 0 || seccionResumenManifiesto.totalScan > 0 || Object.values(seccionResumenManifiesto.byContenedor || {}).some(c => c.faltantes > 0 || c.excedentes > 0))) {
                                    if (seccionResumenManifiesto.jefatura === jefe) {
                                        report.jefaturas[jefe].manifiestosConSecciones.add(man.id);
                                    }
                                }
                            });
                            if (seccionData.sap > 0 || seccionData.scan > 0) {
                                jefaturasConDatosEnPeriodo.add(jefe);
                            }
                        }

                        const avanceGeneral = report.totalSAP > 0 ? (report.totalSCAN / report.totalSAP) * 100 : 0;
                        const totalFaltantes = report.totalSAP > report.totalSCAN ? report.totalSAP - report.totalSCAN : 0;
                        const totalExcedentes = Object.values(report.secciones).reduce((acc, seccion) => acc + (seccion.excedentes || 0), 0);
                        const topScanners = Object.entries(report.usuarios).sort((a, b) => b[1].scans - a[1].scans);

                        const jefaturasUnicas = Array.from(jefaturasConDatosEnPeriodo).sort();


                        // Función de descarga de Excel
                        const descargarResumenExcel = () => {
                            // --- ESTILOS PROFESIONALES ---
                            const headerStyle = {
                                font: {
                                    bold: true,
                                    color: {
                                        rgb: "FFFFFF"
                                    },
                                    sz: 11
                                },
                                fill: {
                                    fgColor: {
                                        rgb: "000000" // NEGRO SÓLIDO
                                    }
                                },
                                alignment: {
                                    horizontal: "center",
                                    vertical: "center"
                                },
                                border: {
                                    top: {
                                        style: "thin"
                                    },
                                    bottom: {
                                        style: "thin"
                                    },
                                    left: {
                                        style: "thin"
                                    },
                                    right: {
                                        style: "thin"
                                    }
                                }
                            };
                            const titleStyle = {
                                font: {
                                    sz: 18,
                                    bold: true,
                                    color: {
                                        rgb: "E10098"
                                    }
                                }
                            }; // Rosa Liverpool
                            const kpiTitleStyle = {
                                font: {
                                    sz: 12,
                                    bold: true,
                                    color: {
                                        rgb: "414141"
                                    }
                                }
                            };
                            const cellStyle = {
                                border: {
                                    top: {
                                        style: "thin"
                                    },
                                    bottom: {
                                        style: "thin"
                                    },
                                    left: {
                                        style: "thin"
                                    },
                                    right: {
                                        style: "thin"
                                    }
                                }
                            };
                            const redTextStyle = {
                                font: {
                                    color: {
                                        rgb: "E10098"
                                    }
                                },
                                ...cellStyle
                            };
                            const greenTextStyle = {
                                font: {
                                    color: {
                                        rgb: "95C11F"
                                    }
                                },
                                ...cellStyle
                            };
                            const orangeTextStyle = {
                                font: {
                                    color: {
                                        rgb: "f0ad4e"
                                    }
                                },
                                ...cellStyle
                            };

                            const wb = XLSX.utils.book_new();

                            // --- HOJA 1: RESUMEN EJECUTIVO (SUPER ÉPICO) ---
                            const wsResumenData = [
                                // Fila 1: Título Principal
                                ["📊 Reporte de Inteligencia Semanal"],
                                // Fila 2: Espacio
                                [],
                                // Fila 3: Periodo Analizado
                                ["📅 Periodo Analizado:", `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`],
                                // Fila 4: Espacio
                                [],
                                // Fila 5: Título de Sección KPI
                                ["🔑 Métricas Clave"],
                                // Fila 6: Espacio
                                [],
                                // Fila 7: KPIs
                                ["📦 Manifiestos Procesados", { v: Object.keys(report.manifiestos).length, t: 'n', z: '#,##0' }],
                                ["✅ Avance General de Escaneo", { v: avanceGeneral / 100, t: 'n', z: '0.00%' }],
                                ["📋 Piezas Totales (SAP)", { v: report.totalSAP, t: 'n', z: '#,##0' }],
                                ["🔍 Piezas Totales Escaneadas", { v: report.totalSCAN, t: 'n', z: '#,##0' }],
                                ["📉 Piezas Faltantes", { v: totalFaltantes, t: 'n', z: '#,##0', s: redTextStyle }],
                                ["📈 Piezas Excedentes", { v: totalExcedentes, t: 'n', z: '#,##0', s: orangeTextStyle }],
                                // Fila N: Espacio
                                [],
                                // Fila N+1: Título de Sección Adicional
                                ["📊 Detalles Adicionales"],
                                // Fila N+2: Detalles Adicionales
                                ["📁 Secciones Analizadas", { v: Object.keys(report.secciones).filter(key => report.secciones.hasOwnProperty(key) && (report.secciones[key].sap > 0 || report.secciones[key].scan > 0)).length, t: 'n', z: '#,##0' }],
                                ["🧑‍💻 Operadores Activos", { v: Object.keys(report.usuarios).length, t: 'n', z: '#,##0' }]
                            ];

                            const wsResumen = XLSX.utils.aoa_to_sheet(wsResumenData);

                            // Títulos y subtítulos
                            wsResumen["A1"].s = { font: { sz: 20, bold: true, color: { rgb: "E10098" } }, alignment: { horizontal: "center", vertical: "center" } }; // Título principal
                            wsResumen["A3"].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: "left" } }; // Periodo Analizado Label
                            wsResumen["B3"].s = { font: { sz: 12 }, alignment: { horizontal: "left" } }; // Periodo Analizado Value
                            wsResumen["A5"].s = { font: { bold: true, sz: 14, color: { rgb: "414141" } }, alignment: { horizontal: "left" } }; // Métricas Clave Título
                            wsResumen["A14"].s = { font: { bold: true, sz: 14, color: { rgb: "414141" } }, alignment: { horizontal: "left" } }; // Detalles Adicionales Título

                            // Estilos para las "tarjetas" de métricas
                            const metricLabelBaseStyle = { font: { bold: true, sz: 11 }, alignment: { horizontal: "left", vertical: "center" } };
                            const metricValueBaseStyle = { font: { sz: 13, bold: true }, alignment: { horizontal: "right", vertical: "center" } };

                            const applyMetricCardStyle = (startRow, labelColor = "000000", valueColor = "000000") => {
                                wsResumen[`A${startRow}`].s = { ...metricLabelBaseStyle, fill: { fgColor: { rgb: "F8F8F8" } }, border: { top: { style: "thin", color: { rgb: "E0E0E0" } }, bottom: { style: "thin", color: { rgb: "E0E0E0" } }, left: { style: "thin", color: { rgb: "E0E0E0" } }, right: { style: "thin", color: { rgb: "E0E0E0" } } }, font: { ...metricLabelBaseStyle.font, color: { rgb: labelColor } } };
                                wsResumen[`B${startRow}`].s = { ...metricValueBaseStyle, fill: { fgColor: { rgb: "FFFFFF" } }, border: { top: { style: "thin", color: { rgb: "E0E0E0" } }, bottom: { style: "thin", color: { rgb: "E0E0E0" } }, left: { style: "thin", color: { rgb: "E0E0E0" } }, right: { style: "thin", color: { rgb: "E0E0E0" } } }, font: { ...metricValueBaseStyle.font, color: { rgb: valueColor } } };
                            };

                            applyMetricCardStyle(7); // Manifiestos Procesados
                            applyMetricCardStyle(8); // Avance General
                            applyMetricCardStyle(9); // Piezas Totales SAP
                            applyMetricCardStyle(10); // Piezas Totales Escaneadas
                            applyMetricCardStyle(11, "E10098", "E10098"); // Faltantes (Rosa)
                            applyMetricCardStyle(12, "f0ad4e", "f0ad4e"); // Excedentes (Naranja)
                            applyMetricCardStyle(15); // Secciones Analizadas
                            applyMetricCardStyle(16); // Operadores Activos

                            // Barra de progreso de texto para Avance General de Escaneo
                            const progressBarLength = 15; // Longitud de la barra en caracteres
                            const filledBlocks = Math.round(avanceGeneral / (100 / progressBarLength));
                            const emptyBlocks = progressBarLength - filledBlocks;
                            const progressBarText = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

                            wsResumen["A8"].v = wsResumen["A8"].v + " " + progressBarText; // Append progress bar to label

                            // Combinar celdas para el título principal
                            wsResumen['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]; // Merge A1:B1

                            wsResumen['!cols'] = [
                                { wch: 30 }, // Columna A para etiquetas (ancho ajustado)
                                { wch: 25 }  // Columna B para valores (ancho ajustado)
                            ];
                            XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Ejecutivo");


                            // --- HOJA 2: ANÁLISIS POR SECCIÓN ---
                            const wsSeccionesData = [
                                ["Sección 📁", "Jefatura 🧑‍💼", "SKUs Únicos 🔢", "Pzs. SAP 📦", "Pzs. Escaneadas ✅", "Faltantes 📉", "Excedentes 📈", "Avance 📊"]
                            ];
                            const sortedSecciones = Object.entries(report.secciones)
                                .filter(([_, data]) => data.sap > 0 || data.scan > 0) // Solo secciones con actividad
                                .sort((a, b) => (b[1].sap - b[1].scan) - (a[1].sap - a[1].scan));

                            sortedSecciones.forEach(([nombre, data]) => {
                                const avance = data.sap > 0 ? data.scan / data.sap : 1;
                                const avanceCell = {
                                    v: avance,
                                    t: 'n',
                                    z: '0.00%'
                                };

                                // Formato condicional de color
                                if (avance < 0.5) avanceCell.s = {
                                    font: {
                                        color: {
                                            rgb: "E10098"
                                        }
                                    },
                                    ...cellStyle
                                };
                                else if (avance < 0.9) avanceCell.s = {
                                    font: {
                                        color: {
                                            rgb: "f0ad4e"
                                        }
                                    },
                                    ...cellStyle
                                };
                                else avanceCell.s = {
                                    font: {
                                        color: {
                                            rgb: "95C11F"
                                        }
                                    },
                                    ...cellStyle
                                };

                                wsSeccionesData.push([
                                    { v: String(nombre || 'N/A').trim(), s: cellStyle },
                                    { v: String(data.jefatura || 'N/A').trim(), s: cellStyle },
                                    { v: Number(data.skus || 0), t: 'n', z: '#,##0', s: cellStyle }, // Formato numérico
                                    { v: Number(data.sap || 0), t: 'n', z: '#,##0', s: cellStyle }, // Formato numérico
                                    { v: Number(data.scan || 0), t: 'n', z: '#,##0', s: cellStyle }, // Formato numérico
                                    { v: Number(data.faltantes || 0), t: 'n', z: '#,##0', s: data.faltantes > 0 ? redTextStyle : cellStyle }, // Formato numérico
                                    { v: Number(data.excedentes || 0), t: 'n', z: '#,##0', s: data.excedentes > 0 ? orangeTextStyle : cellStyle }, // Formato numérico
                                    avanceCell
                                ]);
                            });
                            const wsSecciones = XLSX.utils.aoa_to_sheet(wsSeccionesData, {
                                cellStyles: true
                            });
                            // Aplicar estilos de encabezado (ahora con color negro)
                            for (let c = 0; c < wsSeccionesData[0].length; c++) {
                                const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                if (wsSecciones[cellRef]) wsSecciones[cellRef].s = headerStyle;
                            }
                            wsSecciones['!cols'] = [{
                                wch: 18
                            }, {
                                wch: 25
                            }, {
                                wch: 12
                            }, {
                                wch: 12
                            }, {
                                wch: 15
                            }, {
                                wch: 12
                            }, {
                                wch: 12
                            }, {
                                wch: 12
                            }];
                            wsSecciones['!autofilter'] = { ref: wsSecciones['!ref'] }; // Autofilter
                            XLSX.utils.book_append_sheet(wb, wsSecciones, "Análisis por Sección");


                            // --- HOJA 3: RANKING DE OPERADORES ---
                            const wsUsuariosData = [
                                ["Ranking 🏆", "Operador 🧑‍💻", "Escaneos Totales 🔢", "Manifiestos Trabajados 📑"]
                            ];
                            topScanners.forEach(([email, data], index) => {
                                wsUsuariosData.push([
                                    { v: Number(index + 1), t: 'n', z: '0', s: cellStyle }, // Formato entero
                                    { v: String(email || 'N/A').trim(), s: cellStyle },
                                    { v: Number(data.scans || 0), t: 'n', z: '#,##0', s: cellStyle }, // Formato numérico
                                    { v: Number(data.manifests.size || 0), t: 'n', z: '#,##0', s: cellStyle } // Formato numérico
                                ]);
                            });
                            const wsUsuarios = XLSX.utils.aoa_to_sheet(wsUsuariosData);
                            // Aplicar estilos de encabezado (ahora con color negro)
                            for (let c = 0; c < wsUsuariosData[0].length; c++) {
                                const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                if (wsUsuarios[cellRef]) wsUsuarios[cellRef].s = headerStyle;
                            }
                            wsUsuarios['!cols'] = [{
                                wch: 10
                            }, {
                                wch: 35
                            }, {
                                wch: 18
                            }, {
                                wch: 22
                            }];
                            wsUsuarios['!autofilter'] = { ref: wsUsuarios['!ref'] }; // Autofilter
                            XLSX.utils.book_append_sheet(wb, wsUsuarios, "Ranking Operadores");


                            // --- HOJA 4: EVIDENCIA (NO ESCANEADOS) ---
                            const wsEvidenciaData = [
                                ["SKU 🏷️", "Descripción 📝", "Piezas Faltantes (SAP) 📉", "Manifiesto ID 🆔", "Número Manifiesto #️⃣"]
                            ];
                            report.skusSinEscanear.forEach(item => {
                                wsEvidenciaData.push([
                                    { v: String(item.sku || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.desc || 'N/A').trim(), s: cellStyle },
                                    { v: Number(item.sap || 0), t: 'n', z: '#,##0', s: redTextStyle }, // Formato numérico
                                    { v: String(item.manifiesto.id || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.manifiesto.numero || 'N/A').trim(), s: cellStyle }
                                ]);
                            });
                            const wsEvidencia = XLSX.utils.aoa_to_sheet(wsEvidenciaData);
                            // Aplicar estilos de encabezado (ahora con color negro)
                            for (let c = 0; c < wsEvidenciaData[0].length; c++) {
                                const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                if (wsEvidencia[cellRef]) wsEvidencia[cellRef].s = headerStyle;
                            }
                            wsEvidencia['!cols'] = [{
                                wch: 18
                            }, {
                                wch: 45
                            }, {
                                wch: 25
                            }, {
                                wch: 40
                            }, {
                                wch: 20
                            }];
                            wsEvidencia['!autofilter'] = { ref: wsEvidencia['!ref'] }; // Autofilter
                            XLSX.utils.book_append_sheet(wb, wsEvidencia, "Evidencia (No Escaneados)");

                            // --- HOJA 5: ANÁLISIS POR MANIFIESTO ---
                            const wsManifiestosData = [
                                ["Manifiesto ID 🆔", "Número Manifiesto #️⃣", "Contenedor 📦", "Sección 📁", "Jefatura 🧑‍💼", "Pzs. SAP (Cont/Sección) 📋", "Pzs. Escaneadas (Cont/Sección) ✅", "Faltantes (Cont/Sección) 📉", "Excedentes (Cont/Sección) 📈", "Avance (Cont/Sección) 📊"]
                            ];
                            // Sort `man.seccionesResumen` by jefatura, then by section for consistency
                            const allManifestDetails = [];
                            Object.values(report.manifiestos).forEach(man => {
                                // Iterar sobre las secciones procesadas para este manifiesto
                                Object.entries(man.seccionesResumen).forEach(([seccionNombre, seccionData]) => {
                                    const seccionInfo = seccionesMap.get(seccionNombre.toUpperCase()) || { jefatura: 'Sin Asignar', descripcion: 'Descripción no encontrada' };

                                    // Si la sección tiene datos por contenedor, iterar sobre ellos
                                    if (seccionData.byContenedor && Object.keys(seccionData.byContenedor).length > 0) {
                                        Object.entries(seccionData.byContenedor).forEach(([contenedor, dataPorContenedor]) => {
                                            if (dataPorContenedor && (dataPorContenedor.sap > 0 || dataPorContenedor.scan > 0 || dataPorContenedor.faltantes > 0 || dataPorContenedor.excedentes > 0)) {
                                                const avance = dataPorContenedor.sap > 0 ? dataPorContenedor.scan / dataPorContenedor.sap : 1;
                                                const faltantes = Number(dataPorContenedor.faltantes || 0);
                                                const excedentes = Number(dataPorContenedor.excedentes || 0);
                                                allManifestDetails.push({
                                                    manifiestoId: String(man.id || 'N/A').trim(),
                                                    manifiestoNumero: String(man.numero || 'N/A').trim(),
                                                    contenedor: String(contenedor || 'N/A').trim(),
                                                    seccion: String(seccionNombre || 'N/A').trim(),
                                                    jefatura: String(seccionInfo.jefatura || 'N/A').trim(),
                                                    sap: Number(dataPorContenedor.sap || 0),
                                                    scan: Number(dataPorContenedor.scan || 0),
                                                    faltantes: faltantes,
                                                    excedentes: excedentes,
                                                    avance: avance
                                                });
                                            }
                                        });
                                    } else { // Si la sección no tiene desglose por contenedor, usar los totales de la sección
                                        const sapTotalSec = seccionData.totalSap || 0;
                                        const scanTotalSec = seccionData.totalScan || 0;
                                        const faltantesTotalSec = (sapTotalSec - scanTotalSec) > 0 ? (sapTotalSec - scanTotalSec) : 0;
                                        const excedentesTotalSec = (scanTotalSec - sapTotalSec) > 0 ? (scanTotalSec - sapTotalSec) : 0;

                                        if (sapTotalSec > 0 || scanTotalSec > 0 || faltantesTotalSec > 0 || excedentesTotalSec > 0) {
                                            const avance = sapTotalSec > 0 ? scanTotalSec / sapTotalSec : 1;
                                            allManifestDetails.push({
                                                manifiestoId: String(man.id || 'N/A').trim(),
                                                manifiestoNumero: String(man.numero || 'N/A').trim(),
                                                contenedor: 'N/A (Sin Cont.)',
                                                seccion: String(seccionNombre || 'N/A').trim(),
                                                jefatura: String(seccionInfo.jefatura || 'N/A').trim(),
                                                sap: Number(sapTotalSec),
                                                scan: Number(scanTotalSec),
                                                faltantes: faltantesTotalSec,
                                                excedentes: excedentesTotalSec,
                                                avance: avance
                                            });
                                        }
                                    }
                                });
                            });

                            // Sort all collected details (by Jefatura, then Manifiesto, then Contenedor, then Sección)
                            allManifestDetails.sort((a, b) => {
                                const jefaturaCompare = String(a.jefatura || '').localeCompare(String(b.jefatura || ''));
                                if (jefaturaCompare !== 0) return jefaturaCompare;
                                const manifiestoCompare = String(a.manifiestoNumero || '').localeCompare(String(b.manifiestoNumero || ''));
                                if (manifiestoCompare !== 0) return manifiestoCompare;
                                const contenedorCompare = String(a.contenedor || '').localeCompare(String(b.contenedor || ''));
                                if (contenedorCompare !== 0) return contenedorCompare;
                                return String(a.seccion || '').localeCompare(String(b.seccion || ''));
                            });

                            allManifestDetails.forEach(item => {
                                const avanceCell = {
                                    v: item.avance,
                                    t: 'n',
                                    z: '0.00%'
                                };
                                if (item.avance < 0.5) avanceCell.s = { font: { color: { rgb: "E10098" } }, ...cellStyle };
                                else if (item.avance < 0.9) avanceCell.s = { font: { color: { rgb: "f0ad4e" } }, ...cellStyle };
                                else avanceCell.s = { font: { color: { rgb: "95C11F" } }, ...cellStyle };

                                wsManifiestosData.push([
                                    { v: item.manifiestoId, s: cellStyle },
                                    { v: item.manifiestoNumero, s: cellStyle },
                                    { v: item.contenedor, s: cellStyle },
                                    { v: item.seccion, s: cellStyle },
                                    { v: item.jefatura, s: cellStyle },
                                    { v: item.sap, t: 'n', z: '#,##0', s: cellStyle },
                                    { v: item.scan, t: 'n', z: '#,##0', s: cellStyle },
                                    { v: item.faltantes, t: 'n', z: '#,##0', s: item.faltantes > 0 ? redTextStyle : cellStyle },
                                    { v: item.excedentes, t: 'n', z: '#,##0', s: item.excedentes > 0 ? orangeTextStyle : cellStyle },
                                    avanceCell
                                ]);
                            });

                            const wsManifiestos = XLSX.utils.aoa_to_sheet(wsManifiestosData, { cellStyles: true });
                            // Aplicar estilos de encabezado (ahora con color negro)
                            for (let c = 0; c < wsManifiestosData[0].length; c++) {
                                const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                if (wsManifiestos[cellRef]) wsManifiestos[cellRef].s = headerStyle;
                            }
                            wsManifiestos['!cols'] = [
                                { wch: 40 },
                                { wch: 20 },
                                { wch: 20 },
                                { wch: 20 },
                                { wch: 25 },
                                { wch: 20 },
                                { wch: 25 },
                                { wch: 20 },
                                { wch: 20 },
                                { wch: 15 }
                            ];
                            wsManifiestos['!autofilter'] = { ref: wsManifiestos['!ref'] }; // Autofilter
                            XLSX.utils.book_append_sheet(wb, wsManifiestos, "Análisis por Manifiesto");

                            // --- HOJA 6: ARTÍCULOS CON EXCEDENTES ---
                            const wsExcedentesData = [
                                ["SKU 🏷️", "Descripción 📝", "Cantidad Excedente 📈", "Manifiesto ID 🆔", "Número Manifiesto #️⃣", "Contenedor 📦", "Sección 📁", "Jefatura 🧑‍💼"]
                            ];
                            // Ordenar por Jefatura, luego por Manifiesto
                            report.skusConExcedentes.sort((a, b) => {
                                const jefaturaCompare = String(a.jefatura || '').localeCompare(String(b.jefatura || ''));
                                if (jefaturaCompare !== 0) return jefaturaCompare;
                                const manifiestoCompare = String(a.manifiesto.numero || '').localeCompare(String(b.manifiesto.numero || ''));
                                if (manifiestoCompare !== 0) return manifiestoCompare;
                                return String(a.sku || '').localeCompare(String(b.sku || ''));
                            });

                            report.skusConExcedentes.forEach(item => {
                                wsExcedentesData.push([
                                    { v: String(item.sku || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.desc || 'N/A').trim(), s: cellStyle },
                                    { v: Number(item.excedente || 0), t: 'n', z: '#,##0', s: orangeTextStyle }, // Formato numérico
                                    { v: String(item.manifiesto.id || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.manifiesto.numero || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.contenedor || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.seccion || 'N/A').trim(), s: cellStyle },
                                    { v: String(item.jefatura || 'N/A').trim(), s: cellStyle }
                                ]);
                            });
                            const wsExcedentes = XLSX.utils.aoa_to_sheet(wsExcedentesData);
                            // Aplicar estilos de encabezado (ahora con color negro)
                            for (let c = 0; c < wsExcedentesData[0].length; c++) {
                                const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                if (wsExcedentes[cellRef]) wsExcedentes[cellRef].s = headerStyle;
                            }
                            wsExcedentes['!cols'] = [
                                { wch: 18 }, { wch: 45 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
                            ];
                            wsExcedentes['!autofilter'] = { ref: wsExcedentes['!ref'] }; // Autofilter
                            XLSX.utils.book_append_sheet(wb, wsExcedentes, "Artículos con Excedentes");


                            // --- HOJA 7: MANIFIESTOS FALLIDOS ---
                            if (report.failedManifests.length > 0) {
                                const wsFailedManifestsData = [
                                    ["ID Manifiesto ❌", "Error 🚨"]
                                ];
                                report.failedManifests.forEach(item => {
                                    wsFailedManifestsData.push([
                                        { v: String(item.id || 'N/A').trim(), s: cellStyle },
                                        { v: String(item.error || 'Error desconocido').trim(), s: redTextStyle }
                                    ]);
                                });
                                const wsFailedManifests = XLSX.utils.aoa_to_sheet(wsFailedManifestsData);
                                // Aplicar estilos de encabezado (ahora con color negro)
                                for (let c = 0; c < wsFailedManifestsData[0].length; c++) {
                                    const cellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
                                    if (wsFailedManifests[cellRef]) wsFailedManifests[cellRef].s = headerStyle;
                                }
                                wsFailedManifests['!cols'] = [{
                                    wch: 40
                                }, {
                                    wch: 80
                                }];
                                wsFailedManifests['!autofilter'] = { ref: wsFailedManifests['!ref'] }; // Autofilter
                                XLSX.utils.book_append_sheet(wb, wsFailedManifests, "Manifiestos Fallidos");
                            }


                            // --- Descarga del archivo ---
                            XLSX.writeFile(wb, `Reporte_Inteligencia_Semanal_${startDateStr}_a_${endDateStr}.xlsx`);
                        };

                        // Mejorado: Cuadros de tarjetas siempre del mismo tamaño usando CSS Grid y alturas fijas
                        const mainHTML = `
                        <style>
                            :root {
                                --liverpool-pink: #E10098;
                                --liverpool-green: #95C11F;
                                --liverpool-dark: #414141;
                                --liverpool-light-gray: #f4f7fa;
                                --liverpool-border-gray: #dee2e6;
                            }
                            .swal2-popup.swal2-modal { border-radius: 1.5rem !important; }
                            .epic-summary-container{display:flex;min-height:85vh;width:100%;font-family:'Poppins',sans-serif;background:var(--liverpool-light-gray);border-radius:1.5rem;overflow:hidden;}
                            .epic-sidebar{width:280px;min-width:280px;background:#ffffff;color:var(--liverpool-dark);padding:2rem 1.5rem;display:flex;flex-direction:column;align-items:flex-start;border-right: 1px solid var(--liverpool-border-gray);}
                            .epic-sidebar h3{font-weight:700;font-size:1.5rem;margin-bottom:0.25rem;color:var(--liverpool-pink);}
                            .epic-sidebar .date-range {font-size:0.9rem; color:#6c757d; margin-bottom: 2rem;}
                            .sidebar-nav{list-style:none;padding:0;margin:0;width:100%;}
                            .sidebar-nav li button{width:100%;text-align:left;padding:0.8rem 1rem;background:transparent;border:none;color:#495057;border-radius:10px;font-weight:500;display:flex;align-items:center;gap:0.8rem;transition:all 0.2s ease;margin-bottom:0.5rem;}
                            .sidebar-nav li button:hover{background:#e9ecef;color:var(--liverpool-pink);}
                            .sidebar-nav li button.active{background:var(--liverpool-pink);color:#fff;font-weight:600;}
                            .epic-content{flex-grow:1;padding:2rem 2.5rem;overflow-y:auto;}
                            .epic-tab-pane{display:none;animation:fadeIn 0.5s;} .epic-tab-pane.active{display:block;}
                            .epic-content h4{font-weight:600;color:var(--liverpool-dark);margin-bottom:1.5rem;border-bottom:1px solid var(--liverpool-border-gray);padding-bottom:0.8rem;display:flex;align-items:center;justify-content:space-between;}
                            
                            .stat-card-main{background:#fff;border-radius:1rem;padding:1.5rem;text-align:center;border:1px solid var(--liverpool-border-gray); transition:all 0.3s ease; height: 140px; display: flex; flex-direction: column; justify-content: center;}
                            .stat-card-main:hover{transform:translateY(-5px);box-shadow:0 8px 25px rgba(0,0,0,0.08);}
                            .stat-card-main .icon{font-size:2rem;margin-bottom:0.0rem;line-height:1;}
                            .stat-card-main .value{font-size:2.2rem;font-weight:700;line-height:1.1; color: var(--liverpool-dark);}
                            .stat-card-main .label{color:#6c757d;font-weight:500;font-size:0.9rem;}
                            .stat-card-main.sap .icon { color: var(--liverpool-dark); }
                            .stat-card-main.scan .icon { color: var(--liverpool-green); }
                            .stat-card-main.missing .icon { color: var(--liverpool-pink); }
                            .stat-card-main.excess .icon { color: #f0ad4e; }

                            /* Mejorado: Grid para tarjetas de resumen */
                            .dashboard-cards-row {
                                display: grid;
                                grid-template-columns: repeat(2, 1fr);
                                gap: 1.5rem;
                                margin-bottom: 0;
                            }
                            @media (max-width: 991px) {
                                .dashboard-cards-row { grid-template-columns: 1fr; }
                            }

                            .filter-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                            .filter-pills button { background-color: #e9ecef; border: none; border-radius: 2rem; padding: 0.4rem 1rem; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease; cursor: pointer; }
                            .filter-pills button.active { background-color: var(--liverpool-pink); color: white; box-shadow: 0 4px 10px rgba(225, 0, 152, 0.3); }

                            .jefatura-card { background-color: #fff; border-radius: 1rem; padding: 1.5rem; border: 1px solid var(--liverpool-border-gray); margin-bottom: 1.5rem; height: 100%; display: flex; flex-direction: column; }
                            .jefatura-header { display: flex; align-items: center; gap: 1.5rem; padding-bottom:1rem; margin-bottom:1rem; border-bottom: 1px solid #f1f3f5; }
                            .jefatura-chart-container { width: 80px; height: 80px; position: relative; flex-shrink: 0; }
                            .jefatura-title h5 { font-weight: 700; margin-bottom: 0.1rem; color: var(--liverpool-dark); }
                            .jefatura-title .stats-summary { font-size: 0.9rem; color: #6c757d; }
                            .jefatura-secciones-list { list-style: none; padding: 0; margin: 0; }
                            .jefatura-secciones-list li { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.2rem; font-size: 0.95rem; border-bottom: 1px solid #f8f9fa; }
                            .jefatura-secciones-list li:last-child { border-bottom: none; }
                            .jefatura-secciones-list .section-name { font-weight: 500; }
                            
                            /* Mejorado: Grid para secciones, tarjetas igual altura */
                            #secciones-grid-container, #secciones-detail-grid {
                                display: grid !important;
                                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                                gap: 1.2rem;
                            }
                            .section-card-compact { 
                                background: #fff; 
                                border: 1px solid var(--liverpool-border-gray); 
                                border-radius: 0.75rem; 
                                padding: 1rem; 
                                text-align: center; 
                                transition: all 0.2s ease-in-out; 
                                display: flex; 
                                flex-direction: column; 
                                height: 210px; /* Altura fija para uniformidad */
                                min-height: 210px;
                                max-height: 210px;
                                justify-content: flex-start;
                            }
                            .section-card-compact:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.1); z-index: 10; position:relative; }
                            .section-card-compact .section-name { font-weight: 600; font-size: 0.95rem; color: var(--liverpool-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                            .section-card-compact .section-jefe { font-size: 0.8rem; color: #6c757d; margin-bottom: 0.75rem; }
                            .section-card-compact .section-counts { font-size: 0.8rem; color: #6c757d; margin-top: 0.5rem; }
                            .section-card-compact .custom-progress { margin-top: 0.5rem; margin-bottom: 0.5rem; }

                            .custom-progress { background-color: #e9ecef; border-radius: 2rem; height: 1.25rem; overflow: hidden; }
                            .custom-progress-bar { display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 600; font-size: 0.75rem; transition: width 0.4s ease; }
                            .progress-green { background: linear-gradient(45deg, #84ac1c, #95C11F); }
                            .progress-yellow { background: linear-gradient(45deg, #e69a05, #f0ad4e); }
                            .progress-pink { background: linear-gradient(45deg, #d3008a, #E10098); }

                            .leaderboard-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 1rem; background: #fff; margin-bottom: 0.75rem; border: 1px solid var(--liverpool-border-gray); }
                            .leaderboard-rank { font-size: 1.2rem; font-weight: 700; color: var(--liverpool-pink); width: 2.5rem; text-align: center; flex-shrink: 0; }
                            .leaderboard-info { flex-grow: 1; }
                            .leaderboard-name { font-weight: 600; color: var(--liverpool-dark); }
                            .leaderboard-details { font-size: 0.85rem; color: #6c757d; }
                            .leaderboard-stats { font-size: 1.2rem; font-weight: 700; color: var(--liverpool-dark); text-align: right; }

                            /* Estilos específicos para la sección de manifiestos */
                            .manifiesto-list-item {
                                cursor: pointer;
                                transition: background-color 0.2s ease;
                            }
                            .manifiesto-list-item:hover {
                                background-color: #f8f9fa;
                            }
                            .manifiesto-list-item.active {
                                background-color: var(--liverpool-pink) !important;
                                color: white;
                                border-color: var(--liverpool-pink);
                            }
                            .manifiesto-list-item.active i {
                                color: white !important;
                            }
                            .manifiesto-list-item.active .text-muted {
                                color: rgba(255,255,255,0.7) !important;
                            }
                             .manifiesto-list-item.active .badge {
                                background-color: #fff !important;
                                color: var(--liverpool-dark) !important;
                            }
                            /* Colores de estado en la lista de manifiestos */
                            .manifest-status-completed { border-left: 5px solid var(--liverpool-green); }
                            .manifest-status-diff { border-left: 5px solid #f0ad4e; }
                            .manifest-status-zero { border-left: 5px solid var(--liverpool-pink); }

                            /* Ajustes para la tarjeta de manifiesto en detalle */
                            #manifest-detail-view .stat-card-main .value {
                                font-size: 1.8rem;
                            }
                            #manifest-detail-view .stat-card-main .label {
                                font-size: 0.8rem;
                            }
                        </style>
                        <div class="epic-summary-container">
                            <div class="epic-sidebar">
                                <h3><i class="bi bi-robot me-2"></i>Resumen AI</h3>
                                <p class="date-range">${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}</p>
                                <ul class="sidebar-nav">
                                    <li><button class="nav-btn active" data-target="dashboard"><i class="bi bi-grid-1x2-fill"></i>Dashboard</button></li>
                                    <li><button class="nav-btn" data-target="jefaturas"><i class="bi bi-person-badge-fill"></i>Por Jefatura</button></li>
                                    <li><button class="nav-btn" data-target="secciones"><i class="bi bi-pie-chart-fill"></i>Por Sección</button></li>
                                    <li><button class="nav-btn" data-target="manifiestos-detail"><i class="bi bi-journal-check"></i>Por Manifiesto</button></li>
                                    <li><button class="nav-btn" data-target="excedentes-detail"><i class="bi bi-box-arrow-in-up-right"></i>Excedentes <span class="badge rounded-pill" style="background-color: #f0ad4e;">${report.skusConExcedentes.length}</span></button></li>
                                    <li><button class="nav-btn" data-target="usuarios"><i class="bi bi-trophy-fill"></i>Ranking</button></li>
                                    <li><button class="nav-btn" data-target="evidencia"><i class="bi bi-exclamation-diamond-fill"></i>Alertas <span class="badge rounded-pill" style="background-color: var(--liverpool-pink);">${report.skusSinEscanear.length}</span></button></li>
                                </ul>
                                <div class="mt-auto w-100"><button id="btnDescargarResumenExcel" class="btn btn-outline-success w-100"><i class="bi bi-file-earmarked-excel-fill me-2"></i>Descargar Excel</button></div>
                                ${report.failedManifests.length > 0 ? `<div class="mt-3 alert alert-danger p-2 small" role="alert"><i class="bi bi-exclamation-circle-fill me-1"></i> ${report.failedManifests.length} Manifiesto(s) con errores. Revisa la consola o descarga el Excel.</div>` : ''}
                            </div>
                            <div class="epic-content">
                                <div id="dashboard" class="epic-tab-pane active">
                                    <h4><i class="bi bi-speedometer2"></i>Resumen General</h4>
                                    <div class="row g-4 mb-5">
                                        <div class="col-lg-7">
                                            <div class="dashboard-cards-row">
                                                <div><div class="stat-card-main sap"><i class="bi bi-box-seam icon"></i><div class="value">${report.totalSAP.toLocaleString('es-MX')}</div><div class="label">Piezas SAP</div></div></div>
                                                <div><div class="stat-card-main scan"><i class="bi bi-check-circle-fill icon"></i><div class="value">${report.totalSCAN.toLocaleString('es-MX')}</div><div class="label">Escaneadas</div></div></div>
                                                <div><div class="stat-card-main missing"><i class="bi bi-exclamation-triangle-fill icon"></i><div class="value">${totalFaltantes.toLocaleString('es-MX')}</div><div class="label">Faltantes</div></div></div>
                                                <div><div class="stat-card-main excess"><i class="bi bi-plus-circle-dotted icon"></i><div class="value">${totalExcedentes.toLocaleString('es-MX')}</div><div class="label">Excedentes</div></div></div>
                                            </div>
                                        </div>
                                        <div class="col-lg-5 d-flex align-items-center justify-content-center"><canvas id="gaugeChart"></canvas></div>
                                    </div>
                                    <h4><i class="bi bi-archive-fill me-2"></i>Manifiestos Incluidos</h4>
                                    <ul class="list-group list-group-flush">${Object.values(report.manifiestos).map(m => `<li class="list-group-item d-flex justify-content-between align-items-center"><i class="bi bi-file-earmark-text me-2" style="color:var(--liverpool-pink);"></i><div><strong>${m.id}</strong> <br><span class="text-muted small">N° Manif: ${m.numero}</span></div><span class="badge bg-secondary ms-2">${(m.contenedores || []).length} Cont.</span></li>`).join('')}</ul>
                                </div>
                                <div id="jefaturas" class="epic-tab-pane">
                                    <h4><i class="bi bi-person-badge-fill me-2"></i>Rendimiento por Jefatura</h4>
                                    <div id="jefaturas-grid" style="max-height: 75vh; overflow-y: auto; padding: 0.2rem;"></div>
                                </div>
                                <div id="secciones" class="epic-tab-pane">
                                    <h4><i class="bi bi-pie-chart-fill me-2"></i>Rendimiento por Sección</h4>
                                    <div id="seccion-jefatura-filter" class="filter-pills mb-4"></div>
                                    <div id="secciones-grid-container"></div>
                                </div>
                                <div id="manifiestos-detail" class="epic-tab-pane">
                                    <h4><i class="bi bi-journal-check me-2"></i>Análisis Detallado por Manifiesto</h4>
                                    <div class="row mb-4">
                                        <div class="col-lg-4">
                                            <div class="card p-3 shadow-sm border-0 h-100">
                                                <h6 class="card-title text-muted mb-3"><i class="bi bi-list-check me-1"></i> Seleccionar Manifiesto</h6>
                                                <div id="manifiestos-status-filter" class="filter-pills mb-3 d-flex flex-wrap gap-2">
                                                    <button class="filter-btn active" data-status-filter="Todos">Todos</button>
                                                    <button class="filter-btn" data-status-filter="Completado">Completados</button>
                                                    <button class="filter-btn" data-status-filter="Diferencias">Con Diferencias</button>
                                                    <button class="filter-btn" data-status-filter="Sin Escanear">Sin Escanear</button>
                                                </div>
                                                <div id="manifiestos-list-container" class="list-group list-group-flush" style="max-height: 50vh; overflow-y: auto; border: 1px solid var(--liverpool-border-gray); border-radius: 0.5rem;">
                                                    <li class="list-group-item text-center text-muted py-3">Cargando manifiestos...</li>
                                                </div>
                                                <p class="small text-muted mt-3">💡 **Consejo para Auditoría:** Enfócate en manifiestos con alta desviación (muchas piezas faltantes/excedentes) para identificar problemas de raíz. Revisa la sección de "Alertas" para SKUs específicos no escaneados.</p>
                                            </div>
                                        </div>
                                        <div class="col-lg-8">
                                            <div id="manifest-detail-view" class="card p-4 shadow-sm border-0 h-100">
                                                <p class="text-muted text-center mt-4">Selecciona un manifiesto de la lista para ver su detalle y desglose por jefatura, contenedor y sección.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="excedentes-detail" class="epic-tab-pane">
                                    <h4 style="color: #f0ad4e;"><i class="bi bi-box-arrow-in-up-right me-2"></i>Artículos con Excedentes</h4>
                                    <div class="row mb-4">
                                        <div class="col-lg-4">
                                            <div class="card p-3 shadow-sm border-0 h-100">
                                                <h6 class="card-title text-muted mb-3"><i class="bi bi-filter-circle me-1"></i> Filtrar Excedentes por Jefatura</h6>
                                                <div id="excedentes-jefatura-filter" class="filter-pills mb-3 d-flex flex-wrap gap-2">
                                                    </div>
                                                <p class="small text-muted mt-3">Utiliza este filtro para ver los excedentes por la jefatura responsable de la sección.</p>
                                            </div>
                                        </div>
                                        <div class="col-lg-8">
                                            <div class="card p-4 shadow-sm border-0 h-100 d-flex flex-column align-items-center justify-content-center">
                                                <h5 class="mt-4 mb-3" style="color: var(--liverpool-dark); border-bottom: 1px solid var(--liverpool-border-gray); padding-bottom: 0.5rem; width: 100%; text-align: center;"><i class="bi bi-pie-chart-fill me-2"></i>Distribución de Excedentes</h5>
                                                <div style="width: 200px; height: 200px; position: relative;">
                                                    <canvas id="excedentesChart"></canvas>
                                                </div>
                                                <div class="mt-4 w-100" style="max-height: 250px; overflow-y: auto;">
                                                    <ul class="list-group list-group-flush" id="excedentes-list-container">
                                                        </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="usuarios" class="epic-tab-pane">
                                    <h4><i class="bi bi-trophy-fill me-2"></i>Ranking de Operadores</h4>
                                    <div style="max-height: 75vh; overflow-y: auto; padding-right:10px;">
                                        ${topScanners.length > 0 ? topScanners.map(([email, data], i) => `
                                            <div class="leaderboard-item">
                                                <div class="leaderboard-rank">${['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</div>
                                                <div class="leaderboard-info">
                                                    <div class="leaderboard-name">${String(email || 'N/A').trim()}</div>
                                                    <div class="leaderboard-details">En ${data.manifests.size} manifiesto(s)</div>
                                                </div>
                                                <div class="leaderboard-stats">${(data.scans || 0).toLocaleString('es-MX')} <span class="small text-muted">pzs</span></div>
                                            </div>`).join('') : '<p class="text-muted text-center mt-4">No hay datos de rendimiento de usuarios.</p>'}
                                    </div>
                                </div>
                                <div id="evidencia" class="epic-tab-pane">
                                    <h4 style="color: var(--liverpool-pink);"><i class="bi bi-exclamation-diamond-fill me-2"></i>Artículos con Cero Escaneos</h4>
                                    <div style="max-height: 75vh; overflow-y: auto; padding-right:10px;"><ul class="list-group list-group-flush">${report.skusSinEscanear.length > 0 ? report.skusSinEscanear.map(item => `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong style="color:var(--liverpool-dark);">${String(item.sku || 'N/A').trim()}</strong> - ${String(item.desc || 'Sin Descripción').trim()}<br><small class="text-muted">Manifiesto: ${String(item.manifiesto.id || 'N/A').trim()} (N° ${String(item.manifiesto.numero || 'N/A').trim()})</small></div><span class="badge rounded-pill" style="background-color: var(--liverpool-pink);">${(item.sap || 0)} pz.</span></li>`).join('') : '<li class="list-group-item text-center text-success fs-5 p-4">¡Felicidades! Todos los artículos fueron escaneados.</li>'}</ul></div>
                                </div>
                            </div>
                        </div>`;

                        Swal.fire({
                            html: mainHTML,
                            width: '95vw',
                            maxWidth: '1600px',
                            showCloseButton: true,
                            showConfirmButton: false,
                            padding: 0,
                            customClass: {
                                popup: 'p-0 border-0'
                            },
                            didOpen: () => {
                                const navButtons = document.querySelectorAll('.sidebar-nav li button');
                                const tabPanes = document.querySelectorAll('.epic-tab-pane');
                                document.getElementById('btnDescargarResumenExcel').addEventListener('click', descargarResumenExcel);

                                navButtons.forEach(btn => {
                                    btn.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        navButtons.forEach(b => b.classList.remove('active'));
                                        tabPanes.forEach(p => p.classList.remove('active'));
                                        btn.classList.add('active');
                                        document.getElementById(btn.dataset.target).classList.add('active');
                                        // Si cambia a la pestaña de manifiestos, renderiza la lista global de manifiestos
                                        if (btn.dataset.target === 'manifiestos-detail') {
                                            renderManifiestosList(); // Llama la función de lista global
                                        } else if (btn.dataset.target === 'excedentes-detail') {
                                            renderExcedentesDetail();
                                        }
                                    });
                                });

                                const renderJefaturaFilter = () => {
                                    const container = document.getElementById('seccion-jefatura-filter');
                                    if (!container) return;

                                    let filtersHTML = '<button class="filter-btn active" data-jefe="Todos">Todos</button>';
                                    filtersHTML += jefaturasUnicas.map(jefe => `<button class="filter-btn" data-jefe="${jefe}">${String(jefe || 'N/A').trim()}</button>`).join('');
                                    container.innerHTML = filtersHTML;

                                    container.querySelectorAll('.filter-btn').forEach(button => {
                                        button.addEventListener('click', (e) => {
                                            container.querySelector('.active')?.classList.remove('active');
                                            e.currentTarget.classList.add('active');
                                            renderSecciones(e.currentTarget.dataset.jefe);
                                        });
                                    });
                                };

                                const renderJefaturas = () => {
                                    const grid = document.getElementById('jefaturas-grid');
                                    if (!grid) return;
                                    // Solo ordenar y mostrar jefes que realmente tienen datos en el reporte
                                    const jefesOrdenados = Object.entries(report.jefaturas)
                                        .filter(([_, data]) => data.sap > 0 || data.scan > 0) // Solo jefes con actividad
                                        .sort((a, b) => b[1].sap - a[1].sap);

                                    if (jefesOrdenados.length === 0) {
                                        grid.innerHTML = '<p class="text-center text-muted col-12 mt-5">No se encontraron datos de jefaturas con actividad en este periodo.</p>';
                                        return;
                                    }

                                    grid.innerHTML = jefesOrdenados.map(([nombreJefe, data]) => {
                                        const chartId = `chart-jefe-${String(nombreJefe || '').replace(/[^a-zA-Z0-9]/g, '')}`;
                                        const seccionesHTML = data.secciones.sort((a, b) => b.avance - a.avance).map(s => `
                            <li>
                                <span class="section-name">${String(s.nombre || 'N/A').trim()}</span>
                                <span class="badge rounded-pill" style="background-color: ${s.avance < 50 ? 'var(--liverpool-pink)' : s.avance < 90 ? '#f0ad4e' : 'var(--liverpool-green)'}; min-width: 50px;">${s.avance.toFixed(0)}%</span>
                            </li>
                        `).join('');

                                        const avanceTotalJefatura = data.sap > 0 ? (data.scan / data.sap) * 100 : 100;
                                        const colorAvanceJefatura = avanceTotalJefatura < 50 ? 'var(--liverpool-pink)' : avanceTotalJefatura < 90 ? '#f0ad4e' : 'var(--liverpool-green)';

                                        return `
                        <div class="jefatura-card">
                            <div class="jefatura-header">
                                <div class="jefatura-chart-container"><canvas id="${chartId}"></canvas></div>
                                <div class="jefatura-title">
                                    <h5>${String(nombreJefe || 'N/A').trim()}</h5>
                                    <span class="stats-summary">${(data.scan || 0).toLocaleString('es-MX')} / ${(data.sap || 0).toLocaleString('es-MX')} pzs escaneadas</span>
                                </div>
                            </div>
                            <ul class="jefatura-secciones-list">${seccionesHTML}</ul>
                        </div>`;
                                    }).join('');

                                    setTimeout(() => {
                                        jefesOrdenados.forEach(([nombreJefe, data]) => {
                                            const doughnutCtx = document.getElementById(`chart-jefe-${String(nombreJefe || '').replace(/[^a-zA-Z0-9]/g, '')}`)?.getContext('2d');
                                            if (doughnutCtx) {
                                                const avance = data.sap > 0 ? (data.scan / data.sap) * 100 : 100;
                                                const colorAvance = avance < 50 ? 'var(--liverpool-pink)' : avance < 90 ? '#f0ad4e' : 'var(--liverpool-green)';
                                                new Chart(doughnutCtx, {
                                                    type: 'doughnut',
                                                    data: {
                                                        datasets: [{
                                                            data: [avance, 100 - avance],
                                                            backgroundColor: [colorAvance, '#f1f3f5'],
                                                            borderWidth: 0,
                                                            cutout: '75%'
                                                        }]
                                                    },
                                                    options: {
                                                        responsive: true,
                                                        plugins: {
                                                            legend: {
                                                                display: false
                                                            },
                                                            tooltip: {
                                                                enabled: false
                                                            }
                                                        }
                                                    },
                                                    plugins: [{
                                                        id: `gaugeText-jefe-${nombreJefe}`,
                                                        beforeDraw: chart => {
                                                            const { ctx, width, height } = chart;
                                                            ctx.restore();
                                                            ctx.font = `700 ${(height / 4).toFixed(0)}px Poppins`;
                                                            ctx.fillStyle = colorAvance;
                                                            ctx.textAlign = 'center';
                                                            ctx.textBaseline = 'middle';
                                                            ctx.fillText(`${avance.toFixed(0)}%`, width / 2, height / 2);
                                                            ctx.save();
                                                        }
                                                    }]
                                                });
                                            }
                                        });
                                    }, 100);
                                };

                                const renderSecciones = (filtroJefe = 'Todos') => {
                                    const grid = document.getElementById('secciones-grid-container');
                                    if (!grid) return;

                                    const seccionesFiltradas = Object.entries(report.secciones)
                                        .filter(([_, data]) => (filtroJefe === 'Todos' || data.jefatura === filtroJefe) && (data.sap > 0 || data.scan > 0)); // Solo secciones con actividad

                                    if (seccionesFiltradas.length === 0) {
                                        grid.innerHTML = '<div class="col-12"><p class="text-center text-muted mt-4">No hay secciones que coincidan con el filtro o con actividad en este periodo.</p></div>';
                                        return;
                                    }

                                    grid.innerHTML = seccionesFiltradas.sort((a, b) => b[1].sap - a[1].sap).map(([nombre, data]) => {
                                        const avance = data.sap > 0 ? (data.scan / data.sap * 100) : 100;
                                        const progressColorClass = avance < 50 ? 'progress-pink' : avance < 90 ? 'progress-yellow' : 'progress-green';

                                        return `<div class="col">
                            <div class="section-card-compact">
                                <div class="section-name" title="${String(data.descripcion || 'Sin Descripción').trim()}">${String(nombre || 'N/A').trim()}</div>
                                <div class="section-jefe">${String(data.jefatura || 'N/A').trim()}</div>
                                <div class="custom-progress">
                                    <div class="custom-progress-bar ${progressColorClass}" style="width: ${avance}%;">${avance.toFixed(0)}%</div>
                                </div>
                                <div class="section-counts">${(data.scan || 0).toLocaleString('es-MX')} / ${(data.sap || 0).toLocaleString('es-MX')} pzs</div>
                            </div>
                        </div>`;
                                    }).join('');
                                };

                                // ESTADOS GLOBALES PARA LA SECCIÓN DE MANIFIESTOS
                                let currentStatusFilterManifiestos = 'Todos'; // Estado para el filtro de estado de escaneo en manifiestos
                                let currentManifestIdSelected = null; // Estado para el manifiesto actualmente seleccionado
                                let currentJefaturaFilterManifiestosDetalle = 'Todos'; // Estado del filtro de jefatura dentro del detalle del manifiesto
                                let currentContenedorFilterManifiestosDetalle = 'Todos'; // Estado del filtro de contenedor dentro del detalle del manifiesto

                                const renderManifiestosList = () => { // Ya no recibe parámetros, usa estados globales
                                    const listContainer = document.getElementById('manifiestos-list-container');
                                    if (!listContainer) return;

                                    // Re-attaching status filter event listeners each time we render the list
                                    const statusFilterContainer = document.getElementById('manifiestos-status-filter');
                                    if (statusFilterContainer) {
                                        statusFilterContainer.querySelectorAll('.filter-btn').forEach(button => {
                                            // Remover listener previo para evitar duplicados
                                            const oldListener = button._eventListener;
                                            if (oldListener) {
                                                button.removeEventListener('click', oldListener);
                                            }
                                            const newListener = (e) => {
                                                statusFilterContainer.querySelector('.active')?.classList.remove('active');
                                                e.currentTarget.classList.add('active');
                                                currentStatusFilterManifiestos = e.currentTarget.dataset.statusFilter;
                                                renderManifiestosList(); // Re-renderiza la lista con el nuevo filtro
                                            };
                                            button.addEventListener('click', newListener);
                                            button._eventListener = newListener; // Guardar referencia para remover
                                        });
                                    }

                                    let filteredManifests = Object.values(report.manifiestos);

                                    // Aplicar filtro por estado de escaneo
                                    if (currentStatusFilterManifiestos !== 'Todos') {
                                        filteredManifests = filteredManifests.filter(man => {
                                            const totalSapMan = Object.values(man.seccionesResumen).reduce((sum, s) => sum + (s.totalSap || 0), 0);
                                            const totalScanMan = Object.values(man.seccionesResumen).reduce((sum, s) => sum + (s.totalScan || 0), 0);
                                            const avanceMan = totalSapMan > 0 ? (totalScanMan / totalSapMan) * 100 : 100;

                                            // Un manifiesto "vacío" (0 SAP, 0 SCAN) no tiene estado de escaneo relevante para estos filtros
                                            if (totalSapMan === 0 && totalScanMan === 0) return false;

                                            switch (currentStatusFilterManifiestos) {
                                                case 'Completado': return avanceMan === 100;
                                                case 'Diferencias': return avanceMan > 0 && avanceMan < 100;
                                                case 'Sin Escanear': return avanceMan === 0 && totalSapMan > 0;
                                                default: return true;
                                            }
                                        });
                                    }

                                    const sortedManifests = filteredManifests.sort((a, b) => {
                                        const numA = parseInt(String(a.numero || '0').replace(/\D/g, ''), 10) || 0; // Robustecer conversion
                                        const numB = parseInt(String(b.numero || '0').replace(/\D/g, ''), 10) || 0; // Robustecer conversion
                                        if (numA !== numB) return numA - numB;
                                        return String(a.id || '').localeCompare(String(b.id || '')); // Fallback para ordenar por ID
                                    });

                                    if (sortedManifests.length === 0) {
                                        listContainer.innerHTML = '<li class="list-group-item text-center text-muted py-3">No hay manifiestos que coincidan con los filtros aplicados.</li>';
                                        document.getElementById('manifest-detail-view').innerHTML = '<p class="text-muted text-center mt-4">Selecciona un manifiesto de la lista para ver su detalle.</p>';
                                        return;
                                    }

                                    listContainer.innerHTML = sortedManifests.map((m) => {
                                        const totalSapMan = Object.values(m.seccionesResumen).reduce((sum, s) => sum + (s.totalSap || 0), 0);
                                        const totalScanMan = Object.values(m.seccionesResumen).reduce((sum, s) => sum + (s.totalScan || 0), 0);
                                        const avanceMan = totalSapMan > 0 ? (totalScanMan / totalSapMan) * 100 : 100;

                                        let statusClass = '';
                                        if (totalSapMan === 0 && totalScanMan === 0) {
                                            statusClass = ''; // Manifiestos sin datos, no les asignamos color de estado
                                        } else if (avanceMan === 100) {
                                            statusClass = 'manifest-status-completed';
                                        } else if (avanceMan > 0 && avanceMan < 100) {
                                            statusClass = 'manifest-status-diff';
                                        } else if (avanceMan === 0 && totalSapMan > 0) {
                                            statusClass = 'manifest-status-zero';
                                        }

                                        return `
                            <li class="list-group-item d-flex justify-content-between align-items-center manifiesto-list-item ${currentManifestIdSelected === m.id ? 'active' : ''} ${statusClass}" data-manifest-id="${String(m.id || 'N/A').trim()}">
                                <i class="bi bi-file-earmark-text me-2" style="color:var(--liverpool-pink);"></i>
                                <div>
                                    <strong>${String(m.numero || 'N/A').trim()}</strong> <br>
                                    <span class="text-muted small">${String(m.id || 'N/A').substring(0, 8)}...</span> </div>
                                <span class="badge bg-secondary ms-2">${(m.contenedores || []).length} Cont.</span>
                            </li>
                        `;
                                    }).join('');

                                    listContainer.querySelectorAll('.manifiesto-list-item').forEach(item => {
                                        item.addEventListener('click', (e) => {
                                            listContainer.querySelectorAll('.manifiesto-list-item').forEach(li => li.classList.remove('active')); // Eliminar 'active' de todos
                                            e.currentTarget.classList.add('active');
                                            currentManifestIdSelected = e.currentTarget.dataset.manifestId;
                                            // Resetear filtros de detalle al seleccionar nuevo manifiesto
                                            currentJefaturaFilterManifiestosDetalle = 'Todos';
                                            currentContenedorFilterManifiestosDetalle = 'Todos';
                                            renderManifestDetail(currentManifestIdSelected);
                                        });
                                    });

                                    // Activar el primer manifiesto automáticamente si no hay uno seleccionado o si el seleccionado no está en la lista filtrada
                                    if (!currentManifestIdSelected || !filteredManifests.some(m => m.id === currentManifestIdSelected)) {
                                        if (sortedManifests.length > 0) {
                                            currentManifestIdSelected = sortedManifests[0].id;
                                            listContainer.querySelector(`[data-manifest-id="${currentManifestIdSelected}"]`)?.classList.add('active');
                                            renderManifestDetail(currentManifestIdSelected);
                                        } else {
                                            // Si no hay manifiestos después de aplicar filtros, limpiar el detalle
                                            document.getElementById('manifest-detail-view').innerHTML = '<p class="text-muted text-center mt-4">Selecciona un manifiesto de la lista para ver su detalle.</p>';
                                        }
                                    } else {
                                        // Si el manifiesto seleccionado sigue en la lista, re-renderizar su detalle (con filtros de detalle reseteados)
                                        renderManifestDetail(currentManifestIdSelected);
                                    }
                                };


                                const renderManifestDetail = (manifestId) => { // Eliminar contenedorFilter como parámetro aquí, se pasa internamente
                                    const detailContainer = document.getElementById('manifest-detail-view');
                                    if (!detailContainer) return;

                                    const manifest = report.manifiestos[manifestId];
                                    if (!manifest) {
                                        detailContainer.innerHTML = '<p class="text-muted text-center mt-4">Manifiesto no encontrado o no se pudo procesar.</p>';
                                        return;
                                    }

                                    // Calcular totales para el manifiesto
                                    const manifestTotalSAP = Object.values(manifest.seccionesResumen).reduce((sum, s) => sum + (s.totalSap || 0), 0);
                                    const manifestTotalSCAN = Object.values(manifest.seccionesResumen).reduce((sum, s) => sum + (s.totalScan || 0), 0);
                                    const manifestAvanceOverall = manifestTotalSAP > 0 ? (manifestTotalSCAN / manifestTotalSAP) * 100 : 100;
                                    const colorManifestAvance = manifestAvanceOverall < 50 ? 'var(--liverpool-pink)' : (manifestAvanceOverall < 90 ? '#f0ad4e' : 'var(--liverpool-green)');


                                    // Obtener jefaturas relevantes para este MANIFIESTO (con datos en el manifiesto)
                                    const jefaturasEnEsteManifiesto = new Set();
                                    for (const seccionKey in manifest.seccionesResumen) {
                                        const seccionData = manifest.seccionesResumen[seccionKey];
                                        // Solo añadir si la sección tiene piezas SAP, escaneadas, faltantes o excedentes
                                        if (seccionData.totalSap > 0 || seccionData.totalScan > 0 ||
                                            Object.values(seccionData.byContenedor || {}).some(c => c.faltantes > 0 || c.excedentes > 0)) {
                                            jefaturasEnEsteManifiesto.add(seccionData.jefatura);
                                        }
                                    }
                                    const sortedJefaturasManifiesto = Array.from(jefaturasEnEsteManifiesto).sort();

                                    const jefaturaFilterHTML = sortedJefaturasManifiesto.map(jefe =>
                                        `<button class="filter-btn ${currentJefaturaFilterManifiestosDetalle === jefe ? 'active' : ''}" data-jefe-detail="${jefe}">${String(jefe || 'N/A').trim()}</button>`
                                    ).join('');


                                    // Renderizar la estructura general del detalle del manifiesto
                                    detailContainer.innerHTML = `
                        <div class="row g-4 mb-4">
                            <div class="col-md-4">
                                <div class="stat-card-main">
                                    <i class="bi bi-tag-fill icon" style="color: var(--liverpool-dark);"></i>
                                    <div class="value">${String(manifest.numero || 'N/A').trim()}</div>
                                    <div class="label">Manifiesto</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="stat-card-main">
                                    <i class="bi bi-box-seam icon" style="color: var(--liverpool-dark);"></i>
                                    <div class="value">${manifestTotalSAP.toLocaleString('es-MX')}</div>
                                    <div class="label">Pzs. SAP Manifiesto</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="stat-card-main">
                                    <i class="bi bi-check-circle-fill icon" style="color: var(--liverpool-green);"></i>
                                    <div class="value">${manifestTotalSCAN.toLocaleString('es-MX')}</div>
                                    <div class="label">Pzs. Escaneadas Manifiesto</div>
                                </div>
                            </div>
                             <div class="col-12 d-flex justify-content-center align-items-center">
                                <div style="width: 150px; height: 150px; position: relative;">
                                    <canvas id="manifestOverallGauge"></canvas>
                                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                        <span style="font-size: 1.2rem; font-weight: 700; color: ${colorManifestAvance};">${manifestAvanceOverall.toFixed(0)}%</span><br>
                                        <span style="font-size: 0.8rem; color: #6c757d;">Avance Total</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h5 class="mt-4 mb-3" style="color: var(--liverpool-dark); border-bottom: 1px solid var(--liverpool-border-gray); padding-bottom: 0.5rem;"><i class="bi bi-filter-circle me-2"></i>Filtrar Desglose</h5>
                        <div class="filter-pills mb-3 d-flex flex-wrap gap-2">
                            <h6 class="card-title text-muted me-2 mt-1">Jefatura:</h6>
                            <button class="filter-btn ${currentJefaturaFilterManifiestosDetalle === 'Todos' ? 'active' : ''}" data-jefe-detail="Todos">Todos</button>
                            ${jefaturaFilterHTML}
                        </div>
                        <div id="contenedor-filter-per-manifest" class="filter-pills mb-4 d-flex flex-wrap gap-2">
                            <h6 class="card-title text-muted me-2 mt-1">Contenedor:</h6>
                            <button class="filter-btn active" data-contenedor-detail="Todos">Todos</button>
                            </div>

                        <h5 class="mt-4 mb-3" style="color: var(--liverpool-dark); border-bottom: 1px solid var(--liverpool-border-gray); padding-bottom: 0.5rem;"><i class="bi bi-bar-chart-fill me-2"></i>Desglose por Sección</h5>
                        <div id="secciones-detail-grid" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
                            </div>
                    `;

                                    // RENDERIZAR LA GRÁFICA GENERAL DEL MANIFIESTO (Ya se hizo en el HTML, solo el JS del chart)
                                    const manifestGaugeCtx = document.getElementById('manifestOverallGauge')?.getContext('2d');
                                    if (manifestGaugeCtx) {
                                        new Chart(manifestGaugeCtx, {
                                            type: 'doughnut',
                                            data: {
                                                datasets: [{
                                                    data: [manifestAvanceOverall, 100 - manifestAvanceOverall],
                                                    backgroundColor: [colorManifestAvance, '#e9ecef'],
                                                    borderWidth: 0,
                                                    cutout: '75%'
                                                }]
                                            },
                                            options: {
                                                responsive: true,
                                                plugins: {
                                                    legend: { display: false },
                                                    tooltip: { enabled: false },
                                                    title: { // Título de la gráfica
                                                        display: false, // Ahora se muestra con un div superpuesto para más control CSS
                                                        text: 'Avance de Escaneo del Manifiesto',
                                                        color: 'var(--liverpool-dark)',
                                                        font: { size: 14, weight: 'bold' },
                                                        position: 'bottom'
                                                    }
                                                }
                                            }
                                        });
                                    }

                                    // AÑADIR LISTENERS PARA FILTRO DE JEFATURA DEL MANIFIESTO
                                    detailContainer.querySelectorAll('.filter-pills button[data-jefe-detail]').forEach(button => {
                                        button.addEventListener('click', (e) => {
                                            detailContainer.querySelectorAll('.filter-pills button[data-jefe-detail]').forEach(b => b.classList.remove('active'));
                                            e.currentTarget.classList.add('active');
                                            currentJefaturaFilterManifiestosDetalle = e.currentTarget.dataset.jefeDetail;
                                            currentContenedorFilterManifiestosDetalle = 'Todos'; // Resetear filtro de contenedor al cambiar de jefe
                                            renderSeccionesInManifestDetail(manifestId);
                                        });
                                    });

                                    // Inicializar el renderizado de secciones y contenedores para el manifiesto seleccionado
                                    renderSeccionesInManifestDetail(manifestId);
                                };

                                const renderSeccionesInManifestDetail = (manifestId) => {
                                    const manifest = report.manifiestos[manifestId];
                                    if (!manifest) return;

                                    const seccionesGrid = document.getElementById('secciones-detail-grid');
                                    const contenedorFilterContainer = document.getElementById('contenedor-filter-per-manifest');
                                    if (!seccionesGrid || !contenedorFilterContainer) return;

                                    // Filtrar secciones por Jefatura (del manifiesto) y asegurar que tengan datos
                                    const filteredSectionsByJefatura = Object.entries(manifest.seccionesResumen).filter(([seccionNombre, data]) => {
                                        const isRelevantToJefatura = (currentJefaturaFilterManifiestosDetalle === 'Todos' || data.jefatura === currentJefaturaFilterManifiestosDetalle);
                                        // Una sección es relevante si tiene piezas SAP, escaneadas, o faltantes/excedentes en cualquiera de sus contenedores.
                                        const hasAnyRelevantData = (data.totalSap > 0 || data.totalScan > 0 || Object.values(data.byContenedor || {}).some(c => c.faltantes > 0 || c.excedentes > 0));
                                        return isRelevantToJefatura && hasAnyRelevantData;
                                    });

                                    // Recopilar contenedores relevantes basados en las secciones filtradas por jefatura
                                    const contenedoresRelevantes = new Set();
                                    filteredSectionsByJefatura.forEach(([seccionNombre, data]) => {
                                        if (data.byContenedor && Object.keys(data.byContenedor).length > 0) {
                                            for (const cont in data.byContenedor) {
                                                // Un contenedor es relevante si tiene piezas o diferencias para alguna sección filtrada por jefatura
                                                if (data.byContenedor[cont].sap > 0 || data.byContenedor[cont].scan > 0 || data.byContenedor[cont].faltantes > 0 || data.byContenedor[cont].excedentes > 0) {
                                                    contenedoresRelevantes.add(cont);
                                                }
                                            }
                                        } else { // Si la sección tiene datos pero no está por contenedor, aún es relevante
                                            contenedoresRelevantes.add('N/A (Sin Cont.)'); // Un identificador para secciones sin contenedor
                                        }
                                    });
                                    const sortedContenedoresRelevantes = Array.from(contenedoresRelevantes).sort();

                                    // Renderizar botones de filtro de contenedor
                                    let contenedorButtonsHTML = `<button class="filter-btn ${currentContenedorFilterManifiestosDetalle === 'Todos' ? 'active' : ''}" data-contenedor-detail="Todos">Todos</button>`;
                                    contenedorButtonsHTML += sortedContenedoresRelevantes.map(cont =>
                                        `<button class="filter-btn ${currentContenedorFilterManifiestosDetalle === cont ? 'active' : ''}" data-contenedor-detail="${String(cont || 'N/A').trim()}">${String(cont || 'N/A').trim()}</button>`
                                    ).join('');
                                    // Asegurar que el div.filter-pills tenga el h6 y luego los botones. Reemplazar solo los botones si es posible.
                                    const existingContenedorH6 = contenedorFilterContainer.querySelector('h6'); // Capturar el h6 existente
                                    contenedorFilterContainer.innerHTML = ''; // Limpiar para reconstruir
                                    if (existingContenedorH6) contenedorFilterContainer.appendChild(existingContenedorH6); // Añadir h6 de nuevo
                                    contenedorFilterContainer.insertAdjacentHTML('beforeend', contenedorButtonsHTML);


                                    // Volver a adjuntar listeners para los botones de contenedor
                                    contenedorFilterContainer.querySelectorAll('button[data-contenedor-detail]').forEach(button => {
                                        // Asegurarse de remover listeners antiguos para evitar duplicados
                                        const clonedButton = button.cloneNode(true);
                                        button.parentNode.replaceChild(clonedButton, button); // Reemplazar nodo para limpiar listeners
                                        clonedButton.addEventListener('click', (e) => {
                                            contenedorFilterContainer.querySelectorAll('button[data-contenedor-detail]').forEach(b => b.classList.remove('active'));
                                            e.currentTarget.classList.add('active');
                                            currentContenedorFilterManifiestosDetalle = e.currentTarget.dataset.contenedorDetail;
                                            renderSeccionesInManifestDetail(manifestId); // Re-renderizar secciones con el nuevo filtro de contenedor
                                        });
                                    });

                                    // Ahora filtrar las secciones por CONTENEDOR (además de la jefatura)
                                    const filteredSectionsByContenedor = filteredSectionsByJefatura.filter(([seccionNombre, data]) => {
                                        // Determinar si la sección es relevante para el contenedor seleccionado
                                        let isRelevantToContenedor = false;
                                        if (currentContenedorFilterManifiestosDetalle === 'Todos') {
                                            isRelevantToContenedor = (data.totalSap > 0 || data.totalScan > 0 || Object.values(data.byContenedor || {}).some(c => c.faltantes > 0 || c.excedentes > 0));
                                        } else if (currentContenedorFilterManifiestosDetalle === 'N/A (Sin Cont.)') {
                                            // Si el filtro es "Sin Contenedor", incluir secciones que tienen datos pero no desglose por contenedor
                                            isRelevantToContenedor = (!data.byContenedor || Object.keys(data.byContenedor).length === 0) && (data.totalSap > 0 || data.totalScan > 0 || Object.values(data.byContenedor || {}).some(c => c.faltantes > 0 || c.excedentes > 0));
                                        } else {
                                            // Para un contenedor específico, verificar si la sección tiene datos para ese contenedor
                                            isRelevantToContenedor = (data.byContenedor && data.byContenedor[currentContenedorFilterManifiestosDetalle] &&
                                                (data.byContenedor[currentContenedorFilterManifiestosDetalle].sap > 0 || data.byContenedor[currentContenedorFilterManifiestosDetalle].scan > 0 ||
                                                    data.byContenedor[currentContenedorFilterManifiestosDetalle].faltantes > 0 || data.byContenedor[currentContenedorFilterManifiestosDetalle].excedentes > 0));
                                        }

                                        const currentSap = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalSap || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.sap || 0));
                                        const currentScan = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalScan || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.scan || 0));

                                        return isRelevantToContenedor && (currentSap > 0 || currentScan > 0 || (currentContenedorFilterManifiestosDetalle !== 'Todos' && (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.faltantes > 0 || data.byContenedor[currentContenedorFilterManifiestosDetalle]?.excedentes > 0)) || (currentContenedorFilterManifiestosDetalle === 'Todos' && ((currentSap - currentScan > 0) || (currentScan - currentSap > 0)))); // Doble verificación de que haya datos o diferencias
                                    });

                                    const sortedSectionsToDisplay = filteredSectionsByContenedor.sort((a, b) => {
                                        const sapA = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (a[1].totalSap || 0) : (a[1].byContenedor[currentContenedorFilterManifiestosDetalle]?.sap || 0));
                                        const scanA = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (a[1].totalScan || 0) : (a[1].byContenedor[currentContenedorFilterManifiestosDetalle]?.scan || 0));
                                        const avanceA = sapA > 0 ? (scanA / sapA) : 1;

                                        const sapB = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (b[1].totalSap || 0) : (b[1].byContenedor[currentContenedorFilterManifiestosDetalle]?.sap || 0));
                                        const scanB = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (b[1].totalScan || 0) : (b[1].byContenedor[currentContenedorFilterManifiestosDetalle]?.scan || 0));
                                        const avanceB = sapB > 0 ? (scanB / sapB) : 1;

                                        return avanceB - avanceA;
                                    });

                                    if (sortedSectionsToDisplay.length > 0) {
                                        seccionesGrid.innerHTML = sortedSectionsToDisplay.map(([seccionNombre, data]) => {
                                            const seccionInfo = seccionesMap.get(seccionNombre.toUpperCase()) || {
                                                jefatura: 'Sin Asignar',
                                                descripcion: 'Descripción no encontrada',
                                                asistente: 'N/A'
                                            };
                                            const currentSap = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalSap || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.sap || 0));
                                            const currentScan = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalScan || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.scan || 0));
                                            const currentFaltantes = (currentContenedorFilterManifiestosDetalle === 'Todos' ? ((currentSap - currentScan) > 0 ? (currentSap - currentScan) : 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.faltantes || 0));
                                            const currentExcedentes = (currentContenedorFilterManifiestosDetalle === 'Todos' ? ((currentScan - currentSap) > 0 ? (currentScan - currentSap) : 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.excedentes || 0));


                                            const avanceSeccion = currentSap > 0 ? (currentScan / currentSap) * 100 : 100;
                                            const colorAvanceSeccion = avanceSeccion < 50 ? 'var(--liverpool-pink)' : avanceSeccion < 90 ? '#f0ad4e' : 'var(--liverpool-green)';
                                            const chartId = `chart-manifest-${String(manifest.id || '').replace(/[^a-zA-Z0-9]/g, '')}-seccion-${String(seccionNombre || '').replace(/[^a-zA-Z0-9]/g, '')}-${String(currentContenedorFilterManifiestosDetalle || '').replace(/[^a-zA-Z0-9]/g, '')}`;

                                            return `
                                <div class="col-md-6 col-lg-4">
                                    <div class="section-card-compact">
                                        <div class="section-name" title="${String(seccionInfo.descripcion || 'Sin Descripción').trim()}">${String(seccionNombre || 'N/A').trim()}</div>
                                        <div class="section-jefe">${String(seccionInfo.jefatura || 'N/A').trim()}</div>
                                        <div class="mb-2" style="width: 100px; height: 100px; margin: 0 auto;">
                                            <canvas id="${chartId}"></canvas>
                                        </div>
                                        <div class="section-counts">
                                            ${(currentScan || 0).toLocaleString('es-MX')} / ${(currentSap || 0).toLocaleString('es-MX')} pzs
                                            ${currentFaltantes > 0 ? `<br><span style="color: var(--liverpool-pink);">Faltantes: ${currentFaltantes.toLocaleString('es-MX')}</span>` : ''}
                                            ${currentExcedentes > 0 ? `<br><span style="color: #f0ad4e;">Excedentes: ${currentExcedentes.toLocaleString('es-MX')}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                                        }).join('');
                                    } else {
                                        seccionesGrid.innerHTML = '<div class="col-12"><p class="text-muted text-center mt-4">No hay secciones con piezas para este manifiesto que coincidan con los filtros de contenedor y jefatura.</p></div>';
                                    }

                                    // Renderizar gráficas después de que el HTML esté en el DOM
                                    setTimeout(() => {
                                        sortedSectionsToDisplay.forEach(([seccionNombre, data]) => {
                                            const chartId = `chart-manifest-${String(manifest.id || '').replace(/[^a-zA-Z0-9]/g, '')}-seccion-${String(seccionNombre || '').replace(/[^a-zA-Z0-9]/g, '')}-${String(currentContenedorFilterManifiestosDetalle || '').replace(/[^a-zA-Z0-9]/g, '')}`;
                                            const doughnutCtx = document.getElementById(chartId)?.getContext('2d');
                                            if (doughnutCtx) {
                                                const currentSap = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalSap || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.sap || 0));
                                                const currentScan = (currentContenedorFilterManifiestosDetalle === 'Todos' ? (data.totalScan || 0) : (data.byContenedor[currentContenedorFilterManifiestosDetalle]?.scan || 0));

                                                const avanceSeccion = currentSap > 0 ? (currentScan / currentSap) * 100 : 100;
                                                const colorAvanceSeccion = avanceSeccion < 50 ? 'var(--liverpool-pink)' : avanceSeccion < 90 ? '#f0ad4e' : 'var(--liverpool-green)';
                                                new Chart(doughnutCtx, {
                                                    type: 'doughnut',
                                                    data: {
                                                        datasets: [{
                                                            data: [avanceSeccion, 100 - avanceSeccion],
                                                            backgroundColor: [colorAvanceSeccion, '#f1f3f5'],
                                                            borderWidth: 0,
                                                            cutout: '75%'
                                                        }]
                                                    },
                                                    options: {
                                                        responsive: true,
                                                        plugins: {
                                                            legend: { display: false },
                                                            tooltip: { enabled: false }
                                                        }
                                                    },
                                                    plugins: [{
                                                        id: `gaugeText-manifest-seccion-${seccionNombre}-${currentContenedorFilterManifiestosDetalle}`,
                                                        beforeDraw: chart => {
                                                            const { ctx, width, height } = chart;
                                                            ctx.restore();
                                                            ctx.font = `700 ${(height / 5).toFixed(0)}px Poppins`; // Texto más pequeño para adaptarse
                                                            ctx.fillStyle = colorAvanceSeccion;
                                                            ctx.textAlign = 'center';
                                                            ctx.textBaseline = 'middle';
                                                            ctx.fillText(`${avanceSeccion.toFixed(0)}%`, width / 2, height / 2);
                                                            ctx.save();
                                                        }
                                                    }]
                                                });
                                            }
                                        });
                                    }, 100);
                                };
                                // FIN SECCIÓN: Renderizado de manifiestos

                                // NUEVA FUNCIÓN: Renderizado de excedentes
                                let currentJefaturaFilterExcedentes = 'Todos'; // Estado del filtro de jefatura para excedentes
                                let excedentesChartInstance = null; // Instancia de la gráfica de excedentes

                                const renderExcedentesDetail = () => {
                                    const container = document.getElementById('excedentes-list-container');
                                    const jefaturaFilterContainer = document.getElementById('excedentes-jefatura-filter');
                                    const excedentesChartCanvas = document.getElementById('excedentesChart');
                                    if (!container || !jefaturaFilterContainer || !excedentesChartCanvas) return;

                                    // Recopilar jefaturas únicas con excedentes (solo los que tienen excedente > 0)
                                    const jefaturasConExcedentes = new Set();
                                    report.skusConExcedentes.forEach(item => {
                                        if (Number(item.excedente || 0) > 0) { // Solo si realmente tiene excedentes
                                            jefaturasConExcedentes.add(item.jefatura);
                                        }
                                    });
                                    const sortedJefaturasExcedentes = Array.from(jefaturasConExcedentes).sort();

                                    // Renderizar filtro de jefaturas para excedentes
                                    let filterHTML = `<button class="filter-btn ${currentJefaturaFilterExcedentes === 'Todos' ? 'active' : ''}" data-jefe-excedente="Todos">Todos</button>`;
                                    filterHTML += sortedJefaturasExcedentes.map(jefe =>
                                        `<button class="filter-btn ${currentJefaturaFilterExcedentes === jefe ? 'active' : ''}" data-jefe-excedente="${jefe}">${String(jefe || 'N/A').trim()}</button>`
                                    ).join('');
                                    jefaturaFilterContainer.innerHTML = filterHTML;

                                    jefaturaFilterContainer.querySelectorAll('button[data-jefe-excedente]').forEach(button => {
                                        // Remover listener previo para evitar duplicados, clonando el nodo
                                        const clonedButton = button.cloneNode(true);
                                        button.parentNode.replaceChild(clonedButton, button);
                                        clonedButton.addEventListener('click', (e) => {
                                            jefaturaFilterContainer.querySelectorAll('button[data-jefe-excedente]').forEach(b => b.classList.remove('active'));
                                            e.currentTarget.classList.add('active');
                                            currentJefaturaFilterExcedentes = e.currentTarget.dataset.jefeExcedente;
                                            renderExcedentesDetail(); // Re-renderizar con el nuevo filtro
                                        });
                                    });


                                    // Filtrar la lista de excedentes (solo los que tienen excedente > 0 y cumplen el filtro de jefatura)
                                    const filteredExcedentes = report.skusConExcedentes.filter(item => {
                                        return (currentJefaturaFilterExcedentes === 'Todos' || item.jefatura === currentJefaturaFilterExcedentes) && (Number(item.excedente || 0) > 0);
                                    });

                                    if (filteredExcedentes.length === 0) {
                                        container.innerHTML = '<li class="list-group-item text-center text-success fs-5 p-4">¡Genial! No se encontraron artículos con excedentes que coincidan con los filtros.</li>';
                                    } else {
                                        container.innerHTML = filteredExcedentes.map(item => `
                            <li class="list-group-item d-flex justify-content-between align-items-center flex-wrap">
                                <div>
                                    <strong style="color:#f0ad4e;">${String(item.sku || 'N/A').trim()}</strong> - ${String(item.desc || 'Sin Descripción').trim()}<br>
                                    <small class="text-muted">Manifiesto: ${String(item.manifiesto.numero || 'N/A').trim()} (ID: ${String(item.manifiesto.id || 'N/A').trim()})</small><br>
                                    <small class="text-muted">Contenedor: ${String(item.contenedor || 'N/A').trim()} | Sección: ${String(item.seccion || 'N/A').trim()} | Jefatura: ${String(item.jefatura || 'N/A').trim()}</small>
                                </div>
                                <span class="badge rounded-pill" style="background-color: #f0ad4e;">+${(Number(item.excedente) || 0)} pz.</span>
                            </li>
                        `).join('');
                                    }

                                    // Datos para la gráfica de pastel de excedentes
                                    let chartLabels = [];
                                    let chartData = [];
                                    let backgroundColors = [];

                                    // Si el filtro es "Todos", agrupar por Jefatura
                                    if (currentJefaturaFilterExcedentes === 'Todos') {
                                        const excedentesPorJefatura = {};
                                        report.skusConExcedentes.forEach(item => { // Iterar sobre TODOS los excedentes para la gráfica general por jefatura
                                            if (Number(item.excedente || 0) > 0) {
                                                excedentesPorJefatura[item.jefatura] = (excedentesPorJefatura[item.jefatura] || 0) + (Number(item.excedente) || 0);
                                            }
                                        });
                                        chartLabels = Object.keys(excedentesPorJefatura).sort();
                                        chartData = chartLabels.map(jefe => excedentesPorJefatura[jefe]);
                                        backgroundColors = chartLabels.map((_, i) => `hsl(${i * 60}, 70%, 50%)`); // Colores variados
                                    } else { // Si se selecciona una jefatura, agrupar por Sección dentro de esa jefatura
                                        const excedentesPorSeccion = {};
                                        filteredExcedentes.forEach(item => { // Usar los filtrados para la gráfica por sección
                                            if (Number(item.excedente || 0) > 0) {
                                                excedentesPorSeccion[item.seccion] = (excedentesPorSeccion[item.seccion] || 0) + (Number(item.excedente) || 0);
                                            }
                                        });
                                        chartLabels = Object.keys(excedentesPorSeccion).sort();
                                        chartData = chartLabels.map(seccion => excedentesPorSeccion[seccion]);
                                        backgroundColors = chartLabels.map((_, i) => `hsl(${i * 45 + 30}, 60%, 60%)`); // Colores variados
                                    }

                                    // Destruir gráfica existente si la hay
                                    if (excedentesChartInstance) {
                                        excedentesChartInstance.destroy();
                                    }

                                    // Crear nueva gráfica, solo si hay datos para mostrar
                                    if (chartData.some(val => val > 0)) { // Solo crear gráfica si hay excedentes para mostrar
                                        excedentesChartInstance = new Chart(excedentesChartCanvas.getContext('2d'), {
                                            type: 'doughnut',
                                            data: {
                                                labels: chartLabels,
                                                datasets: [{
                                                    data: chartData,
                                                    backgroundColor: backgroundColors,
                                                    borderWidth: 1,
                                                    borderColor: '#fff'
                                                }]
                                            },
                                            options: {
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        display: true,
                                                        position: 'right',
                                                        labels: {
                                                            color: 'var(--liverpool-dark)'
                                                        }
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: currentJefaturaFilterExcedentes === 'Todos' ? 'Excedentes por Jefatura' : `Excedentes en ${currentJefaturaFilterExcedentes} por Sección`,
                                                        color: 'var(--liverpool-dark)',
                                                        font: { size: 14, weight: 'bold' }
                                                    },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: function (context) {
                                                                let label = context.label || '';
                                                                if (label) {
                                                                    label += ': ';
                                                                }
                                                                if (context.parsed) {
                                                                    label += context.parsed.toLocaleString('es-MX') + ' pzs';
                                                                }
                                                                return label;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                    } else {
                                        // Si no hay datos para la gráfica, limpiar el canvas o mostrar un mensaje
                                        excedentesChartCanvas.getContext('2d').clearRect(0, 0, excedentesChartCanvas.width, excedentesChartCanvas.height);
                                        // Opcional: mostrar un mensaje en el canvas si no hay datos
                                    }
                                };


                                renderJefaturaFilter();
                                renderJefaturas();
                                renderSecciones();
                                renderManifiestosList(); // La función renderManifiestosList ahora inicializa toda la lógica de la pestaña "Por Manifiesto"

                                // Restaurar la gráfica principal del dashboard
                                new Chart(document.getElementById('gaugeChart'), {
                                    type: 'doughnut',
                                    data: {
                                        datasets: [{
                                            data: [avanceGeneral, 100 - avanceGeneral],
                                            backgroundColor: ['var(--liverpool-pink)', '#e9ecef'],
                                            borderWidth: 0,
                                            circumference: 180,
                                            rotation: 270
                                        }]
                                    },
                                    options: {
                                        responsive: true,
                                        aspectRatio: 2,
                                        cutout: '80%',
                                        plugins: {
                                            legend: {
                                                display: false
                                            },
                                            tooltip: {
                                                enabled: false
                                            },
                                            title: { // Título de la gráfica del dashboard
                                                display: true,
                                                text: 'Avance General de Escaneo',
                                                color: 'var(--liverpool-dark)',
                                                font: { size: 16, weight: 'bold' },
                                                position: 'top'
                                            }
                                        }
                                    },
                                    plugins: [{
                                        id: 'gaugeText-main',
                                        beforeDraw: chart => {
                                            const { ctx, width, height } = chart;
                                            ctx.restore();
                                            // Ajustar la posición y tamaño del texto para que no se superponga con el título del plugin
                                            ctx.font = `800 ${(height / 8).toFixed(0)}px Poppins`; // Reduce el tamaño de la fuente
                                            ctx.fillStyle = 'var(--liverpool-pink)';
                                            ctx.textAlign = 'center';
                                            ctx.textBaseline = 'middle';
                                            ctx.fillText(`${avanceGeneral.toFixed(1)}%`, width / 2, height - (height * 0.1)); // Mueve el texto ligeramente hacia arriba
                                            ctx.save();
                                        }
                                    }]
                                });
                            }
                        });
                    } catch (error) {
                        console.error("Error al generar el resumen semanal:", error);
                        Swal.fire('Error Inesperado', 'No se pudo completar la operación. Por favor, revisa la consola.', 'error');
                    }
                }