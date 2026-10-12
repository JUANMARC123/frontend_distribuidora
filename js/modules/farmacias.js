let cargosList = [];
let farmaciasData = [];
let pedidosData = [];
let editingFarmaciaId = null;
let editingContactoId = null;
let currentFarmaciaId = null;
let currentFarmaciaName = '';
let mapaModal = null;
let markerModal = null;
let mapaGlobal = null;
let marcadoresGlobales = [];

const DEFAULT_CARGOS = [
    { id_cargo: 1, nombre_cargo: 'Gerente' },
    { id_cargo: 2, nombre_cargo: 'Encargado' },
    { id_cargo: 3, nombre_cargo: 'Farmacéutico' },
    { id_cargo: 4, nombre_cargo: 'Administrador' },
    { id_cargo: 5, nombre_cargo: 'Recepcionista' },
];

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Farmacias', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await loadCargos();
    renderPage();
});

function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validarEmailInput(input) {
    input.style.borderColor = input.value && !esEmailValido(input.value) ? '#ef4444' : '';
}

async function loadCargos() {
    try {
        const data = await apiFetch('/catalogos/cargos');
        cargosList = Array.isArray(data) ? data : (data.data || []);
    } catch (e) {
        cargosList = DEFAULT_CARGOS;
    }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <section class="ops-hero">
            <div class="ops-hero-main">
                <div class="ops-kicker">Operaciones comerciales</div>
                <h1 class="ops-title">Farmacias activas</h1>
                <p class="ops-subtitle">Busca una farmacia, revisa su actividad de pedidos y crea nuevos pedidos sin cambiar de módulo.</p>
                <div class="ops-actions">
                    ${hasPermission('Farmacias', 'crear') ? '<button class="btn btn-primary" onclick="openFarmaciaModal()"><i class="fas fa-plus"></i> Nueva farmacia</button>' : ''}
                    ${hasPermission('Pedidos', 'crear') ? '<a class="btn btn-success" href="/pages/logistica.html#pedidos"><i class="fas fa-box"></i> Nuevo pedido</a>' : ''}
                </div>
            </div>
            <div class="ops-panel">
                <div class="card-header"><h3><i class="fas fa-map-marked-alt"></i> Mapa</h3><span id="mapa-contador" class="text-muted"></span></div>
                <div class="card-body" style="padding:0;">
                    <div id="mapa-farmacias-global" style="height:270px;border-radius:0 0 var(--radius) var(--radius);"></div>
                </div>
            </div>
        </section>

        <section class="ops-toolbar">
            <div class="ops-search">
                <i class="fas fa-search"></i>
                <input class="form-control" id="farmacias-search" placeholder="Buscar farmacia, zona, teléfono o dirección" oninput="renderFarmaciaCards()">
            </div>
            <div class="flex gap-2">
                <button class="btn btn-outline" onclick="reloadFarmaciasView()"><i class="fas fa-rotate"></i> Actualizar</button>
            </div>
        </section>

        <section class="ops-card-grid" id="farmacias-cards">
            <div class="loading"><div class="spinner"></div>Cargando farmacias...</div>
        </section>

        ${renderFarmaciaModal()}
        ${renderProfileModal()}
        ${renderContactosModal()}
        ${renderContactoFormModal()}
    `;

    reloadFarmaciasView();
    setTimeout(initMapaGlobal, 250);
}

function renderFarmaciaModal() {
    return `
        <div id="modal-farmacia" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3 id="farmacia-modal-title">Nueva farmacia</h3>
                    <button class="modal-close" onclick="closeFarmaciaModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-farmacia">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Nombre *</label>
                                <input type="text" id="f-nombre" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Teléfono</label>
                                <input type="text" id="f-telefono" class="form-control" placeholder="8 dígitos" maxlength="8" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Dirección *</label>
                            <input type="text" id="f-direccion" class="form-control" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="text" id="f-email" class="form-control" placeholder="ejemplo@correo.com" oninput="validarEmailInput(this)">
                            </div>
                            <div class="form-group">
                                <label>Latitud</label>
                                <input type="number" step="any" id="f-latitud" class="form-control">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Longitud</label>
                                <input type="number" step="any" id="f-longitud" class="form-control">
                            </div>
                        </div>
                        <div id="coords-display" class="text-muted text-center" style="font-size:12px;margin-bottom:8px;">Haz clic en el mapa para seleccionar ubicación</div>
                        <div id="mapa-modal" style="height:300px;border-radius:8px;overflow:hidden;border:1px solid var(--border);"></div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeFarmaciaModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveFarmacia()">Guardar</button>
                </div>
            </div>
        </div>
    `;
}

function renderProfileModal() {
    return `
        <div id="modal-farmacia-profile" class="modal-overlay">
            <div class="modal" style="max-width:900px;">
                <div class="modal-header">
                    <h3 id="profile-title">Ficha de farmacia</h3>
                    <button class="modal-close" onclick="closeProfileModal()">&times;</button>
                </div>
                <div class="modal-body" id="profile-body"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeProfileModal()">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

function renderContactosModal() {
    return `
        <div id="modal-contactos" class="modal-overlay">
            <div class="modal" style="max-width:760px;">
                <div class="modal-header">
                    <h3 id="contactos-modal-title">Contactos</h3>
                    <button class="modal-close" onclick="closeContactosModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                        <span id="farmacia-name-ref" style="font-weight:600;"></span>
                        ${hasPermission('Farmacias', 'gestionar-contactos') ? '<button class="btn btn-sm btn-primary" onclick="openContactoModal()"><i class="fas fa-plus"></i> Agregar contacto</button>' : ''}
                    </div>
                    <div id="contactos-list"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactosModal()">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

function renderContactoFormModal() {
    return `
        <div id="modal-contacto" class="modal-overlay">
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3 id="contacto-modal-title">Nuevo contacto</h3>
                    <button class="modal-close" onclick="closeContactoFormModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-contacto">
                        <div class="form-group"><label>Nombre del contacto *</label><input type="text" id="c-nombre" class="form-control" required></div>
                        <div class="form-group"><label>Cargo *</label><select id="c-cargo" class="form-control" required><option value="">Seleccione un cargo...</option>${cargosList.map(c => `<option value="${c.id_cargo}">${c.nombre_cargo}</option>`).join('')}</select></div>
                        <div class="form-row">
                            <div class="form-group"><label>Teléfono</label><input type="text" id="c-telefono" class="form-control" placeholder="8 dígitos" maxlength="8" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8)"></div>
                            <div class="form-group"><label>Email</label><input type="text" id="c-email" class="form-control" placeholder="ejemplo@correo.com" oninput="validarEmailInput(this)"></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeContactoFormModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveContacto()">Guardar</button>
                </div>
            </div>
        </div>
    `;
}

async function reloadFarmaciasView() {
    try {
        const [farmaciasResp, pedidosResp] = await Promise.all([
            apiFetch('/farmacias?per_page=-1'),
            apiFetch('/pedidos?per_page=-1').catch(() => []),
        ]);
        farmaciasData = Array.isArray(farmaciasResp) ? farmaciasResp : (farmaciasResp.data || []);
        pedidosData = Array.isArray(pedidosResp) ? pedidosResp : (pedidosResp.data || []);
        renderFarmaciaCards();
        actualizarMarcadoresGlobales(farmaciasData);
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar las farmacias: ' + (e.message || ''), 'error');
    }
}

function getFarmaciaStats(idFarmacia) {
    const pedidos = pedidosData.filter(p => String(p.id_farmacia || p.farmacia?.id_farmacia) === String(idFarmacia));
    const hoy = new Date().toISOString().slice(0, 10);
    const today = pedidos.filter(p => String(p.fecha_pedido || '').slice(0, 10) === hoy);
    const byStatus = name => pedidos.filter(p => normalizeStatus(p.estado?.nombre_estado || p.nombre_estado).includes(name)).length;
    const activeDebt = pedidos
        .filter(p => !normalizeStatus(p.estado?.nombre_estado || p.nombre_estado).includes('entregado'))
        .reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
    return {
        total: pedidos.length,
        today: today.length,
        pendientes: byStatus('pendiente'),
        enRuta: byStatus('ruta') + byStatus('despachado'),
        entregados: byStatus('entregado'),
        activeDebt,
        recientes: pedidos.slice(0, 4),
    };
}

function normalizeStatus(value) { return normalize(value); }

function renderFarmaciaCards() {
    const term = (document.getElementById('farmacias-search')?.value || '').trim().toLowerCase();
    const filtered = farmaciasData.filter(f => {
        const text = `${f.nombre || ''} ${f.direccion || ''} ${f.telefono || ''} ${f.email || ''}`.toLowerCase();
        return !term || text.includes(term);
    });

    const container = document.getElementById('farmacias-cards');
    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-hospital"></i><h4>Sin farmacias</h4><p>No se encontraron farmacias con ese criterio.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(f => {
        const stats = getFarmaciaStats(f.id_farmacia);
        const hasCoords = f.latitud && f.longitud;
        return `
            <article class="client-card">
                <div class="client-card-header">
                    <div>
                        <h4>${f.nombre || 'Farmacia sin nombre'}</h4>
                        <div class="client-meta">
                            <span><i class="fas fa-location-dot"></i> ${f.direccion || 'Sin dirección'}</span>
                            <span><i class="fas fa-phone"></i> ${f.telefono || 'Sin teléfono'}</span>
                            <span><i class="fas fa-envelope"></i> ${f.email || 'Sin email'}</span>
                        </div>
                    </div>
                    <span class="badge ${hasCoords ? 'badge-success' : 'badge-warning'}">${hasCoords ? 'Con mapa' : 'Sin mapa'}</span>
                </div>
                <div class="client-stats">
                    <div class="client-stat"><strong>${stats.today}</strong><span>Hoy</span></div>
                    <div class="client-stat"><strong>${stats.pendientes}</strong><span>Pendientes</span></div>
                    <div class="client-stat"><strong>${stats.enRuta}</strong><span>En ruta</span></div>
                </div>
                <div class="client-stats">
                    <div class="client-stat"><strong>${stats.entregados}</strong><span>Entregados</span></div>
                    <div class="client-stat" style="grid-column:span 2;"><strong>Bs ${stats.activeDebt.toFixed(2)}</strong><span>Monto activo</span></div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-sm btn-outline" onclick="openFarmaciaProfile(${f.id_farmacia})"><i class="fas fa-eye"></i> Ver pedidos</button>
                    ${hasPermission('Pedidos', 'crear') ? `<button class="btn btn-sm btn-success" onclick="crearPedidoDesdeFarmacia(${f.id_farmacia})"><i class="fas fa-plus"></i> Crear pedido</button>` : ''}
                    ${hasPermission('Farmacias', 'gestionar-contactos') ? `<button class="btn btn-sm btn-info" onclick="openContactosModal(${f.id_farmacia}, '${escapeAttr(f.nombre || '')}')"><i class="fas fa-address-book"></i> Contactos</button>` : ''}
                    ${hasPermission('Farmacias', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="editFarmacia(${f.id_farmacia})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Farmacias', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="deleteFarmacia(${f.id_farmacia}, '${escapeAttr(f.nombre || '')}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </article>
        `;
    }).join('');
}

function escapeAttr(value) {
    return String(value).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function crearPedidoDesdeFarmacia(idFarmacia) {
    window.location.href = '/pages/logistica.html#pedidos';
}

function openFarmaciaProfile(idFarmacia) {
    const farmacia = farmaciasData.find(f => String(f.id_farmacia) === String(idFarmacia));
    if (!farmacia) return;
    const stats = getFarmaciaStats(idFarmacia);
    document.getElementById('profile-title').textContent = farmacia.nombre || 'Ficha de farmacia';
    document.getElementById('profile-body').innerHTML = `
        <div class="operations-split">
            <div>
                <div class="client-meta" style="font-size:14px;">
                    <span><strong>Dirección:</strong> ${farmacia.direccion || 'Sin dirección'}</span>
                    <span><strong>Teléfono:</strong> ${farmacia.telefono || 'Sin teléfono'}</span>
                    <span><strong>Email:</strong> ${farmacia.email || 'Sin email'}</span>
                </div>
                <div class="client-stats mt-4">
                    <div class="client-stat"><strong>${stats.pendientes}</strong><span>Pendientes</span></div>
                    <div class="client-stat"><strong>${stats.enRuta}</strong><span>En ruta</span></div>
                    <div class="client-stat"><strong>${stats.entregados}</strong><span>Entregados</span></div>
                </div>
                <div class="ops-actions">
                    ${hasPermission('Pedidos', 'crear') ? `<button class="btn btn-success" onclick="crearPedidoDesdeFarmacia(${idFarmacia})"><i class="fas fa-plus"></i> Nuevo pedido</button>` : ''}
                    <button class="btn btn-outline" onclick="openContactosModal(${idFarmacia}, '${escapeAttr(farmacia.nombre || '')}')"><i class="fas fa-address-book"></i> Contactos</button>
                </div>
            </div>
            <div>
                <h4>Pedidos recientes</h4>
                ${stats.recientes.length ? stats.recientes.map(p => `
                    <div class="order-card" style="margin-top:8px;">
                        <div class="order-card-header">
                            <div><div class="order-id">Pedido #${p.id_pedido}</div><h4>${p.detalles_count ?? p.detalles?.length ?? 0} productos</h4></div>
                            ${getStatusBadge(p.estado?.nombre_estado || p.nombre_estado || 'Pendiente')}
                        </div>
                        <div class="order-meta"><span>${formatDate(p.fecha_pedido)}</span><span>Bs ${parseFloat(p.total || 0).toFixed(2)}</span></div>
                    </div>
                `).join('') : '<p class="text-muted">Esta farmacia aún no tiene pedidos cargados.</p>'}
            </div>
        </div>
    `;
    document.getElementById('modal-farmacia-profile').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('modal-farmacia-profile').classList.remove('active');
}

function openFarmaciaModal() {
    editingFarmaciaId = null;
    document.getElementById('farmacia-modal-title').textContent = 'Nueva farmacia';
    document.getElementById('form-farmacia').reset();
    document.getElementById('modal-farmacia').classList.add('active');
    document.getElementById('coords-display').textContent = 'Haz clic en el mapa para seleccionar ubicación';
    setTimeout(initMapaModal, 200);
}

function closeFarmaciaModal() {
    document.getElementById('modal-farmacia').classList.remove('active');
    editingFarmaciaId = null;
    if (markerModal && mapaModal) {
        mapaModal.removeLayer(markerModal);
        markerModal = null;
    }
}

async function editFarmacia(id) {
    try {
        const data = await apiFetch(`/farmacias/${id}`);
        const farmacia = data.farmacia || data.data || data;
        editingFarmaciaId = id;
        document.getElementById('farmacia-modal-title').textContent = 'Editar farmacia';
        document.getElementById('f-nombre').value = farmacia.nombre || '';
        document.getElementById('f-direccion').value = farmacia.direccion || '';
        document.getElementById('f-telefono').value = farmacia.telefono || '';
        document.getElementById('f-email').value = farmacia.email || '';
        document.getElementById('f-latitud').value = farmacia.latitud || '';
        document.getElementById('f-longitud').value = farmacia.longitud || '';
        document.getElementById('modal-farmacia').classList.add('active');
        document.getElementById('coords-display').textContent = farmacia.latitud
            ? `Lat: ${parseFloat(farmacia.latitud).toFixed(6)} | Lng: ${parseFloat(farmacia.longitud).toFixed(6)}`
            : 'Haz clic en el mapa para seleccionar ubicación';
        setTimeout(function () {
            initMapaModal();
            if (farmacia.latitud && farmacia.longitud) {
                const lat = parseFloat(farmacia.latitud);
                const lng = parseFloat(farmacia.longitud);
                mapaModal.setView([lat, lng], 15);
                setMarker(lat, lng);
            }
        }, 200);
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar la farmacia', 'error');
    }
}

async function saveFarmacia() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const direccion = document.getElementById('f-direccion').value.trim();
    const telefono = document.getElementById('f-telefono').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const latitud = document.getElementById('f-latitud').value;
    const longitud = document.getElementById('f-longitud').value;

    if (!nombre || !direccion) return Swal.fire('Validación', 'Nombre y dirección son obligatorios', 'warning');
    if (telefono && telefono.length !== 8) return Swal.fire('Validación', 'El teléfono debe tener exactamente 8 dígitos', 'warning');
    if (email && !esEmailValido(email)) return Swal.fire('Validación', 'El email ingresado no es válido', 'warning');

    const latNum = latitud ? parseFloat(latitud) : null;
    const lngNum = longitud ? parseFloat(longitud) : null;
    if (latNum !== null && (latNum < -90 || latNum > 90)) return Swal.fire('Validación', 'La latitud debe estar entre -90 y 90', 'warning');
    if (lngNum !== null && (lngNum < -180 || lngNum > 180)) return Swal.fire('Validación', 'La longitud debe estar entre -180 y 180', 'warning');

    const body = { nombre, direccion, telefono, email, latitud: latNum, longitud: lngNum };
    try {
        if (editingFarmaciaId) {
            await apiFetch(`/farmacias/${editingFarmaciaId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Farmacia actualizada correctamente', 'success');
        } else {
            await apiFetch('/farmacias', { method: 'POST', body });
            Swal.fire('Creado', 'Farmacia creada correctamente', 'success');
        }
        closeFarmaciaModal();
        await reloadFarmaciasView();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar', 'error');
    }
}

async function deleteFarmacia(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar farmacia?',
        text: `Se eliminará "${nombre}" y todos sus datos asociados.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
        await apiFetch(`/farmacias/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Farmacia eliminada correctamente', 'success');
        await reloadFarmaciasView();
    } catch (e) {
        Swal.fire('No se puede eliminar', 'Esta farmacia tiene pedidos u otros registros asociados.', 'warning');
    }
}

async function openContactosModal(farmaciaId, farmaciaName) {
    currentFarmaciaId = farmaciaId;
    currentFarmaciaName = farmaciaName;
    document.getElementById('farmacia-name-ref').textContent = `Contactos de: ${farmaciaName}`;
    document.getElementById('modal-contactos').classList.add('active');
    await loadContactos();
}

function closeContactosModal() {
    document.getElementById('modal-contactos').classList.remove('active');
    currentFarmaciaId = null;
}

async function loadContactos() {
    const container = document.getElementById('contactos-list');
    try {
        const data = await apiFetch(`/farmacias/${currentFarmaciaId}/contactos`);
        const contactos = Array.isArray(data) ? data : (data.data || []);
        if (!contactos.length) {
            container.innerHTML = '<div class="empty-state" style="padding:24px;"><i class="fas fa-address-book"></i><h4>Sin contactos</h4><p>Agrega el primer contacto de esta farmacia.</p></div>';
            return;
        }
        container.innerHTML = `
            <table class="table" style="width:100%;">
                <thead><tr><th>Nombre</th><th>Cargo</th><th>Teléfono</th><th>Email</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${contactos.map(c => {
                        const cid = c.id_contacto;
                        return `<tr>
                            <td>${c.nombre_contacto || '—'}</td>
                            <td>${c.cargo?.nombre_cargo || c.nombre_cargo || '—'}</td>
                            <td>${c.telefono || '—'}</td>
                            <td>${c.email || '—'}</td>
                            <td>
                                <div class="actions">
                                    ${hasPermission('Farmacias', 'gestionar-contactos') ? `<button class="btn btn-sm btn-warning" onclick="editContacto(${cid})"><i class="fas fa-edit"></i></button>` : ''}
                                    ${hasPermission('Farmacias', 'gestionar-contactos') ? `<button class="btn btn-sm btn-danger" onclick="deleteContacto(${cid}, '${escapeAttr(c.nombre_contacto || '')}')"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = '<p class="text-muted">No se pudieron cargar los contactos.</p>';
    }
}

function openContactoModal() {
    editingContactoId = null;
    document.getElementById('contacto-modal-title').textContent = 'Nuevo contacto';
    document.getElementById('form-contacto').reset();
    document.getElementById('modal-contacto').classList.add('active');
}

function closeContactoFormModal() {
    document.getElementById('modal-contacto').classList.remove('active');
    editingContactoId = null;
}

async function editContacto(id) {
    try {
        const data = await apiFetch(`/farmacias/${currentFarmaciaId}/contactos/${id}`);
        const contacto = data.contacto || data.data || data;
        editingContactoId = id;
        document.getElementById('contacto-modal-title').textContent = 'Editar contacto';
        document.getElementById('c-nombre').value = contacto.nombre_contacto || '';
        document.getElementById('c-cargo').value = contacto.id_cargo || '';
        document.getElementById('c-telefono').value = contacto.telefono || '';
        document.getElementById('c-email').value = contacto.email || '';
        document.getElementById('modal-contacto').classList.add('active');
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar el contacto', 'error');
    }
}

async function saveContacto() {
    const nombre = document.getElementById('c-nombre').value.trim();
    const id_cargo = document.getElementById('c-cargo').value;
    const telefono = document.getElementById('c-telefono').value.trim();
    const email = document.getElementById('c-email').value.trim();
    if (!nombre || !id_cargo) return Swal.fire('Validación', 'Nombre y cargo son obligatorios', 'warning');
    if (telefono && telefono.length !== 8) return Swal.fire('Validación', 'El teléfono debe tener exactamente 8 dígitos', 'warning');
    if (email && !esEmailValido(email)) return Swal.fire('Validación', 'El email ingresado no es válido', 'warning');
    const body = { nombre_contacto: nombre, id_cargo: parseInt(id_cargo), telefono, email };
    try {
        if (editingContactoId) {
            await apiFetch(`/farmacias/${currentFarmaciaId}/contactos/${editingContactoId}`, { method: 'PUT', body });
            Swal.fire('Actualizado', 'Contacto actualizado correctamente', 'success');
        } else {
            await apiFetch(`/farmacias/${currentFarmaciaId}/contactos`, { method: 'POST', body });
            Swal.fire('Creado', 'Contacto creado correctamente', 'success');
        }
        closeContactoFormModal();
        await loadContactos();
        await reloadFarmaciasView();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al guardar el contacto', 'error');
    }
}

async function deleteContacto(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar contacto?',
        text: `Se eliminará "${nombre}".`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
        await apiFetch(`/farmacias/${currentFarmaciaId}/contactos/${id}`, { method: 'DELETE' });
        Swal.fire('Eliminado', 'Contacto eliminado correctamente', 'success');
        await loadContactos();
        await reloadFarmaciasView();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al eliminar', 'error');
    }
}

function initMapaModal() {
    const container = document.getElementById('mapa-modal');
    if (!container) return;
    if (mapaModal) {
        mapaModal.invalidateSize();
        return;
    }
    mapaModal = L.map('mapa-modal').setView([-16.4897, -67.8217], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaModal);
    mapaModal.on('click', function (e) {
        setMarker(e.latlng.lat, e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
}

function setMarker(lat, lng) {
    if (markerModal) mapaModal.removeLayer(markerModal);
    markerModal = L.marker([lat, lng], { draggable: true }).addTo(mapaModal);
    markerModal.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        document.getElementById('f-latitud').value = pos.lat.toFixed(8);
        document.getElementById('f-longitud').value = pos.lng.toFixed(8);
        document.getElementById('coords-display').textContent = `Lat: ${pos.lat.toFixed(6)} | Lng: ${pos.lng.toFixed(6)}`;
        reverseGeocode(pos.lat, pos.lng);
    });
    document.getElementById('f-latitud').value = lat.toFixed(8);
    document.getElementById('f-longitud').value = lng.toFixed(8);
    document.getElementById('coords-display').textContent = `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)}`;
}

function reverseGeocode(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r => r.json())
        .then(data => {
            if (data.display_name) document.getElementById('f-direccion').value = data.display_name;
        })
        .catch(() => {});
}

function initMapaGlobal() {
    const container = document.getElementById('mapa-farmacias-global');
    if (!container) return;
    if (mapaGlobal) {
        mapaGlobal.invalidateSize();
        return;
    }
    mapaGlobal = L.map('mapa-farmacias-global').setView([-16.4897, -67.8217], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaGlobal);
    actualizarMarcadoresGlobales(farmaciasData);
}

function actualizarMarcadoresGlobales(farmacias) {
    if (!mapaGlobal) return;
    marcadoresGlobales.forEach(m => mapaGlobal.removeLayer(m.marker));
    marcadoresGlobales = [];
    let count = 0;
    farmacias.forEach(f => {
        const lat = parseFloat(f.latitud);
        const lng = parseFloat(f.longitud);
        if (isNaN(lat) || isNaN(lng)) return;
        count++;
        const marker = L.circleMarker([lat, lng], {
            radius: 7,
            fillColor: '#3b82f6',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
        }).addTo(mapaGlobal);
        marker.bindPopup(`<b>${f.nombre}</b><br>${f.direccion || 'Sin dirección'}<br>${f.telefono || ''}`);
        marker.on('click', () => openFarmaciaProfile(f.id_farmacia));
        marcadoresGlobales.push({ id: f.id_farmacia, marker, data: f });
    });
    const counter = document.getElementById('mapa-contador');
    if (counter) counter.textContent = `${count} en mapa`;
}
