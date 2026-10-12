document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    loadPermissionsFromStorage();
    if (!hasPermission('Dashboard', 'acceder')) {
        document.getElementById('page-content').innerHTML = '<div class="card"><div class="card-body"><div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> No tienes permiso para acceder a este módulo.</div></div></div>';
        return;
    }

    const headerDate = document.getElementById('header-date');
    if (headerDate) {
        headerDate.textContent = new Date().toLocaleDateString('es-BO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    renderInicioSkeleton();
    await loadInicioOperativo();
});

function renderInicioSkeleton() {
    document.getElementById('page-content').innerHTML = `
        <section class="ops-hero">
            <div class="ops-hero-main">
                <div class="ops-kicker">Operación de hoy</div>
                <h1 class="ops-title">Centro de decisiones</h1>
                <p class="ops-subtitle">Revisa pedidos pendientes, entregas en curso, problemas de entrega y caja del día desde una sola pantalla.</p>
                <div class="ops-actions">
                    <a class="btn btn-primary" href="/pages/logistica.html#pedidos"><i class="fas fa-plus"></i> Crear pedido</a>
                    <a class="btn btn-success" href="pages/logistica.html#planificacion"><i class="fas fa-route"></i> Crear entrega</a>
                    <a class="btn btn-outline" href="pages/caja.html"><i class="fas fa-cash-register"></i> Revisar caja</a>
                </div>
            </div>
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-bell"></i> Atención rápida</h3></div>
                <div class="card-body" id="inicio-alertas">
                    <div class="loading"><div class="spinner"></div>Cargando...</div>
                </div>
            </div>
        </section>
        <section class="ops-metrics-grid" id="inicio-metricas">
            ${['Pedidos', 'Entregas', 'Farmacias', 'Repartidores', 'Vehículos', 'Problemas'].map(label => `
                <div class="ops-metric">
                    <div class="label">${label}</div>
                    <div class="value"><span class="stat-skeleton"></span></div>
                    <div class="hint">Actualizando</div>
                </div>
            `).join('')}
        </section>
        <section class="operations-split">
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-truck"></i> Rutas en curso</h3><a class="btn btn-sm btn-outline" href="pages/logistica.html#seguimiento">Ver seguimiento</a></div>
                <div class="card-body" id="inicio-rutas"><div class="loading"><div class="spinner"></div>Cargando...</div></div>
            </div>
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-money-bill-wave"></i> Caja del día</h3><a class="btn btn-sm btn-outline" href="pages/caja.html">Abrir caja</a></div>
                <div class="card-body" id="inicio-caja"><div class="loading"><div class="spinner"></div>Cargando...</div></div>
            </div>
        </section>
    `;
}

async function loadInicioOperativo() {
    const [resumenResp, rutasResp, cajaResp] = await Promise.all([
        apiFetch('/reportes/resumen').catch(() => null),
        apiFetch('/logistica/rutas-activas').catch(() => null),
        apiFetch('/caja/resumen').catch(() => null),
    ]);

    const resumen = resumenResp?.data || resumenResp || {};
    const rutas = Array.isArray(rutasResp) ? rutasResp : (rutasResp?.data || []);
    const caja = cajaResp?.data || cajaResp || null;

    renderMetricas(resumen, rutas, caja);
    renderAlertas(resumen, rutas, caja);
    renderRutas(rutas);
    renderCaja(caja);
}

function renderMetricas(resumen, rutas, caja) {
    const metrics = [
        { label: 'Pedidos', value: resumen.total_pedidos ?? resumen.pedidos ?? 0, hint: 'Registrados' },
        { label: 'Entregas', value: resumen.total_despachos ?? resumen.despachos ?? 0, hint: 'Despachos' },
        { label: 'Farmacias', value: resumen.total_farmacias ?? resumen.farmacias ?? 0, hint: 'Clientes' },
        { label: 'Repartidores', value: resumen.total_repartidores ?? resumen.repartidores ?? 0, hint: 'Personal' },
        { label: 'Vehículos', value: resumen.total_vehiculos ?? resumen.vehiculos ?? 0, hint: 'Flota' },
        { label: 'Problemas', value: resumen.total_incidencias ?? resumen.incidencias ?? 0, hint: 'Incidencias' },
    ];

    document.getElementById('inicio-metricas').innerHTML = metrics.map(m => `
        <div class="ops-metric">
            <div class="label">${m.label}</div>
            <div class="value">${m.value}</div>
            <div class="hint">${m.hint}</div>
        </div>
    `).join('');
}

function renderAlertas(resumen, rutas, caja) {
    const incidencias = resumen.total_incidencias ?? resumen.incidencias ?? 0;
    const rutasActivas = rutas.length;
    const cajasAbiertas = caja?.cajas_abiertas ?? 0;
    const alertas = [
        { icon: 'fa-route', text: `${rutasActivas} rutas activas`, cls: rutasActivas ? 'badge-info' : 'badge-secondary' },
        { icon: 'fa-exclamation-triangle', text: `${incidencias} problemas registrados`, cls: incidencias ? 'badge-danger' : 'badge-success' },
        { icon: 'fa-cash-register', text: `${cajasAbiertas} cajas abiertas`, cls: cajasAbiertas ? 'badge-warning' : 'badge-secondary' },
    ];
    document.getElementById('inicio-alertas').innerHTML = alertas.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <span><i class="fas ${a.icon}" style="width:20px;color:var(--primary);"></i> ${a.text}</span>
            <span class="badge ${a.cls}">Hoy</span>
        </div>
    `).join('');
}

function renderRutas(rutas) {
    const container = document.getElementById('inicio-rutas');
    if (!rutas.length) {
        container.innerHTML = '<div class="empty-state" style="padding:30px 12px;"><i class="fas fa-check-circle"></i><h4>Sin rutas activas</h4><p>No hay entregas en curso.</p></div>';
        return;
    }
    container.innerHTML = rutas.slice(0, 5).map(r => {
        const rep = r.repartidor || {};
        const veh = r.vehiculo || {};
        const progreso = r.progreso || 0;
        return `
            <div class="order-card" style="margin-bottom:10px;">
                <div class="order-card-header">
                    <div>
                        <div class="order-id">${rep.nombre || 'Repartidor'}</div>
                        <h4>${r.ruta?.nombre_ruta || r.nombre_ruta || 'Ruta activa'}</h4>
                    </div>
                    <span class="badge badge-info">${progreso}%</span>
                </div>
                <div class="order-meta">
                    <span>${veh.placa ? `Vehículo ${veh.placa}` : 'Vehículo por confirmar'}</span>
                    <span>${r.completadas || 0}/${r.total_paradas || 0} paradas completadas</span>
                </div>
                <div class="delivery-progress" style="margin-top:10px;"><span style="width:${progreso}%"></span></div>
            </div>
        `;
    }).join('');
}

function renderCaja(caja) {
    const container = document.getElementById('inicio-caja');
    if (!caja) {
        container.innerHTML = '<p class="text-muted">No se pudo cargar el resumen de caja.</p>';
        return;
    }
    container.innerHTML = `
        <div class="cash-totals">
            <div class="cash-total"><strong>Bs ${parseFloat(caja.ingresos_totales || 0).toFixed(2)}</strong><span>Ingresos</span></div>
            <div class="cash-total"><strong>Bs ${parseFloat(caja.gastos_totales || 0).toFixed(2)}</strong><span>Gastos</span></div>
            <div class="cash-total"><strong>Bs ${parseFloat(caja.saldo_total || 0).toFixed(2)}</strong><span>Saldo</span></div>
        </div>
        <p class="text-muted mt-4">${caja.cajas_abiertas || 0} cajas abiertas · ${caja.cajas_cerradas || 0} cajas cerradas</p>
    `;
}
