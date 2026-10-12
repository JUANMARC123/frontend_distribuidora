let currentTab = 'planificacion';

const TAB_ALIASES = {
    planificador: 'planificacion',
    planificar: 'planificacion',
    crear: 'planificacion',
    tracking: 'seguimiento',
    ruta: 'planificacion',
    rutas: 'planificacion',
    despachar: 'planificacion',
    historial: 'historial',
    history: 'historial',
    pedido: 'pedidos',
    orders: 'pedidos',
};

const VALID_TABS = ['pedidos', 'planificacion', 'seguimiento', 'historial'];

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
    return normalizeTab(hash || 'pedidos');
}

function normalizeTab(tab) {
    const clean = String(tab || 'pedidos').toLowerCase();
    return TAB_ALIASES[clean] || clean;
}

function switchTab(tab, updateHash = true) {
    currentTab = normalizeTab(tab);
    if (!VALID_TABS.includes(currentTab)) {
        currentTab = 'pedidos';
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

    if (tab === 'pedidos') {
        renderPedidosTab(container);
    } else if (tab === 'planificacion') {
        renderPlanificador(container);
    } else if (tab === 'seguimiento') {
        renderTracking(container);
    } else if (tab === 'historial') {
        renderHistorialTab(container);
    }
}

/* ══════════════════════════════════════════════
   TAB: PEDIDOS
   ══════════════════════════════════════════════ */

function renderPedidosTab(container) {
    container.innerHTML = `<div id="pedidos-logistica-container"></div>`;
    if (typeof initPedidosModule === 'function') {
        initPedidosModule('#pedidos-logistica-container');
    } else {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-box"></i><h4>Error</h4><p>El modulo de pedidos no esta disponible.</p></div>';
    }
}

function renderPlanificador(container) {
    container.innerHTML = `
        <section class="ops-hero compact">
            <div class="ops-hero-main">
                <h1 class="ops-title">Despachar</h1>
                <p class="ops-subtitle">Asigna pedidos a repartidores y planifica rutas de entrega.</p>
            </div>
        </section>
        <div class="ops-panel" style="margin-bottom:12px;">
            <div class="card-body">
                <div class="ops-mini-metrics" id="planificador-resumen">
                    <div><strong>0</strong><span>Pedidos</span></div>
                    <div><strong>0</strong><span>Asignados</span></div>
                    <div><strong>0</strong><span>Repartidores</span></div>
                </div>
            </div>
        </div>
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
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-outline" onclick="planificadorUserInteracted=false;updateMapRoute()"><i class="fas fa-crosshairs"></i> Re-centrar</button>
                        <button class="btn btn-sm btn-outline" onclick="clearAssignments()"><i class="fas fa-rotate-left"></i> Limpiar</button>
                    </div>
                </div>
                <div id="planificador-map" class="route-map"></div>
                <div class="route-events" id="planificador-alertas"></div>
            </main>
            <aside class="route-panel wide">
                <div class="route-panel-header">
                    <span><i class="fas fa-truck"></i> Repartidores</span>
                    <span class="count" id="repartidores-count">0</span>
                </div>
                <div class="route-panel-toolbar">
                    <input class="form-control" id="planificador-search-repartidor" placeholder="Buscar repartidor..." oninput="renderRepartidores()">
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
            <main class="tracking-mapa" style="position:relative;">
                <div id="tracking-map"></div>
                <button class="btn btn-sm btn-outline" onclick="trackingUserInteracted=false;selectTrackingRuta(trackingActiveId)" style="position:absolute;bottom:16px;right:16px;z-index:10;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);">
                    <i class="fas fa-crosshairs"></i> Re-centrar
                </button>
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

/* ══════════════════════════════════════════════
   TAB: HISTORIAL
   ══════════════════════════════════════════════ */

function renderHistorialTab(container) {
    if (typeof initHistorialModule === 'function') {
        initHistorialModule('logistica-content');
    } else {
        container.innerHTML = `
            <section class="ops-hero compact">
                <div class="ops-hero-main">
                    <h1 class="ops-title">Historial</h1>
                    <p class="ops-subtitle">Auditoria y trazabilidad de pedidos, despachos y cambios.</p>
                </div>
            </section>
            <div id="historial-content">
                <div class="loading"><div class="spinner"></div>Cargando...</div>
            </div>
        `;
    }
}


