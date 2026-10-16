let historialTab = 'pedidos-rutas';
let historialData = { pedidos: [], hojas: [] };

let historialMapa = null;
let historialMapaMarkers = [];
let historialMapaLinea = null;

let historialFarmaciaMap = new Map();

// Paginación + filtros de la tabla de trazabilidad (una fila por pedido)
let historialTablaPagination = { page: 1, pageSize: 25, totalPages: 1, filter: 'all', search: '' };

document.addEventListener('DOMContentLoaded', async function () {
    if (document.getElementById('logistica-content')) return;
    if (!checkAuth()) return;
    if (!hasPermission('Logistica', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    initHistorialModule();
});

function initHistorialModule(containerId = 'page-content') {
    renderPage(containerId);
    loadTab('pedidos-rutas');
}

function renderPage(containerId = 'page-content') {
    const pageContainer = document.getElementById(containerId);
    if (!pageContainer) return;
    pageContainer.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <div class="ops-kicker">Auditoria y trazabilidad</div>
                <h1 class="ops-title">Historial</h1>
                <p class="ops-subtitle">Pedidos, rutas y despachos unificados: sigue la trazabilidad completa de cada pedido.</p>
            </div>
            <div class="ops-actions">
                <button class="btn btn-outline" onclick="refreshCurrentTab()"><i class="fas fa-rotate"></i> Actualizar</button>
            </div>
        </section>
        <div class="historial-tabs">
            <button class="historial-tab active" data-tab="pedidos-rutas" onclick="switchHistorialTab('pedidos-rutas')">
                <i class="fas fa-route"></i> Trazabilidad de pedidos
            </button>
            <button class="historial-tab" data-tab="logs" onclick="switchHistorialTab('logs')">
                <i class="fas fa-list-timeline"></i> Historial de cambios
            </button>
        </div>
        <div id="historial-content"></div>
        <div id="historial-drawer-overlay" class="drawer-overlay" onclick="closeHistorialDrawer()"></div>
        <div id="historial-drawer" class="historial-drawer"></div>
        <div id="trazabilidad-modal-overlay" class="modal-overlay" onclick="if(event.target===this) closeTrazabilidadModal()">
            <div id="trazabilidad-modal" class="modal trazabilidad-modal"></div>
        </div>
        <div id="despacho-modal-overlay" class="modal-overlay nested" onclick="if(event.target===this) closeDespachoModal()">
            <div id="despacho-modal" class="modal despacho-modal"></div>
        </div>
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

    if (tab === 'pedidos-rutas') {
        await loadPedidosRutasTab(container);
    } else if (tab === 'logs') {
        loadLogsTab(container);
    }
}

/* ══════════════════════════════════════════════════════════════
   TAB — TRAZABILIDAD (una fila por pedido)
   ══════════════════════════════════════════════════════════════ */

async function loadPedidosRutasTab(container) {
    container.innerHTML = `
        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="historial-merged-search" placeholder="Buscar pedido, farmacia, ruta o repartidor..." oninput="filterMergedTable()">
            </div>
            <div class="segmented-filter" role="group" aria-label="Filtrar por estado">
                <button class="seg-btn active" data-filter="all" onclick="setHistorialFilter('all')">Todos</button>
                <button class="seg-btn" data-filter="pendiente" onclick="setHistorialFilter('pendiente')">Pendiente</button>
                <button class="seg-btn" data-filter="en_ruta" onclick="setHistorialFilter('en_ruta')">En ruta</button>
                <button class="seg-btn" data-filter="entregado" onclick="setHistorialFilter('entregado')">Entregado</button>
                <button class="seg-btn" data-filter="cancelado" onclick="setHistorialFilter('cancelado')">Cancelado</button>
            </div>
        </section>
        <section class="ops-panel">
            <div class="card-header">
                <h3><i class="fas fa-route"></i> Trazabilidad de pedidos</h3>
                <span class="text-muted" id="historial-merged-count"></span>
            </div>
            <div class="card-body" id="historial-merged-body">
                <div class="loading"><div class="spinner"></div>Cargando historial...</div>
            </div>
        </section>
    `;

    try {
        const [pedidos, hojas] = await Promise.all([
            apiFetch('/pedidos?per_page=-1').catch(() => []),
            apiFetch('/hojas-ruta?per_page=-1').catch(() => []),
        ]);
        historialData.pedidos = Array.isArray(pedidos) ? pedidos : (pedidos.data || []);
        historialData.hojas = Array.isArray(hojas) ? hojas : (hojas.data || []);
        historialFarmaciaMap = buildFarmaciaMap(historialData.pedidos);
        historialTablaPagination = { page: 1, pageSize: 25, totalPages: 1, filter: 'all', search: '' };
        renderMergedTable();
    } catch (e) {
        const body = document.getElementById('historial-merged-body');
        if (body) body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(e.message || 'No se pudieron cargar los datos')}</p></div>`;
    }
}

function setHistorialFilter(filter) {
    historialTablaPagination.filter = filter;
    historialTablaPagination.page = 1;
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderMergedTable();
}

function goMergedPage(newPage) {
    historialTablaPagination.page = newPage;
    renderMergedTable();
}

function setHistorialPageSize(size) {
    historialTablaPagination.pageSize = parseInt(size);
    historialTablaPagination.page = 1;
    renderMergedTable();
}

function filterMergedTable() {
    historialTablaPagination.search = normalize(document.getElementById('historial-merged-search')?.value || '');
    historialTablaPagination.page = 1;
    renderMergedTable();
}

function renderMergedTable() {
    const container = document.getElementById('historial-merged-body');
    const counter = document.getElementById('historial-merged-count');
    if (!container) return;

    let filtered = buildPedidoRows();
    const { filter, search } = historialTablaPagination;

    if (filter !== 'all') {
        filtered = filtered.filter(i => i.estadoKey === filter);
    }

    if (search) {
        filtered = filtered.filter(i => normalize(i._search).includes(search));
    }

    if (counter) counter.textContent = `${filtered.length} pedidos`;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-route"></i><h4>Sin pedidos</h4><p>No hay pedidos con el filtro actual.</p></div>';
        return;
    }

    const page = historialTablaPagination.page;
    const pageSize = historialTablaPagination.pageSize;
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    historialTablaPagination.totalPages = totalPages;
    if (page > totalPages) { historialTablaPagination.page = totalPages; return renderMergedTable(); }
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

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
                        <th>Despacho</th>
                        <th>Ruta / Hoja</th>
                        <th>Repartidor</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${pageItems.map(item => `
                        <tr>
                            <td><strong>#${item.id}</strong></td>
                            <td>${escapeHtml(item.farmacia)}</td>
                            <td>${getStatusBadge(item.estado)}</td>
                            <td>Bs ${money(item.total)}</td>
                            <td>${item.fecha}</td>
                            <td>${item.despachoRef ? `#${item.despachoRef} <span class="text-muted">${escapeHtml(item.despachoEstado)}</span>` : '<span class="text-muted">—</span>'}</td>
                            <td>${item.hojaRef ? `Hoja #${item.hojaRef}` : '<span class="text-muted">—</span>'}</td>
                            <td>${escapeHtml(item.repartidor || '—')}</td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="openTrazabilidadModal(${item.id})">
                                    <i class="fas fa-diagram-project"></i> Ver trazabilidad
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(page, totalPages, 'goMergedPage', pageSize, 'setHistorialPageSize')}
    `;
}

function buildPedidoRows() {
    const hojaPorPedido = new Map();
    const despachoPorPedido = new Map();

    historialData.hojas.forEach(hoja => {
        (hoja.detalles || []).forEach(det => {
            const pid = Number(det.id_pedido);
            if (!pid) return;
            if (!hojaPorPedido.has(pid)) hojaPorPedido.set(pid, hoja);
            const despacho = (det.despachos || [])[0];
            if (despacho && !despachoPorPedido.has(pid)) despachoPorPedido.set(pid, despacho);
        });
    });

    return historialData.pedidos.map(p => {
        const id = Number(p.id_pedido);
        const hoja = hojaPorPedido.get(id) || null;
        const despacho = despachoPorPedido.get(id) || null;
        const farmacia = p.farmacia?.nombre || getFarmaciaNameHistorial(p.id_farmacia);
        const estado = getEstadoNameHistorial(p);
        const despachoEstado = despacho ? estadoLabelHistorial(despacho.estado_despacho) : '';
        const repartidor = hoja ? getRepartidorNombreHistorial(hoja.repartidor) : '';

        return {
            id,
            pedido: p,
            farmacia,
            estado,
            estadoKey: getColumnKeyHistorial(p),
            total: parseMoneyHistorial(p.total),
            fecha: formatDateShort(p.fecha_pedido || p.created_at),
            fechaOrden: new Date(p.fecha_pedido || p.created_at || 0).getTime() || 0,
            despachoRef: despacho?.id_despacho || null,
            despachoEstado,
            hojaRef: hoja?.id_hoja_ruta || null,
            repartidor,
            _search: `${id} ${farmacia} ${estado} ${hoja?.id_hoja_ruta || ''} ${repartidor}`,
        };
    }).sort((a, b) => b.fechaOrden - a.fechaOrden);
}

/* ══════════════════════════════════════════════════════════════
   MODAL DE TRAZABILIDAD (2 columnas)
   Izquierda: Pedido -> Despacho -> Transporte
   Derecha:   Paradas -> Mapa -> Evidencias
   ══════════════════════════════════════════════════════════════ */

async function openTrazabilidadModal(pedidoId) {
    const modal = document.getElementById('trazabilidad-modal');
    const overlay = document.getElementById('trazabilidad-modal-overlay');
    if (!modal) return;

    modal.classList.add('active');
    modal.style.display = 'flex';
    if (overlay) { overlay.classList.add('active'); overlay.style.display = 'flex'; }
    document.body.style.overflow = 'hidden';
    modal.innerHTML = '<div class="loading" style="padding:40px;"><div class="spinner"></div>Cargando trazabilidad...</div>';

    try {
        await renderTrazabilidadModal(modal, pedidoId);
    } catch (e) {
        modal.innerHTML = renderModalError('trazabilidad-modal', e.message || 'No se pudo cargar la trazabilidad');
    }
}

function openHistorialDrawer(pedidoId) {
    return openTrazabilidadModal(pedidoId);
}

async function renderTrazabilidadModal(modal, pedidoId) {
    const pedidoResp = await apiFetch(`/pedidos/${pedidoId}`);
    const pedido = pedidoResp.pedido || pedidoResp.data || pedidoResp;

    let hojaRutaId = pedido.despacho?.hoja_ruta_detalle?.id_hoja_ruta
        || pedido.despacho?.hojaRutaDetalle?.id_hoja_ruta
        || findHojaRutaIdForPedido(pedidoId);

    let hoja = null;
    if (hojaRutaId) {
        const hojaResp = await apiFetch(`/hojas-ruta/${hojaRutaId}`).catch(() => null);
        hoja = hojaResp ? (hojaResp.hoja_ruta || hojaResp.data || hojaResp) : null;
    }

    const detalles = hoja?.detalles || [];
    const repartidor = hoja ? getRepartidorNombreHistorial(hoja.repartidor) : '';
    const vehiculo = hoja?.vehiculo?.placa || hoja?.vehiculo?.marca || '—';
    const llegada = hoja?.hora_llegada || '';
    const salida = (() => {
        if (!hoja) return '';
        const fecha = hoja.fecha ? formatDate(hoja.fecha) : '';
        const hora = hoja.hora_salida || '';
        return `${fecha} ${hora}`.trim();
    })();
    const fechaRuta = hoja?.fecha ? formatDate(hoja.fecha) : '';

    modal.innerHTML = `
        <div class="modal-header">
            <h3><i class="fas fa-route"></i> Trazabilidad del pedido #${pedido.id_pedido}</h3>
            <button class="modal-close" onclick="closeTrazabilidadModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="trazabilidad-header">
                <div><strong>Hoja de ruta</strong><span>#${hoja?.id_hoja_ruta || '—'}</span></div>
                <div><strong>Repartidor</strong><span>${escapeHtml(repartidor || '—')}</span></div>
                <div><strong>Vehículo</strong><span>${escapeHtml(vehiculo)}</span></div>
                <div><strong>Estado de ruta</strong><span>${hoja ? getStatusBadge(estadoLabelHistorial(hoja.estado_ruta || '')) : '—'}</span></div>
                <div><strong>Fecha</strong><span>${fechaRuta || '—'}</span></div>
                <div><strong>Salida</strong><span>${salida || '—'}</span></div>
                <div><strong>Llegada</strong><span>${llegada ? formatDateTime(llegada) : '—'}</span></div>
            </div>

            <div class="historial-section">
                <h4><i class="fas fa-map-pin"></i> Itinerario completo - ${detalles.length} parada(s)</h4>
                ${detalles.length ? `
                    <div class="paradas-table-wrapper">
                        <table class="paradas-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Farmacia</th>
                                    <th>Pedido</th>
                                    <th>Estado Pedido</th>
                                    <th>Despacho</th>
                                    <th>Estado Despacho</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detalles.map((det, idx) => {
                                    const pedidoDet = det.pedido || {};
                                    const farmacia = pedidoDet.farmacia || {};
                                    const despachoDet = (det.despachos || [])[0] || null;
                                    const esActual = Number(pedidoDet.id_pedido) === Number(pedidoId);
                                    const estadoDet = estadoLabelHistorial(despachoDet?.estado_despacho || despachoDet?.estado || 'pendiente');
                                    return `
                                        <tr class="${esActual ? 'current' : ''}">
                                            <td>${idx + 1}</td>
                                            <td><strong>${escapeHtml(farmacia.nombre || 'Farmacia')}</strong>${esActual ? ' <span class="badge badge-primary">Este pedido</span>' : ''}</td>
                                            <td>#${pedidoDet.id_pedido || '—'}</td>
                                            <td>${getStatusBadge(getEstadoNameHistorial(pedidoDet))}</td>
                                            <td>${despachoDet ? `#${despachoDet.id_despacho}` : '—'}</td>
                                            <td>${despachoDet ? getStatusBadge(estadoLabelHistorial(despachoDet.estado_despacho || despachoDet.estado || '')) : '—'}</td>
                                            <td>
                                                ${despachoDet ? `<button class="btn btn-sm btn-outline" onclick='openDespachoModal(${JSON.stringify(serializeDespacho(despachoDet, det, pedidoDet, farmacia, idx + 1)).replace(/'/g, "\\'")})'><i class="fas fa-truck-fast"></i> Ver despacho asociado</button>` : '<span class="text-muted">Sin despacho</span>'}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-muted">Sin paradas registradas.</p>'}
            </div>

            <div class="historial-section">
                <h4><i class="fas fa-map"></i> Mapa de la ruta</h4>
                ${detalles.length ? '<div id="historial-traz-mapa"></div>' : '<p class="text-muted">Sin ubicaciones para mostrar.</p>'}
            </div>
        </div>
    `;

    if (detalles.length) {
        setTimeout(() => initHistorialMapa(detalles, pedidoId), 120);
    }
}

function serializeDespacho(despachoDet, det, pedidoDet, farmacia, orden) {
    return {
        despacho: despachoDet,
        detalle: det,
        pedido: pedidoDet,
        farmacia: farmacia,
        orden: orden
    };
}

function openDespachoModal(data) {
    const modal = document.getElementById('despacho-modal');
    const overlay = document.getElementById('despacho-modal-overlay');
    if (!modal) return;

    const despacho = data.despacho || {};
    const pedido = data.pedido || {};
    const farmacia = data.farmacia || {};

    const evidencias = despacho.evidencias || [];
    const llegada = despacho.hora_llegada || '';

    modal.classList.add('active');
    modal.style.display = 'flex';
    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';

    modal.innerHTML = `
        <div class="modal-header">
            <h3><i class="fas fa-truck-fast"></i> Despacho #${despacho.id_despacho || '—'} - ${escapeHtml(farmacia.nombre || 'Farmacia')}</h3>
            <button class="modal-close" onclick="closeDespachoModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="historial-section">
                <h4><i class="fas fa-box"></i> Datos del despacho</h4>
                <div class="info-grid">
                    <div><strong>Despacho</strong><span>#${despacho.id_despacho || '—'}</span></div>
                    <div><strong>Pedido</strong><span>#${pedido.id_pedido || '—'}</span></div>
                    <div><strong>Farmacia</strong><span>${escapeHtml(farmacia.nombre || '—')}</span></div>
                    <div><strong>Estado</strong><span>${despacho.estado_despacho ? getStatusBadge(estadoLabelHistorial(despacho.estado_despacho)) : '—'}</span></div>
                    <div><strong>Hora salida</strong><span>${formatDateTime(despacho.fecha_hora_despacho)}</span></div>
                    <div><strong>Hora llegada</strong><span>${llegada ? formatDateTime(llegada) : '—'}</span></div>
                    <div><strong>Monto recibido</strong><span>${despacho.monto_recibido ? 'Bs ' + parseMoneyHistorial(despacho.monto_recibido).toFixed(2) : '—'}</span></div>
                    <div><strong>Método de pago</strong><span>${escapeHtml(despacho.metodo_pago || '—')}</span></div>
                </div>
            </div>

            <div class="historial-section">
                <h4><i class="fas fa-list-timeline"></i> Timeline</h4>
                <div class="timeline">
                    <div class="timeline-item success">
                        <div class="timeline-content">
                            <strong>Despachado</strong>
                            <small>${formatDateTime(despacho.fecha_hora_despacho)}</small>
                        </div>
                    </div>
                    ${(despacho.estado_despacho === 'entregado' || llegada) ? `
                    <div class="timeline-item success">
                        <div class="timeline-content">
                            <strong>Entregado</strong>
                            <small>${llegada ? formatDateTime(llegada) : 'Con registro de entrega'}</small>
                        </div>
                    </div>` : `
                    <div class="timeline-item warning">
                        <div class="timeline-content">
                            <strong>${despacho.estado_despacho === 'incidencia' ? 'Incidencia reportada' : 'Pendiente de entrega'}</strong>
                            <small>Sin registro de llegada</small>
                        </div>
                    </div>`}
                </div>
            </div>

            <div class="historial-section">
                <h4><i class="fas fa-camera"></i> Evidencias de entrega</h4>
                ${evidencias.length ? `
                    <div class="evidencias-grid">
                        ${evidencias.map(ev => {
                            const archivo = ev.archivo || '';
                            const url = archivo ? (archivo.startsWith('http') ? archivo : `${API_URL.replace('/api', '')}/storage/${archivo}`) : null;
                            return `
                                <div class="evidencia-item">
                                    ${url ? `<a href="${url}" target="_blank"><img src="${url}" alt="Evidencia" loading="lazy"></a>` : '<div class="evidencia-placeholder">Sin imagen</div>'}
                                    <div class="evidencia-info">
                                        <strong>${escapeHtml(estadoLabelHistorial(ev.tipo_evidencia || 'Evidencia'))}</strong>
                                        <div class="text-muted">${formatDate(ev.created_at)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p class="text-muted">Sin evidencias registradas para este despacho.</p>'}
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeDespachoModal()">Cerrar</button>
        </div>
    `;
}

function renderEvidencias(detalles, pedidoId, hoja) {
    const detalleActual = detalles.find(det => Number(det.pedido?.id_pedido) === Number(pedidoId));
    let evidencias = (detalleActual?.despachos || []).flatMap(d => d.evidencias || []);

    if (!evidencias.length && hoja) {
        evidencias = detalles.flatMap(det => (det.despachos || []).flatMap(d => d.evidencias || []));
    }

    if (!evidencias.length) return '<p class="text-muted">Sin evidencias registradas.</p>';

    return `
        <div class="evidencias-grid">
            ${evidencias.map(ev => {
                const archivo = ev.archivo || '';
                const url = archivo
                    ? (archivo.startsWith('http') ? archivo : `${API_URL.replace('/api', '')}/storage/${archivo}`)
                    : null;
                return `<div class="evidencia-item">
                    ${url ? `<a href="${url}" target="_blank"><img src="${url}" alt="Evidencia" loading="lazy"></a>` : '<div class="evidencia-placeholder">Sin imagen</div>'}
                    <div class="evidencia-info">
                        <strong>${escapeHtml(estadoLabelHistorial(ev.tipo_evidencia || 'Evidencia'))}</strong>
                        <div class="text-muted">${formatDate(ev.created_at)}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

function initHistorialMapa(detalles, pedidoId) {
    const mapContainer = document.getElementById('historial-traz-mapa');
    if (!mapContainer || typeof L === 'undefined') return;

    if (historialMapa) {
        historialMapa.remove();
        historialMapa = null;
    }
    historialMapaMarkers = [];
    historialMapaLinea = null;

    historialMapa = L.map('historial-traz-mapa').setView([-16.4897, -67.8217], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(historialMapa);

    setTimeout(() => { if (historialMapa) historialMapa.invalidateSize(); }, 200);

    const coords = [];
    detalles.forEach((det, idx) => {
        const pedido = det.pedido || {};
        const farmacia = pedido.farmacia || {};
        const lat = numeroFinito(farmacia.latitud);
        const lng = numeroFinito(farmacia.longitud);
        if (lat === null || lng === null) return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        coords.push([lat, lng]);
        const despacho = (det.despachos || [])[0] || {};
        const estadoEntrega = estadoLabelHistorial(despacho.estado_despacho || despacho.estado || 'pendiente');
        const est = normalize(estadoEntrega);
        const esActual = Number(pedido.id_pedido) === Number(pedidoId);
        const color = esActual ? '#2563eb'
            : est.includes('entreg') ? '#10b981'
            : (est.includes('incidencia') || est.includes('fall') || est.includes('cancel')) ? '#ef4444'
            : '#64748b';

        const marker = L.circleMarker([lat, lng], {
            radius: esActual ? 10 : 7,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9,
        }).addTo(historialMapa);
        marker.bindPopup(`<b>${idx + 1}. ${escapeHtml(farmacia.nombre || 'Parada')}</b><br>Pedido #${pedido.id_pedido || '—'}<br>Estado: ${escapeHtml(estadoEntrega)}`);
        historialMapaMarkers.push(marker);
    });

    if (coords.length > 1) {
        historialMapaLinea = L.polyline(coords, {
            color: '#64748b',
            weight: 3,
            opacity: 0.6,
            dashArray: '8, 8',
        }).addTo(historialMapa);
        const boundsLinea = historialMapaLinea.getBounds();
        if (boundsLinea.isValid()) {
            historialMapa.fitBounds(boundsLinea, { padding: [40, 40], animate: false });
        }
    } else if (coords.length === 1) {
        historialMapa.setView(coords[0], 14);
    }
}

function closeTrazabilidadModal() {
    const modal = document.getElementById('trazabilidad-modal');
    const overlay = document.getElementById('trazabilidad-modal-overlay');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
    if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
    if (historialMapa) {
        historialMapa.remove();
        historialMapa = null;
        historialMapaMarkers = [];
        historialMapaLinea = null;
    }
    closeDespachoModal();
    document.body.style.overflow = '';
}

function closeDespachoModal() {
    const modal = document.getElementById('despacho-modal');
    const overlay = document.getElementById('despacho-modal-overlay');
    if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
    if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
    const trazModal = document.getElementById('trazabilidad-modal');
    if (!trazModal || !trazModal.classList.contains('active')) {
        document.body.style.overflow = '';
    }
}

function closeHistorialDrawer() {
    closeTrazabilidadModal();
}

function renderDrawerError(message) {
    return renderModalError('trazabilidad-modal', message);
}

function renderModalError(modalId, message) {
    return `
        <div class="modal-header">
            <h3>Error</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').classList.remove('active'); document.getElementById('${modalId}').style.display='none'; document.getElementById('${modalId}-overlay')?.classList.remove('active'); document.getElementById('${modalId}-overlay').style.display='none'; document.body.style.overflow='';">&times;</button>
        </div>
        <div class="modal-body">
            <div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Error</h4><p>${escapeHtml(message)}</p></div>
        </div>
    `;
}

/* ══════════════════════════════════════════════════════════════
   TAB — HISTORIAL DE CAMBIOS (LOGS)
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
    return estadoLabel(p.estado) || estadoLabel(p.nombre_estado) || 'Pendiente';
}

function estadoLabelHistorial(estado) {
    if (!estado) return '';
    const clave = String(estado).toLowerCase().replace(/\s+/g, '_');
    return clave.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

function getColumnKeyHistorial(p) {
    const status = normalize(getEstadoNameHistorial(p));
    if (status.includes('cancel')) return 'cancelado';
    if (status.includes('ruta') || status.includes('despach')) return 'en_ruta';
    if (status.includes('entreg') || status.includes('complet')) return 'entregado';
    return 'pendiente';
}

function getFarmaciaNameHistorial(id) {
    if (!id) return 'Sin farmacia';
    return historialFarmaciaMap.get(Number(id)) || 'Sin farmacia';
}

function getRepartidorNombreHistorial(repartidor) {
    if (!repartidor) return '';
    if (repartidor.nombre) return repartidor.nombre;
    const completo = [repartidor.usuario?.nombre, repartidor.usuario?.apellido]
        .filter(Boolean).join(' ').trim();
    return completo || '';
}

function findHojaRutaIdForPedido(pedidoId) {
    const hoja = historialData.hojas.find(h => (h.detalles || []).some(d => Number(d.id_pedido) === Number(pedidoId)));
    return hoja?.id_hoja_ruta || null;
}

function findDespachoForPedido(hoja, pedidoId) {
    const detalle = (hoja.detalles || []).find(d => Number(d.id_pedido) === Number(pedidoId));
    return (detalle?.despachos || [])[0] || null;
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
