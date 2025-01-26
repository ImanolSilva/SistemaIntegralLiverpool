// register.js

(function () {
  const registerForm = document.getElementById("registerForm");
  const registerEmail = document.getElementById("registerEmail");
  const registerPassword = document.getElementById("registerPassword");
  const confirmPassword = document.getElementById("confirmPassword");

  /************************************************
   * ========== REGISTRAR NUEVO USUARIO ==========
   ************************************************/
  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = registerEmail.value.trim();
    const pass = registerPassword.value.trim();
    const passConfirm = confirmPassword.value.trim();

    if (!email || !pass || !passConfirm) {
      showCustomAlert("warning", "Completa todos los campos.");
      return;
    }
    if (pass !== passConfirm) {
      showCustomAlert("warning", "Las contraseñas no coinciden.");
      return;
    }

    showLoadingModal();

    auth
      .createUserWithEmailAndPassword(email, pass)
      .then(() => {
        hideLoadingModal();
        showCustomAlert("success", "Registro exitoso. ¡Bienvenido!");
        setTimeout(() => {
          window.location.href = "index.html"; // Redirigir al dashboard
        }, 1000);
      })
      .catch((error) => {
        hideLoadingModal();
        console.error("Error Firebase:", error.code, error.message);
        const errorMessage = parseFirebaseError(error.code);
        showCustomAlert("error", errorMessage);
      });
  });

  /************************************************
   * ========== FUNCIONES AUXILIARES ==========
   ************************************************/
  function showLoadingModal() {
    const modal = document.createElement("div");
    modal.classList.add("modal-loading");
    modal.innerHTML = `<div class="spinner"></div>`;
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

  function parseFirebaseError(errorCode) {
    const errorMessages = {
      "auth/email-already-in-use":
        "Este correo ya está registrado. Prueba con uno distinto.",
      "auth/invalid-email":
        "El correo ingresado no es válido. Revisa el formato.",
      "auth/weak-password":
        "La contraseña es muy débil. Usa al menos 6 caracteres.",
      // ... etc
    };

    return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
  }
})();
