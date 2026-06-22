let inventarioTable;
let tiposMovimientoList = [];
let movimientosTable = null;
let currentInventarioId = null;
let currentProductoName = '';

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Inventario', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await loadTiposMovimiento();
    renderPage();
});

async function loadTiposMovimiento() {
    try {
        const data = await apiFetch('/catalogos/tipos-movimiento');
        tiposMovimientoList = Array.isArray(data) ? data : (data.data || []);
    } catch (e) { tiposMovimientoList = []; }
}

async function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-warehouse"></i> Stock Actual</h3>
                <div>
                    <button class="btn btn-info" onclick="loadAlertas()" style="margin-right:8px;"><i class="fas fa-exclamation-triangle"></i> Alertas</button>
                    ${hasPermission('Inventario', 'registrar-movimiento') ? '<button class="btn btn-primary" onclick="openMovimientoModal()"><i class="fas fa-exchange-alt"></i> Registrar Movimiento</button>' : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="table-container">
                    <table id="inventario-table" class="display" style="width:100%">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Lote</th>
                                <th>Stock Actual</th>
                                <th>Stock Mínimo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="modal-movimiento" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Registrar Movimiento</h3>
                    <button class="modal-close" onclick="closeMovimientoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-movimiento">
                        <div class="form-group">
                            <label>Producto *</label>
                            <select id="m-producto" class="form-control" required>
                                <option value="">Seleccione producto...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Lote</label>
                            <select id="m-lote" class="form-control">
                                <option value="">Sin lote</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tipo de Movimiento *</label>
                            <select id="m-tipo" class="form-control" required>
                                <option value="">Seleccione...</option>
                                ${tiposMovimientoList.map(t => `<option value="${t.id_tipo_movimiento}">${t.nombre_tipo}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cantidad *</label>
                            <input type="number" step="0.01" min="0" id="m-cantidad" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Referencia</label>
                            <input type="text" id="m-referencia" class="form-control" maxlength="100" placeholder="N° de orden, factura, etc.">
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="m-observaciones" class="form-control" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeMovimientoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveMovimiento()">Registrar</button>
                </div>
            </div>
        </div>

        <div id="modal-movimientos" class="modal-overlay">
            <div class="modal" style="max-width:800px;">
                <div class="modal-header">
                    <h3 id="movimientos-modal-title">Movimientos</h3>
                    <button class="modal-close" onclick="closeMovimientosModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:16px;">
                        <span id="inventario-name-ref" style="font-weight:500;"></span>
                    </div>
                    <div class="table-container">
                        <table id="movimientos-table" class="display" style="width:100%">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                    <th>Stock Anterior</th>
                                    <th>Stock Posterior</th>
                                    <th>Referencia</th>
                                    <th>Usuario</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeMovimientosModal()">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    await loadProductosSelect();
    loadInventario();
}

async function loadProductosSelect() {
    try {
        const data = await apiFetch('/productos?per_page=1000');
        const productos = Array.isArray(data) ? data : (data.data || []);
        const select = document.getElementById('m-producto');
        select.innerHTML = '<option value="">Seleccione producto...</option>' +
            productos.map(p => `<option value="${p.id_producto}">${p.codigo_producto} - ${p.nombre_producto}</option>`).join('');

        select.addEventListener('change', async function () {
            await loadLotesSelect(this.value);
        });
    } catch (e) {
        console.error('Error loading productos:', e);
    }
}

async function loadLotesSelect(productoId) {
    const select = document.getElementById('m-lote');
    select.innerHTML = '<option value="">Sin lote</option>';
    if (!productoId) return;
    try {
        const data = await apiFetch(`/productos/${productoId}/lotes`);
        const lotes = Array.isArray(data) ? data : (data.data || []);
        select.innerHTML = '<option value="">Sin lote</option>' +
            lotes.map(l => `<option value="${l.id_lote}">${l.codigo_lote}</option>`).join('');
    } catch (e) {
        console.error('Error loading lotes:', e);
    }
}

function loadInventario() {
    const query = '/inventario';
    loadInventarioTable(query);
}

function loadAlertas() {
    loadInventarioTable('/inventario?alertas=1');
}

async function loadInventarioTable(url) {
    try {
        const data = await apiFetch(url);
        const items = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#inventario-table')) {
            inventarioTable.destroy();
        }

        inventarioTable = $('#inventario-table').DataTable({
            data: items,
            columns: [
                { data: 'producto.codigo_producto', defaultContent: '—' },
                { data: 'producto.nombre_producto', defaultContent: '—' },
                { data: 'lote.codigo_lote', defaultContent: '—' },
                {
                    data: 'stock_actual',
                    render: data => data != null ? parseFloat(data).toFixed(2) : '0.00'
                },
                {
                    data: 'stock_minimo',
                    render: data => data != null ? parseFloat(data).toFixed(2) : '0.00'
                },
                {
                    data: null,
                    render: function (row) {
                        const actual = parseFloat(row.stock_actual || 0);
                        const minimo = parseFloat(row.stock_minimo || 0);
                        if (actual <= 0) return '<span class="badge badge-danger">Sin stock</span>';
                        if (actual <= minimo) return '<span class="badge badge-warning">Stock bajo</span>';
                        return '<span class="badge badge-success">OK</span>';
                    }
                },
                {
                    data: null,
                    render: function (row) {
                        const iid = row.id_inventario;
                        const pname = (row.producto?.nombre_producto || '').replace(/'/g, "\\'");
                        return `
                            <div class="actions">
                                <button class="btn btn-sm btn-info" onclick="openMovimientosModal(${iid},'${pname}')"><i class="fas fa-history"></i></button>
                            </div>
                        `;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[3, 'asc']],
            pageLength: 10,
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar los datos: ' + e.message, 'error');
    }
}

function openMovimientoModal() {
    document.getElementById('form-movimiento').reset();
    document.getElementById('modal-movimiento').classList.add('active');
}

function closeMovimientoModal() {
    document.getElementById('modal-movimiento').classList.remove('active');
}

async function saveMovimiento() {
    const id_producto = document.getElementById('m-producto').value;
    const id_lote = document.getElementById('m-lote').value;
    const id_tipo_movimiento = document.getElementById('m-tipo').value;
    const cantidad = document.getElementById('m-cantidad').value;
    const referencia = document.getElementById('m-referencia').value.trim();
    const observaciones = document.getElementById('m-observaciones').value.trim();

    if (!id_producto || !id_tipo_movimiento || !cantidad) {
        Swal.fire('Validación', 'Producto, tipo de movimiento y cantidad son obligatorios', 'warning');
        return;
    }

    const body = {
        id_producto: parseInt(id_producto),
        id_lote: id_lote ? parseInt(id_lote) : null,
        id_tipo_movimiento: parseInt(id_tipo_movimiento),
        cantidad: parseFloat(cantidad),
        referencia: referencia || null,
        observaciones: observaciones || null,
    };

    try {
        await apiFetch('/inventario/movimientos', { method: 'POST', body });
        Swal.fire('Registrado', 'Movimiento registrado correctamente', 'success');
        closeMovimientoModal();
        await reloadDataTable(inventarioTable, '/inventario');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al registrar movimiento', 'error');
    }
}

async function openMovimientosModal(inventarioId, productoName) {
    currentInventarioId = inventarioId;
    currentProductoName = productoName;
    document.getElementById('inventario-name-ref').textContent = `Movimientos de: ${productoName}`;
    document.getElementById('modal-movimientos').classList.add('active');
    await loadMovimientos();
}

function closeMovimientosModal() {
    document.getElementById('modal-movimientos').classList.remove('active');
    currentInventarioId = null;
}

async function loadMovimientos() {
    try {
        const data = await apiFetch(`/inventario/${currentInventarioId}/movimientos`);
        const movimientos = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#movimientos-table')) {
            movimientosTable.destroy();
        }

        movimientosTable = $('#movimientos-table').DataTable({
            data: movimientos,
            columns: [
                {
                    data: 'created_at',
                    render: data => data ? new Date(data).toLocaleString('es-BO') : '—'
                },
                { data: 'tipo_movimiento.nombre_tipo', defaultContent: '—' },
                {
                    data: 'cantidad',
                    render: data => data != null ? parseFloat(data).toFixed(2) : '—'
                },
                {
                    data: 'stock_anterior',
                    render: data => data != null ? parseFloat(data).toFixed(2) : '—'
                },
                {
                    data: 'stock_posterior',
                    render: data => data != null ? parseFloat(data).toFixed(2) : '—'
                },
                { data: 'referencia', defaultContent: '—' },
                {
                    data: null,
                    render: row => {
                        const u = row.usuario;
                        return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() || '—' : '—';
                    }
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[0, 'desc']],
            pageLength: 10,
        });
    } catch (e) {
        console.error('Error loading movimientos:', e);
    }
}
