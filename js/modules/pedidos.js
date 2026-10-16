let pedidosData = [];
let editingId = null;
let estadoPedidoId = null;
let farmaciasList = [];
let estadosPedido = [];
let kanbanViewMode = 'kanban';
let kanbanCardLimit = null; // null = sin límite, número = máximo por columna
let pedidosSortOrder = 'asc'; // 'asc' o 'desc'

// Contador de "generación" del módulo. Logística monta y desmonta pestañas
// reescribiendo #logistica-content, y esa reescritura deja huérfanos los awaits
// que están en vuelo. Cada flujo asíncrono captura el token al empezar y comprueba
// que sigue vigente antes de tocar el DOM; si otro render tomó el control, se aborta.
let pedidosRenderToken = 0;
let pedidosPagination = { page: 1, pageSize: 25, totalPages: 1 };

// Genera las columnas del kanban desde los estados reales del backend
function buildKanbanColumns() {
    const iconMap = {
        pendiente: 'fa-clock',
        en_ruta: 'fa-truck',
        entregado: 'fa-check-circle',
        cancelado: 'fa-ban',
    };
    const titleMap = {
        pendiente: 'Pendiente',
        en_ruta: 'En Ruta',
        entregado: 'Entregado',
        cancelado: 'Cancelado',
    };
    return (estadosPedido || []).map(e => ({
        key: e.clave,
        title: titleMap[e.clave] || e.nombre_estado,
        icon: iconMap[e.clave] || 'fa-circle',
    }));
}

async function initPedidosModule(containerSelector = '#page-content') {
    const miToken = ++pedidosRenderToken;

    // Cargar preferencias guardadas
    const savedSort = localStorage.getItem('pedidosSortOrder');
    if (savedSort) pedidosSortOrder = savedSort;
    const savedLimit = localStorage.getItem('kanbanCardLimit');
    if (savedLimit) kanbanCardLimit = savedLimit === 'all' ? null : parseInt(savedLimit);
    const savedPageSize = localStorage.getItem('pedidosPageSize');
    if (savedPageSize) pedidosPagination.pageSize = parseInt(savedPageSize);

    await Promise.all([loadFarmacias(), loadEstados()]);

    // Si el usuario cambio de pestana mientras esperabamos, este render ya no
    // pertenece al DOM actual: salir sin tocar nada.
    if (miToken !== pedidosRenderToken) return;

    renderPedidosContent(containerSelector);
    await refreshPedidos(false, miToken);
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
        // Espejo de Pedido::ESTADOS (app/Models/Pedido.php). Mantener en sincronía:
        // el ENUM de pedidos.estado ya no admite 'aprobado' ni 'preparación'.
        estadosPedido = [
            { id_estado_pedido: 1, clave: 'pendiente', nombre_estado: 'Pendiente' },
            { id_estado_pedido: 2, clave: 'en_ruta', nombre_estado: 'En ruta' },
            { id_estado_pedido: 3, clave: 'entregado', nombre_estado: 'Entregado' },
            { id_estado_pedido: 4, clave: 'cancelado', nombre_estado: 'Cancelado' },
        ];
    }
    // Normaliza por si la API devuelve solo las claves de texto.
    if (!estadosPedido.length) estadosPedido = [];
}

function renderPedidosContent(containerSelector = '#page-content') {
    const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
    if (!container) return;
    const pageSizes = [10, 25, 50, 100];
    container.innerHTML = `
        <section class="ops-hero">
            <div class="ops-hero-main">
                <div class="ops-kicker">Operaciones comerciales</div>
                <h1 class="ops-title">Pedidos por flujo</h1>
                <p class="ops-subtitle">Registra pedidos por farmacia y controla su avance entre pendiente, en ruta, entregado y cancelado.</p>
                <div class="ops-actions">
                    ${hasPermission('Pedidos', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo pedido</button>' : ''}
                    <a class="btn btn-outline" href="farmacias.html"><i class="fas fa-hospital"></i> Ver farmacias</a>
                </div>
            </div>
        </section>

        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="pedidos-search" placeholder="Buscar por farmacia o pedido" oninput="renderPedidosView()">
            </div>
            <select class="form-control" id="filter-farmacia" onchange="renderPedidosView()" style="max-width:240px;">
                <option value="">Todas las farmacias</option>
                ${farmaciasList.map(f => `<option value="${f.id_farmacia}">${escapeHtml(f.nombre)}</option>`).join('')}
            </select>
            <select class="form-control" id="filter-estado" onchange="renderPedidosView()" style="max-width:210px;">
                <option value="">Todos los estados</option>
                ${estadosPedido.map(e => `<option value="${e.clave}">${escapeHtml(e.nombre_estado)}</option>`).join('')}
            </select>
            <div class="pedidos-view-toggle">
                <button class="toggle-btn active" data-mode="kanban" onclick="togglePedidosView('kanban')"><i class="fas fa-columns"></i> Kanban</button>
                <button class="toggle-btn" data-mode="tabla" onclick="togglePedidosView('tabla')"><i class="fas fa-list"></i> Tabla</button>
            </div>
            <div class="pedidos-order-toggle" title="Ordenar por ID">
                <button class="toggle-btn ${pedidosSortOrder === 'asc' ? 'active' : ''}" onclick="togglePedidosSort('asc')"><i class="fas fa-sort-numeric-up"></i></button>
                <button class="toggle-btn ${pedidosSortOrder === 'desc' ? 'active' : ''}" onclick="togglePedidosSort('desc')"><i class="fas fa-sort-numeric-down"></i></button>
            </div>
            <div class="kanban-limit-selector" id="kanban-limit-selector" style="${kanbanViewMode === 'tabla' ? 'display:none;' : ''}">
                <select class="form-control form-control-sm" id="kanban-card-limit" onchange="setKanbanCardLimit(this.value)" style="width:auto;">
                    <option value="5" ${kanbanCardLimit === 5 ? 'selected' : ''}>5</option>
                    <option value="10" ${kanbanCardLimit === 10 ? 'selected' : ''}>10</option>
                    <option value="20" ${kanbanCardLimit === 20 ? 'selected' : ''}>20</option>
                    <option value="all" ${kanbanCardLimit === null ? 'selected' : ''}>Todas</option>
                </select>
            </div>
            <div class="table-page-size-selector" id="table-page-size-selector" style="${kanbanViewMode === 'kanban' ? 'display:none;' : ''}">
                <select class="form-control form-control-sm" id="table-page-size" onchange="setPedidosPageSize(this.value)" style="width:auto;">
                    ${pageSizes.map(s => `<option value="${s}" ${pedidosPagination.pageSize === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
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
        ${renderViewModal()}
        ${renderEstadoModal()}
    `;

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
            <div class="modal" style="max-width:720px;">
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
                        <div class="form-row">
                            <div class="form-group">
                                <label>Subtotal (Bs)</label>
                                <input type="number" id="f-subtotal" class="form-control" step="0.01" min="0" value="0" oninput="recalcPedidoTotal()">
                            </div>
                            <div class="form-group">
                                <label>Descuento (Bs)</label>
                                <input type="number" id="f-descuento" class="form-control" step="0.01" min="0" value="0" oninput="recalcPedidoTotal()">
                            </div>
                            <div class="form-group">
                                <label>Total (Bs)</label>
                                <input type="number" id="f-total" class="form-control" step="0.01" min="0" value="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="f-observaciones" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Pedido en PDF</label>
                            <div class="pdf-upload-row">
                                <input type="file" id="f-archivo" class="form-control" accept=".pdf">
                            </div>
                            <div id="extract-status" class="text-muted" style="font-size:12px;margin-top:6px;">Adjunta el PDF del pedido si corresponde.</div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="save()">Guardar pedido</button>
                </div>
            </div>
        </div>
    `;
}

function renderViewModal() {
    return `
        <div id="view-modal" class="modal-overlay">
            <div class="modal" style="max-width:720px;">
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
                            ${estadosPedido.map(e => `<option value="${e.clave}">${escapeHtml(e.nombre_estado)}</option>`).join('')}
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

async function refreshPedidos(silent = false, renderToken = pedidosRenderToken) {
    try {
        const d = await apiFetch('/pedidos?per_page=-1');
        if (renderToken !== pedidosRenderToken) return;
        pedidosData = Array.isArray(d) ? d : (d.data || []);
        renderPedidosView();
    } catch (e) {
        if (renderToken !== pedidosRenderToken) return;
        pedidosData = [];
        renderPedidosView();
        if (!silent) Swal.fire('Error', 'Error al cargar pedidos: ' + (e.message || 'sin detalle'), 'error');
    }
}

function renderPedidosView() {
    const kanban = document.getElementById('pedidos-kanban');
    const tabla = document.getElementById('pedidos-table-section');

    // Guardas contra renderizados póstumos: esta función también se dispara
    // desde oninput/onchange de controles que pueden ya no existir.
    if (!kanban || !tabla) return;

    const filtered = getFilteredPedidos();
    if (kanbanViewMode === 'tabla') {
        kanban.style.display = 'none';
        tabla.style.display = '';
        renderPedidosList(filtered);
    } else {
        kanban.style.display = '';
        tabla.style.display = 'none';
        renderKanban(filtered);
    }
}

function getFilteredPedidos() {
    const search = normalize(document.getElementById('pedidos-search')?.value || '');
    const farmaciaId = document.getElementById('filter-farmacia')?.value || '';
    const estadoId = document.getElementById('filter-estado')?.value || '';

    const filtered = pedidosData.filter(p => {
        const farmacia = p.farmacia?.nombre || getFarmaciaName(p.id_farmacia);
        const text = normalize(`${p.id_pedido} ${farmacia} ${getEstadoName(p)}`);
        if (search && !text.includes(search)) return false;
        if (farmaciaId && String(p.id_farmacia || p.farmacia?.id_farmacia || '') !== String(farmaciaId)) return false;
        if (estadoId) {
            const pedidoEstadoKey = p.estado?.clave || p.clave || p.estado;
            const pedidoEstadoId = p.id_estado_pedido || p.estado?.id_estado_pedido;
            // Comparar tanto por clave de texto como por ID numérico
            if (String(pedidoEstadoKey) !== String(estadoId) && String(pedidoEstadoId) !== String(estadoId)) return false;
        }
        return true;
    });

    // Ordenar por ID
    filtered.sort((a, b) => {
        const diff = (a.id_pedido || 0) - (b.id_pedido || 0);
        return pedidosSortOrder === 'asc' ? diff : -diff;
    });

    return filtered;
}

function renderKanban(pedidos) {
    const container = document.getElementById('pedidos-kanban');
    if (!container) return;
    const columns = buildKanbanColumns();
    container.innerHTML = columns.map(col => {
        let items = pedidos.filter(p => getColumnKey(p) === col.key);
        const totalInColumn = items.length;
        if (kanbanCardLimit && items.length > kanbanCardLimit) {
            items = items.slice(0, kanbanCardLimit);
        }
        return `
            <div class="kanban-column" data-column="${col.key}">
                <div class="kanban-column-header">
                    <span><i class="fas ${col.icon}"></i> ${col.title}</span>
                    <span class="count">${totalInColumn}</span>
                </div>
                <div class="kanban-column-body" data-column="${col.key}">
                    ${items.length ? items.map(renderPedidoCard).join('') : '<div class="empty-state compact">Sin pedidos</div>'}
                    ${kanbanCardLimit && totalInColumn > kanbanCardLimit ? `
                        <button class="btn btn-sm btn-link expand-col-btn" onclick="expandKanbanColumn('${col.key}')" style="margin-top:8px;width:100%;">
                            Ver ${totalInColumn - kanbanCardLimit} restantes
                        </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    setTimeout(initPedidosSortable, 50);
}

function expandKanbanColumn(columnKey) {
    kanbanCardLimit = null;
    localStorage.setItem('kanbanCardLimit', 'all');
    renderPedidosView();
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

    // Paginación
    const page = pedidosPagination.page;
    const pageSize = pedidosPagination.pageSize;
    const totalPages = Math.ceil(pedidos.length / pageSize) || 1;
    pedidosPagination.totalPages = totalPages;
    if (page > totalPages) { pedidosPagination.page = totalPages; return renderPedidosList(pedidos); }
    const start = (page - 1) * pageSize;
    const pageItems = pedidos.slice(start, start + pageSize);

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Farmacia</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageItems.map(p => `
                        <tr>
                            <td><strong>#${p.id_pedido}</strong></td>
                            <td>${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</td>
                            <td>${getStatusBadge(getEstadoName(p))}</td>
                            <td>Bs ${money(p.total)}</td>
                            <td>${formatDateShort(p.fecha_pedido || p.created_at)}</td>
                            <td><div class="actions">${renderPedidoActions(p)}</div></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(page, totalPages, 'goPedidosPage', pageSize, 'setPedidosPageSize')}
    `;
}

function goPedidosPage(newPage) {
    pedidosPagination.page = newPage;
    renderPedidosView();
}

function setPedidosPageSize(size) {
    pedidosPagination.pageSize = parseInt(size);
    pedidosPagination.page = 1;
    localStorage.setItem('pedidosPageSize', size);
    renderPedidosView();
}

function renderPedidoCard(p) {
    return `
        <article class="order-card" data-pedido-id="${p.id_pedido}" data-estado="${getColumnKey(p)}">
            <div class="order-card-top">
                <strong>#${p.id_pedido}</strong>
                ${getStatusBadge(getEstadoName(p))}
            </div>
            <h4>${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</h4>
            <div class="order-meta">
                <span><i class="fas fa-coins"></i> Bs ${money(p.total)}</span>
                <span><i class="fas fa-calendar"></i> ${formatDateShort(p.fecha_pedido || p.created_at)}</span>
            </div>
            <div class="card-actions">${renderPedidoActions(p)}</div>
        </article>
    `;
}

function renderPedidoActions(p) {
    return `
        <button class="btn btn-sm btn-info" onclick="view(${p.id_pedido})" title="Ver detalle"><i class="fas fa-eye"></i></button>
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
    document.getElementById('modal-title').textContent = 'Nuevo pedido';
    document.getElementById('main-form').reset();
    document.getElementById('extract-status').textContent = 'Adjunta el PDF del pedido si corresponde.';
    document.getElementById('estado-field-container').style.display = 'none';
    document.getElementById('estado-field-container').innerHTML = '';
    document.getElementById('f-subtotal').value = 0;
    document.getElementById('f-descuento').value = 0;
    document.getElementById('f-total').value = 0;
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
    document.getElementById('main-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('main-modal').classList.remove('active');
    editingId = null;
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

function recalcPedidoTotal() {
    const subtotal = parseMoney(document.getElementById('f-subtotal')?.value);
    const descuento = parseMoney(document.getElementById('f-descuento')?.value);
    const totalEl = document.getElementById('f-total');
    if (totalEl) totalEl.value = Math.max(0, subtotal - descuento).toFixed(2);
}

async function view(id) {
    try {
        const p = await fetchPedido(id);
        document.getElementById('view-body').innerHTML = `
            <div class="info-grid">
                <div><strong>Pedido:</strong> #${p.id_pedido}</div>
                <div><strong>Farmacia:</strong> ${escapeHtml(p.farmacia?.nombre || getFarmaciaName(p.id_farmacia))}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(getEstadoName(p))}</div>
                <div><strong>Fecha:</strong> ${formatDate(p.fecha_pedido || p.created_at)}</div>
                <div><strong>Subtotal:</strong> Bs ${money(p.subtotal)}</div>
                <div><strong>Descuento:</strong> Bs ${money(p.descuento)}</div>
                <div><strong>Total:</strong> Bs ${money(p.total)}</div>
                <div style="grid-column:1/-1;"><strong>Observaciones:</strong> ${escapeHtml(p.observaciones || 'Sin observaciones')}</div>
                <div style="grid-column:1/-1;"><strong>PDF:</strong> ${p.archivo_pedido ? `<button class="btn btn-sm btn-info" onclick="downloadFile(${p.id_pedido})"><i class="fas fa-file-pdf"></i> Ver PDF</button>` : 'Sin archivo'}</div>
            </div>
        `;
        document.getElementById('view-modal').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el pedido', 'error');
    }
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
                    ${estadosPedido.map(e => `<option value="${e.clave}" ${String(e.clave) === String(p.estado?.clave || p.clave || p.estado) ? 'selected' : ''}>${escapeHtml(e.nombre_estado)}</option>`).join('')}
                </select>
            </div>
        `;
        document.getElementById('f-subtotal').value = money(p.subtotal);
        document.getElementById('f-descuento').value = money(p.descuento);
        document.getElementById('f-total').value = money(p.total);
        document.getElementById('f-observaciones').value = p.observaciones || '';
        document.getElementById('extract-status').textContent = p.archivo_pedido ? `Archivo actual: ${p.archivo_pedido.split('/').pop()}` : 'Puedes subir un PDF nuevo si corresponde.';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el pedido', 'error');
    }
}

async function save() {
    const farmaciaId = document.getElementById('f-farmacia')?.value;
    const estadoEl = document.getElementById('f-estado');
    const estado = estadoEl ? estadoEl.value : undefined;
    const observaciones = document.getElementById('f-observaciones').value.trim();
    const subtotal = parseMoney(document.getElementById('f-subtotal')?.value);
    const descuento = parseMoney(document.getElementById('f-descuento')?.value);
    let total = parseMoney(document.getElementById('f-total')?.value);
    if (!total) total = Math.max(0, subtotal - descuento);

    if (!farmaciaId) return Swal.fire('Validacion', 'Seleccione una farmacia', 'warning');

    const body = {
        id_farmacia: farmaciaId,
        observaciones,
        subtotal,
        descuento,
        total,
    };
    if (editingId && estado) body.estado = estado;

    try {
        let pedidoId = editingId;
        if (editingId) {
            await apiFetch(`/pedidos/${editingId}`, { method: 'PUT', body });
            await uploadFile(editingId);
            Swal.fire('Actualizado', 'Pedido actualizado', 'success');
        } else {
            const resp = await apiFetch('/pedidos', { method: 'POST', body });
            pedidoId = resp.data?.id_pedido || resp.pedido?.id_pedido || resp.id_pedido;
            if (!pedidoId) throw new Error('La API no devolvio el ID del pedido creado.');
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
    const estado = document.getElementById('s-estado').value;
    if (!estado) return Swal.fire('Validacion', 'Seleccione un estado', 'warning');
    try {
        await apiFetch(`/pedidos/${estadoPedidoId}/cambiar-estado`, { method: 'POST', body: { estado } });
        Swal.fire('Actualizado', 'Estado cambiado correctamente', 'success');
        closeEstadoModal();
        await refreshPedidos(true);
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al cambiar estado', 'error');
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

function getEstadoName(p) {
    return estadoLabel(p.estado) || estadoLabel(p.nombre_estado) || 'Pendiente';
}

function getColumnKey(p) {
    const status = normalize(getEstadoName(p));
    if (status.includes('cancel')) return 'cancelado';
    if (status.includes('ruta') || status.includes('despach')) return 'en_ruta';
    if (status.includes('entreg') || status.includes('complet')) return 'entregado';
    return 'pendiente';
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
    const limitSelector = document.getElementById('kanban-limit-selector');
    const pageSizeSelector = document.getElementById('table-page-size-selector');
    if (limitSelector) limitSelector.style.display = mode === 'tabla' ? 'none' : '';
    if (pageSizeSelector) pageSizeSelector.style.display = mode === 'kanban' ? 'none' : '';
    renderPedidosView();
}

function togglePedidosSort(order) {
    pedidosSortOrder = order;
    localStorage.setItem('pedidosSortOrder', order);
    document.querySelectorAll('.pedidos-order-toggle .toggle-btn').forEach(btn => {
        const isAsc = btn.onclick.toString().includes("'asc'");
        btn.classList.toggle('active', (order === 'asc' && isAsc) || (order === 'desc' && !isAsc));
    });
    renderPedidosView();
}

function setKanbanCardLimit(value) {
    kanbanCardLimit = value === 'all' ? null : parseInt(value);
    localStorage.setItem('kanbanCardLimit', value);
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
    // newStatusKey ya es la clave de texto del estado (p.ej. 'en_ruta')
    // Pedido::resolverEstado() acepta tanto clave como id numérico
    const estado = newStatusKey;
    if (!estado) return;
    try {
        await apiFetch(`/pedidos/${pedidoId}/cambiar-estado`, {
            method: 'POST',
            body: { estado }
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
            </div>
        `).join(''),
        confirmButtonText: 'Cerrar',
        width: 420,
    });
}
