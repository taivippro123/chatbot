const express = require('express');
const Parser = require('rss-parser');
const axios = require('axios');
const router = express.Router();

const parser = new Parser({
  customFields: {
    item: ['description', 'pubDate', 'content:encoded']
  }
});

const stripHtml = (html) =>
  html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const RSS_URL = 'https://tuoitre.vn/rss/tin-moi-nhat.rss';

function extractAudioUrl(articleUrl, pubDate) {
  try {
    // Lấy articleId từ URL
    const match = articleUrl.match(/-(\d+)\.htm/);
    if (!match) return null;
    const articleId = match[1];
    // Lấy ngày tháng năm từ pubDate
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `https://tts.mediacdn.vn/${yyyy}/${mm}/${dd}/tuoitre-nu-1-${articleId}.m4a`;
  } catch {
    return null;
  }
}

async function getLatestArticles() {
  const feed = await parser.parseURL(RSS_URL);
  return feed.items.map(item => {
    let cleanTitle = item.title;
    if (cleanTitle.includes('[CDATA[')) {
      cleanTitle = cleanTitle.replace(/^.*\[CDATA\[/, '').replace(/\]\].*$/, '');
    }
    let cleanDescription = item.description || item.contentSnippet || '';
    if (cleanDescription.includes('[CDATA[')) {
      cleanDescription = cleanDescription.replace(/^.*\[CDATA\[/, '').replace(/\]\].*$/, '');
    }
    const pubDate = item.pubDate;
    const url = item.link;
    return {
      title: cleanTitle.trim(),
      url,
      description: cleanDescription.trim(),
      pubDate,
      content: stripHtml(item['content:encoded'] || cleanDescription),
      audioUrl: extractAudioUrl(url, pubDate)
    };
  });
}

router.post('/', async (req, res) => {
  try {
    const { offset = 0, limit = 10 } = req.query;
    const articles = await getLatestArticles();
    if (!articles || articles.length === 0) {
      return res.status(404).json({ error: 'No news articles found' });
    }
    const start = parseInt(offset, 10) || 0;
    const lim = parseInt(limit, 10) || 10;
    const pagedArticles = articles.slice(start, start + lim);
    return res.json({
      articles: pagedArticles,
      total: articles.length
    });
  } catch (err) {
    console.error('❌ Failed to fetch news:', err);
    res.status(500).json({ error: 'Failed to get news', details: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const articles = await getLatestArticles();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news list', details: err.message });
  }
});

module.exports = router;
