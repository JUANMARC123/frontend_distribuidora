var gpsMapa, gpsDraw;
var gpsMarcadores = {};
var gpsUsuarioSeleccionado = null;
var gpsRepartidoresApi = [];

function gpsEstaConectado(firebaseUser) {
    if (!firebaseUser?.ubicacion) return false;
    if (firebaseUser.ubicacion.latitud == null) return false;

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

const GPS_MAPBOX_TOKEN = window.GPS_MAPBOX_TOKEN || null;
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

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Repartidores', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await cargarRepartidoresApi();
    renderPage();
});

async function cargarRepartidoresApi() {
    try {
        var d = await apiFetch('/repartidores');
        gpsRepartidoresApi = Array.isArray(d) ? d : (d.data || []);
    } catch (e) {
        gpsRepartidoresApi = [];
    }
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div id="gps-container">
            <div id="gps-mapa"></div>
            <aside id="gps-panel">
                <header class="gps-panel-header">
                    <h2>Panel GPS</h2>
                    <input type="text" id="gps-buscador" placeholder="Buscar usuario..." oninput="gpsFiltrarUsuarios(this.value)" />
                </header>
                <section id="gps-lista-usuarios">
                    <h3>Usuarios</h3>
                    <div id="gps-usuarios"></div>
                </section>
                <section id="gps-geocercas-panel">
                    <h3>Geocercas</h3>
                    <div id="gps-info-geocerca">
                        <p>Selecciona un usuario para gestionar sus geocercas</p>
                    </div>
                    <div class="gps-botones-geocerca">
                        <button id="gps-btn-crear" disabled>➕ Crear Geocerca</button>
                        <button id="gps-btn-guardar" disabled>💾 Guardar</button>
                        <button id="gps-btn-editar" disabled>✏️ Editar</button>
                        <button id="gps-btn-eliminar" disabled>🗑️ Eliminar</button>
                    </div>
                </section>
            </aside>
        </div>
    `;
    initMapbox();
    initFirebase();
    bindButtons();
}

function initMapbox() {
    mapboxgl.accessToken = GPS_MAPBOX_TOKEN;
    gpsMapa = new mapboxgl.Map({
        container: 'gps-mapa',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-68.15, -16.50],
        zoom: 15
    });

    gpsDraw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
        styles: [
            { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon']], paint: { 'fill-color': '#3b9ddd', 'fill-opacity': 0.3 } },
            { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon']], paint: { 'line-color': '#3b9ddd', 'line-width': 2 } },
            { id: 'gl-draw-polygon-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 4, 'circle-color': '#3b9ddd' } },
            { id: 'gl-draw-polygon-vertex', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#3b9ddd', 'circle-stroke-width': 2 } }
        ]
    });

    gpsMapa.on('draw.create', function (e) {
        if (gpsUsuarioSeleccionado) gpsActualizarInfoGeocerca('Geocerca creada (' + e.features.length + ')<br>Presiona "Guardar" para guardar en Firebase');
    });
    gpsMapa.on('draw.update', function (e) {
        if (gpsUsuarioSeleccionado) gpsActualizarInfoGeocerca('Geocerca actualizada (' + e.features.length + ')<br>Presiona "Guardar" para guardar en Firebase');
    });
    gpsMapa.on('draw.delete', function (e) {
        if (gpsUsuarioSeleccionado) gpsActualizarInfoGeocerca('Geocercas eliminadas del mapa<br>Presiona "Guardar" para guardar en Firebase');
    });

    gpsMapa.on('load', function () {
        gpsMapa.addControl(gpsDraw, 'top-right');
    });
}

function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(GPS_FIREBASE_CONFIG);
    var db = firebase.database();
    var usuariosRef = db.ref('usuarios');
    usuariosRef.on('value', function (snapshot) {
        var data = snapshot.val();
        if (!data) {
            gpsLimpiarMarcadores();
            gpsMostrarUsuarios(null, function () {});
            gpsUsuarioSeleccionado = null;
            gpsHabilitarBotonesGeocerca(false);
            gpsActualizarInfoGeocerca('Selecciona un usuario para gestionar sus geocercas');
            return;
        }
        gpsActualizarMarcadores(data);
        gpsMostrarUsuarios(data, function (userId) {
            gpsUsuarioSeleccionado = userId;
            gpsResaltarUsuario(userId);
            gpsEnfocarUsuario(userId, data);
            gpsCargarGeocercas(userId);
            gpsHabilitarBotonesGeocerca(true);
            var userData = data[userId];
            var nombre = (userData.info && userData.info.nombre) ? userData.info.nombre : userId;
            gpsActualizarInfoGeocerca('Usuario: ' + nombre + '<br>Haz clic en el mapa para dibujar una geocerca');
        });
    }, function (error) {
        console.error('Error Firebase:', error);
    });
}

function gpsEncontrarRepartidor(nombre, firebaseUid) {
    if (gpsRepartidoresApi.length === 0) return null;
    if (firebaseUid) {
        for (var i = 0; i < gpsRepartidoresApi.length; i++) {
            if (gpsRepartidoresApi[i].firebase_uid === firebaseUid) {
                return gpsRepartidoresApi[i];
            }
        }
    }
    if (!nombre) return null;
    var q = nombre.toLowerCase().trim();
    for (var i = 0; i < gpsRepartidoresApi.length; i++) {
        var r = gpsRepartidoresApi[i];
        var u = r.usuario || {};
        var nombreCompleto = ((u.nombre || '') + ' ' + (u.apellido || '')).toLowerCase().trim();
        if (nombreCompleto.indexOf(q) !== -1 || q.indexOf(nombreCompleto) !== -1) {
            return r;
        }
    }
    return null;
}

function gpsActualizarMarcadores(usuarios) {
    Object.keys(gpsMarcadores).forEach(function (id) {
        if (!usuarios[id]) {
            gpsMarcadores[id].remove();
            delete gpsMarcadores[id];
        }
    });
    Object.keys(usuarios).forEach(function (id) {
        var data = usuarios[id];
        var ubicacion = data.ubicacion;
        if (!ubicacion || ubicacion.latitud == null || ubicacion.longitud == null) return;
        if (gpsMarcadores[id]) {
            gpsMarcadores[id].setLngLat([ubicacion.longitud, ubicacion.latitud]);
        } else {
            var el = document.createElement('div');
            el.className = 'gps-marker-marker';
            el.style.backgroundColor = gpsEstaConectado(data) ? '#10b981' : '#94a3b8';
            var popupHtml = '<b>' + ((data.info && data.info.nombre) ? data.info.nombre : id) + '</b>';
            var match = gpsEncontrarRepartidor(data.info && data.info.nombre ? data.info.nombre : '', id);
            if (match) {
                var u = match.usuario || {};
                popupHtml += '<br>CI: ' + (match.ci || '—');
                popupHtml += '<br>Licencia: ' + ((match.licencia && match.licencia.categoria) || match.categoria_licencia || '—');
                popupHtml += '<br>Estado BD: ' + ((match.estado && match.estado.nombre_estado) || match.nombre_estado || '—');
            }
            var popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);
            gpsMarcadores[id] = new mapboxgl.Marker({ element: el })
                .setLngLat([ubicacion.longitud, ubicacion.latitud])
                .setPopup(popup)
                .addTo(gpsMapa);
            gpsMarcadores[id]._firebaseId = id;
        }
    });
}

function gpsLimpiarMarcadores() {
    Object.values(gpsMarcadores).forEach(function (m) { m.remove(); });
    gpsMarcadores = {};
}

function gpsMostrarUsuarios(usuarios, onClick) {
    var contenedor = document.getElementById('gps-usuarios');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (!usuarios || Object.keys(usuarios).length === 0) {
        contenedor.innerHTML = '<div class="gps-sin-datos">⚠️ No hay dispositivos conectados</div>';
        return;
    }
    var entries = Object.entries(usuarios);
    entries.forEach(function (_a) {
        var id = _a[0], data = _a[1];
        var div = document.createElement('div');
        div.classList.add('gps-usuario');
        div.id = 'gps-user-' + id;
        var lat = (data.ubicacion && data.ubicacion.latitud) ? data.ubicacion.latitud : '-';
        var lng = (data.ubicacion && data.ubicacion.longitud) ? data.ubicacion.longitud : '-';
        var nombre = (data.info && data.info.nombre) ? data.info.nombre : id;
        var estado = gpsEstaConectado(data) ? '🟢' : '🔴';
        var match = gpsEncontrarRepartidor(data.info && data.info.nombre ? data.info.nombre : '', id);
        var extra = '';
        if (match) {
            var u = match.usuario || {};
            extra = '<small>' + ((u.nombre || '') + ' ' + (u.apellido || '')).trim() + ' | ' + (match.ci || '') + '</small>';
        }
        div.innerHTML = '<div class="gps-usuario-header"><strong>' + estado + ' ' + nombre + '</strong></div>' + extra + '<p class="gps-coordenadas">📍 ' + lat + ', ' + lng + '</p>';
        div.onclick = function () { onClick(id); };
        contenedor.appendChild(div);
    });
}

function gpsEnfocarUsuario(id, usuarios) {
    var user = usuarios[id];
    if (!user || !user.ubicacion) return;
    gpsMapa.flyTo({ center: [user.ubicacion.longitud, user.ubicacion.latitud], zoom: 16 });
}

function gpsResaltarUsuario(id) {
    document.querySelectorAll('.gps-usuario').forEach(function (el) { el.classList.remove('activo'); });
    var sel = document.getElementById('gps-user-' + id);
    if (sel) {
        sel.classList.add('activo');
        sel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function gpsFiltrarUsuarios(texto) {
    var usuarios = document.querySelectorAll('.gps-usuario');
    var t = texto.toLowerCase();
    usuarios.forEach(function (u) {
        u.style.display = u.textContent.toLowerCase().includes(t) ? '' : 'none';
    });
}

// --- Geocercas ---

function gpsGuardarGeocercasDraw(usuarioId) {
    if (!usuarioId) throw new Error('No hay usuario seleccionado');
    var data = gpsDraw.getAll().features;
    if (data.length === 0) return null;
    var resultado = {};
    data.forEach(function (f, i) {
        if (f.geometry.type === 'Polygon') {
            var coords = f.geometry.coordinates[0];
            resultado['geo_' + Date.now() + '_' + i] = {
                nombre: (f.properties && f.properties.name) ? f.properties.name : 'Zona ' + (i + 1),
                puntos: coords.map(function (c) { return { lng: c[0], lat: c[1] }; }),
                tipo: f.geometry.type,
                fechaCreacion: new Date().toISOString()
            };
        }
    });
    var db = firebase.database();
    db.ref('geocercas/' + usuarioId).set(resultado);
    return resultado;
}

function gpsCargarGeocercas(userId) {
    if (!userId) return;
    if (!gpsDraw) return;
    gpsDraw.deleteAll();
    gpsDraw.changeMode('simple_select');
    var db = firebase.database();
    db.ref('geocercas/' + userId).on('value', function (snapshot) {
        var data = snapshot.val();
        if (!data) return;
        Object.values(data).forEach(function (g, index) {
            if (g.puntos && g.puntos.length > 0) {
                var coords = g.puntos.map(function (p) { return [p.lng, p.lat]; });
                gpsDraw.add({
                    type: 'Feature',
                    properties: { id: 'geo_' + index, name: g.nombre || 'Zona ' + (index + 1) },
                    geometry: { type: 'Polygon', coordinates: [coords] }
                });
            }
        });
    });
}

function gpsEliminarGeocercas(usuarioId) {
    if (!usuarioId) throw new Error('No hay usuario seleccionado');
    gpsDraw.deleteAll();
    gpsDraw.changeMode('simple_select');
    var db = firebase.database();
    db.ref('geocercas/' + usuarioId).set(null);
}

function gpsActualizarInfoGeocerca(mensaje) {
    var info = document.getElementById('gps-info-geocerca');
    if (info) info.innerHTML = '<p>' + mensaje + '</p>';
}

function gpsHabilitarBotonesGeocerca(h) {
    document.getElementById('gps-btn-crear').disabled = !h;
    document.getElementById('gps-btn-guardar').disabled = !h;
    document.getElementById('gps-btn-editar').disabled = !h;
    document.getElementById('gps-btn-eliminar').disabled = !h;
}

// --- Notificaciones ---

function gpsMostrarNotificacion(mensaje, tipo) {
    tipo = tipo || 'info';
    var notif = document.getElementById('notificacion');
    notif.textContent = mensaje;
    notif.className = 'gps-notificacion ' + tipo;
    notif.classList.remove('oculto');
    setTimeout(function () { notif.classList.add('oculto'); }, 3000);
}

// --- Botones ---

function bindButtons() {
    document.getElementById('gps-btn-crear').addEventListener('click', function () {
        if (!gpsUsuarioSeleccionado) { gpsMostrarNotificacion('Selecciona un usuario primero', 'error'); return; }
        var nombre = prompt('Nombre para la geocerca:', 'Zona Nueva');
        if (nombre) gpsMostrarNotificacion('Creando geocerca "' + nombre + '"...', 'info');
    });

    document.getElementById('gps-btn-guardar').addEventListener('click', function () {
        if (!gpsUsuarioSeleccionado) { gpsMostrarNotificacion('Selecciona un usuario primero', 'error'); return; }
        try {
            gpsGuardarGeocercasDraw(gpsUsuarioSeleccionado);
            gpsMostrarNotificacion('Geocercas guardadas en Firebase', 'exito');
        } catch (e) {
            console.error(e);
            gpsMostrarNotificacion('Error al guardar geocercas', 'error');
        }
    });

    document.getElementById('gps-btn-editar').addEventListener('click', function () {
        if (!gpsUsuarioSeleccionado) { gpsMostrarNotificacion('Selecciona un usuario primero', 'error'); return; }
        gpsCargarGeocercas(gpsUsuarioSeleccionado);
        gpsMostrarNotificacion('Geocercas cargadas para editar', 'info');
    });

    document.getElementById('gps-btn-eliminar').addEventListener('click', function () {
        if (!gpsUsuarioSeleccionado) { gpsMostrarNotificacion('Selecciona un usuario primero', 'error'); return; }
        if (confirm('¿Eliminar todas las geocercas de este usuario?')) {
            try {
                gpsEliminarGeocercas(gpsUsuarioSeleccionado);
                gpsMostrarNotificacion('Geocercas eliminadas', 'exito');
            } catch (e) {
                console.error(e);
                gpsMostrarNotificacion('Error al eliminar geocercas', 'error');
            }
        }
    });
}
