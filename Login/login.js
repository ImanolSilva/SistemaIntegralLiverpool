(function () {
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const forgotPasswordModalEl = document.getElementById("forgotPasswordModal");
  const forgotPasswordModal = new bootstrap.Modal(forgotPasswordModalEl, { keyboard: false });
  const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
  const forgotEmailInput = document.getElementById("forgotEmail");

  // Elementos del modal de registro
  const registrationModalEl = document.getElementById("registrationModal");
  const departmentContainer = document.getElementById("departmentContainer");
  const departmentSelect = document.getElementById("departmentSelect");
  const roleContainer = document.getElementById("roleContainer");
  const roleSelect = document.getElementById("roleSelect");
  const storeInput = document.getElementById("storeInput");
  const bossSelectContainer = document.getElementById("bossSelectContainer");
  const bossSelect = document.getElementById("bossSelect");
  const saveRegistrationBtn = document.getElementById("saveRegistrationBtn");

  /************************************************
   * ===== INICIAR SESIÓN CON GOOGLE ============ 
   ************************************************/
  googleSignInBtn.addEventListener("click", function (event) {
    event.preventDefault();
    showLoadingModal();

    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
      .then(async (result) => {
        hideLoadingModal();
        const user = result.user;
        if (!user) {
          showSwalAlert("error", "No se obtuvo el usuario de Google.");
          return;
        }
        const displayName = user.displayName || "Sin nombre";
        const userEmail = user.email || "SinEmail";

        // Ref al doc del usuario en Firestore
        const userDocRef = db.collection("usuarios").doc(user.uid);
        const userDoc = await userDocRef.get();

        // Guardamos email y createdAt (si no existen)
        await userDocRef.set({
          name: displayName,
          email: userEmail,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Si es admin
        if (user.uid === "OaieQ6cGi7TnW0nbxvlk2oyLaER2") {
          showSwalAlert("success", "Inicio de sesión con Google exitoso. ¡Bienvenido, Admin!");
          setTimeout(() => {
            window.location.href = "../index.html";
          }, 1000);
          return;
        }

        // Verificar si faltan department, store, desiredRole
        const docData = userDoc.exists ? userDoc.data() : {};
        const hasDepartment = docData.department || "";
        const hasStore = docData.store || "";
        const hasDesiredRole = docData.desiredRole || "";

        // Si no hay dept, store o desiredRole => mostrar modal
        if (!hasDepartment || !hasStore || !hasDesiredRole) {
          const registrationModal = new bootstrap.Modal(registrationModalEl, { backdrop: 'static', keyboard: false });
          registrationModal.show();

          // Prellenar si ya tiene algo
          departmentSelect.value = hasDepartment;
          roleSelect.value = hasDesiredRole;
          storeInput.value = hasStore;

          // Ajustar visibilidad
          handleDeptChange();
          handleRoleChange();

          // Si docData.desiredRole = "vendedor" => cargar jefes
          if (hasDesiredRole === "vendedor") {
            await loadJefesToSelect();
          }
        } else {
          // Ya tiene la info
          showSwalAlert("success", "Inicio de sesión con Google exitoso. ¡Bienvenido!");
          setTimeout(() => {
            window.location.href = "../index.html";
          }, 1000);
        }
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error en inicio de sesión con Google:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showSwalAlert("error", errorMessage);
      });
  });

  /************************************************
   * ===== EVENTO: clic en "¿Olvidaste tu contraseña?" =====
   ************************************************/
  forgotPasswordLink.addEventListener("click", function (event) {
    event.preventDefault();
    forgotEmailInput.value = "";
    forgotPasswordModal.show();
  });

  /************************************************
   * ===== EVENTO: botón "Enviar Correo" en modal =====
   ************************************************/
  sendResetEmailBtn.addEventListener("click", function () {
    const email = forgotEmailInput.value.trim();
    if (!email) {
      showSwalAlert("warning", "Por favor, ingresa tu correo.");
      return;
    }
    showLoadingModal();
    auth.sendPasswordResetEmail(email)
      .then(() => {
        hideLoadingModal();
        showSwalAlert("success", "Te enviamos un correo para restablecer tu contraseña.");
        forgotPasswordModal.hide();
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error al enviar correo:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showSwalAlert("error", errorMessage);
      });
  });

  /************************************************
   * ===== EVENTOS: departmentSelect y roleSelect =====
   ************************************************/
  departmentSelect.addEventListener("change", handleDeptChange);
  roleSelect.addEventListener("change", handleRoleChange);

  async function handleDeptChange() {
    const deptVal = departmentSelect.value;
    // Si dept = "000" => es auxiliar => ocultar roleSelect, bossSelect
    if (deptVal === "000") {
      roleContainer.style.display = "none";
      roleSelect.value = ""; // Limpiamos
      bossSelectContainer.style.display = "none";
    } else {
      // Mostramos roleContainer, el user puede elegir "jefe" o "vendedor"
      roleContainer.style.display = "block";
    }
  }

  async function handleRoleChange() {
    const roleVal = roleSelect.value;
    // Si role = "jefe" => ocultar department => set dept = ""
    if (roleVal === "jefe") {
      departmentContainer.style.display = "none";
      departmentSelect.value = ""; // forzamos dept vacio
      bossSelectContainer.style.display = "none";
    }
    // Si role = "vendedor" => mostrar department => (no "000"), bossSelect
    else if (roleVal === "vendedor") {
      departmentContainer.style.display = "block";
      // Si ya era "000", lo limpiamos
      if (departmentSelect.value === "000") {
        departmentSelect.value = "";
      }
      bossSelectContainer.style.display = "block";
      await loadJefesToSelect();
    }
    else {
      // role = "" => se oculta boss, se muestra dept
      bossSelectContainer.style.display = "none";
      departmentContainer.style.display = "block";
    }
  }

  /************************************************
   * ===== FUNCIÓN: Cargar jefes al select bossSelect =====
   ************************************************/
  async function loadJefesToSelect() {
    try {
      bossSelect.innerHTML = `<option value="">Cargando...</option>`;
      const snapshot = await db.collection("usuarios")
        .where("role", "==", "jefe")
        .where("status", "==", "aprobado")
        .get();

      let optionsHtml = `<option value="">-- Selecciona Jefe --</option>`;
      if (snapshot.empty) {
        // No hay jefes
        optionsHtml += `<option value="NoEsta">Mi jefe no está</option>`;
      } else {
        snapshot.forEach(doc => {
          const data = doc.data();
          const bossName = data.name || data.email || "Jefe";
          const bossUid = doc.id;
          optionsHtml += `<option value="${bossUid}">${bossName}</option>`;
        });
        // Agregamos la opción "Mi jefe no está"
        optionsHtml += `<option value="NoEsta">Mi jefe no está</option>`;
      }
      bossSelect.innerHTML = optionsHtml;
    } catch (error) {
      console.error("Error al cargar jefes:", error);
      bossSelect.innerHTML = `<option value="">Error al cargar jefes</option>`;
    }
  }

  /************************************************
   * ===== EVENTO: Guardar Registro (modal) =====
   ************************************************/
  saveRegistrationBtn.addEventListener("click", async () => {
    const deptVal = departmentSelect.value;
    let roleVal = roleSelect.value;
    const storeVal = storeInput.value.trim();
    let bossVal = "";

    // Validar store
    if (!storeVal) {
      showSwalAlert("warning", "Por favor, ingresa la tienda.");
      return;
    }

    // Caso 1: dept = "000" => auxiliar
    if (deptVal === "000") {
      roleVal = "auxiliar";
    }
    // Caso 2: role = "jefe" => dept = ""
    if (roleVal === "jefe") {
      // deptVal = "";
      departmentSelect.value = "";
    }
    // Caso 3: role = "vendedor" => dept != "000"
    if (roleVal === "vendedor") {
      if (!deptVal || deptVal === "000") {
        showSwalAlert("warning", "El departamento no puede ser '000' si eres vendedor.");
        return;
      }
      bossVal = bossSelect.value || "";
      if (!bossVal) {
        showSwalAlert("warning", "Selecciona un jefe o 'Mi jefe no está'.");
        return;
      }
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        showSwalAlert("error", "No se detecta usuario. Inicia sesión de nuevo.");
        return;
      }
      const userDocRef = db.collection("usuarios").doc(user.uid);

      await userDocRef.set({
        department: deptVal,
        store: storeVal,
        desiredRole: roleVal || "", // si dept=000 => "auxiliar", si role=jefe => "jefe", etc.
        role: "", // se deja vacío para que el admin lo asigne
        status: "pendiente",
        boss: bossVal
      }, { merge: true });

      // Cerrar modal
      const registrationModal = bootstrap.Modal.getInstance(registrationModalEl);
      if (registrationModal) {
        registrationModal.hide();
      }
      showSwalAlert("success", "Registro enviado. Espera aprobación del administrador.");
      setTimeout(() => {
        window.location.href = "../Pendientes/pending.html";
      }, 1200);
    } catch (error) {
      console.error("Error al guardar registro adicional:", error);
      showSwalAlert("error", "No se pudo guardar la información de registro.");
    }
  });

  /************************************************
   * ===== FUNCIONES AUXILIARES ========== 
   ************************************************/
  function showLoadingModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal-loading");
    modal.innerHTML = `<div class="loader"></div>`;
    Object.assign(modal.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
      zIndex: "1050"
    });
    document.body.appendChild(modal);
  }

  function hideLoadingModal() {
    const modal = document.querySelector(".modal-loading");
    if (modal) modal.remove();
  }

  function showSwalAlert(icon, message) {
    Swal.fire({
      icon: icon,
      title: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  }

  function parseFirebaseError(errorCode) {
    const errorMessages = {
      "auth/unauthorized-domain": "El dominio actual no está autorizado para OAuth. Agrega este dominio en la consola de Firebase."
    };
    return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
  }
})();
