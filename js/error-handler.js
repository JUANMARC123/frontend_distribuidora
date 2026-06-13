(function () {
    'use strict';

    function logError(source, error) {
        console.log('%c[ERROR CATCHER]', 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;', source, error);

        if (error instanceof Error) {
            console.error('  → Stack:', error.stack);
        } else if (typeof error === 'object') {
            try { console.error('  → Full:', JSON.stringify(error, null, 2)); } catch (e) { console.error('  → Full:', error); }
        }
    }

    window.onerror = function (message, source, lineno, colno, error) {
        logError('window.onerror', {
            message,
            source,
            line: lineno,
            column: colno,
            error: error || '(sin objeto error)'
        });
        return false;
    };

    window.addEventListener('unhandledrejection', function (event) {
        const reason = event.reason;
        const status = reason?.status || reason?.data?.status || 0;

        logError('unhandledrejection (Promise)', {
            message: reason?.message || reason?.toString?.() || 'Unknown promise rejection',
            status: status,
            data: reason?.data,
            stack: reason?.stack,
        });

        if (status === 401) {
            console.warn('[AUTH] Error 401 - token inválido/expirado detectado por error-handler');
        }

        if (status === 0 && reason?.message?.includes('conectar')) {
            console.warn('[NETWORK] Error de conexión detectado - servidor no disponible');
        }

        if (document.getElementById('error-message')) {
            const el = document.getElementById('error-message');
            const txt = document.getElementById('error-text');
            const msg = reason?.data?.message || reason?.message || 'Error inesperado en la aplicación';

            if (status === 401) {
                txt.innerHTML = 'Sesión expirada o inválida. <a href="/index.html" style="color:#fff;font-weight:bold;">Ir al login</a>';
            } else if (reason?.data?.errors) {
                const errs = Object.values(reason.data.errors).flat();
                txt.innerHTML = msg + '<br><small>' + errs.join('<br>') + '</small>';
            } else {
                txt.textContent = msg;
            }
            el.classList.add('show');
        }

        event.preventDefault();
    });

    console.log('[ERROR CATCHER] Global error handler installed');
})();
