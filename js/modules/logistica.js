let currentTab = 'planificacion';

const TAB_ALIASES = {
    planificador: 'planificacion',
    planificar: 'planificacion',
    crear: 'planificacion',
    tracking: 'seguimiento',
    rutas: 'seguimiento',
    gps: 'mapa',
};

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!canAccessLogistica()) { window.location.href = '../dashboard.html'; return; }
    const initialTab = getInitialTab();
    switchTab(initialTab, false);
});

function canAccessLogistica() {
    return hasPermission('Logistica', 'acceder')
        || hasPermission('Logística', 'acceder');
}

function getInitialTab() {
    const hash = (window.location.hash || '').replace('#', '');
    return normalizeTab(hash || 'planificacion');
}

function normalizeTab(tab) {
    const clean = String(tab || 'planificacion').toLowerCase();
    return TAB_ALIASES[clean] || clean;
}

function switchTab(tab, updateHash = true) {
    currentTab = normalizeTab(tab);
    if (!['planificacion', 'seguimiento', 'historial', 'mapa'].includes(currentTab)) {
        currentTab = 'planificacion';
    }

    document.querySelectorAll('.logistica-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === currentTab);
    });

    if (updateHash) {
        history.replaceState(null, '', `#${currentTab}`);
    }

    renderTab(currentTab);
}

function renderTab(tab) {
    const container = document.getElementById('logistica-content');
    if (!container) return;

    if (tab === 'planificacion') {
        renderPlanificador(container);
    } else if (tab === 'seguimiento') {
        renderTracking(container);
    } else if (tab === 'historial') {
        renderHistorial(container);
    } else if (tab === 'mapa') {
        renderMapa(container);
    }
}

function renderPlanificador(container) {
    container.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <h1 class="ops-title">Crear entrega</h1>
                <p class="ops-subtitle">Arrastra pedidos pendientes hacia un repartidor, reordena las paradas y guarda solo al iniciar la ruta.</p>
            </div>
            <div class="ops-panel">
                <div class="card-body">
                    <div class="ops-mini-metrics" id="planificador-resumen">
                        <div><strong>0</strong><span>Pedidos</span></div>
                        <div><strong>0</strong><span>Asignados</span></div>
                        <div><strong>0</strong><span>Repartidores</span></div>
                    </div>
                </div>
            </div>
        </section>
        <section class="route-shell">
            <aside class="route-panel">
                <div class="route-panel-header">
                    <span><i class="fas fa-box"></i> Pedidos pendientes</span>
                    <span class="count" id="pendientes-count">0</span>
                </div>
                <div class="route-panel-toolbar">
                    <input class="form-control" id="planificador-search" placeholder="Buscar pedido o farmacia" oninput="renderPedidos()">
                </div>
                <div class="route-panel-body" id="pedidos-list"></div>
            </aside>

            <main class="route-map-panel">
                <div class="route-map-header">
                    <div>
                        <strong>Mapa de ruta</strong>
                        <span id="route-preview-label">Sin pedidos asignados</span>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="clearAssignments()"><i class="fas fa-rotate-left"></i> Limpiar</button>
                </div>
                <div id="planificador-map" class="route-map"></div>
                <div class="route-events" id="planificador-alertas"></div>
            </main>

            <aside class="route-panel wide">
                <div class="route-panel-header">
                    <span><i class="fas fa-truck"></i> Repartidores</span>
                    <span class="count" id="repartidores-count">0</span>
                </div>
                <div class="route-panel-body" id="repartidores-list"></div>
            </aside>
        </section>
    `;
    if (typeof initPlanificador === 'function') {
        setTimeout(initPlanificador, 100);
    }
}

function renderTracking(container) {
    container.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <h1 class="ops-title">Seguimiento</h1>
                <p class="ops-subtitle">Controla rutas activas, progreso, paradas, entregas y posicion GPS en tiempo real.</p>
            </div>
            <div class="ops-panel">
                <div class="card-body">
                    <div class="ops-mini-metrics" id="tracking-summary">
                        <div><strong>0</strong><span>Rutas activas</span></div>
                        <div><strong>0</strong><span>Paradas</span></div>
                        <div><strong>0%</strong><span>Progreso prom.</span></div>
                    </div>
                </div>
            </div>
        </section>
        <section class="tracking-grid">
            <aside class="tracking-list">
                <div class="tracking-list-header">
                    <span><i class="fas fa-location-dot"></i> Rutas en curso</span>
                    <span class="count" id="tracking-count">0</span>
                </div>
                <div id="tracking-list-body"></div>
            </aside>
            <main class="tracking-mapa">
                <div id="tracking-map"></div>
            </main>
            <aside class="tracking-detail" id="tracking-detail">
                <div class="empty-state compact">Seleccione una ruta para ver paradas, entregas y eventos.</div>
            </aside>
        </section>
    `;
    if (typeof initTracking === 'function') {
        setTimeout(initTracking, 100);
    }
}

async function renderHistorial(container) {
    container.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <h1 class="ops-title">Historial de entregas</h1>
                <p class="ops-subtitle">Despachos, controles de ruta, llegada real, pruebas de entrega y problemas reportados.</p>
            </div>
            <div class="ops-actions">
                <button class="btn btn-outline" onclick="renderHistorial(document.getElementById('logistica-content'))"><i class="fas fa-rotate"></i> Actualizar</button>
            </div>
        </section>
        <section class="operations-split">
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-clipboard-check"></i> Entregas</h3></div>
                <div class="card-body" id="historial-despachos"><div class="loading"><div class="spinner"></div>Cargando...</div></div>
            </div>
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-route"></i> Control de rutas</h3></div>
                <div class="card-body" id="historial-controles"><div class="loading"><div class="spinner"></div>Cargando...</div></div>
            </div>
        </section>
    `;

    await Promise.all([loadHistorialDespachos(), loadHistorialControles()]);
}

async function loadHistorialDespachos() {
    const container = document.getElementById('historial-despachos');
    if (!container) return;
    try {
        const d = await apiFetch('/despachos');
        const despachos = Array.isArray(d) ? d : (d.data || []);
        if (!despachos.length) {
            container.innerHTML = '<div class="empty-state compact">No hay entregas registradas.</div>';
            return;
        }
        container.innerHTML = despachos.slice(0, 30).map(d => `
            <article class="list-card">
                <div>
                    <strong>Entrega #${d.id_despacho}</strong>
                    <p>${escapeHtml(d.pedido?.farmacia?.nombre || d.farmacia || 'Sin farmacia')} · Pedido #${d.id_pedido || d.pedido_id || ''}</p>
                </div>
                <div>
                    ${getStatusBadge(d.estado?.nombre_estado || d.estado || 'Sin estado')}
                    <div class="actions" style="margin-top:8px;">
                        <button class="btn btn-sm btn-info" onclick="window.location.href='despachos.html'"><i class="fas fa-eye"></i> Ver</button>
                    </div>
                </div>
            </article>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="empty-state compact">No se pudo cargar entregas: ${escapeHtml(e.message || '')}</div>`;
    }
}

async function loadHistorialControles() {
    const container = document.getElementById('historial-controles');
    if (!container) return;
    try {
        const d = await apiFetch('/controles-ruta');
        const controles = Array.isArray(d) ? d : (d.data || []);
        if (!controles.length) {
            container.innerHTML = '<div class="empty-state compact">No hay controles de ruta registrados.</div>';
            return;
        }
        container.innerHTML = controles.slice(0, 30).map(c => `
            <article class="list-card">
                <div>
                    <strong>Ruta #${c.id_control_ruta}</strong>
                    <p>${escapeHtml(c.repartidor?.nombre || 'Sin repartidor')} · ${escapeHtml(c.vehiculo?.placa || 'Sin vehiculo')}</p>
                    <small>Salida: ${formatDate(c.fecha_salida || c.hora_salida)} · Llegada: ${formatDate(c.hora_llegada)}</small>
                </div>
                <div class="actions">
                    <button class="btn btn-sm btn-success" onclick="registrarLlegadaRuta(${c.id_control_ruta})"><i class="fas fa-flag-checkered"></i> Llegada</button>
                </div>
            </article>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="empty-state compact">No se pudo cargar controles: ${escapeHtml(e.message || '')}</div>`;
    }
}

async function registrarLlegadaRuta(id) {
    const result = await Swal.fire({
        title: 'Registrar llegada real',
        html: `<input id="hora-llegada" type="time" class="swal2-input" value="${new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}">`,
        showCancelButton: true,
        confirmButtonText: 'Guardar llegada',
        cancelButtonText: 'Cancelar',
        preConfirm: () => document.getElementById('hora-llegada').value
    });
    if (!result.isConfirmed || !result.value) return;

    try {
        await apiFetch(`/controles-ruta/${id}/registrar-llegada`, {
            method: 'POST',
            body: { hora_llegada_real: result.value + ':00' }
        });
        Swal.fire('Registrado', 'Llegada real registrada.', 'success');
        await loadHistorialControles();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo registrar llegada.', 'error');
    }
}

function renderMapa(container) {
    container.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <h1 class="ops-title">Mapa GPS</h1>
                <p class="ops-subtitle">Supervision avanzada de repartidores, ubicaciones conectadas y geocercas.</p>
            </div>
            <div class="ops-actions">
                <a class="btn btn-primary" href="gps.html"><i class="fas fa-map-location-dot"></i> Abrir mapa completo</a>
                <button class="btn btn-outline" onclick="switchTab('seguimiento')"><i class="fas fa-location-dot"></i> Ver seguimiento</button>
            </div>
        </section>
        <section class="ops-panel">
            <div class="card-body">
                <div class="empty-state">
                    <i class="fas fa-map"></i>
                    <h3>Mapa avanzado disponible</h3>
                    <p>El mapa GPS y las geocercas se mantienen en la pantalla especializada para conservar el rendimiento y el espacio operativo.</p>
                </div>
            </div>
        </section>
    `;
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
