/**
 * Shared Map Configuration Module
 * 
 * Centralizes Mapbox and Firebase configuration to prevent duplicate declarations
 * when multiple modules (tracking.js, planificador.js) are loaded on the same page.
 * 
 * Load order: config.js -> map-config.js -> tracking.js, planificador.js
 * 
 * Values are injected globally via HTML <script> tags before loading this module.
 * 
 * For Hostinger production: set window.MAPBOX_TOKEN and window.FIREBASE_CONFIG
 * in the <script> block of each HTML page (logistica.html, pedidos.html, etc.).
 * 
 * Variables disponibles globalmente:
 *   - window.GPS_MAPBOX_TOKEN: Token de acceso de Mapbox (desde window.MAPBOX_TOKEN)
 *   - window.GPS_FIREBASE_CONFIG: Configuración de Firebase (desde window.FIREBASE_CONFIG)
 */

// Mapbox GL JS Access Token
// Leído de window.MAPBOX_TOKEN, setido en el HTML de cada página
window.GPS_MAPBOX_TOKEN = window.MAPBOX_TOKEN || '';

// Firebase Configuration
// Leído de window.FIREBASE_CONFIG, setido en el HTML de cada página
window.GPS_FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyDLpt_G8VOvmePuAYEQyffhU1Qb9braKSw",
    authDomain: "mapboxfirebase-a79b5.firebaseapp.com",
    databaseURL: "https://mapboxfirebase-a79b5-default-rtdb.firebaseio.com",
    projectId: "mapboxfirebase-a79b5",
    storageBucket: "mapboxfirebase-a79b5.firebasestorage.app",
    messagingSenderId: "133519102970",
    appId: "1:133519102970:web:1bf07af71eda04b772ca43",
    measurementId: "G-SMVVH5FL53"
};

// Validation helpers
window.isMapConfigValid = function() {
    return !!window.GPS_MAPBOX_TOKEN && typeof window.GPS_MAPBOX_TOKEN === 'string' && window.GPS_MAPBOX_TOKEN.length > 10;
};

window.isFirebaseConfigValid = function() {
    return !!window.GPS_FIREBASE_CONFIG && typeof window.GPS_FIREBASE_CONFIG === 'object' && !!window.GPS_FIREBASE_CONFIG.apiKey;
};

// Console warnings for debugging
if (!window.isMapConfigValid()) {
    console.warn('[map-config] Mapbox token not configured. Maps will not work. Set MAPBOX_TOKEN in the <script> block of your HTML page.');
}

if (!window.isFirebaseConfigValid()) {
    console.warn('[map-config] Firebase config incomplete. Real-time tracking may not work.');
}

console.log('[map-config] Loaded - Mapbox:', window.isMapConfigValid() ? 'OK' : 'MISSING', '| Firebase:', window.isFirebaseConfigValid() ? 'OK' : 'MISSING');