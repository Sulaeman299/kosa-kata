// firebase-config.js
// Import SDK Firebase v9+ Moduler dari CDN (tanpa perlu install npm lokal)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Konfigurasi Firebase milik kamu
const firebaseConfig = {
    apiKey: "AIzaSyBbToxe8-_fsyhtYPHG1bBCi_dGNzEYM20",
    authDomain: "database-touban.firebaseapp.com",
    databaseURL: "https://database-touban-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "database-touban",
    storageBucket: "database-touban.firebasestorage.app",
    messagingSenderId: "563555749198",
    appId: "1:563555749198:web:c18c08217159ceec2f621f",
    measurementId: "G-LJQTPGE5VE"
};

// Inisialisasi Firebase & Realtime Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export agar bisa digunakan di file JS lainnya (seperti quiz.js)
export { app, db };
