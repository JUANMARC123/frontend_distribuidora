let vehiculosTable, editingId = null, modelosList = [], capacidadesList = [], estadosVeh = [], marcasMap = {};

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await loadCatalogos();
    renderPage();
});

async function loadCatalogos() {
    try { const d = await apiFetch('/catalogos/marcas'); const marcas = Array.isArray(d) ? d : (d.data || []); marcas.forEach(m => marcasMap[m.id_marca] = m.nombre_marca); } catch (e) {}
    try { const d = await apiFetch('/catalogos/modelos'); modelosList = Array.isArray(d) ? d : (d.data || []); } catch (e) { modelosList = []; }
    try { const d = await apiFetch('/catalogos/capacidades'); capacidadesList = Array.isArray(d) ? d : (d.data || []); } catch (e) { capacidadesList = [{ id_capacidad: 1, capacidad_kg: 500 }, { id_capacidad: 2, capacidad_kg: 1000 }, { id_capacidad: 3, capacidad_kg: 2000 }]; }
    try { const d = await apiFetch('/catalogos/estados-vehiculo'); estadosVeh = Array.isArray(d) ? d : (d.data || []); } catch (e) { estadosVeh = [{ id_estado_vehiculo: 1, nombre_estado: 'Operativo' }, { id_estado_vehiculo: 2, nombre_estado: 'Mantenimiento' }, { id_estado_vehiculo: 3, nombre_estado: 'Fuera de servicio' }]; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-car"></i> Vehículos</h3>
                ${hasPermission('Vehículos', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Vehículo</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Placa</th><th>Marca</th><th>Modelo</th><th>Capacidad</th><th>Estado</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Vehículo</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-row">
                        <div class="form-group"><label>Placa *</label><input type="text" id="f-placa" class="form-control" required></div>
                        <div class="form-group"><label>Modelo</label><select id="f-modelo" class="form-control"><option value="">Seleccione...</option>${modelosList.map(m => `<option value="${m.id_modelo}" data-marca="${m.id_marca}">${marcasMap[m.id_marca] || '?'} - ${m.nombre_modelo}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Capacidad (kg)</label><select id="f-capacidad" class="form-control"><option value="">Seleccione...</option>${capacidadesList.map(c => `<option value="${c.id_capacidad}">${c.capacidad_kg} kg</option>`).join('')}</select></div>
                        <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosVeh.map(e => `<option value="${e.id_estado_vehiculo}">${e.nombre_estado}</option>`).join('')}</select></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Nuevo estado para <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Estado</label><select id="s-estado" class="form-control">${estadosVeh.map(e => `<option value="${e.id_estado_vehiculo}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/vehiculos');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) vehiculosTable.destroy();
        vehiculosTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'placa' },
                { data: null, render: r => r.modelo?.marca?.nombre_marca || r.nombre_marca || '—' },
                { data: null, render: r => r.modelo?.nombre_modelo || r.nombre_modelo || '—' },
                { data: null, render: r => r.capacidad ? `${r.capacidad.capacidad_kg} kg` : (r.capacidad_kg ? `${r.capacidad_kg} kg` : '—') },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || r.nombre_estado || '—') },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Vehículos', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_vehiculo},'${r.placa}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Vehículos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_vehiculo})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Vehículos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_vehiculo},'${r.placa}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar vehículos: ' + e.message, 'error'); }
}

function openCreateModal() { editingId = null; document.getElementById('modal-title').textContent = 'Nuevo Vehículo'; document.getElementById('main-form').reset(); document.getElementById('main-modal').classList.add('active'); }
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/vehiculos/${id}`);
        const v = d.vehiculo || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Vehículo';
        document.getElementById('f-placa').value = v.placa || '';
        document.getElementById('f-modelo').value = v.id_modelo || '';
        document.getElementById('f-capacidad').value = v.id_capacidad || '';
        document.getElementById('f-estado').value = v.id_estado_vehiculo || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el vehículo', 'error'); }
}

async function save() {
    const body = {
        placa: document.getElementById('f-placa').value.trim().toUpperCase(),
        id_modelo: parseInt(document.getElementById('f-modelo').value) || null,
        id_capacidad: parseInt(document.getElementById('f-capacidad').value) || null,
        id_estado_vehiculo: parseInt(document.getElementById('f-estado').value),
    };
    if (!body.placa) return Swal.fire('Validación', 'La placa es obligatoria', 'warning');
    try {
        if (editingId) { await apiFetch(`/vehiculos/${editingId}`, { method: 'PUT', body }); Swal.fire('Actualizado', 'Vehículo actualizado', 'success'); }
        else { await apiFetch('/vehiculos', { method: 'POST', body }); Swal.fire('Creado', 'Vehículo creado', 'success'); }
        closeModal(); if (vehiculosTable) await reloadDataTable(vehiculosTable, '/vehiculos');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id, placa) {
    const r = await Swal.fire({ title: '¿Eliminar vehículo?', text: `Se eliminará ${placa}.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/vehiculos/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Vehículo eliminado', 'success'); if (vehiculosTable) await reloadDataTable(vehiculosTable, '/vehiculos'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

let estadoVehId = null;
function openEstadoModal(id, ref) { estadoVehId = id; document.getElementById('estado-ref').textContent = ref; document.getElementById('s-estado').value = ''; document.getElementById('estado-modal').classList.add('active'); }
function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoVehId = null; }
async function changeEstado() {
    const id_estado_vehiculo = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_vehiculo) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try { await apiFetch(`/vehiculos/${estadoVehId}/cambiar-estado`, { method: 'POST', body: { id_estado_vehiculo } }); Swal.fire('Actualizado', 'Estado cambiado', 'success'); closeEstadoModal(); if (vehiculosTable) await reloadDataTable(vehiculosTable, '/vehiculos'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}
