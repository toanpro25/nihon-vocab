class VocabService {
    constructor() {
        this.vocabularyData = require('../data/normalized/vocabulary.json');
    }

    getAllVocabulary() {
        return this.vocabularyData;
    }

    getVocabularyById(id) {
        return this.vocabularyData.find(entry => String(entry.id) === String(id));
    }

    searchVocabulary(term) {
        return this.vocabularyData.filter(entry => 
            entry.word.includes(term) || entry.meaning.includes(term)
        );
    }
}

module.exports = VocabService;