document.addEventListener('DOMContentLoaded', async function () {
    if (checkAuth()) {
        loadPermissionsFromStorage();
        await loadSidebar();
        setupSidebarToggle();
    }
});

async function loadSidebar() {
    const user = getUser();
    const initials = getUserInitials();
    const userName = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || (user.name || 'Usuario') : 'Usuario';
    const userRole = user?.roles?.length ? user.roles.map(r => r.nombre).join(', ') : 'Usuario';
    const inPages = window.location.pathname.includes('/pages/');
    const prefix = inPages ? '../' : './';
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const currentHash = window.location.hash || '';

    await loadUserPermissions();

    const navItems = [
        { section: 'Inicio' },
        { icon: 'fa-house', label: 'Dashboard', page: `${prefix}dashboard.html`, moduleKey: 'Dashboard' },
        { section: 'Centro Logistico' },
        { icon: 'fa-box', label: 'Pedidos', page: '/pages/logistica.html#pedidos', moduleKey: 'Pedidos' },
        { icon: 'fa-hand-pointer', label: 'Despachar', page: `${prefix}pages/logistica.html#planificacion`, moduleKey: 'Logistica' },
        { icon: 'fa-location-dot', label: 'Seguimiento', page: `${prefix}pages/logistica.html#seguimiento`, moduleKey: 'Logistica' },
        { icon: 'fa-clock-rotate-left', label: 'Historial', page: `${prefix}pages/logistica.html#historial`, moduleKey: 'Logistica' },
        { section: 'Recursos' },
        { icon: 'fa-hospital', label: 'Farmacias', page: `${prefix}pages/farmacias.html`, moduleKey: 'Farmacias' },
        { icon: 'fa-truck', label: 'Repartidores', page: `${prefix}pages/repartidores.html`, moduleKey: 'Repartidores' },
        { icon: 'fa-car', label: 'Vehiculos', page: `${prefix}pages/vehiculos.html`, moduleKey: 'Vehiculos' },
        { section: 'Finanzas' },
        { icon: 'fa-cash-register', label: 'Caja', page: `${prefix}pages/caja.html`, moduleKey: 'Caja Diaria' },
        { section: 'Administracion' },
        { icon: 'fa-users', label: 'Usuarios', page: `${prefix}pages/usuarios.html`, moduleKey: 'Usuarios' },
        { icon: 'fa-user-tag', label: 'Roles', page: `${prefix}pages/roles.html`, moduleKey: 'Roles' },
        { icon: 'fa-file-pdf', label: 'Documentos', page: `${prefix}pages/documentos.html`, moduleKey: 'Documentos' },
    ];

    const visibleItems = navItems.filter(item => item.section || !item.moduleKey || hasPermission(item.moduleKey, 'acceder'));

    let navHtml = '';
    visibleItems.forEach((item, idx) => {
        if (item.section) {
            const nextSectionIdx = visibleItems.findIndex((next, nextIdx) => nextIdx > idx && next.section);
            const sectionEnd = nextSectionIdx === -1 ? visibleItems.length : nextSectionIdx;
            const hasNextLink = visibleItems.slice(idx + 1, sectionEnd).some(next => !next.section);
            if (hasNextLink) navHtml += `<div class="nav-section">${item.section}</div>`;
            return;
        }

        const itemUrl = new URL(item.page, window.location.origin + window.location.pathname);
        const itemFile = itemUrl.pathname.split('/').pop();
        const itemHash = itemUrl.hash || '';
        const active = currentPage === itemFile && (!itemHash || currentHash === itemHash) ? ' active' : '';
        navHtml += `<a href="${item.page}" class="nav-item${active}">
            <i class="fas ${item.icon}"></i>
            <span>${item.label}</span>
        </a>`;
    });

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="logo"><i class="fas fa-pills"></i></div>
            <div>
                <h2>Pw3c Distribuidora</h2>
                <small>Sistema operativo</small>
            </div>
        </div>
        <div class="sidebar-user">
            <div class="avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${userName}</div>
                <div class="user-role">${userRole}</div>
            </div>
        </div>
        <nav id="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
            <button class="btn-logout" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i>
                Cerrar sesion
            </button>
        </div>
    `;
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('active');
        });
    }

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', function () {
            document.getElementById('sidebar').classList.remove('open');
            this.classList.remove('active');
        });
    }
}
