let productosTable;
let categoriasList = [];
let laboratoriosList = [];
let presentacionesList = [];
let unidadesMedidaList = [];
let editingProductoId = null;
let currentProductoId = null;
let lotesTable = null;

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Productos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await loadCatalogos();
    renderPage();
});

async function loadCatalogos() {
    try {
        const cat = await apiFetch('/catalogos/categorias');
        categoriasList = Array.isArray(cat) ? cat : (cat.data || []);
    } catch (e) { categoriasList = []; }
    try {
        const lab = await apiFetch('/catalogos/laboratorios');
        laboratoriosList = Array.isArray(lab) ? lab : (lab.data || []);
    } catch (e) { laboratoriosList = []; }
    try {
        const pres = await apiFetch('/catalogos/presentaciones');
        presentacionesList = Array.isArray(pres) ? pres : (pres.data || []);
    } catch (e) { presentacionesList = []; }
    try {
        const uni = await apiFetch('/catalogos/unidades-medida');
        unidadesMedidaList = Array.isArray(uni) ? uni : (uni.data || []);
    } catch (e) { unidadesMedidaList = []; }
}

function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-capsules"></i> Listado de Productos</h3>
                ${hasPermission('Productos', 'crear') ? '<button class="btn btn-primary" onclick="openProductoModal()"><i class="fas fa-plus"></i> Nuevo Producto</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container">
                    <table id="productos-table" class="display" style="width:100%">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th>Categoría</th>
                                <th>Laboratorio</th>
                                <th>Presentación</th>
                                <th>Precio</th>
                                <th>Activo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="modal-producto" class="modal-overlay">
            <div class="modal" style="max-width:600px;">
                <div class="modal-header">
                    <h3 id="producto-modal-title">Nuevo Producto</h3>
                    <button class="modal-close" onclick="closeProductoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-producto">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Código *</label>
                                <input type="text" id="p-codigo" class="form-control" required maxlength="50">
                            </div>
                            <div class="form-group">
                                <label>Nombre *</label>
                                <input type="text" id="p-nombre" class="form-control" required maxlength="200">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Descripción</label>
                            <textarea id="p-descripcion" class="form-control" rows="2"></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Categoría *</label>
                                <select id="p-categoria" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${categoriasList.map(c => `<option value="${c.id_categoria}">${c.nombre_categoria}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Laboratorio *</label>
                                <select id="p-laboratorio" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${laboratoriosList.map(l => `<option value="${l.id_laboratorio}">${l.nombre_laboratorio}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Presentación *</label>
                                <select id="p-presentacion" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${presentacionesList.map(p => `<option value="${p.id_presentacion}">${p.nombre_presentacion}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Unidad Medida *</label>
                                <select id="p-unidad" class="form-control" required>
                                    <option value="">Seleccione...</option>
                                    ${unidadesMedidaList.map(u => `<option value="${u.id_unidad_medida}">${u.nombre_unidad}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Concentración</label>
                                <input type="text" id="p-concentracion" class="form-control" maxlength="100">
                            </div>
                            <div class="form-group">
                                <label>Precio Unitario *</label>
                                <input type="number" step="0.01" min="0" id="p-precio" class="form-control" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="p-receta"> Requiere receta médica
                                </label>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="p-activo" checked> Activo
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeProductoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveProducto()">Guardar</button>
                </div>
            </div>
        </div>

        <div id="modal-lotes" class="modal-overlay">
            <div class="modal" style="max-width:700px;">
                <div class="modal-header">
                    <h3 id="lotes-modal-title">Lotes del Producto</h3>
                    <button class="modal-close" onclick="closeLotesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                        <span id="producto-name-ref" style="font-weight:500;"></span>
                        ${hasPermission('Productos', 'gestionar-lotes') ? '<button class="btn btn-sm btn-primary" onclick="openLoteModal()"><i class="fas fa-plus"></i> Agregar Lote</button>' : ''}
                    </div>
                    <div class="table-container">
                        <table id="lotes-table" class="display" style="width:100%">
                            <thead>
                                <tr>
                                    <th>Código Lote</th>
                                    <th>Fabricación</th>
                                    <th>Vencimiento</th>
                                    <th>Precio Compra</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeLotesModal()">Cerrar</button>
                </div>
            </div>
        </div>

        <div id="modal-lote" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3 id="lote-modal-title">Nuevo Lote</h3>
                    <button class="modal-close" onclick="closeLoteFormModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-lote">
                        <div class="form-group">
                            <label>Código de Lote *</label>
                            <input type="text" id="l-codigo" class="form-control" required maxlength="50">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Fecha Fabricación *</label>
                                <input type="date" id="l-fabricacion" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Fecha Vencimiento *</label>
                                <input type="date" id="l-vencimiento" class="form-control" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Precio de Compra</label>
                            <input type="number" step="0.01" min="0" id="l-precio" class="form-control">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeLoteFormModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveLote()">Guardar</button>
                </div>
            </div>
        </div>
    `;

    loadProductos();
}

async function loadProductos() {
    try {
        const data = await apiFetch('/productos');
        const productos = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#productos-table')) {
            productosTable.destroy();
        }

        productosTable = $('#productos-table').DataTable({
            data: productos,
            columns: [
                { data: 'codigo_producto' },
                { data: 'nombre_producto' },
                {
                    data: null,
                    render: row => row.categoria?.nombre_categoria || '—'
                },
                {
                    data: null,
                    render: row => row.laboratorio?.nombre_laboratorio || '—'
                },
                {
                    data: null,
                    render: row => row.presentacion?.nombre_presentacion || '—'
                },
                {
                    data: 'precio_unitario',
                    render: data => data != null ? `Bs ${parseFloat(data).toFixed(2)}` : '—'
                },
                {
                    data: 'activo',
                    render: data => data ? '<span class="badge badge-success">Sí</span>' : '<span class="badge badge-danger">No</span>'
                },
                {
                    data: null,
                    render: function (row) {
                        const pid = row.id_producto;
                        const pname = (row.nombre_producto || '').replace(/'/g, "\\'");
                        return `
                            <div class="actions">
                                <button class="btn btn-sm btn-info" onclick="openLotesModal(${pid},'${pname}')" title="Ver lotes"><i class="fas fa-boxes"></i></button>
                                ${hasPermission('Productos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="editProducto(${pid})"><i class="fas fa-edit"></i></button>` : ''}
                                ${hasPermission('Productos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="deleteProducto(${pid},'${pname}')"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        `;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[1, 'asc']],
            pageLength: 10,
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar los productos: ' + e.message, 'error');
    }
}

function openProductoModal(data) {
    editingProductoId = null;
    document.getElementById('producto-modal-title').textContent = 'Nuevo Producto';
    document.getElementById('form-producto').reset();
    document.getElementById('p-activo').checked = true;
    document.getElementById('modal-producto').classList.add('active');
}

function closeProductoModal() {
    document.getElementById('modal-producto').classList.remove('active');
    editingProductoId = null;
}

async function editProducto(id) {
    try {
        const data = await apiFetch(`/productos/${id}`);
        const prod = data.producto || data.data || data;
        editingProductoId = id;

        document.getElementById('producto-modal-title').textContent = 'Editar Producto';
        document.getElementById('p-codigo').value = prod.codigo_producto || '';
        document.getElementById('p-nombre').value = prod.nombre_producto || '';
        document.getElementById('p-descripcion').value = prod.descripcion || '';
        document.getElementById('p-categoria').value = prod.id_categoria || '';
        document.getElementById('p-laboratorio').value = prod.id_laboratorio || '';
        document.getElementById('p-presentacion').value = prod.id_presentacion || '';
        document.getElementById('p-unidad').value = prod.id_unidad_medida || '';
        document.getElementById('p-concentracion').value = prod.concentracion || '';
        document.getElementById('p-precio').value = prod.precio_unitario || '';
        document.getElementById('p-receta').checked = !!prod.requiere_receta;
        document.getElementById('p-activo').checked = prod.activo !== false;
        document.getElementById('modal-producto').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el producto', 'error');
    }
}

async function saveProducto() {
    const codigo = document.getElementById('p-codigo').value.trim();
    const nombre = document.getElementById('p-nombre').value.trim();
    const descripcion = document.getElementById('p-descripcion').value.trim();
    const id_categoria = document.getElementById('p-categoria').value;
    const id_laboratorio = document.getElementById('p-laboratorio').value;
    const id_presentacion = document.getElementById('p-presentacion').value;
    const id_unidad_medida = document.getElementById('p-unidad').value;
    const concentracion = document.getElementById('p-concentracion').value.trim();
    const precio_unitario = document.getElementById('p-precio').value;
    const requiere_receta = document.getElementById('p-receta').checked;
    const activo = document.getElementById('p-activo').checked;

    if (!codigo || !nombre || !id_categoria || !id_laboratorio || !id_presentacion || !id_unidad_medida || !precio_unitario) {
        Swal.fire('Validación', 'Todos los campos marcados con * son obligatorios', 'warning');
        return;
    }

    const body = {
        codigo_producto: codigo,
        nombre_producto: nombre,
        descripcion: descripcion || null,
        id_categoria: parseInt(id_categoria),
        id_laboratorio: parseInt(id_laboratorio),
        id_presentacion: parseInt(id_presentacion),
        id_unidad_medida: parseInt(id_unidad_medida),
        concentracion: concentracion || null,
        precio_unitario: parseFloat(precio_unitario),
        requiere_receta,
        activo,
    };

    try {
        if (editingProductoId) {
            await apiFetch(`/productos/${editingProductoId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Producto actualizado correctamente', 'success');
        } else {
            await apiFetch('/productos', { method: 'POST', body });
            Swal.fire('Creado', 'Producto creado correctamente', 'success');
        }
        closeProductoModal();
        await reloadDataTable(productosTable, '/productos');
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar', 'error');
    }
}

async function deleteProducto(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar producto?',
        text: `Se eliminará "${nombre}" y todos sus datos asociados.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    try {
        await apiFetch(`/productos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Producto eliminado correctamente', 'success');
        await reloadDataTable(productosTable, '/productos');
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('foreign') || msg.includes('SQLSTATE') || msg.includes('lotes')) {
            Swal.fire('No se puede eliminar', 'Este producto tiene lotes registrados. Elimine primero los lotes antes de eliminar el producto.', 'warning');
        } else {
            Swal.fire('Error', msg || 'Error al eliminar', 'error');
        }
    }
}

let editingLoteId = null;

async function openLotesModal(productoId, productoName) {
    currentProductoId = productoId;
    document.getElementById('producto-name-ref').textContent = `Lotes de: ${productoName}`;
    document.getElementById('modal-lotes').classList.add('active');
    await loadLotes();
}

function closeLotesModal() {
    document.getElementById('modal-lotes').classList.remove('active');
    currentProductoId = null;
}

async function loadLotes() {
    try {
        const data = await apiFetch(`/productos/${currentProductoId}/lotes`);
        const lotes = Array.isArray(data) ? data : (data.data || []);

        if ($.fn.DataTable.isDataTable('#lotes-table')) {
            lotesTable.destroy();
        }

        lotesTable = $('#lotes-table').DataTable({
            data: lotes,
            columns: [
                { data: 'codigo_lote' },
                {
                    data: 'fecha_fabricacion',
                    render: data => data ? data.split('T')[0] : '—'
                },
                {
                    data: 'fecha_vencimiento',
                    render: data => data ? data.split('T')[0] : '—'
                },
                {
                    data: 'precio_compra',
                    render: data => data != null ? `Bs ${parseFloat(data).toFixed(2)}` : '—'
                },
                {
                    data: null,
                    render: function (row) {
                        const lid = row.id_lote;
                        const lcod = (row.codigo_lote || '').replace(/'/g, "\\'");
                        return `
                            <div class="actions">
                                ${hasPermission('Productos', 'gestionar-lotes') ? `<button class="btn btn-sm btn-warning" onclick="editLote(${lid})"><i class="fas fa-edit"></i></button>` : ''}
                                ${hasPermission('Productos', 'gestionar-lotes') ? `<button class="btn btn-sm btn-danger" onclick="deleteLote(${lid},'${lcod}')"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        `;
                    },
                    orderable: false
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            order: [[1, 'desc']],
            pageLength: 5,
            pagingType: 'simple',
        });
    } catch (e) {
        console.error('Error loading lotes:', e);
    }
}

function openLoteModal() {
    editingLoteId = null;
    document.getElementById('lote-modal-title').textContent = 'Nuevo Lote';
    document.getElementById('form-lote').reset();
    document.getElementById('modal-lote').classList.add('active');
}

function closeLoteFormModal() {
    document.getElementById('modal-lote').classList.remove('active');
    editingLoteId = null;
}

async function editLote(loteId) {
    try {
        const data = await apiFetch(`/productos/${currentProductoId}/lotes`);
        const lotes = Array.isArray(data) ? data : (data.data || []);
        const lote = lotes.find(l => l.id_lote === loteId);
        if (!lote) throw new Error('Lote no encontrado');

        editingLoteId = loteId;

        document.getElementById('lote-modal-title').textContent = 'Editar Lote';
        document.getElementById('l-codigo').value = lote.codigo_lote || '';
        document.getElementById('l-fabricacion').value = lote.fecha_fabricacion ? lote.fecha_fabricacion.split('T')[0] : '';
        document.getElementById('l-vencimiento').value = lote.fecha_vencimiento ? lote.fecha_vencimiento.split('T')[0] : '';
        document.getElementById('l-precio').value = lote.precio_compra || '';
        document.getElementById('modal-lote').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el lote', 'error');
    }
}

async function saveLote() {
    const codigo = document.getElementById('l-codigo').value.trim();
    const fabricacion = document.getElementById('l-fabricacion').value;
    const vencimiento = document.getElementById('l-vencimiento').value;
    const precio = document.getElementById('l-precio').value;

    if (!codigo || !fabricacion || !vencimiento) {
        Swal.fire('Validación', 'Código, fecha de fabricación y vencimiento son obligatorios', 'warning');
        return;
    }
    if (new Date(vencimiento) <= new Date(fabricacion)) {
        Swal.fire('Validación', 'La fecha de vencimiento debe ser posterior a la de fabricación', 'warning');
        return;
    }

    const body = {
        codigo_lote: codigo,
        fecha_fabricacion: fabricacion,
        fecha_vencimiento: vencimiento,
        precio_compra: precio ? parseFloat(precio) : null,
    };

    try {
        if (editingLoteId) {
            await apiFetch(`/productos/${currentProductoId}/lotes/${editingLoteId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Lote actualizado correctamente', 'success');
        } else {
            await apiFetch(`/productos/${currentProductoId}/lotes`, { method: 'POST', body });
            Swal.fire('Creado', 'Lote registrado correctamente', 'success');
        }
        closeLoteFormModal();
        await loadLotes();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar el lote', 'error');
    }
}

async function deleteLote(id, codigo) {
    const result = await Swal.fire({
        title: '¿Eliminar lote?',
        text: `Se eliminará el lote "${codigo}".`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    try {
        await apiFetch(`/productos/${currentProductoId}/lotes/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Lote eliminado correctamente', 'success');
        await loadLotes();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al eliminar', 'error');
    }
}
