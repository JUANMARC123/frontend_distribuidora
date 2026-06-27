let repartidoresList = [];
let cajasDia = [];
let gastoCajaId = null;
let ingresoCajaId = null;

const TIPOS_GASTO = ['COMBUSTIBLE', 'ALIMENTACION', 'PEAJE', 'MANTENIMIENTO', 'IMPLEMENTOS', 'OTRO'];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    await loadRepartidores();
    renderPage();
    await renderResumen();
});

async function loadRepartidores() {
    try {
        const d = await apiFetch('/repartidores?per_page=-1');
        repartidoresList = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        repartidoresList = [];
    }
}

async function loadResumen() {
    try {
        const d = await apiFetch('/caja/resumen');
        return d.data || d;
    } catch (e) {
        return null;
    }
}

async function loadCajasDia() {
    try {
        const d = await apiFetch('/caja/dia');
        const data = d.data || d;
        cajasDia = data.cajas || data || [];
        if (!Array.isArray(cajasDia)) cajasDia = [];
    } catch (e) {
        cajasDia = [];
    }
}

function renderPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <section class="ops-hero">
            <div class="ops-hero-main">
                <div class="ops-kicker">Control financiero diario</div>
                <h1 class="ops-title">Caja y arqueo de repartidores</h1>
                <p class="ops-subtitle">Registra apertura, ingresos, gastos de ruta y cierre de caja por repartidor al final de la jornada.</p>
                <div class="ops-actions">
                    <button class="btn btn-primary" onclick="openAbrirCajaModal()"><i class="fas fa-cash-register"></i> Abrir caja</button>
                    <button class="btn btn-success" onclick="openIngresoModal()"><i class="fas fa-plus-circle"></i> Registrar ingreso</button>
                    <button class="btn btn-danger" onclick="abrirGastoModal()"><i class="fas fa-minus-circle"></i> Registrar gasto</button>
                </div>
            </div>
            <div class="ops-panel">
                <div class="card-header">
                    <h3><i class="fas fa-scale-balanced"></i> Resumen supervisor</h3>
                    <button class="btn btn-sm btn-outline" onclick="renderResumen()"><i class="fas fa-rotate"></i></button>
                </div>
                <div class="card-body" id="resumen-caja"></div>
            </div>
        </section>

        <section class="cash-layout">
            <div id="detalle-caja"></div>
        </section>

        ${renderAbrirCajaModal()}
        ${renderIngresoModal()}
        ${renderGastoModal()}
    `;
}

function renderAbrirCajaModal() {
    return `
        <div id="abrir-caja-modal" class="modal-overlay">
            <div class="modal" style="max-width:460px;">
                <div class="modal-header">
                    <h3>Abrir caja del dia</h3>
                    <button class="modal-close" onclick="closeAbrirCajaModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="abrir-caja-form">
                        <div class="form-group">
                            <label>Repartidor *</label>
                            <select id="a-repartidor" class="form-control" required>
                                <option value="">Seleccione...</option>
                                ${repartidoresList.map(r => `<option value="${getRepartidorId(r)}">${cajaSafe(getRepartidorName(r))}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Monto inicial (Bs) *</label>
                            <input type="number" id="a-monto" class="form-control" step="0.01" min="0" value="0" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeAbrirCajaModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="abrirCaja()">Abrir caja</button>
                </div>
            </div>
        </div>
    `;
}

function renderIngresoModal() {
    return `
        <div id="ingreso-modal" class="modal-overlay">
            <div class="modal" style="max-width:460px;">
                <div class="modal-header">
                    <h3>Registrar ingreso</h3>
                    <button class="modal-close" onclick="closeIngresoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="ingreso-form">
                        <div class="form-group">
                            <label>Caja *</label>
                            <select id="i-caja" class="form-control" required></select>
                        </div>
                        <div class="form-group">
                            <label>Descripcion</label>
                            <input type="text" id="i-descripcion" class="form-control" maxlength="255" placeholder="Cobro entrega, transferencia, ajuste...">
                        </div>
                        <div class="form-group">
                            <label>Monto (Bs) *</label>
                            <input type="number" id="i-monto" class="form-control" step="0.01" min="0.01" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeIngresoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveIngreso()">Guardar ingreso</button>
                </div>
            </div>
        </div>
    `;
}

function renderGastoModal() {
    return `
        <div id="gasto-modal" class="modal-overlay">
            <div class="modal" style="max-width:480px;">
                <div class="modal-header">
                    <h3>Registrar gasto</h3>
                    <button class="modal-close" onclick="closeGastoModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="gasto-form">
                        <div class="form-group">
                            <label>Caja *</label>
                            <select id="g-caja" class="form-control" required></select>
                        </div>
                        <div class="form-group">
                            <label>Tipo de gasto</label>
                            <select id="g-tipo" class="form-control">
                                ${TIPOS_GASTO.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Descripcion</label>
                            <input type="text" id="g-descripcion" class="form-control" maxlength="255" placeholder="Gasolina, alimentacion, implementos...">
                        </div>
                        <div class="form-group">
                            <label>Monto (Bs) *</label>
                            <input type="number" id="g-monto" class="form-control" step="0.01" min="0.01" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeGastoModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveGasto()">Guardar gasto</button>
                </div>
            </div>
        </div>
    `;
}

async function renderResumen() {
    await loadCajasDia();
    const resumen = await loadResumen();
    const container = document.getElementById('resumen-caja');
    if (!container) return;

    const ingresos = resumen?.ingresos_totales ?? sumCajas('ingresos');
    const gastos = resumen?.gastos_totales ?? sumCajas('gastos');
    const saldo = resumen?.saldo_total ?? (sumCajas('monto_inicial') + ingresos - gastos);
    const abiertas = resumen?.cajas_abiertas ?? cajasDia.filter(c => isCajaAbierta(c)).length;
    const cerradas = resumen?.cajas_cerradas ?? cajasDia.filter(c => !isCajaAbierta(c)).length;

    container.innerHTML = `
        <div class="ops-mini-metrics">
            <div><strong>Bs ${money(ingresos)}</strong><span>Ingresos</span></div>
            <div><strong>Bs ${money(gastos)}</strong><span>Gastos</span></div>
            <div><strong>Bs ${money(saldo)}</strong><span>Caja final</span></div>
            <div><strong>${abiertas}</strong><span>Abiertas</span></div>
            <div><strong>${cerradas}</strong><span>Cerradas</span></div>
        </div>
    `;

    renderDetalleCajas();
}

function renderDetalleCajas() {
    const container = document.getElementById('detalle-caja');
    if (!container) return;

    if (!cajasDia.length) {
        container.innerHTML = `
            <div class="ops-panel">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-cash-register"></i>
                        <h3>No hay cajas registradas hoy</h3>
                        <p>Abre una caja para el repartidor que iniciara ruta.</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="ops-panel">
            <div class="card-header">
                <h3><i class="fas fa-users"></i> Arqueo por repartidor</h3>
                <span class="text-muted">${cajasDia.length} caja(s)</span>
            </div>
            <div class="card-body">
                <div class="cash-card-grid">
                    ${cajasDia.map(renderCajaCard).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderCajaCard(c) {
    const abierta = isCajaAbierta(c);
    const gastos = Array.isArray(c.gastos) ? c.gastos : (Array.isArray(c.gastos_detalle) ? c.gastos_detalle : []);
    const rep = c.repartidor || {};
    const ingresos = parseMoney(c.ingresos);
    const gastosMonto = parseMoney(c.gastos_totales ?? c.total_gastos ?? (Array.isArray(c.gastos) ? gastos.reduce((s, g) => s + parseMoney(g.monto), 0) : c.gastos));
    const montoFinal = parseMoney(c.monto_final ?? (parseMoney(c.monto_inicial) + ingresos - gastosMonto));

    return `
        <article class="cash-card">
            <div class="cash-card-header">
                <div>
                    <h4>${cajaSafe(getRepartidorName(rep))}</h4>
                    <p>${formatDateShort(c.fecha || c.created_at)}</p>
                </div>
                ${getStatusBadge(getCajaEstado(c))}
            </div>
            <div class="cash-totals">
                <div class="cash-total"><strong>Bs ${money(c.monto_inicial)}</strong><span>Inicial</span></div>
                <div class="cash-total"><strong>Bs ${money(ingresos)}</strong><span>Ingresos</span></div>
                <div class="cash-total"><strong>Bs ${money(gastosMonto)}</strong><span>Gastos</span></div>
                <div class="cash-total"><strong>Bs ${money(montoFinal)}</strong><span>Final</span></div>
            </div>
            <div class="cash-actions">
                ${abierta ? `
                    <button class="btn btn-sm btn-success" onclick="openIngresoModal(${c.id_caja})"><i class="fas fa-plus"></i> Ingreso</button>
                    <button class="btn btn-sm btn-danger" onclick="abrirGastoModal(${c.id_caja})"><i class="fas fa-minus"></i> Gasto</button>
                    <button class="btn btn-sm btn-primary" onclick="cerrarCaja(${c.id_caja})"><i class="fas fa-check"></i> Cerrar</button>
                ` : '<span class="text-muted">Caja cerrada</span>'}
            </div>
            ${gastos.length ? `
                <div class="section-divider"></div>
                <table class="product-detail-table">
                    <thead><tr><th>Tipo</th><th>Detalle</th><th>Monto</th></tr></thead>
                    <tbody>
                        ${gastos.map(g => `
                            <tr>
                                <td>${cajaSafe(g.tipo_gasto || 'OTRO')}</td>
                                <td>${cajaSafe(g.descripcion || 'Sin descripcion')}</td>
                                <td>Bs ${money(g.monto)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        </article>
    `;
}

function openAbrirCajaModal() {
    document.getElementById('abrir-caja-form').reset();
    document.getElementById('abrir-caja-modal').classList.add('active');
}

function closeAbrirCajaModal() {
    document.getElementById('abrir-caja-modal').classList.remove('active');
}

async function abrirCaja() {
    const repartidorId = parseInt(document.getElementById('a-repartidor').value);
    const montoInicial = parseMoney(document.getElementById('a-monto').value);
    if (!repartidorId) return Swal.fire('Validacion', 'Seleccione un repartidor.', 'warning');

    try {
        await apiFetch('/caja/abrir', {
            method: 'POST',
            body: { repartidor_id: repartidorId, id_repartidor: repartidorId, monto_inicial: montoInicial }
        });
        Swal.fire('Caja abierta', 'Caja diaria creada para el repartidor.', 'success');
        closeAbrirCajaModal();
        await renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo abrir caja.', 'error');
    }
}

function openIngresoModal(cajaId = null) {
    ingresoCajaId = cajaId;
    fillCajaSelect('i-caja', cajaId);
    document.getElementById('ingreso-form').reset();
    if (cajaId) document.getElementById('i-caja').value = cajaId;
    document.getElementById('ingreso-modal').classList.add('active');
}

function closeIngresoModal() {
    document.getElementById('ingreso-modal').classList.remove('active');
    ingresoCajaId = null;
}

async function saveIngreso() {
    const idCaja = parseInt(document.getElementById('i-caja').value || ingresoCajaId);
    const descripcion = document.getElementById('i-descripcion').value.trim();
    const monto = parseMoney(document.getElementById('i-monto').value);
    if (!idCaja) return Swal.fire('Validacion', 'Seleccione una caja abierta.', 'warning');
    if (monto <= 0) return Swal.fire('Validacion', 'Ingrese un monto valido.', 'warning');

    try {
        await apiFetch('/caja/ingreso', {
            method: 'POST',
            body: { id_caja: idCaja, caja_id: idCaja, descripcion, monto }
        });
        Swal.fire('Registrado', 'Ingreso registrado correctamente.', 'success');
        closeIngresoModal();
        await renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo registrar ingreso.', 'error');
    }
}

function abrirGastoModal(cajaId = null) {
    gastoCajaId = cajaId;
    fillCajaSelect('g-caja', cajaId);
    document.getElementById('gasto-form').reset();
    if (cajaId) document.getElementById('g-caja').value = cajaId;
    document.getElementById('gasto-modal').classList.add('active');
}

function closeGastoModal() {
    document.getElementById('gasto-modal').classList.remove('active');
    gastoCajaId = null;
}

async function saveGasto() {
    const idCaja = parseInt(document.getElementById('g-caja').value || gastoCajaId);
    const tipo_gasto = document.getElementById('g-tipo').value;
    const descripcion = document.getElementById('g-descripcion').value.trim();
    const monto = parseMoney(document.getElementById('g-monto').value);

    if (!idCaja) return Swal.fire('Validacion', 'Seleccione una caja abierta.', 'warning');
    if (monto <= 0) return Swal.fire('Validacion', 'Ingrese un monto valido.', 'warning');

    try {
        await apiFetch('/caja/gasto', {
            method: 'POST',
            body: { id_caja: idCaja, caja_id: idCaja, tipo_gasto, descripcion, monto }
        });
        Swal.fire('Registrado', 'Gasto registrado correctamente.', 'success');
        closeGastoModal();
        await renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo registrar gasto.', 'error');
    }
}

async function cerrarCaja(id) {
    const caja = cajasDia.find(c => parseInt(c.id_caja) === parseInt(id));
    const r = await Swal.fire({
        title: 'Cerrar caja',
        html: `
            <p>Revisa el arqueo antes de cerrar.</p>
            <p><strong>Repartidor:</strong> ${cajaSafe(getRepartidorName(caja?.repartidor || {}))}</p>
            <p><strong>Caja final:</strong> Bs ${money(caja?.monto_final ?? 0)}</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Cerrar caja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
    });
    if (!r.isConfirmed) return;

    try {
        await apiFetch(`/caja/cerrar/${id}`, { method: 'PUT' });
        Swal.fire('Cerrada', 'Caja cerrada exitosamente.', 'success');
        await renderResumen();
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo cerrar caja.', 'error');
    }
}

function fillCajaSelect(selectId, selectedId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const abiertas = cajasDia.filter(isCajaAbierta);
    select.innerHTML = '<option value="">Seleccione caja...</option>' + abiertas.map(c => `
        <option value="${c.id_caja}" ${String(c.id_caja) === String(selectedId || '') ? 'selected' : ''}>
            ${cajaSafe(getRepartidorName(c.repartidor || {}))} - Bs ${money(c.monto_final ?? c.monto_inicial)}
        </option>
    `).join('');
}

function isCajaAbierta(c) {
    return normalizeCaja(getCajaEstado(c)).includes('abierta') || normalizeCaja(c.estado) === 'abierta';
}

function getCajaEstado(c) {
    return c?.estado?.nombre_estado || c?.nombre_estado || c?.estado || 'Abierta';
}

function getRepartidorId(r) {
    return parseInt(r?.id_repartidor || r?.repartidor_id || r?.id || 0);
}

function getRepartidorName(r) {
    const userName = `${r?.usuario?.nombre || ''} ${r?.usuario?.apellido || ''}`.trim();
    return r?.nombre || userName || r?.nombre_completo || 'Sin repartidor';
}

function sumCajas(field) {
    return cajasDia.reduce((s, c) => s + parseMoney(c[field]), 0);
}

function parseMoney(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

function money(value) {
    return parseMoney(value).toFixed(2);
}

function normalizeCaja(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cajaSafe(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}
