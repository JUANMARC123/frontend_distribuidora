document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    loadPermissionsFromStorage();
    if (!hasPermission('Dashboard', 'acceder')) {
        document.getElementById('page-content').innerHTML = '<div class="card"><div class="card-body"><div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> No tienes permiso para acceder a este módulo.</div></div></div>';
        return;
    }

    document.getElementById('header-date').textContent = new Date().toLocaleDateString('es-BO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    try {
        const resumen = await apiFetch('/reportes/resumen');
        console.log('[Dashboard] Resumen recibido:', resumen); // debug
        updateStats(resumen);
    } catch (e) {
        console.error('Error cargando resumen:', e);
        // Si falla, mostrar 0 en vez de skeleton infinito
        ['stat-pedidos','stat-despachos','stat-farmacias','stat-repartidores','stat-vehiculos','stat-incidencias']
            .forEach(id => { document.getElementById(id).textContent = '0'; });
    }

    loadCharts();
});

function updateStats(data) {
    const set = (id, val) => {
        document.getElementById(id).textContent = val ?? '—';
    };
    // El backend devuelve: data.data.total_pedidos, total_despachos, etc.
    const d = data.data ?? data;
    set('stat-pedidos',      d.total_pedidos      ?? d.pedidos      ?? '0');
    set('stat-despachos',    d.total_despachos    ?? d.despachos    ?? '0');
    set('stat-farmacias',    d.total_farmacias    ?? d.farmacias    ?? '0');
    set('stat-repartidores', d.total_repartidores ?? d.repartidores ?? '0');
    set('stat-vehiculos',    d.total_vehiculos    ?? d.vehiculos    ?? '0');
    set('stat-incidencias',  d.total_incidencias  ?? d.incidencias  ?? '0');
}

async function loadCharts() {
    try {
        const [pedidosEstado, despachosEstado] = await Promise.all([
            apiFetch('/reportes/pedidos-por-estado').catch(() => null),
            apiFetch('/reportes/despachos-por-estado').catch(() => null),
        ]);

        if (pedidosEstado && pedidosEstado.data) renderDoughnutChart('chart-pedidos-estado', pedidosEstado.data, 'Pedidos por Estado');
        if (despachosEstado && despachosEstado.data) renderBarChart('chart-despachos-estado', despachosEstado.data, 'Despachos por Estado');

    } catch (e) {
        console.error('Error cargando charts:', e);
    }
}

function mergeFlotaData(repartidores, vehiculos) {
    if (!repartidores && !vehiculos) return null;
    const labels = [];
    const values = [];
    if (repartidores) {
        const entries = Array.isArray(repartidores) ? repartidores : Object.entries(repartidores).map(([k, v]) => ({ label: k, value: v }));
        entries.forEach(e => {
            labels.push('Rep. ' + (e.label || e.nombre_estado || e.estado));
            values.push(e.count ?? e.value ?? e.total);
        });
    }
    if (vehiculos) {
        const entries = Array.isArray(vehiculos) ? vehiculos : Object.entries(vehiculos).map(([k, v]) => ({ label: k, value: v }));
        entries.forEach(e => {
            labels.push('Veh. ' + (e.label || e.nombre_estado || e.estado));
            values.push(e.count ?? e.value ?? e.total);
        });
    }
    return { labels, values };
}

function renderBarChart(canvasId, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const labels = [];
    const values = [];

    if (Array.isArray(data)) {
        data.forEach((item, i) => {
            labels.push(item.label || item.nombre_estado || item.estado || `Item ${i + 1}`);
            values.push(item.count ?? item.value ?? item.total ?? 0);
        });
    } else if (typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
            labels.push(k);
            values.push(v.count ?? v.value ?? v.total ?? v ?? 0);
        });
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} despachos` } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                y: { grid: { display: false }, ticks: { font: { size: 13 } } }
            }
        }
    });
}

function renderDoughnutChart(canvasId, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];
    const labels = [];
    const values = [];

    if (Array.isArray(data)) {
        data.forEach((item, i) => {
            labels.push(item.label || item.nombre_estado || item.estado || `Item ${i + 1}`);
            values.push(item.count ?? item.value ?? item.total ?? 0);
        });
    } else if (typeof data === 'object') {
        Object.entries(data).forEach(([k, v], i) => {
            labels.push(k);
            values.push(v.count ?? v.value ?? v.total ?? v ?? 0);
        });
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 2,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } },
            }
        }
    });
}

function renderLineChart(canvasId, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [];
    const values = [];

    if (Array.isArray(data)) {
        data.forEach(item => {
            labels.push(item.label || item.fecha || item.date || '');
            values.push(item.count ?? item.value ?? item.total ?? 0);
        });
    } else if (typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
            labels.push(k);
            values.push(v.count ?? v.value ?? v.total ?? v ?? 0);
        });
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Pedidos',
                data: values,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                tension: 0.3,
                pointBackgroundColor: '#3b82f6',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}
