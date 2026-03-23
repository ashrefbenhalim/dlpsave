const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';
const HISTORY_FILE = 'history.json';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

// Get video info
app.post('/api/info', (req, res) => {
    const url = req.body.url.trim();
    console.log(`[INFO] Trying URL: ${url}`);   // ← you’ll see this in terminal

    exec(`yt-dlp --dump-json "${url}"`, { shell: true, timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('[ERROR]', error.message, stderr);
            return res.status(400).json({ error: `yt-dlp failed: ${error.message}` });
        }
        try {
            const info = JSON.parse(stdout);
            res.json({
                title: info.title || 'Unknown Title',
                duration: `${Math.floor(info.duration/60)}:${(info.duration%60).toString().padStart(2,'0')}`,
                thumbnail: info.thumbnail || 'https://via.placeholder.com/340x190/111/eee?text=No+Thumbnail',
                site: info.extractor_key || 'Video'
            });
        } catch (e) {
            res.status(400).json({ error: 'Could not read video info' });
        }
    });
});

// Download (same safe fix)
app.post('/api/download', (req, res) => {
    const { url, type, quality, title } = req.body;
    let cmd = `yt-dlp --output "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s"`;

    if (type === 'MP3') {
        cmd += ` -x --audio-format mp3 --audio-quality ${quality.split(' ')[0]}`;
    } else {
        if (quality.includes('720')) cmd += ` -f best[height<=720]`;
        else if (quality.includes('1080')) cmd += ` -f best[height<=1080]`;
        else cmd += ` -f best`;
    }
    cmd += ` "${url}"`;

    console.log(`[DOWNLOAD] Running: ${cmd}`);

    exec(cmd, { shell: true, timeout: 300000 }, (error) => {
        if (error) {
            console.error('[DOWNLOAD ERROR]', error.message);
            return res.status(400).json({ error: error.message });
        }

        // save history
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE));
        history.unshift({
            title: title || 'Unknown',
            type: type,
            time: new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            file: `${title || 'file'}.${type === 'MP3' ? 'mp3' : 'mp4'}`
        });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 10)));

        res.json({ success: true, message: `Saved to ${DOWNLOAD_FOLDER} folder!` });
    });
});

app.get('/api/history', (req, res) => {
    if (fs.existsSync(HISTORY_FILE)) {
        res.json(JSON.parse(fs.readFileSync(HISTORY_FILE)));
    } else res.json([]);
});

app.listen(PORT, () => {
    console.log(`✅ dlwip running at http://localhost:${PORT}`);
    console.log(`   (Close this window with Ctrl+C when you’re done)`);
});