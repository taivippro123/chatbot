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
  
      let audioUrl = null;
  
      // PRIORITY 1: Check for <div class="audioplayer" data-file="...">
      const audioPlayerEl = $('.audioplayer[data-file]');
      if (audioPlayerEl.length > 0) {
        audioUrl = audioPlayerEl.attr('data-file');
        console.log('Found audioplayer data-file:', audioUrl);
      }
  
      // PRIORITY 2: Check for <audio class="vjs-tech" src="...">
      if (!audioUrl) {
        const audioTechEl = $('audio.vjs-tech[src]');
        if (audioTechEl.length > 0) {
          audioUrl = audioTechEl.attr('src');
          console.log('Found audio via vjs-tech:', audioUrl);
        }
      }
  
      // PRIORITY 3: Fallback - any <audio src="...">
      if (!audioUrl) {
        const directAudio = $('audio[src]').attr('src');
        if (directAudio) {
          audioUrl = directAudio;
          console.log('Found direct audio (fallback):', audioUrl);
        }
      }
  
      // PRIORITY 4: Fallback - any <audio><source src="..."></audio>
      if (!audioUrl) {
        const sourceAudio = $('audio source[src]').attr('src');
        if (sourceAudio) {
          audioUrl = sourceAudio;
          console.log('Found source audio (fallback):', sourceAudio);
        }
      }
  
      // PRIORITY 5: Fallback - regex search in HTML content (look for .m4a from tts.mediacdn.vn)
      if (!audioUrl) {
        const htmlContent = response.data;
        const m4aRegex = /(https?:\/\/tts\.mediacdn\.vn\/[^\s"'<>]+\.m4a(?:\?[^"'<>]*)?)/gi;
        const matches = htmlContent.match(m4aRegex);
        if (matches && matches.length > 0) {
          audioUrl = matches[0];
          console.log('Found .m4a audio via regex:', audioUrl);
        }
      }
  
      // Convert relative to absolute if needed
      if (audioUrl && !audioUrl.startsWith('http')) {
        if (audioUrl.startsWith('/')) {
          audioUrl = 'https://tuoitre.vn' + audioUrl;
        } else {
          audioUrl = 'https://tuoitre.vn/' + audioUrl;
        }
      }
  
      // Clean URL
      if (audioUrl && audioUrl.endsWith('?')) {
        audioUrl = audioUrl.slice(0, -1);
      }
  
      // Debug log
      const allAudioElements = [];
      $('audio, .audioplayer').each((i, el) => {
        allAudioElements.push({
          tag: el.tagName,
          id: $(el).attr('id'),
          class: $(el).attr('class'),
          src: $(el).attr('src'),
          dataFile: $(el).attr('data-file')
        });
      });
  
      if (allAudioElements.length > 0) {
        console.log('🧩 All audio elements:', JSON.stringify(allAudioElements, null, 2));
      }
  
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
        if (!audioUrl) {
            const audioTechEl = $('audio.vjs-tech[src]');
            if (audioTechEl.length > 0) {
                audioUrl = audioTechEl.attr('src');
                console.log('Found audio via vjs-tech:', audioUrl);
            }
        }
        res.json(data);
    } catch (err) {
        console.error('Failed to fetch article audio:', err);
        res.status(500).json({ error: 'Failed to fetch article audio', details: err.message });
    }
});

module.exports = router;
