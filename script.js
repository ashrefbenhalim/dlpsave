// Reset page when clicking logo
function resetPage() {
    document.getElementById('urlInput').value = '';
    document.getElementById('result').style.display = 'none';
    document.getElementById('progressContainer').style.display = 'none';
}

// Load history
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const history = await res.json();
        const list = document.getElementById('historyList');
        const empty = document.getElementById('historyEmpty');

        list.innerHTML = '';

        if (history.length === 0) {
            empty.style.display = 'block';
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

        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            div.innerHTML = `
                <div style="flex: 1; cursor: pointer;" onclick="handleHistoryClick(${index})">
                    <strong>${item.title}</strong><br>
                    <small class="text-muted">${item.type} • ${item.time}</small>
                </div>
                <span class="badge bg-primary me-3">${item.file.split('.').pop().toUpperCase()}</span>
                <button onclick="deleteHistoryItem(${index}); event.stopImmediatePropagation();" class="btn btn-sm btn-danger">✕</button>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.log('History load failed');
    }
}

window.handleHistoryClick = function(index) {
    fetch('/api/history')
        .then(r => r.json())
        .then(history => {
            const item = history[index];
            if (item && item.url) {
                document.getElementById('urlInput').value = item.url;
                searchVideo();
            }
        });
};

window.deleteHistoryItem = async function(index) {
    if (confirm('Delete this item?')) {
        await fetch('/api/history/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index })
        });
        loadHistory();
    }
};

// Search video + grey out playlist checkbox
async function searchVideo() {
    let input = document.getElementById('urlInput').value.trim();
    const result = document.getElementById('result');
    
    if (!input) return alert("Paste a real URL first");

    result.style.display = 'block';
    document.getElementById('title').textContent = '⏳ Fetching video info...';
    document.getElementById('thumb').src = 'https://via.placeholder.com/340x190/111/eee?text=Loading...';
    document.getElementById('duration').textContent = '— • —';

    const hasList = input.includes('&list=') || input.includes('?list=');
    const infoUrl = hasList ? input.split('&list=')[0].split('?list=')[0] : input;

    // Grey out playlist checkbox
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

        // Grey-out video qualities
        const select = document.getElementById('video-quality');
        const options = select.options;
        for (let i = 0; i < options.length; i++) {
            const val = options[i].value;
            if (val === 'best') continue;
            const reqHeight = parseInt(val);
            if (reqHeight > data.maxHeight) {
                options[i].disabled = true;
                options[i].style.color = '#999';
            } else {
                options[i].disabled = false;
                options[i].style.color = '';
            }
        }

        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        document.getElementById('title').textContent = `❌ ${err.message}`;
    }
}

// Download function
async function download(type) {
    const originalUrl = document.getElementById('urlInput').value.trim();
    const title = document.getElementById('title').textContent;
    let quality = type === 'MP3' ? document.getElementById('mp3-quality').value : document.getElementById('video-quality').value;

    const useCover = document.getElementById('useAsCover').checked;
    const isPlaylist = document.getElementById('playlistMode').checked;

    const downloadUrl = isPlaylist ? originalUrl : originalUrl.split('&list=')[0].split('?list=')[0];

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressText.textContent = 'Downloading with yt-dlp...';

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Starting...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: downloadUrl, type, quality, title, useCover })
        });
        const data = await res.json();

        if (data.success) {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 25 + 5;
                if (progress >= 100) progress = 100;
                progressBar.style.width = progress + '%';
                progressBar.textContent = Math.round(progress) + '%';
                if (progress >= 100) {
                    clearInterval(interval);
                    progressText.innerHTML = `✅ <strong>Done!</strong>`;
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        alert(`✅ ${type} saved!\n\n${useCover && type === 'MP3' ? 'Thumbnail is now album art 🎵' : ''}`);
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        loadHistory();
                    }, 800);
                }
            }, 120);
        }
    } catch (err) {
        progressText.textContent = '❌ Error';
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function fakeDownload(type) { download(type); }

// Load history on page start
window.addEventListener('load', loadHistory);