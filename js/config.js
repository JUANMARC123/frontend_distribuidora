const API_URL = 'http://127.0.0.1:8000/api';

const ROOT_PATH = (() => {
    const path = window.location.pathname;
    return path.includes('/pages/') ? '../' : './';
})();

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
                window.location.href = ROOT_PATH + 'index.html';
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
        'preparacion': 'badge-primary',
        'preparación': 'badge-primary',
        'despachado': 'badge-info',
        'entregado': 'badge-success',
        'entrega parcial': 'badge-warning',
        'en ruta': 'badge-info',
        'fallido': 'badge-danger',
        'cancelado': 'badge-danger',
        'operativo': 'badge-success',
        'mantenimiento': 'badge-warning',
        'disponible': 'badge-success',
        'ocupado': 'badge-warning',
        'abierta': 'badge-success',
        'cerrada': 'badge-secondary',
        'revisada': 'badge-info',
    };
    const cls = map[status?.toLowerCase()] || 'badge-secondary';
    return `<span class="badge ${cls}">${status}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    if (/^\d{2}:\d{2}:\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
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
    const aliasMap = {
        logistica: ['Logistica', 'Logística', 'LogÃ­stica', 'LogÃƒÂ­stica', 'Despachos'],
        vehiculos: ['Vehiculos', 'Vehículos', 'VehÃ­culos', 'VehÃƒÂ­culos'],
        catalogos: ['Catalogos', 'Catálogos', 'CatÃ¡logos', 'CatÃƒÂ¡logos'],
        caja_diaria: ['Caja Diaria', 'Caja diaria', 'Caja'],
        control_rutas: ['Control Rutas', 'Controles Ruta', 'Control de Rutas'],
    };
    const key = normalizePermissionKey(modulo);
    const candidates = [modulo, ...(aliasMap[key] || [])].map(normalizePermissionKey);
    return userPermissions.some(p => {
        const permModulo = typeof p === 'object' ? p.modulo : (typeof p === 'string' ? p.split('-')[0] : p);
        const permAccion = typeof p === 'object' ? p.accion : (p.split('-')[1] || '');
        const normalizedModulo = normalizePermissionKey(permModulo);
        const normalizedAccion = normalizeAccion(permAccion);
        return candidates.includes(normalizedModulo) && normalizedAccion === accion;
    });
}

function normalizePermissionKey(value) {
    const raw = String(value || '').trim().toLowerCase();
    const mapped = raw
        .replace(/log.+stica/g, 'logistica')
        .replace(/veh.+culos/g, 'vehiculos')
        .replace(/cat.+logos/g, 'catalogos')
        .replace(/\s+/g, '_');
    return mapped.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeAccion(accion) {
    const a = String(accion || '').trim().toLowerCase();
    return a.replace(/-$/g, '');
}

const DOCUMENTOS = [
    { id: 'manual-usuario', titulo: 'Manual de Usuario', descripcion: 'Guía completa para el uso del sistema de gestión de distribución Pw3c.', archivo: 'docs/Manual_de_Usuario_Pw3c.pdf', icono: 'fa-user-graduate' },
    { id: 'manual-tecnico', titulo: 'Manual Técnico', descripcion: 'Documentación técnica del sistema, incluye arquitectura, API y configuración.', archivo: 'docs/Manual_Tecnico_Pw3c.pdf', icono: 'fa-cogs' },
];

function renderDocsBanner(container) {
    if (!container) return;
    container.innerHTML = '';
    DOCUMENTOS.forEach(doc => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-primary';
        btn.innerHTML = `<i class="fas fa-file-pdf"></i> ${doc.titulo}`;
        btn.onclick = () => verDocumento(doc.archivo);
        container.appendChild(btn);

        const btnDownload = document.createElement('button');
        btnDownload.className = 'btn btn-sm btn-success';
        btnDownload.innerHTML = `<i class="fas fa-download"></i>`;
        btnDownload.title = `Descargar ${doc.titulo}`;
        btnDownload.onclick = () => descargarDocumento(doc.archivo, `${doc.titulo}.pdf`);
        btnDownload.style.marginLeft = '4px';
        container.appendChild(btnDownload);
    });
}

function verDocumento(archivo) {
    window.open(archivo, '_blank');
}

function descargarDocumento(archivo, titulo) {
    const a = document.createElement('a');
    a.href = archivo;
    a.download = titulo || archivo.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function getToken() {
    return localStorage.getItem('token');
}

/* ─────────── Helpers compartidos ─────────── */

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseMoney(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

function money(value) {
    return parseMoney(value).toFixed(2);
}

function getRepartidorId(r) {
    return parseInt(r?.id_repartidor || r?.repartidor_id || r?.id || 0);
}

function getRepartidorName(r) {
    if (!r) return 'Sin repartidor';
    const userName = `${r.usuario?.nombre || ''} ${r.usuario?.apellido || ''}`.trim();
    return r.nombre || userName || r.nombre_completo || 'Sin repartidor';
}

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});
