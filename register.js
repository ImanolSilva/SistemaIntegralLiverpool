(function () {
    const registerForm = document.getElementById("registerForm");
    const registerEmail = document.getElementById("registerEmail");
    const registerPassword = document.getElementById("registerPassword");
    const confirmPassword = document.getElementById("confirmPassword");
  
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
  
      const email = registerEmail.value.trim();
      const password = registerPassword.value.trim();
      const confirmPwd = confirmPassword.value.trim();
  
      if (!email || !password || !confirmPwd) {
        showCustomAlert("warning", "Completa todos los campos.");
        return;
      }
  
      if (password !== confirmPwd) {
        showCustomAlert("error", "Las contraseñas no coinciden.");
        return;
      }
  
      if (password.length < 6) {
        showCustomAlert("warning", "La contraseña debe tener al menos 6 caracteres.");
        return;
      }
  
      showLoadingModal();
  
      auth
        .createUserWithEmailAndPassword(email, password)
        .then(() => {
          hideLoadingModal();
          showCustomAlert("success", "Registro exitoso. ¡Bienvenido!");
          setTimeout(() => {
            window.location.href = "index.html"; // Redirigir al dashboard
          }, 1000);
        })
        .catch((error) => {
          hideLoadingModal();
          const errorMessage = parseFirebaseError(error.code);
          showCustomAlert("error", errorMessage);
        });
    });
  
    function showLoadingModal() {
      const modal = document.createElement("div");
      modal.classList.add("modal-loading");
      modal.innerHTML = `
        <div class="spinner"></div>
      `;
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
        "auth/email-already-in-use": "El correo ya está registrado. Por favor, usa otro correo o inicia sesión.",
        "auth/invalid-email": "El formato del correo no es válido. Revisa e intenta de nuevo.",
        "auth/weak-password": "La contraseña es demasiado débil. Asegúrate de usar al menos 6 caracteres.",
        "auth/operation-not-allowed": "El registro de cuentas está deshabilitado temporalmente. Intenta más tarde.",
      };
  
      return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
    }
  })();
  