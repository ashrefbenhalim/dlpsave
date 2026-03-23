async function searchVideo() {
    const input = document.getElementById('urlInput').value.trim();
    const result = document.getElementById('result');
    
    if (!input) {
        alert("Paste a real URL first (YouTube, TikTok, etc.)");
        return;
    }

    result.style.display = 'block';
    
    // Show loading WITHOUT destroying the whole section
    document.getElementById('title').textContent = '⏳ Fetching info with yt-dlp...';
    document.getElementById('thumb').src = 'https://via.placeholder.com/340x190/111/eee?text=Loading...';

    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: input })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Now fill the real info
        document.getElementById('title').textContent = data.title;
        document.getElementById('duration').textContent = `${data.duration} • ${data.site}`;
        document.getElementById('thumb').src = data.thumbnail;

        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        document.getElementById('title').textContent = `❌ ${err.message}`;
        document.getElementById('thumb').src = 'https://via.placeholder.com/340x190/111/eee?text=Error';
    }
}

async function download(type) {
    const url = document.getElementById('urlInput').value.trim();
    const title = document.getElementById('title').textContent;
    let quality = type === 'MP3' 
        ? document.getElementById('mp3-quality').value 
        : document.getElementById('video-quality').value;

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Downloading...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type, quality, title })
        });
        const data = await res.json();

        if (data.success) {
            alert(`✅ ${type} saved! Check your "downloads" folder.`);
        } else {
            alert('Error: ' + (data.error || 'unknown'));
        }
    } catch (err) {
        alert('Make sure app.js is running (node app.js)');
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

// Keep your old fakeDownload line
function fakeDownload(type) { download(type); }

// Your scroll listener stays exactly the same (copy it from your old script.js)