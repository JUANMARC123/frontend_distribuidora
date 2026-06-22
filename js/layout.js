document.addEventListener('DOMContentLoaded', async function () {
    if (checkAuth()) {
        loadPermissionsFromStorage();
        await loadSidebar();
        setupSidebarToggle();
    }
});

const MODULE_KEYS = {
    'Dashboard': 'Dashboard',
    'Reportes': 'Reportes',
    'Usuarios': 'Usuarios',
    'Roles': 'Roles',
    'Farmacias': 'Farmacias',
    'Pedidos': 'Pedidos',
    'Repartidores': 'Repartidores',
    'Vehículos': 'Vehículos',
    'Rutas': 'Rutas',
    'Control Rutas': 'Control Rutas',
    'Despachos': 'Despachos',
    'Ventas': 'Ventas',
    'Almacenes': 'Almacenes',
};

async function loadSidebar() {
    const user = getUser();
    const initials = getUserInitials();
    const userName = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || (user.name || 'Usuario') : 'Usuario';
    const userRole = user?.roles?.length ? user.roles.map(r => r.nombre).join(', ') : 'Usuario';

    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const currentDir = window.location.pathname.includes('/pages/') ? '../' : '';

    if (!anyModulePermisos() || userPermissions.length === 0) {
        await loadUserPermissions();
    }

    const allNavItems = [
        { section: 'Principal' },
        { icon: 'fa-chart-pie', label: 'Dashboard', page: currentDir + 'dashboard.html', moduleKey: 'Dashboard' },
        { icon: 'fa-file-pdf', label: 'Documentos', page: currentDir + 'pages/documentos.html', moduleKey: 'Documentos' },
        { icon: 'fa-file-alt', label: 'Reportes', page: currentDir + 'pages/reportes.html', moduleKey: 'Reportes' },
        { section: 'Gestión' },
        { icon: 'fa-users', label: 'Usuarios', page: currentDir + 'pages/usuarios.html', moduleKey: 'Usuarios' },
        { icon: 'fa-user-tag', label: 'Roles', page: currentDir + 'pages/roles.html', moduleKey: 'Roles' },
        { icon: 'fa-list', label: 'Catálogos', page: currentDir + 'pages/catalogos.html', moduleKey: 'Usuarios' },
        { icon: 'fa-hospital', label: 'Farmacias', page: currentDir + 'pages/farmacias.html', moduleKey: 'Farmacias' },
        { icon: 'fa-box', label: 'Pedidos', page: currentDir + 'pages/pedidos.html', moduleKey: 'Pedidos' },
        { icon: 'fa-credit-card', label: 'Ventas', page: currentDir + 'pages/ventas.html', moduleKey: 'Ventas' },
        { section: 'Logística' },
        { icon: 'fa-truck', label: 'Repartidores', page: currentDir + 'pages/repartidores.html', moduleKey: 'Repartidores' },
        { icon: 'fa-car', label: 'Vehículos', page: currentDir + 'pages/vehiculos.html', moduleKey: 'Vehículos' },
        { icon: 'fa-route', label: 'Rutas', page: currentDir + 'pages/rutas.html', moduleKey: 'Rutas' },
        { icon: 'fa-map-marked-alt', label: 'Control Rutas', page: currentDir + 'pages/controles-ruta.html', moduleKey: 'Control Rutas' },
        { icon: 'fa-clipboard-check', label: 'Despachos', page: currentDir + 'pages/despachos.html', moduleKey: 'Despachos' },
        { section: 'Inventario' },
        { icon: 'fa-capsules', label: 'Productos', page: currentDir + 'pages/productos.html', moduleKey: 'Productos' },
        { icon: 'fa-warehouse', label: 'Inventario', page: currentDir + 'pages/inventario.html', moduleKey: 'Inventario' },
        { icon: 'fa-building', label: 'Almacenes', page: currentDir + 'pages/almacenes.html', moduleKey: 'Almacenes' },
        { icon: 'fa-file-invoice', label: 'Compras', page: currentDir + 'pages/ordenes-compra.html', moduleKey: 'Compras' },
        { icon: 'fa-undo-alt', label: 'Devoluciones', page: currentDir + 'pages/devoluciones.html', moduleKey: 'Devoluciones' },
        { icon: 'fa-tags', label: 'Promociones', page: currentDir + 'pages/promociones.html', moduleKey: 'Promociones' },
    ];

    const navItems = allNavItems.filter(item => {
        if (item.section) return true;
        if (!item.moduleKey) return true;
        return hasPermission(item.moduleKey, 'acceder');
    });

    let navHtml = '';
    let lastWasSection = false;
    navItems.forEach(item => {
        if (item.section) {
            navHtml += `<div class="nav-section">${item.section}</div>`;
            lastWasSection = true;
        } else {
            const pageFile = item.page.split('/').pop();
            const active = currentPage === pageFile ? ' active' : '';
            navHtml += `<a href="${item.page}" class="nav-item${active}">
                <i class="fas ${item.icon}"></i>
                <span>${item.label}</span>
            </a>`;
            lastWasSection = false;
        }
    });

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="logo"><i class="fas fa-pills"></i></div>
            <div>
                <h2>Pw3c Distribuidora</h2>
                <small>Sistema de Gestión</small>
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
                Cerrar Sesión
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
