let pedidosTable, editingId = null, farmaciasList = [], estadosPedido = [];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Pedidos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadFarmacias(), loadEstados()]);
    renderPage();
});

async function loadFarmacias() {
    try { const d = await apiFetch('/farmacias'); farmaciasList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { farmaciasList = []; }
}

async function loadEstados() {
    try { const d = await apiFetch('/catalogos/estados-pedido'); estadosPedido = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { estadosPedido = [{ id_estado_pedido: 1, nombre_estado: 'Pendiente' }, { id_estado_pedido: 2, nombre_estado: 'Aprobado' }, { id_estado_pedido: 3, nombre_estado: 'Despachado' }, { id_estado_pedido: 4, nombre_estado: 'Cancelado' }]; }
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
                    <th>ID</th><th>Farmacia</th><th>Usuario</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Pedido</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Farmacia *</label><select id="f-farmacia" class="form-control" required><option value="">Seleccione...</option>${farmaciasList.map(f => `<option value="${f.id_farmacia}">${f.nombre}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Observaciones</label><textarea id="f-observaciones" class="form-control" rows="3"></textarea></div>
                    <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${e.nombre_estado}</option>`).join('')}</select></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Seleccione el nuevo estado para el pedido <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Nuevo Estado</label><select id="s-estado" class="form-control">${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>
    `;
    loadTable();
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
                { data: null, render: r => r.farmacia?.nombre || r.nombre_farmacia || '—' },
                { data: null, render: r => { const u = r.usuario; return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : (r.nombre_usuario || '—'); } },
                { data: null, render: r => getStatusBadge(r.estado?.nombre_estado || r.nombre_estado || '—') },
                { data: null, render: r => formatDate(r.fecha_pedido) },
                { data: null, render: r => `<div class="actions">
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
    document.getElementById('modal-title').textContent = 'Nuevo Pedido';
    document.getElementById('main-form').reset();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/pedidos/${id}`);
        const p = d.pedido || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Pedido';
        document.getElementById('f-farmacia').value = p.id_farmacia || '';
        document.getElementById('f-observaciones').value = p.observaciones || '';
        document.getElementById('f-estado').value = p.id_estado_pedido || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el pedido', 'error'); }
}

async function save() {
    const id_farmacia = parseInt(document.getElementById('f-farmacia').value);
    const observaciones = document.getElementById('f-observaciones').value.trim();
    const id_estado_pedido = parseInt(document.getElementById('f-estado').value);
    if (!id_farmacia) return Swal.fire('Validación', 'Seleccione una farmacia', 'warning');

    const currentUser = getUser();
    const body = {
        id_farmacia,
        observaciones,
        id_estado_pedido,
        id_usuario: currentUser?.id_usuario || currentUser?.id || null,
    };
    try {
        if (editingId) {
            await apiFetch(`/pedidos/${editingId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Pedido actualizado', 'success');
        } else {
            await apiFetch('/pedidos', { method: 'POST', body });
            Swal.fire('Creado', 'Pedido creado', 'success');
        }
        closeModal(); if (pedidosTable) await reloadDataTable(pedidosTable, '/pedidos');
    } catch (e) { Swal.fire('Error', e.message || 'Error al guardar', 'error'); }
}

async function del(id) {
    const r = await Swal.fire({
        title: '¿Eliminar pedido?',
        text: `Se eliminará el pedido #${id}. Esta acción no se puede deshacer.`,
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
            Swal.fire({
                title: 'No se puede eliminar este pedido',
                html: `
                    <p>Este pedido ya tiene un despacho registrado.</p>
                    <p>Para conservar el historial del sistema, no puede eliminarse.</p>
                `,
                icon: 'info',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        Swal.fire('Error', e.message || 'Error al eliminar', 'error');
    }
}
// Cambiar estado
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
