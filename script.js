async function searchVideo() {
    const input = document.getElementById('urlInput').value.trim();
    const result = document.getElementById('result');
    
    if (!input) {
        alert("Paste a real URL first (YouTube, TikTok, etc.)");
        return;
    }

    result.style.display = 'block';
    document.getElementById('title').textContent = '⏳ Fetching video info with yt-dlp...';
    document.getElementById('thumb').src = 'https://via.placeholder.com/340x190/111/eee?text=Loading...';
    document.getElementById('duration').textContent = '— • —';

    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: input })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        document.getElementById('title').textContent = data.title;
        document.getElementById('duration').textContent = `${data.duration} • ${data.site}`;
        document.getElementById('thumb').src = data.thumbnail;

        // Grey-out unsupported qualities
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

async function download(type) {
    const url = document.getElementById('urlInput').value.trim();
    const title = document.getElementById('title').textContent;
    let quality = type === 'MP3' 
        ? document.getElementById('mp3-quality').value 
        : document.getElementById('video-quality').value;

    const useCover = document.getElementById('useAsCover').checked;

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
            body: JSON.stringify({ url, type, quality, title, useCover })
        });
        const data = await res.json();

        if (data.success) {
            // Simple smooth animation to 100% (never stuck)
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
                        alert(`✅ ${type} saved to downloads folder!\n\n${useCover && type === 'MP3' ? 'Thumbnail is now album art 🎵' : ''}`);
                        btn.innerHTML = originalText;
                        btn.disabled = false;
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