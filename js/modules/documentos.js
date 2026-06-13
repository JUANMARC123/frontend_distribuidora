document.addEventListener('DOMContentLoaded', function () {
    if (!checkAuth()) return;
    loadPermissionsFromStorage();
    if (!hasPermission('Documentos', 'acceder')) {
        document.getElementById('documentos-container').innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> No tienes permiso para acceder a este módulo.</div>';
        return;
    }
    renderDocumentos();
});

function renderDocumentos() {
    const container = document.getElementById('documentos-container');
    if (!container) return;

    if (!DOCUMENTOS || DOCUMENTOS.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-pdf"></i>
                <h4>No hay documentos disponibles</h4>
                <p class="text-muted">Próximamente se agregarán manuales y guías del sistema.</p>
            </div>
        `;
        return;
    }

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:20px;">';

    DOCUMENTOS.forEach(doc => {
        html += `
            <div class="card" style="border:1px solid var(--border);box-shadow:var(--shadow);">
                <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:flex;align-items:flex-start;gap:16px;">
                        <div style="width:56px;height:56px;border-radius:12px;background:#fef2f2;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fas ${doc.icono}" style="font-size:24px;color:#ef4444;"></i>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">${doc.titulo}</h3>
                            <p style="font-size:13px;color:var(--text-muted);line-height:1.5;">${doc.descripcion}</p>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;padding-top:12px;border-top:1px solid var(--border);">
                        <button class="btn btn-primary btn-sm" onclick="verDocumento('${doc.archivo}')">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="btn btn-success btn-sm" onclick="descargarDocumento('${doc.archivo}', '${doc.titulo}.pdf')">
                            <i class="fas fa-download"></i> Descargar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
