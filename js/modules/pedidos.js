let pedidosTable, editingId = null, farmaciasList = [], estadosPedido = [];
let productosList = [], detalleItems = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Pedidos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadFarmacias(), loadEstados(), loadProductos()]);
    renderPage();
});

async function loadFarmacias() {
    try { const d = await apiFetch('/farmacias'); farmaciasList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { farmaciasList = []; }
}

async function loadEstados() {
    try { const d = await apiFetch('/catalogos/estados-pedido'); estadosPedido = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { estadosPedido = [{ id_estado_pedido: 1, nombre_estado: 'Pendiente' }, { id_estado_pedido: 2, nombre_estado: 'Aprobado' }]; }
}

async function loadProductos() {
    try { const d = await apiFetch('/productos?per_page=-1'); productosList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { productosList = []; }
}

function getProductoName(id) {
    const p = productosList.find(x => x.id_producto === id);
    return p ? p.nombre : '—';
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-box"></i> Pedidos</h3>
                ${hasPermission('Pedidos', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Pedido</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>ID</th><th>Farmacia</th><th>Estado</th><th>Productos</th><th>Total</th><th>Fecha</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>

        <div id="main-modal" class="modal-overlay">
            <div class="modal" style="max-width:700px;">
                <div class="modal-header">
                    <h3 id="modal-title">Nuevo Pedido</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="main-form">
                        <div class="form-row">
                            <div class="form-group" style="flex:2">
                                <label>Farmacia *</label>
                                <select id="f-farmacia" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${farmaciasList.map(f => `<option value="${f.id_farmacia}">${f.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="flex:1">
                                <label>Estado</label>
                                <select id="f-estado" class="form-control">
                                    ${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${e.nombre_estado}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="f-observaciones" class="form-control" rows="2"></textarea>
                        </div>
                    </form>

                    <hr>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <h4 style="margin:0;"><i class="fas fa-cube"></i> Productos</h4>
                        <button class="btn btn-sm btn-primary" onclick="openProductoModal()"><i class="fas fa-plus"></i> Agregar Producto</button>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="table" style="width:100%;font-size:13px;" id="detalle-table">
                            <thead><tr>
                                <th>Producto</th>
                                <th style="width:80px;">Cant.</th>
                                <th style="width:90px;">Precio Unit.</th>
                                <th style="width:90px;">Subtotal</th>
                                <th style="width:50px;"></th>
                            </tr></thead>
                            <tbody id="detalle-body">
                                <tr id="detalle-empty"><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Sin productos agregados</td></tr>
                            </tbody>
                            <tfoot>
                                <tr><th colspan="3" style="text-align:right;">Subtotal</th><th id="detalle-subtotal">Bs 0.00</th><th></th></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="save()">Guardar Pedido</button>
                </div>
            </div>
        </div>

        <div id="producto-modal" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Agregar Producto</h3>
                    <button class="modal-close" onclick="closeProductoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="producto-form">
                        <div class="form-group">
                            <label>Producto *</label>
                            <select id="p-producto" class="form-control" required>
                                <option value="">Seleccione o busque...</option>
                                ${productosList.filter(p => p.estado !== false).map(p => `<option value="${p.id_producto}" data-precio="${p.precio_unitario}">${p.nombre} (Bs ${parseFloat(p.precio_unitario).toFixed(2)})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Cantidad *</label>
                                <input type="number" id="p-cantidad" class="form-control" step="0.01" min="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>Precio Unitario (Bs) *</label>
                                <input type="number" id="p-precio" class="form-control" step="0.01" min="0" required>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeProductoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="addProductoToDetalle()">Agregar</button>
                </div>
            </div>
        </div>

        <div id="view-modal" class="modal-overlay">
            <div class="modal">
                <div class="modal-header"><h3>Detalle del Pedido</h3><button class="modal-close" onclick="closeViewModal()">&times;</button></div>
                <div class="modal-body" id="view-body"></div>
            </div>
        </div>

        <div id="estado-modal" class="modal-overlay">
            <div class="modal" style="max-width:400px;">
                <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
                <div class="modal-body">
                    <p class="text-muted mb-4">Nuevo estado para pedido <strong id="estado-ref"></strong></p>
                    <div class="form-group"><label>Estado</label><select id="s-estado" class="form-control">${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${e.nombre_estado}</option>`).join('')}</select></div>
                </div>
                <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
            </div>
        </div>
    `;
    loadTable();

    document.getElementById('p-producto').addEventListener('change', function () {
        const opt = this.options[this.selectedIndex];
        if (opt && opt.dataset.precio) {
            document.getElementById('p-precio').value = opt.dataset.precio;
        }
    });
}

async function loadTable() {
    try {
        const d = await apiFetch('/pedidos');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) pedidosTable.destroy();
        pedidosTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'desc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'id_pedido' },
                { data: null, render: r => r.farmacia?.nombre || '—' },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || r.nombre_estado || '—') },
                { data: null, render: r => (r.detalles_count ?? r.detalles?.length ?? 0) + ' producto(s)' },
                { data: null, render: r => `Bs ${parseFloat(r.total || 0).toFixed(2)}` },
                { data: null, render: r => formatDate(r.fecha_pedido) },
                { data: null, render: r => `<div class="actions">
                    <button class="btn btn-sm btn-info" onclick="view(${r.id_pedido})"><i class="fas fa-eye"></i></button>
                    ${hasPermission('Pedidos', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_pedido},'#${r.id_pedido}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Pedidos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_pedido})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Pedidos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_pedido})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar pedidos: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null;
    detalleItems = [];
    document.getElementById('modal-title').textContent = 'Nuevo Pedido';
    document.getElementById('main-form').reset();
    document.getElementById('f-estado').value = '1';
    renderDetalle();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('main-modal').classList.remove('active');
    editingId = null;
    detalleItems = [];
}

function closeViewModal() { document.getElementById('view-modal').classList.remove('active'); }

function calcDetalleTotal() {
    return detalleItems.reduce((s, d) => s + (d.cantidad_solicitada * d.precio_unitario), 0);
}

function renderDetalle() {
    const tbody = document.getElementById('detalle-body');
    if (!tbody) return;
    if (detalleItems.length === 0) {
        tbody.innerHTML = '<tr id="detalle-empty"><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Sin productos agregados</td></tr>';
    } else {
        let html = '';
        detalleItems.forEach((d, i) => {
            const nombre = getProductoName(d.id_producto);
            const subtotal = d.cantidad_solicitada * d.precio_unitario;
            html += `<tr>
                <td>${nombre}</td>
                <td><input type="number" class="form-control" style="width:70px;padding:4px 6px;font-size:12px;" value="${d.cantidad_solicitada}" min="0.01" step="0.01" data-index="${i}" onchange="updateDetalleCant(${i}, this.value)"></td>
                <td><input type="number" class="form-control" style="width:80px;padding:4px 6px;font-size:12px;" value="${d.precio_unitario}" min="0" step="0.01" data-index="${i}" onchange="updateDetallePrecio(${i}, this.value)"></td>
                <td>Bs ${subtotal.toFixed(2)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="removeDetalle(${i})"><i class="fas fa-times"></i></button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    document.getElementById('detalle-subtotal').textContent = 'Bs ' + calcDetalleTotal().toFixed(2);
}

function updateDetalleCant(idx, val) {
    if (detalleItems[idx]) {
        detalleItems[idx].cantidad_solicitada = parseFloat(val) || 0;
        renderDetalle();
    }
}

function updateDetallePrecio(idx, val) {
    if (detalleItems[idx]) {
        detalleItems[idx].precio_unitario = parseFloat(val) || 0;
        renderDetalle();
    }
}

function openProductoModal() {
    document.getElementById('producto-form').reset();
    document.getElementById('p-precio').value = '';
    document.getElementById('producto-modal').classList.add('active');
}

function closeProductoModal() { document.getElementById('producto-modal').classList.remove('active'); }

function addProductoToDetalle() {
    const id_producto = parseInt(document.getElementById('p-producto').value);
    const cantidad_solicitada = parseFloat(document.getElementById('p-cantidad').value);
    const precio_unitario = parseFloat(document.getElementById('p-precio').value);

    if (!id_producto) return Swal.fire('Validación', 'Seleccione un producto', 'warning');
    if (!cantidad_solicitada || cantidad_solicitada <= 0) return Swal.fire('Validación', 'Ingrese una cantidad válida', 'warning');
    if (!precio_unitario || precio_unitario <= 0) return Swal.fire('Validación', 'Ingrese un precio válido', 'warning');

    const existing = detalleItems.findIndex(d => d.id_producto === id_producto);
    if (existing >= 0) {
        detalleItems[existing].cantidad_solicitada += cantidad_solicitada;
    } else {
        detalleItems.push({ id_producto, cantidad_solicitada, precio_unitario, id_estado_detalle: 1 });
    }

    closeProductoModal();
    renderDetalle();
}

function removeDetalle(idx) {
    detalleItems.splice(idx, 1);
    renderDetalle();
}

async function view(id) {
    try {
        const d = await apiFetch(`/pedidos/${id}`);
        const p = d.pedido || d.data || d;

        const detalles = p.detalles || [];
        const hasDetalle = Array.isArray(detalles) && detalles.length > 0;

        let detalleHtml = '';
        if (hasDetalle) {
            detalleHtml = `
                <table class="table" style="width:100%">
                    <thead><tr><th>Producto</th><th>Solicitado</th><th>Entregado</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
                    <tbody>
                        ${detalles.map(d => `
                            <tr>
                                <td>${d.producto?.nombre || '—'}</td>
                                <td>${parseFloat(d.cantidad_solicitada)}</td>
                                <td>${parseFloat(d.cantidad_entregada)}</td>
                                <td>Bs ${parseFloat(d.precio_unitario).toFixed(2)}</td>
                                <td>Bs ${parseFloat(d.subtotal).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            detalleHtml = '<p class="text-muted">Sin productos registrados</p>';
        }

        document.getElementById('view-body').innerHTML = `
            <div class="info-grid">
                <div><strong># Pedido:</strong> ${p.id_pedido}</div>
                <div><strong>Farmacia:</strong> ${p.farmacia?.nombre || '—'}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(p.estado?.nombre_estado || '—')}</div>
                <div><strong>Fecha:</strong> ${formatDate(p.fecha_pedido)}</div>
                <div><strong>Subtotal:</strong> Bs ${parseFloat(p.subtotal || 0).toFixed(2)}</div>
                <div><strong>Descuento:</strong> Bs ${parseFloat(p.descuento || 0).toFixed(2)}</div>
                <div><strong>Total:</strong> Bs ${parseFloat(p.total || 0).toFixed(2)}</div>
                <div style="grid-column: span 2"><strong>Observaciones:</strong> ${p.observaciones || '—'}</div>
            </div>
            <hr>
            <h4>Productos</h4>
            ${detalleHtml}
        `;
        document.getElementById('view-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el pedido', 'error'); }
}

async function edit(id) {
    try {
        const d = await apiFetch(`/pedidos/${id}`);
        const p = d.pedido || d.data || d;
        editingId = id;

        document.getElementById('modal-title').textContent = 'Editar Pedido';
        document.getElementById('f-farmacia').value = p.id_farmacia || '';
        document.getElementById('f-estado').value = p.id_estado_pedido || '';
        document.getElementById('f-observaciones').value = p.observaciones || '';

        detalleItems = (p.detalles || []).map(d => ({
            id_producto: d.id_producto,
            cantidad_solicitada: parseFloat(d.cantidad_solicitada),
            precio_unitario: parseFloat(d.precio_unitario),
            id_estado_detalle: d.id_estado_detalle || 1,
            _id_detalle: d.id_detalle,
        }));
        renderDetalle();
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el pedido', 'error'); }
}

async function save() {
    const id_farmacia = parseInt(document.getElementById('f-farmacia').value);
    const id_estado_pedido = parseInt(document.getElementById('f-estado').value);
    const observaciones = document.getElementById('f-observaciones').value.trim();
    if (!id_farmacia) return Swal.fire('Validación', 'Seleccione una farmacia', 'warning');
    if (detalleItems.length === 0) return Swal.fire('Validación', 'Agregue al menos un producto al pedido', 'warning');

    const currentUser = getUser();
    const body = {
        id_farmacia, id_estado_pedido, observaciones,
        id_usuario: currentUser?.id_usuario || currentUser?.id || null,
    };

    try {
        if (editingId) {
            await apiFetch(`/pedidos/${editingId}`, { method: 'PUT', body });
            await saveDetalle(editingId);
            Swal.fire('Actualizado', 'Pedido actualizado', 'success');
        } else {
            const resp = await apiFetch('/pedidos', { method: 'POST', body });
            const pedidoId = resp.data?.id_pedido || resp.pedido?.id_pedido;
            await saveDetalle(pedidoId);
            Swal.fire('Creado', 'Pedido creado', 'success');
        }
        closeModal(); if (pedidosTable) await reloadDataTable(pedidosTable, '/pedidos');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function saveDetalle(pedidoId) {
    const currentDetalles = await apiFetch(`/pedidos/${pedidoId}/detalles`);
    const existing = Array.isArray(currentDetalles) ? currentDetalles : (currentDetalles.data || []);

    for (const d of existing) {
        const stillExists = detalleItems.some(item => item._id_detalle === d.id_detalle);
        if (!stillExists) {
            await apiFetch(`/pedidos/${pedidoId}/detalles/${d.id_detalle}`, { method: 'DELETE' });
        }
    }

    for (const item of detalleItems) {
        if (item._id_detalle) {
            await apiFetch(`/pedidos/${pedidoId}/detalles/${item._id_detalle}`, {
                method: 'PUT',
                body: {
                    cantidad_solicitada: item.cantidad_solicitada,
                    precio_unitario: item.precio_unitario,
                }
            });
        } else {
            await apiFetch(`/pedidos/${pedidoId}/detalles`, {
                method: 'POST',
                body: {
                    id_producto: item.id_producto,
                    cantidad_solicitada: item.cantidad_solicitada,
                    precio_unitario: item.precio_unitario,
                }
            });
        }
    }
}

async function del(id) {
    const r = await Swal.fire({
        title: '¿Eliminar pedido?',
        text: `Se eliminará el pedido #${id}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/pedidos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Pedido eliminado exitosamente.', 'success');
        if (pedidosTable) await reloadDataTable(pedidosTable, '/pedidos');
    } catch (e) {
        if (e.status === 409 || e.has_dispatch || e.data?.has_dispatch) {
            Swal.fire({ title: 'No se puede eliminar', html: '<p>Este pedido ya tiene un despacho registrado.</p>', icon: 'info', confirmButtonText: 'Entendido' });
        } else {
            Swal.fire('Error', e.message || 'Error al eliminar', 'error');
        }
    }
}

let estadoPedidoId = null;

function openEstadoModal(id, ref) {
    estadoPedidoId = id;
    document.getElementById('estado-ref').textContent = ref;
    document.getElementById('s-estado').value = '';
    document.getElementById('estado-modal').classList.add('active');
}

function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoPedidoId = null; }

async function changeEstado() {
    const id_estado_pedido = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_pedido) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try {
        await apiFetch(`/pedidos/${estadoPedidoId}/cambiar-estado`, { method: 'POST', body: { id_estado_pedido } });
        Swal.fire('Actualizado', 'Estado cambiado correctamente', 'success');
        closeEstadoModal(); if (pedidosTable) await reloadDataTable(pedidosTable, '/pedidos');
    } catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}
