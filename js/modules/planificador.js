// Configuración cargada desde config.js o variables de entorno
// GPS_FIREBASE_CONFIG la define js/config.js como binding lexico global, visible
// para este modulo sin necesidad de redeclararlo (rehacerlo fue lo que rompio
// tracking.js al compartir pagina con planificador.js).

let planificadorMap = null;
let planificadorMarkers = [];
let planificadorRouteLine = null;
let pedidosPendientes = [];
let repartidoresData = [];
let assignmentsByRepartidor = {};
let selectedRepartidorId = null;
let planificadorUserInteracted = false;
let sortables = [];
var firebaseUsuariosData = null;
let planificadorFirebaseRef = null;

async function initPlanificador() {
    assignmentsByRepartidor = {};
    selectedRepartidorId = null;
    await Promise.all([loadPedidosPendientes(), loadRepartidores()]);
    initPlanificadorMap();
    initFirebasePlanificador();
    renderPlannerState();
}

async function loadPedidosPendientes() {
    try {
        const d = await apiFetch('/pedidos?per_page=200');
        const all = Array.isArray(d) ? d : (d.data || []);
        pedidosPendientes = all.filter(p => {
            const estadoId = p.id_estado_pedido;
            // pedidos.estado es un ENUM de texto; sin el fallback `|| p.estado` esto
            // quedaba vacio y los pedidos ya en ruta se colaban como pendientes.
            const estadoName = (p.estado?.nombre_estado || p.nombre_estado || p.estado || '').toLowerCase();
            const excluir = estadoName.includes('entreg') || estadoName.includes('cancel') || estadoName.includes('ruta') || estadoName.includes('despach');
            if (excluir) return false;
            return estadoId <= 2 || estadoName.includes('pend') || estadoName.includes('prepar');
        });
    } catch (e) {
        console.error('Error loading pedidos:', e);
        pedidosPendientes = [];
    }
}

async function loadRepartidores() {
    try {
        const d = await apiFetch('/logistica/repartidores-disponibles');
        repartidoresData = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        console.error('Error loading repartidores:', e);
        repartidoresData = [];
    }
}

function renderPlannerState() {
    renderPedidos();
    renderRepartidores();
    updatePlanificadorSummary();
    updateMapRoute();
    setTimeout(initSortables, 0);
}

function renderPedidos() {
    const container = document.getElementById('pedidos-list');
    if (!container) return;

    const search = normalizeText(document.getElementById('planificador-search')?.value || '');
    const assigned = getAssignedPedidoIds();
    const filtered = pedidosPendientes.filter(p => {
        const text = normalizeText(`${getPedidoId(p)} ${getPedidoFarmaciaName(p)} ${getPedidoProductosText(p)}`);
        return !search || text.includes(search);
    });

    const count = document.getElementById('pendientes-count');
    if (count) count.textContent = pedidosPendientes.length - assigned.size;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state compact">No hay pedidos pendientes con ese filtro.</div>';
        return;
    }

    container.innerHTML = filtered.map(p => renderPlanificadorPedidoCard(p, assigned.has(getPedidoId(p)))).join('');
    setTimeout(initSortables, 0);
}

// Nombre propio y no renderPedidoCard a secas: pedidos.js define otro con el mismo
// nombre global y firma distinta —(p)—. Al compartir pagina y ganar la ultima
// carga, pedidos.js acababa llamando a esta version, que recibia (p, indice, array)
// de Array.map y leia el indice como `isAssigned`, marcando como deshabilitadas
// todas las tarjetas salvo la primera.
function renderPlanificadorPedidoCard(p, isAssigned = false, repId = null) {
    const id = getPedidoId(p);
    const coords = getPedidoCoords(p);
    const total = getPedidoTotal(p);
    const detalles = p.detalles || [];
    const productos = getPedidoProductosText(p);
    const missingCoords = !coords;
    return `
        <div class="pedido-card ${isAssigned ? 'assigned-disabled' : ''} ${missingCoords ? 'missing-coords' : ''}"
             data-pedido-id="${id}"
             data-repartidor-id="${repId || ''}">
            <div class="pedido-card-line">
                <div>
                    <div class="pedido-id">#${id}</div>
                    <div class="pedido-farmacia">${safeText(getPedidoFarmaciaName(p))}</div>
                </div>
                ${repId ? `<button class="btn btn-sm btn-light" onclick="removeAssignedPedido(${repId}, ${id}); event.stopPropagation();" title="Quitar"><i class="fas fa-times"></i></button>` : ''}
            </div>
            <div class="pedido-meta">
                <span>${detalles.length || p.detalles_count || 0} productos</span>
                <span>Bs ${money(total)}</span>
            </div>
            ${productos ? `<div class="pedido-productos">${safeText(productos)}</div>` : ''}
            <div class="pedido-flags">
                ${missingCoords ? '<span class="badge badge-warning">Sin coordenadas</span>' : '<span class="badge badge-success">Con mapa</span>'}
                ${isAssigned && !repId ? '<span class="badge badge-info">Asignado</span>' : ''}
            </div>
        </div>
    `;
}

function renderRepartidores() {
    const container = document.getElementById('repartidores-list');
    if (!container) return;

    const search = normalizeText(document.getElementById('planificador-search-repartidor')?.value || '');
    const filtered = repartidoresData.filter(r => {
        if (!search) return true;
        const text = normalizeText(`${getRepartidorName(r)} ${formatVehiculo(getRepartidorVehiculo(r) || {})}`);
        return text.includes(search);
    });

    const count = document.getElementById('repartidores-count');
    if (count) count.textContent = filtered.length;

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state compact">No hay repartidores disponibles.</div>';
        return;
    }

    container.innerHTML = filtered.map(r => {
        const id = getRepartidorId(r);
        const vehiculo = getRepartidorVehiculo(r);
        const assignedIds = assignmentsByRepartidor[id] || [];
        const pedidos = assignedIds.map(pid => findPedido(pid)).filter(Boolean);
        const total = pedidos.reduce((s, p) => s + getPedidoTotal(p), 0);
        const initials = getInitials(getRepartidorName(r));
        const isSelected = selectedRepartidorId === id;
        const fbUser = r.firebase_uid && firebaseUsuariosData ? firebaseUsuariosData[r.firebase_uid] : null;
        const conectado = estaConectado(fbUser);
        return `
            <article class="repartidor-card ${isSelected ? 'selected' : ''}" data-repartidor-id="${id}" onclick="selectRepartidor(${id})">
                <div class="repartidor-card-header">
                    <div class="avatar">${initials}</div>
                    <div class="info">
                        <div class="name">${safeText(getRepartidorName(r))}</div>
                        <div class="vehiculo">${vehiculo ? safeText(formatVehiculo(vehiculo)) : '<span class="text-danger">Sin vehiculo asignado</span>'}</div>
                    </div>
                    ${conectado
                        ? '<span class="badge badge-success" style="font-size:10px;align-self:start;">🟢 Activo</span>'
                        : '<span class="badge badge-danger" style="font-size:10px;align-self:start;">🔴 Inactivo</span>'}
                </div>
                <div class="repartidor-summary">
                    <span>${assignedIds.length} pedidos</span>
                    <span>Bs ${money(total)}</span>
                </div>
                <div class="dropzone" data-repartidor-id="${id}">
                    ${pedidos.length ? pedidos.map(p => renderPlanificadorPedidoCard(p, false, id)).join('') : '<div class="dropzone-empty"><i class="fas fa-arrow-down"></i> Soltar pedidos aqui</div>'}
                </div>
                <div style="display:flex;gap:4px;padding:8px;">
                    <button class="btn btn-sm btn-outline" style="flex:1;" onclick="event.stopPropagation(); mostrarHistorialRepartidor(${id})">
                        <i class="fas fa-clock-rotate-left"></i> Historial del dia
                    </button>
                    <button class="btn-iniciar" style="flex:1;" onclick="iniciarRuta(${id}); event.stopPropagation();" ${assignedIds.length ? '' : 'disabled'}>
                        <i class="fas fa-play"></i> Iniciar ruta
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function initPlanificadorMap() {
    const mapContainer = document.getElementById('planificador-map');
    if (!mapContainer) return;

    // El mapa se cachea entre pestañas, pero renderPlanificador() reescribe el
    // HTML y deja el contenedor anterior huérfano. Si ya no está en el DOM hay
    // que destruirlo y recrearlo sobre el div nuevo, o el mapa queda en blanco.
    if (planificadorMap && (!planificadorMap.getContainer() || !planificadorMap.getContainer().isConnected)) {
        planificadorMap.remove();
        planificadorMap = null;
        planificadorRouteLine = null;
    }

    if (planificadorMap) {
        planificadorMap.invalidateSize();
        setTimeout(updateMapRoute, 200);
        return;
    }

    planificadorMap = L.map('planificador-map').setView([-16.4897, -67.8217], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(planificadorMap);

    planificadorMap.addControl(L.control.scale({ position: 'bottomright' }));
    planificadorMap.on('zoomend', () => { planificadorUserInteracted = true; });
    planificadorMap.on('dragend', () => { planificadorUserInteracted = true; });

    // Leaflet no emite el evento 'load' de Mapbox; whenReady dispara cuando el
    // mapa tiene dimensiones y puede calcular su vista inicial.
    planificadorMap.whenReady(function () {
        planificadorUserInteracted = false;
        // El contenedor puede haber estado oculto (0x0) al crear el mapa.
        setTimeout(() => { if (planificadorMap) planificadorMap.invalidateSize(); }, 0);
        updateMapRoute();
    });
}

function initSortables() {
    if (typeof Sortable === 'undefined') return;

    sortables.forEach(s => s.destroy());
    sortables = [];

    const pedidosList = document.getElementById('pedidos-list');
    if (pedidosList) {
        sortables.push(new Sortable(pedidosList, {
            group: { name: 'logistica-pedidos', pull: 'clone', put: false },
            sort: false,
            filter: '.assigned-disabled',
            animation: 0,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
        }));
    }

    document.querySelectorAll('.dropzone').forEach(dz => {
        sortables.push(new Sortable(dz, {
            group: { name: 'logistica-pedidos', pull: true, put: true },
            animation: 0,
            ghostClass: 'sortable-ghost',
            onAdd: evt => handleDrop(evt),
            onUpdate: evt => {
                syncRepartidorOrder(parseInt(evt.to.dataset.repartidorId));
                renderPlannerState();
            },
        }));
    });
}

function handleDrop(evt) {
    const pedidoId = parseInt(evt.item.dataset.pedidoId);
    const targetRepartidorId = parseInt(evt.to.dataset.repartidorId);
    const sourceRepartidorId = parseInt(evt.from.dataset.repartidorId || 0);

    if (!pedidoId || !targetRepartidorId) {
        evt.item.remove();
        return;
    }

    if (!sourceRepartidorId && getAssignedPedidoIds().has(pedidoId)) {
        evt.item.remove();
        Swal.fire('Pedido ya asignado', 'Ese pedido ya esta en una ruta en preparacion.', 'info');
        return;
    }

    removePedidoFromAllAssignments(pedidoId);
    if (!assignmentsByRepartidor[targetRepartidorId]) assignmentsByRepartidor[targetRepartidorId] = [];
    assignmentsByRepartidor[targetRepartidorId].push(pedidoId);
    evt.item.remove();
    renderPlannerState();
}

function syncRepartidorOrder(repartidorId) {
    const dz = document.querySelector(`.dropzone[data-repartidor-id="${repartidorId}"]`);
    if (!dz) return;
    const ids = Array.from(dz.querySelectorAll('.pedido-card'))
        .map(card => parseInt(card.dataset.pedidoId))
        .filter(Boolean);
    assignmentsByRepartidor[repartidorId] = ids;
}

function removeAssignedPedido(repartidorId, pedidoId) {
    const current = assignmentsByRepartidor[repartidorId] || [];
    assignmentsByRepartidor[repartidorId] = current.filter(id => id !== pedidoId);
    renderPlannerState();
}

function clearAssignments() {
    assignmentsByRepartidor = {};
    selectedRepartidorId = null;
    renderPlannerState();
}

function selectRepartidor(repartidorId) {
    selectedRepartidorId = selectedRepartidorId === repartidorId ? null : repartidorId;
    planificadorUserInteracted = false;
    renderRepartidores();
    updateMapRoute();
    setTimeout(initSortables, 0);
}

function updatePlanificadorSummary() {
    const container = document.getElementById('planificador-resumen');
    if (!container) return;
    const assigned = getAssignedPedidoIds().size;
    const totalBs = Object.values(assignmentsByRepartidor).flat()
        .map(pid => findPedido(pid))
        .filter(Boolean)
        .reduce((s, p) => s + getPedidoTotal(p), 0);
    container.innerHTML = `
        <div><strong>${pedidosPendientes.length}</strong><span>Pedidos</span></div>
        <div><strong>${assigned}</strong><span>Asignados</span></div>
        <div><strong>${repartidoresData.length}</strong><span>Repartidores</span></div>
        <div><strong>Bs ${money(totalBs)}</strong><span>Total ruta</span></div>
    `;
}

function updateMapRoute() {
    updateRoutePreviewLabel();
    renderPlanificadorAlerts();
    if (!planificadorMap) return;

    planificadorMarkers.forEach(m => m.remove());
    planificadorMarkers = [];

    const coords = [];
    const routePedidos = getRoutePedidosForPreview();
    let gpsCoord = null;

    if (selectedRepartidorId) {
        const rep = findRepartidor(selectedRepartidorId);
        const ubicacion = rep?.firebase_uid
            ? firebaseUsuariosData?.[rep.firebase_uid]?.ubicacion
            : null;
        const gps = coordsGpsValidas(ubicacion);
        if (gps) {
            gpsCoord = gps;
            coords.push(gpsCoord);
        }
    }

    routePedidos.forEach(p => {
        const pedidoCoords = getPedidoCoords(p);
        if (pedidoCoords) coords.push(pedidoCoords);
    });

    const coordsValidas = coords.filter(c =>
        Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])
    );

    const latlngs = coordsValidas.map(c => L.latLng(c[1], c[0]));

    if (latlngs.length > 1) {
        if (planificadorRouteLine) {
            planificadorRouteLine.setLatLngs(latlngs);
        } else {
            planificadorRouteLine = L.polyline(latlngs, {
                color: '#2563eb',
                weight: 4,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round',
            }).addTo(planificadorMap);
        }
    } else if (planificadorRouteLine) {
        planificadorRouteLine.setLatLngs([]);
    }

    if (!coordsValidas.length) return;

    coordsValidas.forEach((coord, idx) => {
        let size, text, style;
        if (idx === 0 && gpsCoord) {
            text = 'GPS';
            size = 32;
            style = 'width:32px;height:32px;background:#111827;border-radius:50%;'
                + 'border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.3);'
                + 'display:flex;align-items:center;justify-content:center;'
                + 'color:white;font-size:10px;font-weight:700;';
        } else {
            const num = gpsCoord ? idx : idx + 1;
            text = String(num);
            size = 26;
            style = 'width:26px;height:26px;background:#2563eb;border-radius:50%;'
                + 'border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.3);'
                + 'display:flex;align-items:center;justify-content:center;'
                + 'color:white;font-size:12px;font-weight:700;';
        }
        // Leaflet no acepta `element` como opción; el marker custom va por divIcon.
        const marker = L.marker(L.latLng(coord[1], coord[0]), {
            icon: L.divIcon({
                html: `<div style="${style}">${safeText(text)}</div>`,
                className: 'planificador-marker-icon',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            }),
        }).addTo(planificadorMap);
        planificadorMarkers.push(marker);
    });

    const bounds = L.latLngBounds();
    coordsValidas.forEach(coord => bounds.extend(L.latLng(coord[1], coord[0])));
    const mapSize = planificadorMap.getSize();
    if (!planificadorUserInteracted && bounds.isValid() && mapSize.x > 0 && mapSize.y > 0) {
        planificadorMap.fitBounds(bounds, { padding: 64, maxZoom: 14, animate: false });
    }
}

function updateRoutePreviewLabel() {
    const label = document.getElementById('route-preview-label');
    if (!label) return;
    const routePedidos = getRoutePedidosForPreview();
    const selected = selectedRepartidorId ? findRepartidor(selectedRepartidorId) : null;
    if (!routePedidos.length) {
        label.textContent = 'Sin pedidos asignados';
    } else if (selected) {
        label.textContent = `${getRepartidorName(selected)} · ${routePedidos.length} paradas`;
    } else {
        label.textContent = `${routePedidos.length} paradas asignadas`;
    }
}

function renderPlanificadorAlerts() {
    const container = document.getElementById('planificador-alertas');
    if (!container) return;
    const routePedidos = getRoutePedidosForPreview();
    const noCoords = routePedidos.filter(p => !getPedidoCoords(p));
    if (!routePedidos.length) {
        container.innerHTML = '<div class="route-event muted">Arrastra pedidos a un repartidor para previsualizar la ruta.</div>';
        return;
    }
    if (!noCoords.length) {
        container.innerHTML = '<div class="route-event success">Todos los pedidos asignados tienen coordenadas para el mapa.</div>';
        return;
    }
    container.innerHTML = `
        <div class="route-event warning">
            ${noCoords.length} pedido(s) sin coordenadas no se trazan en el mapa:
            ${noCoords.map(p => `#${getPedidoId(p)}`).join(', ')}
        </div>
    `;
}

function getRoutePedidosForPreview() {
    if (selectedRepartidorId && assignmentsByRepartidor[selectedRepartidorId]?.length) {
        return assignmentsByRepartidor[selectedRepartidorId].map(pid => findPedido(pid)).filter(Boolean);
    }
    return Object.values(assignmentsByRepartidor).flat().map(pid => findPedido(pid)).filter(Boolean);
}

async function iniciarRuta(repartidorId) {
    const pedidoIds = assignmentsByRepartidor[repartidorId] || [];
    if (!pedidoIds.length) return;

    const repartidor = findRepartidor(repartidorId);
    const vehiculo = getRepartidorVehiculo(repartidor);
    const pedidos = pedidoIds.map((id, idx) => ({ id_pedido: id, orden: idx + 1 }));
    const pedidosSinCoords = pedidoIds.map(pid => findPedido(pid)).filter(p => p && !getPedidoCoords(p));

    if (!vehiculo || !(vehiculo.id_vehiculo || vehiculo.id)) {
        Swal.fire('Vehiculo requerido', 'Asigne un vehiculo al repartidor antes de iniciar la ruta.', 'warning');
        return;
    }

    let warnings = '';
    if (pedidosSinCoords.length) warnings += `<p class="text-warning"><strong>Mapa:</strong> ${pedidosSinCoords.length} pedido(s) no tienen coordenadas y no se trazaran.</p>`;

    const result = await Swal.fire({
        title: 'Iniciar ruta',
        html: `
            <p><strong>Repartidor:</strong> ${safeText(getRepartidorName(repartidor))}</p>
            <p><strong>Vehiculo:</strong> ${vehiculo ? safeText(formatVehiculo(vehiculo)) : 'Sin vehiculo'}</p>
            <p><strong>Pedidos:</strong> ${pedidos.length}</p>
            ${warnings}
            <p>Se guardara la ruta y se enviara al seguimiento.</p>
        `,
        icon: warnings ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText: 'Iniciar ruta',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
    });
    if (!result.isConfirmed) return;

    try {
        const fechaHoy = new Date().toISOString().slice(0, 10);
        const hojaResp = await apiFetch('/hojas-ruta', {
            method: 'POST',
            body: {
                fecha: fechaHoy,
                id_repartidor: repartidorId,
                id_vehiculo: vehiculo.id_vehiculo || vehiculo.id,
                pedidos: pedidos.map(p => ({ id_pedido: p.id_pedido, orden_visita: p.orden })),
            },
        });
        const hoja = hojaResp?.data ?? hojaResp;
        const idHoja = hoja?.id_hoja_ruta;
        if (!idHoja) throw new Error('No se pudo obtener la hoja de ruta creada.');

        await apiFetch(`/hojas-ruta/${idHoja}/iniciar`, { method: 'POST' });

        Swal.fire({
            title: 'Ruta iniciada',
            html: `<p>Se asignaron ${pedidos.length} pedido(s) a ${getRepartidorName(repartidor)}.</p><p style="font-size:13px;color:var(--text-muted);">Los estados se actualizan automaticamente en el sistema.</p>`,
            icon: 'success',
            timer: 3000,
            showConfirmButton: false,
        });

        assignmentsByRepartidor = {};
        selectedRepartidorId = null;
        await Promise.all([loadPedidosPendientes(), loadRepartidores()]);
        renderPlannerState();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al iniciar ruta', 'error');
    }
}

function getAssignedPedidoIds() {
    return new Set(Object.values(assignmentsByRepartidor).flat());
}

function removePedidoFromAllAssignments(pedidoId) {
    Object.keys(assignmentsByRepartidor).forEach(repId => {
        assignmentsByRepartidor[repId] = (assignmentsByRepartidor[repId] || []).filter(id => id !== pedidoId);
    });
}

function findPedido(id) {
    return pedidosPendientes.find(p => getPedidoId(p) === parseInt(id));
}

function findRepartidor(id) {
    return repartidoresData.find(r => getRepartidorId(r) === parseInt(id));
}

function getPedidoId(p) {
    return parseInt(p?.id_pedido || p?.pedido_id || p?.id || 0);
}

function getPedidoFarmaciaName(p) {
    return p?.farmacia?.nombre || p?.nombre_farmacia || p?.farmacia || 'Sin farmacia';
}

function getPedidoProductosText(p) {
    const detalles = p?.detalles || [];
    if (!detalles.length) return '';
    return detalles.slice(0, 3).map(d => d.producto?.nombre || d.nombre_producto || 'Producto').join(', ');
}

function getPedidoTotal(p) {
    const total = parseFloat(p?.total);
    if (Number.isFinite(total)) return total;
    return (p?.detalles || []).reduce((s, d) => s + ((parseFloat(d.cantidad_solicitada) || 0) * (parseFloat(d.precio_unitario) || 0)), 0);
}

function getPedidoCoords(p) {
    const lat = numeroFinito(p?.farmacia?.latitud, p?.latitud, p?.lat);
    const lng = numeroFinito(p?.farmacia?.longitud, p?.longitud, p?.lng);
    if (lat === null || lng === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
}

function getRepartidorVehiculo(r) {
    if (!r) return null;
    const asignacion = r.asignacion_vehiculo_activa || r.asignacionVehiculoActiva || null;
    if (asignacion?.vehiculo) return asignacion.vehiculo;
    if (r.vehiculo || r.vehiculos?.[0]) return r.vehiculo || r.vehiculos[0];
    if (r.id_vehiculo) {
        return {
            id_vehiculo: r.id_vehiculo,
            marca: r.marca,
            modelo: r.modelo,
        };
    }
    return null;
}

function formatVehiculo(v) {
    if (!v) return 'Sin vehiculo';
    const marca = v.marca?.nombre_marca || v.marca || '';
    const modelo = v.modelo?.nombre_modelo || v.modelo || '';
    const placa = v.placa ? `(${v.placa})` : '';
    return `${marca} ${modelo} ${placa}`.trim() || 'Vehiculo asignado';
}

function getInitials(name) {
    return String(name || '?').split(' ').filter(Boolean).map(s => s[0]).join('').substring(0, 2).toUpperCase() || '?';
}

function normalizeText(value) { return normalize(value); }

function safeText(value) { return escapeHtml(value); }

/* ─────────── Firebase / Conexión ─────────── */

function estaConectado(firebaseUser) {
    if (!firebaseUser?.ubicacion) return false;
    if (firebaseUser.ubicacion.latitud == null && firebaseUser.ubicacion.lat == null) return false;
    var horaStr = firebaseUser.ubicacion.hora;
    if (!horaStr) return true;
    var partes = horaStr.split(':');
    if (partes.length !== 3) return true;
    var ahora = new Date();
    var fechaUbicacion = new Date();
    fechaUbicacion.setHours(parseInt(partes[0]), parseInt(partes[1]), parseInt(partes[2]), 0);
    var diffMs = ahora - fechaUbicacion;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
    return Math.floor(diffMs / 60000) < 2;
}

function initFirebasePlanificador() {
    try {
        if (!window.firebase) return;
        if (!firebase.apps.length) firebase.initializeApp(GPS_FIREBASE_CONFIG);
        if (planificadorFirebaseRef) planificadorFirebaseRef.off();
        const db = firebase.database();
        planificadorFirebaseRef = db.ref('usuarios');
        planificadorFirebaseRef.on('value', snapshot => {
            firebaseUsuariosData = snapshot.val() || {};
            renderRepartidores();
        });
    } catch (e) {
        console.warn('Firebase init warning:', e);
    }
}

/* ─────────── Historial contextual del repartidor ─────────── */

async function mostrarHistorialRepartidor(repartidorId) {
    try {
        const [despachos, controles] = await Promise.all([
            apiFetch('/despachos?per_page=-1').catch(() => []),
            apiFetch('/controles-ruta?per_page=-1').catch(() => []),
        ]);
        const despachosArr = Array.isArray(despachos) ? despachos : (despachos.data || []);
        const controlesArr = Array.isArray(controles) ? controles : (controles.data || []);

        const hoy = new Date().toISOString().slice(0, 10);

        const controlesHoy = controlesArr.filter(c => {
            const repId = c.id_repartidor || c.repartidor?.id_repartidor;
            const fecha = (c.fecha_salida || c.hora_salida || c.created_at || '').slice(0, 10);
            return String(repId) === String(repartidorId) && fecha === hoy;
        });

        const controlIds = controlesHoy.map(c => c.id_control_ruta);
        const despachosHoy = despachosArr.filter(d => {
            const repId = d.id_repartidor || d.repartidor?.id_repartidor;
            const fecha = (d.fecha_despacho || d.created_at || '').slice(0, 10);
            return String(repId) === String(repartidorId) && fecha === hoy;
        });

        const entregados = despachosHoy.filter(d => {
            const est = (d.estado?.nombre_estado || d.estado || '').toLowerCase();
            return est.includes('entreg');
        }).length;

        const incidencias = despachosHoy.reduce((s, d) => {
            return s + (d.incidencias_count ?? d.incidencias?.length ?? 0);
        }, 0);

        const rep = repartidoresData.find(r => String(getRepartidorId(r)) === String(repartidorId));
        const nombre = rep ? getRepartidorName(rep) : 'Repartidor';

        Swal.fire({
            title: `Historial del dia — ${safeText(nombre)}`,
            html: `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
                    <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#3b82f6;">${controlesHoy.length}</div>
                        <div style="font-size:12px;color:#64748b;">Rutas realizadas</div>
                    </div>
                    <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#10b981;">${despachosHoy.length}</div>
                        <div style="font-size:12px;color:#64748b;">Despachos totales</div>
                    </div>
                    <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#059669;">${entregados}</div>
                        <div style="font-size:12px;color:#64748b;">Entregados</div>
                    </div>
                    <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#ef4444;">${incidencias}</div>
                        <div style="font-size:12px;color:#64748b;">Incidencias</div>
                    </div>
                </div>
                ${controlesHoy.length ? `
                    <div style="text-align:left;border-top:1px solid var(--border);padding-top:12px;">
                        <strong style="font-size:13px;">Rutas de hoy:</strong>
                        ${controlesHoy.map(c => `
                            <div style="font-size:12px;padding:4px 0;color:var(--text-muted);">
                                Control #${c.id_control_ruta} &middot; ${c.ruta?.nombre_ruta || 'Sin ruta'}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `,
            confirmButtonText: 'Cerrar',
            width: 460,
        });
    } catch (e) {
        Swal.fire('Error', e.message || 'No se pudo cargar el historial', 'error');
    }
}
