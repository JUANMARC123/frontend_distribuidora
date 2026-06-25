let repartidoresList = [];
let cajaActual = null;

const TIPOS_GASTO = ['COMBUSTIBLE', 'ALIMENTACION', 'PEAJE', 'MANTENIMIENTO', 'OTRO'];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    renderPage();
});

async function loadRepartidores() {
    try { const d = await apiFetch('/repartidores?per_page=-1'); repartidoresList = Array.isArray(d) ? d : (d.data || []); }
    catch (e) { repartidoresList = []; }
}

async function loadResumen() {
    try {
        const d = await apiFetch('/caja/resumen');
        return d.data || d;
    } catch (e) { return null; }
}

function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div id="resumen-caja"></div>
        <div id="detalle-caja" style="margin-top:16px;"></div>

        <div id="gasto-modal" class="modal-overlay">
            <div class="modal" style="max-width:450px;">
                <div class="modal-header">
                    <h3>Registrar Gasto</h3>
                    <button class="modal-close" onclick="closeGastoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="gasto-form">
                        <div class="form-group">
                            <label>Tipo de Gasto</label>
                            <select id="g-tipo" class="form-control">
                                ${TIPOS_GASTO.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Descripción</label>
                            <input type="text" id="g-descripcion" class="form-control" maxlength="255">
                        </div>
                        <div class="form-group">
                            <label>Monto (Bs) *</label>
                            <input type="number" id="g-monto" class="form-control" step="0.01" min="0.01" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeGastoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveGasto()">Guardar</button>
                </div>
            </div>
        </div>
    `;
    renderResumen();
}

async function renderResumen() {
    const resumen = await loadResumen();
    const container = document.getElementById('resumen-caja');
    if (!container) return;

    if (!resumen) {
        container.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">No hay datos de caja para hoy.</p></div></div>';
        renderDetalleCajas();
        return;
    }

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
            <div class="card" style="text-align:center;padding:20px;">
                <div style="font-size:28px;color:var(--success);">Bs ${parseFloat(resumen.ingresos_totales || 0).toFixed(2)}</div>
                <div style="font-size:13px;color:var(--text-muted);">Ingresos Totales</div>
            </div>
            <div class="card" style="text-align:center;padding:20px;">
                <div style="font-size:28px;color:var(--danger);">Bs ${parseFloat(resumen.gastos_totales || 0).toFixed(2)}</div>
                <div style="font-size:13px;color:var(--text-muted);">Gastos Totales</div>
            </div>
            <div class="card" style="text-align:center;padding:20px;">
                <div style="font-size:28px;color:var(--primary);">Bs ${parseFloat(resumen.saldo_total || 0).toFixed(2)}</div>
                <div style="font-size:13px;color:var(--text-muted);">Saldo Final</div>
            </div>
            <div class="card" style="text-align:center;padding:20px;">
                <div style="font-size:28px;color:var(--info);">${resumen.repartidores_con_caja || 0}</div>
                <div style="font-size:13px;color:var(--text-muted);">Repartidores</div>
                <div style="font-size:11px;color:var(--text-muted);">
                    ${resumen.cajas_abiertas || 0} abiertas · ${resumen.cajas_cerradas || 0} cerradas
                </div>
            </div>
        </div>
    `;
    renderDetalleCajas();
}

async function renderDetalleCajas() {
    const container = document.getElementById('detalle-caja');
    if (!container) return;

    try {
        const d = await apiFetch('/caja/dia');
        const data = d.data || d;
        const cajas = data.cajas || [];

        if (cajas.length === 0) {
            container.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">No hay cajas registradas hoy.</p></div></div>';
            return;
        }

        container.innerHTML = cajas.map(c => {
            const rep = c.repartidor || {};
            const user = rep.usuario || {};
            const gastos = c.gastos || [];
            const estado = c.estado?.nombre_estado || '—';
            const badgeClass = estado === 'Abierta' ? 'badge-success' : estado === 'Cerrada' ? 'badge-warning' : 'badge-info';

            return `
                <div class="card" style="margin-bottom:12px;">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                        <h4><i class="fas fa-user"></i> ${user.nombre || ''} ${user.apellido || ''} — <span class="badge ${badgeClass}">${estado}</span></h4>
                        <div>
                            ${estado === 'Abierta' ? `
                                <button class="btn btn-sm btn-danger" onclick="abrirGastoModal(${c.id_caja})">
                                    <i class="fas fa-minus-circle"></i> Gasto
                                </button>
                                <button class="btn btn-sm btn-success" onclick="cerrarCaja(${c.id_caja})">
                                    <i class="fas fa-check"></i> Cerrar Caja
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                            <div><strong>Inicial:</strong> Bs ${parseFloat(c.monto_inicial).toFixed(2)}</div>
                            <div><strong>Ingresos:</strong> Bs ${parseFloat(c.ingresos).toFixed(2)}</div>
                            <div><strong>Gastos:</strong> Bs ${parseFloat(c.gastos).toFixed(2)}</div>
                            <div><strong>Final:</strong> Bs ${parseFloat(c.monto_final).toFixed(2)}</div>
                        </div>
                        ${gastos.length > 0 ? `
                            <hr style="margin:12px 0;">
                            <h5 style="font-size:13px;margin-bottom:8px;">Gastos registrados:</h5>
                            <table class="table" style="width:100%;font-size:12px;">
                                <thead><tr><th>Tipo</th><th>Descripción</th><th>Monto</th></tr></thead>
                                <tbody>
                                    ${gastos.map(g => `
                                        <tr>
                                            <td>${g.tipo_gasto || '—'}</td>
                                            <td>${g.descripcion || '—'}</td>
                                            <td>Bs ${parseFloat(g.monto).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<div class="card"><div class="card-body"><p class="text-muted">Error al cargar cajas.</p></div></div>';
    }
}

let gastoCajaId = null;

function abrirGastoModal(cajaId) {
    gastoCajaId = cajaId;
    document.getElementById('gasto-form').reset();
    document.getElementById('gasto-modal').classList.add('active');
}

function closeGastoModal() { document.getElementById('gasto-modal').classList.remove('active'); gastoCajaId = null; }

async function saveGasto() {
    const tipo_gasto = document.getElementById('g-tipo').value;
    const descripcion = document.getElementById('g-descripcion').value.trim();
    const monto = parseFloat(document.getElementById('g-monto').value);

    if (!monto || monto <= 0) return Swal.fire('Validación', 'Ingrese un monto válido', 'warning');

    try {
        await apiFetch('/caja/gasto', {
            method: 'POST',
            body: { id_caja: gastoCajaId, tipo_gasto, descripcion, monto }
        });
        Swal.fire('Registrado', 'Gasto registrado correctamente', 'success');
        closeGastoModal();
        renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al registrar gasto', 'error');
    }
}

async function cerrarCaja(id) {
    const r = await Swal.fire({
        title: '¿Cerrar caja?',
        text: 'Una vez cerrada no podrá registrar más ingresos o gastos.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
    });
    if (!r.isConfirmed) return;

    try {
        await apiFetch(`/caja/cerrar/${id}`, { method: 'PUT' });
        Swal.fire('Cerrada', 'Caja cerrada exitosamente', 'success');
        renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al cerrar caja', 'error');
    }
}
