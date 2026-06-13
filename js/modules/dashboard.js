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
        updateStats(resumen);
    } catch (e) {
        console.error('Error cargando resumen:', e);
    }

    loadCharts();
});

function updateStats(data) {
    const set = (id, val) => {
        document.getElementById(id).textContent = val ?? '—';
    };
    set('stat-pedidos', data.pedidos ?? data.total_pedidos ?? data.pedidos_count);
    set('stat-despachos', data.despachos ?? data.total_despachos ?? data.despachos_count);
    set('stat-farmacias', data.farmacias ?? data.total_farmacias ?? data.farmacias_count);
    set('stat-repartidores', data.repartidores ?? data.total_repartidores ?? data.repartidores_count);
    set('stat-vehiculos', data.vehiculos ?? data.total_vehiculos ?? data.vehiculos_count);
    set('stat-incidencias', data.incidencias ?? data.total_incidencias ?? data.incidencias_count);
}

async function loadCharts() {
    try {
        const [pedidosEstado, despachosEstado, pedidosDia, repartidoresEstado, vehiculosEstado] = await Promise.all([
            apiFetch('/reportes/pedidos-por-estado').catch(() => null),
            apiFetch('/reportes/despachos-por-estado').catch(() => null),
            apiFetch('/reportes/pedidos-por-dia').catch(() => null),
            apiFetch('/reportes/repartidores-por-estado').catch(() => null),
            apiFetch('/reportes/vehiculos-por-estado').catch(() => null),
        ]);

        if (pedidosEstado && pedidosEstado.data) renderDoughnutChart('chart-pedidos-estado', pedidosEstado.data, 'Pedidos por Estado');
        if (despachosEstado && despachosEstado.data) renderDoughnutChart('chart-despachos-estado', despachosEstado.data, 'Despachos por Estado');
        if (pedidosDia && pedidosDia.data) renderLineChart('chart-pedidos-dia', pedidosDia.data, 'Pedidos por Día');

        const flotaData = mergeFlotaData(repartidoresEstado?.data, vehiculosEstado?.data);
        if (flotaData) renderDoughnutChart('chart-flota', flotaData, 'Distribución de Flota');

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
