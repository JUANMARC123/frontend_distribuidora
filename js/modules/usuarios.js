let usuariosTable, editingId = null, estadosUsuario = [], allRoles = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Usuarios', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadEstadosUsuario(), loadRoles()]);
    renderPage();
});

async function loadEstadosUsuario() {
    try { const d = await apiFetch('/catalogos/estados-usuario'); estadosUsuario = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { estadosUsuario = [{ clave: 'activo', nombre_estado: 'Activo' }, { clave: 'bloqueado', nombre_estado: 'Bloqueado' }]; }
}

async function loadRoles() {
    try { const d = await apiFetch('/roles'); allRoles = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { allRoles = []; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-users"></i> Usuarios del Sistema</h3>
                ${hasPermission('Usuarios', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Usuario</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th><th>Roles</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Usuario</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-row">
                        <div class="form-group"><label>Nombre *</label><input type="text" id="f-nombre" class="form-control" required placeholder="Solo letras" oninput="this.value=this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g,''); generarEmail()"></div>
                        <div class="form-group"><label>Apellido *</label><input type="text" id="f-apellido" class="form-control" required placeholder="Solo letras" oninput="this.value=this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g,''); generarEmail()"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Email *</label><input type="email" id="f-email" class="form-control" required placeholder="Se genera automáticamente" oninput="this.dataset.manual='1'"></div>
                        <div class="form-group"><label>Teléfono</label><input type="text" id="f-telefono" class="form-control" placeholder="8 dígitos" maxlength="8" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8)"></div>
                    </div>
                    <div class="form-group"><label>Contraseña ${editingId ? '(dejar vacío para no cambiar)' : '*'}</label><input type="password" id="f-password" class="form-control" ${editingId ? '' : 'required'}></div>
                    <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosUsuario.map(e => `<option value="${e.clave}">${e.nombre_estado}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Rol</label><select id="f-rol" class="form-control"><option value="">Sin rol</option>${allRoles.map(r => `<option value="${r.id_rol}">${r.nombre}</option>`).join('')}</select></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="roles-modal" class="modal-overlay"><div class="modal" style="max-width:500px;">
            <div class="modal-header"><h3>Asignar Roles</h3><button class="modal-close" onclick="closeRolesModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Seleccione los roles para <strong id="roles-user-name"></strong></p>
                <div id="roles-list"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeRolesModal()">Cancelar</button><button class="btn btn-primary" onclick="saveRoles()">Guardar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/usuarios?per_page=-1');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) { usuariosTable.destroy(); }
        usuariosTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => `${r.nombre || ''} ${r.apellido || ''}` },
                { data: 'email' },
                { data: 'telefono', defaultContent: '—' },
                { data: null, render: r => getStatusBadge(r.estado || r.nombre_estado || 'Activo') },
                { data: null, render: r => (r.roles || []).map(rol => `<span class="badge badge-primary">${rol.nombre ?? rol.name ?? ''}</span>`).join(' ') || '—' },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Usuarios', 'asignar-roles') ? `<button class="btn btn-sm btn-info" onclick="openRolesModal(${r.id_usuario},'${r.nombre || ''} ${r.apellido || ''}')" title="Asignar Roles"><i class="fas fa-user-tag"></i></button>` : ''}
                    ${hasPermission('Usuarios', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_usuario})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Usuarios', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_usuario},'${r.nombre || ''} ${r.apellido || ''}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar usuarios', 'error'); }
}

function generarEmail() {
    const nombre   = document.getElementById('f-nombre').value.trim().split(' ')[0].toLowerCase();
    const apellido = document.getElementById('f-apellido').value.trim().split(' ')[0].toLowerCase();
    if (!nombre && !apellido) return;
    const limpiar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    const emailField = document.getElementById('f-email');
    // Solo autogenera si el campo está vacío o fue autogenerado antes
    if (!emailField.dataset.manual) {
        emailField.value = limpiar(nombre) + '.' + limpiar(apellido) + '@distribuidora.com';
    }
}

function openCreateModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nuevo Usuario';
    document.getElementById('main-form').reset();
    document.getElementById('f-email').dataset.manual = '';
    document.getElementById('f-password').required = true;
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/usuarios/${id}`);
        const u = d.usuario || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Usuario';
        document.getElementById('f-nombre').value = u.nombre || '';
        document.getElementById('f-apellido').value = u.apellido || '';
        document.getElementById('f-email').value = u.email || '';
        document.getElementById('f-telefono').value = u.telefono || '';
        document.getElementById('f-password').value = '';
        document.getElementById('f-password').required = false;
        document.getElementById('f-estado').value = u.estado || '';
        const rolActual = (u.roles && u.roles.length) ? (u.roles[0].id_rol ?? u.roles[0].id) : '';
        document.getElementById('f-rol').value = rolActual ?? '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el usuario', 'error'); }
}

async function save() {
    const body = {
        nombre: document.getElementById('f-nombre').value.trim(),
        apellido: document.getElementById('f-apellido').value.trim(),
        email: document.getElementById('f-email').value.trim(),
        telefono: document.getElementById('f-telefono').value.trim(),
        estado: document.getElementById('f-estado').value || 'activo',
    };

    const password = document.getElementById('f-password').value;

    if (password) body.password = password;

    const rolSel = document.getElementById('f-rol').value;
    body.roles = rolSel ? [parseInt(rolSel)] : [];

    if (!body.nombre || !body.apellido || !body.email) {
        return Swal.fire('Validación', 'Nombre, apellido y email son obligatorios.', 'warning');
    }

    if (body.telefono && body.telefono.length !== 8) {
        return Swal.fire('Validación', 'El teléfono debe tener exactamente 8 dígitos.', 'warning');
    }

    if (!editingId && !password) {
        return Swal.fire('Validación', 'La contraseña es obligatoria para crear un usuario.', 'warning');
    }

    if (password && password.length < 6) {
        return Swal.fire('Validación', 'La contraseña debe tener al menos 6 caracteres.', 'warning');
    }

    try {
        if (editingId) {
            await apiFetch(`/usuarios/${editingId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Usuario actualizado', 'success');
        } else {
            await apiFetch('/usuarios', { method: 'POST', body });
            Swal.fire('Creado', 'Usuario creado', 'success');
        }

        closeModal();

        if (usuariosTable) await reloadDataTable(usuariosTable, '/usuarios');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar', 'error');
    }
}

async function del(id, name) {
    const r = await Swal.fire({
        title: '¿Eliminar usuario?',
        text: `Se eliminará "${name}". Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });

    if (!r.isConfirmed) return;

    try {
        await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });

        Swal.fire('Eliminado', 'Usuario eliminado exitosamente.', 'success');

        if (usuariosTable) await reloadDataTable(usuariosTable, '/usuarios');

    } catch (e) {
        if (e.status === 409 || e.can_block || e.data?.can_block) {
            const block = await Swal.fire({
                title: 'Usuario con historial',
                html: `
                    <p>No se puede eliminar este usuario porque tiene pedidos registrados.</p>
                    <p>Para conservar el historial del sistema, puedes bloquearlo.</p>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Bloquear usuario',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f59e0b'
            });

            if (!block.isConfirmed) return;

            try {
                await apiFetch(`/usuarios/${id}/bloquear`, { method: 'PUT' });

                Swal.fire('Bloqueado', 'El usuario fue bloqueado correctamente.', 'success');

                if (usuariosTable) await reloadDataTable(usuariosTable, '/usuarios');
            } catch (err) {
                Swal.fire('Error', err.message || 'No se pudo bloquear el usuario', 'error');
            }

            return;
        }

        Swal.fire('Error', e.message || 'Error al eliminar', 'error');
    }
}

// Roles assignment
let rolesUserId = null;

async function openRolesModal(id, name) {
    rolesUserId = id;
    document.getElementById('roles-user-name').textContent = name;
    document.getElementById('roles-list').innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';
    document.getElementById('roles-modal').classList.add('active');
    try {
        // El endpoint /usuarios/{id}/roles no existe: se obtienen los roles del propio usuario.
        const d = await apiFetch(`/usuarios/${id}`);
        const u = d.usuario || d.data || d;
        const userRoleIds = (u.roles || []).map(r => r.id_rol ?? r.id);
        document.getElementById('roles-list').innerHTML = allRoles.length ? allRoles.map(r =>
            `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--border);">
                <input type="checkbox" class="rol-cb" value="${r.id_rol}" ${userRoleIds.includes(r.id_rol) ? 'checked' : ''}>
                <span>${r.nombre}</span>
            </label>`
        ).join('') : '<p class="text-muted">No hay roles disponibles</p>';
    } catch (e) { Swal.fire('Error', 'Error al cargar roles', 'error'); }
}

function closeRolesModal() { document.getElementById('roles-modal').classList.remove('active'); rolesUserId = null; }

async function saveRoles() {
    const roles = [...document.querySelectorAll('.rol-cb:checked')].map(cb => parseInt(cb.value));
    try {
        // El rol se actualiza en el propio usuario (el endpoint /usuarios/{id}/roles no existe).
        await apiFetch(`/usuarios/${rolesUserId}`, { method: 'PUT', body: { roles } });
        Swal.fire('Actualizado', 'Roles asignados correctamente', 'success');
        closeRolesModal();
        if (usuariosTable) await reloadDataTable(usuariosTable, '/usuarios');
    } catch (e) { Swal.fire('Error', e.message || 'Error al asignar roles', 'error'); }
}
