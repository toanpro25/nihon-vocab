const fs = require('fs');
const path = require('path');

// Load raw vocabulary data
const rawDataPath = path.join(__dirname, '../data/raw/data.js');
const rawData = require(rawDataPath);

// Function to convert raw vocabulary data to normalized format
const convertVocabulary = (data) => {
    return data.map((item, index) => ({
        id: index + 1,
        word: item.word,
        meaning: item.meaning,
        example: item.example || null
    }));
};

// Convert the raw data
const normalizedData = convertVocabulary(rawData);

// Save the normalized data to vocabulary.json
const normalizedDataPath = path.join(__dirname, '../data/normalized/vocabulary.json');
fs.writeFileSync(normalizedDataPath, JSON.stringify(normalizedData, null, 2), 'utf8');

console.log('Vocabulary data has been converted and saved to vocabulary.json');