// GPS_FIREBASE_CONFIG and GPS_MAPBOX_TOKEN are loaded from map-config.js
// which reads from window.MAPBOX_TOKEN and window.FIREBASE_CONFIG set by config.js

let trackingMap = null;
let trackingMarkers = {};
let trackingActiveId = null;
let firebaseTrackingRef = null;
let rutasActivas = [];
let trackingUserInteracted = false;
let gpsPositionHistory = {};
let gpsTrailDots = {};
var firebaseUsuariosData = firebaseUsuariosData !== undefined ? firebaseUsuariosData : null;

// Stop modal state
let currentStop = null;
let currentRutaForStop = null;
let currentStopIdx = -1;

async function initTracking() {
    await loadRutasActivas();
    initTrackingMap();
    listenFirebaseTracking();
}

async function loadRutasActivas() {
    try {
        const d = await apiFetch('/logistica/rutas-activas');
        rutasActivas = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        console.error('Error loading rutas activas:', e);
        rutasActivas = [];
    }

    renderTrackingSummary();
    renderTrackingList();

    if (rutasActivas.length > 0 && !trackingActiveId) {
        trackingActiveId = getRutaId(rutasActivas[0]);
    }
    if (trackingActiveId) selectTrackingRuta(trackingActiveId);
}

function renderTrackingSummary() {
    const container = document.getElementById('tracking-summary');
    if (!container) return;
    const paradas = rutasActivas.reduce((s, r) => s + getRutaParadas(r).length, 0);
    const progreso = rutasActivas.length
        ? Math.round(rutasActivas.reduce((s, r) => s + getRutaProgreso(r), 0) / rutasActivas.length)
        : 0;
    container.innerHTML = `
        <div><strong>${rutasActivas.length}</strong><span>Rutas activas</span></div>
        <div><strong>${paradas}</strong><span>Paradas</span></div>
        <div><strong>${progreso}%</strong><span>Progreso prom.</span></div>
    `;
}

function renderTrackingList() {
    const container = document.getElementById('tracking-list-body');
    if (!container) return;
    const count = document.getElementById('tracking-count');
    if (count) count.textContent = rutasActivas.length;

    if (!rutasActivas.length) {
        container.innerHTML = '<div class="empty-state compact">No hay rutas activas.</div>';
        renderTrackingDetail(null);
        return;
    }

    container.innerHTML = rutasActivas.map(r => {
        const id = getRutaId(r);
        const rep = r.repartidor || {};
        const veh = r.vehiculo || { marca: r.marca, modelo: r.modelo, placa: r.placa };
        const progreso = getRutaProgreso(r);
        const paradas = getRutaParadas(r);
        const completadas = getRutaCompletadas(r);
        const isActive = trackingActiveId === id;
        const horaSalida = r.hora_salida ? r.hora_salida.substring(0, 5) : '';
        const estado = trackSafe(r.estado?.nombre_estado || r.estado || 'En curso');
        return `
            <article class="tracking-card ${isActive ? 'active' : ''}" onclick="selectTrackingRuta(${id})" data-ruta-id="${id}">
                <div class="tracking-card-head">
                    <strong>Ruta #${id}</strong>
                    ${getStatusBadge(estado)}
                </div>
                <div class="tracking-card-body">
                    <div class="tracking-card-repartidor">
                        <strong>${trackSafe(getRepartidorNameTracking(rep))}</strong>
                        <p>${trackSafe(formatVehiculoTracking(veh))}</p>
                        ${horaSalida ? '<p class="tracking-hora-salida"><i class="fas fa-clock"></i> Salida: <strong>' + horaSalida + '</strong></p>' : ''}
                    </div>
                    <div class="tracking-card-progress-section">
                        <div class="tracking-card-progress-header">
                            <span class="badge badge-success">${progreso}%</span>
                            <span>${completadas}/${paradas.length} paradas · ${estado}</span>
                        </div>
                        <div class="tracking-progress"><div class="tracking-progress-bar" style="width:${progreso}%"></div></div>
                        <small>${completadas} de ${paradas.length} paradas completadas</small>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function selectTrackingRuta(id) {
    trackingActiveId = parseInt(id);
    trackingUserInteracted = false;
    document.querySelectorAll('.tracking-card').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.rutaId) === trackingActiveId);
    });
    const ruta = rutasActivas.find(r => getRutaId(r) === trackingActiveId);
    renderTrackingDetail(ruta);
    Object.keys(gpsTrailDots).forEach(k => clearGPSTrail(k));
    updateTrackingMap(ruta);
}

function renderTrackingDetail(ruta) {
    var container = document.getElementById('tracking-detail');
    if (!container) return;
    if (!ruta) {
        container.innerHTML = '<div class="empty-state compact">Seleccione una ruta para ver paradas, entregas y eventos.</div>';
        return;
    }

    var paradas = getRutaParadas(ruta);
    var horaSalida = ruta.hora_salida ? ruta.hora_salida.substring(0, 5) : '—';

    var pendientes = [];
    var completadas = [];
    paradas.forEach(function (p) {
        var est = (p.estado?.nombre_estado || p.estado || '').toLowerCase();
        if (est.includes('entreg') || est.includes('fall') || est.includes('devol')) {
            completadas.push(p);
        } else {
            pendientes.push(p);
        }
    });

    var pendientesHtml = pendientes.length
        ? pendientes.map(function (p, idx) { return renderTrackingStop(p, idx, ruta); }).join('')
        : '<div class="empty-state compact">Todas las paradas completadas.</div>';

    var completadasHtml = completadas.length
        ? '<div id="tracking-completadas-toggle" class="tracking-completadas-toggle" onclick="toggleCompletadas()">' +
          '<i class="fas fa-check-circle"></i> Ver ' + completadas.length + ' completadas <i class="fas fa-chevron-down"></i>' +
          '</div>' +
          '<div id="tracking-completadas-list" class="tracking-completadas-list" style="display:none;">' +
          completadas.map(function (p, idx) { return renderTrackingStop(p, idx, ruta, true); }).join('') +
          '</div>'
        : '';

    container.innerHTML = '\
        <div class="tracking-detail-header">\
            <div>\
                <h3>Ruta #' + getRutaId(ruta) + '</h3>\
                <p>' + trackSafe(getRepartidorNameTracking(ruta.repartidor || {})) + '</p>\
                <p class="tracking-hora-salida"><i class="fas fa-clock"></i> Salida: <strong>' + horaSalida + '</strong></p>\
            </div>\
            ' + getStatusBadge(ruta.estado?.nombre_estado || ruta.estado || 'En curso') + '\
        </div>\
        <div class="route-progress-large">\
            <div class="route-progress-bar"><span style="width:' + getRutaProgreso(ruta) + '%"></span></div>\
            <small>' + getRutaCompletadas(ruta) + ' de ' + paradas.length + ' paradas completadas</small>\
        </div>\
        <div class="tracking-stops">\
            ' + pendientesHtml + '\
        </div>\
        ' + completadasHtml + '\
        <div class="route-events">\
            <div class="route-event muted">Eventos en vivo disponibles cuando Firebase publique cambios de la ruta.</div>\
        </div>\
    ';
}

function toggleCompletadas() {
    var list = document.getElementById('tracking-completadas-list');
    var toggle = document.getElementById('tracking-completadas-toggle');
    if (!list || !toggle) return;
    var isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    toggle.classList.toggle('open', isHidden);
}

function renderTrackingStop(stop, idx, ruta, isCompletada) {
    var estado = stop.estado?.nombre_estado || stop.estado || 'Pendiente';
    var farmacia = stop.farmacia || stop.pedido?.farmacia?.nombre || stop.nombre_farmacia || 'Sin farmacia';
    var pedido = stop.id_pedido || stop.pedido_id || stop.pedido?.id_pedido || '';
    var llegada = stop.hora_llegada;
    var estaCompletado = isCompletada || normalizeTrack(estado).includes('entreg') || normalizeTrack(estado).includes('fall') || normalizeTrack(estado).includes('devol');

    var actionsHtml = '';
    if (estaCompletado) {
        actionsHtml = '<span class="badge badge-success">Completado</span>';
    } else if (llegada) {
        var horaStr = typeof llegada === 'string' ? llegada.substring(0, 5) : llegada;
        actionsHtml = '\
            <span class="badge badge-info stop-llegada-badge"><i class="fas fa-clock"></i> ' + horaStr + '</span>\
            <button class="btn btn-sm btn-outline" onclick="openStopModal(' + idx + ')"><i class="fas fa-clipboard-list"></i></button>\
        ';
    } else {
        actionsHtml = '\
            <button class="btn btn-sm btn-success btn-llegar" onclick="registrarLlegada(' + getRutaId(ruta) + ', ' + idx + ')">\
                <i class="fas fa-truck"></i> Llegar\
            </button>\
        ';
    }

    var cls = estaCompletado ? ' tracking-stop-completed' : '';
    return '\
        <div class="tracking-stop' + cls + '">\
            <div class="stop-index">' + (idx + 1) + '</div>\
            <div class="stop-info">\
                <strong>' + trackSafe(farmacia) + '</strong>\
                <p>Pedido #' + (pedido || '-') + '</p>\
            </div>\
            <div class="stop-actions">\
                ' + actionsHtml + '\
            </div>\
        </div>\
    ';
}

// ─── Llegada a farmacia ───

async function registrarLlegada(rutaId, stopIdx) {
    const ruta = rutasActivas.find(r => getRutaId(r) === rutaId);
    if (!ruta) return;
    const paradas = getRutaParadas(ruta);
    const stop = paradas[stopIdx];
    if (!stop || !stop.id_parada) return;

    try {
        await apiFetch(`/logistica/rutas-activas/${rutaId}/registrar-llegada-parada`, {
            method: 'POST',
            body: { id_parada: stop.id_parada },
        });
        stop.hora_llegada = new Date().toTimeString().substring(0, 8);
        renderTrackingDetail(ruta);
        openStopModal(stopIdx);
    } catch (e) {
        Swal.fire('Error', 'No se pudo registrar la llegada: ' + (e.message || ''), 'error');
    }
}

// ─── Modal de accion en parada ───

function openStopModal(stopIdx) {
    const ruta = rutasActivas.find(r => getRutaId(r) === trackingActiveId);
    if (!ruta) return;
    const paradas = getRutaParadas(ruta);
    const stop = paradas[stopIdx];
    if (!stop) return;

    currentStop = stop;
    currentRutaForStop = ruta;
    currentStopIdx = stopIdx;

    const farmacia = stop.farmacia || stop.pedido?.farmacia?.nombre || stop.nombre_farmacia || 'Farmacia';
    const pedido = stop.id_pedido || stop.pedido_id || '';
    const llegada = stop.hora_llegada;
    const horaStr = llegada ? (typeof llegada === 'string' ? llegada.substring(0, 5) : llegada) : '—';
    const estado = stop.estado?.nombre_estado || stop.estado || 'Pendiente';
    const estaCompletado = normalizeTrack(estado).includes('entreg') || normalizeTrack(estado).includes('fall') || normalizeTrack(estado).includes('devol');

    const overlay = document.getElementById('stop-modal-overlay') || createStopModalElements();
    const modal = document.getElementById('stop-modal');

    modal.innerHTML = `
        <div class="stop-modal-header">
            <h3><i class="fas fa-store"></i> ${trackSafe(farmacia)}</h3>
            <button class="modal-close" onclick="closeStopModal()">&times;</button>
        </div>
        <div class="stop-modal-body">
            <div class="stop-modal-info">
                <div><strong>Pedido:</strong> #${pedido}</div>
                <div><strong>Hora llegada:</strong> ${horaStr}</div>
                <div><strong>Estado:</strong> ${getStatusBadge(estado)}</div>
            </div>

            ${!estaCompletado ? `
            <div class="stop-modal-section">
                <h4><i class="fas fa-exclamation-triangle"></i> Incidencias</h4>
                <div id="stop-incidencias-list" class="stop-modal-subsection">
                    <div class="loading-sm"><div class="spinner"></div></div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="agregarIncidencia()"><i class="fas fa-plus"></i> Agregar incidencia</button>
            </div>

            <div class="stop-modal-section">
                <h4><i class="fas fa-camera"></i> Evidencias</h4>
                <div id="stop-evidencias-list" class="stop-modal-subsection">
                    <div class="loading-sm"><div class="spinner"></div></div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="agregarEvidencia()"><i class="fas fa-plus"></i> Subir evidencia</button>
            </div>

            <div class="stop-modal-actions">
                <button class="btn btn-success" onclick="marcarEntregado()"><i class="fas fa-check"></i> Entregado</button>
                <button class="btn btn-danger" onclick="marcarFallido()"><i class="fas fa-times"></i> Fallido</button>
                <button class="btn btn-warning" onclick="marcarDevolucion()"><i class="fas fa-undo"></i> Devolucion</button>
            </div>
            ` : `
            <div class="stop-modal-section">
                <p class="text-muted">Esta parada ya fue completada.</p>
            </div>
            `}
        </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    if (!estaCompletado) {
        loadStopIncidencias();
        loadStopEvidencias();
    }
}

function closeStopModal() {
    const overlay = document.getElementById('stop-modal-overlay');
    const modal = document.getElementById('stop-modal');
    if (overlay) overlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    currentStop = null;
    currentRutaForStop = null;
    currentStopIdx = -1;
}

function createStopModalElements() {
    const overlay = document.createElement('div');
    overlay.id = 'stop-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeStopModal(); };

    const modal = document.createElement('div');
    modal.id = 'stop-modal';
    modal.className = 'modal stop-action-modal';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return overlay;
}

// ─── Incidencias en la parada ───

async function loadStopIncidencias() {
    const container = document.getElementById('stop-incidencias-list');
    if (!container || !currentStop) return;
    const idDespacho = currentStop.id_despacho;
    if (!idDespacho) { container.innerHTML = '<p class="text-muted">Sin incidencias.</p>'; return; }

    try {
        const d = await apiFetch(`/despachos/${idDespacho}/incidencias`);
        const data = Array.isArray(d) ? d : (d.data || []);
        if (!data.length) {
            container.innerHTML = '<p class="text-muted">Sin incidencias registradas.</p>';
        } else {
            container.innerHTML = data.map(inc => `
                <div class="incidencia-item">
                    <span class="badge badge-warning">${trackSafe(inc.tipo?.nombre_tipo || inc.nombre_tipo || '—')}</span>
                    <span>${trackSafe(inc.descripcion || '')}</span>
                </div>
            `).join('');
        }
    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error al cargar incidencias.</p>';
    }
}

async function agregarIncidencia() {
    if (!currentStop) return;

    const { value: formData } = await Swal.fire({
        title: 'Nueva Incidencia',
        html: `
            <div class="form-group">
                <label>Tipo de incidencia</label>
                <select id="swal-tipo-inc" class="form-control">
                    <option value="1">Producto dañado</option>
                    <option value="2">Retraso</option>
                    <option value="3">Dirección incorrecta</option>
                    <option value="4">Cliente ausente</option>
                </select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea id="swal-desc-inc" class="form-control" rows="3" placeholder="Describa la incidencia..."></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const tipo = parseInt(document.getElementById('swal-tipo-inc').value);
            const descripcion = document.getElementById('swal-desc-inc').value.trim();
            if (!descripcion) { Swal.showValidationMessage('La descripción es obligatoria'); return false; }
            return { id_tipo_incidencia: tipo, descripcion };
        }
    });

    if (!formData) return;

    try {
        await apiFetch(`/despachos/${currentStop.id_despacho}/incidencias`, {
            method: 'POST',
            body: formData,
        });
        Swal.fire('Registrada', 'Incidencia registrada correctamente', 'success');
        loadStopIncidencias();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al registrar incidencia', 'error');
    }
}

// ─── Evidencias en la parada ───

async function loadStopEvidencias() {
    const container = document.getElementById('stop-evidencias-list');
    if (!container || !currentStop) return;
    const idDespacho = currentStop.id_despacho;
    if (!idDespacho) { container.innerHTML = '<p class="text-muted">Sin evidencias.</p>'; return; }

    try {
        const d = await apiFetch(`/despachos/${idDespacho}/evidencias`);
        const data = Array.isArray(d) ? d : (d.data || []);
        if (!data.length) {
            container.innerHTML = '<p class="text-muted">Sin evidencias subidas.</p>';
        } else {
            container.innerHTML = data.map(ev => {
                const url = ev.archivo
                    ? (ev.archivo.startsWith('http') ? ev.archivo : `http://127.0.0.1:8000/storage/${ev.archivo}`)
                    : null;
                return `
                    <div class="evidencia-item">
                        <span class="badge badge-info">${trackSafe(ev.tipoEvidencia?.nombre_tipo || ev.tipo?.nombre_tipo || ev.nombre_tipo || '—')}</span>
                        ${url ? `<a href="${url}" target="_blank" class="btn btn-sm btn-outline"><i class="fas fa-eye"></i> Ver</a>` : '<span class="text-muted">Sin archivo</span>'}
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error al cargar evidencias.</p>';
    }
}

async function agregarEvidencia() {
    if (!currentStop) return;

    const { value: formData } = await Swal.fire({
        title: 'Subir Evidencia',
        html: `
            <div class="form-group">
                <label>Tipo de evidencia</label>
                <select id="swal-tipo-ev" class="form-control">
                    <option value="1">Foto</option>
                    <option value="2">Firma</option>
                    <option value="3">PDF</option>
                </select>
            </div>
            <div class="form-group">
                <label>Archivo</label>
                <input type="file" id="swal-archivo-ev" class="form-control" style="padding:8px;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Subir',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const tipo = parseInt(document.getElementById('swal-tipo-ev').value);
            const archivo = document.getElementById('swal-archivo-ev').files[0];
            if (!archivo) { Swal.showValidationMessage('Seleccione un archivo'); return false; }
            const fd = new FormData();
            fd.append('id_tipo_evidencia', tipo);
            fd.append('archivo', archivo);
            return fd;
        }
    });

    if (!formData) return;

    try {
        await apiFetch(`/despachos/${currentStop.id_despacho}/evidencias`, {
            method: 'POST',
            body: formData,
        });
        Swal.fire('Subida', 'Evidencia subida correctamente', 'success');
        loadStopEvidencias();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al subir evidencia', 'error');
    }
}

// ─── Acciones de entrega ───

async function marcarEntregado() {
    if (!currentStop || !currentRutaForStop) return;
    const rutaId = getRutaId(currentRutaForStop);
    const idDespacho = currentStop.id_despacho;
    const idPedido = currentStop.id_pedido || currentStop.pedido_id;
    const idParada = currentStop.id_parada;

    if (!idParada || !idDespacho || !idPedido) {
        return Swal.fire('Error', 'Faltan datos de la parada', 'error');
    }

    try {
        await apiFetch(`/logistica/rutas-activas/${rutaId}/entrega-completada`, {
            method: 'POST',
            body: { id_parada: idParada, id_despacho: idDespacho, id_pedido: idPedido },
        });
        Swal.fire('Completada', 'Entrega marcada como completada', 'success');
        closeStopModal();
        await refreshRutaDetail();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al marcar entrega', 'error');
    }
}

async function marcarFallido() {
    if (!currentStop || !currentRutaForStop) return;
    const rutaId = getRutaId(currentRutaForStop);
    const idDespacho = currentStop.id_despacho;
    const idPedido = currentStop.id_pedido || currentStop.pedido_id;
    const idParada = currentStop.id_parada;

    if (!idParada || !idDespacho || !idPedido) {
        return Swal.fire('Error', 'Faltan datos de la parada', 'error');
    }

    const { value: motivo } = await Swal.fire({
        title: 'Entrega Fallida',
        input: 'textarea',
        inputLabel: 'Motivo (opcional)',
        inputPlaceholder: 'Describa el motivo...',
        showCancelButton: true,
        confirmButtonText: 'Marcar fallido',
        cancelButtonText: 'Cancelar',
    });

    try {
        await apiFetch(`/logistica/rutas-activas/${rutaId}/entrega-fallida`, {
            method: 'POST',
            body: { id_parada: idParada, id_despacho: idDespacho, id_pedido: idPedido, motivo: motivo || '' },
        });
        Swal.fire('Registrada', 'Entrega marcada como fallida', 'success');
        closeStopModal();
        await refreshRutaDetail();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al marcar fallido', 'error');
    }
}

async function marcarDevolucion() {
    if (!currentStop || !currentRutaForStop) return;
    const rutaId = getRutaId(currentRutaForStop);
    const idDespacho = currentStop.id_despacho;
    const idPedido = currentStop.id_pedido || currentStop.pedido_id;
    const idParada = currentStop.id_parada;

    if (!idParada || !idDespacho || !idPedido) {
        return Swal.fire('Error', 'Faltan datos de la parada', 'error');
    }

    const r = await Swal.fire({
        title: 'Confirmar devolución',
        text: '¿Esta seguro de registrar la devolución de este pedido?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, devolución',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
    });

    if (!r.isConfirmed) return;

    try {
        await apiFetch(`/logistica/rutas-activas/${rutaId}/devolucion`, {
            method: 'POST',
            body: { id_parada: idParada, id_despacho: idDespacho, id_pedido: idPedido },
        });
        Swal.fire('Registrada', 'Devolución registrada correctamente', 'success');
        closeStopModal();
        await refreshRutaDetail();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al registrar devolución', 'error');
    }
}

async function refreshRutaDetail() {
    await loadRutasActivas();
}

// ─── Proximidad GPS — auto-registro de llegada ───

function getDistance(coords1, coords2) {
    var R = 6371;
    var dLat = (coords2[1] - coords1[1]) * Math.PI / 180;
    var dLng = (coords2[0] - coords1[0]) * Math.PI / 180;
    var lat1 = coords1[1] * Math.PI / 180;
    var lat2 = coords2[1] * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function checkProximityToStops(ruta, repartidorCoords) {
    var paradas = getRutaParadas(ruta);
    var rutaId = getRutaId(ruta);
    paradas.forEach(function (stop, idx) {
        if (stop.hora_llegada) return;
        var est = (stop.estado?.nombre_estado || stop.estado || '').toLowerCase();
        if (est.includes('entreg') || est.includes('fall') || est.includes('devol')) return;
        var stopCoords = getStopCoords(stop);
        if (!stopCoords) return;
        var distancia = getDistance(repartidorCoords, stopCoords);
        if (distancia <= 0.1) {
            autoRegistrarLlegada(rutaId, idx, stop);
        }
    });
}

async function autoRegistrarLlegada(rutaId, stopIdx, stop) {
    if (!stop.id_parada) return;
    var idDespacho = stop.id_despacho;
    var idPedido = stop.id_pedido || stop.pedido_id;
    if (!idDespacho || !idPedido) return;

    try {
        var resp = await apiFetch('/logistica/rutas-activas/' + rutaId + '/auto-completar-parada', {
            method: 'POST',
            body: { id_parada: stop.id_parada, id_despacho: idDespacho, id_pedido: idPedido },
        });
        var ruta = rutasActivas.find(function (r) { return getRutaId(r) === rutaId; });
        if (!ruta) return;

        if (resp.ruta_finalizada) {
            var idx = rutasActivas.indexOf(ruta);
            if (idx > -1) rutasActivas.splice(idx, 1);
            renderTrackingList();
            if (trackingActiveId === rutaId) {
                trackingActiveId = rutasActivas.length > 0 ? getRutaId(rutasActivas[0]) : null;
                renderTrackingDetail(rutasActivas[0] || null);
                if (rutasActivas.length > 0) selectTrackingRuta(trackingActiveId);
            }
            Swal.fire({
                title: 'Ruta completada',
                text: 'El repartidor regreso al almacen.',
                icon: 'success',
                timer: 3000,
                showConfirmButton: false,
            });
        } else {
            stop.hora_llegada = new Date().toTimeString().substring(0, 5);
            stop.estado = 'Entregado completo';
            if (getRutaId(ruta) === trackingActiveId) {
                renderTrackingDetail(ruta);
            }
        }
    } catch (e) {
        console.warn('Auto-registro de llegada fallo:', e);
    }
}

// ─── Map functions ───

function initTrackingMap() {
    const container = document.getElementById('tracking-map');
    if (!container || typeof mapboxgl === 'undefined') return;

    if (trackingMap) {
        trackingMap.resize();
        trackingUserInteracted = false;
        updateTrackingMap(rutasActivas.find(r => getRutaId(r) === trackingActiveId));
        return;
    }

    if (!window.isMapConfigValid()) {
        console.error('[tracking] Mapbox token not configured. Cannot initialize map.');
        const container = document.getElementById('tracking-map');
        if (container) {
            container.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;"><i class="fas fa-exclamation-triangle" style="font-size:48px;color:#f59e0b;"></i><h3>Mapbox no configurado</h3><p>Falta el token de acceso de Mapbox. Configure MAPBOX_TOKEN en .env o config.js</p></div>';
        }
        return;
    }

    mapboxgl.accessToken = GPS_MAPBOX_TOKEN;
    trackingMap = new mapboxgl.Map({
        container: 'tracking-map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-67.8217, -16.4897],
        zoom: 12,
        fadeDuration: 0,
    });
    trackingMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    trackingMap.on('zoomend', () => { trackingUserInteracted = true; });
    trackingMap.on('dragend', () => { trackingUserInteracted = true; });
    trackingMap.on('load', () => {
        trackingUserInteracted = false;
        updateTrackingMap(rutasActivas.find(r => getRutaId(r) === trackingActiveId));
    });
}

function updateTrackingMap(ruta, forceFitBounds = true) {
    if (!trackingMap || !trackingMap.loaded() || !ruta) return;

    Object.keys(trackingMarkers).forEach(k => {
        if (k.startsWith('gps')) {
            const rutaId = k.replace('gps_', '');
            const stillActive = rutaId && rutasActivas.some(r => String(getRutaId(r)) === rutaId);
            if (!stillActive || rutaId === '') {
                trackingMarkers[k].remove();
                delete trackingMarkers[k];
                clearGPSTrail(k);
            }
            return;
        }
        trackingMarkers[k].remove();
        delete trackingMarkers[k];
    });

    var rep = ruta.repartidor || {};
    var origenCoords = null;

    if (rep.firebase_uid && firebaseUsuariosData?.[rep.firebase_uid]?.ubicacion) {
        var u = firebaseUsuariosData[rep.firebase_uid].ubicacion;
        var lat = u.lat ?? u.latitud;
        var lng = u.lng ?? u.longitud;
        if (lat != null && lng != null) {
            origenCoords = [parseFloat(lng), parseFloat(lat)];
        }
    }

    var coords = origenCoords ? [origenCoords] : [];
    var bounds = new mapboxgl.LngLatBounds();
    var gpsKey = 'gps_' + getRutaId(ruta);

    var todasCompletadas = true;
    var paradas = getRutaParadas(ruta);
    paradas.forEach(function (stop) {
        var est = (stop.estado?.nombre_estado || stop.estado || '').toLowerCase();
        if (!est.includes('entreg') && !est.includes('fall') && !est.includes('devol')) {
            todasCompletadas = false;
        }
    });

    var gpsColor = '#2563eb';
    if (todasCompletadas) {
        gpsColor = '#8b5cf6';
    } else if (origenCoords) {
        for (var i = 0; i < paradas.length; i++) {
            var stopCoords = getStopCoords(paradas[i]);
            if (stopCoords) {
                var dist = getDistance(origenCoords, stopCoords);
                if (dist <= 0.1) {
                    gpsColor = '#f59e0b';
                    break;
                }
            }
        }
    }

    if (origenCoords) {
        bounds.extend(origenCoords);
        if (trackingMarkers[gpsKey]) {
            trackingMarkers[gpsKey].setLngLat(origenCoords);
            updateGPSTrail(gpsKey, origenCoords);
            updateGPSMarkerColor(gpsKey, gpsColor);
        } else {
            clearGPSTrail(gpsKey);
            trackingMarkers[gpsKey] = createGPSMarker(origenCoords, '\
                <b>' + trackSafe(getRepartidorNameTracking(rep)) + '</b><br>\
                ' + trackSafe(formatVehiculoTracking(ruta.vehiculo || ruta)) + '\
            ', gpsColor);
        }
    }

    paradas.forEach(function (stop, idx) {
        var stopCoords = getStopCoords(stop);
        if (!stopCoords) return;
        coords.push(stopCoords);
        bounds.extend(stopCoords);
        var estado = normalizeTrack(stop.estado?.nombre_estado || stop.estado || '');
        var llegada = stop.hora_llegada;
        var color;
        if (estado.includes('entreg')) {
            color = '#10b981';
        } else if (estado.includes('fall') || estado.includes('cancel')) {
            color = '#ef4444';
        } else if (llegada) {
            color = '#f59e0b';
        } else {
            color = '#64748b';
        }
        var popup = '\
            <b>' + trackSafe(stop.farmacia || stop.pedido?.farmacia?.nombre || 'Parada') + '</b><br>\
            Estado: ' + trackSafe(stop.estado?.nombre_estado || stop.estado || 'Pendiente') + '<br>\
            Pedido #' + trackSafe(stop.id_pedido || stop.pedido_id || '') + '\
        ';
        trackingMarkers['parada_' + idx] = createTrackingMarker(String(idx + 1), stopCoords, color, popup);
    });

    drawTrackingRoute(coords);
    if (coords.length > 1 && forceFitBounds && !trackingUserInteracted) {
        trackingMap.fitBounds(bounds, { padding: 64, maxZoom: 14, animate: false });
    }
}

function createGPSMarker(coords, popupHtml, color) {
    color = color || '#2563eb';
    var el = document.createElement('div');
    el.className = 'gps-marker';
    el.dataset.gpsColor = color;
    el.innerHTML = '<i class="fas fa-truck"></i>';
    el.style.background = color;
    return new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
        .addTo(trackingMap);
}

function updateGPSMarkerColor(key, color) {
    var marker = trackingMarkers[key];
    if (!marker) return;
    var el = marker.getElement();
    if (el) {
        el.style.background = color;
        el.dataset.gpsColor = color;
    }
}

function updateGPSTrail(key, coord) {
    if (!gpsPositionHistory[key]) gpsPositionHistory[key] = [];
    gpsPositionHistory[key].push(coord);
    if (gpsPositionHistory[key].length > 5) gpsPositionHistory[key].shift();

    drawGPSTrail(key);
}

function drawGPSTrail(key) {
    const history = gpsPositionHistory[key];
    if (!history || history.length < 2) return;

    gpsTrailDots[key] = gpsTrailDots[key] || [];
    while (gpsTrailDots[key].length < history.length - 1) {
        const dot = document.createElement('div');
        dot.className = 'gps-trail-dot';
        gpsTrailDots[key].push(dot);
    }

    history.slice(0, -1).forEach((coord, idx) => {
        const dot = gpsTrailDots[key][idx];
        if (!dot.parentNode) {
            const m = new mapboxgl.Marker({ element: dot }).setLngLat(coord).addTo(trackingMap);
        }
    });

    if (gpsTrailDots[key].length > history.length - 1) {
        const extra = gpsTrailDots[key].splice(history.length - 1);
        extra.forEach(d => { if (d.parentNode) d.parentNode.remove(); });
    }
}

function clearGPSTrail(key) {
    if (gpsTrailDots[key]) {
        gpsTrailDots[key].forEach(d => { if (d.parentNode) d.parentNode.remove(); });
        delete gpsTrailDots[key];
    }
    if (gpsPositionHistory[key]) delete gpsPositionHistory[key];
}

function createTrackingMarker(label, coords, color, popupHtml) {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
        width:28px;
        height:28px;
        background:${color};
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(15,23,42,.3);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:12px;
        font-weight:700;
    `;
    return new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
        .addTo(trackingMap);
}

function drawTrackingRoute(coords) {
    const data = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [] }
    };
    if (trackingMap.getSource('tracking-route')) {
        trackingMap.getSource('tracking-route').setData(data);
    } else {
        trackingMap.addSource('tracking-route', { type: 'geojson', data });
        trackingMap.addLayer({
            id: 'tracking-route-line',
            type: 'line',
            source: 'tracking-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [2, 2] }
        });
    }
}

function listenFirebaseTracking() {
    try {
        if (!window.firebase) return;
        if (!window.isFirebaseConfigValid()) {
            console.warn('[tracking] Firebase config not valid, skipping initialization');
            return;
        }
        if (!firebase.apps.length) firebase.initializeApp(GPS_FIREBASE_CONFIG);
        const db = firebase.database();
        if (firebaseTrackingRef) firebaseTrackingRef.off();

        firebaseTrackingRef = db.ref('rutas_activas');
        firebaseTrackingRef.on('value', snapshot => {
            const data = snapshot.val();
            if (!data || !trackingMap) return;

            Object.keys(data).forEach(rutaId => {
                const rutaData = data[rutaId];
                const ubicacion = rutaData?.ubicacion;
                if (!ubicacion) return;
                const lat = ubicacion.lat ?? ubicacion.latitud;
                const lng = ubicacion.lng ?? ubicacion.longitud;
                if (lat == null || lng == null) return;
                const key = `gps_${rutaId}`;
                const coords = [parseFloat(lng), parseFloat(lat)];
                if (trackingMarkers[key]) {
                    trackingMarkers[key].setLngLat(coords);
                    updateGPSTrail(key, coords);
                }
            });
        });

        const usuariosRef = db.ref('usuarios');
        usuariosRef.on('value', snapshot => {
            const data = snapshot.val();
            firebaseUsuariosData = data;
            if (!data || !trackingMap) return;

            rutasActivas.forEach(ruta => {
                const rep = ruta.repartidor || {};
                const fbUid = rep.firebase_uid;
                if (!fbUid || !data[fbUid]) return;

                const ubicacion = data[fbUid].ubicacion;
                if (!ubicacion) return;
                const lat = ubicacion.lat ?? ubicacion.latitud;
                const lng = ubicacion.lng ?? ubicacion.longitud;
                if (lat == null || lng == null) return;

                const rutaId = getRutaId(ruta);
                const key = `gps_${rutaId}`;
                const coords = [parseFloat(lng), parseFloat(lat)];

                if (trackingMarkers[key]) {
                    trackingMarkers[key].setLngLat(coords);
                    updateGPSTrail(key, coords);
                } else if (trackingMap.loaded()) {
                    trackingMarkers[key] = createGPSMarker(coords, `
                        <b>${trackSafe(getRepartidorNameTracking(rep))}</b><br>
                        ${trackSafe(formatVehiculoTracking(ruta.vehiculo || ruta))}
                    `);
                }

                if (trackingActiveId === rutaId) {
                    checkProximityToStops(ruta, [parseFloat(lng), parseFloat(lat)]);
                }
            });

            if (trackingActiveId) {
                const ruta = rutasActivas.find(r => getRutaId(r) === trackingActiveId);
                if (ruta) updateTrackingMap(ruta, false);
            }
        });
    } catch (e) {
        console.warn('Firebase init warning:', e);
    }
}

function getRutaId(r) {
    return parseInt(r?.id_control_ruta || r?.control_ruta_id || r?.id_ruta || r?.id || 0);
}

function getRutaParadas(r) {
    return r?.despachos || r?.paradas || r?.entregas || [];
}

function getRutaProgreso(r) {
    const explicit = parseFloat(r?.progreso);
    if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, Math.round(explicit)));
    const paradas = getRutaParadas(r);
    if (!paradas.length) return 0;
    return Math.round((getRutaCompletadas(r) / paradas.length) * 100);
}

function getRutaCompletadas(r) {
    const explicit = parseInt(r?.completadas);
    if (Number.isFinite(explicit)) return explicit;
    return getRutaParadas(r).filter(p => normalizeTrack(p.estado?.nombre_estado || p.estado).includes('entreg')).length;
}

function getStopCoords(stop) {
    const lat = parseFloat(stop?.latitud || stop?.farmacia?.latitud || stop?.pedido?.farmacia?.latitud || stop?.lat);
    const lng = parseFloat(stop?.longitud || stop?.farmacia?.longitud || stop?.pedido?.farmacia?.longitud || stop?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lng, lat];
}

function getRepartidorNameTracking(rep) { return getRepartidorName(rep); }

function formatVehiculoTracking(veh) {
    const marca = veh?.marca?.nombre_marca || veh?.marca || '';
    const modelo = veh?.modelo?.nombre_modelo || veh?.modelo || '';
    const placa = veh?.placa ? `(${veh.placa})` : '';
    return `${marca} ${modelo} ${placa}`.trim() || 'Sin vehiculo';
}

function normalizeTrack(value) { return normalize(value); }

function trackSafe(value) { return escapeHtml(value); }
