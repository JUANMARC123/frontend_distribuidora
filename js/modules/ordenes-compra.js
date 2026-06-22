let currentTab = 'proveedores';
let proveedoresTable, ordenesTable;
let estadosOrdenList = [];
let editingProveedorId = null;
let editingOrdenId = null;
let currentProveedorId = null;
let contactosProveedorTable = null;
let editingContactoId = null;
let detallesCompra = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Compras', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await loadCatalogos();
    renderPage();
});

async function loadCatalogos() {
    try {
        const data = await apiFetch('/catalogos/estados-orden-compra');
        estadosOrdenList = Array.isArray(data) ? data : (data.data || []);
    } catch (e) { estadosOrdenList = []; }
}

function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="tabs">
                    <button class="tab-btn ${currentTab === 'proveedores' ? 'active' : ''}" onclick="switchTab('proveedores')"><i class="fas fa-truck"></i> Proveedores</button>
                    <button class="tab-btn ${currentTab === 'ordenes' ? 'active' : ''}" onclick="switchTab('ordenes')"><i class="fas fa-file-invoice"></i> Órdenes de Compra</button>
                </div>
                <div id="tab-actions"></div>
            </div>
            <div class="card-body" id="tab-content"></div>
        </div>

        ${renderProveedorModals()}
        ${renderOrdenModals()}
    `;

    switchTab(currentTab);
}

function renderProveedorModals() {
    return `
        <div id="modal-proveedor" class="modal-overlay">
            <div class="modal" style="max-width:550px;">
                <div class="modal-header">
                    <h3 id="proveedor-modal-title">Nuevo Proveedor</h3>
                    <button class="modal-close" onclick="closeProveedorModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-proveedor">
                        <div class="form-group">
                            <label>Nombre *</label>
                            <input type="text" id="pv-nombre" class="form-control" required maxlength="150">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>NIT</label>
                                <input type="text" id="pv-nit" class="form-control" maxlength="50">
                            </div>
                            <div class="form-group">
                                <label>Teléfono</label>
                                <input type="text" id="pv-telefono" class="form-control" maxlength="20">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="pv-email" class="form-control" maxlength="180">
                        </div>
                        <div class="form-group">
                            <label>Dirección</label>
                            <textarea id="pv-direccion" class="form-control" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeProveedorModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveProveedor()">Guardar</button>
                </div>
            </div>
        </div>

        <div id="modal-contactos-pv" class="modal-overlay">
            <div class="modal" style="max-width:650px;">
                <div class="modal-header">
                    <h3>Contactos del Proveedor</h3>
                    <button class="modal-close" onclick="closeContactosPvModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                        <span id="proveedor-name-ref" style="font-weight:500;"></span>
                        <button class="btn btn-sm btn-primary" onclick="openContactoPvModal()"><i class="fas fa-plus"></i> Agregar</button>
                    </div>
                    <div class="table-container">
                        <table id="contactos-pv-table" class="display" style="width:100%">
                            <thead>
                                <tr><th>Nombre</th><th>Cargo</th><th>Teléfono</th><th>Email</th><th>Acciones</th></tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactosPvModal()">Cerrar</button>
                </div>
            </div>
        </div>

        <div id="modal-contacto-pv" class="modal-overlay">
            <div class="modal" style="max-width:450px;">
                <div class="modal-header">
                    <h3 id="contacto-pv-modal-title">Nuevo Contacto</h3>
                    <button class="modal-close" onclick="closeContactoPvFormModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-contacto-pv">
                        <div class="form-group">
                            <label>Nombre *</label>
                            <input type="text" id="cpv-nombre" class="form-control" required maxlength="150">
                        </div>
                        <div class="form-group">
                            <label>Cargo</label>
                            <input type="text" id="cpv-cargo" class="form-control" maxlength="100">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Teléfono</label>
                                <input type="text" id="cpv-telefono" class="form-control" maxlength="20">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="cpv-email" class="form-control" maxlength="180">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactoPvFormModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveContactoPv()">Guardar</button>
                </div>
            </div>
        </div>
    `;
}

function renderOrdenModals() {
    return `
        <div id="modal-orden" class="modal-overlay">
            <div class="modal" style="max-width:700px;">
                <div class="modal-header">
                    <h3 id="orden-modal-title">Nueva Orden de Compra</h3>
                    <button class="modal-close" onclick="closeOrdenModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-orden">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Código *</label>
                                <input type="text" id="o-codigo" class="form-control" required maxlength="50">
                            </div>
                            <div class="form-group">
                                <label>Proveedor *</label>
                                <select id="o-proveedor" class="form-control" required><option value="">Seleccione...</option></select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Estado *</label>
                                <select id="o-estado" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${estadosOrdenList.map(e => `<option value="${e.id_estado_orden_compra}">${e.nombre_estado}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fecha Est. Recibido</label>
                                <input type="date" id="o-fecha-est" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="o-obs" class="form-control" rows="2"></textarea>
                        </div>
                        <hr style="margin:16px 0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                            <strong>Detalles</strong>
                            <button type="button" class="btn btn-sm btn-primary" onclick="addDetalleRow()"><i class="fas fa-plus"></i> Agregar Producto</button>
                        </div>
                        <table id="detalles-table" class="table" style="width:100%">
                            <thead>
                                <tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th></th></tr>
                            </thead>
                            <tbody id="detalles-body"></tbody>
                            <tfoot>
                                <tr><td colspan="3" style="text-align:right;font-weight:bold;">Total:</td><td id="detalles-total" style="font-weight:bold;">Bs 0.00</td><td></td></tr>
                            </tfoot>
                        </table>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeOrdenModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveOrden()">Guardar</button>
                </div>
            </div>
        </div>
    `;
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tab}"]`).classList.add('active');

    const actions = document.getElementById('tab-actions');
    const content = document.getElementById('tab-content');

    if (tab === 'proveedores') {
        actions.innerHTML = hasPermission('Compras', 'crear') ? '<button class="btn btn-primary" onclick="openProveedorModal()"><i class="fas fa-plus"></i> Nuevo Proveedor</button>' : '';
        content.innerHTML = `
            <div class="table-container">
                <table id="proveedores-table" class="display" style="width:100%">
                    <thead><tr><th>Nombre</th><th>NIT</th><th>Teléfono</th><th>Email</th><th>Contactos</th><th>Acciones</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        loadProveedores();
    } else {
        actions.innerHTML = hasPermission('Compras', 'crear') ? '<button class="btn btn-primary" onclick="openOrdenModal()"><i class="fas fa-plus"></i> Nueva Orden</button>' : '';
        content.innerHTML = `
            <div class="table-container">
                <table id="ordenes-table" class="display" style="width:100%">
                    <thead><tr><th>Código</th><th>Proveedor</th><th>Estado</th><th>Fecha</th><th>Total</th><th>Acciones</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        loadOrdenes();
    }
}

async function loadProveedores() {
    try {
        const data = await apiFetch('/proveedores');
        const proveedores = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#proveedores-table')) {
            proveedoresTable.destroy();
        }

        proveedoresTable = $('#proveedores-table').DataTable({
            data: proveedores,
            columns: [
                { data: 'nombre_proveedor' },
                { data: 'nit', defaultContent: '—' },
                { data: 'telefono', defaultContent: '—' },
                { data: 'email', defaultContent: '—' },
                {
                    data: null,
                    render: row => {
                        const count = row.contactos_count ?? 0;
                        return `<button class="btn btn-sm btn-info" onclick="openContactosPvModal(${row.id_proveedor},'${(row.nombre_proveedor||'').replace(/'/g,"\\'")}')"><i class="fas fa-address-book"></i> ${count}</button>`;
                    },
                    orderable: false
                },
                {
                    data: null,
                    render: row => {
                        const pid = row.id_proveedor;
                        const pname = (row.nombre_proveedor||'').replace(/'/g,"\\'");
                        return `<div class="actions">
                            ${hasPermission('Compras','editar') ? `<button class="btn btn-sm btn-warning" onclick="editProveedor(${pid})"><i class="fas fa-edit"></i></button>` : ''}
                            ${hasPermission('Compras','eliminar') ? `<button class="btn btn-sm btn-danger" onclick="deleteProveedor(${pid},'${pname}')"><i class="fas fa-trash"></i></button>` : ''}
                        </div>`;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[0, 'asc']],
            pageLength: 10,
        });
    } catch (e) { Swal.fire('Error', 'No se pudieron cargar proveedores', 'error'); }
}

async function loadOrdenes() {
    try {
        const data = await apiFetch('/ordenes-compra');
        const ordenes = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#ordenes-table')) {
            ordenesTable.destroy();
        }

        ordenesTable = $('#ordenes-table').DataTable({
            data: ordenes,
            columns: [
                { data: 'codigo_orden' },
                { data: 'proveedor.nombre_proveedor', defaultContent: '—' },
                { data: 'estado.nombre_estado', defaultContent: '—' },
                {
                    data: 'fecha_orden',
                    render: data => data ? data.split('T')[0] : '—'
                },
                {
                    data: null,
                    render: row => {
                        const total = (row.detalles || []).reduce((s, d) => s + parseFloat(d.subtotal || 0), 0);
                        return `Bs ${total.toFixed(2)}`;
                    }
                },
                {
                    data: null,
                    render: row => {
                        const oid = row.id_orden_compra;
                        const cod = (row.codigo_orden||'').replace(/'/g,"\\'");
                        const estadoActual = row.id_estado_orden_compra;
                        return `<div class="actions">
                            <button class="btn btn-sm btn-info" onclick="viewOrden(${oid})"><i class="fas fa-eye"></i></button>
                            ${hasPermission('Compras','cambiar-estado') && estadoActual < 4 ? `<button class="btn btn-sm btn-primary" onclick="cambiarEstadoOrden(${oid})"><i class="fas fa-arrow-right"></i></button>` : ''}
                            ${hasPermission('Compras','editar') && estadoActual === 1 ? `<button class="btn btn-sm btn-warning" onclick="editOrden(${oid})"><i class="fas fa-edit"></i></button>` : ''}
                            ${hasPermission('Compras','eliminar') && estadoActual === 1 ? `<button class="btn btn-sm btn-danger" onclick="deleteOrden(${oid},'${cod}')"><i class="fas fa-trash"></i></button>` : ''}
                        </div>`;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[3, 'desc']],
            pageLength: 10,
        });
    } catch (e) { Swal.fire('Error', 'No se pudieron cargar órdenes', 'error'); }
}

// ---------- PROVEEDORES ----------
function openProveedorModal() {
    editingProveedorId = null;
    document.getElementById('proveedor-modal-title').textContent = 'Nuevo Proveedor';
    document.getElementById('form-proveedor').reset();
    document.getElementById('modal-proveedor').classList.add('active');
}
function closeProveedorModal() {
    document.getElementById('modal-proveedor').classList.remove('active');
    editingProveedorId = null;
}
async function editProveedor(id) {
    try {
        const data = await apiFetch(`/proveedores/${id}`);
        const p = data.data || data;
        editingProveedorId = id;
        document.getElementById('proveedor-modal-title').textContent = 'Editar Proveedor';
        document.getElementById('pv-nombre').value = p.nombre_proveedor || '';
        document.getElementById('pv-nit').value = p.nit || '';
        document.getElementById('pv-telefono').value = p.telefono || '';
        document.getElementById('pv-email').value = p.email || '';
        document.getElementById('pv-direccion').value = p.direccion || '';
        document.getElementById('modal-proveedor').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar', 'error'); }
}
async function saveProveedor() {
    const body = {
        nombre_proveedor: document.getElementById('pv-nombre').value.trim(),
        nit: document.getElementById('pv-nit').value.trim() || null,
        telefono: document.getElementById('pv-telefono').value.trim() || null,
        email: document.getElementById('pv-email').value.trim() || null,
        direccion: document.getElementById('pv-direccion').value.trim() || null,
    };
    if (!body.nombre_proveedor) { Swal.fire('Validación', 'Nombre es obligatorio', 'warning'); return; }
    try {
        if (editingProveedorId) {
            await apiFetch(`/proveedores/${editingProveedorId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Proveedor actualizado', 'success');
        } else {
            await apiFetch('/proveedores', { method: 'POST', body });
            Swal.fire('Creado', 'Proveedor creado', 'success');
        }
        closeProveedorModal();
        await reloadDataTable(proveedoresTable, '/proveedores');
        loadProveedoresSelect();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}
async function deleteProveedor(id, nombre) {
    const r = await Swal.fire({ title: '¿Eliminar?', text: `Se eliminará "${nombre}"`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sí' });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/proveedores/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', '', 'success');
        await reloadDataTable(proveedoresTable, '/proveedores');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// ---------- CONTACTOS PROVEEDOR ----------
async function openContactosPvModal(proveedorId, nombre) {
    currentProveedorId = proveedorId;
    document.getElementById('proveedor-name-ref').textContent = `Contactos de: ${nombre}`;
    document.getElementById('modal-contactos-pv').classList.add('active');
    await loadContactosPv();
}
function closeContactosPvModal() {
    document.getElementById('modal-contactos-pv').classList.remove('active');
    currentProveedorId = null;
}
async function loadContactosPv() {
    try {
        const data = await apiFetch(`/proveedores/${currentProveedorId}/contactos`);
        const contactos = Array.isArray(data) ? data : (data.data || []);
        if ($.fn.DataTable.isDataTable('#contactos-pv-table')) { contactosProveedorTable.destroy(); }
        contactosProveedorTable = $('#contactos-pv-table').DataTable({
            data: contactos,
            columns: [
                { data: 'nombre_contacto' },
                { data: 'cargo', defaultContent: '—' },
                { data: 'telefono', defaultContent: '—' },
                { data: 'email', defaultContent: '—' },
                {
                    data: null,
                    render: row => {
                        const cid = row.id_contacto_proveedor;
                        const cname = (row.nombre_contacto||'').replace(/'/g,"\\'");
                        return `<div class="actions">
                            <button class="btn btn-sm btn-warning" onclick="editContactoPv(${cid})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="deleteContactoPv(${cid},'${cname}')"><i class="fas fa-trash"></i></button>
                        </div>`;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[0, 'asc']], pageLength: 5, pagingType: 'simple',
        });
    } catch (e) { console.error(e); }
}
function openContactoPvModal() {
    editingContactoId = null;
    document.getElementById('contacto-pv-modal-title').textContent = 'Nuevo Contacto';
    document.getElementById('form-contacto-pv').reset();
    document.getElementById('modal-contacto-pv').classList.add('active');
}
function closeContactoPvFormModal() { document.getElementById('modal-contacto-pv').classList.remove('active'); editingContactoId = null; }
async function editContactoPv(id) {
    try {
        const data = await apiFetch(`/proveedores/${currentProveedorId}/contactos`);
        const contactos = Array.isArray(data) ? data : (data.data || []);
        const c = contactos.find(x => x.id_contacto_proveedor === id);
        if (!c) throw new Error('No encontrado');
        editingContactoId = id;
        document.getElementById('contacto-pv-modal-title').textContent = 'Editar Contacto';
        document.getElementById('cpv-nombre').value = c.nombre_contacto || '';
        document.getElementById('cpv-cargo').value = c.cargo || '';
        document.getElementById('cpv-telefono').value = c.telefono || '';
        document.getElementById('cpv-email').value = c.email || '';
        document.getElementById('modal-contacto-pv').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar', 'error'); }
}
async function saveContactoPv() {
    const body = {
        nombre_contacto: document.getElementById('cpv-nombre').value.trim(),
        cargo: document.getElementById('cpv-cargo').value.trim() || null,
        telefono: document.getElementById('cpv-telefono').value.trim() || null,
        email: document.getElementById('cpv-email').value.trim() || null,
    };
    if (!body.nombre_contacto) { Swal.fire('Validación', 'Nombre es obligatorio', 'warning'); return; }
    try {
        if (editingContactoId) {
            await apiFetch(`/proveedores/${currentProveedorId}/contactos/${editingContactoId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', '', 'success');
        } else {
            await apiFetch(`/proveedores/${currentProveedorId}/contactos`, { method: 'POST', body });
            Swal.fire('Creado', '', 'success');
        }
        closeContactoPvFormModal();
        await loadContactosPv();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}
async function deleteContactoPv(id, nombre) {
    const r = await Swal.fire({ title: '¿Eliminar contacto?', text: nombre, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/proveedores/${currentProveedorId}/contactos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', '', 'success');
        await loadContactosPv();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// ---------- ÓRDENES DE COMPRA ----------
let productosSelectCache = [];

async function loadProveedoresSelect() {
    try {
        const data = await apiFetch('/proveedores?per_page=1000');
        const proveedores = Array.isArray(data) ? data : (data.data || []);
        const sel = document.getElementById('o-proveedor');
        if (sel) sel.innerHTML = '<option value="">Seleccione...</option>' + proveedores.map(p => `<option value="${p.id_proveedor}">${p.nombre_proveedor}</option>`).join('');
    } catch (e) {}
}

async function loadProductosForOrden() {
    try {
        const data = await apiFetch('/productos?per_page=1000');
        productosSelectCache = Array.isArray(data) ? data : (data.data || []);
    } catch (e) { productosSelectCache = []; }
}

let detalleIdx = 0;

function addDetalleRow(data) {
    const tbody = document.getElementById('detalles-body');
    const idx = detalleIdx++;
    const tr = document.createElement('tr');
    tr.id = `detalle-row-${idx}`;
    tr.innerHTML = `
        <td>
            <select class="form-control detalle-producto" data-idx="${idx}" required>
                <option value="">Seleccione...</option>
                ${productosSelectCache.map(p => `<option value="${p.id_producto}" ${data && data.id_producto === p.id_producto ? 'selected' : ''}>${p.codigo_producto} - ${p.nombre_producto}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" step="0.01" min="0.01" class="form-control detalle-cantidad" data-idx="${idx}" value="${data ? data.cantidad : ''}" required></td>
        <td><input type="number" step="0.01" min="0" class="form-control detalle-precio" data-idx="${idx}" value="${data ? data.precio_unitario : ''}" required></td>
        <td class="detalle-subtotal" data-idx="${idx}">Bs ${data ? (data.cantidad * data.precio_unitario).toFixed(2) : '0.00'}</td>
        <td><button type="button" class="btn btn-sm btn-danger" onclick="removeDetalleRow(${idx})"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('.detalle-cantidad').addEventListener('input', () => updateSubtotal(idx));
    tr.querySelector('.detalle-precio').addEventListener('input', () => updateSubtotal(idx));
}

function updateSubtotal(idx) {
    const cant = parseFloat(document.querySelector(`.detalle-cantidad[data-idx="${idx}"]`).value) || 0;
    const prec = parseFloat(document.querySelector(`.detalle-precio[data-idx="${idx}"]`).value) || 0;
    document.querySelector(`.detalle-subtotal[data-idx="${idx}"]`).textContent = `Bs ${(cant * prec).toFixed(2)}`;
    updateTotal();
}

function updateTotal() {
    let total = 0;
    document.querySelectorAll('.detalle-subtotal').forEach(el => {
        const val = parseFloat(el.textContent.replace('Bs ', ''));
        if (!isNaN(val)) total += val;
    });
    document.getElementById('detalles-total').textContent = `Bs ${total.toFixed(2)}`;
}

function removeDetalleRow(idx) {
    const row = document.getElementById(`detalle-row-${idx}`);
    if (row) { row.remove(); updateTotal(); }
}

function openOrdenModal() {
    editingOrdenId = null;
    document.getElementById('orden-modal-title').textContent = 'Nueva Orden de Compra';
    document.getElementById('form-orden').reset();
    document.getElementById('detalles-body').innerHTML = '';
    detalleIdx = 0;
    updateTotal();
    loadProveedoresSelect();
    loadProductosForOrden().then(() => addDetalleRow());
    document.getElementById('modal-orden').classList.add('active');
}

function closeOrdenModal() {
    document.getElementById('modal-orden').classList.remove('active');
    editingOrdenId = null;
}

async function editOrden(id) {
    try {
        const data = await apiFetch(`/ordenes-compra/${id}`);
        const o = data.data || data;
        editingOrdenId = id;
        document.getElementById('orden-modal-title').textContent = 'Editar Orden de Compra';
        document.getElementById('o-codigo').value = o.codigo_orden || '';
        document.getElementById('o-proveedor').value = o.id_proveedor || '';
        document.getElementById('o-estado').value = o.id_estado_orden_compra || '';
        document.getElementById('o-fecha-est').value = o.fecha_estimada_recibido ? o.fecha_estimada_recibido.split('T')[0] : '';
        document.getElementById('o-obs').value = o.observaciones || '';
        document.getElementById('detalles-body').innerHTML = '';
        detalleIdx = 0;
        await loadProveedoresSelect();
        await loadProductosForOrden();
        (o.detalles || []).forEach(d => addDetalleRow({ id_producto: d.id_producto, cantidad: d.cantidad, precio_unitario: d.precio_unitario }));
        document.getElementById('modal-orden').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar', 'error'); }
}

async function saveOrden() {
    const codigo = document.getElementById('o-codigo').value.trim();
    const id_proveedor = document.getElementById('o-proveedor').value;
    const id_estado = document.getElementById('o-estado').value;
    const fecha_est = document.getElementById('o-fecha-est').value;
    const observaciones = document.getElementById('o-obs').value.trim();

    if (!codigo || !id_proveedor || !id_estado) {
        Swal.fire('Validación', 'Código, proveedor y estado son obligatorios', 'warning');
        return;
    }

    const detalleRows = document.querySelectorAll('#detalles-body tr');
    const detalles = [];
    for (const row of detalleRows) {
        const idx = row.querySelector('.detalle-producto')?.dataset?.idx;
        if (!idx) continue;
        const id_producto = document.querySelector(`.detalle-producto[data-idx="${idx}"]`)?.value;
        const cantidad = parseFloat(document.querySelector(`.detalle-cantidad[data-idx="${idx}"]`)?.value);
        const precio = parseFloat(document.querySelector(`.detalle-precio[data-idx="${idx}"]`)?.value);
        if (!id_producto || !cantidad || !precio) continue;
        detalles.push({ id_producto: parseInt(id_producto), cantidad, precio_unitario: precio });
    }

    if (detalles.length === 0) {
        Swal.fire('Validación', 'Debe agregar al menos un producto', 'warning');
        return;
    }

    const body = {
        codigo_orden: codigo,
        id_proveedor: parseInt(id_proveedor),
        id_estado_orden_compra: parseInt(id_estado),
        fecha_estimada_recibido: fecha_est || null,
        observaciones: observaciones || null,
        detalles,
    };

    try {
        if (editingOrdenId) {
            await apiFetch(`/ordenes-compra/${editingOrdenId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Orden actualizada', 'success');
        } else {
            await apiFetch('/ordenes-compra', { method: 'POST', body });
            Swal.fire('Creada', 'Orden creada', 'success');
        }
        closeOrdenModal();
        await reloadDataTable(ordenesTable, '/ordenes-compra');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function deleteOrden(id, codigo) {
    const r = await Swal.fire({ title: '¿Eliminar?', text: `Se eliminará "${codigo}"`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/ordenes-compra/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', '', 'success');
        await reloadDataTable(ordenesTable, '/ordenes-compra');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function viewOrden(id) {
    try {
        const data = await apiFetch(`/ordenes-compra/${id}`);
        const o = data.data || data;
        const total = (o.detalles || []).reduce((s, d) => s + parseFloat(d.subtotal || 0), 0);
        let detallesHtml = '<table class="table" style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>P. Unit.</th><th>Subtotal</th></tr></thead><tbody>';
        (o.detalles || []).forEach(d => {
            const prod = d.producto ? `${d.producto.codigo_producto} - ${d.producto.nombre_producto}` : '—';
            detallesHtml += `<tr><td>${prod}</td><td>${parseFloat(d.cantidad).toFixed(2)}</td><td>Bs ${parseFloat(d.precio_unitario).toFixed(2)}</td><td>Bs ${parseFloat(d.subtotal).toFixed(2)}</td></tr>`;
        });
        detallesHtml += `</tbody></table><p style="text-align:right;font-weight:bold;margin-top:8px;">Total: Bs ${total.toFixed(2)}</p>`;

        Swal.fire({
            title: `Orden: ${o.codigo_orden}`,
            html: `
                <div style="text-align:left;">
                    <p><strong>Proveedor:</strong> ${o.proveedor?.nombre_proveedor || '—'}</p>
                    <p><strong>Estado:</strong> ${o.estado?.nombre_estado || '—'}</p>
                    <p><strong>Fecha:</strong> ${o.fecha_orden || '—'}</p>
                    <p><strong>Observaciones:</strong> ${o.observaciones || '—'}</p>
                    <hr>
                    ${detallesHtml}
                </div>
            `,
            width: '700px',
        });
    } catch (e) { Swal.fire('Error', 'No se pudo cargar', 'error'); }
}

async function cambiarEstadoOrden(id) {
    try {
        const data = await apiFetch(`/ordenes-compra/${id}`);
        const o = data.data || data;
        const estadoActual = o.id_estado_orden_compra;

        const transiciones = { 1: 'Aprobada', 2: 'Enviada', 3: 'Recibida' };
        const siguienteTexto = transiciones[estadoActual];
        if (!siguienteTexto) { Swal.fire('Info', 'La orden ya está en estado terminal', 'info'); return; }

        const r = await Swal.fire({
            title: `¿Avanzar a "${siguienteTexto}"?`,
            text: `La orden "${o.codigo_orden}" pasará al estado "${siguienteTexto}".`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Sí, pasar a ${siguienteTexto}`,
            cancelButtonText: 'Cancelar',
        });
        if (!r.isConfirmed) return;

        const nextStateId = estadoActual + 1;
        await apiFetch(`/ordenes-compra/${id}/cambiar-estado`, {
            method: 'POST',
            body: { id_estado_orden_compra: nextStateId },
        });
        Swal.fire('Actualizado', `Orden pasó a "${siguienteTexto}"`, 'success');
        await reloadDataTable(ordenesTable, '/ordenes-compra');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}
