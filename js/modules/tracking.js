const GPS_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDLpt_G8VOvmePuAYEQyffhU1Qb9braKSw",
    authDomain: "mapboxfirebase-a79b5.firebaseapp.com",
    databaseURL: "https://mapboxfirebase-a79b5-default-rtdb.firebaseio.com",
    projectId: "mapboxfirebase-a79b5",
    storageBucket: "mapboxfirebase-a79b5.firebasestorage.app",
    messagingSenderId: "133519102970",
    appId: "1:133519102970:web:1bf07af71eda04b772ca43",
    measurementId: "G-SMVVH5FL53"
};

let trackingMap = null;
let trackingMarkers = {};
let trackingActiveId = null;
let firebaseTrackingRef = null;
let rutasActivas = [];
let firebaseUsuariosData = null;

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
        return `
            <article class="tracking-card ${isActive ? 'active' : ''}" onclick="selectTrackingRuta(${id})" data-ruta-id="${id}">
                <div class="tracking-card-top">
                    <div>
                        <strong>${trackSafe(getRepartidorNameTracking(rep))}</strong>
                        <p>${trackSafe(formatVehiculoTracking(veh))}</p>
                    </div>
                    <span class="badge badge-success">${progreso}%</span>
                </div>
                <div class="tracking-meta">${completadas}/${paradas.length} paradas · ${trackSafe(r.estado?.nombre_estado || r.estado || 'En curso')}</div>
                <div class="tracking-progress"><div class="tracking-progress-bar" style="width:${progreso}%"></div></div>
            </article>
        `;
    }).join('');
}

function selectTrackingRuta(id) {
    trackingActiveId = parseInt(id);
    document.querySelectorAll('.tracking-card').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.rutaId) === trackingActiveId);
    });
    const ruta = rutasActivas.find(r => getRutaId(r) === trackingActiveId);
    renderTrackingDetail(ruta);
    updateTrackingMap(ruta);
}

function renderTrackingDetail(ruta) {
    const container = document.getElementById('tracking-detail');
    if (!container) return;
    if (!ruta) {
        container.innerHTML = '<div class="empty-state compact">Seleccione una ruta para ver paradas, entregas y eventos.</div>';
        return;
    }

    const paradas = getRutaParadas(ruta);
    container.innerHTML = `
        <div class="tracking-detail-header">
            <div>
                <h3>Ruta #${getRutaId(ruta)}</h3>
                <p>${trackSafe(getRepartidorNameTracking(ruta.repartidor || {}))}</p>
            </div>
            ${getStatusBadge(ruta.estado?.nombre_estado || ruta.estado || 'En curso')}
        </div>
        <div class="route-progress-large">
            <div class="route-progress-bar"><span style="width:${getRutaProgreso(ruta)}%"></span></div>
            <small>${getRutaCompletadas(ruta)} de ${paradas.length} paradas completadas</small>
        </div>
        <div class="tracking-stops">
            ${paradas.length ? paradas.map((p, idx) => renderTrackingStop(p, idx)).join('') : '<div class="empty-state compact">Sin paradas registradas.</div>'}
        </div>
        <div class="route-events">
            <div class="route-event muted">Eventos en vivo disponibles cuando Firebase publique cambios de la ruta.</div>
        </div>
    `;
}

function renderTrackingStop(stop, idx) {
    const estado = stop.estado?.nombre_estado || stop.estado || 'Pendiente';
    const farmacia = stop.farmacia || stop.pedido?.farmacia?.nombre || stop.nombre_farmacia || 'Sin farmacia';
    const pedido = stop.id_pedido || stop.pedido_id || stop.pedido?.id_pedido || '';
    return `
        <div class="tracking-stop">
            <div class="stop-index">${idx + 1}</div>
            <div>
                <strong>${trackSafe(farmacia)}</strong>
                <p>Pedido #${pedido || '-'}</p>
            </div>
            ${getStatusBadge(estado)}
        </div>
    `;
}

function initTrackingMap() {
    const container = document.getElementById('tracking-map');
    if (!container || typeof mapboxgl === 'undefined') return;

    if (trackingMap) {
        trackingMap.resize();
        updateTrackingMap(rutasActivas.find(r => getRutaId(r) === trackingActiveId));
        return;
    }

    mapboxgl.accessToken = GPS_MAPBOX_TOKEN;
    trackingMap = new mapboxgl.Map({
        container: 'tracking-map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-67.8217, -16.4897],
        zoom: 12,
    });
    trackingMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    trackingMap.on('load', () => {
        updateTrackingMap(rutasActivas.find(r => getRutaId(r) === trackingActiveId));
    });
}

function updateTrackingMap(ruta) {
    if (!trackingMap || !trackingMap.loaded() || !ruta) return;

    Object.keys(trackingMarkers).forEach(k => {
        if (k.startsWith('gps')) return;
        trackingMarkers[k].remove();
        delete trackingMarkers[k];
    });

    const rep = ruta.repartidor || {};
    let origenCoords = null;

    if (rep.firebase_uid && firebaseUsuariosData?.[rep.firebase_uid]?.ubicacion) {
        const u = firebaseUsuariosData[rep.firebase_uid].ubicacion;
        const lat = u.lat ?? u.latitud;
        const lng = u.lng ?? u.longitud;
        if (lat != null && lng != null) {
            origenCoords = [parseFloat(lng), parseFloat(lat)];
        }
    }

    const coords = origenCoords ? [origenCoords] : [];
    const bounds = new mapboxgl.LngLatBounds();

    if (origenCoords) {
        bounds.extend(origenCoords);
        trackingMarkers.gps = createTrackingMarker('GPS', origenCoords, '#111827', `
            <b>${trackSafe(getRepartidorNameTracking(rep))}</b><br>
            ${trackSafe(formatVehiculoTracking(ruta.vehiculo || ruta))}
        `);
    }

    getRutaParadas(ruta).forEach((stop, idx) => {
        const stopCoords = getStopCoords(stop);
        if (!stopCoords) return;
        coords.push(stopCoords);
        bounds.extend(stopCoords);
        const estado = normalizeTrack(stop.estado?.nombre_estado || stop.estado || '');
        const color = estado.includes('entreg') ? '#10b981'
            : estado.includes('fall') || estado.includes('cancel') ? '#ef4444'
            : estado.includes('camino') || estado.includes('ruta') ? '#2563eb'
            : '#64748b';
        const popup = `
            <b>${trackSafe(stop.farmacia || stop.pedido?.farmacia?.nombre || 'Parada')}</b><br>
            Estado: ${trackSafe(stop.estado?.nombre_estado || stop.estado || 'Pendiente')}<br>
            Pedido #${trackSafe(stop.id_pedido || stop.pedido_id || '')}
        `;
        trackingMarkers[`parada_${idx}`] = createTrackingMarker(String(idx + 1), stopCoords, color, popup);
    });

    drawTrackingRoute(coords);
    if (coords.length > 1) trackingMap.fitBounds(bounds, { padding: 64, maxZoom: 14 });
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
                } else if (trackingMap.loaded()) {
                    trackingMarkers[key] = createTrackingMarker('GPS', coords, '#111827', `
                        <b>${trackSafe(rutaData.repartidor || 'Repartidor')}</b><br>
                        ${trackSafe(rutaData.vehiculo || '')}
                    `);
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
                } else if (trackingMap.loaded()) {
                    trackingMarkers[key] = createTrackingMarker('GPS', coords, '#111827', `
                        <b>${trackSafe(getRepartidorNameTracking(rep))}</b><br>
                        ${trackSafe(formatVehiculoTracking(ruta.vehiculo || ruta))}
                    `);
                }
            });

            if (trackingActiveId) {
                const ruta = rutasActivas.find(r => getRutaId(r) === trackingActiveId);
                if (ruta) updateTrackingMap(ruta);
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

function getRepartidorNameTracking(rep) {
    const userName = `${rep?.usuario?.nombre || ''} ${rep?.usuario?.apellido || ''}`.trim();
    return rep?.nombre || userName || 'Sin repartidor';
}

function formatVehiculoTracking(veh) {
    const marca = veh?.marca?.nombre_marca || veh?.marca || '';
    const modelo = veh?.modelo?.nombre_modelo || veh?.modelo || '';
    const placa = veh?.placa ? `(${veh.placa})` : '';
    return `${marca} ${modelo} ${placa}`.trim() || 'Sin vehiculo';
}

function normalizeTrack(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function trackSafe(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}
