let catalogoTable, editingId = null, currentCatalogo = null;

const CATALOGOS = {
  'estados-usuario':    { label: 'Estados de Usuario',    field: 'nombre_estado',  formLabel: 'Nombre del Estado',  type: 'string',  idField: 'id_estado_usuario',   maxLength: 50 },
  'roles':              { label: 'Roles',                 field: 'nombre',          formLabel: 'Nombre del Rol',     type: 'string',  idField: 'id_rol',              maxLength: 50 },
  'modulos':            { label: 'Módulos',               field: 'nombre',          formLabel: 'Nombre del Módulo',  type: 'string',  idField: 'id_modulo',           maxLength: 50 },
  'acciones':           { label: 'Acciones',              field: 'nombre',          formLabel: 'Nombre de Acción',   type: 'string',  idField: 'id_accion',           maxLength: 50 },
  'tablas-sistema':     { label: 'Tablas del Sistema',    field: 'nombre',          formLabel: 'Nombre de Tabla',    type: 'string',  idField: 'id_tabla',            maxLength: 100 },
  'estados-pedido':     { label: 'Estados de Pedido',     field: 'nombre_estado',   formLabel: 'Nombre del Estado',  type: 'string',  idField: 'id_estado_pedido',     maxLength: 50 },
  'estados-repartidor': { label: 'Estados de Repartidor', field: 'nombre_estado',   formLabel: 'Nombre del Estado',  type: 'string',  idField: 'id_estado_repartidor', maxLength: 50 },
  'estados-vehiculo':   { label: 'Estados de Vehículo',   field: 'nombre_estado',   formLabel: 'Nombre del Estado',  type: 'string',  idField: 'id_estado_vehiculo',   maxLength: 50 },
  'estados-despacho':   { label: 'Estados de Despacho',   field: 'nombre_estado',   formLabel: 'Nombre del Estado',  type: 'string',  idField: 'id_estado_despacho',   maxLength: 50 },
  'extensiones-ci':     { label: 'Extensiones CI',        field: 'nombre_extension',formLabel: 'Extensión',          type: 'string',  idField: 'id_extension_ci',      maxLength: 10 },
  'licencias':          { label: 'Licencias',             field: 'categoria',       formLabel: 'Categoría',          type: 'string',  idField: 'id_licencia',          maxLength: 20 },
  'marcas':             { label: 'Marcas',                field: 'nombre_marca',    formLabel: 'Nombre de Marca',    type: 'string',  idField: 'id_marca',             maxLength: 50 },
  'modelos':            { label: 'Modelos',               field: 'nombre_modelo',   formLabel: 'Nombre del Modelo',  type: 'modelo',  idField: 'id_modelo',           maxLength: 100 },
  'capacidades':        { label: 'Capacidades',           field: 'capacidad_kg',    formLabel: 'Capacidad (kg)',     type: 'numeric', idField: 'id_capacidad' },
  'tipos-incidencia':   { label: 'Tipos de Incidencia',   field: 'nombre_tipo',     formLabel: 'Nombre del Tipo',    type: 'string',  idField: 'id_tipo_incidencia',   maxLength: 100 },
  'tipos-evidencia':    { label: 'Tipos de Evidencia',    field: 'nombre_tipo',     formLabel: 'Nombre del Tipo',    type: 'string',  idField: 'id_tipo_evidencia',    maxLength: 100 },
  'cargos':             { label: 'Cargos',                field: 'nombre_cargo',    formLabel: 'Nombre del Cargo',   type: 'string',  idField: 'id_cargo',             maxLength: 100 },
};

const CATEGORIAS = {
  'Sistema':    ['estados-usuario', 'roles', 'modulos', 'acciones', 'tablas-sistema'],
  'Pedidos':    ['estados-pedido'],
  'Logística':  ['estados-repartidor', 'estados-vehiculo', 'estados-despacho'],
  'Vehículos':  ['marcas', 'modelos', 'capacidades'],
  'Incidencias': ['tipos-incidencia', 'tipos-evidencia'],
  'Personal':   ['extensiones-ci', 'licencias', 'cargos'],
};

document.addEventListener('DOMContentLoaded', async function () {
  if (!checkAuth()) return;
  if (!hasPermission('Usuarios', 'acceder')) {
    window.location.href = '../dashboard.html';
    return;
  }
  renderPage();
  const selector = document.getElementById('catalogo-selector');
  if (selector && selector.options.length > 0) {
    currentCatalogo = selector.value;
    await loadCatalogo(currentCatalogo);
  }
});

function renderPage() {
  let selectorOptions = '';
  Object.entries(CATEGORIAS).forEach(([group, keys]) => {
    selectorOptions += `<optgroup label="${group}">`;
    keys.forEach(key => {
      const c = CATALOGOS[key];
      if (c) selectorOptions += `<option value="${key}">${c.label}</option>`;
    });
    selectorOptions += `</optgroup>`;
  });

  document.getElementById('page-content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-list"></i> Catálogos del Sistema</h3>
        <div class="catalogo-selector-wrapper">
          <i class="fas fa-search"></i>
          <select id="catalogo-selector" class="form-control" onchange="switchCatalogo()">
            <option value="">— Seleccione un catálogo —</option>
            ${selectorOptions}
          </select>
        </div>
      </div>
      <div class="card-body">
        <div id="catalogo-empty" class="empty-state">
          <i class="fas fa-database"></i>
          <h4>Seleccione un catálogo</h4>
          <p>Elija una tabla referencial del selector para gestionar sus registros.</p>
        </div>
        <div id="catalogo-content" style="display:none;">
          <div class="catalogo-toolbar">
            <span id="catalogo-info" class="text-muted"></span>
            <button id="btn-nuevo" class="btn btn-primary btn-sm" onclick="openCreateModal()" style="display:none;">
              <i class="fas fa-plus"></i> Nuevo
            </button>
          </div>
          <div class="table-container"><table id="main-table" class="display" style="width:100%"><thead><tr></tr></thead></table></div>
        </div>
      </div>
    </div>
    <div id="main-modal" class="modal-overlay"><div class="modal" style="max-width:450px;">
      <div class="modal-header"><h3 id="modal-title">Nuevo Registro</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <form id="main-form">
          <div id="form-fields"></div>
        </form>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="save()">Guardar</button></div>
    </div></div>
  `;
}

async function switchCatalogo() {
  const key = document.getElementById('catalogo-selector').value;
  currentCatalogo = key || null;

  document.getElementById('catalogo-empty').style.display = key ? 'none' : 'block';
  const content = document.getElementById('catalogo-content');
  content.style.display = key ? 'block' : 'none';

  if (!key) return;
  await loadCatalogo(key);
}

async function loadCatalogo(key) {
  const c = CATALOGOS[key];
  if (!c) return;

  const canWrite = hasPermission('Usuarios', 'crear');
  document.getElementById('btn-nuevo').style.display = canWrite ? 'inline-flex' : 'none';
  document.getElementById('catalogo-info').textContent = `Gestionando: ${c.label}`;

  try {
    const d = await apiFetch(`/catalogos/${key}`);
    const data = Array.isArray(d) ? d : (d.data || []);

    if ($.fn.DataTable.isDataTable('#main-table')) {
        catalogoTable.destroy();
        $('#main-table tbody').empty();
    }

    const columns = buildColumns(key, canWrite);
    catalogoTable = $('#main-table').DataTable({
      data, pageLength: 10, order: [[0, 'asc']],
      language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
      columns
    });
  } catch (e) {
    Swal.fire('Error', `Error al cargar ${c.label}`, 'error');
  }
}

function buildColumns(key, canWrite) {
  const c = CATALOGOS[key];
  const cols = [];

  if (key === 'modelos') {
    cols.push({ data: 'nombre_modelo', title: 'Modelo' });
    cols.push({
      data: null, title: 'Marca', orderable: true,
      render: r => r.marca?.nombre_marca || ''
    });
  } else if (key === 'capacidades') {
    cols.push({
      data: 'capacidad_kg', title: 'Capacidad (kg)',
      render: r => r != null ? `${r} kg` : '—'
    });
  } else {
    cols.push({ data: c.field, title: c.label });
  }

  if (canWrite) {
    cols.push({
      data: null, title: 'Acciones', orderable: false,
      render: r => {
        const idVal = r[c.idField];
        const displayVal = r[c.field] || '';
        return `<div class="actions">
          ${hasPermission('Usuarios', 'editar') ? `<button class="btn btn-sm btn-warning" onclick="edit('${key}',${idVal})"><i class="fas fa-edit"></i></button>` : ''}
          ${hasPermission('Usuarios', 'eliminar') ? `<button class="btn btn-sm btn-danger" onclick="del('${key}',${idVal},'${displayVal.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>`;
      }
    });
  }

  return cols;
}

function openCreateModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = `Nuevo ${CATALOGOS[currentCatalogo]?.label || 'Registro'}`;
  buildForm(null);
  document.getElementById('main-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('main-modal').classList.remove('active');
  editingId = null;
}

function buildForm(record) {
  const c = CATALOGOS[currentCatalogo];
  if (!c) return;
  let html = '';

  if (c.type === 'modelo') {
    html += `<div class="form-group"><label>Marca *</label><select id="f-id_marca" class="form-control" required>
      <option value="">Seleccione una marca</option>
    </select></div>`;
    html += `<div class="form-group"><label>${c.formLabel} *</label><input type="text" id="f-field" class="form-control" maxlength="${c.maxLength}" required></div>`;

    document.getElementById('form-fields').innerHTML = html;
    loadMarcasDropdown(record?.id_marca);
    if (record) document.getElementById('f-field').value = record[c.field] || '';
  } else if (c.type === 'numeric') {
    html += `<div class="form-group"><label>${c.formLabel} *</label>
      <input type="number" id="f-field" class="form-control" step="0.01" min="0" required
        ${record ? `value="${record[c.field] || ''}"` : ''}></div>`;
    document.getElementById('form-fields').innerHTML = html;
  } else {
    html += `<div class="form-group"><label>${c.formLabel} *</label>
      <input type="text" id="f-field" class="form-control" maxlength="${c.maxLength}" required
        ${record ? `value="${(record[c.field] || '').replace(/"/g, '&quot;')}"` : ''}></div>`;
    document.getElementById('form-fields').innerHTML = html;
  }
}

async function loadMarcasDropdown(selectedId) {
  try {
    const d = await apiFetch('/catalogos/marcas');
    const marcas = Array.isArray(d) ? d : (d.data || []);
    const select = document.getElementById('f-id_marca');
    if (!select) return;
    marcas.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id_marca;
      opt.textContent = m.nombre_marca;
      if (selectedId && Number(m.id_marca) === Number(selectedId)) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {
    //
  }
}

async function edit(key, id) {
  const c = CATALOGOS[key];
  if (!c) return;

  try {
    const d = await apiFetch(`/catalogos/${key}`);
    const data = Array.isArray(d) ? d : (d.data || []);
    const record = data.find(r => Number(r[c.idField]) === Number(id));
    if (!record) return Swal.fire('Error', 'Registro no encontrado', 'error');

    editingId = id;
    document.getElementById('modal-title').textContent = `Editar ${c.label}`;
    buildForm(record);
    document.getElementById('main-modal').classList.add('active');
  } catch (e) {
    Swal.fire('Error', 'No se pudo cargar el registro', 'error');
  }
}

async function save() {
  const c = CATALOGOS[currentCatalogo];
  if (!c) return;

  let body;
  if (c.type === 'modelo') {
    const idMarca = document.getElementById('f-id_marca')?.value;
    const nombreModelo = document.getElementById('f-field')?.value.trim();
    if (!idMarca) return Swal.fire('Validación', 'Debe seleccionar una marca', 'warning');
    if (!nombreModelo) return Swal.fire('Validación', 'El nombre del modelo es obligatorio', 'warning');
    body = { id_marca: parseInt(idMarca), nombre_modelo: nombreModelo };
  } else if (c.type === 'numeric') {
    const val = document.getElementById('f-field')?.value;
    if (val === '' || val === undefined) return Swal.fire('Validación', 'El valor es obligatorio', 'warning');
    if (parseFloat(val) < 0) return Swal.fire('Validación', 'El valor no puede ser negativo', 'warning');
    body = { [c.field]: val };
  } else {
    const val = document.getElementById('f-field')?.value.trim();
    if (!val) return Swal.fire('Validación', `${c.formLabel} es obligatorio`, 'warning');
    body = { [c.field]: val };
  }

  try {
    if (editingId) {
      await apiFetch(`/catalogos/${currentCatalogo}/${editingId}`, { method: 'PUT', body });
      Swal.fire('Actualizado', 'Registro actualizado correctamente', 'success');
    } else {
      await apiFetch(`/catalogos/${currentCatalogo}`, { method: 'POST', body });
      Swal.fire('Creado', 'Registro creado correctamente', 'success');
    }
    closeModal();
    if (catalogoTable) await reloadDataTable(catalogoTable, `/catalogos/${currentCatalogo}`);
  } catch (e) {
    Swal.fire('Error', e.message || 'Error al guardar', 'error');
  }
}

async function del(key, id, name) {
  const c = CATALOGOS[key];
  const r = await Swal.fire({
    title: '¿Eliminar registro?',
    text: `Se eliminará "${name || ''}".`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });
  if (!r.isConfirmed) return;
  try {
    await apiFetch(`/catalogos/${key}/${id}`, { method: 'DELETE' });
    Swal.fire('Eliminado', 'Registro eliminado correctamente', 'success');
    if (catalogoTable) await reloadDataTable(catalogoTable, `/catalogos/${key}`);
  } catch (e) {
    Swal.fire('Error', e.message || 'Error al eliminar', 'error');
  }
}
