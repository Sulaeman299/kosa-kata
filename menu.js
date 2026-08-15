import { db } from './firebase-config.js';
import { ref, get, child, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    let userName = localStorage.getItem('renshuu_username') || "Pejuang Kanji";
    let userPoints = localStorage.getItem('renshuu_points') || 0;

    document.getElementById('userName').innerText = userName;
    document.getElementById('userInitial').innerText = userName.charAt(0).toUpperCase();
    document.getElementById('userPoints').innerText = userPoints;

    const diamondButtons = document.querySelectorAll('.diamond-btn');
    diamondButtons.forEach((btn, index) => {
        btn.style.opacity = '0';
        btn.style.transform = 'rotate(45deg) scale(0.5)';
        setTimeout(() => {
            btn.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            btn.style.opacity = '1';
            btn.style.transform = 'rotate(45deg) scale(1)';
        }, 150 * (index + 1));
    });

    const userNameElement = document.getElementById('userName');
    userNameElement.addEventListener('click', () => {
        const newName = prompt("Masukkan namamu:", userName);
        if (newName && newName.trim() !== "") {
            localStorage.setItem('renshuu_username', newName.trim());
            window.location.reload();
        }
    });

    // --- TOGGLE GAYA LATIHAN: Pilihan Ganda / Kartu Balik ---
    let selectedStyle = 'mcq';
    const styleGlider = document.getElementById('styleGlider');
    const styleButtons = document.querySelectorAll('.style-toggle button');
    styleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedStyle = btn.getAttribute('data-style');
            styleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            styleGlider.classList.toggle('pos-flip', selectedStyle === 'flip');
        });
    });

    // --- NAVIGASI KE MODE KUIS ---
    document.querySelectorAll('.diamond-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            window.location.href = `quiz.html?mode=${mode}&style=${selectedStyle}`;
        });
    });

    // --- LOGIKA KAMUS KOSAKATA (DIPERBARUI) ---
    const modal = document.getElementById('dictionaryModal');
    const btnOpen = document.getElementById('btnOpenDictionary');
    const btnClose = document.getElementById('btnCloseDictionary');
    const dictList = document.getElementById('dictionaryList');

    // Variabel untuk Modal Tambah Kosakata
    const addWordModal = document.getElementById('addWordModal');
    const btnOpenAddWord = document.getElementById('btnOpenAddWord');
    const btnCloseAddWord = document.getElementById('btnCloseAddWord');
    const btnSaveWord = document.getElementById('btnSaveWord');
    const formFeedback = document.getElementById('formFeedback');

    // JALUR DATABASE BARU
    const DB_PATH = 'custom_app/kosakata';

    // Fungsi memuat data kamus (dipisahkan agar bisa dipanggil ulang)
    async function loadDictionary() {
        dictList.innerHTML = '<p style="text-align: center;">Memuat data...</p>';
        let hiddenIds = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];

        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, DB_PATH));
            let fullData = [];

            if (snapshot.exists()) {
                const dataObj = snapshot.val();
                // Mengubah format Firebase (key-value object) menjadi array
                for (const key in dataObj) {
                    fullData.push({
                        id: key, // Memakai key bawaan Firebase (huruf & angka acak) sebagai ID
                        kanji: dataObj[key].kanji || '-',
                        hiragana: dataObj[key].hiragana,
                        arti: dataObj[key].arti
                    });
                }
            }

            dictList.innerHTML = '';

            if (fullData.length === 0) {
                dictList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Kamus masih kosong. Tambahkan kosakata pertamamu!</p>';
                return;
            }

            fullData.forEach(item => {
                const isHidden = hiddenIds.includes(item.id);
                const div = document.createElement('div');
                div.className = `dict-item ${isHidden ? 'hidden-item' : ''}`;
                
                // Jika input Kanji kosong, tampilkan Hiragana dengan ukuran besar
                const displayKanji = item.kanji !== '-' ? item.kanji : item.hiragana;
                const displayHira = item.kanji !== '-' ? item.hiragana : '';

                div.innerHTML = `
                    <div class="dict-info">
                        <span class="dict-kanji">${displayKanji}</span>
                        <div class="dict-details">
                            <span class="dict-hira">${displayHira}</span>
                            <span class="dict-arti">${item.arti}</span>
                        </div>
                    </div>
                    <div class="dict-actions">
                        <button class="toggle-hide-btn ${isHidden ? 'active' : ''}" data-id="${item.id}">
                            ${isHidden ? 'Dikuasai ✅' : 'Hafal?'}
                        </button>
                        <button class="btn-delete" data-id="${item.id}" title="Hapus Kosakata">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                    </div>
                `;
                dictList.appendChild(div);
            });

            // Event listener tombol "Hafal?"
            document.querySelectorAll('.toggle-hide-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    let currentHidden = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];

                    if (currentHidden.includes(id)) {
                        currentHidden = currentHidden.filter(hId => hId !== id);
                        e.target.innerText = 'Hafal?';
                        e.target.classList.remove('active');
                        e.target.closest('.dict-item').classList.remove('hidden-item');
                    } else {
                        currentHidden.push(id);
                        e.target.innerText = 'Dikuasai ✅';
                        e.target.classList.add('active');
                        e.target.closest('.dict-item').classList.add('hidden-item');
                    }
                    localStorage.setItem('renshuu_hidden_ids', JSON.stringify(currentHidden));
                });
            });

            // Event listener tombol "Hapus" (FITUR BARU)
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetBtn = e.target.closest('.btn-delete');
                    const id = targetBtn.getAttribute('data-id');
                    
                    if(confirm("Yakin ingin menghapus kosakata ini secara permanen?")) {
                        try {
                            await remove(ref(db, `${DB_PATH}/${id}`));
                            // Hapus ID dari localStorage juga agar data tidak menjadi 'hantu'
                            let currentHidden = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];
                            currentHidden = currentHidden.filter(hId => hId !== id);
                            localStorage.setItem('renshuu_hidden_ids', JSON.stringify(currentHidden));
                            
                            loadDictionary(); // Refresh daftar otomatis
                        } catch(err) {
                            alert("Gagal menghapus data.");
                        }
                    }
                });
            });

        } catch (error) {
            dictList.innerHTML = "<p style='color:#ff3860;'>Gagal memuat data.</p>";
            console.error(error);
        }
    }

    btnOpen.addEventListener('click', () => {
        modal.style.display = 'flex';
        loadDictionary();
    });

    btnClose.addEventListener('click', () => { modal.style.display = 'none'; });

    // --- LOGIKA TAMBAH KOSAKATA BARU (FITUR BARU) ---
    btnOpenAddWord.addEventListener('click', () => {
        addWordModal.style.display = 'flex';
        document.getElementById('inputKanji').value = '';
        document.getElementById('inputHiragana').value = '';
        document.getElementById('inputArti').value = '';
        formFeedback.style.display = 'none';
    });

    btnCloseAddWord.addEventListener('click', () => {
        addWordModal.style.display = 'none';
    });

    btnSaveWord.addEventListener('click', async () => {
        const valKanji = document.getElementById('inputKanji').value.trim();
        const valHiragana = document.getElementById('inputHiragana').value.trim();
        const valArti = document.getElementById('inputArti').value.trim();

        // Validasi
        if (!valHiragana || !valArti) {
            formFeedback.style.display = 'block';
            return;
        }
        formFeedback.style.display = 'none';

        // Mencegah double-click
        btnSaveWord.disabled = true;
        btnSaveWord.innerText = 'Menyimpan...';

        try {
            // Push ke Firebase (Firebase otomatis membuat ID Unik acak)
            const newDataRef = push(ref(db, DB_PATH));
            await set(newDataRef, {
                kanji: valKanji !== "" ? valKanji : "-", // Jika kosong, diisi "-"
                hiragana: valHiragana,
                arti: valArti
            });

            addWordModal.style.display = 'none'; // Tutup form
            loadDictionary(); // Refresh daftar kamus
        } catch (err) {
            console.error(err);
            alert("Gagal menyimpan kosakata ke database.");
        } finally {
            btnSaveWord.disabled = false;
            // Kembalikan tombol ke teks & ikon semula
            btnSaveWord.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Kosakata';
        }
    });
});
