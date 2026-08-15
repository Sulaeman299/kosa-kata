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

    // --- LOGIKA KAMUS KOSAKATA ---
    const modal = document.getElementById('dictionaryModal');
    const btnOpen = document.getElementById('btnOpenDictionary');
    const btnClose = document.getElementById('btnCloseDictionary');
    const dictList = document.getElementById('dictionaryList');

    // Variabel Modal Tambah Manual
    const addWordModal = document.getElementById('addWordModal');
    const btnOpenAddWord = document.getElementById('btnOpenAddWord');
    const btnCloseAddWord = document.getElementById('btnCloseAddWord');
    const btnSaveWord = document.getElementById('btnSaveWord');
    const formFeedback = document.getElementById('formFeedback');

    // Variabel Modal Import JSON
    const importJsonModal = document.getElementById('importJsonModal');
    const btnOpenImport = document.getElementById('btnOpenImport');
    const btnCloseImport = document.getElementById('btnCloseImport');
    const btnCopyPrompt = document.getElementById('btnCopyPrompt');
    const btnProcessImport = document.getElementById('btnProcessImport');
    const inputJsonData = document.getElementById('inputJsonData');

    const DB_PATH = 'custom_app/kosakata';

    // Fungsi memuat data kamus
    async function loadDictionary() {
        dictList.innerHTML = '<p style="text-align: center;">Memuat data...</p>';
        let hiddenIds = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];

        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, DB_PATH));
            let fullData = [];

            if (snapshot.exists()) {
                const dataObj = snapshot.val();
                for (const key in dataObj) {
                    fullData.push({
                        id: key,
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

            // Urutkan data terbaru di atas
            fullData.reverse();

            fullData.forEach(item => {
                const isHidden = hiddenIds.includes(item.id);
                const div = document.createElement('div');
                div.className = `dict-item ${isHidden ? 'hidden-item' : ''}`;
                
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

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetBtn = e.target.closest('.btn-delete');
                    const id = targetBtn.getAttribute('data-id');
                    
                    if(confirm("Yakin ingin menghapus kosakata ini secara permanen?")) {
                        try {
                            await remove(ref(db, `${DB_PATH}/${id}`));
                            let currentHidden = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];
                            currentHidden = currentHidden.filter(hId => hId !== id);
                            localStorage.setItem('renshuu_hidden_ids', JSON.stringify(currentHidden));
                            
                            loadDictionary();
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

    btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; loadDictionary(); });
    btnClose.addEventListener('click', () => { modal.style.display = 'none'; });

    // --- TAMBAH KOSAKATA MANUAL ---
    btnOpenAddWord.addEventListener('click', () => {
        addWordModal.style.display = 'flex';
        document.getElementById('inputKanji').value = '';
        document.getElementById('inputHiragana').value = '';
        document.getElementById('inputArti').value = '';
        formFeedback.style.display = 'none';
    });
    btnCloseAddWord.addEventListener('click', () => { addWordModal.style.display = 'none'; });

    btnSaveWord.addEventListener('click', async () => {
        const valKanji = document.getElementById('inputKanji').value.trim();
        const valHiragana = document.getElementById('inputHiragana').value.trim();
        const valArti = document.getElementById('inputArti').value.trim();

        if (!valHiragana || !valArti) { formFeedback.style.display = 'block'; return; }
        formFeedback.style.display = 'none';

        btnSaveWord.disabled = true;
        btnSaveWord.innerText = 'Menyimpan...';

        try {
            const newDataRef = push(ref(db, DB_PATH));
            await set(newDataRef, { kanji: valKanji !== "" ? valKanji : "-", hiragana: valHiragana, arti: valArti });
            addWordModal.style.display = 'none';
            loadDictionary();
        } catch (err) {
            alert("Gagal menyimpan kosakata.");
        } finally {
            btnSaveWord.disabled = false;
            btnSaveWord.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Kosakata';
        }
    });

    // --- IMPORT JSON MASSAL (FITUR BARU) ---
    btnOpenImport.addEventListener('click', () => {
        importJsonModal.style.display = 'flex';
        inputJsonData.value = ''; // Kosongkan text-area
    });
    btnCloseImport.addEventListener('click', () => { importJsonModal.style.display = 'none'; });

    // Tombol Copy Prompt
    btnCopyPrompt.addEventListener('click', () => {
        // Prompt khusus ini didesain agar hasil Gemini berbentuk JSON murni yang tidak rawan error
        const promptText = `Buatkan saya 20 kosakata bahasa Jepang tingkat dasar (JLPT N5). Output HARUS dalam format JSON array murni, tanpa blok kode markdown (\`\`\`), tanpa teks pendahuluan, dan tanpa penjelasan apapun di akhir. Format wajib untuk setiap objek: {"kanji": "...", "hiragana": "...", "arti": "..."}. Jika suatu kata tidak memiliki kanji, isi value key "kanji" dengan string "-".`;
        
        navigator.clipboard.writeText(promptText).then(() => {
            const originalText = btnCopyPrompt.innerHTML;
            btnCopyPrompt.innerHTML = "✅ Prompt Berhasil Disalin!";
            setTimeout(() => {
                btnCopyPrompt.innerHTML = originalText;
            }, 2500);
        });
    });

    // Tombol Eksekusi Import
    btnProcessImport.addEventListener('click', async () => {
        const rawJson = inputJsonData.value.trim();
        if (!rawJson) return;

        btnProcessImport.disabled = true;
        btnProcessImport.innerText = "⏳ Sedang Mengimport...";

        try {
            // Coba parsing input dari user ke dalam bentuk JSON
            const dataArray = JSON.parse(rawJson);
            
            // Validasi apakah bentuknya benar-benar array
            if (!Array.isArray(dataArray)) {
                throw new Error("Format JSON harus diawali dengan [ dan diakhiri dengan ] (Array of Objects).");
            }

            // Jalankan push berulang (looping) ke Firebase secara asinkron
            const promises = dataArray.map(item => {
                const newDataRef = push(ref(db, DB_PATH));
                return set(newDataRef, {
                    kanji: item.kanji || "-",
                    hiragana: item.hiragana || "-",
                    arti: item.arti || "-"
                });
            });

            // Tunggu semua proses upload selesai
            await Promise.all(promises);
            
            alert(`✅ Sukses! ${dataArray.length} kosakata berhasil diunggah ke database.`);
            importJsonModal.style.display = 'none';
            loadDictionary(); // Refresh list

        } catch (err) {
            console.error(err);
            alert("❌ Gagal Mengimport!\n\nPastikan Anda hanya menempelkan teks JSON murni (tidak ada kata-kata lain). \nError: " + err.message);
        } finally {
            btnProcessImport.disabled = false;
            btnProcessImport.innerHTML = "🚀 Import Sekarang";
        }
    });

});
