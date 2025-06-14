

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

        /***************************************************
         * REFERENCIAS DEL DOM
         ***************************************************/
        const logoutBtn = document.getElementById("logout-btn");
        const userInfoEl = document.getElementById("userInfo");
        const employeeNumberInput = document.getElementById("employeeNumberInput");
        const restoInterfaz = document.getElementById("restoInterfaz");
        const adminUploadSection = document.getElementById("adminUploadSection");
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
        const btnAnalisisGlobal = document.getElementById("btnAnalisisGlobal");
        const downloadSection = document.getElementById("downloadSection");
        const scanEntrySection = document.getElementById("scanEntrySection");
        const inputScanCode = document.getElementById("inputScanCode");
        const btnCerrarContenedor = document.getElementById("btnCerrarContenedor");
        const btnRegistrarManual = document.getElementById("btnRegistrarManual");
        const btnCambiarEmpleado = document.getElementById("btnCambiarEmpleado");
        const btnCambiarContenedor = document.getElementById("btnCambiarContenedor");
        const searchContainerSection = document.getElementById("searchContainerSection");
        const modalDanios = new bootstrap.Modal(document.getElementById("modalDanios"));
        const danioCantidadInput = document.getElementById("danioCantidad");
        const danioFotoInput = document.getElementById("danioFoto");
        const btnGuardarDanio = document.getElementById("btnGuardarDanio");

        /***************************************************
         * AUTH / LOGOUT
         ***************************************************/
         auth.onAuthStateChanged(async (user) => {
  if (!user) {
    Swal.fire({
      icon: "warning",
      title: "No Autenticado",
      html: `<i class="material-icons" style="color:#FFC107;">warning</i> Debes iniciar sesión.`
    }).then(() => window.location.href = "../Login/login.html");
    return;
  }

  currentUser = user;
  // Admin global
  if (user.uid === ADMIN_UID) {
    currentUserStore = "ALL";
    currentUserRole  = "admin";
    adminUploadSection.style.display = "block";
    userInfoEl.textContent = "Usuario: Admin (ALL - admin)";
  } else {
    // Leer datos de Firestore
    const docSnap = await db.collection("usuarios").doc(user.uid).get();
    if (!docSnap.exists) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontró tu registro en "usuarios".`
      }).then(() => window.location.href = "../Login/login.html");
      return;
    }
    const data = docSnap.data();
    // Si no está aprobado
    if ((data.status || "pendiente") !== "aprobado") {
      Swal.fire({
        icon: "info",
        title: "Pendiente",
        html: `<i class="material-icons" style="color:#2196F3;">info</i> Tu cuenta no está aprobada.`
      }).then(() => window.location.href = "../Login/login.html");
      return;
    }
    currentUserStore = data.store || "";
    currentUserRole  = data.role  || "vendedor";

    // *** Aquí el control *** 
    // Solo 'auxiliar' y 'jefe' ven la sección de subir archivos
    if (currentUserRole === "auxiliar" || currentUserRole === "jefe") {
      adminUploadSection.style.display = "block";
    } else {
      adminUploadSection.style.display = "none";
    }

    userInfoEl.textContent = `Usuario: ${data.name} (Tienda: ${currentUserStore}, Rol: ${currentUserRole})`;
  }
});

        logoutBtn.addEventListener("click", () => {
          auth.signOut().then(() => window.location.href = "../Login/login.html")
            .catch(e => console.error(e));
        });

        /***************************************************
         * SECCIÓN: SUBIR ARCHIVO MANIFIESTO + BARRA DE PROGRESO
         ***************************************************/
        // Al hacer clic en la zona de dropzone, abrir selector de archivo
        dropzone.addEventListener('click', () => fileInput.click());

        // Mostrar nombre de archivo seleccionado y habilitar botón
        fileInput.addEventListener('change', () => {
          const file = fileInput.files[0];
          if (!file) return;
          selectedFileNameEl.textContent = file.name;
          uploadFileBtn.disabled = false;
        });

        // Manejar subida con progreso
        uploadFileBtn.addEventListener('click', () => {
          const file = fileInput.files[0];
          if (!file) return;
          uploadFileBtn.disabled = true;
          uploadProgressContainer.style.display = 'block';

          const folder = (currentUserStore === "ALL") ? "ALL" : currentUserStore;
          const storageRef = storage.ref(`Manifiestos/${folder}/${file.name}`);
          const uploadTask = storageRef.put(file);

          uploadTask.on('state_changed',
            snapshot => {
              const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              uploadProgressBar.style.width = percent + '%';
              uploadProgressBar.textContent = percent + '%';
            },
            error => {
              console.error(error);
              Swal.fire({ icon:'error', title:'Error', text:'Error al subir el archivo.' });
              uploadProgressContainer.style.display = 'none';
              uploadFileBtn.disabled = false;
            },
            async () => {
              // Al finalizar, obtener URL y guardar metadatos
// Al subir por primera vez:
await db.collection('manifiestos')
  .doc(file.name)
  .set(
    {
      fileName: file.name,
      store: folder,
      lastUser: currentUser.email || currentUser.uid,
      lastUserStore: (currentUserStore !== undefined) ? currentUserStore : null,
      lastUserRole:  (currentUserRole   !== undefined) ? currentUserRole   : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );



              Swal.fire({ icon:'success', title:'Archivo subido', text: file.name });
              // Resetar barra y campos
              uploadProgressContainer.style.display = 'none';
              uploadProgressBar.style.width = '0%';
              uploadProgressBar.textContent = '0%';
              selectedFileNameEl.textContent = '';
            }
          );
        });

        /***************************************************
         * DETECCIÓN DE EMPLEADO (8 dígitos)
         ***************************************************/
        employeeNumberInput.addEventListener("input", () => {
          let val = employeeNumberInput.value.trim();
          if (val.length === 8) {
            currentEmployeeNumber = val;
            Swal.fire({
              icon: "success",
              title: "Número de empleado",
              html: `<i class="material-icons" style="color:#4CAF50;">how_to_reg</i> Se usará el número: ${currentEmployeeNumber}`,
              timer: 1500,
              showConfirmButton: false
            });
            restoInterfaz.style.display = "block";
            inputScanCode.disabled = false;
          } else {
            restoInterfaz.style.display = "none";
            inputScanCode.disabled = true;
          }
        });
        btnCambiarEmpleado.addEventListener("click", () => {
          Swal.fire({
            title: "Cambiar Número de Empleado",
            input: "text",
            inputLabel: "Ingrese el nuevo número (8 dígitos)",
            inputPlaceholder: "Ej: 87654321",
            inputAttributes: { maxlength: 8, autocapitalize: "off", autocorrect: "off" },
            showCancelButton: true,
            confirmButtonText: `<i class="material-icons">check_circle</i> Cambiar`,
            cancelButtonText: `<i class="material-icons">cancel</i> Cancelar`,
            preConfirm: (value) => {
              if (value.trim().length !== 8) {
                Swal.showValidationMessage("El número debe tener 8 dígitos");
              }
              return value;
            }
          }).then(result => {
            if (result.isConfirmed) {
              currentEmployeeNumber = result.value.trim();
              Swal.fire({
                icon: "success",
                title: "Número actualizado",
                html: `<i class="material-icons" style="color:#4CAF50;">check_circle</i> Ahora se usará el número: ${currentEmployeeNumber}`
              });
            }
          });
        });
   /***************************************************
   * LISTAR / DESCARGAR / ELIMINAR MANIFIESTOS
   ***************************************************/
   const SUPER_ADMINS = [
    "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
    "doxhVo1D3aYQqqkqgRgfJ4qcKcU2"
  ];

  btnVerArchivos.addEventListener("click", listarArchivos);

async function listarArchivos() {
  try {
    const entries = [];
    // Obtener lista de archivos según rol
    if (SUPER_ADMINS.includes(currentUser.uid)) {
      const root = await storage.ref("Manifiestos").listAll();
      for (const prefix of root.prefixes) {
        const lst = await prefix.listAll();
        lst.items.forEach(i => entries.push({ folder: prefix.name, name: i.name }));
      }
    } else {
      const lst = await storage.ref(`Manifiestos/${currentUserStore}`).listAll();
      lst.items.forEach(i => entries.push({ folder: currentUserStore, name: i.name }));
    }

    if (!entries.length) {
      return Swal.fire({
        icon: "info",
        title: "Sin manifiestos",
        text: "No se encontraron archivos para tu tienda.",
        toast: true,
        position: "center",
        timer: 2000
      });
    }

    // Obtener fechas de actualización
    const detailed = await Promise.all(
      entries.map(async e => {
        const doc = await db.collection("manifiestos").doc(e.name).get();
        const updated = doc.exists && doc.data().updatedAt ? doc.data().updatedAt.toDate() : null;
        return { ...e, date: updated, dateStr: updated ? formatFecha(updated) : "–" };
      })
    );

    let currentList = detailed.slice();
    // Ordenar por defecto: recientes primero
    currentList.sort((a, b) => (b.date || 0) - (a.date || 0));

    // Función para generar solo la lista de items en HTML
    function renderItems(list) {
      return list.map(f => `
        <div class="d-flex justify-content-between align-items-center border rounded shadow-sm p-3 mb-3 bg-white"
             style="border-left: 5px solid var(--rosa-principal); border-radius: var(--ios-border-radius);">
          <div style="flex: 1;">
            <div class="fw-semibold text-dark" style="font-size: 1rem;">
              <i class="material-icons align-middle me-1 text-rosa">insert_drive_file</i> ${f.name}
            </div>
            <div class="text-muted small mt-1">
              <i class="material-icons align-middle" style="font-size:1rem;">store</i> ${f.folder} &nbsp;&nbsp;
              <i class="material-icons align-middle" style="font-size:1rem;">date_range</i> ${f.dateStr}
            </div>
          </div>
          <div class="d-flex gap-2 ms-3">
            <button class="btn btn-info btn-circle btn-anim" onclick="verDashboardArchivo('${f.folder}','${f.name}')" title="Ver Dashboard">
              <i class="material-icons">insights</i>
            </button>
            <button class="btn btn-success btn-circle btn-anim" onclick="downloadFile('${f.folder}','${f.name}')" title="Descargar">
              <i class="material-icons">download</i>
            </button>
            ${SUPER_ADMINS.includes(currentUser.uid) ?
              `<button class="btn btn-danger btn-circle btn-anim" onclick="eliminarArchivo('${f.folder}','${f.name}')" title="Eliminar">
                 <i class="material-icons">delete</i>
               </button>` : ``
            }
          </div>
        </div>
      `).join('');
    }

    // Construir contenido del modal
    const htmlHeader = `
      <div style="margin-bottom:10px; display:flex; justify-content:flex-end; gap:8px;">
        <button id="sortRecent" class="btn btn-sm btn-outline-primary">Más recientes</button>
        <button id="sortOld" class="btn btn-sm btn-outline-secondary">Más antiguos</button>
      </div>
      <div id="filesList" style="max-height: 420px; overflow-y: auto; padding-right: 5px;">
        ${renderItems(currentList)}
      </div>
    `;

    Swal.fire({
      title: `<span style="display: flex; align-items: center; gap: 8px;">
                <i class="material-icons" style="color:#E6007E;">folder_open</i> Manifiestos
              </span>`,
      html: htmlHeader,
      width: "650px",
      showCloseButton: true,
      confirmButtonText: "Cerrar",
      customClass: { popup: "swal2-file-list-modal" },
      didOpen: () => {
        const btnRecent = document.getElementById('sortRecent');
        const btnOld = document.getElementById('sortOld');
        const listContainer = document.getElementById('filesList');

        btnRecent.addEventListener('click', () => {
          currentList.sort((a, b) => (b.date || 0) - (a.date || 0));
          listContainer.innerHTML = renderItems(currentList);
        });
        btnOld.addEventListener('click', () => {
          currentList.sort((a, b) => (a.date || 0) - (b.date || 0));
          listContainer.innerHTML = renderItems(currentList);
        });
      }
    });

  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo listar los archivos."
    });
  }
}
window.verDashboardArchivo = async (folder, fileName) => {
  try {
    // Cargar datos si no están en memoria
    if (!excelDataGlobal[fileName]) {
      const url = await storage.ref(`Manifiestos/${folder}/${fileName}`).getDownloadURL();
      const buf = await (await fetch(url)).arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      excelDataGlobal[fileName] = { data };
    }

    const datos = excelDataGlobal[fileName].data;
    const {
      totalSAP,
      totalSCAN,
      faltantes,
      excedentes,
      avance,
      contenedoresFaltantes,
      seccionFaltantes,
      totalSKUs
    } = (() => {
      let tSAP = 0, tSCAN = 0, falt = 0, exc = 0;
      const contF = {}, secF = {};
      datos.forEach(r => {
        const sap = Number(r.SAP) || 0;
        const sc = Number(r.SCANNER) || 0;
        const cont = (r.CONTENEDOR || 'SIN NOMBRE').toUpperCase().trim();
        const sec = (r.SECCION || 'Sin sección').toString().trim();
        tSAP += sap;
        tSCAN += sc;
        if (sc < sap) {
          const diff = sap - sc;
          falt += diff;
          contF[cont] = (contF[cont] || 0) + diff;
          secF[sec] = (secF[sec] || 0) + diff;
        } else if (sc > sap) {
          exc += sc - sap;
        }
      });
      const av = tSAP ? Math.round((tSCAN / tSAP) * 100) : 0;
      return {
        totalSAP: tSAP,
        totalSCAN: tSCAN,
        faltantes: falt,
        excedentes: exc,
        avance: av,
        contenedoresFaltantes: contF,
        seccionFaltantes: secF,
        totalSKUs: datos.length
      };
    })();

    // Mensaje y estilos según avance
    let bgColor = '#fff8e1';
    let msgHTML = `<div style="color:#856404;font-weight:600;margin-bottom:10px;"><i class=\"material-icons\" style=\"vertical-align:middle;\">warning</i> Aún faltan ${100 - avance}% por completar</div>`;
    if (avance === 100) {
      bgColor = '#e8f5e9';
      msgHTML = `<div style="color:#2e7d32;font-weight:700;margin-bottom:10px;"><i class=\"material-icons\" style=\"vertical-align:middle;\">celebration</i> ¡Manifiesto completo! Excelente trabajo 🎉</div>`;
    }

    // Panel de faltantes
    const contKeys = Object.keys(contenedoresFaltantes);
    const secKeys = Object.keys(seccionFaltantes);
    let faltHTML = '';
    if (contKeys.length) {
      faltHTML = `
        <div class="text-center my-3">
          <button id="toggleFaltantesBtn" class="btn btn-sm btn-outline-secondary">Mostrar detalles de faltantes</button>
        </div>
        <div id="faltantesContainer" style="display:none;font-size:.9rem;background:#fafafa;border:1px solid #ddd;border-radius:10px;padding:1rem;">
          <strong>Contenedores con faltantes:</strong>
          <ul style="list-style:none;padding:0;">
            ${contKeys.map(c => `<li>📦 <strong>${c}</strong>: ${contenedoresFaltantes[c]} piezas</li>`).join('')}
          </ul>
          <strong>Secciones con faltantes:</strong>
          <ul style="list-style:none;padding:0;">
            ${secKeys.map(s => `<li>📂 <strong>${s}</strong>: ${seccionFaltantes[s]} piezas</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Construir HTML del dashboard
    const canvasId = `grafico_${fileName}`;
    const dashboardHTML = `
      <div style="background:${bgColor};border-radius:8px;padding:1rem;">
        ${msgHTML}
        <div class="d-flex flex-wrap gap-3 mb-3" style="font-size:.95rem;color:#333;">
          <div><strong>SKUs totales:</strong> ${totalSKUs}</div>
          <div><strong>Esperadas:</strong> ${totalSAP}</div>
          <div><strong>Escaneadas:</strong> ${totalSCAN}</div>
          <div><strong>Faltantes:</strong> ${faltantes}</div>
          <div><strong>Excedentes:</strong> ${excedentes}</div>
        </div>
        <div class="progress mb-2" style="height:20px;border-radius:10px;overflow:hidden;">
          <div class="progress-bar ${avance < 100 ? 'bg-warning' : 'bg-success'}" role="progressbar" style="width:${avance}%;font-weight:600;">${avance}%</div>
        </div>
        <canvas id="${canvasId}" style="width:100%;height:260px;"></canvas>
        ${faltHTML}
      </div>
    `;

    // Mostrar modal y renderizar gráfico
    await Swal.fire({
      html: dashboardHTML,
      width: '700px',
      showCloseButton: true,
      confirmButtonText: 'Cerrar',
      customClass: { popup: 'swal2-dashboard' },
      willOpen: () => {
        // Gráfico donut
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Escaneado', 'Faltante', 'Excedente'],
            datasets: [{
              data: [totalSCAN, faltantes, excedentes],
              backgroundColor: ['#66BB6A', '#EF5350', '#FFEB3B'],
              borderColor: '#fff',
              borderWidth: 2
            }]
          },
          options: {
            plugins: {
              legend: { position: 'bottom', labels: { font: { size: 12 } } },
              tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} piezas` } }
            }
          }
        });
        // Toggle faltantes
        const btn = document.getElementById('toggleFaltantesBtn');
        if (btn) {
          btn.addEventListener('click', () => {
            const panel = document.getElementById('faltantesContainer');
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            btn.textContent = panel.style.display === 'block' ? 'Ocultar detalles de faltantes' : 'Mostrar detalles de faltantes';
          });
        }
      }
    });
  } catch (e) {
    console.error(e);
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el dashboard.' });
  }
};


  // Descargar un manifiesto (con columna DIFERENCIA)
  window.downloadFile = async (folder, name) => {
    try {
      // 1) Cargar o reutilizar datos en memoria
      if (!excelDataGlobal[name]) {
        const url = await storage.ref(`Manifiestos/${folder}/${name}`).getDownloadURL();
        const buf = await (await fetch(url)).arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const js = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        excelDataGlobal[name] = { data: js };
      }
      const data = excelDataGlobal[name].data;

      // 2) Preparar exportación
      const exportData = data.map(r => {
        const sap = Number(r.SAP) || 0;
        const sc = Number(r.SCANNER) || 0;
        let diff = "";
        if (sc === sap) diff = "OK";
        else if (sc < sap) diff = `FALTAN ${sap - sc} piezas`;
        else diff = `+${sc - sap} piezas`;

        return {
          FECHA: formatFecha(new Date(r.FECHA)),
          SECCION: r.SECCION || "",
          MANIFIESTO: r.MANIFIESTO || "",
          CONTENEDOR: r.CONTENEDOR || "",
          SKU: r.SKU || "",
          EUROPEO: r.EUROPEO || "",
          DESCRIPCION: r.DESCRIPCION || "",
          SAP: sap,
          SCANNER: sc,
          LAST_SCANNED_BY: r.LAST_SCANNED_BY || "",
          ENTREGADO_A: r.ENTREGADO_A || "",
          DIFERENCIA: diff,
          FechaEscaneo: formatFecha(new Date(r.FECHA_ESCANEO)),
          CONDICIONES_MCIA: r.DANIO_CANTIDAD || 0,
          FOTO_CONDICIONES: r.DANIO_FOTO_URL || ""
        };
      });

      // 3) Generar y descargar XLSX
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: [
          "FECHA","SECCION","MANIFIESTO","CONTENEDOR","SKU","EUROPEO",
          "DESCRIPCION","SAP","SCANNER","LAST_SCANNED_BY","ENTREGADO_A",
          "DIFERENCIA","FechaEscaneo","CONDICIONES_MCIA","FOTO_CONDICIONES"
        ]
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      Swal.fire({
        icon: "success",
        title: "Descargado",
        toast: true,
        position: "center",
        timer: 1200
      });

    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo descargar." });
    }
  };

  // Eliminar un manifiesto
  window.eliminarArchivo = async (folder, name) => {
    const { isConfirmed } = await Swal.fire({
      title: "Eliminar manifiesto",
      html: `¿Eliminar <strong>${name}</strong>?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!isConfirmed) return;

    try {
      await storage.ref(`Manifiestos/${folder}/${name}`).delete();
      await db.collection("manifiestos").doc(name).delete().catch(()=>{});
      delete excelDataGlobal[name];
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        toast: true,
        position: "center",
        timer: 1200
      });
      listarArchivos();
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar." });
    }
  };

  // Helper: formatea Date a dd/mm/yyyy
  function formatFecha(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

        /***********************************************************
         * CAMBIAR DE CONTENEDOR
         ***********************************************************/
        btnCambiarContenedor.addEventListener("click", () => {
          if (!currentContenedor) {
            Swal.fire({
              icon: "info",
              title: "No hay Contenedor",
              html: `<i class="material-icons" style="color:#2196F3;">info</i> No hay contenedor abierto para cambiar.`
            });
            return;
          }

          const summaryHTML = getContainerSummaryDetailed(currentContainerRecords);
          const containerStatus = getContainerStateFromRecords(currentContainerRecords);
          let colorIcon = "#2196F3";
          if (containerStatus === "INCOMPLETO" || containerStatus === "COMPLETO CON MERCANCÍA DE MÁS") {
            colorIcon = "#F44336";
          } else if (containerStatus === "COMPLETO") {
            colorIcon = "#4CAF50";
          }

          Swal.fire({
            title: `<i class="material-icons" style="vertical-align:middle;color:${colorIcon};">switch_account</i> ¡Cambio de Contenedor!`,
            html: `
              <div style="background: #fff; padding:1rem; border-radius:10px; text-align:left;">
                <h4 style="color:#E6007E; margin-bottom:1rem;">
                  <i class="material-icons">inventory_2</i>
                  Contenedor Actual: <strong>${currentContenedor}</strong>
                </h4>
                <div style="font-size:0.95rem; color:#333; padding:0.5rem; background:#f7f7f7; border-radius:8px;">
                  ${summaryHTML}
                </div>
                <p style="margin-top:1rem; font-weight:600; color:#E6007E;">
                  <i class="material-icons">help_outline</i> ¿Desea cambiar de contenedor?
                </p>
              </div>`,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: `<i class="material-icons">check_circle</i> Sí, cambiar`,
            cancelButtonText: `<i class="material-icons">cancel</i> Cancelar`,
            width: "600px"
          }).then(async (result) => {
            if (!result.isConfirmed) return;

            // Guardar cualquier cambio pendiente antes de cambiar
            try {
              await reuploadFileWithScannerChanges(currentFileName);
            } catch (e) {
              console.error("Error al guardar cambios antes de cambiar contenedor:", e);
            }

            // Resetear estado
            currentContenedor = null;
            currentContainerRecords = [];
            selectedFileToWorkEl.textContent = "";

            // Toast de éxito y reenfocar búsqueda
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Contenedor cambiado',
              timer: 1200,
              showConfirmButton: false
            }).then(() => {
              searchContainerSection.style.display = "block";
              inputBusqueda.focus();
            });
          });
        });

        /***********************************************************
         * BUSCAR CONTENEDOR / SKU
         ***********************************************************/
        inputBusqueda.addEventListener("keyup", () => {
          clearTimeout(debounceTimerBusqueda);
          debounceTimerBusqueda = setTimeout(() => {
            let val = inputBusqueda.value.trim().toUpperCase();
            if (val.length < 5) return;
            if (/^[A-Z]/.test(val)) {
              buscarContenedor(val);
            } else {
              buscarSKUenArchivos(val);
            }
            inputBusqueda.value = "";
          }, 500);
        });
        inputBusqueda.addEventListener("paste", () => {
          setTimeout(() => {
            let val = inputBusqueda.value.trim().toUpperCase();
            if (val.length < 5) return;
            if (/^[A-Z]/.test(val)) {
              buscarContenedor(val);
            } else {
              buscarSKUenArchivos(val);
            }
            inputBusqueda.value = "";
          }, 10);
        });


        async function buscarContenedor(ref) {
  // 1) Obtener todas las coincidencias
  let candidates = await checkFileForReference(null, ref, true);
  if (!candidates) {
    return Swal.fire({
      icon: "info",
      title: "No encontrado",
      html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontró el contenedor.`
    });
  }

  // 2) Agrupar por número de contenedor
  const containersMap = {};
  candidates.forEach(cand => {
    cand.matchedRecords.forEach(rec => {
      const cont = String(rec.CONTENEDOR || "").trim().toUpperCase();
      containersMap[cont] = containersMap[cont] || [];
      containersMap[cont].push({ fileName: cand.fileName, record: rec });
    });
  });

  // 3) Si solo hay uno, abrir directo
  const keys = Object.keys(containersMap);
  if (keys.length === 1) {
    const cont = keys[0];
    const info = containersMap[cont];
    openContainerDirect({
      fileName: info[0].fileName,
      matchedRecords: info.map(i => i.record)
    }, 0);
    return;
  }

  // 4) Construir HTML de la alerta, marcando los cerrados
  let html = `<p>Se encontró el SKU en ${keys.length} contenedores:</p><ul class="list-group">`;
// dentro de buscarContenedor(), en vez de la anterior li:
keys.forEach(cont => {
  const items   = containersMap[cont];
  const file    = items[0].fileName;
  const isClosed = Boolean(excelDataGlobal[file].closedContainers?.[cont]);

  html += `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <i class="material-icons align-middle">inventory_2</i>
        <strong>Contenedor: ${cont}</strong>
        ${isClosed 
          ? `<span class="badge bg-danger ms-2" style="vertical-align:middle;">CERRADO</span>` 
          : ``
        }
        <div><small>Archivo: ${file}</small></div>
      </div>
      <button 
        class="btn btn-sm btn-primary"
        onclick="selectContainer('${cont}')">
        Elegir
      </button>
    </li>`;
});

  html += `</ul>`;

  // 5) Mostrar la alerta
  Swal.fire({
    title: `<i class="material-icons">help_outline</i> Múltiples coincidencias`,
    html,
    icon: "question",
    showConfirmButton: false,
    width: "650px"
  });
}

// Se llama al pulsar “Elegir”
window.selectContainer = function(cont) {
  Swal.close();
  const info = containersMap[cont];
  openContainerDirect({
    fileName: info[0].fileName,
    matchedRecords: info.map(i => i.record)
  }, 0);
};


        async function buscarSKUenArchivos(sku) {
  try {
    let candidates = await checkFileForReference(null, sku, false);
    if (!candidates) {
      return Swal.fire({
        icon: "info",
        title: "No encontrado",
        html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontró el SKU en ningún archivo.`
      });
    }
    if (!Array.isArray(candidates)) candidates = [candidates];

    // Agrupamos por contenedor
    const contMap = {};
    candidates.forEach(cand => {
      cand.matchedRecords.forEach(record => {
        const cont = (record.CONTENEDOR || "").trim().toUpperCase();
        if (!cont) return;
        if (!contMap[cont]) contMap[cont] = { fileName: cand.fileName, records: [] };
        contMap[cont].records.push(record);
      });
    });

    const contKeys = Object.keys(contMap);
    if (contKeys.length === 0) {
      return Swal.fire({
        icon: "info",
        title: "No encontrado",
        html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontró el SKU en ningún contenedor.`
      });
    }
    // Si solo hay uno, abrimos directo
    if (contKeys.length === 1) {
      const { fileName, records } = contMap[contKeys[0]];
      return openContainerDirect({ fileName, matchedRecords: records }, 0);
    }

    // Construimos la lista mostrando el SAP del primer registro
    let html = `<p>Se encontró el SKU en <strong>${contKeys.length}</strong> contenedores:</p>
                <ul class="list-group">`;

    contKeys.forEach(cont => {
      const { fileName, records } = contMap[cont];
      // Fecha más reciente
      const fechas = records.map(r => new Date(r.FECHA));
      const fechaMax = fechas.length
        ? new Date(Math.max(...fechas))
        : null;
      const fechaStr = fechaMax ? formatFecha(fechaMax) : "–";
      // Sacamos SAP del primer registro
      const cantidadSAP = Number(records[0].SAP) || 0;

      html += `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <i class="material-icons align-middle">inventory_2</i>
          <strong>Contenedor:</strong> ${cont}<br>
          <small>
            Archivo: ${fileName} |
            SAP: ${cantidadSAP} |
            Fecha última: ${fechaStr}
          </small>
        </div>
        <button class="btn btn-primary btn-sm btn-anim"
                onclick="selectSKUContainer('${fileName}','${cont}')">
          <i class="material-icons">check</i> Elegir
        </button>
      </li>`;
    });

    html += `</ul>`;
    window.skuContainerMap = contMap;

    Swal.fire({
      title: "Múltiples coincidencias",
      html,
      icon: "question",
      showConfirmButton: false,
      allowOutsideClick: false,
      width: "650px"
    });

  } catch (err) {
    console.error(err);
    Swal.fire({ icon: "error", title: "Error", text: "Ocurrió un problema al buscar el SKU." });
  }
}

// Al elegir: cerramos la alerta y abrimos el contenedor
window.selectSKUContainer = function(fileName, cont) {
  Swal.close();  
  const map = window.skuContainerMap || {};
  const recs = map[cont]?.records;
  if (!recs) return;
  openContainerDirect({ fileName, matchedRecords: recs }, 0);
};

        window.chooseCandidateRecordCustom = function(fileName, recordIndex) {
          let candidate = window.candidatesForSKU.find(item => item.fileName === fileName);
          Swal.close();
          openContainerDirect(candidate, recordIndex);
        };

        async function checkFileForReference(folderName, code, isContainer = false) {
          let finalFiles = [];
          let storeFolder = (currentUserStore === "ALL") ? "ALL" : currentUserStore;
          if (!folderName) {
            if (!allFilesList) {
              allFilesList = [];
              if (storeFolder === "ALL") {
                let root = await storage.ref("Manifiestos").listAll();
                for (const folderRef of root.prefixes) {
                  let stName = folderRef.name;
                  let storeFiles = await folderRef.listAll();
                  for (const itemRef of storeFiles.items) {
                    allFilesList.push({ folderName: stName, ref: itemRef });
                  }
                }
              } else {
                let storeFiles = await storage.ref(`Manifiestos/${storeFolder}`).listAll();
                for (const itemRef of storeFiles.items) {
                  allFilesList.push({ folderName: storeFolder, ref: itemRef });
                }
              }
            }
            finalFiles = allFilesList;
          }
          let foundCandidates = [];
          for (const f of finalFiles) {
            let fileName = f.ref.name;
            if (!excelDataGlobal[fileName]) {
              let url = await storage.ref(`Manifiestos/${f.folderName}/${fileName}`).getDownloadURL();
              let arrBuff = await (await fetch(url)).arrayBuffer();
              let wb = XLSX.read(arrBuff, { type: "array", cellDates: true });
              let sheet = wb.SheetNames[0];
              let dataJson = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
              let docSnap = await db.collection("manifiestos").doc(fileName).get();
              let lastUserDoc = "", lastUserStore = "", lastUserRole = "", uploadedAt = null;
              let closedContainers = {};
              if (docSnap.exists) {
                let docData = docSnap.data();
                lastUserDoc = docData.lastUser || "";
                lastUserStore = docData.lastUserStore || "";
                lastUserRole = docData.lastUserRole || "";
                closedContainers = docData.closedContainers || {};
                uploadedAt = docData.updatedAt ? docData.updatedAt.toDate() : null;
              }
              excelDataGlobal[fileName] = {
                data: dataJson,
                lastUser: lastUserDoc,
                lastUserStore,
                lastUserRole,
                closedContainers,
                uploadedAt
              };
            }
            let arr = excelDataGlobal[fileName].data;
            let sr = code.toUpperCase();
            let matched = arr.filter(r => {
              let cont = String(r.CONTENEDOR || "").trim().toUpperCase();
              let sku = String(r.SKU || "").trim().toUpperCase();
              return (cont.includes(sr) || sku.includes(sr));
            });
            if (matched.length > 0) {
              foundCandidates.push({
                folderName: f.folderName,
                fileName,
                matchedRecords: matched
              });
            }
          }
          if (foundCandidates.length === 0) return null;
          return foundCandidates;
        }

        function openContainerDirect(candidate, recordIndex = 0) {
          currentFileName = candidate.fileName;
          let cont = String(candidate.matchedRecords[recordIndex]?.CONTENEDOR || "").trim().toUpperCase();
          realOpenFileManifiesto(currentFileName, cont);
        }

        function realOpenFileManifiesto(fileName, cont) {
          if (!excelDataGlobal[fileName]) {
            Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No se encontró el archivo ${fileName}`
            });
            return;
          }
          adminUploadSection.style.display = "none";
          searchContainerSection.style.display = "none";
          currentContenedor = cont;
          let dataObj = excelDataGlobal[fileName];
          let arr = dataObj.data;
          let matched = arr.filter(r => String(r.CONTENEDOR || "").trim().toUpperCase() === cont);
          if (matched.length === 0) {
            Swal.fire({
              icon: "info",
              title: "Sin registros",
              html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontraron registros para el contenedor ${cont}`
            });
            return;
          }
          currentContainerRecords = matched;
          if (selectedFileToWorkEl) selectedFileToWorkEl.textContent = fileName;
          currentFileName = fileName;
          let closedBy = dataObj.closedContainers && dataObj.closedContainers[cont] ? dataObj.closedContainers[cont] : "";
          if (closedBy) {
            lastUserUpdateEl.textContent = `Contenedor ${cont} cerrado por: ${closedBy}`;
            inputScanCode.disabled = true;
            btnCerrarContenedor.innerHTML = `<i class="material-icons" style="vertical-align:middle;">lock_open</i> Abrir Contenedor`;
          } else {
            let lastU = dataObj.lastUser || "Desconocido";
            let store = dataObj.lastUserStore || "?";
            let role = dataObj.lastUserRole || "?";
            lastUserUpdateEl.textContent = `Último cambio por: ${lastU} (Tienda: ${store}, Rol: ${role})`;
            inputScanCode.disabled = (currentEmployeeNumber === "");
            btnCerrarContenedor.innerHTML = `<i class="material-icons" style="vertical-align:middle;">lock</i> Cerrar Contenedor`;
          }
          containerResultsSection.style.display = "block";
          scanEntrySection.style.display = "block";

          // Mostrar sección de descarga también a vendedores
          if (
            currentUser &&
            (
              currentUser.uid === ADMIN_UID ||
              ["admin", "jefe", "auxiliar", "vendedor"].includes(currentUserRole)
            )
          ) {
            downloadSection.style.display = "block";
          } else {
            downloadSection.style.display = "none";
          }

          document.getElementById("containerHeader").innerHTML = `<i class="material-icons" style="vertical-align:middle;">inventory_2</i> Detalles del Contenedor (${cont})`;
          mostrarDetallesContenedor(currentContainerRecords);
          inputScanCode.focus();
        }

        /***********************************************************
         * CERRAR / REABRIR CONTENEDOR
         ***********************************************************/
        btnCerrarContenedor.addEventListener("click", async () => {
          let fn = selectedFileToWorkEl.textContent;
          if (!fn || !excelDataGlobal[fn]) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay contenedor abierto.`
            });
          }
          if (!currentContenedor) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay contenedor seleccionado.`
            });
          }
          let dataObj = excelDataGlobal[fn];
          if (dataObj.closedContainers && dataObj.closedContainers[currentContenedor]) {
            const { isConfirmed } = await Swal.fire({
              title: `<i class="material-icons" style="vertical-align:middle;color:#4CAF50;">lock_open</i> Reabrir Contenedor`,
              html: `<p>El contenedor <strong>${currentContenedor}</strong> fue cerrado por: <span style="color:var(--rosa-principal);">${dataObj.closedContainers[currentContenedor]}</span>.</p>
                     <p style="color:#666;">Se abrirá para registrar solo mercancía faltante. Se cerrará al cambiar de contenedor o recargar.</p>`,
              icon: "question",
              showCancelButton: true,
              confirmButtonText: `<i class="material-icons" style="vertical-align:middle;">check_circle</i> Reabrir`,
              cancelButtonText: `<i class="material-icons" style="vertical-align:middle;">cancel</i> Cancelar`,
              width: "600px"
            });
            if (!isConfirmed) return;
            delete dataObj.closedContainers[currentContenedor];
            excelDataGlobal[fn] = dataObj;
            await reuploadFileWithScannerChanges(fn);
            Swal.fire({
              icon: "success",
              title: "Reabierto",
              html: `<i class="material-icons" style="vertical-align:middle;color:#4CAF50;">lock_open</i> Contenedor ${currentContenedor} reabierto.`
            });
            inputScanCode.disabled = false;
            btnCerrarContenedor.innerHTML = `<i class="material-icons" style="vertical-align:middle;">lock</i> Cerrar Contenedor`;
            return;
          }
          let summary = getContainerSummaryDetailed(currentContainerRecords);
          const { isConfirmed } = await Swal.fire({
            title: `<i class="material-icons" style="vertical-align:middle;color:#F44336;">lock</i> Cerrar Contenedor`,
            html: `<div style="text-align:left;">
                     <h5 style="margin-bottom:10px;">
                       <i class="material-icons" style="vertical-align:middle;">inventory_2</i>
                       Contenedor: <span style="color:var(--rosa-principal);">${currentContenedor}</span>
                     </h5>
                     ${summary}
                   </div>
                   <br>
                   <p style="font-size:16px;">¿Desea cerrar este contenedor? Podrá reabrirlo luego.</p>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: `<i class="material-icons" style="vertical-align:middle;">lock</i> Cerrar`,
            cancelButtonText: `<i class="material-icons" style="vertical-align:middle;">cancel</i> Cancelar`,
            width: "650px"
          });
          if (!isConfirmed) return;
          if (!dataObj.closedContainers) dataObj.closedContainers = {};
          dataObj.closedContainers[currentContenedor] = currentUser.email || currentUser.uid;
          excelDataGlobal[fn] = dataObj;
          await reuploadFileWithScannerChanges(fn);
          Swal.fire({
            icon: "success",
            title: "Contenedor cerrado",
            html: `<i class="material-icons" style="vertical-align:middle;color:#4CAF50;">lock</i> Contenedor ${currentContenedor} cerrado por: ${dataObj.closedContainers[currentContenedor]}`
          });
          inputScanCode.disabled = true;
          btnCerrarContenedor.innerHTML = `<i class="material-icons" style="vertical-align:middle;">lock_open</i> Abrir Contenedor`;
          Swal.fire({
            title: `<i class="material-icons" style="vertical-align:middle;">info</i> Estado del Contenedor ${currentContenedor}`,
            html: summary,
            icon: "info",
            confirmButtonText: "OK",
            width: "600px"
          });
        });

        /***********************************************************
         * REGISTRO DE PIEZAS (SCAN)
         ***********************************************************/
        inputScanCode.addEventListener("keyup", () => {
          clearTimeout(debounceTimerScan);
          debounceTimerScan = setTimeout(() => {
            let val = inputScanCode.value.trim().toUpperCase();
            if (val && ((val.length >= 5 && val.length <= 10) || (val.length >= 12))) {
              handleScanCode(val);
              inputScanCode.value = "";
            }
          }, 2000);
        });
        inputScanCode.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            clearTimeout(debounceTimerScan);
            let val = inputScanCode.value.trim().toUpperCase();
            if (val && ((val.length >= 5 && val.length <= 10) || (val.length >= 12))) {
              handleScanCode(val);
              inputScanCode.value = "";
            }
          }
        });
        inputScanCode.addEventListener("paste", () => {
          setTimeout(() => {
            let val = inputScanCode.value.trim().toUpperCase();
            if (val && ((val.length >= 5 && val.length <= 10) || (val.length >= 12))) {
              handleScanCode(val);
              inputScanCode.value = "";
            }
          }, 10);
        });
        function handleScanCode(code) {
          if (!currentEmployeeNumber || employeeNumberInput.value.trim().length !== 8) {
            return Swal.fire({
              icon: "warning",
              title: "Número de Empleado",
              html: `<i class="material-icons" style="color:#FFC107;">badge</i> Debe ingresar 8 dígitos.`
            });
          }
          if (!currentContenedor || !currentContainerRecords.length) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay contenedor abierto.`
            });
          }
          let fn = selectedFileToWorkEl.textContent;
          if (!fn || !excelDataGlobal[fn]) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay un archivo abierto.`
            });
          }
          let dataObj = excelDataGlobal[fn];
          if (dataObj.closedContainers && dataObj.closedContainers[currentContenedor]) {
            return Swal.fire({
              icon: "error",
              title: "Contenedor Cerrado",
              html: `<i class="material-icons" style="color:#F44336;">lock</i> El contenedor está cerrado y no se puede editar.`
            });
          }
          let matchingRows = currentContainerRecords.filter(r => {
            let cont = String(r.CONTENEDOR || "").trim().toUpperCase();
            let sku = String(r.SKU || "").trim().toUpperCase();
            let euro = String(r.EUROPEO || "").trim().toUpperCase();
            return (cont.includes(code) || sku.includes(code) || euro.includes(code));
          });
          if (matchingRows.length === 0) {
            Swal.fire({
              icon: "question",
              title: "Artículo inexistente",
              html: `<i class="material-icons" style="color:#9C27B0;">help_outline</i> El artículo <strong>${code}</strong> no existe en este contenedor.<br>¿Desea añadirlo con SAP=0?`,
              showCancelButton: true,
              confirmButtonText: `<i class="material-icons">add_box</i> Sí, añadir`,
              cancelButtonText: `<i class="material-icons">cancel</i> No`
            }).then(async result => {
              if (!result.isConfirmed) return;
              let fechaActual = new Date();
              let newRow = {
                FECHA: fechaActual,
                SECCION: "",
                MANIFIESTO: "",
                CONTENEDOR: currentContenedor,
                SKU: code,
                EUROPEO: "",
                DESCRIPCION: "(artículo añadido manualmente)",
                SAP: 0,
                SCANNER: 1,
                ENTREGADO_A: currentEmployeeNumber,
                LAST_SCANNED_BY: currentUser.email || currentUser.uid,
                FECHA_ESCANEO: fechaActual,
                DANIO_CANTIDAD: 0,
                DANIO_FOTO_URL: ""
              };
              dataObj.data.push(newRow);
              dataObj.lastUser = currentUser.email || currentUser.uid;
              excelDataGlobal[fn] = dataObj;
              await reuploadFileWithScannerChanges(fn);
              currentContainerRecords = dataObj.data.filter(rr => String(rr.CONTENEDOR||"").toUpperCase()===currentContenedor);
              mostrarDetallesContenedor(currentContainerRecords);
              Swal.fire({
                icon: "success",
                title: "Artículo añadido",
                html: `<i class="material-icons" style="color:#4CAF50;">check_circle</i> Se añadió ${code} al contenedor.`
              });
            });
          } else if (matchingRows.length === 1) {
            incrementRow(matchingRows[0], code);
          } else {
            let html = `<p>Se encontraron múltiples registros para el código <strong>${code}</strong>:</p><ul class='list-group'>`;
            matchingRows.forEach((row, idx) => {
              let sku = String(row.SKU || "");
              html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                         <div>
                           <strong>SKU:</strong> ${sku}<br>
                           <small>${row.DESCRIPCION || ""}</small>
                         </div>
                         <button class="btn btn-primary btn-sm btn-anim" onclick="chooseRow(${idx})">
                           <i class="material-icons">check</i> Seleccionar
                         </button>
                       </li>`;
            });
            html += "</ul>";
            Swal.fire({
              title: "Seleccione Registro",
              html,
              showConfirmButton: false,
              width: "650px"
            });
            window.chooseRow = function (index) {
              Swal.close();
              incrementRow(matchingRows[index], code);
            };
          }
        }

        // **MODIFICACIÓN**: En vez de reescribir el XLSX en cada escaneo,
        // solo actualizamos la interfaz y dejamos el reupload para el cierre.
/***********************************************************
 * incrementRow (ahora asigna FECHA_ESCANEO correctamente)
 ***********************************************************/
 function incrementRow(rowObj, code) {
  const now = new Date();

  // Incrementar contador y asignar metadatos
  rowObj.SCANNER         = (rowObj.SCANNER || 0) + 1;
  rowObj.LAST_SCANNED_BY = currentUser.email || currentUser.uid;
  rowObj.FECHA_ESCANEO   = now;                     // ← asignación de fecha de escaneo

  if (!rowObj.ENTREGADO_A) {
    rowObj.ENTREGADO_A = currentEmployeeNumber;
  }

  // Actualizar último usuario en memoria
  const dataObj = excelDataGlobal[currentFileName];
  dataObj.lastUser = rowObj.LAST_SCANNED_BY;
  excelDataGlobal[currentFileName] = dataObj;

  // Refrescar UI
  currentContainerRecords = dataObj.data.filter(x =>
    String(x.CONTENEDOR || "").trim().toUpperCase() === currentContenedor
  );
  mostrarDetallesContenedor(currentContainerRecords);

  // Toast de confirmación
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
        /***********************************************************
         * MOSTRAR DETALLES EN TABLA (mejoradas columnas)
         ***********************************************************/
        function mostrarDetallesContenedor(registros) {
          containerDetailsEl.innerHTML = "";
          if (!registros || registros.length === 0) return;

          let headers = [
            "Fecha", "Sección", "Manifiesto", "Contenedor", "SKU", "Europeo",
            "Descripción", "SAP", "SCANNER", "Diferencia", "Fecha de Escaneo",
            "Condiciones de la Mcia", "FOTO DAÑOS", "Acciones"
          ];
          let table = document.createElement("table");
          table.className = "table table-bordered table-striped table-hover animate__animated animate__fadeInUp";
          table.style.borderRadius = "var(--ios-border-radius)";
          table.style.overflow = "hidden";

          let thead = document.createElement("thead");
          let trHead = document.createElement("tr");
          headers.forEach(h => {
            let th = document.createElement("th");
            th.textContent = h;
            trHead.appendChild(th);
          });
          thead.appendChild(trHead);
          table.appendChild(thead);

          let tbody = document.createElement("tbody");
          registros.forEach(r => {
            let tr = document.createElement("tr");
            let fecha = r.FECHA ? formatFecha(r.FECHA) : "";
            let seccion = r.SECCION || "";
            let manifiesto = r.MANIFIESTO || "";
            let contenedor = r.CONTENEDOR || "";
            let sku = String(r.SKU || "");
            let europeo = String(r.EUROPEO || "");
            let descripcion = r.DESCRIPCION || "";
            let SAP = r.SAP || 0;
            let SCANNER = r.SCANNER || 0;
            let diff = "";
            if (SCANNER === SAP) {
              diff = "OK";
            } else if (SCANNER < SAP) {
              diff = `FALTAN ${SAP - SCANNER} piezas`;
            } else {
              diff = `OK CON MERCANCÍA DE MÁS: ${SCANNER - SAP} piezas`;
            }
            let fechaEscaneo = r.FECHA_ESCANEO ? formatFecha(r.FECHA_ESCANEO) : "";
            let danioCantidad = r.DANIO_CANTIDAD || 0;
            let danioFotoURL = r.DANIO_FOTO_URL || "";

            // Columnas de datos
            const vals = [fecha, seccion, manifiesto, contenedor, sku, europeo, descripcion, SAP, SCANNER, diff, fechaEscaneo];
            vals.forEach((val, i) => {
              let td = document.createElement("td");
              td.textContent = val;
              // color en Diferencia
              if (headers[i] === "Diferencia") {
                if (diff === "OK") {
                  td.style.backgroundColor = "#66BB6A"; td.style.color = "#FFF";
                } else if (diff.startsWith("FALTAN")) {
                  td.style.backgroundColor = "#F44336"; td.style.color = "#FFF";
                } else {
                  td.style.backgroundColor = "#FFEB3B"; td.style.color = "#000";
                }
              }
              tr.appendChild(td);
            });

            // Columna: Condiciones de la Mcia
            let tdCond = document.createElement("td");
            tdCond.innerHTML = danioCantidad > 0
              ? `<button class="btn btn-warning btn-circle btn-anim btnDanio" data-sku="${sku.toUpperCase()}" title="Condiciones">
                   <i class="material-icons">warning</i>
                   <span class="badge bg-white text-warning">${danioCantidad}</span>
                 </button>`
              : `<button class="btn btn-outline-warning btn-circle btn-anim btnDanio" data-sku="${sku.toUpperCase()}" title="Condiciones">
                   <i class="material-icons">warning</i>
                 </button>`;
            tr.appendChild(tdCond);

            // Columna: FOTO DAÑOS
            let tdFoto = document.createElement("td");
            tdFoto.innerHTML = danioFotoURL
              ? `<button class="btn btn-info btn-circle btn-anim btnFoto" data-url="${danioFotoURL}" title="Ver foto">
                   <i class="material-icons">image</i>
                 </button>`
              : `<span class="text-muted">-</span>`;
            tr.appendChild(tdFoto);

            // Columna: Acciones (restar una pieza)
            let tdAcc = document.createElement("td");
            tdAcc.innerHTML = `<button class="btn btn-danger btn-circle btn-anim removeOneBtn" data-sku="${sku.toUpperCase()}" title="Restar 1 pieza">
                                 <i class="material-icons">remove</i>
                               </button>`;
            tr.appendChild(tdAcc);

            tbody.appendChild(tr);
          });

          table.appendChild(tbody);
          containerDetailsEl.appendChild(table);

          // Eventos: btnDanio abre modal condiciones
          containerDetailsEl.querySelectorAll(".btnDanio").forEach(btn => {
            btn.addEventListener("click", () => {
              currentDanioSKU = btn.dataset.sku || "";
              danioCantidadInput.value = "1";
              danioFotoInput.value = "";
              modalDanios.show();
            });
          });

          // Eventos: btnFoto abre foto en nueva pestaña
          containerDetailsEl.querySelectorAll(".btnFoto").forEach(btn => {
            btn.addEventListener("click", () => {
              const url = btn.dataset.url;
              window.open(url, "_blank");
            });
          });

          // Eventos: removeOneBtn decrementa rápido con toast y persistencia en background
          containerDetailsEl.querySelectorAll(".removeOneBtn").forEach(btn => {
            btn.addEventListener("click", () => {
              const sku = btn.dataset.sku;
              const fn  = selectedFileToWorkEl.textContent;
              const dataObj = excelDataGlobal[fn];
              const rowObj  = dataObj.data.find(x =>
                String(x.SKU||"").trim().toUpperCase()===sku &&
                String(x.CONTENEDOR||"").trim().toUpperCase()===currentContenedor
              );
              if (!rowObj || (rowObj.SCANNER||0)===0) return;

              // Actualizar en memoria
              rowObj.SCANNER -= 1;
              rowObj.LAST_SCANNED_BY = currentUser.email||currentUser.uid;
              dataObj.lastUser = rowObj.LAST_SCANNED_BY;
              excelDataGlobal[fn] = dataObj;

              // Refrescar UI
              currentContainerRecords = dataObj.data.filter(z =>
                String(z.CONTENEDOR||"").trim().toUpperCase()===currentContenedor
              );
              mostrarDetallesContenedor(currentContainerRecords);

              // Persistir en background
              reuploadFileWithScannerChanges(fn).catch(e=>console.error(e));

              // Toast rápido
              Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: `-1 ${sku}`,
                showConfirmButton: false,
                timer: 1200,
                timerProgressBar: true
              });
            });
          });
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
          let fn = selectedFileToWorkEl.textContent;
          let dataObj = excelDataGlobal[fn];
          let arr = dataObj.data;
          let rowObj = arr.find(r => {
            let s = String(r.SKU || "").trim().toUpperCase();
            return s === currentDanioSKU && String(r.CONTENEDOR || "").toUpperCase() === currentContenedor;
          });
          if (!rowObj) {
            return Swal.fire({
              icon: "info",
              title: "No encontrado",
              html: `<i class="material-icons" style="color:#2196F3;">info</i> No se encontró el SKU en el contenedor.`
            });
          }
          rowObj.DANIO_CANTIDAD = cant;
          let file = danioFotoInput.files[0];
          if (file) {
            Swal.fire({ title: "Subiendo foto...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            let safeSKU = currentDanioSKU.replace(/[^a-zA-Z0-9]/g, '_');
            let ts = Date.now();
            let filePath = `Evidencias/${fn}/${currentContenedor}/${safeSKU}_${ts}.jpg`;
            let ref = storage.ref(filePath);
            let snap = await ref.put(file);
            rowObj.DANIO_FOTO_URL = await snap.ref.getDownloadURL();
          }
          rowObj.LAST_SCANNED_BY = currentUser.email || currentUser.uid;
          dataObj.lastUser = rowObj.LAST_SCANNED_BY;
          excelDataGlobal[fn] = dataObj;
          try {
            await reuploadFileWithScannerChanges(fn);
            currentContainerRecords = arr.filter(z =>
              String(z.CONTENEDOR || "").toUpperCase() === currentContenedor
            );
            mostrarDetallesContenedor(currentContainerRecords);
            Swal.fire({
              icon: "success",
              title: "Condiciones registradas",
              html: `<i class="material-icons" style="color:#4CAF50;">check_circle</i> Se guardó la información.`
            });
            modalDanios.hide();
          } catch (e) {
            console.error(e);
            Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No se pudo subir la info de condiciones.`
            });
          }
        });

        /***********************************************************
         * DESCARGAR ARCHIVO
         ***********************************************************/
        document.getElementById("btnDescargarArchivo").addEventListener("click", () => {
          let fn = selectedFileToWorkEl.textContent;
          if (!fn || !excelDataGlobal[fn]) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay archivo para descargar.`
            });
          }
          descargarArchivoTotal(fn);
        });
        function descargarArchivoTotal(fileName) {
          let dataObj = excelDataGlobal[fileName];
          if (!dataObj || !dataObj.data) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay datos para descargar.`
            });
          }
          let arr = dataObj.data.slice();
          arr.sort((a, b) => {
            let ca = String(a.CONTENEDOR || "").trim().toUpperCase();
            let cb = String(b.CONTENEDOR || "").trim().toUpperCase();
            if (ca < cb) return -1;
            if (ca > cb) return 1;
            return String(a.SKU||"").localeCompare(String(b.SKU||""));
          });
          arr = arr.map(r => {
            if (r.SCANNER > 0) r.ENTREGADO_A = r.ENTREGADO_A || currentEmployeeNumber;
            return r;
          });
          let exportData = arr.map(r => {
            let SAP = r.SAP || 0;
            let SCANNER = r.SCANNER || 0;
            let diff = (SCANNER === SAP) ? "OK"
                     : (SCANNER < SAP) ? `FALTAN ${SAP - SCANNER} piezas`
                     : `MERCANCIA DE MAS: ${SCANNER - SAP} piezas`;
            return {
              FECHA: formatFecha(r.FECHA),
              SECCION: r.SECCION || "",
              MANIFIESTO: r.MANIFIESTO || "",
              CONTENEDOR: r.CONTENEDOR || "",
              SKU: r.SKU || "",
              EUROPEO: r.EUROPEO || "",
              DESCRIPCION: r.DESCRIPCION || "",
              SAP,
              SCANNER,
              LAST_SCANNED_BY: r.LAST_SCANNED_BY || "",
              ENTREGADO_A: r.ENTREGADO_A || "",
              DIFERENCIA: diff,
              "Fecha de Escaneo": r.FECHA_ESCANEO ? formatFecha(r.FECHA_ESCANEO) : "",
              "CONDICIONES_MCIA": r.DANIO_CANTIDAD || 0,
              "FOTO_CONDICIONES": r.DANIO_FOTO_URL || ""
            };
          });
          let ws = XLSX.utils.json_to_sheet(exportData, {
            header: [
              "FECHA","SECCION","MANIFIESTO","CONTENEDOR","SKU","EUROPEO",
              "DESCRIPCION","SAP","SCANNER","LAST_SCANNED_BY","ENTREGADO_A",
              "DIFERENCIA","Fecha de Escaneo","CONDICIONES_MCIA","FOTO_CONDICIONES"
            ]
          });
          let wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          let wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
          let blob = new Blob([wbout], { type: "application/octet-stream" });
          let url = URL.createObjectURL(blob);
          let a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          Swal.fire({
            icon: "success",
            title: "Descargado",
            html: `<i class="material-icons" style="color:#4CAF50;">check_circle</i> Archivo descargado.`
          });
        }

        /***********************************************************
         * ANÁLISIS GLOBAL
         ***********************************************************/
        btnAnalisisGlobal.addEventListener("click", () => {
          let fn = selectedFileToWorkEl.textContent;
          if (!fn || !excelDataGlobal[fn]) {
            return Swal.fire({
              icon: "error",
              title: "Error",
              html: `<i class="material-icons" style="color:#F44336;">error</i> No hay registros para analizar.`
            });
          }
          let data = excelDataGlobal[fn].data;
          let closed = excelDataGlobal[fn].closedContainers || {};
          let secciones = Array.from(new Set(data.map(r => String(r.SECCION || "").trim().toUpperCase()))).filter(s => s);
          let selectHTML = '<label class="form-label"><strong>Filtrar por Sección:</strong></label><select class="form-select" id="selectSeccion"><option value="">(Todas)</option>';
          secciones.forEach(sec => {
            selectHTML += `<option value="${sec}">${sec}</option>`;
          });
          selectHTML += '</select>';
          let inputContHTML = '<input type="text" id="analysisSearchContInput" class="form-control mt-2" placeholder="Buscar Contenedor...">';
          let containerHTML = `<div class="global-analysis-content" id="analysisContainer">${getContainerAnalysis(data, closed)}</div>`;
          Swal.fire({
            title: `<i class="material-icons" style="vertical-align:middle;">analytics</i> Análisis Global`,
            html: `<div>${selectHTML}${inputContHTML}</div>${containerHTML}`,
            icon: "info",
            confirmButtonText: "Cerrar",
            width: "600px",
            customClass: { popup: "swal2-popup global-analysis" }
          });
          setTimeout(() => {
            let sel = document.getElementById("selectSeccion");
            let cont = document.getElementById("analysisContainer");
            let inputCont = document.getElementById("analysisSearchContInput");
            sel.addEventListener("change", () => {
              let val = sel.value.trim().toUpperCase();
              let filtered = (val === "" ? data : data.filter(r => String(r.SECCION || "").trim().toUpperCase() === val));
              cont.innerHTML = getContainerAnalysis(filtered, closed);
            });
            inputCont.addEventListener("input", () => {
              let text = inputCont.value.trim().toUpperCase();
              let groups = {};
              data.forEach(r => {
                let c = String(r.CONTENEDOR || "").trim().toUpperCase() || "SIN CONTENEDOR";
                if (!groups[c]) groups[c] = [];
                groups[c].push(r);
              });
              let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px;">`;
              for (let c in groups) {
                if (c.includes(text) || text === "") {
                  let closedFlag = closed && closed[c] ? true : false;
                  html += `<div class="analysis-box" style="padding:10px;border-radius:8px;${closedFlag ? "border:2px solid red;background:rgba(255,0,0,0.1);" : "border:1px solid rgba(255,255,255,0.5);background:rgba(0,0,0,0.1);"}">
                              <h5 style="margin-bottom:8px;">
                                <i class="material-icons" style="vertical-align:middle; font-size:1.3rem; ${closedFlag ? "color:red;" : ""}">inventory_2</i>
                                Contenedor: ${c} ${closedFlag ? '<span style="color:red;font-weight:bold;">(CERRADO)</span>' : ''}
                              </h5>
                              ${getContainerSummaryDetailed(groups[c])}
                            </div>`;
                }
              }
              html += `</div>`;
              cont.innerHTML = html;
            });
          }, 100);
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
          let assignedUsers = new Set();
          let workers = new Set();
          let dates = [];
          let sapSum = 0, scannerSum = 0;
          let completeCount = 0, totalMissing = 0, totalExtra = 0;
          recs.forEach(r => {
            let sap = Number(r.SAP) || 0;
            let sc = Number(r.SCANNER) || 0;
            sapSum += sap;
            scannerSum += sc;
            if (r.ENTREGADO_A) assignedUsers.add(r.ENTREGADO_A);
            if (r.LAST_SCANNED_BY) workers.add(r.LAST_SCANNED_BY);
            if (r.FECHA_ESCANEO) {
              let d = new Date(r.FECHA_ESCANEO);
              if (!isNaN(d.getTime())) dates.push(d);
            }
            if (sc >= sap) {
              completeCount++;
              if (sc > sap) totalExtra += (sc - sap);
            } else {
              totalMissing += (sap - sc);
            }
          });
          let status = "INCOMPLETO";
          if (totalMissing === 0 && totalExtra > 0) {
            status = "COMPLETO CON MERCANCÍA DE MÁS";
          } else if (completeCount === totalRecords && totalExtra === 0) {
            status = "COMPLETO";
          }
          let dateInfo = "N/A";
          if (dates.length > 0) {
            let minDate = new Date(Math.min(...dates));
            let maxDate = new Date(Math.max(...dates));
            dateInfo = `${formatFecha(minDate)} - ${formatFecha(maxDate)}`;
          }
          let completionInfo = "N/A";
          if (status === "INCOMPLETO" || status === "COMPLETO CON MERCANCÍA DE MÁS") {
            let lastDate = (dates.length > 0) ? new Date(Math.max(...dates)) : new Date();
            let lastWorker = Array.from(workers).pop() || "N/A";
            completionInfo = `${lastWorker} el ${formatFecha(lastDate)}`;
          } else {
            completionInfo = (workers.size === 1) ? Array.from(workers)[0] : `Varios (${Array.from(workers).join(", ")})`;
          }
          return `
            <div style="font-size:0.95rem; display:flex; flex-direction:column; gap:4px;">
              <div class="analysis-item">
                <i class="material-icons" style="color:#666;">apps</i>
                <strong>SKUs en contenedor:</strong> ${totalRecords}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#8E44AD;">receipt_long</i>
                <strong>Piezas Totales (SAP):</strong> ${sapSum}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#27AE60;">fact_check</i>
                <strong>Piezas Escaneadas:</strong> ${scannerSum}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#2980B9;">check_box</i>
                <strong>SKUs Completos:</strong> ${completeCount} ${totalExtra > 0 ? `(con ${totalExtra} piezas de más)` : ""} 
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:${totalMissing > 0 ? "#E74C3C" : "#95A5A6"};">remove_circle</i>
                <strong>Faltan piezas:</strong> ${totalMissing}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:${totalExtra > 0 ? "#F1C40F" : "#95A5A6"};">add_circle</i>
                <strong>Excedentes:</strong> ${totalExtra} ${totalExtra > 0 ? "<em style='font-size:0.85rem;color:#555;'>(piezas agregadas de más)</em>" : ""} 
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#16A085;">person</i>
                <strong>Asignados a:</strong> ${Array.from(assignedUsers).join(", ") || "N/A"}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#34495E;">engineering</i>
                <strong>Trabajado por:</strong> ${Array.from(workers).join(", ") || "N/A"}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:#CD6155;">date_range</i>
                <strong>Fechas de escaneo:</strong> ${dateInfo || "N/A"}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:${status === "COMPLETO" ? "#2ECC71" : "#E74C3C"};">info</i>
                <strong>Estado:</strong> ${status}
              </div>
              <div class="analysis-item">
                <i class="material-icons" style="color:${status === "COMPLETO" ? "#2ECC71" : "#E74C3C"};">person</i>
                <strong>${status === "COMPLETO" ? "Completado por:" : "Última actualización:"}</strong> ${completionInfo}
              </div>
            </div>
          `;
        }
        function getContainerStateFromRecords(records) {
          let totalMissing = 0, totalExtra = 0, completeCount = 0;
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
  // Si es instancia de Date, usamos el día local sin correction de zona
  if (fecha instanceof Date && !isNaN(fecha.getTime())) {
    const dia  = fecha.getDate().toString().padStart(2, "0");
    const mes  = (fecha.getMonth() + 1).toString().padStart(2, "0");
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
          let wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
          let blob = new Blob([wbout], { type: "application/octet-stream" });
          let storeFolder = (currentUserStore === "ALL") ? "ALL" : currentUserStore;
          let storageRef = storage.ref(`Manifiestos/${storeFolder}/${fileName}`);
          await storageRef.put(blob);
          await db.collection('manifiestos')
  .doc(fileName)
  .set(
    {
      fileName,
      store: storeFolder,
      lastUser: dataObj.lastUser,
      lastUserStore: (dataObj.lastUserStore !== undefined) ? dataObj.lastUserStore : null,
      lastUserRole:  (dataObj.lastUserRole   !== undefined) ? dataObj.lastUserRole   : null,
      closedContainers: dataObj.closedContainers || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
        }
