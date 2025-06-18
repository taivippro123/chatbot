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

    // Try multiple selectors for audio with more specific targeting
    let audioUrl = null;
    
    // Check for video.js audio elements (common pattern)
    const vjsAudio = $('audio.vjs-tech').attr('src');
    if (vjsAudio) {
      audioUrl = vjsAudio;
      console.log('Found vjs-tech audio:', audioUrl);
    }
    
    // Check for direct audio elements
    if (!audioUrl) {
      const directAudio = $('audio[src]').attr('src');
      if (directAudio) {
        audioUrl = directAudio;
        console.log('Found direct audio:', audioUrl);
      }
    }
    
    // Check for source elements inside audio tags
    if (!audioUrl) {
      const sourceAudio = $('audio source[src]').attr('src');
      if (sourceAudio) {
        audioUrl = sourceAudio;
        console.log('Found source audio:', audioUrl);
      }
    }
    
    // Check for audioplayer data attributes
    if (!audioUrl) {
      const dataFileAudio = $('.audioplayer').attr('data-file') || 
                           $('.audio-player').attr('data-file');
      if (dataFileAudio) {
        audioUrl = dataFileAudio;
        console.log('Found data-file audio:', audioUrl);
      }
    }
    
    // Look for any audio-related elements with src containing .m4a, .mp3, etc
    if (!audioUrl) {
      $('audio, source').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-file');
        if (src && (src.includes('.m4a') || src.includes('.mp3') || src.includes('.wav') || src.includes('tts.mediacdn.vn'))) {
          audioUrl = src;
          console.log('Found audio by extension/domain:', audioUrl);
          return false; // break the loop
        }
      });
    }
    
    // Search for URLs in the HTML content that might be audio files
    if (!audioUrl) {
      const htmlContent = response.data;
      const audioUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:m4a|mp3|wav|aac)(?:\?[^\s"'<>]*)?)/gi;
      const matches = htmlContent.match(audioUrlRegex);
      if (matches && matches.length > 0) {
        audioUrl = matches[0];
        console.log('Found audio by regex:', audioUrl);
      }
    }
    
    // Search specifically for tts.mediacdn.vn URLs
    if (!audioUrl) {
      const htmlContent = response.data;
      const ttsUrlRegex = /(https?:\/\/tts\.mediacdn\.vn[^\s"'<>]+)/gi;
      const matches = htmlContent.match(ttsUrlRegex);
      if (matches && matches.length > 0) {
        audioUrl = matches[0];
        console.log('Found TTS mediacdn URL:', audioUrl);
      }
    }

    // Handle relative audio URLs
    if (audioUrl && !audioUrl.startsWith('http')) {
      if (audioUrl.startsWith('/')) {
        audioUrl = 'https://tuoitre.vn' + audioUrl;
      } else {
        audioUrl = 'https://tuoitre.vn/' + audioUrl;
      }
    }

    // Clean up URL (remove trailing ? if present)
    if (audioUrl && audioUrl.endsWith('?')) {
      audioUrl = audioUrl.slice(0, -1);
    }

    console.log('Final article details:', {
      title: title ? title.substring(0, 100) : 'No title found',
      hasAudio: !!audioUrl,
      audioUrl: audioUrl || 'No audio found',
      urlLength: audioUrl ? audioUrl.length : 0
    });

    // Debug: Log all audio elements found
    const allAudioElements = [];
    $('audio').each((i, el) => {
      const audioEl = {
        id: $(el).attr('id'),
        class: $(el).attr('class'),
        src: $(el).attr('src'),
        dataSrc: $(el).attr('data-src'),
        dataFile: $(el).attr('data-file')
      };
      allAudioElements.push(audioEl);
    });
    
    if (allAudioElements.length > 0) {
      console.log('All audio elements found:', JSON.stringify(allAudioElements, null, 2));
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
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch article audio:', err);
    res.status(500).json({ error: 'Failed to fetch article audio', details: err.message });
  }
});

module.exports = router;
