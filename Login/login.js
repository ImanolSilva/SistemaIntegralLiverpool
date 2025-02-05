(function () {
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const forgotPasswordModalEl = document.getElementById("forgotPasswordModal");
  const forgotPasswordModal = new bootstrap.Modal(forgotPasswordModalEl, { keyboard: false });
  const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
  const forgotEmailInput = document.getElementById("forgotEmail");

  /************************************************
   * ===== INICIAR SESIÓN CON GOOGLE ============ 
   ************************************************/
  googleSignInBtn.addEventListener("click", function (event) {
    event.preventDefault();
    showLoadingModal();

    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
      .then((result) => {
        hideLoadingModal();
        showCustomAlert("success", "Inicio de sesión con Google exitoso. ¡Bienvenido!");
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 1000);
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error en inicio de sesión con Google:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showCustomAlert("error", errorMessage);
      });
  });

  /******************************************************
   * ===== EVENTO: clic en "¿Olvidaste tu contraseña?" =====
   ******************************************************/
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
      showCustomAlert("warning", "Por favor, ingresa tu correo.");
      return;
    }
    showLoadingModal();
    auth.sendPasswordResetEmail(email)
      .then(() => {
        hideLoadingModal();
        showCustomAlert("success", "Te enviamos un correo para restablecer tu contraseña.");
        forgotPasswordModal.hide();
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error al enviar correo:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showCustomAlert("error", errorMessage);
      });
  });

  /************************************************
   * ===== FUNCIONES AUXILIARES ========== 
   ************************************************/
  function showLoadingModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal-loading");
    modal.innerHTML = `<div class="loader"></div>`;
    // Estilo para el modal de carga
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.backgroundColor = "rgba(0,0,0,0.6)";
    modal.style.zIndex = "1050";
    document.body.appendChild(modal);
  }

  function hideLoadingModal() {
    const modal = document.querySelector(".modal-loading");
    if (modal) modal.remove();
  }

  function showCustomAlert(type, message) {
    const alertColors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107"
    };
    const alert = document.createElement("div");
    alert.classList.add("custom-alert");
    alert.style.backgroundColor = alertColors[type] || "#E6007E";
    alert.textContent = message;
    document.body.appendChild(alert);
    // Eliminar el alert después de 3 segundos (la animación fadeOut ya está en CSS)
    setTimeout(() => {
      if (alert) alert.remove();
    }, 3000);
  }

  function parseFirebaseError(errorCode) {
    const errorMessages = {
      "auth/unauthorized-domain": "El dominio actual no está autorizado para OAuth. Agrega este dominio en la consola de Firebase.",
      // Puedes agregar más códigos de error y mensajes personalizados aquí.
    };
    return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
  }
})();
