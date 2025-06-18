// routes/news.js
const express = require('express');
const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

const parser = new Parser({
  customFields: {
    item: ['description', 'pubDate', 'content:encoded']
  }
});

// Lấy danh sách tin mới từ RSS của Tuổi Trẻ
async function getLatestArticles() {
    try {
        const rssUrl = 'https://tuoitre.vn/rss/tin-moi-nhat.rss';
        console.log('📡 Fetching news from RSS:', rssUrl);

        const feed = await parser.parseURL(rssUrl);
        console.log('📰 RSS Feed Info:', {
            title: feed.title,
            description: feed.description,
            totalItems: feed.items.length
        });

        const articles = feed.items.slice(0, 5).map((item, index) => {
            // Clean up title (remove CDATA if present)
            let cleanTitle = item.title;
            if (cleanTitle.includes('[CDATA[')) {
                cleanTitle = cleanTitle.replace(/^.*\[CDATA\[/, '').replace(/\]\].*$/, '');
            }
            
            // Clean up description
            let cleanDescription = item.description || item.contentSnippet || '';
            if (cleanDescription.includes('[CDATA[')) {
                cleanDescription = cleanDescription.replace(/^.*\[CDATA\[/, '').replace(/\]\].*$/, '');
            }

            const article = {
                title: cleanTitle.trim(),
                url: item.link,
                description: cleanDescription.trim(),
                pubDate: item.pubDate,
                content: item['content:encoded'] || cleanDescription
            };

            console.log(`📝 Article ${index + 1}:`, {
                title: article.title.substring(0, 100),
                url: article.url,
                pubDate: article.pubDate
            });

            return article;
        });

        console.log(`✅ Successfully fetched ${articles.length} articles from RSS`);
        return articles;

    } catch (error) {
        console.error('❌ Error fetching RSS feed:', error);
        throw error;
    }
}

// Lấy nội dung chi tiết của bài báo từ RSS (không cần audio URL)
async function getArticleContent(url) {
  try {
    console.log('📖 Getting full article content for:', url);
    
    // Tìm bài báo từ RSS data đã load
    // Vì chúng ta đã có RSS data, chỉ cần trả về thông báo thành công
    return {
      title: 'Nội dung đã sẵn từ RSS',
      url,
      audioUrl: null // Không cần audio URL, dùng TTS
    };
    
  } catch (error) {
    console.error('❌ Error getting article content:', error);
    return {
      title: 'Lỗi tải nội dung bài báo',
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

// Route: GET /api/news/content?url=... (không cần nữa vì RSS đã có content)
router.get('/audio', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const data = await getArticleContent(url);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch article content:', err);
    res.status(500).json({ error: 'Failed to fetch article content', details: err.message });
  }
});

module.exports = router;
