const API_VENTAS = `${API_URL}/ventas`;
let ventasTable;
let editMode = false;
let editId = null;
let detalleIndex = 0;

const MODAL_TITLE_CREATE = 'Nueva Venta';
const MODAL_TITLE_EDIT = 'Editar Venta';

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await loadUserPermissions();
    renderContent();
});

function renderContent() {
    const canCreate = hasPermission('Ventas', 'crear');
    const canEdit = hasPermission('Ventas', 'editar');
    const canDelete = hasPermission('Ventas', 'eliminar');

    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-credit-card"></i> Listado de Ventas</h3>
                <div class="card-actions">
                    ${canCreate ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nueva Venta</button>' : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table id="ventasTable" class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Pagos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="ventaModal" class="modal-overlay">
            <div class="modal" style="max-width:750px;">
                <div class="modal-header">
                    <h3 id="ventaModalTitle">${MODAL_TITLE_CREATE}</h3>
                    <button class="modal-close" onclick="closeModal('ventaModal')">&times;</button>
                </div>
                <form id="ventaForm">
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="id_pedido">Pedido *</label>
                                <select id="id_pedido" class="form-control" required>
                                    <option value="">Seleccione un pedido...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="id_estado_venta">Estado</label>
                                <select id="id_estado_venta" class="form-control">
                                    <option value="">Seleccione...</option>
                                </select>
                            </div>
                        </div>

                        <h4 class="mt-3"><i class="fas fa-boxes"></i> Detalle de Productos</h4>
                        <div id="detalles-container">
                            <div class="detalle-row" data-index="0">
                                <div class="form-row detalle-fields">
                                    <div class="form-group" style="flex:2">
                                        <label>Lote *</label>
                                        <select class="form-control id_lote" required>
                                            <option value="">Seleccione lote...</option>
                                        </select>
                                    </div>
                                    <div class="form-group" style="flex:1">
                                        <label>Cantidad *</label>
                                        <input type="number" class="form-control cantidad" step="0.01" min="0.01" required>
                                    </div>
                                    <div class="form-group" style="flex:1">
                                        <label>Precio Unit. *</label>
                                        <input type="number" class="form-control precio_unitario" step="0.01" min="0" required>
                                    </div>
                                    <div class="form-group" style="flex:1">
                                        <label>Subtotal</label>
                                        <input type="text" class="form-control subtotal" readonly>
                                    </div>
                                    <div class="form-group" style="flex:0">
                                        <label>&nbsp;</label>
                                        <button type="button" class="btn btn-danger btn-sm btn-remove-detalle" onclick="removeDetalle(this)" title="Eliminar">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm mb-3" onclick="addDetalleRow()">
                            <i class="fas fa-plus"></i> Agregar producto
                        </button>

                        <div class="form-row mt-2">
                            <div class="form-group" style="max-width:250px;margin-left:auto">
                                <label><strong>Total</strong></label>
                                <input type="text" id="total_display" class="form-control" style="font-weight:bold;font-size:1.1em" readonly>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('ventaModal')">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${canCreate ? 'Guardar' : 'Actualizar'}</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="viewVentaModal" class="modal-overlay">
            <div class="modal" style="max-width:750px;">
                <div class="modal-header">
                    <h3><i class="fas fa-eye"></i> Detalle de Venta</h3>
                    <button class="modal-close" onclick="closeModal('viewVentaModal')">&times;</button>
                </div>
                <div class="modal-body" id="viewVentaContent"></div>
            </div>
        </div>

        <div id="pagoModal" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-money-bill"></i> Registrar Pago</h3>
                    <button class="modal-close" onclick="closeModal('pagoModal')">&times;</button>
                </div>
                <form id="pagoForm">
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="pago_id_metodo_pago">Método de Pago *</label>
                            <select id="pago_id_metodo_pago" class="form-control" required>
                                <option value="">Seleccione...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="pago_monto">Monto *</label>
                            <input type="number" id="pago_monto" class="form-control" step="0.01" min="0.01" required>
                        </div>
                        <div class="form-group">
                            <label for="pago_referencia">Referencia</label>
                            <input type="text" id="pago_referencia" class="form-control" maxlength="100">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('pagoModal')">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar Pago</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    loadEstadosVenta();
    loadMetodosPago();
    loadPedidos();

    initDataTable();
    setupFormSubmit();
    setupPagoFormSubmit();
}

function initDataTable() {
    const canEdit = hasPermission('Ventas', 'editar');
    const canDelete = hasPermission('Ventas', 'eliminar');
    const canRegisterPayment = hasPermission('Ventas', 'registrar-pago');

    ventasTable = $('#ventasTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: API_VENTAS,
            headers: getAuthHeaders(),
            dataSrc: function (json) {
                return json.data || [];
            }
        },
        columns: [
            { data: 'id_venta' },
            {
                data: 'pedido',
                render: data => data ? `#${data.id_pedido} - ${data.farmacia?.nombre || '—'}` : '—'
            },
            {
                data: 'pedido',
                render: data => data?.farmacia?.nombre || '—'
            },
            {
                data: 'total',
                render: data => `Bs ${parseFloat(data || 0).toFixed(2)}`
            },
            {
                data: 'estado',
                render: data => {
                    const estados = { 1: 'Pendiente', 2: 'Pagada', 3: 'Completada', 4: 'Cancelada' };
                    const id = data?.id_estado_venta;
                    const label = estados[id] || '—';
                    const colors = { 1: 'warning', 2: 'info', 3: 'success', 4: 'danger' };
                    return `<span class="badge badge-${colors[id] || 'secondary'}">${label}</span>`;
                }
            },
            {
                data: 'fecha_venta',
                render: data => data ? new Date(data).toLocaleDateString('es-BO') : '—'
            },
            {
                data: 'pagos',
                render: data => {
                    if (!data || !data.length) return '—';
                    const total = data.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
                    return `<span title="${data.length} pago(s)">Bs ${total.toFixed(2)}</span>`;
                }
            },
            {
                data: null,
                render: function (row) {
                    let btns = `<button class="btn btn-sm btn-info" onclick="viewVenta(${row.id_venta})" title="Ver detalle"><i class="fas fa-eye"></i></button>`;
                    if (canEdit) btns += ` <button class="btn btn-sm btn-warning" onclick="editVenta(${row.id_venta})" title="Editar"><i class="fas fa-edit"></i></button>`;
                    if (canRegisterPayment) btns += ` <button class="btn btn-sm btn-success" onclick="openPagoModal(${row.id_venta})" title="Registrar pago"><i class="fas fa-money-bill"></i></button>`;
                    if (canDelete) btns += ` <button class="btn btn-sm btn-danger" onclick="deleteVenta(${row.id_venta})" title="Eliminar"><i class="fas fa-trash"></i></button>`;
                    return btns;
                }
            }
        ],
        order: [[0, 'desc']],
        language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }
    });
}

async function loadEstadosVenta() {
    try {
        const res = await fetch(`${API_URL}/catalogos/estados-venta`, { headers: getAuthHeaders() });
        const json = await res.json();
        const select = document.getElementById('id_estado_venta');
        if (json.data) {
            json.data.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id_estado_venta;
                opt.textContent = e.nombre_estado;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error loading estados venta:', e); }
}

async function loadMetodosPago() {
    try {
        const res = await fetch(`${API_URL}/catalogos/metodos-pago`, { headers: getAuthHeaders() });
        const json = await res.json();
        const select = document.getElementById('pago_id_metodo_pago');
        if (json.data) {
            json.data.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id_metodo_pago;
                opt.textContent = m.nombre_metodo;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error loading metodos pago:', e); }
}

async function loadPedidos() {
    try {
        const res = await fetch(`${API_URL}/pedidos?per_page=1000`, { headers: getAuthHeaders() });
        const json = await res.json();
        const data = json.data || [];
        const select = document.getElementById('id_pedido');
        data.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_pedido;
            opt.textContent = `#${p.id_pedido} - ${p.farmacia?.nombre || '—'}`;
            select.appendChild(opt);
        });
    } catch (e) { console.error('Error loading pedidos:', e); }
}

async function loadLotes(selectEl) {
    try {
        const res = await fetch(`${API_URL}/productos?per_page=1000`, { headers: getAuthHeaders() });
        const json = await res.json();
        const productos = json.data || [];
        selectEl.innerHTML = '<option value="">Seleccione producto primero...</option>';

        for (const prod of productos) {
            try {
                const lres = await fetch(`${API_URL}/productos/${prod.id_producto}/lotes`, { headers: getAuthHeaders() });
                const ljson = await lres.json();
                const lotes = ljson.data || [];
                lotes.forEach(l => {
                    if (l.fecha_vencimiento && new Date(l.fecha_vencimiento) > new Date()) {
                        const opt = document.createElement('option');
                        opt.value = l.id_lote;
                        opt.textContent = `${prod.nombre_producto} - Lote: ${l.codigo_lote} (Vence: ${new Date(l.fecha_vencimiento).toLocaleDateString('es-BO')})`;
                        selectEl.appendChild(opt);
                    }
                });
            } catch (e) { /* skip */ }
        }
    } catch (e) { console.error('Error loading lotes:', e); }
}

function addDetalleRow(data) {
    detalleIndex++;
    const container = document.getElementById('detalles-container');
    const index = detalleIndex;
    const row = document.createElement('div');
    row.className = 'detalle-row';
    row.dataset.index = index;
    row.innerHTML = `
        <div class="form-row detalle-fields">
            <div class="form-group" style="flex:2">
                <label>Lote *</label>
                <select class="form-control id_lote" required>
                    <option value="">Seleccione lote...</option>
                </select>
            </div>
            <div class="form-group" style="flex:1">
                <label>Cantidad *</label>
                <input type="number" class="form-control cantidad" step="0.01" min="0.01" required>
            </div>
            <div class="form-group" style="flex:1">
                <label>Precio Unit. *</label>
                <input type="number" class="form-control precio_unitario" step="0.01" min="0" required>
            </div>
            <div class="form-group" style="flex:1">
                <label>Subtotal</label>
                <input type="text" class="form-control subtotal" readonly>
            </div>
            <div class="form-group" style="flex:0">
                <label>&nbsp;</label>
                <button type="button" class="btn btn-danger btn-sm btn-remove-detalle" onclick="removeDetalle(this)" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(row);
    loadLotes(row.querySelector('.id_lote'));

    if (data) {
        row.querySelector('.id_lote').value = data.id_lote;
        row.querySelector('.cantidad').value = data.cantidad;
        row.querySelector('.precio_unitario').value = data.precio_unitario;
        updateSubtotal(row);
    }

    row.querySelector('.cantidad').addEventListener('input', function () { updateSubtotal(row); });
    row.querySelector('.precio_unitario').addEventListener('input', function () { updateSubtotal(row); });
}

function removeDetalle(btn) {
    const row = btn.closest('.detalle-row');
    if (document.querySelectorAll('.detalle-row').length <= 1) {
        Swal.fire('Error', 'Debe haber al menos un producto.', 'warning');
        return;
    }
    row.remove();
    updateTotal();
}

function updateSubtotal(row) {
    const cantidad = parseFloat(row.querySelector('.cantidad').value) || 0;
    const precio = parseFloat(row.querySelector('.precio_unitario').value) || 0;
    const subtotal = cantidad * precio;
    row.querySelector('.subtotal').value = subtotal.toFixed(2);
    updateTotal();
}

function updateTotal() {
    let total = 0;
    document.querySelectorAll('.detalle-row').forEach(row => {
        total += parseFloat(row.querySelector('.subtotal').value) || 0;
    });
    document.getElementById('total_display').value = total.toFixed(2);
}

function openCreateModal() {
    editMode = false;
    editId = null;
    document.getElementById('ventaModalTitle').textContent = MODAL_TITLE_CREATE;
    document.getElementById('ventaForm').reset();
    document.getElementById('total_display').value = '0.00';

    document.querySelectorAll('.detalle-row:not(:first-child)').forEach(r => r.remove());
    const firstRow = document.querySelector('.detalle-row');
    firstRow.querySelector('.id_lote').value = '';
    firstRow.querySelector('.cantidad').value = '';
    firstRow.querySelector('.precio_unitario').value = '';
    firstRow.querySelector('.subtotal').value = '';
    loadLotes(firstRow.querySelector('.id_lote'));

    openModal('ventaModal');
}

async function editVenta(id) {
    try {
        const res = await fetch(`${API_VENTAS}/${id}`, { headers: getAuthHeaders() });
        const json = await res.json();
        const v = json.data;

        editMode = true;
        editId = id;
        document.getElementById('ventaModalTitle').textContent = MODAL_TITLE_EDIT;
        document.getElementById('id_pedido').value = v.id_pedido;
        document.getElementById('id_estado_venta').value = v.id_estado_venta || '';

        document.querySelectorAll('.detalle-row').forEach(r => r.remove());
        detalleIndex = 0;

        if (v.detalles && v.detalles.length) {
            v.detalles.forEach(d => {
                addDetalleRow({
                    id_lote: d.id_lote,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                });
            });
        } else {
            addDetalleRow();
        }

        updateTotal();
        openModal('ventaModal');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar la venta.', 'error');
    }
}

function setupFormSubmit() {
    document.getElementById('ventaForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const detalles = [];
        document.querySelectorAll('.detalle-row').forEach(row => {
            detalles.push({
                id_lote: parseInt(row.querySelector('.id_lote').value),
                cantidad: parseFloat(row.querySelector('.cantidad').value),
                precio_unitario: parseFloat(row.querySelector('.precio_unitario').value),
            });
        });

        const body = {
            id_pedido: parseInt(document.getElementById('id_pedido').value),
            id_estado_venta: document.getElementById('id_estado_venta').value ? parseInt(document.getElementById('id_estado_venta').value) : undefined,
            detalles,
        };

        if (!body.detalles.length || detalles.some(d => !d.id_lote || !d.cantidad || d.precio_unitario === undefined)) {
            Swal.fire('Error', 'Complete todos los campos de los productos.', 'warning');
            return;
        }

        try {
            const url = editMode ? `${API_VENTAS}/${editId}` : API_VENTAS;
            const method = editMode ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();

            if (!res.ok) throw new Error(json.message || 'Error al guardar');

            Swal.fire('Éxito', json.message, 'success');
            closeModal('ventaModal');
            ventasTable.ajax.reload();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });
}

async function viewVenta(id) {
    try {
        const res = await fetch(`${API_VENTAS}/${id}`, { headers: getAuthHeaders() });
        const json = await res.json();
        const v = json.data;

        const estados = { 1: 'Pendiente', 2: 'Pagada', 3: 'Completada', 4: 'Cancelada' };
        const colors = { 1: 'warning', 2: 'info', 3: 'success', 4: 'danger' };
        const estado = v.estado;
        const estadoLabel = estados[estado?.id_estado_venta] || '—';
        const estadoColor = colors[estado?.id_estado_venta] || 'secondary';

        let detallesHtml = '';
        if (v.detalles && v.detalles.length) {
            v.detalles.forEach(d => {
                const lote = d.lote || {};
                const prod = lote.producto || {};
                detallesHtml += `<tr>
                    <td>${prod.nombre_producto || '—'}</td>
                    <td>${lote.codigo_lote || '—'}</td>
                    <td>${parseFloat(d.cantidad).toFixed(2)}</td>
                    <td>Bs ${parseFloat(d.precio_unitario).toFixed(2)}</td>
                    <td>Bs ${parseFloat(d.subtotal).toFixed(2)}</td>
                </tr>`;
            });
        }

        let pagosHtml = '';
        if (v.pagos && v.pagos.length) {
            v.pagos.forEach(p => {
                pagosHtml += `<tr>
                    <td>${p.metodo_pago?.nombre_metodo || '—'}</td>
                    <td>Bs ${parseFloat(p.monto).toFixed(2)}</td>
                    <td>${p.referencia || '—'}</td>
                    <td>${new Date(p.fecha_pago).toLocaleString('es-BO')}</td>
                </tr>`;
            });
        }

        document.getElementById('viewVentaContent').innerHTML = `
            <div class="detail-grid">
                <div><strong>Venta #:</strong> ${v.id_venta}</div>
                <div><strong>Pedido #:</strong> ${v.pedido?.id_pedido || '—'}</div>
                <div><strong>Cliente:</strong> ${v.pedido?.farmacia?.nombre || '—'}</div>
                <div><strong>Usuario:</strong> ${v.usuario ? `${v.usuario.nombre} ${v.usuario.apellido}` : '—'}</div>
                <div><strong>Fecha:</strong> ${new Date(v.fecha_venta).toLocaleDateString('es-BO')}</div>
                <div><strong>Estado:</strong> <span class="badge badge-${estadoColor}">${estadoLabel}</span></div>
                <div><strong>Total:</strong> <strong>Bs ${parseFloat(v.total).toFixed(2)}</strong></div>
            </div>

            <h4 class="mt-3"><i class="fas fa-boxes"></i> Productos</h4>
            <div class="table-responsive">
                <table class="table">
                    <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
                    <tbody>${detallesHtml || '<tr><td colspan="5" class="text-center">Sin productos</td></tr>'}</tbody>
                </table>
            </div>

            <h4 class="mt-3"><i class="fas fa-money-bill"></i> Pagos</h4>
            <div class="table-responsive">
                <table class="table">
                    <thead><tr><th>Método</th><th>Monto</th><th>Referencia</th><th>Fecha</th></tr></thead>
                    <tbody>${pagosHtml || '<tr><td colspan="4" class="text-center">Sin pagos registrados</td></tr>'}</tbody>
                </table>
            </div>
        `;

        openModal('viewVentaModal');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el detalle.', 'error');
    }
}

async function deleteVenta(id) {
    const result = await Swal.fire({
        title: '¿Eliminar venta?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_VENTAS}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Error al eliminar');
        Swal.fire('Eliminada', json.message, 'success');
        ventasTable.ajax.reload();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

let pagoVentaId = null;

function openPagoModal(ventaId) {
    pagoVentaId = ventaId;
    document.getElementById('pagoForm').reset();
    openModal('pagoModal');
}

function setupPagoFormSubmit() {
    document.getElementById('pagoForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const body = {
            id_metodo_pago: parseInt(document.getElementById('pago_id_metodo_pago').value),
            monto: parseFloat(document.getElementById('pago_monto').value),
            referencia: document.getElementById('pago_referencia').value || null,
        };

        try {
            const res = await fetch(`${API_VENTAS}/${pagoVentaId}/pagos`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Error al registrar pago');

            Swal.fire('Éxito', json.message, 'success');
            closeModal('pagoModal');
            ventasTable.ajax.reload();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });
}
