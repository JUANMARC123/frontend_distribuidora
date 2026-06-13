let repartidoresTable, editingId = null;
let usuariosDisponibles = [], estadosRep = [], extensiones = [], licencias = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await Promise.all([loadCatalogos()]);
    renderPage();
});

async function loadCatalogos() {
    try { const d = await apiFetch('/usuarios'); usuariosDisponibles = Array.isArray(d) ? d : (d.data || []); } catch (e) { usuariosDisponibles = []; }
    try { const d = await apiFetch('/catalogos/estados-repartidor'); estadosRep = Array.isArray(d) ? d : (d.data || []); } catch (e) { estadosRep = [{ id_estado_repartidor: 1, nombre_estado: 'Disponible' }, { id_estado_repartidor: 2, nombre_estado: 'Ocupado' }, { id_estado_repartidor: 3, nombre_estado: 'Inactivo' }]; }
    try { const d = await apiFetch('/catalogos/extensiones-ci'); extensiones = Array.isArray(d) ? d : (d.data || []); } catch (e) { extensiones = [{ id_extension_ci: 1, nombre_extension: 'LP' }, { id_extension_ci: 2, nombre_extension: 'SC' }, { id_extension_ci: 3, nombre_extension: 'CB' }]; }
    try { const d = await apiFetch('/catalogos/licencias'); licencias = Array.isArray(d) ? d : (d.data || []); } catch (e) { licencias = [{ id_licencia: 1, categoria: 'A' }, { id_licencia: 2, categoria: 'B' }, { id_licencia: 3, categoria: 'C' }]; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-truck"></i> Repartidores</h3>
                ${hasPermission('Repartidores', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Repartidor</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Nombre</th><th>CI</th><th>Licencia</th><th>Estado</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Repartidor</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Usuario *</label><select id="f-usuario" class="form-control" required><option value="">Seleccione un usuario...</option>${usuariosDisponibles.map(u => `<option value="${u.id_usuario}">${u.nombre || ''} ${u.apellido || ''} (${u.email})</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>CI *</label><input type="text" id="f-ci" class="form-control" required></div>
                        <div class="form-group"><label>Extensión CI</label><select id="f-extension" class="form-control"><option value="">Seleccione...</option>${extensiones.map(e => `<option value="${e.id_extension_ci}">${e.nombre_extension}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Licencia</label><select id="f-licencia" class="form-control"><option value="">Seleccione...</option>${licencias.map(l => `<option value="${l.id_licencia}">${l.categoria}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosRep.map(e => `<option value="${e.id_estado_repartidor}">${e.nombre_estado}</option>`).join('')}</select></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Seleccione el nuevo estado para el repartidor <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Nuevo Estado</label><select id="s-estado" class="form-control">${estadosRep.map(e => `<option value="${e.id_estado_repartidor}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/repartidores');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) repartidoresTable.destroy();
        repartidoresTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => { const u = r.usuario; return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : (r.nombre_usuario || '—'); } },
                { data: null, render: r => `${r.ci || '—'} ${r.extension?.nombre_extension || r.nombre_extension || ''}` },
                { data: null, render: r => r.licencia?.categoria || r.categoria_licencia || '—' },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || r.nombre_estado || '—') },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Repartidores', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_repartidor},'${(r.usuario?.nombre || r.nombre || '')}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Repartidores', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_repartidor})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Repartidores', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_repartidor})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar repartidores: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null; document.getElementById('modal-title').textContent = 'Nuevo Repartidor';
    document.getElementById('main-form').reset(); document.getElementById('main-modal').classList.add('active');
}
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/repartidores/${id}`);
        const r = d.repartidor || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Repartidor';
        document.getElementById('f-usuario').value = r.id_usuario || '';
        document.getElementById('f-ci').value = r.ci || '';
        document.getElementById('f-extension').value = r.id_extension_ci || '';
        document.getElementById('f-licencia').value = r.id_licencia || '';
        document.getElementById('f-estado').value = r.id_estado_repartidor || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el repartidor', 'error'); }
}

async function save() {
    const body = {
        id_usuario: parseInt(document.getElementById('f-usuario').value),
        ci: document.getElementById('f-ci').value.trim(),
        id_extension_ci: parseInt(document.getElementById('f-extension').value) || null,
        id_licencia: parseInt(document.getElementById('f-licencia').value) || null,
        id_estado_repartidor: parseInt(document.getElementById('f-estado').value),
    };
    if (!body.id_usuario || !body.ci) return Swal.fire('Validación', 'Usuario y CI son obligatorios', 'warning');
    try {
        if (editingId) { await apiFetch(`/repartidores/${editingId}`, { method: 'PUT', body }); Swal.fire('Actualizado', 'Repartidor actualizado', 'success'); }
        else { await apiFetch('/repartidores', { method: 'POST', body }); Swal.fire('Creado', 'Repartidor creado', 'success'); }
        closeModal(); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({ title: '¿Eliminar repartidor?', text: 'Esta acción no se puede deshacer.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/repartidores/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Repartidor eliminado', 'success'); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

let estadoRepId = null;
function openEstadoModal(id, name) { estadoRepId = id; document.getElementById('estado-ref').textContent = name; document.getElementById('s-estado').value = ''; document.getElementById('estado-modal').classList.add('active'); }
function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoRepId = null; }
async function changeEstado() {
    const id_estado_repartidor = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_repartidor) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try { await apiFetch(`/repartidores/${estadoRepId}/cambiar-estado`, { method: 'POST', body: { id_estado_repartidor } }); Swal.fire('Actualizado', 'Estado cambiado', 'success'); closeEstadoModal(); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}
