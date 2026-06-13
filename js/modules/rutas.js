let rutasTable, editingId = null, farmaciasList = [];
let currentRutaId = null, currentRutaName = '', paradasTable = null, editingParadaId = null;

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Rutas', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    try { const d = await apiFetch('/farmacias'); farmaciasList = Array.isArray(d) ? d : (d.data || []); } catch (e) { farmaciasList = []; }
    renderPage();
});

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-route"></i> Rutas</h3>
                ${hasPermission('Rutas', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nueva Ruta</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Nombre</th><th>Paradas</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal" style="max-width:450px;">
            <div class="modal-header"><h3 id="modal-title">Nueva Ruta</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form"><div class="form-group"><label>Nombre de la Ruta *</label><input type="text" id="f-nombre" class="form-control" required></div></form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="paradas-modal" class="modal-overlay"><div class="modal" style="max-width:750px;">
            <div class="modal-header"><h3>Paradas de Ruta: <span id="ruta-name-ref"></span></h3><button class="modal-close" onclick="closeParadasModal()">&times;</button></div>
            <div class="modal-body">
                <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">${hasPermission('Rutas', 'gestionar-paradas') ? '<button class="btn btn-sm btn-primary" onclick="openParadaForm()"><i class="fas fa-plus"></i> Agregar Parada</button>' : ''}</div>
                <div class="table-container"><table id="paradas-table" class="display" style="width:100%"><thead><tr>
                    <th>Orden</th><th>Farmacia</th><th>Hora Estimada</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeParadasModal()">Cerrar</button></div>
        </div></div>
        <div id="parada-form-modal" class="modal-overlay"><div class="modal" style="max-width:500px;">
            <div class="modal-header"><h3 id="parada-form-title">Nueva Parada</h3><button class="modal-close" onclick="closeParadaForm()">&times;</button></div>
            <div class="modal-body">
                <form id="parada-form">
                    <div class="form-group"><label>Farmacia *</label><select id="p-farmacia" class="form-control" required><option value="">Seleccione...</option>${farmaciasList.map(f => `<option value="${f.id_farmacia}">${f.nombre}</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>Orden *</label><input type="number" id="p-orden" class="form-control" min="1" required></div>
                        <div class="form-group"><label>Hora Estimada</label><input type="time" id="p-hora" class="form-control"></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeParadaForm()">Cancelar</button><button class="btn btn-primary" onclick="saveParada()">Guardar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/rutas');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) rutasTable.destroy();
        rutasTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'nombre_ruta' },
                { data: null, render: r => r.paradas_count ?? r.paradas?.length ?? 0 },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Rutas', 'gestionar-paradas') ? `<button class="btn btn-sm btn-info" onclick="openParadasModal(${r.id_ruta},'${r.nombre_ruta}')"><i class="fas fa-map-pin"></i></button>` : ''}
                    ${hasPermission('Rutas', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_ruta})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Rutas', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_ruta},'${r.nombre_ruta}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar rutas: ' + e.message, 'error'); }
}

function openCreateModal() { editingId = null; document.getElementById('modal-title').textContent = 'Nueva Ruta'; document.getElementById('main-form').reset(); document.getElementById('main-modal').classList.add('active'); }
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/rutas/${id}`);
        const r = d.ruta || d.data || d;
        editingId = id; document.getElementById('modal-title').textContent = 'Editar Ruta';
        document.getElementById('f-nombre').value = r.nombre_ruta || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la ruta', 'error'); }
}

async function save() {
    const nombre_ruta = document.getElementById('f-nombre').value.trim();
    if (!nombre_ruta) return Swal.fire('Validación', 'El nombre es obligatorio', 'warning');
    try {
        if (editingId) { await apiFetch(`/rutas/${editingId}`, { method: 'PUT', body: { nombre_ruta } }); Swal.fire('Actualizado', 'Ruta actualizada', 'success'); }
        else { await apiFetch('/rutas', { method: 'POST', body: { nombre_ruta } }); Swal.fire('Creada', 'Ruta creada', 'success'); }
        closeModal(); if (rutasTable) await reloadDataTable(rutasTable, '/rutas');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id, name) {
    const r = await Swal.fire({ title: '¿Eliminar ruta?', text: `Se eliminará "${name}".`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/rutas/${id}`, { method: 'DELETE' }); Swal.fire('Eliminada', 'Ruta eliminada', 'success'); if (rutasTable) await reloadDataTable(rutasTable, '/rutas'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

// Paradas management
async function openParadasModal(id, name) {
    currentRutaId = id; currentRutaName = name;
    document.getElementById('ruta-name-ref').textContent = name;
    document.getElementById('paradas-modal').classList.add('active');
    await loadParadas();
}

function closeParadasModal() { document.getElementById('paradas-modal').classList.remove('active'); currentRutaId = null; }

async function loadParadas() {
    try {
        const d = await apiFetch(`/rutas/${currentRutaId}/paradas`);
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#paradas-table')) { paradasTable.destroy(); }
        paradasTable = $('#paradas-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']], paging: false, info: false, searching: false,
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'orden_parada' },
                { data: null, render: r => r.farmacia?.nombre || r.nombre_farmacia || '—' },
                { data: 'hora_estimada', defaultContent: '—' },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Rutas', 'gestionar-paradas') ? `<button class="btn btn-sm btn-warning" onclick="editParada(${r.id_parada})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Rutas', 'gestionar-paradas') ? `<button class="btn btn-sm btn-danger" onclick="delParada(${r.id_parada})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { console.error('Error loading paradas:', e); }
}

function openParadaForm() {
    editingParadaId = null;
    document.getElementById('parada-form-title').textContent = 'Nueva Parada';
    document.getElementById('parada-form').reset();
    document.getElementById('parada-form-modal').classList.add('active');
}

function closeParadaForm() { document.getElementById('parada-form-modal').classList.remove('active'); editingParadaId = null; }

async function editParada(id) {
    try {
        const d = await apiFetch(`/rutas/${currentRutaId}/paradas/${id}`);
        const p = d.parada || d.data || d;
        editingParadaId = id;
        document.getElementById('parada-form-title').textContent = 'Editar Parada';
        document.getElementById('p-farmacia').value = p.id_farmacia || '';
        document.getElementById('p-orden').value = p.orden_parada || '';
        document.getElementById('p-hora').value = p.hora_estimada ? p.hora_estimada.substring(0, 5) : '';
        document.getElementById('parada-form-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la parada', 'error'); }
}

async function saveParada() {
    const horaVal = document.getElementById('p-hora').value;
    const body = {
        id_farmacia: parseInt(document.getElementById('p-farmacia').value),
        orden_parada: parseInt(document.getElementById('p-orden').value),
        hora_estimada: horaVal ? horaVal + ':00' : null,
    };
    if (!body.id_farmacia || !body.orden_parada) return Swal.fire('Validación', 'Farmacia y orden son obligatorios', 'warning');
    try {
        if (editingParadaId) {
            await apiFetch(`/rutas/${currentRutaId}/paradas/${editingParadaId}`, { method: 'PUT', body });
            Swal.fire('Actualizada', 'Parada actualizada', 'success');
        } else {
            await apiFetch(`/rutas/${currentRutaId}/paradas`, { method: 'POST', body });
            Swal.fire('Creada', 'Parada creada', 'success');
        }
        closeParadaForm(); await loadParadas();
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar la parada', 'error'); }
}

async function delParada(id) {
    const r = await Swal.fire({ title: '¿Eliminar parada?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/rutas/${currentRutaId}/paradas/${id}`, { method: 'DELETE' }); Swal.fire('Eliminada', 'Parada eliminada', 'success'); await loadParadas(); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}
