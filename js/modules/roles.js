let rolesTable, editingId = null, allPermisos = [], groupedPermisos = {};

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    renderPage();
    await loadTable();
});

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-user-tag"></i> Roles del Sistema</h3>
                ${hasPermission('Roles', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Rol</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Nombre</th><th>Permisos</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal" style="max-width:450px;">
            <div class="modal-header"><h3 id="modal-title">Nuevo Rol</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Nombre del Rol *</label><input type="text" id="f-nombre" class="form-control" required></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="permisos-modal" class="modal-overlay"><div class="modal" style="max-width:650px;">
            <div class="modal-header"><h3>Permisos del Rol: <span id="permisos-rol-name"></span></h3><button class="modal-close" onclick="closePermisosModal()">&times;</button></div>
            <div class="modal-body" id="permisos-body"><div class="loading"><div class="spinner"></div>Cargando...</div></div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closePermisosModal()">Cancelar</button><button class="btn btn-primary" onclick="savePermisos()">Guardar</button></div>
        </div></div>
    `;
}

async function loadTable() {
    try {
        const d = await apiFetch('/roles');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) rolesTable.destroy();
        rolesTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'nombre' },
                { data: null, render: r => `${r.permisos_count ?? r.permisos?.length ?? 0} permisos` },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Roles', 'asignar-permisos') ? `<button class="btn btn-sm btn-info" onclick="openPermisosModal(${r.id_rol},'${r.nombre}')"><i class="fas fa-shield-alt"></i></button>` : ''}
                    ${hasPermission('Roles', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_rol})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Roles', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_rol},'${r.nombre}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar roles', 'error'); }
}

function openCreateModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nuevo Rol';
    document.getElementById('main-form').reset();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/roles/${id}`);
        const r = d.rol || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Rol';
        document.getElementById('f-nombre').value = r.nombre || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el rol', 'error'); }
}

async function save() {
    const nombre = document.getElementById('f-nombre').value.trim();
    if (!nombre) return Swal.fire('Validación', 'El nombre es obligatorio', 'warning');
    try {
        if (editingId) {
            await apiFetch(`/roles/${editingId}`, { method: 'PUT', body: { nombre } });
            Swal.fire('Actualizado', 'Rol actualizado', 'success');
        } else {
            await apiFetch('/roles', { method: 'POST', body: { nombre } });
            Swal.fire('Creado', 'Rol creado', 'success');
        }
        closeModal(); if (rolesTable) await reloadDataTable(rolesTable, '/roles');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id, name) {
    const r = await Swal.fire({ title: '¿Eliminar rol?', text: `Se eliminará "${name}".`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/roles/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Rol eliminado', 'success'); if (rolesTable) await reloadDataTable(rolesTable, '/roles'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

// Permisos
let permisosRolId = null;

async function openPermisosModal(id, name) {
    permisosRolId = id;
    document.getElementById('permisos-rol-name').textContent = name;
    document.getElementById('permisos-body').innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';
    document.getElementById('permisos-modal').classList.add('active');
    try {
        const d = await apiFetch(`/roles/${id}/permisos`);
        const resp = d.data || d;
        const rolePermIds = (resp.asignados || []).map(id => Number(id));
        const allPerms = resp.permisos || [];

        if (allPerms.length) {
            const groups = {};
            allPerms.forEach(p => {
                const mod = p.modulo?.nombre || p.modulo_name || p.modulo || 'General';
                if (!groups[mod]) groups[mod] = [];
                groups[mod].push({ id: p.id_permiso || p.id, nombre: p.accion?.nombre || p.accion_name || p.nombre || p.accion, checked: rolePermIds.includes(p.id_permiso || p.id) });
            });
            let html = '';
            Object.entries(groups).forEach(([mod, acciones]) => {
                html += `<div style="margin-bottom:16px;"><h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-cube"></i> ${mod}</h4><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
                acciones.forEach(a => { html += `<label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg);border-radius:6px;cursor:pointer;font-size:13px;"><input type="checkbox" class="permiso-cb" value="${a.id}" ${a.checked ? 'checked' : ''}> ${a.nombre}</label>`; });
                html += `</div></div>`;
            });
            document.getElementById('permisos-body').innerHTML = html;
        } else {
            document.getElementById('permisos-body').innerHTML = '<p class="text-muted">No hay permisos disponibles en el sistema.</p>';
        }
    } catch (e) {
        document.getElementById('permisos-body').innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> Error al cargar permisos: ${e.message}</div>`;
    }
}

function closePermisosModal() { document.getElementById('permisos-modal').classList.remove('active'); permisosRolId = null; }

async function savePermisos() {
    const permisos = [...document.querySelectorAll('.permiso-cb:checked')].map(cb => parseInt(cb.value));
    try {
        await apiFetch(`/roles/${permisosRolId}/permisos`, { method: 'POST', body: { permisos } });
        Swal.fire('Actualizado', 'Permisos asignados correctamente', 'success');
        closePermisosModal(); if (rolesTable) await reloadDataTable(rolesTable, '/roles');
    } catch (e) { Swal.fire('Error', e.message || 'Error al asignar permisos', 'error'); }
}
