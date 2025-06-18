// routes/news.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Crawl danh sách tin mới trên trang chủ Tuổi Trẻ
async function getLatestArticles() {
  const url = 'https://tuoitre.vn/';
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const articles = [];

  $('.box-category-item a').each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');
    if (title && href) {
      const fullUrl = 'https://tuoitre.vn' + href;
      articles.push({ title, url: fullUrl });
    }
  });

  return articles.slice(0, 5); // lấy 5 bài đầu tiên
}

// Lấy TTS Audio và tiêu đề chi tiết từ 1 bài báo
async function getArticleAudio(url) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const title = $('h1.detail-title').text().trim();
  const audioUrl = $('.audioplayer').attr('data-file');

  return {
    title,
    url,
    audioUrl: audioUrl || null
  };
}

// Route: GET /api/news
router.get('/', async (req, res) => {
  try {
    const articles = await getLatestArticles();
    res.json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch news list' });
  }
});

// Route: GET /api/news/audio?url=...
router.get('/audio', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const data = await getArticleAudio(url);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch article audio' });
  }
});

module.exports = router;
