let farmaciasTable;
let cargosList = [];
let editingFarmaciaId = null;
let editingContactoId = null;

// Helpers de validación
function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function validarEmailInput(input) {
    if (input.value && !esEmailValido(input.value)) {
        input.style.borderColor = '#ef4444';
    } else {
        input.style.borderColor = '';
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await loadCargos();
    renderPage();
});

const DEFAULT_CARGOS = [
    { id_cargo: 1, nombre_cargo: 'Gerente' },
    { id_cargo: 2, nombre_cargo: 'Encargado' },
    { id_cargo: 3, nombre_cargo: 'Farmacéutico' },
    { id_cargo: 4, nombre_cargo: 'Administrador' },
    { id_cargo: 5, nombre_cargo: 'Recepcionista' },
];

async function loadCargos() {
    try {
        const data = await apiFetch('/catalogos/cargos');
        cargosList = Array.isArray(data) ? data : (data.data || []);
    } catch (e) {
        cargosList = DEFAULT_CARGOS;
    }
}

function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-hospital"></i> Listado de Farmacias</h3>
                ${hasPermission('Farmacias', 'crear') ? '<button class="btn btn-primary" onclick="openFarmaciaModal()"><i class="fas fa-plus"></i> Nueva Farmacia</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container">
                    <table id="farmacias-table" class="display" style="width:100%">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Dirección</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Contactos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="modal-farmacia" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3 id="farmacia-modal-title">Nueva Farmacia</h3>
                    <button class="modal-close" onclick="closeFarmaciaModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-farmacia">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Nombre *</label>
                                <input type="text" id="f-nombre" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Teléfono</label>
                                <input type="text" id="f-telefono" class="form-control" placeholder="8 dígitos" maxlength="8" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Dirección *</label>
                            <input type="text" id="f-direccion" class="form-control" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="text" id="f-email" class="form-control" placeholder="ejemplo@correo.com" oninput="validarEmailInput(this)">
                            </div>
                            <div class="form-group">
                                <label>Latitud</label>
                                <input type="number" step="any" id="f-latitud" class="form-control">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Longitud</label>
                                <input type="number" step="any" id="f-longitud" class="form-control">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeFarmaciaModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveFarmacia()">Guardar</button>
                </div>
            </div>
        </div>

        <div id="modal-contactos" class="modal-overlay">
            <div class="modal" style="max-width:700px;">
                <div class="modal-header">
                    <h3 id="contactos-modal-title">Contactos</h3>
                    <button class="modal-close" onclick="closeContactosModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                        <span id="farmacia-name-ref" style="font-weight:500;"></span>
                        ${hasPermission('Farmacias', 'gestionar-contactos') ? '<button class="btn btn-sm btn-primary" onclick="openContactoModal()"><i class="fas fa-plus"></i> Agregar Contacto</button>' : ''}
                    </div>
                    <div class="table-container">
                        <table id="contactos-table" class="display" style="width:100%">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Cargo</th>
                                    <th>Teléfono</th>
                                    <th>Email</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactosModal()">Cerrar</button>
                </div>
            </div>
        </div>

        <div id="modal-contacto" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3 id="contacto-modal-title">Nuevo Contacto</h3>
                    <button class="modal-close" onclick="closeContactoFormModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-contacto">
                        <div class="form-group">
                            <label>Nombre del Contacto *</label>
                            <input type="text" id="c-nombre" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Cargo *</label>
                            <select id="c-cargo" class="form-control" required>
                                <option value="">Seleccione un cargo...</option>
                                ${cargosList.map(c => `<option value="${c.id_cargo}">${c.nombre_cargo}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Teléfono</label>
                                <input type="text" id="c-telefono" class="form-control" placeholder="8 dígitos" maxlength="8" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8)">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="text" id="c-email" class="form-control" placeholder="ejemplo@correo.com" oninput="validarEmailInput(this)">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactoFormModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveContacto()">Guardar</button>
                </div>
            </div>
        </div>
    `;

    loadFarmacias();
}

async function loadFarmacias() {
    try {
        const data = await apiFetch('/farmacias');
        const farmacias = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#farmacias-table')) {
            farmaciasTable.destroy();
        }

        farmaciasTable = $('#farmacias-table').DataTable({
            data: farmacias,
            columns: [
                { data: 'nombre' },
                { data: 'direccion' },
                { data: 'telefono', defaultContent: '—' },
                { data: 'email', defaultContent: '—' },
                {
                    data: null,
                    render: function (row) {
                    const count = row.contactos_count ?? row.contactos?.length ?? 0;
                        const contactBtn = hasPermission('Farmacias', 'gestionar-contactos')
                            ? `<button class="btn btn-sm btn-info" onclick="openContactosModal(${row.id_farmacia},'${row.nombre}')"><i class="fas fa-address-book"></i> ${count}</button>`
                            : `<span class="badge badge-info">${count} contactos</span>`;
                        return contactBtn;
                    },
                    orderable: false
                },
                {
                    data: null,
                    render: function (row) {
                        return `
                            <div class="actions">
                                ${hasPermission('Farmacias', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="editFarmacia(${row.id_farmacia})"><i class="fas fa-edit"></i></button>` : ''}
                                ${hasPermission('Farmacias', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="deleteFarmacia(${row.id_farmacia},'${row.nombre}')"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        `;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[0, 'asc']],
            pageLength: 10,
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar las farmacias: ' + e.message, 'error');
    }
}

function openFarmaciaModal(data) {
    editingFarmaciaId = null;
    document.getElementById('farmacia-modal-title').textContent = 'Nueva Farmacia';
    document.getElementById('form-farmacia').reset();
    document.getElementById('modal-farmacia').classList.add('active');
}

function closeFarmaciaModal() {
    document.getElementById('modal-farmacia').classList.remove('active');
    editingFarmaciaId = null;
}

async function editFarmacia(id) {
    try {
        const data = await apiFetch(`/farmacias/${id}`);
        const farmacia = data.farmacia || data.data || data;
        editingFarmaciaId = id;

        document.getElementById('farmacia-modal-title').textContent = 'Editar Farmacia';
        document.getElementById('f-nombre').value = farmacia.nombre || '';
        document.getElementById('f-direccion').value = farmacia.direccion || '';
        document.getElementById('f-telefono').value = farmacia.telefono || '';
        document.getElementById('f-email').value = farmacia.email || '';
        document.getElementById('f-latitud').value = farmacia.latitud || '';
        document.getElementById('f-longitud').value = farmacia.longitud || '';
        document.getElementById('modal-farmacia').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar la farmacia', 'error');
    }
}

async function saveFarmacia() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const direccion = document.getElementById('f-direccion').value.trim();
    const telefono = document.getElementById('f-telefono').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const latitud = document.getElementById('f-latitud').value;
    const longitud = document.getElementById('f-longitud').value;

    if (!nombre || !direccion) {
        Swal.fire('Validación', 'Nombre y dirección son obligatorios', 'warning');
        return;
    }
    if (telefono && telefono.length !== 8) {
        Swal.fire('Validación', 'El teléfono debe tener exactamente 8 dígitos', 'warning');
        return;
    }
    if (email && !esEmailValido(email)) {
        Swal.fire('Validación', 'El email ingresado no es válido', 'warning');
        return;
    }

    const latNum = latitud ? parseFloat(latitud) : null;
    const lngNum = longitud ? parseFloat(longitud) : null;

    if (latNum !== null && (latNum < -90 || latNum > 90)) {
        Swal.fire('Validación', 'La latitud debe estar entre -90 y 90', 'warning');
        return;
    }
    if (lngNum !== null && (lngNum < -180 || lngNum > 180)) {
        Swal.fire('Validación', 'La longitud debe estar entre -180 y 180', 'warning');
        return;
    }

    const body = { nombre, direccion, telefono, email, latitud: latNum, longitud: lngNum };

    try {
        if (editingFarmaciaId) {
            await apiFetch(`/farmacias/${editingFarmaciaId}`, {
                method: 'PUT',
                body,
            });
            Swal.fire('Actualizado', 'Farmacia actualizada correctamente', 'success');
        } else {
            await apiFetch('/farmacias', {
                method: 'POST',
                body,
            });
            Swal.fire('Creado', 'Farmacia creada correctamente', 'success');
        }
        closeFarmaciaModal();
        await reloadDataTable(farmaciasTable, '/farmacias');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar', 'error');
    }
}

async function deleteFarmacia(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar farmacia?',
        text: `Se eliminará "${nombre}" y todos sus datos asociados.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    try {
        await apiFetch(`/farmacias/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Farmacia eliminada correctamente', 'success');
        await reloadDataTable(farmaciasTable, '/farmacias');
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('foreign') || msg.includes('SQLSTATE') || msg.includes('constraint') || msg.includes('clave foránea')) {
            Swal.fire('No se puede eliminar', 'Esta farmacia tiene pedidos u otros registros asociados. Elimine primero los pedidos relacionados antes de eliminar la farmacia.', 'warning');
        } else {
            Swal.fire('Error', msg || 'Error al eliminar', 'error');
        }
    }
}

let currentFarmaciaId = null;
let currentFarmaciaName = '';
let contactosTable = null;

async function openContactosModal(farmaciaId, farmaciaName) {
    currentFarmaciaId = farmaciaId;
    currentFarmaciaName = farmaciaName;
    document.getElementById('farmacia-name-ref').textContent = `Contactos de: ${farmaciaName}`;
    document.getElementById('modal-contactos').classList.add('active');
    await loadContactos();
}

function closeContactosModal() {
    document.getElementById('modal-contactos').classList.remove('active');
    currentFarmaciaId = null;
}

async function loadContactos() {
    try {
        const data = await apiFetch(`/farmacias/${currentFarmaciaId}/contactos`);
        const contactos = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#contactos-table')) {
            contactosTable.destroy();
        }

        contactosTable = $('#contactos-table').DataTable({
            data: contactos,
            columns: [
                { data: 'nombre_contacto' },
                {
                    data: null,
                    render: function (row) {
                        return row.cargo?.nombre_cargo || row.nombre_cargo || '—';
                    }
                },
                { data: 'telefono', defaultContent: '—' },
                { data: 'email', defaultContent: '—' },
                {
                    data: null,
                    render: function (row) {
                        const cid = row.id_contacto;
                        const fid = currentFarmaciaId;
                        const cname = (row.nombre_contacto || '').replace(/'/g, "\\'");
                        return `
                            <div class="actions">
                                ${hasPermission('Farmacias', 'gestionar-contactos') ? `<button class="btn btn-sm btn-warning" onclick="editContacto(${cid},${fid})"><i class="fas fa-edit"></i></button>` : ''}
                                ${hasPermission('Farmacias', 'gestionar-contactos') ? `<button class="btn btn-sm btn-danger" onclick="deleteContacto(${cid},'${cname}',${fid})"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        `;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[0, 'asc']],
            pageLength: 5,
            pagingType: 'simple',
        });
    } catch (e) {
        console.error('Error loading contactos:', e);
    }
}

function openContactoModal() {
    editingContactoId = null;
    document.getElementById('contacto-modal-title').textContent = 'Nuevo Contacto';
    document.getElementById('form-contacto').reset();
    document.getElementById('modal-contacto').classList.add('active');
}

function closeContactoFormModal() {
    document.getElementById('modal-contacto').classList.remove('active');
    editingContactoId = null;
}

async function editContacto(id, farmaciaId) {
    const fid = farmaciaId || currentFarmaciaId;
    try {
        const data = await apiFetch(`/farmacias/${fid}/contactos/${id}`);
        const contacto = data.contacto || data.data || data;
        editingContactoId = id;
        currentFarmaciaId = fid; // restaurar por si acaso

        document.getElementById('contacto-modal-title').textContent = 'Editar Contacto';
        document.getElementById('c-nombre').value = contacto.nombre_contacto || '';
        document.getElementById('c-cargo').value = contacto.id_cargo || '';
        document.getElementById('c-telefono').value = contacto.telefono || '';
        document.getElementById('c-email').value = contacto.email || '';
        document.getElementById('modal-contacto').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el contacto', 'error');
    }
}

async function saveContacto() {
    const nombre = document.getElementById('c-nombre').value.trim();
    const id_cargo = document.getElementById('c-cargo').value;
    const telefono = document.getElementById('c-telefono').value.trim();
    const email = document.getElementById('c-email').value.trim();

    if (!nombre || !id_cargo) {
        Swal.fire('Validación', 'Nombre y cargo son obligatorios', 'warning');
        return;
    }
    if (telefono && telefono.length !== 8) {
        Swal.fire('Validación', 'El teléfono debe tener exactamente 8 dígitos', 'warning');
        return;
    }
    if (email && !esEmailValido(email)) {
        Swal.fire('Validación', 'El email ingresado no es válido', 'warning');
        return;
    }

    const body = { nombre_contacto: nombre, id_cargo: parseInt(id_cargo), telefono, email };

    try {
        if (editingContactoId) {
            await apiFetch(`/farmacias/${currentFarmaciaId}/contactos/${editingContactoId}`, {
                method: 'PUT',
                body,
            });
            Swal.fire('Actualizado', 'Contacto actualizado correctamente', 'success');
        } else {
            await apiFetch(`/farmacias/${currentFarmaciaId}/contactos`, {
                method: 'POST',
                body,
            });
            Swal.fire('Creado', 'Contacto creado correctamente', 'success');
        }
        closeContactoFormModal();
        await loadContactos();
        await reloadDataTable(farmaciasTable, '/farmacias');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar el contacto', 'error');
    }
}

async function deleteContacto(id, nombre, farmaciaId) {
    const fid = farmaciaId || currentFarmaciaId;
    const result = await Swal.fire({
        title: '¿Eliminar contacto?',
        text: `Se eliminará "${nombre}".`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    try {
        await apiFetch(`/farmacias/${fid}/contactos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Contacto eliminado correctamente', 'success');
        await loadContactos();
        await reloadDataTable(farmaciasTable, '/farmacias');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al eliminar', 'error');
    }
}
