let productosTable, editingId = null;

const UNIDADES = ['UNIDAD', 'CAJA', 'BLISTER', 'TUBO', 'FRASCO', 'AMPOLLA', 'KG', 'LITRO', 'ML', 'MG', 'G', 'ROLLO', 'PAR', 'PAQUETE'];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Productos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    renderPage();
});

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-cube"></i> Catálogo de Productos</h3>
                ${hasPermission('Productos', 'crear') ? '<button class="btn btn-primary" onclick="openModal()"><i class="fas fa-plus"></i> Nuevo Producto</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container">
                    <table id="main-table" class="display" style="width:100%">
                        <thead><tr>
                            <th>Nombre</th>
                            <th>Precio Unitario</th>
                            <th>Unidad Medida</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr></thead>
                    </table>
                </div>
            </div>
        </div>

        <div id="main-modal" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3 id="modal-title">Nuevo Producto</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="main-form">
                        <div class="form-group">
                            <label>Nombre del Producto *</label>
                            <input type="text" id="f-nombre" class="form-control" required maxlength="200">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Precio Unitario (Bs) *</label>
                                <input type="number" id="f-precio" class="form-control" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label>Unidad de Medida</label>
                                <select id="f-unidad" class="form-control">
                                    ${UNIDADES.map(u => `<option value="${u}" ${u === 'UNIDAD' ? 'selected' : ''}>${u}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label><input type="checkbox" id="f-estado" checked> Producto activo</label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="save()">Guardar</button>
                </div>
            </div>
        </div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/productos?per_page=-1');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) productosTable.destroy();
        productosTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: 'nombre' },
                { data: null, render: r => `Bs ${parseFloat(r.precio_unitario).toFixed(2)}` },
                { data: 'unidad_medida' },
                { data: null, render: r => r.estado ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>' },
                { data: null, render: r => `
                    <div class="actions">
                        ${hasPermission('Productos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_producto})"><i class="fas fa-edit"></i></button>` : ''}
                        ${hasPermission('Productos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_producto},'${r.nombre.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
                    </div>`, orderable: false
                }
            ]
        });
    } catch (e) { Swal.fire('Error', 'Error al cargar productos: ' + e.message, 'error'); }
}

function openModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Nuevo Producto';
    document.getElementById('main-form').reset();
    document.getElementById('f-estado').checked = true;
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/productos/${id}`);
        const p = d.producto || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Producto';
        document.getElementById('f-nombre').value = p.nombre || '';
        document.getElementById('f-precio').value = p.precio_unitario || '';
        document.getElementById('f-unidad').value = p.unidad_medida || 'UNIDAD';
        document.getElementById('f-estado').checked = p.estado !== false;
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el producto', 'error'); }
}

async function save() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const precio_unitario = parseFloat(document.getElementById('f-precio').value);
    const unidad_medida = document.getElementById('f-unidad').value;
    const estado = document.getElementById('f-estado').checked;

    if (!nombre) return Swal.fire('Validación', 'El nombre del producto es obligatorio', 'warning');
    if (!precio_unitario || precio_unitario <= 0) return Swal.fire('Validación', 'Ingrese un precio válido', 'warning');

    const body = { nombre, precio_unitario, unidad_medida, estado };

    try {
        if (editingId) {
            await apiFetch(`/productos/${editingId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Producto actualizado', 'success');
        } else {
            await apiFetch('/productos', { method: 'POST', body });
            Swal.fire('Creado', 'Producto creado', 'success');
        }
        closeModal(); if (productosTable) await reloadDataTable(productosTable, '/productos?per_page=-1');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id, nombre) {
    const r = await Swal.fire({
        title: '¿Eliminar producto?',
        text: `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/productos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Producto eliminado exitosamente.', 'success');
        if (productosTable) await reloadDataTable(productosTable, '/productos?per_page=-1');
    } catch (e) {
        if (e.status === 409) {
            Swal.fire('No se puede eliminar', 'Este producto tiene registros asociados en pedidos.', 'info');
        } else {
            Swal.fire('Error', e.message || 'Error al eliminar', 'error');
        }
    }
}
