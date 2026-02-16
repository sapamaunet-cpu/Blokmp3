const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// Helper ambil ID Video
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

app.get('/api/convert', async (req, res) => {
    const videoUrl = req.query.url;
    const videoId = extractVideoId(videoUrl);

    if (!videoId) return res.status(400).json({ error: 'URL YouTube tidak valid' });

    // Ambil daftar key dari env: "key1,key2,key3"
    const apiKeys = process.env.RAPIDAPI_KEYS ? process.env.RAPIDAPI_KEYS.split(',') : [];

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: 'Konfigurasi API Key belum diatur di Vercel' });
    }

    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i].trim();
        try {
            const response = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
                params: { id: videoId },
                headers: {
                    'X-RapidAPI-Key': currentKey,
                    'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
                },
                timeout: 15000
            });

            // Ambil info sisa kuota dari header (jika tersedia dari provider)
            const remaining = response.headers['x-ratelimit-requests-remaining'] || 'N/A';
            const limit = response.headers['x-ratelimit-requests-limit'] || 'N/A';

            if (response.data && response.data.link) {
                return res.json({
                    success: true,
                    title: response.data.title,
                    link: response.data.link,
                    quota: {
                        remaining: remaining,
                        limit: limit,
                        activeKeyIndex: i + 1
                    }
                });
            } else if (response.data && response.data.msg === 'in progress') {
                return res.status(202).json({ error: 'Video sedang diproses, ulangi klik tombol dalam 5 detik.' });
            }

        } catch (error) {
            // Jika limit habis (429), lanjut ke key berikutnya
            if (error.response && error.response.status === 429) {
                console.log(`Key ${i+1} habis, mencoba key berikutnya...`);
                continue;
            }
            return res.status(500).json({ error: 'Terjadi kesalahan pada server konversi.' });
        }
    }

    res.status(429).json({ error: 'Semua kuota API Key habis untuk hari ini!' });
});

module.exports = app;
