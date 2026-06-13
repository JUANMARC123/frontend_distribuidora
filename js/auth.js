function autoEmailRegistro() {
    const nombre   = (document.getElementById('reg-nombre')?.value || '').trim().split(' ')[0].toLowerCase();
    const apellido = (document.getElementById('reg-apellido')?.value || '').trim().split(' ')[0].toLowerCase();
    const emailField = document.getElementById('email');
    if (!emailField || emailField.dataset.manual) return;
    const limpiar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    if (nombre || apellido) {
        emailField.value = limpiar(nombre) + '.' + limpiar(apellido) + '@distribuidora.com';
    }
}

function extractToken(data) {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.token === 'string' && data.token.length > 10) return data.token;
    if (typeof data.access_token === 'string' && data.access_token.length > 10) return data.access_token;
    if (data.data && typeof data.data.token === 'string' && data.data.token.length > 10) return data.data.token;
    if (data.data && typeof data.data.access_token === 'string' && data.data.access_token.length > 10) return data.data.access_token;
    if (typeof data.plainTextToken === 'string' && data.plainTextToken.length > 10) return data.plainTextToken;
    return null;
}

async function login(email, password) {
    console.log('[Auth] Intentando login:', email);

    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
    });

    console.log('[Auth] Login response COMPLETA:', JSON.stringify(data, null, 2));

    const token = extractToken(data);
    console.log('[Auth] Token extraído:', token ? token.substring(0, 30) + '...' : 'NULL');

    if (!token) {
        console.error('[Auth] NO SE ENCONTRÓ TOKEN en la respuesta. Campos disponibles:',
            Object.keys(data).join(', '),
            data.data ? 'con data: ' + Object.keys(data.data).join(', ') : ''
        );
        throw {
            status: 422,
            message: 'El servidor no devolvió un token válido. Revisa la consola (F12) para ver la respuesta completa.',
            data
        };
    }

    localStorage.setItem('token', token);
    console.log('[Auth] Token guardado en localStorage. Longitud:', token.length);

    const userData = data.user || data.data?.user || null;
    if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        console.log('[Auth] Usuario guardado desde data.user');
    } else {
        const user = { email };
        if (data.nombre) user.nombre = data.nombre;
        if (data.apellido) user.apellido = data.apellido;
        if (data.name) user.name = data.name;
        if (data.id) user.id_usuario = data.id;
        if (data.id_usuario) user.id_usuario = data.id_usuario;
        localStorage.setItem('user', JSON.stringify(user));
        console.log('[Auth] Usuario construido desde raíz:', user);
    }

    const permisos = data.permisos || data.data?.permisos || [];
    if (permisos.length) {
        localStorage.setItem('permisos', JSON.stringify(permisos));
        userPermissions = permisos;
        console.log('[Auth] Permisos guardados:', permisos.length);
    }

    return data;
}

async function register(nombre, apellido, email, password, passwordConfirmation, telefono) {
    const body = { nombre, apellido, email, password, password_confirmation: passwordConfirmation || password };
    if (telefono) body.telefono = telefono;

    console.log('[Auth] Registrando usuario:', { nombre, apellido, email, telefono });

    const data = await apiFetch('/auth/register', {
        method: 'POST',
        body,
    });

    console.log('[Auth] Register response COMPLETA:', JSON.stringify(data, null, 2));

    const token = extractToken(data);
    console.log('[Auth] Token extraído:', token ? token.substring(0, 30) + '...' : 'NULL');

    if (token) {
        localStorage.setItem('token', token);
        console.log('[Auth] Token guardado en localStorage. Longitud:', token.length);

        const userData = data.user || data.data?.user || { nombre, apellido, email, telefono };
        localStorage.setItem('user', JSON.stringify(userData));
    } else {
        console.log('[Auth] Registro completado pero sin token (posiblemente requiere activación/admin)');
    }

    return data;
}

async function logout() {
    console.log('[Auth] Cerrando sesión');
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
        console.error('[Auth] Logout error:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const isValid = token && token !== 'undefined' && token !== 'null' && token.length > 10;
    console.log('[Auth] checkAuth - token:', isValid ? 'válido' : 'inválido/ausente');

    if (!isValid) {
        if (token) {
            console.warn('[Auth] Token inválido en localStorage, limpiando:', token);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

async function loadUser() {
    try {
        const data = await apiFetch('/auth/user');
        const userData = data.user || data.data || data;
        if (typeof userData === 'object' && userData !== null) {
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('[Auth] Usuario actualizado desde API');
        }
        const permisos = data.permisos || data.data?.permisos || [];
        if (permisos.length) {
            localStorage.setItem('permisos', JSON.stringify(permisos));
            userPermissions = permisos;
        }
        return userData;
    } catch (e) {
        console.error('[Auth] loadUser error:', e);
        return null;
    }
}

function getUser() {
    try {
        const stored = localStorage.getItem('user');
        if (!stored || stored === 'undefined' || stored === 'null') return null;
        return JSON.parse(stored);
    } catch (e) {
        console.warn('[Auth] Error parsing stored user, clearing:', e.message);
        localStorage.removeItem('user');
        return null;
    }
}

function getUserInitials() {
    const user = getUser();
    if (!user) return '?';
    const first = (user.nombre || user.name || '')[0] || '';
    const last = (user.apellido || '')[0] || '';
    return (first + last).toUpperCase() || '?';
}
