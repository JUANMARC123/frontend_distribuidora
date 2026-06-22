const API_ALMACENES = `${API_URL}/almacenes`;
let almacenesTable;
let editMode = false;
let editId = null;

const MODAL_TITLE_CREATE = 'Nuevo Almacén';
const MODAL_TITLE_EDIT = 'Editar Almacén';

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await loadUserPermissions();
    renderContent();
});

function renderContent() {
    const canCreate = hasPermission('Almacenes', 'crear');
    const canEdit = hasPermission('Almacenes', 'editar');
    const canDelete = hasPermission('Almacenes', 'eliminar');
    const canManageUbicaciones = hasPermission('Almacenes', 'gestionar-ubicaciones');

    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-warehouse"></i> Listado de Almacenes</h3>
                <div class="card-actions">
                    ${canCreate ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Almacén</button>' : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table id="almacenesTable" class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Farmacia</th>
                                <th>Ubicaciones</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="almacenModal" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3 id="almacenModalTitle">${MODAL_TITLE_CREATE}</h3>
                    <button class="modal-close" onclick="closeModal('almacenModal')">&times;</button>
                </div>
                <form id="almacenForm">
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="id_farmacia">Farmacia *</label>
                            <select id="id_farmacia" class="form-control" required>
                                <option value="">Seleccione una farmacia...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="nombre">Nombre del Almacén *</label>
                            <input type="text" id="nombre" class="form-control" maxlength="100" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('almacenModal')">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="ubicacionesModal" class="modal-overlay">
            <div class="modal" style="max-width:750px;">
                <div class="modal-header">
                    <h3><i class="fas fa-map-pin"></i> Ubicaciones del Almacén</h3>
                    <button class="modal-close" onclick="closeModal('ubicacionesModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="ubicacionesHeader" class="mb-2">
                        <strong id="ubicacionesAlmacenName"></strong>
                    </div>
                    ${canManageUbicaciones ? `
                    <div class="form-row mb-2" id="ubicacionForm">
                        <div class="form-group" style="flex:1">
                            <input type="text" id="ubicacionPasillo" class="form-control" placeholder="Pasillo *" maxlength="20">
                        </div>
                        <div class="form-group" style="flex:1">
                            <input type="text" id="ubicacionEstante" class="form-control" placeholder="Estante *" maxlength="20">
                        </div>
                        <div class="form-group" style="flex:0">
                            <button class="btn btn-primary" onclick="addUbicacion()"><i class="fas fa-plus"></i> Agregar</button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="table-responsive">
                        <table class="table" id="ubicacionesTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Pasillo</th>
                                    <th>Estante</th>
                                    ${canManageUbicaciones ? '<th>Acciones</th>' : ''}
                                </tr>
                            </thead>
                            <tbody id="ubicacionesTableBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('ubicacionesModal')">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    loadFarmacias();
    initDataTable();
    setupFormSubmit();
}

function initDataTable() {
    const canEdit = hasPermission('Almacenes', 'editar');
    const canDelete = hasPermission('Almacenes', 'eliminar');
    const canManageUbicaciones = hasPermission('Almacenes', 'gestionar-ubicaciones');

    almacenesTable = $('#almacenesTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: API_ALMACENES,
            headers: getAuthHeaders(),
            dataSrc: function (json) {
                return json.data || [];
            }
        },
        columns: [
            { data: 'id_almacen' },
            { data: 'nombre' },
            {
                data: 'farmacia',
                render: data => data?.nombre || '—'
            },
            {
                data: 'ubicaciones',
                render: data => (data && data.length) ? data.length : '0'
            },
            {
                data: null,
                render: function (row) {
                    let btns = '';
                    if (canManageUbicaciones) btns += `<button class="btn btn-sm btn-info" onclick="openUbicacionesModal(${row.id_almacen}, '${row.nombre}')" title="Gestionar ubicaciones"><i class="fas fa-map-pin"></i></button>`;
                    if (canEdit) btns += ` <button class="btn btn-sm btn-warning" onclick="editAlmacen(${row.id_almacen})" title="Editar"><i class="fas fa-edit"></i></button>`;
                    if (canDelete) btns += ` <button class="btn btn-sm btn-danger" onclick="deleteAlmacen(${row.id_almacen})" title="Eliminar"><i class="fas fa-trash"></i></button>`;
                    return btns;
                }
            }
        ],
        order: [[0, 'desc']],
        language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }
    });
}

async function loadFarmacias() {
    try {
        const res = await fetch(`${API_URL}/farmacias?per_page=1000`, { headers: getAuthHeaders() });
        const json = await res.json();
        const data = json.data || [];
        const select = document.getElementById('id_farmacia');
        data.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id_farmacia;
            opt.textContent = f.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error('Error loading farmacias:', e); }
}

function openCreateModal() {
    editMode = false;
    editId = null;
    document.getElementById('almacenModalTitle').textContent = MODAL_TITLE_CREATE;
    document.getElementById('almacenForm').reset();
    openModal('almacenModal');
}

async function editAlmacen(id) {
    try {
        const res = await fetch(`${API_ALMACENES}/${id}`, { headers: getAuthHeaders() });
        const json = await res.json();
        const a = json.data;

        editMode = true;
        editId = id;
        document.getElementById('almacenModalTitle').textContent = MODAL_TITLE_EDIT;
        document.getElementById('id_farmacia').value = a.id_farmacia;
        document.getElementById('nombre').value = a.nombre;

        openModal('almacenModal');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el almacén.', 'error');
    }
}

function setupFormSubmit() {
    document.getElementById('almacenForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const body = {
            id_farmacia: parseInt(document.getElementById('id_farmacia').value),
            nombre: document.getElementById('nombre').value.trim(),
        };

        if (!body.nombre) {
            Swal.fire('Error', 'El nombre del almacén es requerido.', 'warning');
            return;
        }

        try {
            const url = editMode ? `${API_ALMACENES}/${editId}` : API_ALMACENES;
            const method = editMode ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();

            if (!res.ok) throw new Error(json.message || 'Error al guardar');

            Swal.fire('Éxito', json.message, 'success');
            closeModal('almacenModal');
            almacenesTable.ajax.reload();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });
}

async function deleteAlmacen(id) {
    const result = await Swal.fire({
        title: '¿Eliminar almacén?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_ALMACENES}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Error al eliminar');
        Swal.fire('Eliminado', json.message, 'success');
        almacenesTable.ajax.reload();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

let currentAlmacenId = null;

async function openUbicacionesModal(almacenId, almacenNombre) {
    currentAlmacenId = almacenId;
    document.getElementById('ubicacionesAlmacenName').textContent = `Almacén: ${almacenNombre}`;
    await loadUbicaciones();
    openModal('ubicacionesModal');
}

async function loadUbicaciones() {
    try {
        const res = await fetch(`${API_ALMACENES}/${currentAlmacenId}/ubicaciones`, { headers: getAuthHeaders() });
        const json = await res.json();
        const data = json.data || [];
        const tbody = document.getElementById('ubicacionesTableBody');
        tbody.innerHTML = '';

        const canManage = hasPermission('Almacenes', 'gestionar-ubicaciones');

        data.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id_ubicacion}</td>
                <td>${u.pasillo}</td>
                <td>${u.estante}</td>
                ${canManage ? `<td>
                    <button class="btn btn-sm btn-danger" onclick="deleteUbicacion(${u.id_ubicacion})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>` : ''}
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error loading ubicaciones:', e);
    }
}

async function addUbicacion() {
    const pasillo = document.getElementById('ubicacionPasillo').value.trim();
    const estante = document.getElementById('ubicacionEstante').value.trim();

    if (!pasillo || !estante) {
        Swal.fire('Error', 'Complete todos los campos.', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_ALMACENES}/${currentAlmacenId}/ubicaciones`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ pasillo, estante }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Error al agregar');

        document.getElementById('ubicacionPasillo').value = '';
        document.getElementById('ubicacionEstante').value = '';

        await loadUbicaciones();
        almacenesTable.ajax.reload();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function deleteUbicacion(ubicacionId) {
    const result = await Swal.fire({
        title: '¿Eliminar ubicación?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_ALMACENES}/${currentAlmacenId}/ubicaciones/${ubicacionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Error al eliminar');

        await loadUbicaciones();
        almacenesTable.ajax.reload();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}
