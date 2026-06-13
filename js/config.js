const API_URL = 'http://127.0.0.1:8000/api';

async function apiFetch(endpoint, options = {}) {
    const fullUrl = `${API_URL}${endpoint}`;
    const token = localStorage.getItem('token');

    const headers = {
        'Accept': 'application/json',
        ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const isTokenValid = token && token !== 'undefined' && token !== 'null' && token.length > 20;
    if (isTokenValid) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (token) {
        console.warn(`[API] Token inválido detectado, limpiando: "${token}"`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    const config = { ...options, headers };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    try {
        console.log(`[API] ${options.method || 'GET'} ${fullUrl}`);

        const response = await fetch(fullUrl, config);

        let data = null;
        const text = await response.text();

        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text || '(sin contenido)' };
        }

        console.log(`[API] Response ${response.status}:`, data);

        if (response.status === 401) {
            console.warn('[API] 401 recibido - token inválido/expirado, cerrando sesión');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
                window.location.href = '/index.html';
            }
            const err = new Error(data?.message || 'Sesión expirada');
            err.status = 401;
            err.data = data;
            throw err;
        }

        if (!response.ok) {
            console.error(`[API ERROR] ${response.status} ${options.method || 'GET'} ${fullUrl}`, data);
            const err = new Error(data?.message || `Error ${response.status}`);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    } catch (error) {
        if (error.status) throw error;

        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error(`[API NETWORK ERROR] No se pudo conectar a ${fullUrl}`);
            throw {
                status: 0,
                message: 'No se puede conectar con el servidor. Verifica que Laravel esté corriendo en ' + API_URL,
                data: { server: API_URL, endpoint }
            };
        }

        console.error(`[API UNEXPECTED ERROR]`, error);
        throw {
            status: 0,
            message: error.message || 'Error inesperado',
            data: { server: API_URL, endpoint }
        };
    }
}

function showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';
}

function getStatusBadge(status) {
    const map = {
        'activo': 'badge-success',
        'inactivo': 'badge-secondary',
        'bloqueado': 'badge-danger',
        'pendiente': 'badge-warning',
        'aprobado': 'badge-primary',
        'despachado': 'badge-info',
        'entregado': 'badge-success',
        'en ruta': 'badge-info',
        'cancelado': 'badge-danger',
        'operativo': 'badge-success',
        'mantenimiento': 'badge-warning',
        'disponible': 'badge-success',
        'ocupado': 'badge-warning',
    };
    const cls = map[status?.toLowerCase()] || 'badge-secondary';
    return `<span class="badge ${cls}">${status}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-BO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-BO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
}

async function reloadDataTable(table, endpoint) {
    if (!table) return;
    try {
        const d = await apiFetch(endpoint);
        const data = Array.isArray(d) ? d : (d.data || []);
        table.clear();
        table.rows.add(data);
        table.draw();
    } catch (e) {
        console.error('Error refreshing table:', e);
    }
}

let userPermissions = [];

function loadPermissionsFromStorage() {
    try {
        const stored = localStorage.getItem('permisos');
        if (stored) {
            userPermissions = JSON.parse(stored);
        }
    } catch (e) {
        userPermissions = [];
    }
}

async function loadUserPermissions() {
    loadPermissionsFromStorage();
    try {
        const data = await apiFetch('/auth/user');
        const perms = data.permisos || data.data?.permisos || [];
        if (perms.length) {
            userPermissions = perms;
            localStorage.setItem('permisos', JSON.stringify(perms));
        }
    } catch (e) {
        console.error('Error loading permissions:', e);
    }
    return userPermissions;
}

function hasPermission(modulo, accion) {
    return userPermissions.some(p => p.modulo === modulo && p.accion === accion);
}

function getModulePermissions(modulo) {
    return userPermissions.filter(p => p.modulo === modulo).map(p => p.accion);
}

function anyModulePermisos() {
    return userPermissions.length > 0;
}
