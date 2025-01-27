// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
  authDomain: "loginliverpool.firebaseapp.com",
  projectId: "loginliverpool",
  storageBucket: "loginliverpool.appspot.com",
  messagingSenderId: "704223815941",
  appId: "1:704223815941:web:c871525230fb61caf96f6c",
  measurementId: "G-QFEPQ4TSPY"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Obtén el servicio de autenticación
const auth = firebase.auth();

// Función para mostrar el menú hamburguesa
function hamburg() {
  const navbar = document.querySelector(".navbar-collapse");
  navbar.classList.toggle("show");
}

// Función para ocultar el menú hamburguesa
function cancel() {
  const navbar = document.querySelector(".navbar-collapse");
  navbar.classList.remove("show");
}

// Efecto tipo "Máquina de Escribir"
const texts = [
  "Registrar Saldos",
  "Controlar Rechazos",
  "Gestionar Inventarios",
  "Configurar Sistema"
];

let speed = 100;
const textElements = document.querySelector(".typewriter-text");
let textIndex = 0;
let charcterIndex = 0;

function typeWriter() {
  if (charcterIndex < texts[textIndex].length) {
    textElements.innerHTML += texts[textIndex].charAt(charcterIndex);
    charcterIndex++;
    setTimeout(typeWriter, speed);
  } else {
    setTimeout(eraseText, 1000);
  }
}

function eraseText() {
  if (textElements.innerHTML.length > 0) {
    textElements.innerHTML = textElements.innerHTML.slice(0, -1);
    setTimeout(eraseText, 50);
  } else {
    textIndex = (textIndex + 1) % texts.length;
    charcterIndex = 0;
    setTimeout(typeWriter, 500);
  }
}

// Cambiar el texto del botón "Acceder" / "Salir"
function setupAuthButton() {
  const authButton = document.getElementById("authButton");

  if (!authButton) return;

  authButton.addEventListener("click", () => {
    if (authButton.textContent === "Salir") {
      auth.signOut()
        .then(() => {
          console.log("Sesión cerrada");
          window.location.href = "index.html";
        })
        .catch((error) => {
          console.error("Error al cerrar sesión:", error);
        });
    } else {
      window.location.href = "login.html";
    }
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      authButton.textContent = "Salir";
    } else {
      authButton.textContent = "Acceder";
    }
  });
}

window.onload = () => {
  typeWriter(); // Inicia el efecto de escritura
  setupAuthButton(); // Configura el botón de autenticación
};
