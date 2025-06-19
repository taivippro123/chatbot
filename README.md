# 🤖 Chatbot AI

A full-stack AI chatbot application with support for voice messaging, image input, and AI-generated speech. Built using React Native and Node.js with powerful AI integration via Gemini API.

---

## 🧰 Tech Stack

- **Frontend:** React Native
- **Backend:** Node.js
- **Database:** MySQL

---

## ☁️ Deployment

- **Frontend:** Expo
- **Backend:** Render
- **Database:** Clever Cloud
- **Image Hosting:** Cloudinary

---

## 🔌 3rd Party Integrations

- 🧠 **Gemini API** – Accepts both text and image inputs
- 🎙️ **Google Cloud Speech-to-Text** – Convert speech to text
- 🔊 **expo-speech** – Text-to-speech (read AI responses aloud)
- 🖼️ **Cloudinary** – Store and retrieve images

---

## ✨ Features

- Ask questions using **text** or **images**
- Send messages using **voice input**
- **Listen** to AI responses via text-to-speech
- **JWT Authentication** for secure access
- Toggle between **Light** and **Dark** themes
- Support for **English** and **Vietnamese** languages

---
## 📰 Tuổi Trẻ News Listening Feature

This app supports listening to the latest news articles from [Tuổi Trẻ](https://tuoitre.vn) by parsing their official RSS feed.

- 🔗 **RSS Source:** https://tuoitre.vn/rss/tin-moi-nhat.rss
- 🧠 It extracts the `articleId` from each article link and parses the `pubDate`
- 📅 It converts the date to `YYYY/MM/DD` format
- 🔊 Then constructs the TTS (text-to-speech) audio URL like this:
  `https://tts.mediacdn.vn/YYYY/MM/DD/tuoitre-nu-1-ARTICLEID.m4a`

---
## 🚀 How to Use

```bash
git clone https://github.com/taivippro123/chatbot.git
cd chatbot
cd frontend
npx expo start
Use an Android Emulator or scan the QR code with Expo Go App on your Android/iOS device.
```
## ⚠️ Note
- The first registration or login may take a long time due to Render's free tier

