let despachosTable, editingId = null;
let pedidosList = [], paradasList = [], controlesList = [], estadosDesp = [];
let tiposIncidencia = [], tiposEvidencia = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Despachos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadCatalogos()]);
    renderPage();
});

async function loadCatalogos() {
    try { const d = await apiFetch('/pedidos'); pedidosList = Array.isArray(d) ? d : (d.data || []); } catch (e) { pedidosList = []; }
    try { const d = await apiFetch('/controles-ruta'); controlesList = Array.isArray(d) ? d : (d.data || []); } catch (e) { controlesList = []; }
    try { const d = await apiFetch('/catalogos/estados-despacho'); estadosDesp = Array.isArray(d) ? d : (d.data || []); } catch (e) { estadosDesp = [{ id_estado_despacho: 1, nombre_estado: 'Pendiente' }, { id_estado_despacho: 2, nombre_estado: 'En ruta' }, { id_estado_despacho: 3, nombre_estado: 'Entregado' }, { id_estado_despacho: 4, nombre_estado: 'Cancelado' }]; }
    try { const d = await apiFetch('/catalogos/tipos-incidencia'); tiposIncidencia = Array.isArray(d) ? d : (d.data || []); } catch (e) { tiposIncidencia = [{ id_tipo_incidencia: 1, nombre_tipo: 'Producto dañado' }, { id_tipo_incidencia: 2, nombre_tipo: 'Retraso' }, { id_tipo_incidencia: 3, nombre_tipo: 'Dirección incorrecta' }, { id_tipo_incidencia: 4, nombre_tipo: 'Cliente ausente' }]; }
    try { const d = await apiFetch('/catalogos/tipos-evidencia'); tiposEvidencia = Array.isArray(d) ? d : (d.data || []); } catch (e) { tiposEvidencia = [{ id_tipo_evidencia: 1, nombre_tipo: 'Foto' }, { id_tipo_evidencia: 2, nombre_tipo: 'Firma' }, { id_tipo_evidencia: 3, nombre_tipo: 'PDF' }]; }
    try { const d = await apiFetch('/rutas'); const rutas = Array.isArray(d) ? d : (d.data || []); const allParadas = []; if (hasPermission('Rutas', 'gestionar-paradas')) { for (const r of rutas) { try { const p = await apiFetch(`/rutas/${r.id_ruta}/paradas`); const parsed = Array.isArray(p) ? p : (p.data || []); parsed.forEach(p2 => allParadas.push({ ...p2, ruta_nombre: r.nombre_ruta })); } catch (e) {} } } paradasList = allParadas; } catch (e) { paradasList = []; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-clipboard-check"></i> Despachos</h3>
                ${hasPermission('Despachos', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Despacho</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>ID</th><th>Pedido</th><th>Parada</th><th>Control Ruta</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Despacho</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-row">
                        <div class="form-group"><label>Pedido *</label><select id="f-pedido" class="form-control" required><option value="">Seleccione...</option>${pedidosList.map(p => `<option value="${p.id_pedido}">#${p.id_pedido} - ${p.farmacia?.nombre || ''}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Parada</label><select id="f-parada" class="form-control"><option value="">Seleccione...</option>${paradasList.map(p => `<option value="${p.id_parada}">${p.ruta_nombre || '?'} - ${p.farmacia?.nombre || p.nombre_farmacia || '?'} (Ord:${p.orden_parada})</option>`).join('')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Control de Ruta</label><select id="f-control" class="form-control"><option value="">Seleccione...</option>${controlesList.map(c => `<option value="${c.id_control_ruta}">${c.ruta?.nombre_ruta || ''} - ${formatDateShort(c.fecha_ruta)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosDesp.map(e => `<option value="${e.id_estado_despacho}">${e.nombre_estado}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-group"><label>Fecha y Hora de Despacho</label><input type="datetime-local" id="f-fecha" class="form-control"></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Nuevo estado para despacho <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Estado</label><select id="s-estado" class="form-control">${estadosDesp.map(e => `<option value="${e.id_estado_despacho}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>

        <div id="incidencias-modal" class="modal-overlay"><div class="modal" style="max-width:700px;">
            <div class="modal-header"><h3>Incidencias - Despacho #<span id="inc-despacho-ref"></span></h3><button class="modal-close" onclick="closeIncidenciasModal()">&times;</button></div>
            <div class="modal-body">
                <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">${hasPermission('Despachos', 'gestionar-incidencias') ? '<button class="btn btn-sm btn-primary" onclick="openIncidenciaForm()"><i class="fas fa-plus"></i> Agregar Incidencia</button>' : ''}</div>
                <div class="table-container"><table id="incidencias-table" class="display" style="width:100%"><thead><tr><th>Tipo</th><th>Descripción</th><th>Fecha</th><th>Acciones</th></tr></thead></table></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeIncidenciasModal()">Cerrar</button></div>
        </div></div>
        <div id="incidencia-form-modal" class="modal-overlay"><div class="modal" style="max-width:500px;">
            <div class="modal-header"><h3 id="incidencia-form-title">Nueva Incidencia</h3><button class="modal-close" onclick="closeIncidenciaForm()">&times;</button></div>
            <div class="modal-body">
                <form id="incidencia-form">
                    <div class="form-group"><label>Tipo *</label><select id="i-tipo" class="form-control" required><option value="">Seleccione...</option>${tiposIncidencia.map(t => `<option value="${t.id_tipo_incidencia}">${t.nombre_tipo}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Descripción *</label><textarea id="i-descripcion" class="form-control" rows="3" required></textarea></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeIncidenciaForm()">Cancelar</button><button class="btn btn-primary" onclick="saveIncidencia()">Guardar</button></div>
        </div></div>

        <div id="evidencias-modal" class="modal-overlay"><div class="modal" style="max-width:700px;">
            <div class="modal-header"><h3>Evidencias - Despacho #<span id="ev-despacho-ref"></span></h3><button class="modal-close" onclick="closeEvidenciasModal()">&times;</button></div>
            <div class="modal-body">
                <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">${hasPermission('Despachos', 'gestionar-evidencias') ? '<button class="btn btn-sm btn-primary" onclick="openEvidenciaForm()"><i class="fas fa-plus"></i> Subir Evidencia</button>' : ''}</div>
                <div class="table-container"><table id="evidencias-table" class="display" style="width:100%"><thead><tr><th>Tipo</th><th>Archivo</th><th>Fecha</th><th>Acciones</th></tr></thead></table></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEvidenciasModal()">Cerrar</button></div>
        </div></div>
        <div id="evidencia-form-modal" class="modal-overlay"><div class="modal" style="max-width:500px;">
            <div class="modal-header"><h3 id="evidencia-form-title">Subir Evidencia</h3><button class="modal-close" onclick="closeEvidenciaForm()">&times;</button></div>
            <div class="modal-body">
                <form id="evidencia-form">
                    <div class="form-group"><label>Tipo de Evidencia *</label><select id="e-tipo" class="form-control" required><option value="">Seleccione...</option>${tiposEvidencia.map(t => `<option value="${t.id_tipo_evidencia}">${t.nombre_tipo}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Archivo *</label><input type="file" id="e-archivo" class="form-control" required style="padding:8px;"></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEvidenciaForm()">Cancelar</button><button class="btn btn-primary" onclick="saveEvidencia()">Subir</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/despachos');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) despachosTable.destroy();
        despachosTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'desc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'id_despacho' },
                { data: null, render: r => `#${r.pedido?.id_pedido || r.id_pedido || '?'}` },
                { data: null, render: r => r.parada?.farmacia?.nombre || r.nombre_farmacia || '—' },
                { data: null, render: r => r.control_ruta?.ruta?.nombre_ruta || r.nombre_ruta || '—' },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || r.nombre_estado || '—') },
                { data: null, render: r => formatDate(r.fecha_hora_despacho) },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Despachos', 'gestionar-incidencias') ? `<button class="btn btn-sm btn-info" onclick="openIncidenciasModal(${r.id_despacho})" title="Incidencias"><i class="fas fa-exclamation-triangle"></i></button>` : ''}
                    ${hasPermission('Despachos', 'gestionar-evidencias') ? `<button class="btn btn-sm btn-info" onclick="openEvidenciasModal(${r.id_despacho})" title="Evidencias"><i class="fas fa-camera"></i></button>` : ''}
                    ${hasPermission('Despachos', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_despacho},'#${r.id_despacho}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Despachos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_despacho})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Despachos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_despacho})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar despachos: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null; document.getElementById('modal-title').textContent = 'Nuevo Despacho';
    document.getElementById('main-form').reset();
    document.getElementById('f-fecha').value = new Date().toISOString().slice(0, 16);
    document.getElementById('main-modal').classList.add('active');
}
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/despachos/${id}`);
        const desp = d.despacho || d.data || d;
        editingId = id; document.getElementById('modal-title').textContent = 'Editar Despacho';
        document.getElementById('f-pedido').value = desp.id_pedido || '';
        document.getElementById('f-parada').value = desp.id_parada || '';
        document.getElementById('f-control').value = desp.id_control_ruta || '';
        document.getElementById('f-estado').value = desp.id_estado_despacho || '';
        document.getElementById('f-fecha').value = desp.fecha_hora_despacho ? desp.fecha_hora_despacho.slice(0, 16) : '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el despacho', 'error'); }
}

async function save() {
    const body = {
        id_pedido: parseInt(document.getElementById('f-pedido').value),
        id_parada: parseInt(document.getElementById('f-parada').value) || null,
        id_control_ruta: parseInt(document.getElementById('f-control').value) || null,
        id_estado_despacho: parseInt(document.getElementById('f-estado').value),
        fecha_hora_despacho: document.getElementById('f-fecha').value || null,
    };
    if (!body.id_pedido) return Swal.fire('Validación', 'Seleccione un pedido', 'warning');
    try {
        if (editingId) { await apiFetch(`/despachos/${editingId}`, { method: 'PUT', body }); Swal.fire('Actualizado', 'Despacho actualizado', 'success'); }
        else { await apiFetch('/despachos', { method: 'POST', body }); Swal.fire('Creado', 'Despacho creado', 'success'); }
        closeModal(); if (despachosTable) await reloadDataTable(despachosTable, '/despachos');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({ title: '¿Eliminar despacho?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/despachos/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Despacho eliminado', 'success'); if (despachosTable) await reloadDataTable(despachosTable, '/despachos'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

// Cambiar estado
let estadoDespId = null;
function openEstadoModal(id, ref) { estadoDespId = id; document.getElementById('estado-ref').textContent = ref; document.getElementById('s-estado').value = ''; document.getElementById('estado-modal').classList.add('active'); }
function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoDespId = null; }
async function changeEstado() {
    const id_estado_despacho = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_despacho) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try { await apiFetch(`/despachos/${estadoDespId}/cambiar-estado`, { method: 'POST', body: { id_estado_despacho } }); Swal.fire('Actualizado', 'Estado cambiado', 'success'); closeEstadoModal(); if (despachosTable) await reloadDataTable(despachosTable, '/despachos'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}

// Incidencias nested
let currentDespachoId = null, incidenciasDT = null, editingIncidenciaId = null;

async function openIncidenciasModal(id) {
    currentDespachoId = id; document.getElementById('inc-despacho-ref').textContent = id;
    document.getElementById('incidencias-modal').classList.add('active');
    await loadIncidencias();
}
function closeIncidenciasModal() { document.getElementById('incidencias-modal').classList.remove('active'); currentDespachoId = null; }

async function loadIncidencias() {
    try {
        const d = await apiFetch(`/despachos/${currentDespachoId}/incidencias`);
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#incidencias-table')) incidenciasDT.destroy();
        incidenciasDT = $('#incidencias-table').DataTable({
            data, pageLength: 5, pagingType: 'simple', order: [[2, 'desc']], searching: false,
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => r.tipo?.nombre_tipo || r.nombre_tipo || '—' },
                { data: 'descripcion' },
                { data: null, render: r => formatDate(r.fecha_incidencia) },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Despachos', 'gestionar-incidencias') ? `<button class="btn btn-sm btn-warning" onclick="editIncidencia(${r.id_incidencia})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Despachos', 'gestionar-incidencias') ? `<button class="btn btn-sm btn-danger" onclick="delIncidencia(${r.id_incidencia})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { console.error('Error loading incidencias:', e); }
}

function openIncidenciaForm() {
    editingIncidenciaId = null;
    document.getElementById('incidencia-form-title').textContent = 'Nueva Incidencia';
    document.getElementById('incidencia-form').reset();
    document.getElementById('incidencia-form-modal').classList.add('active');
}
function closeIncidenciaForm() { document.getElementById('incidencia-form-modal').classList.remove('active'); editingIncidenciaId = null; }

async function editIncidencia(id) {
    try {
        const d = await apiFetch(`/despachos/${currentDespachoId}/incidencias/${id}`);
        const inc = d.incidencia || d.data || d;
        editingIncidenciaId = id;
        document.getElementById('incidencia-form-title').textContent = 'Editar Incidencia';
        document.getElementById('i-tipo').value = inc.id_tipo_incidencia || '';
        document.getElementById('i-descripcion').value = inc.descripcion || '';
        document.getElementById('incidencia-form-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la incidencia', 'error'); }
}

async function saveIncidencia() {
    const body = {
        id_tipo_incidencia: parseInt(document.getElementById('i-tipo').value),
        descripcion: document.getElementById('i-descripcion').value.trim(),
    };
    if (!body.id_tipo_incidencia || !body.descripcion) return Swal.fire('Validación', 'Tipo y descripción son obligatorios', 'warning');
    try {
        if (editingIncidenciaId) { await apiFetch(`/despachos/${currentDespachoId}/incidencias/${editingIncidenciaId}`, { method: 'PUT', body }); Swal.fire('Actualizada', 'Incidencia actualizada', 'success'); }
        else { await apiFetch(`/despachos/${currentDespachoId}/incidencias`, { method: 'POST', body }); Swal.fire('Creada', 'Incidencia registrada', 'success'); }
        closeIncidenciaForm(); await loadIncidencias();
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar incidencia', 'error'); }
}

async function delIncidencia(id) {
    const r = await Swal.fire({ title: '¿Eliminar incidencia?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/despachos/${currentDespachoId}/incidencias/${id}`, { method: 'DELETE' }); Swal.fire('Eliminada', 'Incidencia eliminada', 'success'); await loadIncidencias(); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

// Evidencias nested
let evidenciasDT = null, editingEvidenciaId = null;

async function openEvidenciasModal(id) {
    currentDespachoId = id; document.getElementById('ev-despacho-ref').textContent = id;
    document.getElementById('evidencias-modal').classList.add('active');
    await loadEvidencias();
}
function closeEvidenciasModal() { document.getElementById('evidencias-modal').classList.remove('active'); }

async function loadEvidencias() {
    try {
        const d = await apiFetch(`/despachos/${currentDespachoId}/evidencias`);
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#evidencias-table')) evidenciasDT.destroy();
        evidenciasDT = $('#evidencias-table').DataTable({
            data, pageLength: 5, pagingType: 'simple', order: [[2, 'desc']], searching: false,
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => r.tipo?.nombre_tipo || r.nombre_tipo || '—' },
                { data: null, render: r => r.archivo ? `<a href="${API_URL.replace('/api', '/storage/')}${r.archivo}" target="_blank" class="btn btn-sm btn-outline"><i class="fas fa-eye"></i> Ver</a>` : '—' },
                { data: null, render: r => formatDate(r.fecha_registro) },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Despachos', 'gestionar-evidencias') ? `<button class="btn btn-sm btn-danger" onclick="delEvidencia(${r.id_evidencia})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { console.error('Error loading evidencias:', e); }
}

function openEvidenciaForm() {
    document.getElementById('evidencia-form').reset();
    document.getElementById('evidencia-form-modal').classList.add('active');
}
function closeEvidenciaForm() { document.getElementById('evidencia-form-modal').classList.remove('active'); }

async function saveEvidencia() {
    const id_tipo_evidencia = parseInt(document.getElementById('e-tipo').value);
    const archivo = document.getElementById('e-archivo').files[0];
    if (!id_tipo_evidencia || !archivo) return Swal.fire('Validación', 'Tipo y archivo son obligatorios', 'warning');

    const formData = new FormData();
    formData.append('id_tipo_evidencia', id_tipo_evidencia);
    formData.append('archivo', archivo);

    try {
        await apiFetch(`/despachos/${currentDespachoId}/evidencias`, {
            method: 'POST',
            body: formData,
        });
        Swal.fire('Subida', 'Evidencia subida correctamente', 'success');
        closeEvidenciaForm(); await loadEvidencias();
    } catch (e) { Swal.fire('Error', e.message || 'Error al subir evidencia', 'error'); }
}

async function delEvidencia(id) {
    const r = await Swal.fire({ title: '¿Eliminar evidencia?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/despachos/${currentDespachoId}/evidencias/${id}`, { method: 'DELETE' }); Swal.fire('Eliminada', 'Evidencia eliminada', 'success'); await loadEvidencias(); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}
