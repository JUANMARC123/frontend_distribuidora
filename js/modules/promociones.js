let promTable, editingId = null, tiposPromocion = [], productosList = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Promociones', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadTipos(), loadProductos()]);
    renderPage();
});

async function loadTipos() {
    try { const d = await apiFetch('/catalogos/tipos-promocion'); tiposPromocion = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { tiposPromocion = []; }
}

async function loadProductos() {
    try { const d = await apiFetch('/productos'); productosList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { productosList = []; }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-tags"></i> Promociones</h3>
                ${hasPermission('Promociones', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nueva Promoción</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>ID</th><th>Nombre</th><th>Tipo</th><th>Descuento</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nueva Promoción</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Nombre *</label><input type="text" id="f-nombre" class="form-control" required maxlength="200"></div>
                    <div class="form-group"><label>Descripción</label><textarea id="f-descripcion" class="form-control" rows="2"></textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Tipo *</label><select id="f-tipo" class="form-control" required><option value="">Seleccione...</option>${tiposPromocion.map(t => `<option value="${t.id_tipo_promocion}">${t.nombre_tipo}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Descuento *</label><input type="number" id="f-descuento" class="form-control" step="0.01" min="0" required></div>
                        <div class="form-group"><label>%</label><select id="f-es-porcentual" class="form-control"><option value="1">Porcentaje</option><option value="0">Monto fijo</option></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Fecha Inicio *</label><input type="date" id="f-inicio" class="form-control" required></div>
                        <div class="form-group"><label>Fecha Fin</label><input type="date" id="f-fin" class="form-control"></div>
                        <div class="form-group"><label>Activo</label><select id="f-activo" class="form-control"><option value="1">Sí</option><option value="0">No</option></select></div>
                    </div>
                    <hr>
                    <h4>Productos Incluidos</h4>
                    <table class="table" id="productos-table" style="width:100%">
                        <thead><tr><th>Producto</th><th>Cant. Mínima</th><th></th></tr></thead>
                        <tbody id="productos-body"></tbody>
                    </table>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="addProductoRow()"><i class="fas fa-plus"></i> Agregar Producto</button>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="view-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3>Detalle de la Promoción</h3><button class="modal-close" onclick="closeViewModal()">&times;</button></div>
            <div class="modal-body" id="view-body"></div>
        </div></div>
    `;
    loadTable();
}

function addProductoRow(producto, cantidad) {
    const tbody = document.getElementById('productos-body');
    const row = document.createElement('tr');
    const prodOpts = productosList.map(p => `<option value="${p.id_producto}" ${producto && p.id_producto == producto ? 'selected' : ''}>${p.nombre_producto}</option>`).join('');
    row.innerHTML = `
        <td><select class="form-control prod-select" required>${prodOpts}</select></td>
        <td><input type="number" class="form-control prod-cantidad" step="0.01" min="0.01" value="${cantidad || 1}" required></td>
        <td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(row);
}

function getProductosData() {
    const rows = document.querySelectorAll('#productos-body tr');
    return Array.from(rows).map(row => ({
        id_producto: parseInt(row.querySelector('.prod-select').value),
        cantidad_minima: parseFloat(row.querySelector('.prod-cantidad').value) || 1,
    })).filter(p => p.id_producto);
}

async function loadTable() {
    try {
        const d = await apiFetch('/promociones');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) promTable.destroy();
        promTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'desc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'id_promocion' },
                { data: 'nombre_promocion' },
                { data: null, render: r => r.tipo_promocion?.nombre_tipo || '—' },
                { data: null, render: r => r.es_porcentual ? `${r.descuento}%` : `Bs ${r.descuento}` },
                { data: null, render: r => formatDate(r.fecha_inicio) },
                { data: null, render: r => r.fecha_fin ? formatDate(r.fecha_fin) : '—' },
                { data: null, render: r => r.activo ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-secondary">Inactiva</span>' },
                { data: null, render: r => `<div class="actions">
                    <button class="btn btn-sm btn-info" onclick="view(${r.id_promocion})"><i class="fas fa-eye"></i></button>
                    ${hasPermission('Promociones', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_promocion})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Promociones', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_promocion})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar promociones: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nueva Promoción';
    document.getElementById('main-form').reset();
    document.getElementById('productos-body').innerHTML = '';
    addProductoRow();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

function closeViewModal() { document.getElementById('view-modal').classList.remove('active'); }

async function view(id) {
    try {
        const d = await apiFetch(`/promociones/${id}`);
        const p = d.promocion || d.data || d;
        document.getElementById('view-body').innerHTML = `
            <div class="info-grid">
                <div><strong>Nombre:</strong> ${p.nombre_promocion}</div>
                <div><strong>Tipo:</strong> ${p.tipo_promocion?.nombre_tipo || '—'}</div>
                <div><strong>Descuento:</strong> ${p.es_porcentual ? `${p.descuento}%` : `Bs ${p.descuento}`}</div>
                <div><strong>Vigencia:</strong> ${formatDate(p.fecha_inicio)} → ${p.fecha_fin ? formatDate(p.fecha_fin) : 'Indefinido'}</div>
                <div><strong>Estado:</strong> ${p.activo ? 'Activa' : 'Inactiva'}</div>
                <div style="grid-column: span 2"><strong>Descripción:</strong> ${p.descripcion || '—'}</div>
            </div>
            <hr>
            <h4>Productos</h4>
            <table class="table" style="width:100%">
                <thead><tr><th>Producto</th><th>Cant. Mínima</th></tr></thead>
                <tbody>${(p.productos || []).map(pr => `
                    <tr><td>${pr.producto?.nombre_producto || '—'}</td><td>${pr.cantidad_minima}</td></tr>
                `).join('')}</tbody>
            </table>
        `;
        document.getElementById('view-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la promoción', 'error'); }
}

async function edit(id) {
    try {
        const d = await apiFetch(`/promociones/${id}`);
        const p = d.promocion || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Promoción';
        document.getElementById('f-nombre').value = p.nombre_promocion || '';
        document.getElementById('f-descripcion').value = p.descripcion || '';
        document.getElementById('f-tipo').value = p.id_tipo_promocion || '';
        document.getElementById('f-descuento').value = p.descuento || '';
        document.getElementById('f-es-porcentual').value = p.es_porcentual ? '1' : '0';
        document.getElementById('f-inicio').value = p.fecha_inicio || '';
        document.getElementById('f-fin').value = p.fecha_fin || '';
        document.getElementById('f-activo').value = p.activo ? '1' : '0';
        const tbody = document.getElementById('productos-body');
        tbody.innerHTML = '';
        if (p.productos && p.productos.length) {
            p.productos.forEach(pr => addProductoRow(pr.id_producto, pr.cantidad_minima));
        } else {
            addProductoRow();
        }
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar la promoción', 'error'); }
}

async function save() {
    const nombre_promocion = document.getElementById('f-nombre').value.trim();
    const descripcion = document.getElementById('f-descripcion').value.trim();
    const id_tipo_promocion = parseInt(document.getElementById('f-tipo').value);
    const descuento = parseFloat(document.getElementById('f-descuento').value);
    const es_porcentual = document.getElementById('f-es-porcentual').value === '1';
    const fecha_inicio = document.getElementById('f-inicio').value;
    const fecha_fin = document.getElementById('f-fin').value || null;
    const activo = document.getElementById('f-activo').value === '1';
    const productos = getProductosData();

    if (!nombre_promocion) return Swal.fire('Validación', 'Ingrese el nombre', 'warning');
    if (!id_tipo_promocion) return Swal.fire('Validación', 'Seleccione un tipo', 'warning');
    if (!fecha_inicio) return Swal.fire('Validación', 'Seleccione fecha de inicio', 'warning');
    if (!productos.length) return Swal.fire('Validación', 'Agregue al menos un producto', 'warning');

    const body = { nombre_promocion, descripcion: descripcion || null, id_tipo_promocion, descuento, es_porcentual, fecha_inicio, fecha_fin, activo, productos };

    try {
        if (editingId) {
            await apiFetch(`/promociones/${editingId}`, { method: 'PUT', body });
            Swal.fire('Actualizada', 'Promoción actualizada', 'success');
        } else {
            await apiFetch('/promociones', { method: 'POST', body });
            Swal.fire('Creada', 'Promoción creada', 'success');
        }
        closeModal(); if (promTable) await reloadDataTable(promTable, '/promociones');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({
        title: '¿Eliminar promoción?',
        text: `Se eliminará la promoción #${id}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/promociones/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminada', 'Promoción eliminada.', 'success');
        if (promTable) await reloadDataTable(promTable, '/promociones');
    } catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}
