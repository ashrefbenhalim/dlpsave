// This function clears the search box and hides the result panel
function resetPage() {
    document.getElementById('urlInput').value = '';
    document.getElementById('result').style.display = 'none';
    document.getElementById('progressContainer').style.display = 'none';
}

// Current logged in user (saved in localStorage)
let currentUser = null;

// This function loads the download history from the server
async function loadHistory() {
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    const title = document.getElementById('historyTitle');

    list.innerHTML = '';

    if (!currentUser) {
        title.textContent = 'Your Download History';
        empty.style.display = 'block';
        empty.innerHTML = 'Login to see your personal history.';
        return;
    }

    try {
        let url = '/api/history';
        if (currentUser.isAdmin) {
            url = '/api/history/all';   // admin sees everything
            title.textContent = 'All Users Download History';
        } else {
            title.textContent = 'Your Download History';
        }

        const res = await fetch(url);
        const history = await res.json();

        if (history.length === 0) {
            empty.style.display = 'block';
            empty.innerHTML = 'Nothing downloaded yet.<br>Downloads will appear here automatically.';
            return;
        }

        empty.style.display = 'none';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-outline-danger btn-sm mb-3';
        clearBtn.innerHTML = '🗑️ Clear All History';
        clearBtn.onclick = async () => {
            if (confirm('Delete ALL history permanently?')) {
                await fetch('/api/history/clear', { method: 'POST' });
                loadHistory();
            }
        };
        list.appendChild(clearBtn);

        history.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            let extra = '';
            if (currentUser.isAdmin) extra = `<small class="text-muted me-3">${item.email}</small>`;

            div.innerHTML = `
                <div style="flex: 1; cursor: pointer;" onclick="loadVideoFromHistory('${item.url}', '${item.type}', '${item.quality}', ${item.useCover})">
                    <strong>${item.title}</strong><br>
                    <small class="text-muted">${item.type} • ${item.time}</small>
                </div>
                ${extra}
                <span class="badge bg-primary me-3">${item.file.split('.').pop().toUpperCase()}</span>
                <button onclick="renameHistoryItem(${item.id}); event.stopImmediatePropagation(); return false;" 
                        class="btn btn-sm btn-outline-secondary me-1">✏️</button>
                <button onclick="deleteHistoryItem(${item.id}); event.stopImmediatePropagation(); return false;" 
                        class="btn btn-sm btn-outline-danger">−</button>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.log('History load failed');
    }
}

// This function puts a saved video back into the search box and restores its old settings
async function loadVideoFromHistory(url, type, quality, useCover) {
    document.getElementById('urlInput').value = url;
    await searchVideo();

    if (type === 'MP3') {
        document.getElementById('mp3-quality').value = quality;
        document.getElementById('useAsCover').checked = useCover;
    } 
    else {
        document.getElementById('video-quality').value = quality;
        document.getElementById('useAsCover').checked = false;
    }
}

// This function deletes one item from history
async function deleteHistoryItem(id) {
    if (!confirm('Delete this download from history?')) return;
    await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    loadHistory();
}

// This function lets you rename a history item
async function renameHistoryItem(id) {
    const newTitle = prompt('New title for this download?');
    if (!newTitle || newTitle.trim() === '') return;
    await fetch('/api/history/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newTitle: newTitle.trim() })
    });
    loadHistory();
}

// This function shows the login/signup modal
function showAuthModal() {
    if (currentUser) {
        logout();
        return;
    }
    const modal = new bootstrap.Modal(document.getElementById('authModal'));
    modal.show();
    switchTab(0); // default to login
}

// Switch between login and signup tabs
function switchTab(tab) {
    document.getElementById('loginForm').style.display = tab === 0 ? 'block' : 'none';
    document.getElementById('signupForm').style.display = tab === 1 ? 'block' : 'none';
    document.getElementById('loginTab').classList.toggle('active', tab === 0);
    document.getElementById('signupTab').classList.toggle('active', tab === 1);
}

// Login
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        currentUser = { id: data.id, email: data.email, isAdmin: data.isAdmin };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        document.getElementById('authBtn').innerHTML = `👤 ${data.email} <small>(Logout)</small>`;
        bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
        loadHistory();
    } catch (err) {
        alert(err.message);
    }
}

// Register
async function register() {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        alert('Account created! You can now login.');
        switchTab(0); // switch back to login tab
    } catch (err) {
        alert(err.message);
    }
}

// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('authBtn').innerHTML = 'Login / Sign up';
    loadHistory();
}

// Search video
async function searchVideo() {
    let input = document.getElementById('urlInput').value.trim();
    const result = document.getElementById('result');
    
    if (!input) return alert("Paste a real URL first");

    result.style.display = 'block';
    document.getElementById('title').textContent = '⏳ Fetching video info...';
    document.getElementById('thumb').src = 'https://via.placeholder.com/340x190/111/eee?text=Loading...';
    document.getElementById('duration').textContent = '- • -';

    const hasList = input.includes('&list=') || input.includes('?list=');
    const infoUrl = hasList ? input.split('&list=')[0].split('?list=')[0] : input;

    const playlistCheck = document.getElementById('playlistMode');
    playlistCheck.disabled = !hasList;
    document.getElementById('playlistLabel').style.color = hasList ? '' : '#999';

    if (hasList) playlistCheck.checked = true;

    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: infoUrl })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        document.getElementById('title').textContent = data.title;
        document.getElementById('duration').textContent = `${data.duration} • ${data.site}`;
        document.getElementById('thumb').src = data.thumbnail;

        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        document.getElementById('title').textContent = `❌ ${err.message}`;
    }
}

// Download
async function download(type) {
    const originalUrl = document.getElementById('urlInput').value.trim();
    const title = document.getElementById('title').textContent;
    let quality = type === 'MP3' ? document.getElementById('mp3-quality').value : document.getElementById('video-quality').value;

    let useCover = document.getElementById('useAsCover').checked;
    const isPlaylist = document.getElementById('playlistMode').checked;

    if (type === 'Video') useCover = false;

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressText.textContent = `Downloading ${title}`;

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Starting...';
    btn.disabled = true;

    try {
        if (isPlaylist) {
            progressText.textContent = 'Loading playlist videos...';
            const listRes = await fetch('/api/playlist-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: originalUrl })
            });
            const videos = await listRes.json();

            if (!videos || videos.length === 0) throw new Error('No videos found in playlist');

            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                const downloadId = `playlist-${i}-${Date.now()}`;

                progressText.textContent = `Downloading ${i + 1} of ${videos.length} – ${video.title}`;

                await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: video.url,
                        type: type,
                        quality: quality,
                        title: video.title,
                        useCover: useCover,
                        isPlaylist: false,
                        downloadId: downloadId,
                        userId: currentUser ? currentUser.id : null
                    })
                });

                await pollUntilDone(downloadId);
            }
        } 
        else {
            const downloadId = 'dl-' + Date.now();

            await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: originalUrl, type, quality, title, useCover, isPlaylist: false, downloadId, userId: currentUser ? currentUser.id : null })
            });

            await pollUntilDone(downloadId);
        }

        finishDownload();

    } catch (err) {
        progressText.textContent = '❌ Error';
        setTimeout(() => { progressContainer.style.display = 'none'; btn.innerHTML = originalText; btn.disabled = false; }, 1500);
    }

    function pollUntilDone(id) {
        return new Promise(resolve => {
            const interval = setInterval(async () => {
                try {
                    const pRes = await fetch(`/api/progress/${id}`);
                    const data = await pRes.json();

                    progressBar.style.width = data.percent + '%';
                    progressBar.textContent = data.percent + '%';

                    if (data.percent >= 100) {
                        clearInterval(interval);
                        resolve();
                    }
                } catch (e) {}
            }, 400);
        });
    }

    function finishDownload() {
        progressText.textContent = 'Download completed';
        setTimeout(() => {
            progressContainer.style.display = 'none';
            alert('Download completed successfully.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            loadHistory();
        }, 800);
    }
}

function fakeDownload(type) { download(type); }

// Load on start
window.addEventListener('load', () => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('authBtn').innerHTML = `👤 ${currentUser.email} <small>(Logout)</small>`;
    }
    loadHistory();
});