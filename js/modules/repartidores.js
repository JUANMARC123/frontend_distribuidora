let repartidoresTable, editingId = null;
let usuariosDisponibles = [], estadosRep = [], licencias = [], vehiculosList = [];
let firebaseUsuarios = {};
let firebaseAppInited = false;
// 'init' | 'ok' | 'error' — sirve para distinguir "aun sin datos" de "Firebase caido".
let firebaseStatus = 'init';

// Extensiones de carnet de identidad de Bolivia. Se guardan dentro del propio
// campo `ci` (ej. "12345678 LP"); no existe tabla de extensiones.
const EXTENSIONES_CI = ['LP', 'SC', 'CB', 'OR', 'PT', 'TJ', 'CH', 'BN', 'PA'];

function estaConectado(firebaseUser) {
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

// Las credenciales de Firebase vienen de js/config.js (GPS_FIREBASE_CONFIG).
// Antes estaban duplicadas aqui con otro nombre distinto por modulo, que es justo
// como se cuela una divergencia silenciosa cuando cambian.

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Repartidores', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    await Promise.all([loadCatalogos()]);
    renderPage();
    initFirebaseRepartidores();
});

async function loadCatalogos() {
    try { const d = await apiFetch('/usuarios?per_page=-1'); usuariosDisponibles = Array.isArray(d) ? d : (d.data || []); } catch (e) { usuariosDisponibles = []; }
    try { const d = await apiFetch('/catalogos/estados-repartidor'); estadosRep = Array.isArray(d) ? d : (d.data || []); } catch (e) { estadosRep = [{ clave: 'activo', nombre_estado: 'Activo' }, { clave: 'inactivo', nombre_estado: 'Inactivo' }, { clave: 'en_ruta', nombre_estado: 'En ruta' }]; }
    try { const d = await apiFetch('/catalogos/licencias'); licencias = Array.isArray(d) ? d : (d.data || []); } catch (e) { licencias = [{ clave: 'A', categoria: 'A' }, { clave: 'B', categoria: 'B' }, { clave: 'C', categoria: 'C' }]; }
    try { const d = await apiFetch('/vehiculos?per_page=-1'); vehiculosList = Array.isArray(d) ? d : (d.data || []); } catch (e) { vehiculosList = []; }
}

function initFirebaseRepartidores() {
    try {
        if (!window.firebase) {
            firebaseStatus = 'error';
            actualizarSelectFirebase();
            return;
        }
        if (!firebase.apps.length) firebase.initializeApp(GPS_FIREBASE_CONFIG);
        firebaseAppInited = true;
        firebaseStatus = 'ok';
        var db = firebase.database();
        var usuariosRef = db.ref('usuarios');
        usuariosRef.on('value', function (snapshot) {
            var data = snapshot.val();
            firebaseUsuarios = data || {};
            actualizarSelectFirebase();
            refreshFirebaseColumn();
        });
    } catch (e) {
        firebaseStatus = 'error';
        console.warn('Firebase init warning:', e);
        actualizarSelectFirebase();
    }
}

function refreshFirebaseColumn() {
    if (!document.getElementById('main-table')) return;
    if (!repartidoresTable) {
        setTimeout(refreshFirebaseColumn, 200);
        return;
    }
    repartidoresTable.rows().invalidate().draw(false);
}

/**
 * Llena el selector "Vincular usuario de Firebase" solo con dispositivos REALES
 * que esten publicando en Firebase (`usuarios/{id}`). No inventa opciones para
 * ids que no existen: si no hay ninguno, el selector queda deshabilitado.
 */
function actualizarSelectFirebase() {
    var sel = document.getElementById('f-firebase-uid');
    if (!sel) return;

    var anterior = sel.value;
    var uids = Object.keys(firebaseUsuarios || {});

    sel.innerHTML = '<option value="">— No vincular —</option>';

    if (uids.length === 0) {
        var vacio = document.createElement('option');
        vacio.value = '';
        vacio.disabled = true;
        vacio.textContent = firebaseStatus === 'error'
            ? 'Firebase no disponible'
            : 'Sin dispositivos de Firebase conectados';
        sel.appendChild(vacio);
        sel.disabled = true;
        sel.value = '';
        return;
    }

    sel.disabled = false;
    uids.forEach(function (id) {
        var u = firebaseUsuarios[id] || {};
        var info = u.info || {};
        var nombre = info.nombre || id;
        var dispositivo = info.dispositivo ? ' · ' + info.dispositivo : '';
        var estado = estaConectado(u) ? '🟢' : '🔴';
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = estado + ' ' + nombre + dispositivo + ' (' + id.substring(0, 8) + '...)';
        sel.appendChild(opt);
    });

    // Solo conserva la selección si corresponde a un dispositivo real.
    sel.value = (anterior && uids.indexOf(anterior) !== -1) ? anterior : '';
}

function renderPage() {
    document.getElementById('page-content').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-truck"></i> Repartidores</h3>
                ${hasPermission('Repartidores', 'crear') ? '<button class="btn btn-primary" onclick="openCreateModal()"><i class="fas fa-plus"></i> Nuevo Repartidor</button>' : ''}
            </div>
            <div class="card-body">
                <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr>
                    <th>Nombre</th><th>CI</th><th>Licencia</th><th>Estado</th><th>Vehiculo</th><th>Firebase</th><th>Acciones</th>
                </tr></thead></table></div>
            </div>
        </div>
        <div id="main-modal" class="modal-overlay"><div class="modal">
            <div class="modal-header"><h3 id="modal-title">Nuevo Repartidor</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
                <form id="main-form">
                    <div class="form-group"><label>Usuario *</label><select id="f-usuario" class="form-control" required><option value="">Seleccione un usuario...</option>${usuariosDisponibles.map(u => `<option value="${u.id_usuario}">${u.nombre || ''} ${u.apellido || ''} (${u.email})</option>`).join('')}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>CI *</label><input type="text" id="f-ci" class="form-control" required></div>
                        <div class="form-group"><label>Extensión CI</label><select id="f-extension" class="form-control"><option value="">Seleccione...</option>${EXTENSIONES_CI.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Licencia</label><select id="f-licencia" class="form-control"><option value="">Seleccione...</option>${licencias.map(l => `<option value="${l.clave || l.categoria}">${l.nombre || l.categoria}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Estado</label><select id="f-estado" class="form-control">${estadosRep.map(e => `<option value="${e.clave}">${e.nombre_estado}</option>`).join('')}</select></div>
                    </div>
                    <div class="form-group"><label>Vincular usuario de Firebase</label><select id="f-firebase-uid" class="form-control"><option value="">— No vincular —</option></select></div>
                    <div class="form-group"><label>Vehiculo asignado</label><select id="f-vehiculo" class="form-control"><option value="">Sin vehiculo asignado</option>${vehiculosList.map(v => `<option value="${v.id_vehiculo}">${v.placa} - ${v.marca || ''} ${v.modelo || ''}</option>`).join('')}</select></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
        </div></div>
        <div id="estado-modal" class="modal-overlay"><div class="modal" style="max-width:400px;">
            <div class="modal-header"><h3>Cambiar Estado</h3><button class="modal-close" onclick="closeEstadoModal()">&times;</button></div>
            <div class="modal-body">
                <p class="text-muted mb-4">Seleccione el nuevo estado para el repartidor <strong id="estado-ref"></strong></p>
                <div class="form-group"><label>Nuevo Estado</label><select id="s-estado" class="form-control">${estadosRep.map(e => `<option value="${e.clave}">${e.nombre_estado}</option>`).join('')}</select></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeEstadoModal()">Cancelar</button><button class="btn btn-primary" onclick="changeEstado()">Cambiar</button></div>
        </div></div>
    `;
    loadTable();
}

async function loadTable() {
    try {
        const d = await apiFetch('/repartidores');
        const data = Array.isArray(d) ? d : (d.data || []);
        if ($.fn.DataTable.isDataTable('#main-table')) repartidoresTable.destroy();
        repartidoresTable = $('#main-table').DataTable({
            data, pageLength: 10, order: [[0, 'asc']],
            language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
            columns: [
                { data: null, render: r => { const u = r.usuario; return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : (r.nombre_usuario || '—'); } },
                { data: null, render: r => `${r.ci || '—'}` },
                { data: null, render: r => r.categoria_licencia || r.licencia?.categoria || '—' },
                { data: null, render: r => getStatusBadge(r.estado || r.estado?.nombre_estado || '—') },
                { data: null, render: r => {
                    const asignacion = r.asignacion_activa || r.asignacion_vehiculo_activa || r.asignacionVehiculoActiva || null;
                    const v = asignacion?.vehiculo || r.vehiculo || null;
                    return v ? `${v.placa || ''} ${v.marca || ''} ${v.modelo || ''}`.trim() : '<span class="text-muted">Sin vehiculo</span>';
                } },
                { data: null, render: r => {
                    var fb = r.firebase_uid;
                    if (!fb) return '<span class="badge badge-secondary" style="background:#64748b">Sin vincular</span>';
                    var fbUser = firebaseUsuarios[fb];
                    if (fbUser === undefined) return '<span class="badge" style="background:#6366f1">🔗 Vinculado (sin dispositivo)</span>';
                    if (estaConectado(fbUser)) return '<span class="badge badge-success" style="background:#10b981">🟢 En línea</span>';
                    return '<span class="badge badge-warning" style="background:#f59e0b">🔴 Sin señal</span>';
                } },
                { data: null, render: r => `<div class="actions">
                    ${hasPermission('Repartidores', 'cambiar-estado') ? `<button class="btn btn-sm btn-info" onclick="openEstadoModal(${r.id_repartidor},'${(r.usuario?.nombre || r.nombre || '').replace(/'/g, "\\'")}')"><i class="fas fa-exchange-alt"></i></button>` : ''}
                    ${hasPermission('Repartidores', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit(${r.id_repartidor})"><i class="fas fa-edit"></i></button>` : ''}
                    ${hasPermission('Repartidores', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del(${r.id_repartidor})"><i class="fas fa-trash"></i></button>` : ''}
                </div>`, orderable: false }
            ]
        });
        if (Object.keys(firebaseUsuarios).length > 0) refreshFirebaseColumn();
    } catch (e) { Swal.fire('Error', 'Error al cargar repartidores: ' + e.message, 'error'); }
}

function openCreateModal() {
    editingId = null; document.getElementById('modal-title').textContent = 'Nuevo Repartidor';
    document.getElementById('main-form').reset(); document.getElementById('main-modal').classList.add('active');
}
function closeModal() { document.getElementById('main-modal').classList.remove('active'); editingId = null; }

async function edit(id) {
    try {
        const d = await apiFetch(`/repartidores/${id}`);
        const r = d.repartidor || d.data || d;
        editingId = id;
        document.getElementById('modal-title').textContent = 'Editar Repartidor';
        document.getElementById('f-usuario').value = r.id_usuario || '';
        const { numero, extension } = separarCi(r.ci);
        document.getElementById('f-ci').value = numero;
        document.getElementById('f-extension').value = extension;
        document.getElementById('f-licencia').value = r.categoria_licencia || '';
        document.getElementById('f-estado').value = r.estado || '';
        const fbSel = document.getElementById('f-firebase-uid');
        fbSel.value = r.firebase_uid || '';
        if (r.firebase_uid && firebaseStatus === 'ok'
            && Object.keys(firebaseUsuarios).length > 0
            && firebaseUsuarios[r.firebase_uid] === undefined) {
            // Hay dispositivos reales, pero el id guardado no es uno de ellos
            // (id inventado). No lo recreamos: se elige uno real o se deja vacio.
            Swal.fire('Aviso', 'El usuario de Firebase vinculado ya no está disponible. Elige un dispositivo real o deja "No vincular".', 'info');
        }
        const asignacion = r.asignacion_activa || r.asignacion_vehiculo_activa || r.asignacionVehiculoActiva || null;
        document.getElementById('f-vehiculo').value = asignacion?.id_vehiculo || asignacion?.vehiculo?.id_vehiculo || '';
        document.getElementById('main-modal').classList.add('active');
    } catch (e) { Swal.fire('Error', 'No se pudo cargar el repartidor', 'error'); }
}

/** "12345678 LP" => { numero: "12345678", extension: "LP" } */
function separarCi(ci) {
    const texto = String(ci || '').trim();
    const match = texto.match(/^(.*?)\s*([A-Za-z]{2})?$/);
    return { numero: (match?.[1] || '').trim(), extension: (match?.[2] || '').toUpperCase() };
}

/** "12345678" + "LP" => "12345678 LP" (o solo el número si no hay extensión). */
function componerCi(numero, extension) {
    const base = String(numero || '').trim();
    const ext = String(extension || '').trim();
    return ext ? `${base} ${ext}` : base;
}

async function save() {
    const extension = document.getElementById('f-extension').value;
    const body = {
        id_usuario: parseInt(document.getElementById('f-usuario').value),
        ci: componerCi(document.getElementById('f-ci').value, extension),
        categoria_licencia: document.getElementById('f-licencia').value || 'B',
        firebase_uid: document.getElementById('f-firebase-uid').value || null,
        id_vehiculo: parseInt(document.getElementById('f-vehiculo').value) || null,
    };
    if (editingId) {
        body.estado = document.getElementById('f-estado').value || 'activo';
    }
    if (!body.id_usuario || !body.ci) return Swal.fire('Validación', 'Usuario y CI son obligatorios', 'warning');
    try {
        if (editingId) { await apiFetch(`/repartidores/${editingId}`, { method: 'PUT', body }); Swal.fire('Actualizado', 'Repartidor actualizado', 'success'); }
        else { await apiFetch('/repartidores', { method: 'POST', body }); Swal.fire('Creado', 'Repartidor creado', 'success'); }
        closeModal(); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores');
    } catch (e) {
        const errors = (e && e.data && e.data.errors) || {};
        let msg = e.message || 'Error al guardar';
        if (errors.firebase_uid) msg = 'Ese usuario de Firebase ya está vinculado a otro repartidor.';
        else if (errors.ci) msg = 'Ese CI ya está registrado en otro repartidor.';
        else if (errors.id_usuario) msg = 'Ese usuario ya tiene un repartidor asignado.';
        Swal.fire('Error', msg, 'error');
    }
}

async function del(id) {
    const r = await Swal.fire({ title: '¿Eliminar repartidor?', text: 'Esta acción no se puede deshacer.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    try { await apiFetch(`/repartidores/${id}`, { method: 'DELETE' }); Swal.fire('Eliminado', 'Repartidor eliminado', 'success'); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al eliminar', 'error'); }
}

let estadoRepId = null;
function openEstadoModal(id, name) { estadoRepId = id; document.getElementById('estado-ref').textContent = name; document.getElementById('s-estado').value = ''; document.getElementById('estado-modal').classList.add('active'); }
function closeEstadoModal() { document.getElementById('estado-modal').classList.remove('active'); estadoRepId = null; }
async function changeEstado() {
    const estado = document.getElementById('s-estado').value;
    if (!estado) return Swal.fire('Validación', 'Seleccione un estado', 'warning');
    try { await apiFetch(`/repartidores/${estadoRepId}/cambiar-estado`, { method: 'POST', body: { estado } }); Swal.fire('Actualizado', 'Estado cambiado', 'success'); closeEstadoModal(); if (repartidoresTable) await reloadDataTable(repartidoresTable, '/repartidores'); }
    catch (e) { Swal.fire('Error', e.message || 'Error al cambiar estado', 'error'); }
}
