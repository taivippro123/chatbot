// routes/news.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Crawl danh sách tin mới trên trang chủ Tuổi Trẻ
async function getLatestArticles() {
  try {
    const url = 'https://tuoitre.vn/';
    console.log('Fetching news from:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const articles = [];

    // Try multiple selectors for better coverage
    const selectors = [
      '.box-category-item a',
      '.box-category-link-title a',
      '.list-news-content .box-category-item a',
      '.timeline .timeline-item a'
    ];

    let foundArticles = 0;
    for (const selector of selectors) {
      if (foundArticles >= 5) break;
      
      $(selector).each((i, el) => {
        if (foundArticles >= 5) return false;
        
        const title = $(el).text().trim();
        let href = $(el).attr('href');
        
        if (title && href && title.length > 10) { // Filter out short/empty titles
          // Handle both relative and absolute URLs
          if (href.startsWith('/')) {
            href = 'https://tuoitre.vn' + href;
          } else if (!href.startsWith('http')) {
            href = 'https://tuoitre.vn/' + href;
          }
          
          // Avoid duplicates
          if (!articles.some(article => article.url === href)) {
            articles.push({ 
              title: title.substring(0, 200), // Limit title length
              url: href 
            });
            foundArticles++;
            console.log(`Found article ${foundArticles}:`, title.substring(0, 100));
          }
        }
      });
    }

    console.log(`Total articles found: ${articles.length}`);
    return articles.slice(0, 5);
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw error;
  }
}

// Lấy TTS Audio và tiêu đề chi tiết từ 1 bài báo
async function getArticleAudio(url) {
  try {
    console.log('Fetching audio for article:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);

    const title = $('h1.detail-title').text().trim() || 
                  $('h1.article-title').text().trim() ||
                  $('.detail-title').text().trim();

    // Try multiple selectors for audio
    let audioUrl = $('.audioplayer').attr('data-file') || 
                   $('.audio-player').attr('data-file') ||
                   $('audio source').attr('src') ||
                   $('audio').attr('src');

    // Handle relative audio URLs
    if (audioUrl && !audioUrl.startsWith('http')) {
      if (audioUrl.startsWith('/')) {
        audioUrl = 'https://tuoitre.vn' + audioUrl;
      } else {
        audioUrl = 'https://tuoitre.vn/' + audioUrl;
      }
    }

    console.log('Article details:', {
      title: title ? title.substring(0, 100) : 'No title found',
      hasAudio: !!audioUrl,
      audioUrl: audioUrl || 'No audio found'
    });

    return {
      title: title || 'Không có tiêu đề',
      url,
      audioUrl: audioUrl || null
    };
  } catch (error) {
    console.error('Error fetching article audio:', error);
    return {
      title: 'Lỗi tải bài báo',
      url,
      audioUrl: null
    };
  }
}

// Route: GET /api/news
router.get('/', async (req, res) => {
  try {
    const articles = await getLatestArticles();
    console.log('Returning articles:', articles.length);
    res.json(articles);
  } catch (err) {
    console.error('Failed to fetch news list:', err);
    res.status(500).json({ error: 'Failed to fetch news list', details: err.message });
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
    console.error('Failed to fetch article audio:', err);
    res.status(500).json({ error: 'Failed to fetch article audio', details: err.message });
  }
});

module.exports = router;
