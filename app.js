const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';
const HISTORY_FILE = 'history.json';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);

// HISTORY ALWAYS RESETS ON SERVER START
fs.writeFileSync(HISTORY_FILE, '[]');

app.post('/api/info', (req, res) => {
    const url = req.body.url.trim();
    exec(`yt-dlp --dump-json "${url}"`, { shell: true, timeout: 15000 }, (error, stdout) => {
        if (error) return res.status(400).json({ error: error.message });
        try {
            const info = JSON.parse(stdout);
            const heights = info.formats ? [...new Set(info.formats.filter(f => f.height).map(f => f.height))] : [];
            const maxHeight = Math.max(...heights, 240);

            res.json({
                title: info.title || 'Unknown Title',
                duration: `${Math.floor(info.duration/60)}:${(info.duration%60).toString().padStart(2,'0')}`,
                thumbnail: info.thumbnail || 'https://via.placeholder.com/340x190/111/eee?text=No+Thumbnail',
                site: info.extractor_key || 'Video',
                maxHeight: maxHeight
            });
        } catch (e) {
            res.status(400).json({ error: 'Could not read video info' });
        }
    });
});

app.post('/api/download', (req, res) => {
    const { url, type, quality, title, useCover } = req.body;
    let cmd = `yt-dlp --output "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s"`;

    if (type === 'MP3') {
        let aq = quality.includes('320') ? '0' : quality.includes('256') ? '1' : quality.includes('192') ? '2' : '4';
        cmd += ` -x --audio-format mp3 --audio-quality ${aq}`;
        if (useCover) cmd += ` --embed-thumbnail --convert-thumbnails jpg`;
    } else {
        let f = 'bestvideo+bestaudio/best';
        if (quality === '1080') f = 'bestvideo[height<=1080]+bestaudio/best';
        else if (quality === '720') f = 'bestvideo[height<=720]+bestaudio/best';
        else if (quality === '480') f = 'bestvideo[height<=480]+bestaudio/best';
        else if (quality === '360') f = 'bestvideo[height<=360]+bestaudio/best';
        else if (quality === '240') f = 'bestvideo[height<=240]+bestaudio/best';
        cmd += ` -f "${f}" --merge-output-format mp4`;
    }
    cmd += ` "${url}"`;

    exec(cmd, { shell: true, timeout: 300000 }, (error) => {
        if (error) return res.status(400).json({ error: error.message });

        let history = [];
        history.unshift({
            url: url,
            title: title || 'Unknown',
            type: type,
            time: new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            file: `${title || 'file'}.${type === 'MP3' ? 'mp3' : 'mp4'}`
        });

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 10)));
        res.json({ success: true, message: 'Download finished' });
    });
});

app.post('/api/history/delete', (req, res) => {
    const { index } = req.body;
    let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE)) : [];
    history.splice(index, 1);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
    res.json({ success: true });
});

app.post('/api/history/clear', (req, res) => {
    fs.writeFileSync(HISTORY_FILE, '[]');
    res.json({ success: true });
});

app.get('/api/history', (req, res) => {
    res.json(fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE)) : []);
});

app.listen(PORT, () => console.log(`✅ dlwip running at http://localhost:${PORT}`));