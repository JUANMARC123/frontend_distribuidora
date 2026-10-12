let historialTab = 'pedidos';
let historialData = { pedidos: [], despachos: [], controles: [] };
let historialMapa = null;
let historialMapaMarkers = [];
let historialMapaLinea = null;

const ESTADO_PEDIDO_ENTREGADO = 4;
const ESTADO_PEDIDO_CANCELADO = 5;

let historialFarmaciaMap = new Map();
let historialPedidosPage = 1;
const HISTORIAL_PAGE_SIZE = 50;

document.addEventListener('DOMContentLoaded', async function () {
    if (document.getElementById('logistica-content')) return;
    if (!checkAuth()) return;
    if (!hasPermission('Logistica', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    initHistorialModule();
});

function initHistorialModule(containerId = 'page-content') {
    renderPage(containerId);
    loadTab('pedidos');
}

function renderPage(containerId = 'page-content') {
    const pageContainer = document.getElementById(containerId);
    if (!pageContainer) return;
    pageContainer.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <div class="ops-kicker">Auditoria y trazabilidad</div>
                <h1 class="ops-title">Historial</h1>
                <p class="ops-subtitle">Pedidos finalizados, rutas completadas y trazabilidad de cambios.</p>
            </div>
            <div class="ops-actions">
                <button class="btn btn-outline" onclick="refreshCurrentTab()"><i class="fas fa-rotate"></i> Actualizar</button>
            </div>
        </section>
        <div class="historial-tabs">
            <button class="historial-tab active" data-tab="pedidos" onclick="switchHistorialTab('pedidos')">
                <i class="fas fa-box"></i> Pedidos
            </button>
            <button class="historial-tab" data-tab="rutas" onclick="switchHistorialTab('rutas')">
                <i class="fas fa-route"></i> Rutas / Despachos
            </button>
            <button class="historial-tab" data-tab="logs" onclick="switchHistorialTab('logs')">
                <i class="fas fa-list-timeline"></i> Historial de cambios
            </button>
        </div>
        <div id="historial-content"></div>
        <div id="historial-drawer-overlay" class="drawer-overlay" onclick="closeHistorialDrawer()"></div>
        <div id="historial-drawer" class="historial-drawer"></div>
    `;
}

function switchHistorialTab(tab) {
    historialTab = tab;
    document.querySelectorAll('.historial-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    closeHistorialDrawer();
    loadTab(tab);
}

function refreshCurrentTab() {
    loadTab(historialTab);
}

async function loadTab(tab) {
    const container = document.getElementById('historial-content');
    if (!container) return;

    if (tab === 'pedidos') {
        await loadPedidosTab(container);
    } else if (tab === 'rutas') {
        await loadRutasTab(container);
    } else if (tab === 'logs') {
        loadLogsTab(container);
    }
}

/* ══════════════════════════════════════════════════════════════
   TAB A — HISTORIAL DE PEDIDOS
   ══════════════════════════════════════════════════════════════ */

async function loadPedidosTab(container) {
    container.innerHTML = `
        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="historial-pedidos-search" placeholder="Buscar pedido, farmacia o monto" oninput="filterPedidosTable()">
            </div>
            <select class="form-control" id="historial-pedidos-estado" onchange="filterPedidosTable()" style="max-width:200px;">
                <option value="">Todos los estados</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
            </select>
        </section>
        <section class="ops-panel">
            <div class="card-header">
                <h3><i class="fas fa-box"></i> Pedidos finalizados</h3>
                <span class="text-muted" id="historial-pedidos-count"></span>
            </div>
            <div class="card-body" id="historial-pedidos-body">
                <div class="loading"><div class="spinner"></div>Cargando historial...</div>
            </div>
        </section>
    `;

    try {
        const d = await apiFetch('/pedidos?per_page=200');
        historialData.pedidos = Array.isArray(d) ? d : (d.data || []);
        historialFarmaciaMap = buildFarmaciaMap(historialData.pedidos);
        historialPedidosPage = 1;
        renderPedidosTable();
    } catch (e) {
        document.getElementById('historial-pedidos-body').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(e.message || 'No se pudieron cargar los pedidos')}</p></div>`;
    }
}

function renderPedidosTable() {
    const container = document.getElementById('historial-pedidos-body');
    const counter = document.getElementById('historial-pedidos-count');
    if (!container) return;

    const finalizados = historialData.pedidos.filter(p => {
        const est = normalizeHistorial(p.estado?.nombre_estado || p.nombre_estado || p.estado || '');
        return est.includes('entreg') || est.includes('cancel');
    });

    if (counter) counter.textContent = `${finalizados.length} pedidos`;

    if (!finalizados.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h4>Sin historial</h4><p>Aun no hay pedidos finalizados o cancelados.</p></div>';
        return;
    }

    const page = historialPedidosPage;
    const totalPages = Math.ceil(finalizados.length / HISTORIAL_PAGE_SIZE);
    const start = (page - 1) * HISTORIAL_PAGE_SIZE;
    const pageItems = finalizados.slice(start, start + HISTORIAL_PAGE_SIZE);

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table" id="historial-pedidos-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Farmacia</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Estado final</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageItems.map(p => `
                        <tr class="clickable-row" onclick="openPedidoDrawer(${p.id_pedido})">
                            <td><strong>#${p.id_pedido}</strong></td>
                            <td>${escapeHtml(p.farmacia?.nombre || getFarmaciaNameHistorial(p.id_farmacia))}</td>
                            <td>Bs ${parseMoneyHistorial(p.total).toFixed(2)}</td>
                            <td>${formatDateShort(p.fecha_pedido || p.created_at)}</td>
                            <td>${getStatusBadge(getEstadoNameHistorial(p))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${totalPages > 1 ? `
        <div class="pagination-bar" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;gap:8px;">
            <button class="btn btn-sm btn-outline" onclick="historialPedidosPage--;renderPedidosTable();" ${page <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="text-muted">Pagina ${page} de ${totalPages} (${finalizados.length} registros)</span>
            <button class="btn btn-sm btn-outline" onclick="historialPedidosPage++;renderPedidosTable();" ${page >= totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        </div>` : ''}
    `;
}

function filterPedidosTable() {
    historialPedidosPage = 1;
    const search = normalizeHistorial(document.getElementById('historial-pedidos-search')?.value || '');
    const estado = document.getElementById('historial-pedidos-estado')?.value || '';

    const filtered = historialData.pedidos.filter(p => {
        const est = normalizeHistorial(p.estado?.nombre_estado || p.nombre_estado || p.estado || '');
        if (!est.includes('entreg') && !est.includes('cancel')) return false;
        if (estado && !est.includes(estado)) return false;
        if (search) {
            const text = normalizeHistorial(`${p.id_pedido} ${p.farmacia?.nombre || ''} ${p.total || ''}`);
            if (!text.includes(search)) return false;
        }
        return true;
    });

    const container = document.getElementById('historial-pedidos-body');
    const counter = document.getElementById('historial-pedidos-count');
    if (counter) counter.textContent = `${filtered.length} pedidos`;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h4>Sin resultados</h4><p>No hay pedidos con esos criterios.</p></div>';
        return;
    }

    const page = historialPedidosPage;
    const totalPages = Math.ceil(filtered.length / HISTORIAL_PAGE_SIZE);
    const start = (page - 1) * HISTORIAL_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + HISTORIAL_PAGE_SIZE);

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Farmacia</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Estado final</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageItems.map(p => `
                        <tr class="clickable-row" onclick="openPedidoDrawer(${p.id_pedido})">
                            <td><strong>#${p.id_pedido}</strong></td>
                            <td>${escapeHtml(p.farmacia?.nombre || getFarmaciaNameHistorial(p.id_farmacia))}</td>
                            <td>Bs ${parseMoneyHistorial(p.total).toFixed(2)}</td>
                            <td>${formatDateShort(p.fecha_pedido || p.created_at)}</td>
                            <td>${getStatusBadge(getEstadoNameHistorial(p))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${totalPages > 1 ? `
        <div class="pagination-bar" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;gap:8px;">
            <button class="btn btn-sm btn-outline" onclick="historialPedidosPage--;filterPedidosTable();" ${page <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="text-muted">Pagina ${page} de ${totalPages} (${filtered.length} registros)</span>
            <button class="btn btn-sm btn-outline" onclick="historialPedidosPage++;filterPedidosTable();" ${page >= totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        </div>` : ''}
    `;
}

async function openPedidoDrawer(pedidoId) {
    const drawer = document.getElementById('historial-drawer');
    const overlay = document.getElementById('historial-drawer-overlay');
    if (!drawer) return;

    drawer.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando detalle...</div>';
    drawer.classList.add('open');
    overlay.classList.add('active');

    try {
        const d = await apiFetch(`/pedidos/${pedidoId}`);
        const pedido = d.pedido || d.data || d;
        const detalles = pedido.detalles || [];
        const totalSolicitado = detalles.reduce((s, d) => s + (parseMoneyHistorial(d.cantidad_solicitada) * parseMoneyHistorial(d.precio_unitario)), 0) || parseMoneyHistorial(pedido.total);
        const totalEntregado = detalles.reduce((s, d) => s + (Math.min(parseMoneyHistorial(d.cantidad_entregada), parseMoneyHistorial(d.cantidad_solicitada)) * parseMoneyHistorial(d.precio_unitario)), 0);

        drawer.innerHTML = `
            <div class="historial-drawer-header">
                <h3>Pedido #${pedido.id_pedido}</h3>
                <button class="modal-close" onclick="closeHistorialDrawer()">&times;</button>
            </div>
            <div class="historial-drawer-body">
                <div class="info-grid">
                    <div><strong>Farmacia:</strong> ${escapeHtml(pedido.farmacia?.nombre || getFarmaciaNameHistorial(pedido.id_farmacia))}</div>
                    <div><strong>Estado:</strong> ${getStatusBadge(getEstadoNameHistorial(pedido))}</div>
                    <div><strong>Fecha:</strong> ${formatDate(pedido.fecha_pedido || pedido.created_at)}</div>
                    <div><strong>Total:</strong> Bs ${parseMoneyHistorial(pedido.total).toFixed(2)}</div>
                    <div><strong>Entregado:</strong> Bs ${totalEntregado.toFixed(2)}</div>
                    <div><strong>Faltante:</strong> Bs ${(totalSolicitado - totalEntregado).toFixed(2)}</div>
                </div>
                ${pedido.observaciones ? `<div class="historial-section"><strong>Observaciones:</strong><p>${escapeHtml(pedido.observaciones)}</p></div>` : ''}
                ${pedido.despacho ? `
                <div class="historial-section">
                    <h4><i class="fas fa-truck"></i> Despacho asociado</h4>
                    <div class="info-grid">
                        <div><strong>Despacho:</strong> #${pedido.despacho.id_despacho}</div>
                        <div><strong>Repartidor:</strong> ${escapeHtml(pedido.despacho.repartidor?.nombre || '—')}</div>
                        <div><strong>Hora despacho:</strong> ${formatDateTime(pedido.despacho.fecha_hora_despacho)}</div>
                        <div><strong>Hora entrega:</strong> ${pedido.despacho.fecha_entrega ? formatDateTime(pedido.despacho.fecha_entrega) : '—'}</div>
                    </div>
                </div>` : ''}
                <div class="historial-section">
                    <h4>Productos</h4>
                    ${detalles.length ? `
                        <table class="product-detail-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Solicitado</th>
                                    <th>Entregado</th>
                                    <th>Precio</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detalles.map(d => {
                                    const sol = parseMoneyHistorial(d.cantidad_solicitada);
                                    const ent = parseMoneyHistorial(d.cantidad_entregada);
                                    const pr = parseMoneyHistorial(d.precio_unitario);
                                    return `<tr>
                                        <td>${escapeHtml(d.producto?.nombre || '—')}</td>
                                        <td>${sol}</td>
                                        <td>${ent}</td>
                                        <td>Bs ${pr.toFixed(2)}</td>
                                        <td>Bs ${(Math.min(ent, sol) * pr).toFixed(2)}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted">Sin productos registrados.</p>'}
                </div>
            </div>
        `;
    } catch (e) {
        drawer.innerHTML = `
            <div class="historial-drawer-header">
                <h3>Error</h3>
                <button class="modal-close" onclick="closeHistorialDrawer()">&times;</button>
            </div>
            <div class="historial-drawer-body">
                <div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(e.message || 'No se pudo cargar el detalle')}</p></div>
            </div>
        `;
    }
}

function closeHistorialDrawer() {
    const drawer = document.getElementById('historial-drawer');
    const overlay = document.getElementById('historial-drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

/* ══════════════════════════════════════════════════════════════
   TAB B — HISTORIAL DE RUTAS / DESPACHOS
   ══════════════════════════════════════════════════════════════ */

async function loadRutasTab(container) {
    container.innerHTML = `
        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="historial-rutas-search" placeholder="Buscar por repartidor o codigo de ruta" oninput="filterRutasTable()">
            </div>
        </section>
        <section class="historial-rutas-layout">
            <div class="ops-panel" style="overflow:auto;">
                <div class="card-header">
                    <h3><i class="fas fa-route"></i> Rutas y despachos</h3>
                    <span class="text-muted" id="historial-rutas-count"></span>
                </div>
                <div class="card-body" id="historial-rutas-body">
                    <div class="loading"><div class="spinner"></div>Cargando historial...</div>
                </div>
            </div>
            <div class="ops-panel" id="historial-ruta-mapa-panel" style="display:none;">
                <div class="card-header">
                    <h3><i class="fas fa-map"></i> Ruta historica</h3>
                    <span class="text-muted" id="historial-ruta-selected"></span>
                </div>
                <div class="card-body" style="padding:0;">
                    <div id="historial-ruta-mapa" style="height:400px;"></div>
                    <div id="historial-ruta-paradas" style="padding:12px;max-height:200px;overflow-y:auto;"></div>
                </div>
            </div>
        </section>
    `;

    try {
        const [despachos, controles] = await Promise.all([
            apiFetch('/despachos?per_page=100').catch(() => []),
            apiFetch('/controles-ruta?per_page=100').catch(() => []),
        ]);
        historialData.despachos = Array.isArray(despachos) ? despachos : (despachos.data || []);
        historialData.controles = Array.isArray(controles) ? controles : (controles.data || []);
        renderRutasTable();
    } catch (e) {
        document.getElementById('historial-rutas-body').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(e.message || 'No se pudieron cargar los datos')}</p></div>`;
    }
}

function renderRutasTable() {
    const container = document.getElementById('historial-rutas-body');
    const counter = document.getElementById('historial-rutas-count');
    if (!container) return;

    const items = buildRutasList();
    if (counter) counter.textContent = `${items.length} registros`;

    if (!items.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-route"></i><h4>Sin historial</h4><p>No hay rutas o despachos registrados.</p></div>';
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Pedido</th>
                        <th>Ruta</th>
                        <th>Repartidor</th>
                        <th>Hora salida</th>
                        <th>Hora llegada</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => `
                        <tr>
                            <td><span class="badge ${item.tipo === 'Ruta' ? 'badge-info' : 'badge-primary'}">${item.tipo}</span></td>
                            <td><strong>${item.ref}</strong></td>
                            <td><strong>${item.pedidoRef || '—'}</strong></td>
                            <td>${escapeHtml(item.rutaNombre || '—')}</td>
                            <td>${escapeHtml(item.repartidor || '—')}</td>
                            <td>${item.horaSalida || '—'}</td>
                            <td>${item.horaLlegada || '—'}</td>
                            <td>${getStatusBadge(item.estado)}</td>
                            <td>
                                ${item._tipo === 'despacho'
                                    ? `<button class="btn btn-sm btn-outline" onclick="openDespachoDrawer(${item._data.id_despacho})">
                                        <i class="fas fa-clipboard-list"></i> Ver detalle
                                    </button>`
                                    : `<button class="btn btn-sm btn-outline" onclick="showRutaMapa(${idx})">
                                        <i class="fas fa-map"></i> Ver ruta
                                    </button>`
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function buildRutasList() {
    const items = [];

    historialData.controles.forEach(c => {
        items.push({
            tipo: 'Ruta',
            ref: `Control #${c.id_control_ruta}`,
            repartidor: c.repartidor?.nombre || '',
            vehiculo: c.vehiculo?.placa || '',
            estado: c.estado?.nombre_estado || c.estado || 'Completado',
            fecha: c.fecha_salida || c.hora_salida || c.created_at,
            _data: c,
            _tipo: 'control',
        });
    });

    historialData.despachos.forEach(d => {
        const pedido = d.pedido || {};
        const controlRuta = d.control_ruta || {};
        items.push({
            tipo: 'Despacho',
            ref: `Despacho #${d.id_despacho}`,
            pedidoRef: pedido.id_pedido ? `#${pedido.id_pedido}` : (d.id_pedido ? `#${d.id_pedido}` : '—'),
            rutaNombre: controlRuta.ruta?.nombre_ruta || d.nombre_ruta || '—',
            repartidor: d.repartidor?.nombre || '',
            vehiculo: d.vehiculo?.placa || '',
            horaSalida: d.fecha_hora_despacho ? formatDateTime(d.fecha_hora_despacho) : '—',
            horaLlegada: d.fecha_entrega ? formatDateTime(d.fecha_entrega) : '—',
            estado: d.estado?.nombre_estado || d.estado || 'Finalizado',
            fecha: d.fecha_despacho || d.created_at,
            _data: d,
            _tipo: 'despacho',
        });
    });

    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return items;
}

function filterRutasTable() {
    const search = normalizeHistorial(document.getElementById('historial-rutas-search')?.value || '');
    const allItems = buildRutasList();
    const filtered = search ? allItems.filter(i => {
        const text = normalizeHistorial(`${i.ref} ${i.repartidor} ${i.vehiculo} ${i.estado}`);
        return text.includes(search);
    }) : allItems;

    const container = document.getElementById('historial-rutas-body');
    const counter = document.getElementById('historial-rutas-count');
    if (counter) counter.textContent = `${filtered.length} registros`;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-route"></i><h4>Sin resultados</h4><p>No hay registros con ese criterio.</p></div>';
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="product-detail-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Pedido</th>
                        <th>Ruta</th>
                        <th>Repartidor</th>
                        <th>Hora salida</th>
                        <th>Hora llegada</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map((item, idx) => {
                        const originalIdx = allItems.indexOf(item);
                        return `<tr>
                            <td><span class="badge ${item.tipo === 'Ruta' ? 'badge-info' : 'badge-primary'}">${item.tipo}</span></td>
                            <td><strong>${item.ref}</strong></td>
                            <td><strong>${item.pedidoRef || '—'}</strong></td>
                            <td>${escapeHtml(item.rutaNombre || '—')}</td>
                            <td>${escapeHtml(item.repartidor || '—')}</td>
                            <td>${item.horaSalida || '—'}</td>
                            <td>${item.horaLlegada || '—'}</td>
                            <td>${getStatusBadge(item.estado)}</td>
                            <td>
                                ${item._tipo === 'despacho'
                                    ? `<button class="btn btn-sm btn-outline" onclick="openDespachoDrawer(${item._data.id_despacho})">
                                        <i class="fas fa-clipboard-list"></i> Ver detalle
                                    </button>`
                                    : `<button class="btn btn-sm btn-outline" onclick="showRutaMapa(${originalIdx})">
                                        <i class="fas fa-map"></i> Ver ruta
                                    </button>`
                                }
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function showRutaMapa(idx) {
    const items = buildRutasList();
    const item = items[idx];
    if (!item) return;

    const panel = document.getElementById('historial-ruta-mapa-panel');
    const label = document.getElementById('historial-ruta-selected');
    if (panel) panel.style.display = '';
    if (label) label.textContent = item.ref;

    const paradasContainer = document.getElementById('historial-ruta-paradas');
    if (paradasContainer) {
        if (item._tipo === 'control') {
            paradasContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando paradas...</div>';
        } else {
            paradasContainer.innerHTML = '<p class="text-muted">Sin datos de ruta para este despacho.</p>';
        }
    }

    const mapContainer = document.getElementById('historial-ruta-mapa');
    if (!mapContainer) return;

    if (historialMapa) {
        historialMapa.remove();
        historialMapa = null;
    }
    historialMapaMarkers = [];
    historialMapaLinea = null;

    historialMapa = L.map('historial-ruta-mapa').setView([-16.4897, -67.8217], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(historialMapa);

    setTimeout(() => historialMapa.invalidateSize(), 200);

    if (item._tipo === 'control') {
        await loadRutaParadasMapa(item._data.id_control_ruta);
    }
}

async function loadRutaParadasMapa(controlId) {
    try {
        const d = await apiFetch(`/controles-ruta/${controlId}`);
        const control = d.control_ruta || d.data || d;
        const paradas = control.paradas || control.despachos || [];

        const paradasContainer = document.getElementById('historial-ruta-paradas');

        const coords = [];
        paradas.forEach((p, idx) => {
            const lat = parseFloat(p.latitud || p.farmacia?.latitud);
            const lng = parseFloat(p.longitud || p.farmacia?.longitud);
            if (isNaN(lat) || isNaN(lng)) return;

            coords.push([lat, lng]);
            const estado = normalizeHistorial(p.estado?.nombre_estado || p.estado || '');
            const color = estado.includes('entreg') ? '#10b981'
                : estado.includes('fall') || estado.includes('cancel') ? '#ef4444'
                : '#64748b';

            const marker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9,
            }).addTo(historialMapa);
            marker.bindPopup(`<b>${escapeHtml(p.farmacia?.nombre || p.nombre_farmacia || 'Parada')}</b><br>Estado: ${escapeHtml(estado || 'Pendiente')}`);
            historialMapaMarkers.push(marker);
        });

        if (coords.length > 1) {
            historialMapaLinea = L.polyline(coords, {
                color: '#64748b',
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 8',
            }).addTo(historialMapa);
            historialMapa.fitBounds(historialMapaLinea.getBounds(), { padding: [40, 40], animate: false });
        } else if (coords.length === 1) {
            historialMapa.setView(coords[0], 14);
        }

        if (paradasContainer) {
            if (!paradas.length) {
                paradasContainer.innerHTML = '<p class="text-muted">Sin paradas registradas para esta ruta.</p>';
            } else {
                paradasContainer.innerHTML = paradas.map((p, idx) => {
                    const est = normalizeHistorial(p.estado?.nombre_estado || p.estado || 'Pendiente');
                    const icon = est.includes('entreg') ? 'fa-check-circle' : est.includes('fall') || est.includes('cancel') ? 'fa-times-circle' : 'fa-circle';
                    const color = est.includes('entreg') ? '#10b981' : est.includes('fall') || est.includes('cancel') ? '#ef4444' : '#64748b';
                    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                        <i class="fas ${icon}" style="color:${color};width:16px;"></i>
                        <span>${idx + 1}. ${escapeHtml(p.farmacia?.nombre || p.nombre_farmacia || 'Parada')}</span>
                        <span class="text-muted" style="margin-left:auto;">${escapeHtml(est)}</span>
                    </div>`;
                }).join('');
            }
        }
    } catch (e) {
        const paradasContainer = document.getElementById('historial-ruta-paradas');
        if (paradasContainer) paradasContainer.innerHTML = `<p class="text-muted">No se pudieron cargar las paradas: ${escapeHtml(e.message || '')}</p>`;
    }
}

/* ══════════════════════════════════════════════════════════════
   DESPACHO DETAIL — INCIDENCIAS & EVIDENCIAS
   ══════════════════════════════════════════════════════════════ */

async function openDespachoDrawer(despachoId) {
    const drawer = document.getElementById('historial-drawer');
    const overlay = document.getElementById('historial-drawer-overlay');
    if (!drawer) return;

    drawer.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando detalle del despacho...</div>';
    drawer.classList.add('open');
    overlay.classList.add('active');

    try {
        const [despachoResp, incidenciasResp, evidenciasResp] = await Promise.all([
            apiFetch(`/despachos/${despachoId}`).catch(() => ({})),
            apiFetch(`/despachos/${despachoId}/incidencias`).catch(() => []),
            apiFetch(`/despachos/${despachoId}/evidencias`).catch(() => []),
        ]);

        const despacho = despachoResp.despacho || despachoResp.data || despachoResp;
        const incidencias = Array.isArray(incidenciasResp) ? incidenciasResp : (incidenciasResp.data || []);
        const evidencias = Array.isArray(evidenciasResp) ? evidenciasResp : (evidenciasResp.data || []);

        const pedidoRef = despacho.pedido ? `#${despacho.pedido.id_pedido || despacho.id_pedido}` : `#${despacho.id_pedido || '?'}`;
        const repartidorNombre = despacho.repartidor?.nombre || despacho.nombre_repartidor || '—';
        const vehiculoPlaca = despacho.vehiculo?.placa || despacho.placa_vehiculo || '—';
        const estadoNombre = despacho.estado?.nombre_estado || despacho.nombre_estado || '—';
        const fecha = formatDate(despacho.fecha_hora_despacho || despacho.fecha_despacho || despacho.created_at);

        drawer.innerHTML = `
            <div class="historial-drawer-header">
                <h3>Despacho #${despachoId}</h3>
                <button class="modal-close" onclick="closeHistorialDrawer()">&times;</button>
            </div>
            <div class="historial-drawer-body">
                <div class="info-grid">
                    <div><strong>Pedido:</strong> ${pedidoRef}</div>
                    <div><strong>Estado:</strong> ${getStatusBadge(estadoNombre)}</div>
                    <div><strong>Repartidor:</strong> ${escapeHtml(repartidorNombre)}</div>
                    <div><strong>Vehiculo:</strong> ${escapeHtml(vehiculoPlaca)}</div>
                    <div><strong>Hora salida:</strong> ${formatDateTime(despacho.fecha_hora_despacho)}</div>
                    <div><strong>Hora llegada:</strong> ${despacho.fecha_entrega ? formatDateTime(despacho.fecha_entrega) : '—'}</div>
                    <div style="grid-column:1/-1;"><strong>Farmacia:</strong> ${escapeHtml(despacho.parada?.farmacia?.nombre || despacho.nombre_farmacia || '—')}</div>
                </div>

                <div class="historial-section">
                    <h4><i class="fas fa-clock"></i> Timeline de ruta</h4>
                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-marker success"></div>
                            <div class="timeline-content">
                                <strong>Despachado</strong>
                                <span>${formatDateTime(despacho.fecha_hora_despacho)}</span>
                            </div>
                        </div>
                        ${despacho.fecha_entrega ? `
                        <div class="timeline-item">
                            <div class="timeline-marker success"></div>
                            <div class="timeline-content">
                                <strong>Entregado</strong>
                                <span>${formatDateTime(despacho.fecha_entrega)}</span>
                            </div>
                        </div>` : `
                        <div class="timeline-item">
                            <div class="timeline-marker warning"></div>
                            <div class="timeline-content">
                                <strong>Pendiente de entrega</strong>
                                <span>Sin registro de llegada</span>
                            </div>
                        </div>`}
                        ${despacho.control_ruta?.ruta?.nombre_ruta ? `
                        <div class="timeline-item">
                            <div class="timeline-marker info"></div>
                            <div class="timeline-content">
                                <strong>Ruta asignada</strong>
                                <span>${escapeHtml(despacho.control_ruta.ruta.nombre_ruta)}</span>
                            </div>
                        </div>` : ''}
                    </div>
                </div>

                <div class="historial-section">
                    <h4><i class="fas fa-exclamation-triangle"></i> Incidencias (${incidencias.length})</h4>
                    ${incidencias.length ? `
                        <div class="table-container">
                            <table class="product-detail-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Descripcion</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${incidencias.map(inc => `
                                        <tr>
                                            <td>${escapeHtml(inc.tipo?.nombre_tipo || inc.nombre_tipo || '—')}</td>
                                            <td>${escapeHtml(inc.descripcion || '—')}</td>
                                            <td>${formatDate(inc.fecha_incidencia || inc.created_at)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">Sin incidencias registradas.</p>'}
                </div>

                <div class="historial-section">
                    <h4><i class="fas fa-camera"></i> Evidencias (${evidencias.length})</h4>
                    ${evidencias.length ? `
                        <div class="table-container">
                            <table class="product-detail-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Archivo</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${evidencias.map(ev => {
                                        const url = ev.archivo
                                            ? (ev.archivo.startsWith('http') ? ev.archivo : `http://127.0.0.1:8000/storage/${ev.archivo}`)
                                            : null;
                                        return `<tr>
                                            <td>${escapeHtml(ev.tipoEvidencia?.nombre_tipo || ev.tipo?.nombre_tipo || ev.nombre_tipo || '—')}</td>
                                            <td>${url
                                                ? `<a href="${url}" target="_blank" class="btn btn-sm btn-outline"><i class="fas fa-eye"></i> Ver</a>`
                                                : '—'}</td>
                                            <td>${formatDate(ev.fecha_registro || ev.created_at)}</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">Sin evidencias registradas.</p>'}
                </div>
            </div>
        `;
    } catch (e) {
        drawer.innerHTML = `
            <div class="historial-drawer-header">
                <h3>Error</h3>
                <button class="modal-close" onclick="closeHistorialDrawer()">&times;</button>
            </div>
            <div class="historial-drawer-body">
                <div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(e.message || 'No se pudo cargar el detalle del despacho')}</p></div>
            </div>
        `;
    }
}

/* ══════════════════════════════════════════════════════════════
   TAB C — HISTORIAL DE CAMBIOS (LOGS)
   ══════════════════════════════════════════════════════════════ */

function loadLogsTab(container) {
    container.innerHTML = `
        <section class="ops-panel">
            <div class="card-header">
                <h3><i class="fas fa-list-timeline"></i> Historial de cambios de estado</h3>
            </div>
            <div class="card-body">
                <div class="empty-state">
                    <i class="fas fa-clock-rotate-left"></i>
                    <h4>Registro de auditoria</h4>
                    <p>Endpoint de logs de cambios de estado no disponible. Esta seccion mostrara automaticamente quien cambio cada estado y cuando, una vez que el backend exponga el historial de cambios.</p>
                    <p class="text-muted" style="margin-top:8px;font-size:12px;">Los datos ya se estan generando en cada cambio de estado via POST /pedidos/{id}/cambiar-estado. Solo falta exponerlos como endpoint de consulta.</p>
                </div>
            </div>
        </section>
    `;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function getEstadoNameHistorial(p) {
    return p.estado?.nombre_estado || p.nombre_estado || p.estado || 'Pendiente';
}

function getFarmaciaNameHistorial(id) {
    if (!id) return 'Sin farmacia';
    return historialFarmaciaMap.get(Number(id)) || 'Sin farmacia';
}

function buildFarmaciaMap(pedidos) {
    const map = new Map();
    pedidos.forEach(p => {
        const id = p.id_farmacia || p.farmacia?.id_farmacia;
        const name = p.farmacia?.nombre || '';
        if (id && name && !map.has(Number(id))) {
            map.set(Number(id), name);
        }
    });
    return map;
}

function parseMoneyHistorial(value) { return parseMoney(value); }

function formatDateTime(value) {
    if (!value) return '—';
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch (e) {
        return String(value);
    }
}

function normalizeHistorial(value) { return normalize(value); }


