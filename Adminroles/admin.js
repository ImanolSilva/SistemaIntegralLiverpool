"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // ========== CONFIGURACIÓN DE FIREBASE ==========
    const firebaseConfig = {
        apiKey: "AIzaSyA_4H46I7TCVLnFjet8fQPZ006latm-mRE",
        authDomain: "loginliverpool.firebaseapp.com",
        projectId: "loginliverpool",
        storageBucket: "loginliverpool.appspot.com",
        messagingSenderId: "704223815941",
        appId: "1:704223815941:web:c871525230fb61caf96f6c"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ========== ESTADO Y ELEMENTOS DEL DOM ==========
    const AppState = {
        adminUIDs: ["OaieQ6cGi7TnW0nbxvlk2oyLaER2", "doxhVo1D3aYQqqkqgRgfJ4qcKcU2", "tKJZpQ3Ke4M9sCvrSHc3qKvPrf12"],
        allUsers: [],
        allBosses: [],
        editUserModal: null,
    };

    const UIElements = {
        adminPanel: document.getElementById("admin-panel-container"),
        notAdminMsg: document.getElementById("notAdminMsg"),
        userCardsContainer: document.getElementById("user-cards-container"),
        logoutBtn: document.getElementById("logout-btn"),
        searchFilter: document.getElementById("search-filter"),
        modal: {
            el: document.getElementById('editUserModal'),
            uid: document.getElementById('edit-user-uid'),
            avatar: document.getElementById('modal-avatar'),
            name: document.getElementById('modal-user-name'),
            email: document.getElementById('modal-user-email'),
            statusSelect: document.getElementById('modal-status-select'),
            roleSelect: document.getElementById('modal-role-select'),
            bossSelect: document.getElementById('modal-boss-select'),
            saveBtn: document.getElementById('modal-save-btn'),
            deleteBtn: document.getElementById('modal-delete-btn'),
            deleteConfirmInput: document.getElementById('delete-confirm-input')
        }
    };

    // ========== INICIALIZACIÓN ==========
    if (UIElements.modal.el) {
        AppState.editUserModal = new bootstrap.Modal(UIElements.modal.el);
    }
    auth.onAuthStateChanged(handleAuthChange);

    async function handleAuthChange(user) {
        if (user && AppState.adminUIDs.includes(user.uid)) {
            await initializeAdminPanel();
        } else {
            showNotAdmin();
        }
    }

    async function initializeAdminPanel() {
        UIElements.adminPanel.style.display = 'block';
        showSkeletonLoader();
        await loadAllBosses();
        await loadAllUsers();
        initEventListeners();
    }

    function showNotAdmin() {
        if (UIElements.userCardsContainer) UIElements.userCardsContainer.innerHTML = '';
        if (UIElements.notAdminMsg) UIElements.notAdminMsg.style.display = 'block';
        if (UIElements.adminPanel) UIElements.adminPanel.style.display = 'none';
    }

    function showSkeletonLoader() {
        if (!UIElements.userCardsContainer) return;
        UIElements.userCardsContainer.innerHTML = Array(5).fill('').map(() => `
            <div class="skeleton-card">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-text">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            </div>`
        ).join('');
    }

    // ========== LÓGICA DE DATOS ==========
    async function loadAllBosses() {
        try {
            const snapshot = await db.collection("usuarios").where("role", "==", "jefe").get();
            AppState.allBosses = snapshot.docs.map(doc => {
                const data = doc.data();
                const bossName = data.displayName || data.name || data.nombre || data.email;
                return { uid: doc.id, name: bossName };
            });
        } catch (error) { console.error("Error al cargar la lista de jefes:", error); }
    }

    async function loadAllUsers() {
        try {
            const snapshot = await db.collection("usuarios").orderBy("createdAt", "desc").get();
            AppState.allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            renderUserCards(AppState.allUsers);
        } catch (error) {
            console.error("Error al obtener usuarios:", error);
            Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
        }
    }

    // ========== RENDERIZADO DE LA INTERFAZ ==========
    function renderUserCards(users) {
        const container = UIElements.userCardsContainer;
        if (!container) return;
        container.innerHTML = users.length === 0 
            ? `<p class="text-center text-muted mt-4">No se encontraron usuarios.</p>`
            : users.map(createUserCardHTML).join('');
    }

    function createUserCardHTML(user) {
        const name = user.displayName || user.name || user.nombre || user.email.split('@')[0];
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const registrationDate = user.createdAt?.toDate()
            ? user.createdAt.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';

        const status = user.status || 'pendiente';
        const bossName = AppState.allBosses.find(b => b.uid === user.jefeAsignado)?.name || 'Sin asignar';

        const actionsHTML = status === 'aprobado' ? `
            <button class="actions-btn edit-user-btn" title="Editar Usuario"><i class="bi bi-three-dots-vertical"></i></button>
        ` : `
            <div class="action-buttons-pending">
                <button class="btn-action btn-reject reject-btn" title="Rechazar"><i class="bi bi-x-lg"></i></button>
                <button class="btn-action btn-approve approve-btn" title="Aprobar"><i class="bi bi-check-lg"></i></button>
            </div>
        `;

        return `
        <div class="user-card status-${status}" data-uid="${user.uid}">
            <div class="user-main-info"><div class="user-avatar">${initials}</div><div class="user-name-email"><span class="name">${name}</span><span class="email">${user.email}</span><div class="user-id" title="${user.uid}">ID: ${user.uid.substring(0,8)}...<i class="bi bi-clipboard-check-fill copy-uid-btn" title="Copiar ID"></i></div></div></div>
            <div class="user-details"><span class="user-meta-item" title="Tienda"><i class="bi bi-shop"></i><strong>${user.store || 'N/A'}</strong></span><span class="user-meta-item" title="Departamento"><i class="bi bi-person-vcard"></i><strong>${user.department || 'N/A'}</strong></span><span class="user-meta-item" title="Fecha de Registro"><i class="bi bi-calendar-check"></i><strong>${registrationDate}</strong></span></div>
            <div class="user-status-roles"><span class="status-badge ${status}">${status}</span><small class="text-muted mt-1">Rol: <strong>${user.role || 'N/A'}</strong></small><small class="text-muted">Jefe: <strong>${bossName}</strong></small></div>
            <div class="user-actions">${actionsHTML}</div>
        </div>`;
    }

    // ========== MANEJO DE EVENTOS Y ACCIONES ==========
    function initEventListeners() {
        if(UIElements.logoutBtn) UIElements.logoutBtn.addEventListener("click", () => auth.signOut());
        if(UIElements.searchFilter) UIElements.searchFilter.addEventListener("input", handleFilter);
        
        if(UIElements.userCardsContainer) UIElements.userCardsContainer.addEventListener('click', e => {
            const card = e.target.closest('.user-card');
            if (!card) return;
            const uid = card.dataset.uid;
            if (e.target.closest('.approve-btn')) updateUserStatus(uid, 'aprobado');
            if (e.target.closest('.reject-btn')) updateUserStatus(uid, 'rechazado');
            if (e.target.closest('.edit-user-btn')) openEditModal(uid);
            if (e.target.closest('.copy-uid-btn')) copyToClipboard(uid, e.target);
        });

        if(UIElements.modal.saveBtn) UIElements.modal.saveBtn.addEventListener('click', saveUserChanges);
        if(UIElements.modal.deleteConfirmInput) UIElements.modal.deleteConfirmInput.addEventListener('input', validateDelete);
        if(UIElements.modal.deleteBtn) UIElements.modal.deleteBtn.addEventListener('click', () => {
            const uid = UIElements.modal.uid.value;
            AppState.editUserModal.hide();
            removeUser(uid);
        });
    }

    function handleFilter() {
        const filterValue = UIElements.searchFilter.value.trim().toLowerCase();
        const filteredUsers = AppState.allUsers.filter(user =>
            Object.values(user).some(val => String(val).toLowerCase().includes(filterValue))
        );
        renderUserCards(filteredUsers);
    }

    function openEditModal(uid) {
        const user = AppState.allUsers.find(u => u.uid === uid);
        if (!user) return;
        
        const name = user.displayName || user.name || user.nombre || user.email.split('@')[0];
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        UIElements.modal.uid.value = uid;
        UIElements.modal.avatar.textContent = initials;
        UIElements.modal.name.textContent = name;
        UIElements.modal.email.textContent = user.email;

        UIElements.modal.statusSelect.innerHTML = `
            <option value="aprobado" ${user.status === 'aprobado' ? 'selected' : ''}>Aprobado</option>
            <option value="pendiente" ${user.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="rechazado" ${user.status === 'rechazado' ? 'selected' : ''}>Rechazado</option>
        `;
        UIElements.modal.roleSelect.innerHTML = `
            <option value="vendedor" ${user.role === 'vendedor' ? 'selected' : ''}>Vendedor</option>
            <option value="auxiliar" ${user.role === 'auxiliar' ? 'selected' : ''}>Auxiliar</option>
            <option value="jefe" ${user.role === 'jefe' ? 'selected' : ''}>Jefe</option>
        `;
        UIElements.modal.bossSelect.innerHTML = '<option value="">-- Sin Asignar --</option>' + AppState.allBosses.map(boss => 
            `<option value="${boss.uid}" ${user.jefeAsignado === boss.uid ? 'selected' : ''}>${boss.name}</option>`
        ).join('');
        
        UIElements.modal.deleteConfirmInput.value = '';
        UIElements.modal.deleteBtn.disabled = true;

        AppState.editUserModal.show();
    }

    function validateDelete() {
        const user = AppState.allUsers.find(u => u.uid === UIElements.modal.uid.value);
        if (!user) return;
        UIElements.modal.deleteBtn.disabled = UIElements.modal.deleteConfirmInput.value.toLowerCase() !== user.email.toLowerCase();
    }

    async function saveUserChanges() {
        const saveBtn = UIElements.modal.saveBtn;
        const spinner = saveBtn.querySelector('.spinner-border');
        spinner.style.display = 'inline-block';
        saveBtn.disabled = true;

        const uid = UIElements.modal.uid.value;
        const dataToUpdate = {
            status: UIElements.modal.statusSelect.value,
            role: UIElements.modal.roleSelect.value,
            jefeAsignado: UIElements.modal.bossSelect.value,
        };
        try {
            await db.collection("usuarios").doc(uid).update(dataToUpdate);
            AppState.editUserModal.hide();
            Swal.fire({ icon: "success", title: "Cambios Guardados", timer: 1500, showConfirmButton: false });
            const userIndex = AppState.allUsers.findIndex(u => u.uid === uid);
            if (userIndex > -1) Object.assign(AppState.allUsers[userIndex], dataToUpdate);
            handleFilter();
        } catch (error) {
            console.error("Error al actualizar usuario:", error);
            Swal.fire("Error", "No se pudo actualizar el usuario.", "error");
        } finally {
            spinner.style.display = 'none';
            saveBtn.disabled = false;
        }
    }

    async function updateUserStatus(uid, status) {
        try {
            await db.collection("usuarios").doc(uid).update({ status });
            Swal.fire({ icon: "success", title: `Usuario ${status}`, timer: 1500, showConfirmButton: false });
            const userIndex = AppState.allUsers.findIndex(u => u.uid === uid);
            if (userIndex > -1) AppState.allUsers[userIndex].status = status;
            handleFilter();
        } catch (error) { Swal.fire("Error", `No se pudo cambiar el estado.`, "error"); }
    }

    async function removeUser(uid) {
        try {
            await db.collection("usuarios").doc(uid).delete();
            Swal.fire({ icon: "success", title: "Eliminado", text: "El usuario ha sido eliminado.", timer: 2000, showConfirmButton: false });
            AppState.allUsers = AppState.allUsers.filter(u => u.uid !== uid);
            handleFilter();
        } catch (error) { Swal.fire("Error", "No se pudo eliminar el usuario.", "error"); }
    }

    function copyToClipboard(text, element) {
        if (!navigator.clipboard) {
            Swal.fire('Error', 'Tu navegador no es compatible con la función de copiado.', 'error');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = element.className;
            element.className = 'bi bi-check-lg text-success';
            setTimeout(() => { element.className = originalIcon; }, 1500);
        }).catch(err => {
            console.error('Error al copiar texto: ', err);
            Swal.fire('Error', 'No se pudo copiar. Asegúrate de usar la página en un entorno seguro (https o localhost).', 'error');
        });
    }

});