const REPORT_ENDPOINTS = {
    'pedidos-estado': '/reportes/pedidos-por-estado',
    'despachos-estado': '/reportes/despachos-por-estado',
    'pedidos-dia': '/reportes/pedidos-por-dia',
    'repartidores-estado': '/reportes/repartidores-por-estado',
    'vehiculos-estado': '/reportes/vehiculos-por-estado',
    'incidencias-tipo': '/reportes/incidencias-por-tipo',
};

const REPORT_LABELS = {
    'pedidos-estado': 'Pedidos por Estado',
    'despachos-estado': 'Despachos por Estado',
    'pedidos-dia': 'Pedidos por Día',
    'repartidores-estado': 'Repartidores por Estado',
    'vehiculos-estado': 'Vehículos por Estado',
    'incidencias-tipo': 'Incidencias por Tipo',
};

document.addEventListener('DOMContentLoaded', function () {
    if (!checkAuth()) return;
    loadPermissionsFromStorage();
    if (!hasPermission('Reportes', 'acceder')) {
        document.getElementById('page-content').innerHTML = '<div class="card"><div class="card-body"><div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> No tienes permiso para acceder a este módulo.</div></div></div>';
        return;
    }

    document.querySelectorAll('[data-report]').forEach(btn => {
        btn.addEventListener('click', function () {
            const report = this.dataset.report;
            loadReport(report);
            document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('btn-primary'));
            document.querySelectorAll('[data-report]').forEach(b => {
                b.className = 'btn btn-sm btn-outline';
            });
            this.className = 'btn btn-sm btn-primary';
        });
    });
});

async function loadReport(reportKey) {
    const container = document.getElementById('report-container');
    showLoading(container);

    try {
        const data = await apiFetch(REPORT_ENDPOINTS[reportKey]);
        renderReportTable(container, reportKey, data);
    } catch (e) {
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle"></i>
                        Error al cargar el reporte: ${e.message || 'Error desconocido'}
                    </div>
                </div>
            </div>
        `;
    }
}

function renderReportTable(container, reportKey, data) {
    const title = REPORT_LABELS[reportKey] || reportKey;
    const rows = Array.isArray(data) ? data : (data.data || []);

    let tableData = [];
    if (Array.isArray(data)) {
        tableData = data;
    } else if (data.data && Array.isArray(data.data)) {
        tableData = data.data;
    } else if (typeof data === 'object') {
        tableData = Object.entries(data).map(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
                return { label: k, ...v };
            }
            return { label: k, count: v };
        });
    }

    if (tableData.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>${title}</h3></div>
                <div class="card-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        No hay datos disponibles para este reporte.
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const keys = Object.keys(tableData[0]);
    const labelKey = keys.find(k => k === 'label' || k === 'nombre_estado' || k === 'estado' || k === 'fecha' || k === 'date' || k === 'nombre_tipo' || k === 'name');
    const valueKey = keys.find(k => k === 'count' || k === 'value' || k === 'total' || k === 'cantidad');
    const displayLabel = labelKey || keys[0];
    const displayValue = valueKey || keys[1] || keys[0];

    const theadKeys = [displayLabel, displayValue];
    const theadLabels = reportKey === 'pedidos-dia' ? ['Fecha', 'Pedidos'] :
                        reportKey === 'incidencias-tipo' ? ['Tipo de Incidencia', 'Cantidad'] :
                        [title.replace('por', '').trim(), 'Cantidad'];

    let html = `
        <div class="card">
            <div class="card-header"><h3>${title}</h3></div>
            <div class="card-body">
                <div class="table-container">
                    <table id="report-table" class="display" style="width:100%">
                        <thead>
                            <tr>
                                <th>${theadLabels[0]}</th>
                                <th>${theadLabels[1]}</th>
                            </tr>
                        </thead>
                        <tbody>
    `;

    tableData.forEach(row => {
        const label = row[displayLabel] ?? '—';
        const value = row[displayValue] ?? 0;
        html += `<tr><td>${label}</td><td><strong>${value}</strong></td></tr>`;
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    if ($.fn.DataTable.isDataTable('#report-table')) {
        $('#report-table').DataTable().destroy();
    }

    $('#report-table').DataTable({
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 25,
        order: [[1, 'desc']],
    });
}
