let currentTab = 'planificador';

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuth()) return;
    if (!hasPermission('Logística', 'acceder')) { window.location.href = '../dashboard.html'; return; }
    renderTab('planificador');
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.logistica-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    renderTab(tab);
}

function renderTab(tab) {
    const container = document.getElementById('logistica-content');
    if (tab === 'planificador') {
        renderPlanificador(container);
    } else if (tab === 'tracking') {
        renderTracking(container);
    } else if (tab === 'admin') {
        renderAdmin(container);
    }
}

function renderPlanificador(container) {
    container.innerHTML = `
        <div class="planificador-layout">
            <div class="planificador-col">
                <div class="planificador-col-header">
                    <span><i class="fas fa-box"></i> Pedidos</span>
                    <span class="count" id="pendientes-count">0</span>
                </div>
                <div class="planificador-col-body" id="pedidos-list"></div>
            </div>
            <div class="planificador-col">
                <div class="planificador-col-header">
                    <span><i class="fas fa-clipboard-list"></i> Bandeja</span>
                    <span class="count" id="bandeja-count">0</span>
                </div>
                <div class="planificador-col-body bandeja-dropzone" id="bandeja-list">
                    <div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">
                        <i class="fas fa-arrow-left" style="font-size:24px;display:block;margin-bottom:8px;"></i>
                        Arrastre pedidos aquí para planificar
                    </div>
                </div>
            </div>
            <div class="planificador-mapa">
                <div id="planificador-map"></div>
            </div>
            <div class="planificador-col">
                <div class="planificador-col-header">
                    <span><i class="fas fa-truck"></i> Repartidores</span>
                </div>
                <div class="planificador-col-body" id="repartidores-list"></div>
            </div>
        </div>
    `;
    if (typeof initPlanificador === 'function') {
        setTimeout(initPlanificador, 100);
    }
}

function renderTracking(container) {
    container.innerHTML = `
        <div class="tracking-grid">
            <div class="tracking-list">
                <div class="tracking-list-header">
                    <i class="fas fa-map-marked-alt"></i> Rutas en curso
                    <span class="count" id="tracking-count" style="float:right;">0</span>
                </div>
                <div id="tracking-list-body"></div>
            </div>
            <div class="tracking-mapa">
                <div id="tracking-map"></div>
            </div>
        </div>
    `;
    if (typeof initTracking === 'function') {
        setTimeout(initTracking, 100);
    }
}

function renderAdmin(container) {
    container.innerHTML = `
        <div class="admin-grid">
            <div class="admin-card" onclick="window.location.href='repartidores.html'">
                <i class="fas fa-truck"></i>
                <h4>Repartidores</h4>
                <p>Gestión de personal de reparto</p>
            </div>
            <div class="admin-card" onclick="window.location.href='vehiculos.html'">
                <i class="fas fa-car"></i>
                <h4>Vehículos</h4>
                <p>Flota de vehículos</p>
            </div>
            <div class="admin-card" onclick="window.location.href='rutas.html'">
                <i class="fas fa-route"></i>
                <h4>Rutas</h4>
                <p>Rutas predefinidas</p>
            </div>
            <div class="admin-card" onclick="window.location.href='despachos.html'">
                <i class="fas fa-clipboard-check"></i>
                <h4>Despachos</h4>
                <p>Control de despachos</p>
            </div>
            <div class="admin-card" onclick="window.location.href='controles-ruta.html'">
                <i class="fas fa-map-marked-alt"></i>
                <h4>Control de Rutas</h4>
                <p>Historial de rutas ejecutadas</p>
            </div>
            <div class="admin-card" onclick="window.location.href='reportes.html'">
                <i class="fas fa-chart-bar"></i>
                <h4>Reportes</h4>
                <p>Estadísticas y reportes</p>
            </div>
        </div>
    `;
}
