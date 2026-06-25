const GPS_MAPBOX_TOKEN = window.GPS_MAPBOX_TOKEN || null;

let planificadorMap = null;
let planificadorMarkers = [];
let planificadorRouteLine = null;
let pedidosPendientes = [];
let repartidoresData = [];
let sortables = [];

async function initPlanificador() {
    await Promise.all([loadPedidosPendientes(), loadRepartidores()]);
    initPlanificadorMap();
    initSortables();
}

async function loadPedidosPendientes() {
    try {
        const d = await apiFetch('/logistica/pedidos-pendientes');
        pedidosPendientes = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        console.error('Error loading pedidos:', e);
        pedidosPendientes = [];
    }
    renderPedidos();
}

async function loadRepartidores() {
    try {
        const d = await apiFetch('/logistica/repartidores-disponibles');
        repartidoresData = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        console.error('Error loading repartidores:', e);
        repartidoresData = [];
    }
    renderRepartidores();
}

function renderPedidos() {
    const container = document.getElementById('pedidos-list');
    if (!container) return;
    document.getElementById('pendientes-count').textContent = pedidosPendientes.length;
    if (pedidosPendientes.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;"><i class="fas fa-check-circle" style="font-size:24px;display:block;margin-bottom:8px;color:#10b981;"></i>No hay pedidos pendientes</div>';
        return;
    }
    container.innerHTML = pedidosPendientes.map(p => renderPedidoCard(p)).join('');
}

function renderPedidoCard(p) {
    const farmacia = p.farmacia || {};
    const detalles = p.detalles || [];
    const totalProductos = detalles.reduce((s, d) => s + parseFloat(d.cantidad_solicitada || 0), 0);
    const total = parseFloat(p.total || 0);

    return `
        <div class="pedido-card" data-pedido-id="${p.id_pedido}"
             data-lat="${farmacia.latitud || ''}" data-lng="${farmacia.longitud || ''}"
             data-farmacia="${farmacia.nombre || ''}"
             data-total="${total}">
            <div class="pedido-id">#${p.id_pedido}</div>
            <div class="pedido-farmacia">${farmacia.nombre || '—'}</div>
            <div class="pedido-meta">
                <span>${totalProductos} producto(s)</span>
                <span>Bs ${total.toFixed(2)}</span>
            </div>
            ${detalles.length > 0 ? `
                <div class="pedido-productos">
                    ${detalles.slice(0, 3).map(d => d.producto?.nombre || '—').join(', ')}
                    ${detalles.length > 3 ? `... (+${detalles.length - 3})` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

function renderRepartidores() {
    const container = document.getElementById('repartidores-list');
    if (!container) return;
    if (repartidoresData.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">No hay repartidores disponibles</div>';
        return;
    }
    container.innerHTML = repartidoresData.map(r => {
        const v = r.vehiculo || {};
        const initials = r.nombre ? r.nombre.split(' ').map(s => s[0]).join('').substring(0, 2).toUpperCase() : '?';
        return `
            <div class="repartidor-card" data-repartidor-id="${r.id_repartidor}"
                 data-nombre="${r.nombre}" data-vehiculo-id="${v.id_vehiculo || ''}">
                <div class="repartidor-card-header">
                    <div class="avatar">${initials}</div>
                    <div class="info">
                        <div class="name">${r.nombre || '—'}</div>
                        <div class="vehiculo">
                            ${v.marca ? v.marca + ' ' : ''}${v.modelo || ''}
                            ${v.placa ? '(' + v.placa + ')' : ''}
                        </div>
                    </div>
                </div>
                <div class="dropzone" data-repartidor-id="${r.id_repartidor}">
                    <div style="text-align:center;color:#94a3b8;font-size:11px;padding:8px;">
                        <i class="fas fa-arrow-down"></i> Soltar aquí
                    </div>
                </div>
                <button class="btn-iniciar" data-repartidor-id="${r.id_repartidor}" onclick="iniciarRuta(${r.id_repartidor})" disabled>
                    <i class="fas fa-play"></i> Iniciar Ruta
                </button>
            </div>
        `;
    }).join('');
}

function initPlanificadorMap() {
    const mapContainer = document.getElementById('planificador-map');
    if (!mapContainer) return;
    if (planificadorMap) {
        planificadorMap.resize();
        return;
    }
    mapboxgl.accessToken = GPS_MAPBOX_TOKEN;
    planificadorMap = new mapboxgl.Map({
        container: 'planificador-map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-67.8217, -16.4897],
        zoom: 12,
    });
    planificadorMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

    planificadorMap.on('load', function () {
        planificadorMap.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
        });
        planificadorMap.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 }
        });
    });
}

function initSortables() {
    document.querySelectorAll('.sortable-ghost').forEach(el => el.classList.remove('sortable-ghost'));

    sortables.forEach(s => s.destroy());
    sortables = [];

    const pedidosList = document.getElementById('pedidos-list');
    const bandejaList = document.getElementById('bandeja-list');
    if (!pedidosList || !bandejaList) return;

    sortables.push(new Sortable(pedidosList, {
        group: { name: 'logistica', pull: 'clone', put: false },
        sort: false,
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onStart: function (evt) {
            document.querySelectorAll('.bandeja-dropzone, .dropzone').forEach(el => {
                el.style.borderColor = '#3b82f6';
                el.style.background = '#f0f7ff';
            });
        },
        onEnd: function () {
            document.querySelectorAll('.bandeja-dropzone, .dropzone').forEach(el => {
                el.style.borderColor = '';
                el.style.background = '';
            });
        },
    }));

    sortables.push(new Sortable(bandejaList, {
        group: { name: 'logistica', pull: true, put: true },
        animation: 150,
        ghostClass: 'sortable-ghost',
        onAdd: function (evt) {
            onBandejaChange();
            updateMapRoute();
        },
        onRemove: function () {
            onBandejaChange();
            updateMapRoute();
        },
        onSort: function () {
            onBandejaChange();
            updateMapRoute();
        },
    }));

    document.querySelectorAll('.dropzone').forEach(dz => {
        sortables.push(new Sortable(dz, {
            group: { name: 'logistica', pull: true, put: true },
            animation: 150,
            ghostClass: 'sortable-ghost',
            onAdd: function (evt) {
                updateRepartidorButton(dz.dataset.repartidorId);
                updateMapRoute();
            },
            onRemove: function () {
                updateRepartidorButton(dz.dataset.repartidorId);
                updateMapRoute();
            },
            onSort: function () {
                updateMapRoute();
            },
        }));
    });
}

function onBandejaChange() {
    const bandeja = document.getElementById('bandeja-list');
    if (!bandeja) return;
    const items = bandeja.querySelectorAll('.pedido-card');
    document.getElementById('bandeja-count').textContent = items.length;
}

function updateRepartidorButton(repartidorId) {
    const card = document.querySelector(`.repartidor-card[data-repartidor-id="${repartidorId}"]`);
    if (!card) return;
    const dropzone = card.querySelector('.dropzone');
    const btn = card.querySelector('.btn-iniciar');
    if (!dropzone || !btn) return;
    const hasItems = dropzone.querySelectorAll('.pedido-card').length > 0;
    btn.disabled = !hasItems;
    btn.textContent = hasItems
        ? '<i class="fas fa-play"></i> Iniciar Ruta'
        : '<i class="fas fa-play"></i> Iniciar Ruta';
}

async function updateMapRoute() {
    if (!planificadorMap || !planificadorMap.isStyleLoaded()) return;

    const coords = [];
    const almacenCoords = [-67.8217, -16.4897];
    coords.push(almacenCoords);

    document.querySelectorAll('.dropzone .pedido-card').forEach(card => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
            coords.push([lng, lat]);
        }
    });

    const bandejaItems = document.querySelectorAll('#bandeja-list .pedido-card');
    bandejaItems.forEach(card => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
            coords.push([lng, lat]);
        }
    });

    // Clear existing markers
    planificadorMarkers.forEach(m => m.remove());
    planificadorMarkers = [];

    if (coords.length <= 1) {
        planificadorMap.getSource('route').setData({
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] }
        });
        return;
    }

    // Add markers
    coords.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = 'mapbox-marker';
        el.style.cssText = `
            width: ${i === 0 ? '30px' : '24px'};
            height: ${i === 0 ? '30px' : '24px'};
            background: ${i === 0 ? '#f59e0b' : '#3b82f6'};
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: ${i === 0 ? '14px' : '11px'};
            font-weight: 700;
        `;
        el.textContent = i === 0 ? '🏭' : String(i);
        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(c)
            .addTo(planificadorMap);
        planificadorMarkers.push(marker);
    });

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach(c => bounds.extend(c));
    planificadorMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });

    // Draw route line
    planificadorMap.getSource('route').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords }
    });
}

async function iniciarRuta(repartidorId) {
    const card = document.querySelector(`.repartidor-card[data-repartidor-id="${repartidorId}"]`);
    if (!card) return;
    const dropzone = card.querySelector('.dropzone');
    const pedidoCards = dropzone.querySelectorAll('.pedido-card');
    if (pedidoCards.length === 0) return;

    const repartidor = repartidoresData.find(r => r.id_repartidor == repartidorId);
    if (!repartidor) return;
    const vehiculo = repartidor.vehiculo;

    const pedidos = Array.from(pedidoCards).map((card, idx) => ({
        id_pedido: parseInt(card.dataset.pedidoId),
        orden: idx + 1,
    }));

    const result = await Swal.fire({
        title: '¿Iniciar ruta?',
        html: `
            <p><strong>Repartidor:</strong> ${repartidor.nombre}</p>
            <p><strong>Vehículo:</strong> ${vehiculo ? vehiculo.marca + ' ' + vehiculo.modelo + ' (' + vehiculo.placa + ')' : '—'}</p>
            <p><strong>Pedidos:</strong> ${pedidos.length}</p>
            <p style="color:var(--warning);margin-top:8px;">La ruta se marcará como "En curso".</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, iniciar ruta',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
    });

    if (!result.isConfirmed) return;

    try {
        const resp = await apiFetch('/logistica/planificacion/confirmar', {
            method: 'POST',
            body: {
                repartidor_id: repartidorId,
                vehiculo_id: vehiculo ? (vehiculo.id_vehiculo || null) : null,
                pedidos: pedidos,
            },
        });
        Swal.fire('Ruta iniciada', `Ruta con ${pedidos.length} pedido(s) asignada a ${repartidor.nombre}.`, 'success');
        await Promise.all([loadPedidosPendientes(), loadRepartidores()]);
        initSortables();
        updateMapRoute();
    } catch (e) {
        Swal.fire('Error', e.message || 'Error al iniciar ruta', 'error');
    }
}
