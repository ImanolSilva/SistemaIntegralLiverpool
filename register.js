// register.js

(function() {
    // Obtener elementos del DOM
    const registerForm = document.getElementById('registerForm');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');

    // Manejar el envío del formulario de registro
    registerForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const email = registerEmail.value.trim();
        const password = registerPassword.value.trim();
        const confirmPwd = confirmPassword.value.trim();
        
        if (!email || !password || !confirmPwd) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos Vacíos',
                text: 'Por favor, completa todos los campos.'
            });
            return;
        }
        
        if (password !== confirmPwd) {
            Swal.fire({
                icon: 'error',
                title: 'Contraseñas No Coinciden',
                text: 'Las contraseñas ingresadas no coinciden. Por favor, verifica.'
            });
            return;
        }
        
        if (password.length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseña Débil',
                text: 'La contraseña debe tener al menos 6 caracteres.'
            });
            return;
        }
        
        Swal.fire({
            title: 'Registrando Usuario...',
            html: '<div class="loader"></div>',
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Registrar al usuario con Firebase
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Usuario registrado exitosamente
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'Te has registrado correctamente.',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'index.html'; // Redirigir al dashboard
                });
            })
            .catch((error) => {
                // Manejar errores de registro
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message
                });
            });
    });
})();
