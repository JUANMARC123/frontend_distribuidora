let pedidosData = [];
let editingId = null;
let estadoPedidoId = null;
let farmaciasList = [];
let estadosPedido = [];
let productosList = [];
let detalleItems = [];
let entregaPedidoId = null;
let entregaItems = [];
let kanbanViewMode = 'kanban';

const KANBAN_COLUMNS = [
    { key: 'pendiente', title: 'Pendiente', icon: 'fa-clock' },
    { key: 'preparacion', title: 'En Preparacion', icon: 'fa-box-open' },
    { key: 'en_ruta', title: 'En Ruta', icon: 'fa-truck' },
    { key: 'entregado', title: 'Entregado', icon: 'fa-check-circle' },
    { key: 'cancelado', title: 'Cancelado', icon: 'fa-ban' },
];

async function initPedidosModule(containerSelector = '#page-content') {
    await Promise.all([loadFarmacias(), loadEstados(), loadProductos()]);
    renderPedidosContent(containerSelector);
    await refreshPedidos();
}

document.addEventListener('DOMContentLoaded', async function () {
    if (document.getElementById('logistica-content')) return;
    if (!checkAuth()) return;
    if (!hasPermission('Pedidos', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await initPedidosModule();
    handleInitialParams();
});

async function loadFarmacias() {
    try {
        const d = await apiFetch('/farmacias');
        farmaciasList = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        farmaciasList = [];
    }
}

async function loadEstados() {
    try {
        const d = await apiFetch('/catalogos/estados-pedido');
        estadosPedido = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        estadosPedido = [
            { id_estado_pedido: 1, nombre_estado: 'Pendiente' },
            { id_estado_pedido: 2, nombre_estado: 'En preparacion' },
            { id_estado_pedido: 3, nombre_estado: 'En ruta' },
            { id_estado_pedido: 4, nombre_estado: 'Entregado' },
            { id_estado_pedido: 5, nombre_estado: 'Cancelado' },
        ];
    }
}

async function loadProductos() {
    try {
        const d = await apiFetch('/productos?per_page=-1');
        productosList = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        productosList = [];
    }
}

function renderPedidosContent(containerSelector = '#page-content') {
    const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
    if (!container) return;
    container.innerHTML = `
        <section class="ops-hero">
            <div class="ops-hero-main">
                <div class="ops-kicker">Operaciones comerciales</div>
                <h1 class="ops-title">Pedidos por flujo</h1>
                <p class="ops-subtitle">Crea pedidos desde farmacia, revisa productos con precios distintos y controla faltantes antes de enviar a logistica.</p>
                <div class="ops-actions">
                    ${hasPermission('Pedidos', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo pedido</button>' : ''}
                    <a class="btn btn-outline" href="farmacias.html"><i class="fas fa-hospital"></i> Ver farmacias</a>
                </div>
            </div>
        </section>

        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="pedidos-search" placeholder="Buscar por farmacia, producto o pedido" oninput="renderPedidosView()">
            </div>
            <select class="form-control" id="filter-farmacia" onchange="renderPedidosView()" style="max-width:240px;">
                <option value="">Todas las farmacias</option>
                ${farmaciasList.map(f => `<option value="${f.id_farmacia}">${escapeHtml(f.nombre)}</option>`).join('')}
            </select>
            <select class="form-control" id="filter-estado" onchange="renderPedidosView()" style="max-width:210px;">
                <option value="">Todos los estados</option>
                ${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${escapeHtml(e.nombre_estado)}</option>`).join('')}
            </select>
            <div class="pedidos-view-toggle">
                <button class="toggle-btn active" data-mode="kanban" onclick="togglePedidosView('kanban')"><i class="fas fa-columns"></i> Kanban</button>
                <button class="toggle-btn" data-mode="tabla" onclick="togglePedidosView('tabla')"><i class="fas fa-list"></i> Tabla</button>
            </div>
        </section>

        <section class="kanban-board" id="pedidos-kanban"></section>
        <section class="ops-panel" style="margin-top:16px;${kanbanViewMode === 'tabla' ? '' : 'display:none;'}" id="pedidos-table-section">
            <div class="card-header">
                <h3><i class="fas fa-list"></i> Lista operativa</h3>
                <span class="text-muted" id="pedidos-count"></span>
            </div>
            <div class="card-body" id="pedidos-list"></div>
        </section>

        ${renderPedidoModal()}
        ${renderProductoModal()}
        ${renderViewModal()}
        ${renderEstadoModal()}
        ${renderEntregaModal()}
    `;

    const productoSelect = document.getElementById('p-producto');
    if (productoSelect) {
        productoSelect.addEventListener('change', function () {
            const opt = this.options[this.selectedIndex];
            document.getElementById('p-precio').value = opt?.dataset?.precio || '';
        });
    }
    const faInput = document.getElementById('f-farmacia-input');
    if (faInput) {
        faInput.addEventListener('blur', function () {
            const hidden = document.getElementById('f-farmacia');
            if (!hidden?.value && this.value.trim()) {
                this.value = '';
            }
        });
    }
}

function renderPedidoModal() {
    return `
        <div id="main-modal" class="modal-overlay">
            <div class="modal" style="max-width:980px;">
                <div class="modal-header">
                    <h3 id="modal-title">Nuevo pedido</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="main-form">
                        <div class="form-row">
                            <div class="form-group" style="flex:2">
                                <label>Farmacia *</label>
                                <input type="text" id="f-farmacia-input" class="form-control" list="farmacia-list" autocomplete="off" placeholder="Buscar farmacia..." required oninput="onFarmaciaInput(this)">
                                <datalist id="farmacia-list">
                                    ${farmaciasList.map(f => `<option value="${escapeHtml(f.nombre)}" data-id="${f.id_farmacia}"></option>`).join('')}
                                </datalist>
                                <input type="hidden" id="f-farmacia" value="">
                                <div id="historial-contextual" style="margin-top:4px;"></div>
                            </div>
                            <div id="estado-field-container" style="display:none;"></div>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="f-observaciones" class="form-control" rows="2"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Pedido en PDF</label>
                            <div class="pdf-upload-row">
                                <input type="file" id="f-archivo" class="form-control" accept=".pdf">
                                <button type="button" class="btn btn-outline" onclick="extractPdfProducts()"><i class="fas fa-wand-magic-sparkles"></i> Extraer productos</button>
                            </div>
                            <div id="extract-status" class="text-muted" style="font-size:12px;margin-top:6px;">Sube el PDF para detectar productos, cantidades y precios. Luego revisa las filas antes de guardar.</div>
                        </div>
                    </form>

                    <div class="section-divider"></div>
                    <div class="modal-subheader">
                        <div>
                            <h4><i class="fas fa-cubes"></i> Detalle de productos</h4>
                            <p>El total se calcula por producto. Si hay faltantes, se descuenta desde la entrega.</p>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="openProductoModal()"><i class="fas fa-plus"></i> Agregar producto</button>
                    </div>
                    <div class="table-container">
                        <table class="product-detail-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Solicitado</th>
                                    <th>Precio unit.</th>
                                    <th>Subtotal</th>
                                    <th>Revision</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="detalle-body"></tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="3" style="text-align:right;">Total pedido</th>
                                    <th id="detalle-subtotal">Bs 0.00</th>
                                    <th colspan="2"></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="save()">Guardar pedido</button>
                </div>
            </div>
        </div>
    `;
}

function renderProductoModal() {
    return `
        <div id="producto-modal" class="modal-overlay">
            <div class="modal" style="max-width:520px;">
                <div class="modal-header">
                    <h3>Agregar producto</h3>
                    <button class="modal-close" onclick="closeProductoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="producto-form">
                        <div class="form-group">
                            <label>Producto *</label>
                            <select id="p-producto" class="form-control" required>
                                <option value="">Seleccione...</option>
                                ${productosList.map(p => `<option value="${p.id_producto}" data-precio="${parseMoney(p.precio_unitario)}">${escapeHtml(p.nombre)} (Bs ${money(p.precio_unitario)})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Cantidad *</label>
                                <input type="number" id="p-cantidad" class="form-control" step="0.01" min="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>Precio unitario (Bs) *</label>
                                <input type="number" id="p-precio" class="form-control" step="0.01" min="0.01" required>
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
    `;
}

function renderViewModal() {
    return `
        <div id="view-modal" class="modal-overlay">
            <div class="modal" style="max-width:980px;">
                <div class="modal-header">
                    <h3>Detalle del pedido</h3>
                    <button class="modal-close" onclick="closeViewModal()">&times;</button>
                </div>
                <div class="modal-body" id="view-body"></div>
            </div>
        </div>
    `;
}

function renderEstadoModal() {
    return `
        <div id="estado-modal" class="modal-overlay">
            <div class="modal" style="max-width:420px;">
                <div class="modal-header">
                    <h3>Cambiar estado</h3>
                    <button class="modal-close" onclick="closeEstadoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted">Nuevo estado para pedido <strong id="estado-ref"></strong></p>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="s-estado" class="form-control">
                            ${estadosPedido.map(e => `<option value="${e.id_estado_pedido}">${escapeHtml(e.nombre_estado)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="changeEstado()">Cambiar</button>
                </div>
            </div>
        </div>
    `;
}

function renderEntregaModal() {
    return `
        <div id="entrega-modal" class="modal-overlay">
            <div class="modal" style="max-width:900px;">
                <div class="modal-header">
                    <h3>Registrar entrega por producto</h3>
                    <button class="modal-close" onclick="closeEntregaModal()">&times;</button>
                </div>
                <div class="modal-body" id="entrega-body"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeEntregaModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveEntrega()">Guardar entrega</button>
                </div>
            </div>
        </div>
    `;
}

async function refreshPedidos(silent = false) {
    try {
        const d = await apiFetch('/pedidos');
        pedidosData = Array.isArray(d) ? d : (d.data || []);
        renderPedidosView();
    } catch (e) {
        pedidosData = [];
        renderPedidosView();
        if (!silent) Swal.fire('Error', 'Error al cargar pedidos: ' + (e.message || 'sin detalle'), 'error');
    }
}

function renderPedidosView() {
    const filtered = getFilteredPedidos();
    if (kanbanViewMode === 'tabla') {
        document.getElementById('pedidos-kanban').style.display = 'none';
        document.getElementById('pedidos-table-section').style.display = '';
        renderPedidosList(filtered);
    } else {
        document.getElementById('pedidos-kanban').style.display = '';
        document.getElementById('pedidos-table-section').style.display = 'none';
        renderKanban(filtered);
    }
}

function getFilteredPedidos() {
    const search = normalize(document.getElementById('pedidos-search')?.value || '');
    const farmaciaId = document.getElementById('filter-farmacia')?.value || '';
    const estadoId = document.getElementById('filter-estado')?.value || '';

    return pedidosData.filter(p => {
        const farmacia = p.farmacia?.nombre || getFarmaciaName(p.id_farmacia);
        const productos = (p.detalles || []).map(d => d.producto?.nombre || getProductoName(d.id_producto)).join(' ');
        const text = normalize(`${p.id_pedido} ${farmacia} ${productos} ${getEstadoName(p)}`);
        if (search && !text.includes(search)) return false;
        if (farmaciaId && String(p.id_farmacia || p.farmacia?.id_farmacia || '') !== String(farmaciaId)) return false;
        if (estadoId && String(p.id_estado_pedido || p.estado?.id_estado_pedido || '') !== String(estadoId)) return false;
        return true;
    });
}

function renderKanban(pedidos) {
    const container = document.getElementById('pedidos-kanban');
    if (!container) return;
    container.innerHTML = KANBAN_COLUMNS.map(col => {
        const items = pedidos.filter(p => getColumnKey(p) === col.key);
        return `
            <div class="kanban-column" data-column="${col.key}">
                <div class="kanban-column-header">
                    <span><i class="fas ${col.icon}"></i> ${col.title}</span>
                    <span class="count">${items.length}</span>
                </div>
                <div class="kanban-column-body" data-column="${col.key}">
                    ${items.length ? items.map(renderPedidoCard).join('') : '<div class="empty-state compact">Sin pedidos</div>'}
                </div>
            </div>
        `;
    }).join('');
    setTimeout(initPedidosSortable, 50);
}

function renderPedidosList(pedidos) {
    const counter = document.getElementById('pedidos-count');
    if (counter) counter.textContent = `${pedidos.length} pedidos`;
    const container = document.getElementById('pedidos-list');
    if (!container) return;
    if (!pedidos.length) {
        container.innerHTML = '<div class="empty-state">No hay pedidos con los filtros actuales.</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Farmacia</th>
                        <th>Estado</th>
                        <th>Productos</th>
                        <th>Total pedido</th>
                        <th>Faltante</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedidos.map(p => `
                        <tr>
                            <td><strong>#${p.id_pedido}</strong></td>
                            <td>${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</td>
                            <td>${getStatusBadge(getEstadoName(p))}</td>
                            <td>${getDetalleCount(p)} item(s)</td>
                            <td>Bs ${money(p.total)}</td>
                            <td>Bs ${money(getPedidoFaltante(p))}</td>
                            <td>${formatDateShort(p.fecha_pedido || p.created_at)}</td>
                            <td><div class="actions">${renderPedidoActions(p)}</div></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPedidoCard(p) {
    const detalles = p.detalles || [];
    const totalSolicitado = detalles.reduce((s, d) => s + (parseMoney(d.cantidad_solicitada) * parseMoney(d.precio_unitario)), 0) || parseMoney(p.total);
    const totalEntregado = detalles.reduce((s, d) => s + (Math.min(parseMoney(d.cantidad_entregada), parseMoney(d.cantidad_solicitada)) * parseMoney(d.precio_unitario)), 0);
    const percent = totalSolicitado ? Math.min(100, Math.round((totalEntregado / totalSolicitado) * 100)) : 0;

    return `
        <article class="order-card" data-pedido-id="${p.id_pedido}" data-estado="${getColumnKey(p)}">
            <div class="order-card-top">
                <strong>#${p.id_pedido}</strong>
                ${getStatusBadge(getEstadoName(p))}
            </div>
            <h4>${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</h4>
            <div class="order-meta">
                <span><i class="fas fa-cubes"></i> ${getDetalleCount(p)} productos</span>
                <span><i class="fas fa-calendar"></i> ${formatDateShort(p.fecha_pedido || p.created_at)}</span>
            </div>
            <div class="delivery-progress">
                <div class="delivery-progress-bar"><span style="width:${percent}%"></span></div>
                <small>Entregado Bs ${money(totalEntregado)} / Bs ${money(totalSolicitado)}</small>
            </div>
            <div class="order-total">
                <span>Total</span>
                <strong>Bs ${money(p.total || totalSolicitado)}</strong>
            </div>
            <div class="card-actions">${renderPedidoActions(p)}</div>
        </article>
    `;
}

function renderPedidoActions(p) {
    return `
        <button class="btn btn-sm btn-info" onclick="view(${p.id_pedido})" title="Ver detalle"><i class="fas fa-eye"></i></button>
        ${hasPermission('Pedidos', 'editar') ? `<button class="btn btn-sm btn-success" onclick="openEntregaModal(${p.id_pedido})" title="Registrar entrega"><i class="fas fa-clipboard-check"></i></button>` : ''}
        ${hasPermission('Pedidos', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${p.id_pedido}, '#${p.id_pedido}')" title="Cambiar estado"><i class="fas fa-exchange-alt"></i></button>` : ''}
        ${hasPermission('Pedidos', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${p.id_pedido})" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
        ${hasPermission('Pedidos', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${p.id_pedido})" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
    `;
}

function handleInitialParams() {
    const params = new URLSearchParams(window.location.search);
    const farmaciaId = params.get('farmacia');
    if (farmaciaId && hasPermission('Pedidos', 'crear')) {
        setTimeout(() => openCreateModal(parseInt(farmaciaId)), 100);
    }
}

function openCreateModal(preselectedFarmaciaId = null) {
    editingId = null;
    detalleItems = [];
    document.getElementById('modal-title').textContent = 'Nuevo pedido';
    document.getElementById('main-form').reset();
    document.getElementById('extract-status').textContent = 'Sube el PDF para detectar productos, cantidades y precios. Luego revisa las filas antes de guardar.';
    document.getElementById('estado-field-container').style.display = 'none';
    document.getElementById('estado-field-container').innerHTML = '';
    const faInput = document.getElementById('f-farmacia-input');
    const faHidden = document.getElementById('f-farmacia');
    if (faInput) faInput.value = '';
    if (faHidden) faHidden.value = '';
    if (preselectedFarmaciaId) {
        const farmacia = farmaciasList.find(f => String(f.id_farmacia) === String(preselectedFarmaciaId));
        if (farmacia) {
            if (faInput) faInput.value = farmacia.nombre;
            if (faHidden) faHidden.value = farmacia.id_farmacia;
        }
    }
    renderDetalle();
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('main-modal').classList.remove('active');
    editingId = null;
    detalleItems = [];
    const estadoContainer = document.getElementById('estado-field-container');
    if (estadoContainer) {
        estadoContainer.style.display = 'none';
        estadoContainer.innerHTML = '';
    }
    const faInput = document.getElementById('f-farmacia-input');
    const faHidden = document.getElementById('f-farmacia');
    if (faInput) faInput.value = '';
    if (faHidden) faHidden.value = '';
}

function openProductoModal() {
    document.getElementById('producto-form').reset();
    document.getElementById('p-precio').value = '';
    document.getElementById('producto-modal').classList.add('active');
}

function closeProductoModal() {
    document.getElementById('producto-modal').classList.remove('active');
}

function addProductoToDetalle() {
    const id_producto = parseInt(document.getElementById('p-producto').value);
    const cantidad_solicitada = parseMoney(document.getElementById('p-cantidad').value);
    const precio_unitario = parseMoney(document.getElementById('p-precio').value);

    if (!id_producto) return Swal.fire('Validacion', 'Seleccione un producto', 'warning');
    if (cantidad_solicitada <= 0) return Swal.fire('Validacion', 'Ingrese una cantidad valida', 'warning');
    if (precio_unitario <= 0) return Swal.fire('Validacion', 'Ingrese un precio valido', 'warning');

    const existing = detalleItems.findIndex(d => parseInt(d.id_producto) === id_producto && !d._id_detalle);
    if (existing >= 0) {
        detalleItems[existing].cantidad_solicitada += cantidad_solicitada;
        detalleItems[existing].precio_unitario = precio_unitario;
    } else {
        detalleItems.push({
            id_producto,
            nombre_detectado: getProductoName(id_producto),
            cantidad_solicitada,
            cantidad_entregada: 0,
            precio_unitario,
            confianza: 100,
            advertencias: [],
            _needsReview: false,
        });
    }

    closeProductoModal();
    renderDetalle();
}

function renderDetalle() {
    const tbody = document.getElementById('detalle-body');
    if (!tbody) return;

    if (!detalleItems.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state compact">Sin productos agregados</td></tr>';
        document.getElementById('detalle-subtotal').textContent = 'Bs 0.00';
        return;
    }

    tbody.innerHTML = detalleItems.map((d, i) => {
        const subtotal = parseMoney(d.cantidad_solicitada) * parseMoney(d.precio_unitario);
        const needsReview = d._needsReview || !d.id_producto;
        return `
            <tr class="${needsReview ? 'row-warning' : ''}">
                <td>
                    <select class="form-control compact-input" onchange="updateDetalleProduct(${i}, this.value)">
                        <option value="">Vincular producto...</option>
                        ${productosList.map(p => `<option value="${p.id_producto}" ${String(p.id_producto) === String(d.id_producto || '') ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')}
                    </select>
                    ${d.nombre_detectado ? `<small class="text-muted">Detectado: ${escapeHtml(d.nombre_detectado)}</small>` : ''}
                    ${!d.id_producto && d.nombre_detectado ? '<small class="text-muted">Se creara en catalogo al guardar.</small>' : ''}
                </td>
                <td><input type="number" class="form-control compact-input" value="${parseMoney(d.cantidad_solicitada)}" min="0.01" step="0.01" onchange="updateDetalleCant(${i}, this.value)"></td>
                <td><input type="number" class="form-control compact-input" value="${parseMoney(d.precio_unitario)}" min="0.01" step="0.01" onchange="updateDetallePrecio(${i}, this.value)"></td>
                <td>Bs ${money(subtotal)}</td>
                <td>${renderRevisionBadge(d)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="removeDetalle(${i})"><i class="fas fa-times"></i></button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('detalle-subtotal').textContent = 'Bs ' + money(calcDetalleTotal());
}

function renderRevisionBadge(item) {
    if (!item.id_producto && item.nombre_detectado) return '<span class="badge badge-info">Nuevo</span>';
    if (item._needsReview || !item.id_producto) return '<span class="badge badge-warning">Revisar</span>';
    if (item.confianza !== undefined && parseMoney(item.confianza) < 80) return `<span class="badge badge-warning">${parseMoney(item.confianza)}%</span>`;
    return '<span class="badge badge-success">OK</span>';
}

function updateDetalleProduct(idx, val) {
    if (!detalleItems[idx]) return;
    const id = parseInt(val);
    detalleItems[idx].id_producto = id || null;
    if (id) {
        detalleItems[idx]._needsReview = false;
        detalleItems[idx]._createProduct = false;
        const producto = productosList.find(p => parseInt(p.id_producto) === id);
        if (producto) detalleItems[idx].nombre_detectado = producto.nombre;
    } else if (detalleItems[idx].nombre_detectado) {
        detalleItems[idx]._createProduct = true;
    }
    renderDetalle();
}

function updateDetalleCant(idx, val) {
    if (!detalleItems[idx]) return;
    detalleItems[idx].cantidad_solicitada = parseMoney(val);
    renderDetalle();
}

function updateDetallePrecio(idx, val) {
    if (!detalleItems[idx]) return;
    detalleItems[idx].precio_unitario = parseMoney(val);
    renderDetalle();
}

function removeDetalle(idx) {
    detalleItems.splice(idx, 1);
    renderDetalle();
}

async function extractPdfProducts() {
    const input = document.getElementById('f-archivo');
    const status = document.getElementById('extract-status');
    if (!input?.files?.length) return Swal.fire('Validacion', 'Seleccione un archivo PDF primero.', 'warning');

    const file = input.files[0];
    const formData = new FormData();
    formData.append('archivo', file);
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando PDF...';

    try {
        const resp = await apiFetch('/pedidos/extraer-pdf', { method: 'POST', body: formData });
        const rows = resp.productos || resp.data?.productos || resp.data || resp || [];
        const productosDetectados = Array.isArray(rows) ? rows : [];
        if (!productosDetectados.length) {
            status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> El PDF no tiene texto legible. Ejecutando OCR...';
            const ocrRows = await extractPdfProductsWithOcr(file, status);
            applyDetectedProducts(ocrRows, 'OCR');
            return;
        }

        applyDetectedProducts(productosDetectados, 'PDF');
    } catch (e) {
        try {
            status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> No se pudo leer texto. Ejecutando OCR...';
            const ocrRows = await extractPdfProductsWithOcr(file, status);
            applyDetectedProducts(ocrRows, 'OCR');
        } catch (ocrError) {
            status.textContent = 'No se pudo extraer el PDF. Puedes registrar el pedido manualmente.';
            Swal.fire('PDF no procesado', ocrError.message || e.message || 'No se pudo escanear el documento.', 'warning');
        }
    }
}

function applyDetectedProducts(productosDetectados, fuente = 'PDF') {
    const status = document.getElementById('extract-status');
    if (!productosDetectados.length) {
        status.textContent = fuente === 'OCR'
            ? 'OCR completado, pero no se detectaron productos. Puedes agregarlos manualmente.'
            : 'No se detectaron productos. Puedes agregarlos manualmente.';
        return;
    }

    detalleItems = productosDetectados.map(row => {
        const matchedId = row.producto_id || row.id_producto || findProductoByName(row.nombre);
        const detectedName = cleanDetectedProductName(row.nombre || row.producto || row.descripcion || getProductoName(matchedId));
        return {
            id_producto: matchedId,
            nombre_detectado: detectedName,
            cantidad_solicitada: parseMoney(row.cantidad_solicitada || row.cantidad || 1),
            cantidad_entregada: 0,
            precio_unitario: parseMoney(row.precio_unitario || row.precio || 0),
            confianza: row.confianza,
            advertencias: row.advertencias || [],
            _needsReview: !matchedId || (row.advertencias && row.advertencias.length > 0) || (row.confianza !== undefined && parseMoney(row.confianza) < 80),
            _createProduct: !matchedId && !!detectedName,
        };
    });

    const nuevos = detalleItems.filter(item => !item.id_producto && item._createProduct).length;
    status.innerHTML = `<span class="badge badge-success">${productosDetectados.length} productos detectados por ${fuente}</span> ${nuevos ? `${nuevos} producto(s) nuevo(s) se crearan al guardar.` : 'Revisa las filas marcadas antes de guardar.'}`;
    renderDetalle();
}

async function extractPdfProductsWithOcr(file, status) {
    await ensureOcrLibraries();
    const ocr = await ocrPdfFile(file, status);
    const tableRows = (ocr.pages || []).flatMap(page => page.tableRows || []);
    if (tableRows.length >= 6) {
        window.__lastPedidoOcrRows = { tableRows, layoutRows: [], textRows: [], selectedRows: tableRows };
        return tableRows;
    }

    const layoutRows = parseVentaProductsFromOcrWords(ocr.pages) || [];
    const textRows = parseVentaProductosText(ocr.text || ocr);
    const minLayoutRows = Math.max(6, Math.floor(textRows.length * 0.75));
    const rows = layoutRows.length >= minLayoutRows ? layoutRows : textRows;
    window.__lastPedidoOcrRows = { layoutRows, textRows, selectedRows: rows };
    if (!rows.length) return [];
    return rows;
}

async function ensureOcrLibraries() {
    if (!window.pdfjsLib) throw new Error('No se pudo cargar PDF.js para renderizar el PDF.');
    if (!window.Tesseract) throw new Error('No se pudo cargar Tesseract.js para OCR.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

async function ocrPdfFile(file, status) {
    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const texts = [];
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> OCR pagina ${pageNumber} de ${pdf.numPages}...`;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;

        const tableRows = await extractSirPharmaTableWithCellOcr(canvas, status, pageNumber, pdf.numPages);
        if (tableRows.length >= 6) {
            pages.push({
                pageNumber,
                width: canvas.width,
                height: canvas.height,
                text: tableRows.map(row => row.linea_origen).join('\n'),
                words: [],
                tableRows,
            });
            texts.push(tableRows.map(row => row.linea_origen).join('\n'));
            continue;
        }

        const result = await window.Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 100);
                    status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> OCR pagina ${pageNumber}: ${pct}%`;
                }
            }
        });
        texts.push(result?.data?.text || '');
        pages.push({
            pageNumber,
            width: canvas.width,
            height: canvas.height,
            text: result?.data?.text || '',
            words: result?.data?.words || [],
        });
    }

    const ocr = { text: texts.join('\n'), pages };
    window.__lastPedidoOcr = ocr;
    return ocr;
}

function parseVentaProductosText(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const blocks = [];
    let current = '';

    for (const line of lines) {
        if (isOcrNoiseLine(line)) continue;
        if (/^\d{1,2}\s+/.test(line)) {
            if (current) blocks.push(current);
            current = line;
        } else if (current) {
            current += ' ' + line;
        }
    }
    if (current) blocks.push(current);

    return blocks
        .map(parseVentaProductBlock)
        .filter(Boolean);
}

function parseVentaProductBlock(block) {
    const raw = block.replace(/\s+/g, ' ').trim();
    const withoutIndex = raw.replace(/^\d{1,2}\s+/, '');
    const cantidadMatch = withoutIndex.match(/(\d+(?:[.,]\d+)?)\s*[-–—]?\s*(?:u[dcl]?|und|unid|unidad|blt|bit|cja|caja)\b/i);
    const moneyMatches = [...withoutIndex.matchAll(/\d+[.,]\d{2}/g)].map(m => parseMoney(m[0].replace(',', '.')));

    let nombre = withoutIndex;
    if (cantidadMatch && cantidadMatch.index > 0) {
        nombre = withoutIndex.slice(0, cantidadMatch.index).trim();
    }
    nombre = nombre
        .replace(/[/\(]?\s*cod\.?\s*\d+.*$/i, '')
        .replace(/\bCOFAR\s*S\.?A\.?.*$/i, '')
        .replace(/\bBAGO\s*S\.?A\.?.*$/i, '')
        .replace(/\bLAFAR\s*S\.?A\.?.*$/i, '')
        .replace(/[|;:,]+$/g, '')
        .trim();

    if (!nombre || !cantidadMatch) return null;

    const matchedId = findProductoByName(nombre);
    const precio = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : 0;
    const total = moneyMatches.length >= 1 ? moneyMatches[moneyMatches.length - 1] : 0;
    const cantidad = parseMoney(cantidadMatch[1].replace(',', '.')) || (precio > 0 && total > 0 ? total / precio : 1);
    const advertencias = [];

    if (!matchedId) advertencias.push('Producto detectado por OCR sin coincidencia exacta en catalogo.');
    if (!precio) advertencias.push('No se detecto precio unitario en OCR.');
    if (precio && total && Math.abs((cantidad * precio) - total) > 0.25) {
        advertencias.push('Total OCR no coincide exactamente con cantidad por precio.');
    }

    return {
        id_producto: matchedId,
        nombre,
        cantidad_solicitada: cantidad,
        precio_unitario: precio,
        confianza: matchedId && precio ? 82 : 62,
        advertencias,
        linea_origen: raw,
    };
}

function isOcrNoiseLine(line) {
    return /^(venta de productos|fecha|sucursal|cliente|dir\.|telf\.|cod\. cliente|moneda|n[°o]|descripcion|serie|cantidad|p\/u|total|forma de pago|glosa|almacen|contabilidad|recibi conforme|ct=)/i.test(line);
}

function parseVentaProductBlock(block) {
    const raw = String(block || '').replace(/\s+/g, ' ').trim();
    const withoutIndex = raw.replace(/^\d{1,2}\s+/, '');
    const cantidadMatch = withoutIndex.match(/(\d+(?:[.,]\d+)?)\s*[-–—]?\s*(?:u[dcl]?|und|unid|unidad|blt|bit|cja|caja)\b/i);
    const moneyMatches = [...withoutIndex.matchAll(/\d+[.,]\d{1,2}/g)].map(m => parseMoney(m[0].replace(',', '.')));

    if (!cantidadMatch) return null;

    const nombreBase = withoutIndex.slice(0, Math.max(0, cantidadMatch.index)).trim();
    const nombre = pickCommercialProductName(nombreBase);
    if (!nombre) return null;

    const cantidad = parseMoney(cantidadMatch[1].replace(',', '.')) || 1;
    const total = moneyMatches.length >= 1 ? moneyMatches[moneyMatches.length - 1] : 0;
    let precio = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : 0;

    if (cantidad > 0 && total > 0) {
        const precioCalculado = roundMoney(total / cantidad);
        const diffDetectado = precio > 0 ? Math.abs((cantidad * precio) - total) : Number.POSITIVE_INFINITY;
        const diffCalculado = Math.abs((cantidad * precioCalculado) - total);
        if (!precio || diffDetectado > Math.max(0.25, diffCalculado + 0.1)) {
            precio = precioCalculado;
        }
    }

    const matchedId = findProductoByName(nombre);
    const advertencias = [];
    if (!matchedId) advertencias.push('Producto detectado por OCR sin coincidencia exacta en catalogo.');
    if (!precio) advertencias.push('No se detecto precio unitario en OCR.');
    if (precio && total && Math.abs((cantidad * precio) - total) > 0.25) {
        advertencias.push('Total OCR no coincide exactamente con cantidad por precio.');
    }

    return {
        id_producto: matchedId,
        nombre,
        cantidad_solicitada: cantidad,
        precio_unitario: precio,
        confianza: matchedId && precio ? 86 : 70,
        advertencias,
        linea_origen: raw,
    };
}

function isOcrNoiseLine(line) {
    return /^(venta de productos|fecha|sucursal|cliente|dir\.|telf\.|cod\. cliente|moneda|n[°o]|descripcion|serie|cantidad|p\/u|total|forma de pago|glosa|almacen|contabilidad|recibi conforme|ct=)/i.test(line);
}

function pickCommercialProductName(value) {
    const cleaned = cleanDetectedProductName(value);
    if (!cleaned) return '';

    const candidates = cleaned
        .split(/\s{2,}| \/ | \| |;|\s+(?=[A-Z][a-z]{3,})/)
        .map(cleanDetectedProductName)
        .filter(Boolean);

    const upperCandidate = candidates.find(part => {
        const letters = part.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
        if (letters.length < 4) return false;
        const upperLetters = part.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '').length;
        return upperLetters / letters.length >= 0.55 && !looksLikeComposition(part);
    });

    return upperCandidate || candidates.find(part => !looksLikeComposition(part)) || cleaned;
}

function cleanDetectedProductName(value) {
    return String(value || '')
        .replace(/^\d{1,2}\s+/, '')
        .replace(/[/\(]?\s*cod\.?\s*\d+.*/i, '')
        .replace(/\b(?:COFAR|BAGO|LAFAR|IFARBO|ALFA)\s*S\.?A\.?.*/i, '')
        .replace(/\b(?:SIR|PHARMA|DISTRIBUIDORA)\b.*$/i, '')
        .replace(/\s+\d+[.,]\d{1,2}\s+\d+[.,]\d{1,2}.*$/, '')
        .replace(/[|;:,/]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function looksLikeComposition(value) {
    return /\b(mg|mcg|g\/|paracetamol|diclofenaco|clorfeniramina|pseudoefedrina|hidroxido|carbonato|cafeina|asa)\b/i.test(value)
        && !/\b(comp|tab|jarabe|polvo|forte|plus|cofar|anara|chakitabs|espasmo|dexacofasona|respiriol|refrianex)\b/i.test(value);
}

function roundMoney(value) {
    return Math.round(parseMoney(value) * 100) / 100;
}

async function extractSirPharmaTableWithCellOcr(canvas, status, pageNumber, totalPages) {
    const lines = detectInvoiceHorizontalLines(canvas);
    if (lines.length < 11) return [];

    const boundaries = lines.slice(1);
    const expectedRows = Math.min(12, boundaries.length - 1);
    const rows = [];

    for (let i = 0; i < expectedRows; i++) {
        const top = boundaries[i] + 4;
        const bottom = boundaries[i + 1] - 4;
        if (bottom <= top) continue;

        status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> OCR tabla pagina ${pageNumber} de ${totalPages}, fila ${i + 1}...`;
        const row = await extractSirPharmaRow(canvas, top, bottom, i + 1);
        if (row) rows.push(row);
    }

    return rows;
}

function detectInvoiceHorizontalLines(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const x0 = Math.floor(width * 0.04);
    const x1 = Math.floor(width * 0.96);
    const y0 = Math.floor(height * 0.15);
    const y1 = Math.floor(height * 0.70);
    const image = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const lineCandidates = [];

    for (let y = 0; y < image.height; y++) {
        let dark = 0;
        for (let x = 0; x < image.width; x++) {
            const idx = ((y * image.width) + x) * 4;
            const lum = (image.data[idx] + image.data[idx + 1] + image.data[idx + 2]) / 3;
            if (lum < 225) dark++;
        }
        if (dark > image.width * 0.45) {
            lineCandidates.push(y + y0);
        }
    }

    const groups = [];
    lineCandidates.forEach(y => {
        const current = groups[groups.length - 1];
        if (!current || y - current[current.length - 1] > 3) groups.push([y]);
        else current.push(y);
    });

    return groups
        .filter(group => group.length <= 10)
        .map(group => Math.round(group.reduce((sum, y) => sum + y, 0) / group.length))
        .filter((y, idx, arr) => idx === 0 || y - arr[idx - 1] > 30);
}

async function extractSirPharmaRow(sourceCanvas, top, bottom, rowNumber) {
    const width = sourceCanvas.width;
    const rowHeight = bottom - top;
    const nameCanvas = cropCanvas(sourceCanvas, width * 0.085, top, width * 0.455, rowHeight * 0.48, 2.4);
    const numbersCanvas = cropCanvas(sourceCanvas, width * 0.675, top, width * 0.285, rowHeight, 2.4);

    const [nameText, numbersText] = await Promise.all([
        recognizeCanvasText(nameCanvas),
        recognizeCanvasText(numbersCanvas, '0123456789.,- udUDcCjaBlt'),
    ]);

    const nombre = pickCommercialProductName(nameText);
    const cantidad = parseOcrQuantity(numbersText);
    const moneyValues = extractMoneyValues(numbersText);
    const total = moneyValues.length ? moneyValues[moneyValues.length - 1] : 0;
    let precio = moneyValues.length >= 2 ? moneyValues[moneyValues.length - 2] : 0;

    if (cantidad > 0 && total > 0) {
        const calculado = roundMoney(total / cantidad);
        if (!precio || Math.abs((cantidad * precio) - total) > 0.25) {
            precio = calculado;
        }
    }

    if (!nombre || !cantidad || !precio) return null;

    const matchedId = findProductoByName(nombre);
    const advertencias = [];
    if (!matchedId) advertencias.push('Producto detectado por OCR sin coincidencia exacta en catalogo.');

    return {
        id_producto: matchedId,
        nombre,
        cantidad_solicitada: cantidad,
        precio_unitario: precio,
        confianza: matchedId ? 92 : 80,
        advertencias,
        linea_origen: `${rowNumber}. ${nombre} | ${numbersText.replace(/\s+/g, ' ').trim()}`,
    };
}

function cropCanvas(sourceCanvas, x, y, width, height, scale = 1) {
    const canvas = document.createElement('canvas');
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.min(sourceCanvas.width - sx, Math.ceil(width));
    const sh = Math.min(sourceCanvas.height - sy, Math.ceil(height));
    canvas.width = Math.max(1, Math.ceil(sw * scale));
    canvas.height = Math.max(1, Math.ceil(sh * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
}

async function recognizeCanvasText(canvas, whitelist = null) {
    const options = whitelist ? { tessedit_char_whitelist: whitelist } : {};
    const result = await window.Tesseract.recognize(canvas, 'eng', options);
    return result?.data?.text || '';
}

function extractMoneyValues(value) {
    const normalized = String(value || '').replace(/,/g, '.');
    return [...normalized.matchAll(/\d+\.\d{1,2}/g)].map(match => parseMoney(match[0]));
}

function parseVentaProductsFromOcrWords(pages) {
    const items = [];
    (pages || []).forEach(page => {
        const words = normalizeOcrWords(page.words, page.width, page.height);
        const visualLines = buildOcrVisualLines(words);
        const pageItems = buildProductRowsFromVisualLines(visualLines, page.width);
        items.push(...pageItems);
    });

    return items.length ? items : null;
}

function normalizeOcrWords(words, width, height) {
    return (words || [])
        .map(word => {
            const bbox = word.bbox || {};
            const x0 = Number.isFinite(bbox.x0) ? bbox.x0 : (Number.isFinite(word.x0) ? word.x0 : 0);
            const y0 = Number.isFinite(bbox.y0) ? bbox.y0 : (Number.isFinite(word.y0) ? word.y0 : 0);
            const x1 = Number.isFinite(bbox.x1) ? bbox.x1 : (Number.isFinite(word.x1) ? word.x1 : x0);
            const y1 = Number.isFinite(bbox.y1) ? bbox.y1 : (Number.isFinite(word.y1) ? word.y1 : y0);
            return {
                text: String(word.text || '').trim(),
                confidence: Number.isFinite(word.confidence) ? word.confidence : 0,
                x0,
                y0,
                x1,
                y1,
                cx: (x0 + x1) / 2,
                cy: (y0 + y1) / 2,
                width,
                height,
            };
        })
        .filter(word => word.text && word.cy > height * 0.18 && word.cy < height * 0.84);
}

function buildOcrVisualLines(words) {
    const sorted = [...words].sort((a, b) => (a.cy - b.cy) || (a.x0 - b.x0));
    const lines = [];

    sorted.forEach(word => {
        let line = lines.find(candidate => Math.abs(candidate.cy - word.cy) <= Math.max(8, (word.y1 - word.y0) * 0.65));
        if (!line) {
            line = { words: [], cy: word.cy };
            lines.push(line);
        }
        line.words.push(word);
        line.cy = (line.cy * (line.words.length - 1) + word.cy) / line.words.length;
    });

    return lines
        .map(line => {
            const sortedWords = line.words.sort((a, b) => a.x0 - b.x0);
            return {
                ...line,
                words: sortedWords,
                text: sortedWords.map(word => word.text).join(' '),
                x0: Math.min(...sortedWords.map(word => word.x0)),
                x1: Math.max(...sortedWords.map(word => word.x1)),
            };
        })
        .filter(line => line.words.length && !isOcrNoiseLine(line.text))
        .sort((a, b) => a.cy - b.cy);
}

function buildProductRowsFromVisualLines(lines, pageWidth) {
    const rows = [];
    let current = null;

    lines.forEach(line => {
        const firstWord = line.words[0]?.text || '';
        const rowNumber = /^\d{1,2}$/.test(firstWord) && line.words[0].cx < pageWidth * 0.12;
        const hasDescription = line.words.some(word => word.cx >= pageWidth * 0.08 && word.cx < pageWidth * 0.66);
        const hasMoney = line.words.some(word => word.cx >= pageWidth * 0.74 && isMoneyToken(word.text));

        if (rowNumber && hasDescription) {
            if (current) rows.push(current);
            current = { lines: [line] };
            return;
        }

        if (current && (hasDescription || hasMoney)) {
            current.lines.push(line);
        }
    });

    if (current) rows.push(current);

    return rows
        .map(row => parseOcrLayoutProductRow(row, pageWidth))
        .filter(Boolean);
}

function parseOcrLayoutProductRow(row, pageWidth) {
    const descriptionLines = row.lines
        .map(line => line.words
            .filter(word => word.cx >= pageWidth * 0.08 && word.cx < pageWidth * 0.66)
            .map(word => word.text)
            .join(' ')
            .trim())
        .filter(Boolean);

    const commercialLine = descriptionLines.find(line => {
        const cleaned = cleanDetectedProductName(line);
        return cleaned && !looksLikeComposition(cleaned);
    }) || descriptionLines[0] || '';
    const nombre = pickCommercialProductName(commercialLine);

    const quantityText = row.lines
        .flatMap(line => line.words.filter(word => word.cx >= pageWidth * 0.66 && word.cx < pageWidth * 0.78).map(word => word.text))
        .join(' ');
    const priceTokens = row.lines
        .flatMap(line => line.words.filter(word => word.cx >= pageWidth * 0.78 && word.cx < pageWidth * 0.89).map(word => word.text));
    const totalTokens = row.lines
        .flatMap(line => line.words.filter(word => word.cx >= pageWidth * 0.89).map(word => word.text));

    const cantidad = parseOcrQuantity(quantityText);
    const precioCol = firstMoneyFromTokens(priceTokens);
    const totalCol = firstMoneyFromTokens(totalTokens);
    let precio = precioCol;

    if (cantidad > 0 && totalCol > 0) {
        const calculado = roundMoney(totalCol / cantidad);
        if (!precio || Math.abs((cantidad * precio) - totalCol) > 0.25) {
            precio = calculado;
        }
    }

    if (!nombre || !cantidad || !precio) return null;

    const matchedId = findProductoByName(nombre);
    const advertencias = [];
    if (!matchedId) advertencias.push('Producto detectado por OCR sin coincidencia exacta en catalogo.');

    return {
        id_producto: matchedId,
        nombre,
        cantidad_solicitada: cantidad,
        precio_unitario: precio,
        confianza: matchedId ? 90 : 76,
        advertencias,
        linea_origen: row.lines.map(line => line.text).join(' | '),
    };
}

function parseOcrQuantity(value) {
    const text = String(value || '').replace(/[,;]/g, '.');
    const match = text.match(/\d+(?:\.\d+)?/);
    return match ? parseMoney(match[0]) : 0;
}

function firstMoneyFromTokens(tokens) {
    const joined = (tokens || []).join(' ').replace(/,/g, '.');
    const match = joined.match(/\d+\.\d{1,2}/);
    return match ? parseMoney(match[0]) : 0;
}

function isMoneyToken(value) {
    return /\d+[,.]\d{1,2}/.test(String(value || ''));
}

async function view(id) {
    try {
        const p = await fetchPedido(id);
        const detalles = p.detalles || [];
        document.getElementById('view-body').innerHTML = `
            <div class="info-grid">
                <div><strong>Pedido:</strong> #${p.id_pedido}</div>
                <div><strong>Farmacia:</strong> ${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(getEstadoName(p))}</div>
                <div><strong>Fecha:</strong> ${formatDate(p.fecha_pedido || p.created_at)}</div>
                <div><strong>Total pedido:</strong> Bs ${money(p.total)}</div>
                <div><strong>Faltante:</strong> Bs ${money(getPedidoFaltante(p))}</div>
                <div style="grid-column:1/-1;"><strong>Observaciones:</strong> ${escapeHtml(p.observaciones || 'Sin observaciones')}</div>
                <div style="grid-column:1/-1;"><strong>PDF:</strong> ${p.archivo_pedido ? `<button class="btn btn-sm btn-info" onclick="downloadFile(${p.id_pedido})"><i class="fas fa-file-pdf"></i> Ver PDF</button>` : 'Sin archivo'}</div>
            </div>
            <div class="section-divider"></div>
            <div class="modal-subheader">
                <div>
                    <h4>Productos del pedido</h4>
                    <p>La diferencia entre solicitado y entregado define el descuento por faltante.</p>
                </div>
                ${hasPermission('Pedidos', 'editar') ? `<button class="btn btn-sm btn-success" onclick="openEntregaModal(${p.id_pedido})"><i class="fas fa-clipboard-check"></i> Registrar entrega</button>` : ''}
            </div>
            ${renderDetallePedidoTable(detalles)}
        `;
        document.getElementById('view-modal').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el pedido', 'error');
    }
}

function renderDetallePedidoTable(detalles) {
    if (!detalles.length) return '<div class="empty-state">Sin productos registrados.</div>';
    return `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Solicitado</th>
                        <th>Entregado</th>
                        <th>Faltante</th>
                        <th>Precio unit.</th>
                        <th>Subtotal solicitado</th>
                        <th>Subtotal entregado</th>
                        <th>Descuento faltante</th>
                    </tr>
                </thead>
                <tbody>
                    ${detalles.map(d => {
                        const solicitado = parseMoney(d.cantidad_solicitada);
                        const entregado = parseMoney(d.cantidad_entregada);
                        const precio = parseMoney(d.precio_unitario);
                        const faltante = Math.max(0, solicitado - entregado);
                        return `
                            <tr>
                                <td>${escapeHtml(d.producto?.nombre || getProductoName(d.id_producto))}</td>
                                <td>${solicitado}</td>
                                <td>${entregado}</td>
                                <td>${faltante}</td>
                                <td>Bs ${money(precio)}</td>
                                <td>Bs ${money(solicitado * precio)}</td>
                                <td>Bs ${money(Math.min(entregado, solicitado) * precio)}</td>
                                <td>Bs ${money(faltante * precio)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

async function edit(id) {
    try {
        const p = await fetchPedido(id);
        editingId = id;
        document.getElementById('modal-title').textContent = `Editar pedido #${id}`;
        const farmacia = farmaciasList.find(f => String(f.id_farmacia) === String(p.id_farmacia || p.farmacia?.id_farmacia));
        const faInput = document.getElementById('f-farmacia-input');
        const faHidden = document.getElementById('f-farmacia');
        if (faInput) faInput.value = farmacia ? farmacia.nombre : '';
        if (faHidden) faHidden.value = p.id_farmacia || p.farmacia?.id_farmacia || '';
        const estadoContainer = document.getElementById('estado-field-container');
        estadoContainer.style.display = '';
        estadoContainer.innerHTML = `
            <div class="form-group" style="min-width:180px;">
                <label>Estado</label>
                <select id="f-estado" class="form-control">
                    ${estadosPedido.map(e => `<option value="${e.id_estado_pedido}" ${String(e.id_estado_pedido) === String(p.id_estado_pedido || p.estado?.id_estado_pedido) ? 'selected' : ''}>${escapeHtml(e.nombre_estado)}</option>`).join('')}
                </select>
            </div>
        `;
        document.getElementById('f-observaciones').value = p.observaciones || '';
        document.getElementById('extract-status').textContent = p.archivo_pedido ? `Archivo actual: ${p.archivo_pedido.split('/').pop()}` : 'Puedes subir un PDF nuevo si corresponde.';
        detalleItems = (p.detalles || []).map(d => ({
            id_producto: d.id_producto,
            nombre_detectado: d.producto?.nombre || getProductoName(d.id_producto),
            cantidad_solicitada: parseMoney(d.cantidad_solicitada),
            cantidad_entregada: parseMoney(d.cantidad_entregada),
            precio_unitario: parseMoney(d.precio_unitario),
            confianza: 100,
            advertencias: [],
            _needsReview: false,
            _id_detalle: d.id_detalle,
        }));
        renderDetalle();
        document.getElementById('main-modal').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el pedido', 'error');
    }
}

async function save() {
    const id_farmacia = parseInt(document.getElementById('f-farmacia').value);
    const estadoEl = document.getElementById('f-estado');
    const id_estado_pedido = estadoEl ? parseInt(estadoEl.value) : 1;
    const observaciones = document.getElementById('f-observaciones').value.trim();

    if (!id_farmacia) return Swal.fire('Validacion', 'Seleccione una farmacia', 'warning');
    if (!detalleItems.length) return Swal.fire('Validacion', 'Agregue al menos un producto al pedido', 'warning');
    if (detalleItems.some(d => !d.id_producto && !d.nombre_detectado)) return Swal.fire('Revision pendiente', 'Hay productos sin nombre detectado. Vincule o elimine esas filas.', 'warning');
    if (detalleItems.some(d => parseMoney(d.cantidad_solicitada) <= 0 || parseMoney(d.precio_unitario) <= 0)) return Swal.fire('Validacion', 'Cada producto debe tener cantidad y precio mayor a cero.', 'warning');

    const currentUser = getUser();
    const body = {
        id_farmacia,
        id_estado_pedido,
        observaciones,
        subtotal: calcDetalleTotal(),
        descuento: 0,
        total: calcDetalleTotal(),
        id_usuario: currentUser?.id_usuario || currentUser?.id || null,
    };

    try {
        await ensureDetectedProductsInCatalog();
        let pedidoId = editingId;
        if (editingId) {
            await apiFetch(`/pedidos/${editingId}`, { method: 'PUT', body });
            await saveDetalle(editingId);
            await uploadFile(editingId);
            Swal.fire('Actualizado', 'Pedido actualizado', 'success');
        } else {
            const resp = await apiFetch('/pedidos', { method: 'POST', body });
            pedidoId = resp.data?.id_pedido || resp.pedido?.id_pedido || resp.id_pedido;
            if (!pedidoId) throw new Error('La API no devolvio el ID del pedido creado.');
            await saveDetalle(pedidoId);
            await uploadFile(pedidoId);
            Swal.fire('Creado', 'Pedido creado', 'success');
        }
        closeModal();
        await refreshPedidos(true);
        if (pedidoId) view(pedidoId);
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar', 'error');
    }
}

async function ensureDetectedProductsInCatalog() {
    const pending = detalleItems.filter(item => !item.id_producto && item.nombre_detectado);
    if (!pending.length) return;

    const status = document.getElementById('extract-status');
    if (status) status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando productos nuevos en catalogo...';

    for (const item of pending) {
        const existingId = findProductoByName(item.nombre_detectado);
        if (existingId) {
            item.id_producto = existingId;
            item._createProduct = false;
            item._needsReview = false;
            continue;
        }

        const producto = await createCatalogProductFromDetected(item);
        item.id_producto = producto.id_producto;
        item.nombre_detectado = producto.nombre;
        item._createProduct = false;
        item._needsReview = false;
    }

    renderDetalle();
}

async function createCatalogProductFromDetected(item) {
    const nombre = cleanDetectedProductName(item.nombre_detectado);
    if (!nombre) throw new Error('No se puede crear un producto sin nombre.');

    try {
        const resp = await apiFetch('/productos', {
            method: 'POST',
            body: {
                nombre,
                precio_unitario: parseMoney(item.precio_unitario),
                unidad_medida: 'UNIDAD',
                estado: true,
            }
        });
        const producto = resp.data || resp.producto || resp;
        if (!producto?.id_producto) throw new Error('La API no devolvio el ID del producto creado.');
        productosList.push(producto);
        productosList.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
        return producto;
    } catch (e) {
        if (e.status === 403) {
            throw new Error('No tienes permiso para crear productos desde pedidos. Otorga permiso de Productos/crear o registra el producto manualmente.');
        }
        throw e;
    }
}

async function saveDetalle(pedidoId) {
    let existing = [];
    try {
        const currentDetalles = await apiFetch(`/pedidos/${pedidoId}/detalles`);
        existing = Array.isArray(currentDetalles) ? currentDetalles : (currentDetalles.data || []);
    } catch (e) {
        existing = [];
    }

    for (const d of existing) {
        const stillExists = detalleItems.some(item => item._id_detalle === d.id_detalle);
        if (!stillExists) {
            await apiFetch(`/pedidos/${pedidoId}/detalles/${d.id_detalle}`, { method: 'DELETE' });
        }
    }

    for (const item of detalleItems) {
        const payload = {
            id_producto: item.id_producto,
            cantidad_solicitada: parseMoney(item.cantidad_solicitada),
            precio_unitario: parseMoney(item.precio_unitario),
        };
        if (item._id_detalle) {
            await apiFetch(`/pedidos/${pedidoId}/detalles/${item._id_detalle}`, { method: 'PUT', body: payload });
        } else {
            await apiFetch(`/pedidos/${pedidoId}/detalles`, { method: 'POST', body: payload });
        }
    }
}

async function del(id) {
    const r = await Swal.fire({
        title: 'Eliminar pedido',
        text: `Se eliminara el pedido #${id}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    try {
        await apiFetch(`/pedidos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Pedido eliminado exitosamente.', 'success');
        await refreshPedidos(true);
    } catch (e) {
        if (e.status === 409 || e.has_dispatch || e.data?.has_dispatch) {
            Swal.fire({ title: 'No se puede eliminar', html: '<p>Este pedido ya tiene una entrega registrada.</p>', icon: 'info', confirmButtonText: 'Entendido' });
        } else {
            Swal.fire('Error', e.message || 'Error al eliminar', 'error');
        }
    }
}

function openEstadoModal(id, ref) {
    estadoPedidoId = id;
    document.getElementById('estado-ref').textContent = ref;
    document.getElementById('s-estado').value = '';
    document.getElementById('estado-modal').classList.add('active');
}

function closeEstadoModal() {
    document.getElementById('estado-modal').classList.remove('active');
    estadoPedidoId = null;
}

async function changeEstado() {
    const id_estado_pedido = parseInt(document.getElementById('s-estado').value);
    if (!id_estado_pedido) return Swal.fire('Validacion', 'Seleccione un estado', 'warning');
    try {
        await apiFetch(`/pedidos/${estadoPedidoId}/cambiar-estado`, { method: 'POST', body: { id_estado_pedido } });
        Swal.fire('Actualizado', 'Estado cambiado correctamente', 'success');
        closeEstadoModal();
        await refreshPedidos(true);
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al cambiar estado', 'error');
    }
}

async function openEntregaModal(id) {
    try {
        const p = await fetchPedido(id);
        entregaPedidoId = id;
        entregaItems = (p.detalles || []).map(d => ({
            id_detalle: d.id_detalle,
            producto: d.producto?.nombre || getProductoName(d.id_producto),
            cantidad_solicitada: parseMoney(d.cantidad_solicitada),
            cantidad_entregada: parseMoney(d.cantidad_entregada || d.cantidad_solicitada || 0),
            precio_unitario: parseMoney(d.precio_unitario),
        }));

        document.getElementById('entrega-body').innerHTML = `
            <div class="info-grid">
                <div><strong>Pedido:</strong> #${p.id_pedido}</div>
                <div><strong>Farmacia:</strong> ${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(getEstadoName(p))}</div>
            </div>
            <div class="section-divider"></div>
            <div class="table-container">
                <table class="product-detail-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Solicitado</th>
                            <th>Entregado</th>
                            <th>Faltante</th>
                            <th>Descuento</th>
                        </tr>
                    </thead>
                    <tbody id="entrega-rows"></tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" style="text-align:right;">Total descontado</th>
                            <th colspan="2" id="entrega-descuento">Bs 0.00</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        renderEntregaRows();
        document.getElementById('entrega-modal').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el pedido para entrega', 'error');
    }
}

function renderEntregaRows() {
    const tbody = document.getElementById('entrega-rows');
    if (!tbody) return;
    tbody.innerHTML = entregaItems.map((item, idx) => {
        const faltante = Math.max(0, parseMoney(item.cantidad_solicitada) - parseMoney(item.cantidad_entregada));
        return `
            <tr>
                <td>${escapeHtml(item.producto)}</td>
                <td>${item.cantidad_solicitada}</td>
                <td><input type="number" class="form-control compact-input" min="0" max="${item.cantidad_solicitada}" step="0.01" value="${item.cantidad_entregada}" onchange="updateEntregaCantidad(${idx}, this.value)"></td>
                <td>${faltante}</td>
                <td>Bs ${money(faltante * parseMoney(item.precio_unitario))}</td>
            </tr>
        `;
    }).join('');

    const descuento = entregaItems.reduce((s, item) => {
        const faltante = Math.max(0, parseMoney(item.cantidad_solicitada) - parseMoney(item.cantidad_entregada));
        return s + (faltante * parseMoney(item.precio_unitario));
    }, 0);
    document.getElementById('entrega-descuento').textContent = 'Bs ' + money(descuento);
}

function updateEntregaCantidad(idx, val) {
    if (!entregaItems[idx]) return;
    const max = parseMoney(entregaItems[idx].cantidad_solicitada);
    entregaItems[idx].cantidad_entregada = Math.min(max, Math.max(0, parseMoney(val)));
    renderEntregaRows();
}

function closeEntregaModal() {
    document.getElementById('entrega-modal').classList.remove('active');
    entregaPedidoId = null;
    entregaItems = [];
}

async function saveEntrega() {
    if (!entregaPedidoId) return;
    const pedidoId = entregaPedidoId;
    try {
        for (const item of entregaItems) {
            await apiFetch(`/pedidos/${pedidoId}/detalles/${item.id_detalle}/entrega`, {
                method: 'PUT',
                body: { cantidad_entregada: parseMoney(item.cantidad_entregada) }
            });
        }
        Swal.fire('Actualizado', 'Entrega registrada por producto.', 'success');
        closeEntregaModal();
        closeViewModal();
        await refreshPedidos(true);
        view(pedidoId);
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo registrar la entrega', 'error');
    }
}

async function downloadFile(id) {
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/pedidos/${id}/descargar-archivo`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'No se pudo obtener el archivo');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo descargar el archivo', 'error');
    }
}

async function uploadFile(pedidoId) {
    const fileInput = document.getElementById('f-archivo');
    if (!fileInput?.files?.length) return;

    const formData = new FormData();
    formData.append('archivo', fileInput.files[0]);

    try {
        const token = getToken();
        const resp = await fetch(`${API_URL}/pedidos/${pedidoId}/subir-archivo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.message || 'Error al subir archivo');
    } catch (e) {
        console.error('Error subiendo archivo:', e);
    }
}

async function fetchPedido(id) {
    const d = await apiFetch(`/pedidos/${id}`);
    return d.pedido || d.data || d;
}

function getFarmaciaName(id) {
    const f = farmaciasList.find(x => String(x.id_farmacia) === String(id));
    return f ? f.nombre : 'Sin farmacia';
}

function getProductoName(id) {
    const p = productosList.find(x => String(x.id_producto) === String(id));
    return p ? p.nombre : 'Sin producto';
}

function findProductoByName(name) {
    const target = normalize(name || '');
    if (!target) return null;
    const exact = productosList.find(p => normalize(p.nombre) === target);
    if (exact) return exact.id_producto;
    const partial = productosList.find(p => target.includes(normalize(p.nombre)) || normalize(p.nombre).includes(target));
    if (partial) return partial.id_producto;
    let best = null;
    let bestScore = 0;
    productosList.forEach(p => {
        const productName = normalize(p.nombre);
        const score = similarityScore(target, productName);
        if (score > bestScore) {
            bestScore = score;
            best = p;
        }
    });
    return bestScore >= 0.58 ? best.id_producto : null;
}

function similarityScore(a, b) {
    if (!a || !b) return 0;
    const aTokens = new Set(a.split(/\s+/).filter(t => t.length > 2));
    const bTokens = new Set(b.split(/\s+/).filter(t => t.length > 2));
    const intersection = [...aTokens].filter(t => bTokens.has(t)).length;
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    const tokenScore = intersection / union;
    const lengthScore = 1 - (Math.abs(a.length - b.length) / Math.max(a.length, b.length));
    return (tokenScore * 0.75) + (Math.max(0, lengthScore) * 0.25);
}

function getEstadoName(p) {
    return p.estado?.nombre_estado || p.nombre_estado || p.estado || 'Pendiente';
}

function getColumnKey(p) {
    const status = normalize(getEstadoName(p));
    if (status.includes('cancel')) return 'cancelado';
    if (status.includes('prepar') || status.includes('aprob')) return 'preparacion';
    if (status.includes('ruta') || status.includes('despach')) return 'en_ruta';
    if (status.includes('entreg') || status.includes('complet')) return 'entregado';
    return 'pendiente';
}

function getDetalleCount(p) {
    return p.detalles_count ?? p.detalles?.length ?? 0;
}

function getPedidoFaltante(p) {
    return (p.detalles || []).reduce((s, d) => {
        const faltante = Math.max(0, parseMoney(d.cantidad_solicitada) - parseMoney(d.cantidad_entregada));
        return s + (faltante * parseMoney(d.precio_unitario));
    }, 0);
}

function calcDetalleTotal() {
    return detalleItems.reduce((s, d) => s + (parseMoney(d.cantidad_solicitada) * parseMoney(d.precio_unitario)), 0);
}

function parseMoney(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

function money(value) {
    return parseMoney(value).toFixed(2);
}

function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}

function togglePedidosView(mode) {
    kanbanViewMode = mode;
    document.querySelectorAll('.pedidos-view-toggle .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderPedidosView();
}

function initPedidosSortable() {
    if (typeof Sortable === 'undefined') return;
    document.querySelectorAll('#pedidos-kanban .kanban-column-body').forEach(col => {
        if (col._sortable) col._sortable.destroy();
    });
    document.querySelectorAll('#pedidos-kanban .kanban-column-body').forEach(col => {
        const columnKey = col.dataset.column;
        if (!columnKey) return;
        col._sortable = new Sortable(col, {
            group: 'kanban',
            animation: 0,
            ghostClass: 'sortable-ghost',
            onAdd: function (evt) {
                const pedidoId = parseInt(evt.item.dataset.pedidoId);
                if (pedidoId) handlePedidoDrop(pedidoId, columnKey);
            },
        });
    });
}

async function handlePedidoDrop(pedidoId, newStatusKey) {
    const statusMap = {
        pendiente: 1,
        preparacion: 2,
        en_ruta: 3,
        entregado: 4,
        cancelado: 5,
    };
    const id_estado_pedido = statusMap[newStatusKey];
    if (!id_estado_pedido) return;
    try {
        await apiFetch(`/pedidos/${pedidoId}/cambiar-estado`, {
            method: 'POST',
            body: { id_estado_pedido }
        });
        await refreshPedidos(true);
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo cambiar el estado', 'error');
        await refreshPedidos(true);
    }
}

/* ─────────── Autocomplete Farmacia ─────────── */

function onFarmaciaInput(input) {
    const hidden = document.getElementById('f-farmacia');
    const val = input.value.trim();
    const match = farmaciasList.find(f => normalize(f.nombre) === normalize(val));
    if (match) {
        hidden.value = match.id_farmacia;
        onFarmaciaChange();
    } else {
        hidden.value = '';
        const container = document.getElementById('historial-contextual');
        if (container) container.innerHTML = '';
    }
}

function onFarmaciaChange() {
    const container = document.getElementById('historial-contextual');
    if (!container) return;
    const farmaciaId = document.getElementById('f-farmacia')?.value;
    if (!farmaciaId) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<button class="btn btn-link" style="padding:0;font-size:12px;" onclick="showHistorialContextual(${farmaciaId})"><i class="fas fa-clock-rotate-left"></i> Ver ultimos 3 pedidos</button>`;
}

function showHistorialContextual(farmaciaId) {
    const farmaciaPedidos = pedidosData
        .filter(p => String(p.id_farmacia || p.farmacia?.id_farmacia) === String(farmaciaId))
        .sort((a, b) => new Date(b.fecha_pedido || b.created_at) - new Date(a.fecha_pedido || a.created_at))
        .slice(0, 3);

    if (!farmaciaPedidos.length) {
        Swal.fire({ icon: 'info', title: 'Sin historial', text: 'Esta farmacia no tiene pedidos registrados.', confirmButtonText: 'Cerrar' });
        return;
    }

    Swal.fire({
        title: 'Ultimos pedidos',
        html: farmaciaPedidos.map(p => `
            <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;text-align:left;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong>Pedido #${p.id_pedido}</strong>
                    ${getStatusBadge(getEstadoName(p))}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                    ${formatDateShort(p.fecha_pedido || p.created_at)} &middot; Bs ${money(p.total)}
                </div>
                <div style="font-size:12px;">${getDetalleCount(p)} producto(s)</div>
            </div>
        `).join(''),
        confirmButtonText: 'Cerrar',
        width: 420,
    });
}
