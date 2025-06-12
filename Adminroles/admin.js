"use strict";

// =================================================================
// ARCHIVO: admin.js (Versión Refactorizada y Mejorada)
// LÓGICA PARA EL PANEL DE ADMINISTRACIÓN DE USUARIOS
// =================================================================

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
    authDomain: "loginliverpool.firebaseapp.com",
    projectId: "loginliverpool",
    storageBucket: "loginliverpool.appspot.com",
    messagingSenderId: "704223815941",
    appId: "1:704223815941:web:c871525230fb61caf96f6c"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ========== ESTADO Y ELEMENTOS DEL DOM ==========
const AppState = {
    adminUIDs: ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2", "tKJZpQ3Ke4M9sCvrSHc3qKvPrf12"],
    allUsers: [],
    allBosses: []
};
const UIElements = {
    adminPanel: document.getElementById("admin-panel-container"),
    notAdminMsg: document.getElementById("notAdminMsg"),
    loadingSpinner: document.getElementById("loadingSpinner"),
    usersTableBody: document.getElementById("usersTableBody"),
    logoutBtn: document.getElementById("logout-btn"),
    storeFilter: document.getElementById("storeFilter"),
    adminNavLink: document.getElementById("admin-nav-link"),
};

// ========== INICIALIZACIÓN ==========
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(handleAuthChange);
});

/**
 * Maneja los cambios de estado de autenticación. Es el punto de entrada.
 * @param {firebase.User} user
 */
async function handleAuthChange(user) {
    if (user && AppState.adminUIDs.includes(user.uid)) {
        await initializeAdminPanel();
    } else {
        showNotAdmin();
    }
}

/**
 * Inicializa el panel de administración, cargando datos y configurando eventos.
 */
async function initializeAdminPanel() {
    UIElements.loadingSpinner.style.display = 'none';
    UIElements.adminPanel.style.display = 'block';
    if (UIElements.adminNavLink) UIElements.adminNavLink.style.display = 'list-item';

    await loadAllBosses();
    await loadAllUsers();
    
    initEventListeners();
}

/**
 * Muestra el mensaje de "Acceso Denegado".
 */
function showNotAdmin() {
    UIElements.loadingSpinner.style.display = 'none';
    UIElements.notAdminMsg.style.display = 'block';
    UIElements.adminPanel.style.display = 'none';
}

// ========== LÓGICA DE DATOS CON FIRESTORE ==========

async function loadAllBosses() {
    try {
        const snapshot = await db.collection("usuarios").where("role", "==", "jefe").where("status", "==", "aprobado").get();
        AppState.allBosses = snapshot.docs.map(doc => ({ uid: doc.id, name: doc.data().name || doc.data().email }));
    } catch (error) {
        console.error("Error al cargar la lista de jefes:", error);
    }
}

async function loadAllUsers() {
    try {
        const snapshot = await db.collection("usuarios").orderBy("createdAt", "desc").get();
        AppState.allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        renderUsersTable(AppState.allUsers);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        UIElements.loadingSpinner.style.display = "none";
        Swal.fire('Error', 'No se pudieron cargar los datos de los usuarios.', 'error');
    }
}

// ========== RENDERIZADO DE LA INTERFAZ ==========

/**
 * Renderiza la tabla de usuarios a partir de una lista.
 * @param {Array} users - La lista de usuarios a mostrar.
 */
function renderUsersTable(users) {
    UIElements.usersTableBody.innerHTML = "";
    if (users.length === 0) {
        UIElements.usersTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No se encontraron usuarios.</td></tr>`;
        return;
    }
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-uid', user.uid);
        tr.innerHTML = createUserRowHTML(user);
        UIElements.usersTableBody.appendChild(tr);
    });
}

/**
 * Crea el HTML para una sola fila de la tabla de usuarios.
 * @param {object} user - El objeto de datos del usuario.
 * @returns {string} - El string HTML de la fila.
 */
function createUserRowHTML(user) {
    const roles = { jefe: 'Jefe', vendedor: 'Vendedor', auxiliar: 'Auxiliar' };
    const statuses = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
    const departments = [ { code: "000", name: "AUXILIAR DE OPERACIONES" }, /* ...y todos los demás... */ ]; // Esta lista debería estar completa

    const createOptions = (options, selectedValue) => Object.entries(options).map(([value, text]) => `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${text}</option>`).join('');
    const createBossOptions = (selectedBossUid) => `<option value="">--Sin jefe--</option>` + AppState.allBosses.map(boss => `<option value="${boss.uid}" ${boss.uid === selectedBossUid ? 'selected' : ''}>${boss.name}</option>`).join('');

    return `
        <td data-label="Email">${user.email}</td>
        <td data-label="Tienda"><input class="form-control form-control-sm" type="text" value="${user.store || ''}" data-field="store"></td>
        <td data-label="Depto"><input class="form-control form-control-sm" type="text" value="${user.department || ''}" data-field="department"></td>
        <td data-label="Rol Des.">${user.desiredRole || 'N/A'}</td>
        <td data-label="Rol Act."><select class="form-select form-select-sm" data-field="role">${createOptions(roles, user.role)}</select></td>
        <td data-label="Jefe"><select class="form-select form-select-sm" data-field="boss">${createBossOptions(user.boss)}</select></td>
        <td data-label="Status"><select class="form-select form-select-sm" data-field="status">${createOptions(statuses, user.status)}</select></td>
        <td data-label="Acciones">
            <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-pill btn-pill-sm btn-success save-btn" title="Guardar cambios"><i class="bi bi-save"></i></button>
                <button class="btn btn-pill btn-pill-sm btn-danger delete-btn" title="Eliminar usuario"><i class="bi bi-trash"></i></button>
            </div>
        </td>`;
}

// ========== MANEJO DE EVENTOS Y ACCIONES ==========

function initEventListeners() {
    UIElements.logoutBtn.addEventListener("click", () => auth.signOut());
    UIElements.storeFilter.addEventListener("input", handleFilter);
    
    // Delegación de eventos para los botones de la tabla
    UIElements.usersTableBody.addEventListener('click', e => {
        const saveButton = e.target.closest('.save-btn');
        const deleteButton = e.target.closest('.delete-btn');
        if (saveButton) {
            const uid = saveButton.closest('tr').dataset.uid;
            updateUser(uid);
        }
        if (deleteButton) {
            const uid = deleteButton.closest('tr').dataset.uid;
            removeUser(uid);
        }
    });
}

function handleFilter() {
    const filterValue = UIElements.storeFilter.value.trim().toLowerCase();
    if (!filterValue) {
        renderUsersTable(AppState.allUsers);
        return;
    }
    const filteredUsers = AppState.allUsers.filter(user =>
        user.store.toLowerCase().includes(filterValue) || user.email.toLowerCase().includes(filterValue)
    );
    renderUsersTable(filteredUsers);
}

async function updateUser(uid) {
    const row = document.querySelector(`tr[data-uid='${uid}']`);
    const dataToUpdate = {
        store: row.querySelector('[data-field="store"]').value,
        department: row.querySelector('[data-field="department"]').value,
        role: row.querySelector('[data-field="role"]').value,
        status: row.querySelector('[data-field="status"]').value,
        boss: row.querySelector('[data-field="boss"]').value,
    };

    try {
        await db.collection("usuarios").doc(uid).update(dataToUpdate);
        Swal.fire({ icon: "success", title: "Actualizado", text: "El usuario ha sido actualizado.", timer: 1500, showConfirmButton: false });
        // Actualizar el caché local para mantener la consistencia del filtro
        const userIndex = AppState.allUsers.findIndex(u => u.uid === uid);
        if (userIndex > -1) {
            Object.assign(AppState.allUsers[userIndex], dataToUpdate);
        }
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        Swal.fire("Error", "No se pudo actualizar el usuario.", "error");
    }
}

async function removeUser(uid) {
    const { isConfirmed } = await Swal.fire({
        title: "¿Eliminar Usuario?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Sí, eliminar"
    });
    if (isConfirmed) {
        try {
            await db.collection("usuarios").doc(uid).delete();
            Swal.fire({ icon: "success", title: "Eliminado", text: "El usuario ha sido eliminado.", timer: 1500, showConfirmButton: false });
            // Eliminar del caché y volver a renderizar
            AppState.allUsers = AppState.allUsers.filter(u => u.uid !== uid);
            handleFilter();
        } catch (error) {
            console.error("Error al eliminar usuario:", error);
            Swal.fire("Error", "No se pudo eliminar el usuario.", "error");
        }
    }
}