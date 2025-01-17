// login.js

(function() {
  // Obtener elementos del DOM
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');

  // Manejar el envío del formulario de login
  loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();
      
      if (!email || !password) {
          Swal.fire({
              icon: 'warning',
              title: 'Campos Vacíos',
              text: 'Por favor, completa todos los campos.'
          });
          return;
      }
      
      Swal.fire({
          title: 'Iniciando Sesión...',
          html: '<div class="loader"></div>',
          showConfirmButton: false,
          allowOutsideClick: false,
          didOpen: () => {
              Swal.showLoading();
          }
      });
      
      // Autenticar al usuario con Firebase
      auth.signInWithEmailAndPassword(email, password)
          .then((userCredential) => {
              // Sesión iniciada exitosamente
              Swal.fire({
                  icon: 'success',
                  title: 'Éxito',
                  text: 'Has iniciado sesión correctamente.',
                  timer: 1500,
                  showConfirmButton: false
              }).then(() => {
                  window.location.href = 'index.html'; // Redirigir al dashboard
              });
          })
          .catch((error) => {
              // Manejar errores de autenticación
              Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: error.message
              });
          });
  });
})();
