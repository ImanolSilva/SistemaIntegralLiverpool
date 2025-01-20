(function () {
    const loginForm = document.getElementById("loginForm");
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");
  
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
            window.location.href = "index.html"; // Redirigir al dashboard
          }, 1000);
        })
        .catch((error) => {
          hideLoadingModal();
          console.error("Error Firebase:", error.code, error.message); // Depuración
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
        "auth/user-not-found": "El correo ingresado no está registrado. Por favor, verifica o regístrate.",
        "auth/wrong-password": "La contraseña ingresada es incorrecta. Intenta de nuevo.",
        "auth/invalid-email": "El formato del correo no es válido. Por favor, verifica.",
        "auth/too-many-requests": "Demasiados intentos fallidos. Intenta nuevamente más tarde.",
        "auth/invalid-login-credentials": "El correo o la contraseña son incorrectos. Por favor, verifica e intenta nuevamente.", // Personalización para este caso
      };
  
      return errorMessages[errorCode] || "Ocurrió un error inesperado. Intenta nuevamente.";
    }
  })();
  