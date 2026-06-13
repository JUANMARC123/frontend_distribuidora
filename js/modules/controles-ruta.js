let controlesTable, editingId = null, rutasList = [], repartidoresList = [], vehiculosList = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await Promise.all([loadRutas(), loadRepartidores(), loadVehiculos()]);
    renderPage();
});

async function loadRutas() {
    try { const d = await apiFetch('/rutas'); rutasList = Array.isArray(d) ? d : (d.data || []); } catch (e) { rutasList = []; }
}
async function loadRepartidores() {
    try { const d = await apiFetch('/repartidores'); repartidoresList = Array.isArray(d) ? d : (d.data || []); } catch (e) { repartidoresList = []; }
}
async function loadVehiculos() {
    try { const d = await apiFetch('/vehiculos'); vehiculosList = Array.isArray(d) ? d : (d.data || []); } catch (e) { vehiculosList = []; }
}

function repOption(r) { const u = r.usuario; return `${u?.nombre || ''} ${u?.apellido || ''} (CI: ${r.ci || '?'})`.trim(); }
function vehOption(v) { return `${v.placa} - ${v.modelo?.marca?.nombre_marca || ''} ${v.modelo?.nombre_modelo || ''}`; }

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-map-marked-alt"></i> Control de Rutas</h3>
                ${hasPermission('Control Rutas', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Control</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Ruta</th><th>Fecha</th><th>Repartidor</th><th>Vehículo</th><th>Salida</th><th>Llegada</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Control de Ruta</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-row">
                        <div class="form-group"><label>Ruta *</label><select id="f-ruta" class="form-control" required><option value="">Seleccione...</option>${rutasList.map(r => `<option value="${r.id_ruta}">${r.nombre_ruta}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Fecha *</label><input type="date" id="f-fecha" class="form-control" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Repartidor *</label><select id="f-repartidor" class="form-control" required><option value="">Seleccione...</option>${repartidoresList.map(r => `<option value="${r.id_repartidor}">${repOption(r)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Vehículo *</label><select id="f-vehiculo" class="form-control" required><option value="">Seleccione...</option>${vehiculosList.map(v => `<option value="${v.id_vehiculo}">${vehOption(v)}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Hora de Salida</label><input type="time" id="f-salida" class="form-control"></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/controles-ruta');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) controlesTable.destroy();
        controlesTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[1, 'desc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => r.ruta?.nombre_ruta || r.nombre_ruta || '—' },
                { data: null, render: r => formatDateShort(r.fecha_ruta) },
                { data: null, render: r => { const u = r.repartidor?.usuario; return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : (r.nombre_repartidor || '—'); } },
                { data: null, render: r => r.vehiculo?.placa || r.placa_vehiculo || '—' },
                { data: 'hora_salida', defaultContent: '—' },
                { data: null, render: r => r.hora_llegada_real || '<span class="text-muted">Pendiente</span>' },
                { data: null, render: r => `<div class="actions">
                    ${!r.hora_llegada_real && hasPermission('Control Rutas', 'registrar-llegada') ? `<button class="btn btn-sm btn-success" onclick="registrarLlegada(${r.id_control_ruta})"><i class="fas fa-flag-checkered"></i></button>` : ''}
                    ${hasPermission('Control Rutas', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_control_ruta})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Control Rutas', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_control_ruta})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar controles: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null; document.getElementById('modal-title').textContent = 'Nuevo Control de Ruta';
    document.getElementById('main-form').reset();
    document.getElementById('f-fecha').valueAsDate = new Date();
    document.getElementById('main-modal').classList.add('active');
}
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/controles-ruta/${id}`);
        const c = d.control_ruta || d.data || d;
        editingId = id; document.getElementById('modal-title').textContent = 'Editar Control de Ruta';
        document.getElementById('f-ruta').value = c.id_ruta || '';
        document.getElementById('f-fecha').value = c.fecha_ruta || '';
        document.getElementById('f-repartidor').value = c.id_repartidor || '';
        document.getElementById('f-vehiculo').value = c.id_vehiculo || '';
        document.getElementById('f-salida').value = c.hora_salida || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el control', 'error'); }
}

async function save() {
    const body = {
        id_ruta: parseInt(document.getElementById('f-ruta').value),
        fecha_ruta: document.getElementById('f-fecha').value,
        id_repartidor: parseInt(document.getElementById('f-repartidor').value),
        id_vehiculo: parseInt(document.getElementById('f-vehiculo').value),
        hora_salida: (document.getElementById('f-salida').value || null) ? document.getElementById('f-salida').value + ':00' : null,
    };
    if (!body.id_ruta || !body.fecha_ruta || !body.id_repartidor || !body.id_vehiculo)
        return Swal.fire('Validación', 'Todos los campos obligatorios deben estar completos', 'warning');
    try {
        if (editingId) { await apiFetch(`/controles-ruta/${editingId}`, { method: 'PUT', body }); Swal.fire('Actualizado', 'Control actualizado', 'success'); }
        else { await apiFetch('/controles-ruta', { method: 'POST', body }); Swal.fire('Creado', 'Control creado', 'success'); }
        closeModal(); if (controlesTable) await reloadDataTable(controlesTable, '/controles-ruta');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({ title: '¿Eliminar control?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/controles-ruta/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Control eliminado', 'success'); if (controlesTable) await reloadDataTable(controlesTable, '/controles-ruta'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

async function registrarLlegada(id) {
    const { value: hora } = await Swal.fire({
        title: 'Registrar Llegada',
        text: 'Ingrese la hora de llegada real:',
        input: 'time',
        inputValue: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        cancelButtonText: 'Cancelar',
    });
    if (!hora) return;
    try {
        await apiFetch(`/controles-ruta/${id}/registrar-llegada`, { method: 'POST', body: { hora_llegada_real: hora + ':00' } });
        Swal.fire('Registrado', 'Llegada registrada correctamente', 'success');
        if (controlesTable) await reloadDataTable(controlesTable, '/controles-ruta');
    } catch (e) { Swal.fire('Error', e.message || 'Error al registrar llegada', 'error'); }
}
