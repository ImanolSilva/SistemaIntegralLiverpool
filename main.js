// ========== CONFIGURACIÓN DE FIREBASE ==========
// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-storage.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";  // Importación correcta de Firestore

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
  authDomain: "loginliverpool.firebaseapp.com",
  projectId: "loginliverpool",
  storageBucket: "loginliverpool.appspot.com",  // Bucket de almacenamiento
  messagingSenderId: "704223815941",
  appId: "1:704223815941:web:c871525230fb61caf96f6c",
  measurementId: "G-QFEPQ4TSPY",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);  // Aquí no es necesario especificar el bucket explícitamente si lo tienes bien configurado
const db = getFirestore(app);  // Inicialización correcta de Firestore

// ========== LISTA DE ADMINISTRADORES ==========
// Asegúrate de añadir los UIDs de los administradores
const adminUIDs = [
  "OaieQ6cGi7TnW0nbxvlk2oyLaER2",
  "UID_ADMIN_2", // Añade más UIDs de administradores si es necesario
];

// Escuchar el estado de autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userId = user.uid;
    document.getElementById('correoUsuario').innerText = `Usuario: ${user.email}`;

    if (adminUIDs.includes(userId)) {
      // Usuario administrador: permitir subir archivos
      document.getElementById("rechazosInput").disabled = false;
    } else {
      // Usuario no administrador: solo podrá ver los archivos
      document.getElementById("rechazosInput").disabled = true;
    }

    loadFiles();  // Cargar los archivos desde Firebase
  } else {
    window.location.href = "login.html"; // Redirigir a login si no está autenticado
  }
});

// Función para cargar archivos desde Firebase Storage
async function loadFiles() {
  const listRef = ref(storage, 'rechazos/'); // Ruta donde se almacenan los archivos
  try {
    const fileList = await listAll(listRef);  // Listar archivos subidos
    const files = fileList.items;

    const tableBody = document.getElementById("rechazosTable");
    tableBody.innerHTML = ""; // Limpiar la tabla

    if (files.length === 0) {
      Swal.fire("No hay archivos disponibles", "Por favor, carga un archivo primero.", "warning");
    } else {
      files.forEach(async (fileRef) => {
        const fileName = fileRef.name;
        const fileUrl = await getDownloadURL(fileRef);

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${fileName}</td>
          <td><button class="btn btn-primary" onclick="compareFile('${fileUrl}')">Comparar</button></td>
        `;
        tableBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error("Error al cargar los archivos:", error);
    Swal.fire("Error", "Hubo un problema al cargar los archivos.", "error");
  }
}

// Función para manejar el archivo de comparación
async function compareFile(fileUrl) {
  const fileResponse = await fetch(fileUrl);
  const fileBlob = await fileResponse.blob();
  const file = new Blob([fileBlob], { type: "application/vnd.ms-excel" });

  // Ahora compara el archivo con los datos de la base de datos o realiza las operaciones necesarias
  console.log("Comparando archivo:", file);
}

// Subir archivo a Firebase
document.getElementById("rechazosInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const storageRef = ref(storage, `rechazos/${file.name}`);

    uploadBytes(storageRef, file).then(() => {
      Swal.fire("Archivo Subido", "El archivo ha sido cargado exitosamente.", "success");
      loadFiles(); // Cargar archivos después de la subida
    }).catch(error => {
      console.error(error);
      Swal.fire("Error", "Hubo un problema al cargar el archivo.", "error");
    });
  }
});

// Cerrar sesión
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
});
