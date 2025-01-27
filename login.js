// login.js

(function () {
  // Referencias del formulario de Login
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");

  // Referencias del modal "Olvidar Contraseña"
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  // Modal de Bootstrap
  const forgotPasswordModal = new bootstrap.Modal(document.getElementById("forgotPasswordModal"), {
    keyboard: false
  });
  const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
  const forgotEmailInput = document.getElementById("forgotEmail");

  /************************************************
   * ========== INICIAR SESIÓN (Login) ==========
   ************************************************/
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      showCustomAlert("warning", "Completa todos los campos.");
      return;
    }

    showLoadingModal();

    auth
      .signInWithEmailAndPassword(email, password)
      .then(() => {
        hideLoadingModal();
        showCustomAlert("success", "Inicio de sesión exitoso. ¡Bienvenido!");
        setTimeout(() => {
          window.location.href = "../Inicio.html"; // Redirigir al dashboard
        }, 1000);
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error Firebase:", error.code, error.message); // Depuración
        const errorMessage = parseFirebaseError(error.code);
        showCustomAlert("error", errorMessage);
      });
  });

  /******************************************************
   * ========== EVENTO: clic en "¿Olvidaste tu contraseña?" ==========
   ******************************************************/
  forgotPasswordLink.addEventListener("click", function (event) {
    event.preventDefault();
    // Mostramos el modal de Bootstrap
    forgotEmailInput.value = ""; // Limpiar el campo
    forgotPasswordModal.show();
  });

  /************************************************
   * ========== EVENTO: botón "Enviar Correo" en modal ==========
   ************************************************/
  sendResetEmailBtn.addEventListener("click", function () {
    const email = forgotEmailInput.value.trim();
    if (!email) {
      showCustomAlert("warning", "Por favor, ingresa tu correo.");
      return;
    }

    showLoadingModal();

    auth
      .sendPasswordResetEmail(email)
      .then(() => {
        hideLoadingModal();
        showCustomAlert("success", "Te enviamos un correo para restablecer tu contraseña.");
        forgotPasswordModal.hide();
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error al enviar correo de restablecimiento:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showCustomAlert("error", errorMessage);
      });
  });

  /************************************************
   * ========== FUNCIONES AUXILIARES ==========
   ************************************************/

  // Muestra un modal de "cargando"
  function showLoadingModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal-loading");
    modal.innerHTML = `
      <div class="spinner"></div>
    `;
    document.body.appendChild(modal);
  }

  // Oculta el modal de "cargando"
  function hideLoadingModal() {
    const modal = document.querySelector(".modal-loading");
    if (modal) modal.remove();
  }

  // Muestra alertas personalizadas
  function showCustomAlert(type, message) {
    const alertColors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
    };
    const iconClasses = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
    };

    const alert = document.createElement("div");
    alert.classList.add("custom-alert");
    alert.style.backgroundColor = alertColors[type] || "#e83e8c";
    alert.innerHTML = `<i class="${iconClasses[type]}"></i> ${message}`;

    document.body.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 3000);
  }

  // Convierte los códigos de error de Firebase en mensajes user-friendly
  function parseFirebaseError(errorCode) {
    const errorMessages = {
      "auth/user-not-found":
        "El correo ingresado no está registrado. Por favor, verifica o regístrate.",
      "auth/wrong-password":
        "La contraseña ingresada es incorrecta. Intenta de nuevo.",
      "auth/invalid-email":
        "El formato del correo no es válido. Por favor, verifica.",
      "auth/too-many-requests":
        "Demasiados intentos fallidos. Intenta nuevamente más tarde.",
      "auth/invalid-login-credentials":
        "El correo o la contraseña son incorrectos. Por favor, verifica e intenta nuevamente.",
    };

    return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
  }
})();
