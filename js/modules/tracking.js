const GPS_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4cLbVTBp3Ee_YqF-9HZFSr7XId0WLZsk",
    authDomain: "mapboxfirebase-a79b5.firebaseapp.com",
    databaseURL: "https://mapboxfirebase-a79b5-default-rtdb.firebaseio.com",
    projectId: "mapboxfirebase-a79b5",
    storageBucket: "mapboxfirebase-a79b5.firebasestorage.app",
};

let trackingMap = null;
let trackingMarkers = {};
let trackingActiveId = null;
let firebaseTrackingRef = null;
let rutasActivas = [];

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
    renderTrackingList();

    if (rutasActivas.length > 0 && !trackingActiveId) {
        selectTrackingRuta(rutasActivas[0].id_control_ruta);
    }
}

function renderTrackingList() {
    const container = document.getElementById('tracking-list-body');
    if (!container) return;
    document.getElementById('tracking-count').textContent = rutasActivas.length;

    if (rutasActivas.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:13px;"><i class="fas fa-info-circle" style="font-size:32px;display:block;margin-bottom:12px;"></i>No hay rutas activas</div>';
        return;
    }

    container.innerHTML = rutasActivas.map(r => {
        const rep = r.repartidor || {};
        const veh = r.vehiculo || {};
        const isActive = trackingActiveId === r.id_control_ruta;
        return `
            <div class="tracking-card ${isActive ? 'active' : ''}"
                 onclick="selectTrackingRuta(${r.id_control_ruta})"
                 data-ruta-id="${r.id_control_ruta}">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${rep.nombre || '—'}</strong>
                        <div style="font-size:12px;color:var(--text-muted);">
                            ${veh.marca ? veh.marca + ' ' : ''}${veh.modelo || ''}
                            ${veh.placa ? '(' + veh.placa + ')' : ''}
                        </div>
                    </div>
                    <span class="badge badge-success">${r.progreso || 0}%</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                    ${r.completadas || 0}/${r.total_paradas || 0} paradas
                </div>
                <div class="tracking-progress">
                    <div class="tracking-progress-bar" style="width:${r.progreso || 0}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function selectTrackingRuta(id) {
    trackingActiveId = id;
    document.querySelectorAll('.tracking-card').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.rutaId) === id);
    });

    const ruta = rutasActivas.find(r => r.id_control_ruta === id);
    if (!ruta || !trackingMap) return;

    updateTrackingMap(ruta);
}

function initTrackingMap() {
    const container = document.getElementById('tracking-map');
    if (!container) return;
    if (trackingMap) {
        trackingMap.resize();
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
}

function updateTrackingMap(ruta) {
    if (!trackingMap) return;

    Object.values(trackingMarkers).forEach(m => m.remove());
    trackingMarkers = {};

    const bounds = new mapboxgl.LngLatBounds();
    const almacenCoords = [-67.8217, -16.4897];
    bounds.extend(almacenCoords);

    // Almacen marker
    const almacenEl = document.createElement('div');
    almacenEl.textContent = '🏭';
    almacenEl.style.cssText = 'font-size:24px;';
    trackingMarkers['almacen'] = new mapboxgl.Marker({ element: almacenEl })
        .setLngLat(almacenCoords)
        .setPopup(new mapboxgl.Popup().setHTML('<b>Almacén Central</b>'))
        .addTo(trackingMap);

    // Paradas markers
    (ruta.despachos || []).forEach((d, i) => {
        if (!d.latitud || !d.longitud) return;
        const coords = [parseFloat(d.longitud), parseFloat(d.latitud)];
        bounds.extend(coords);

        const color = d.estado === 'Entregado' ? '#10b981'
            : d.estado === 'Fallido' ? '#ef4444'
            : d.estado === 'En camino' ? '#3b82f6'
            : '#94a3b8';

        const el = document.createElement('div');
        el.textContent = String(i + 1);
        el.style.cssText = `
            width: 26px; height: 26px; background: ${color};
            border-radius: 50%; border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 11px; font-weight: 700;
        `;
        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setHTML(`
                <b>${d.farmacia || '—'}</b><br>
                Estado: ${d.estado || '—'}<br>
                Pedido #${d.pedido_id || ''}
            `))
            .addTo(trackingMap);
        trackingMarkers[`parada_${i}`] = marker;
    });

    if (bounds._ne && bounds._sw) {
        trackingMap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    // Draw route line
    const coords = [almacenCoords];
    (ruta.despachos || []).forEach(d => {
        if (d.longitud && d.latitud) {
            coords.push([parseFloat(d.longitud), parseFloat(d.latitud)]);
        }
    });

    if (trackingMap.getSource('tracking-route')) {
        trackingMap.getSource('tracking-route').setData({
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: coords }
        });
    } else {
        trackingMap.addSource('tracking-route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
        });
        trackingMap.addLayer({
            id: 'tracking-route-line',
            type: 'line',
            source: 'tracking-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 2] }
        });
    }
}

function listenFirebaseTracking() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(GPS_FIREBASE_CONFIG);
        }
        const db = firebase.database();

        if (firebaseTrackingRef) {
            firebaseTrackingRef.off();
        }

        firebaseTrackingRef = db.ref('rutas_activas');
        firebaseTrackingRef.on('value', function (snapshot) {
            const data = snapshot.val();
            if (!data) return;

            Object.keys(data).forEach(function (rutaId) {
                const rutaData = data[rutaId];
                if (!rutaData || !rutaData.ubicacion) return;

                const markerKey = 'gps_' + rutaId;
                const lat = rutaData.ubicacion.lat;
                const lng = rutaData.ubicacion.lng;

                if (!trackingMap) return;

                if (trackingMarkers[markerKey]) {
                    trackingMarkers[markerKey].setLngLat([lng, lat]);
                } else {
                    const el = document.createElement('div');
                    el.innerHTML = '🚚';
                    el.style.cssText = 'font-size:28px;';
                    const marker = new mapboxgl.Marker({ element: el })
                        .setLngLat([lng, lat])
                        .setPopup(new mapboxgl.Popup().setHTML(`
                            <b>${rutaData.repartidor || 'Repartidor'}</b><br>
                            ${rutaData.vehiculo || ''}
                        `))
                        .addTo(trackingMap);
                    trackingMarkers[markerKey] = marker;
                }
            });
        });
    } catch (e) {
        console.warn('Firebase init warning:', e);
    }
}
