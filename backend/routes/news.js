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

    // Extract date from URL for filtering
    const urlMatch = url.match(/(\d{4})(\d{2})(\d{2})/);
    const articleDate = urlMatch ? `${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}` : null;
    console.log('Article date extracted:', articleDate);

    // Try multiple selectors for audio with better prioritization
    let audioUrl = null;
    
    // PRIORITY 1: Check for audioplayer data-file (most reliable for current articles)
    const audioPlayerEl = $('.audioplayer[data-file]');
    if (audioPlayerEl.length > 0) {
      audioUrl = audioPlayerEl.attr('data-file');
      console.log('Found audioplayer data-file:', audioUrl);
    }
    
    // PRIORITY 2: Check for video.js audio elements with matching date
    if (!audioUrl && articleDate) {
      $('audio.vjs-tech').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes(articleDate.replace(/\//g, '/'))) {
          audioUrl = src;
          console.log('Found vjs-tech audio with matching date:', audioUrl);
          return false; // break loop
        }
      });
    }
    
    // PRIORITY 3: Check for any audio with current date
    if (!audioUrl && articleDate) {
      const currentYear = articleDate.split('/')[0];
      const currentMonth = articleDate.split('/')[1];
      const currentDay = articleDate.split('/')[2];
      
      $('audio[src], source[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes(currentYear) && src.includes(currentMonth) && src.includes(currentDay)) {
          audioUrl = src;
          console.log('Found audio with matching date:', audioUrl);
          return false; // break loop
        }
      });
    }
    
    // PRIORITY 4: Search for current date URLs in HTML content with .m4a preference
    if (!audioUrl && articleDate) {
      const htmlContent = response.data;
      const currentYear = articleDate.split('/')[0];
      const currentMonth = articleDate.split('/')[1];
      const currentDay = articleDate.split('/')[2];
      
      // Look for .m4a files first (preferred format)
      const m4aRegex = new RegExp(`(https?://[^\\s"'<>]*${currentYear}[^\\s"'<>]*${currentMonth}[^\\s"'<>]*${currentDay}[^\\s"'<>]*\\.m4a(?:\\?[^\\s"'<>]*)?)`, 'gi');
      const m4aMatches = htmlContent.match(m4aRegex);
      if (m4aMatches && m4aMatches.length > 0) {
        audioUrl = m4aMatches[0];
        console.log('Found current date .m4a by regex:', audioUrl);
      }
    }
    
    // PRIORITY 5: Fallback - any tts.mediacdn.vn with current date
    if (!audioUrl && articleDate) {
      const htmlContent = response.data;
      const currentYear = articleDate.split('/')[0];
      const currentMonth = articleDate.split('/')[1];
      const currentDay = articleDate.split('/')[2];
      
      const ttsRegex = new RegExp(`(https?://tts\\.mediacdn\\.vn[^\\s"'<>]*${currentYear}[^\\s"'<>]*${currentMonth}[^\\s"'<>]*${currentDay}[^\\s"'<>]*)`, 'gi');
      const ttsMatches = htmlContent.match(ttsRegex);
      if (ttsMatches && ttsMatches.length > 0) {
        // Prefer .m4a over other formats
        const m4aMatch = ttsMatches.find(match => match.includes('.m4a'));
        audioUrl = m4aMatch || ttsMatches[0];
        console.log('Found current date TTS URL:', audioUrl);
      }
    }
    
    // PRIORITY 6: Direct audio elements (fallback)
    if (!audioUrl) {
      const directAudio = $('audio[src]').attr('src');
      if (directAudio) {
        audioUrl = directAudio;
        console.log('Found direct audio (fallback):', audioUrl);
      }
    }
    
    // PRIORITY 7: Source elements (fallback)
    if (!audioUrl) {
      const sourceAudio = $('audio source[src]').attr('src');
      if (sourceAudio) {
        audioUrl = sourceAudio;
        console.log('Found source audio (fallback):', sourceAudio);
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

    // Validate audio URL (check if it's from current year at least)
    const currentYear = new Date().getFullYear();
    if (audioUrl && !audioUrl.includes(currentYear.toString()) && !audioUrl.includes((currentYear - 1).toString())) {
      console.warn('Audio URL seems too old, might not be for current article:', audioUrl);
      // Don't set to null, but log warning
    }

    console.log('Final article details:', {
      title: title ? title.substring(0, 100) : 'No title found',
      hasAudio: !!audioUrl,
      audioUrl: audioUrl || 'No audio found',
      urlLength: audioUrl ? audioUrl.length : 0,
      articleDate: articleDate
    });

    // Debug: Log all audio elements found
    const allAudioElements = [];
    $('.audioplayer, audio').each((i, el) => {
      const audioEl = {
        tagName: el.tagName,
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
