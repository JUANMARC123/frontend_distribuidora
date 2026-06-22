let devTable, editingId = null, tiposDevolucion = [], estadosDevolucion = [], pedidosList = [], productosList = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Devoluciones', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadTipos(), loadEstados(), loadPedidos(), loadProductos()]);
    renderPage();
});

async function loadTipos() {
    try { const d = await apiFetch('/catalogos/tipos-devolucion'); tiposDevolucion = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { tiposDevolucion = []; }
}

async function loadEstados() {
    try { const d = await apiFetch('/catalogos/estados-devolucion'); estadosDevolucion = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { estadosDevolucion = []; }
}

async function loadPedidos() {
    try { const d = await apiFetch('/pedidos'); pedidosList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { pedidosList = []; }
}

async function loadProductos() {
    try { const d = await apiFetch('/productos'); productosList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { productosList = []; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-undo-alt"></i> Devoluciones</h3>
                ${hasPermission('Devoluciones', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nueva Devolución</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>ID</th><th>Pedido</th><th>Tipo</th><th>Estado</th><th>Total</th><th>Fecha</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nueva Devolución</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Pedido *</label><select id="f-pedido" class="form-control" required><option value="">Seleccione...</option>${pedidosList.map(p => `<option value="${p.id_pedido}">#${p.id_pedido} - ${p.farmacia?.nombre || ''}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Tipo de Devolución *</label><select id="f-tipo" class="form-control" required><option value="">Seleccione...</option>${tiposDevolucion.map(t => `<option value="${t.id_tipo_devolucion}">${t.nombre_tipo}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Motivo</label><textarea id="f-motivo" class="form-control" rows="2"></textarea></div>
                    <hr>
                    <h4>Productos a Devolver</h4>
                    <table class="table" id="detalle-table" style="width:100%">
                        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Motivo</th><th></th></tr></thead>
                        <tbody id="detalle-body"></tbody>
                    </table>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="addDetalleRow()"><i class="fas fa-plus"></i> Agregar Producto</button>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="view-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3>Detalle de la Devolución</h3><button class="modal-close" onclick="closeViewModal()">&times;</button></div>
            <div class="modal-body" id="view-body"></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Seleccione el nuevo estado para la devolución <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Nuevo Estado</label><select id="s-estado" class="form-control">${estadosDevolucion.map(e => `<option value="${e.id_estado_devolucion}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>
    `;
    loadTable();
}

function addDetalleRow(producto, cantidad, precio, motivo) {
    const tbody = document.getElementById('detalle-body');
    const row = document.createElement('tr');
    const prodOpts = productosList.map(p => `<option value="${p.id_producto}" data-precio="${p.precio_unitario}" ${producto && p.id_producto == producto ? 'selected' : ''}>${p.nombre_producto}</option>`).join('');
    row.innerHTML = `
        <td><select class="form-control detalle-producto" required>${prodOpts}</select></td>
        <td><input type="number" class="form-control detalle-cantidad" step="0.01" min="0.01" value="${cantidad || ''}" required></td>
        <td><input type="number" class="form-control detalle-precio" step="0.01" min="0" value="${precio || ''}" required></td>
        <td><span class="detalle-subtotal">${precio && cantidad ? (cantidad * precio).toFixed(2) : ''}</span></td>
        <td><input type="text" class="form-control detalle-motivo" value="${motivo || ''}" placeholder="Motivo (opcional)"></td>
        <td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(row);

    const prodSel = row.querySelector('.detalle-producto');
    const cantInput = row.querySelector('.detalle-cantidad');
    const precInput = row.querySelector('.detalle-precio');
    const subtSpan = row.querySelector('.detalle-subtotal');

    function updateSubtotal() {
        const qty = parseFloat(cantInput.value) || 0;
        const prc = parseFloat(precInput.value) || 0;
        subtSpan.textContent = (qty * prc).toFixed(2);
    }

    prodSel.addEventListener('change', function() {
        const opt = this.options[this.selectedIndex];
        if (opt && opt.dataset.precio) precInput.value = opt.dataset.precio;
        updateSubtotal();
    });
    cantInput.addEventListener('input', updateSubtotal);
    precInput.addEventListener('input', updateSubtotal);
}

function getDetalleData() {
    const rows = document.querySelectorAll('#detalle-body tr');
    return Array.from(rows).map(row => ({
        id_producto: parseInt(row.querySelector('.detalle-producto').value),
        cantidad: parseFloat(row.querySelector('.detalle-cantidad').value) || 0,
        precio_unitario: parseFloat(row.querySelector('.detalle-precio').value) || 0,
        motivo_detalle: row.querySelector('.detalle-motivo').value.trim() || null,
    })).filter(d => d.id_producto);
}

function calcTotal(detalles) {
    if (!detalles || !detalles.length) return 0;
    return detalles.reduce((sum, d) => sum + (parseFloat(d.cantidad) * parseFloat(d.precio_unitario || d.precio_unitario) || 0), 0);
}

async function loadTable() {
    try {
        const d = await apiFetch('/devoluciones');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) devTable.destroy();
        devTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'desc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'id_devolucion' },
                { data: null, render: r => `#${r.id_pedido}` },
                { data: null, render: r => r.tipo_devolucion?.nombre_tipo || '—' },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || '—') },
                { data: null, render: r => `Bs ${calcTotal(r.detalles || []).toFixed(2)}` },
                { data: null, render: r => formatDate(r.fecha_devolucion) },
                { data: null, render: r => `<div class="actions">
                    <button class="btn btn-sm btn-info" onclick="view(${r.id_devolucion})"><i class="fas fa-eye"></i></button>
                    ${hasPermission('Devoluciones', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_devolucion},'#${r.id_devolucion}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Devoluciones', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_devolucion})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Devoluciones', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_devolucion})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar devoluciones: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nueva Devolución';
    document.getElementById('main-form').reset();
    document.getElementById('detalle-body').innerHTML = '';
    addDetalleRow();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

function closeViewModal() { document.getElementById('view-modal').classList.remove('active'); }

async function view(id) {
    try {
        const d = await apiFetch(`/devoluciones/${id}`);
        const dev = d.devolucion || d.data || d;
        const detalles = dev.detalles || [];
        const total = calcTotal(detalles);
        document.getElementById('view-body').innerHTML = `
            <div class="info-grid">
                <div><strong># Devolución:</strong> ${dev.id_devolucion}</div>
                <div><strong>Pedido:</strong> #${dev.id_pedido}</div>
                <div><strong>Tipo:</strong> ${dev.tipo_devolucion?.nombre_tipo || '—'}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(dev.estado?.nombre_estado || '—')}</div>
                <div><strong>Fecha:</strong> ${formatDate(dev.fecha_devolucion)}</div>
                <div><strong>Total:</strong> Bs ${total.toFixed(2)}</div>
                <div style="grid-column: span 2"><strong>Motivo:</strong> ${dev.motivo || '—'}</div>
            </div>
            <hr>
            <h4>Productos</h4>
            <table class="table" style="width:100%">
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Motivo</th></tr></thead>
                <tbody>${detalles.map(d => `
                    <tr>
                        <td>${d.producto?.nombre_producto || '—'}</td>
                        <td>${d.cantidad}</td>
                        <td>Bs ${parseFloat(d.precio_unitario).toFixed(2)}</td>
                        <td>Bs ${parseFloat(d.subtotal).toFixed(2)}</td>
                        <td>${d.motivo_detalle || '—'}</td>
                    </tr>
                `).join('')}</tbody>
                <tfoot><tr><th colspan="3" style="text-align:right">Total</th><th>Bs ${total.toFixed(2)}</th><th></th></tr></tfoot>
            </table>
        `;
        document.getElementById('view-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la devolución', 'error'); }
}

async function edit(id) {
    try {
        const d = await apiFetch(`/devoluciones/${id}`);
        const dev = d.devolucion || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Devolución';
        document.getElementById('f-pedido').value = dev.id_pedido || '';
        document.getElementById('f-tipo').value = dev.id_tipo_devolucion || '';
        document.getElementById('f-motivo').value = dev.motivo || '';
        const tbody = document.getElementById('detalle-body');
        tbody.innerHTML = '';
        if (dev.detalles && dev.detalles.length) {
            dev.detalles.forEach(det => addDetalleRow(det.id_producto, det.cantidad, det.precio_unitario, det.motivo_detalle));
        } else {
            addDetalleRow();
        }
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la devolución', 'error'); }
}

async function save() {
    const id_pedido = parseInt(document.getElementById('f-pedido').value);
    const id_tipo_devolucion = parseInt(document.getElementById('f-tipo').value);
    const motivo = document.getElementById('f-motivo').value.trim();
    const detalles = getDetalleData();
    if (!id_pedido) return Swal.fire('Validación', 'Seleccione un pedido', 'warning');
    if (!id_tipo_devolucion) return Swal.fire('Validación', 'Seleccione un tipo de devolución', 'warning');
    if (!detalles.length) return Swal.fire('Validación', 'Agregue al menos un producto', 'warning');

    const body = {
        id_pedido,
        id_tipo_devolucion,
        id_estado_devolucion: 1,
        motivo: motivo || null,
        detalles,
    };

    try {
        if (editingId) {
            await apiFetch(`/devoluciones/${editingId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Devolución actualizada', 'success');
        } else {
            await apiFetch('/devoluciones', { method: 'POST', body });
            Swal.fire('Creada', 'Devolución creada', 'success');
        }
        closeModal(); if (devTable) await reloadDataTable(devTable, '/devoluciones');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({
        title: '¿Eliminar devolución?',
        text: `Se eliminará la devolución #${id}. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/devoluciones/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminada', 'Devolución eliminada exitosamente.', 'success');
        if (devTable) await reloadDataTable(devTable, '/devoluciones');
    } catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

let estadoDevId = null;

function openEstadoModal(id, ref) {
    estadoDevId = id;
    document.getElementById('estado-ref').textContent = ref;
    document.getElementById('s-estado').value = '';
    document.getElementById('estado-modal').classList.add('active');
}

function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoDevId = null; }

async function changeEstado() {
    const id_estado_devolucion = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_devolucion) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try {
        await apiFetch(`/devoluciones/${estadoDevId}/cambiar-estado`, { method: 'POST', body: { id_estado_devolucion } });
        Swal.fire('Actualizado', 'Estado cambiado correctamente', 'success');
        closeEstadoModal(); if (devTable) await reloadDataTable(devTable, '/devoluciones');
    } catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}
