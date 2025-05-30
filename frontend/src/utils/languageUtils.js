// Detect if text contains math expression
const containsMathExpression = (text) => {
  const mathPattern = /[0-9+\-*/=]/;
  return mathPattern.test(text);
};

// Detect if text ends with specific math keywords
const detectMathLanguage = (text) => {
  const englishPattern = /equal\?$/i;
  const vietnamesePattern = /bằng\?$/i;
  
  if (englishPattern.test(text)) return 'en-US';
  if (vietnamesePattern.test(text)) return 'vi-VN';
  return null;
};

// Detect language for text-to-speech
export const detectSpeechLanguage = (text, uiLanguage) => {
  // Check for math expressions first
  if (containsMathExpression(text)) {
    const mathLang = detectMathLanguage(text);
    if (mathLang) return mathLang;
  }

  // Default language detection
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return vietnamesePattern.test(text) ? 'vi-VN' : 'en-US';
};

// Get language for API requests
export const getAPILanguage = (text, uiLanguage) => {
  // For image questions, use UI language
  if (text.toLowerCase().includes('trong hình') || 
      text.toLowerCase().includes('in the image') || 
      text.toLowerCase().includes('what is this')) {
    return uiLanguage === 'vi' ? 'vi' : 'en';
  }

  // For other cases, detect from text
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return vietnamesePattern.test(text) ? 'vi' : 'en';
}; 