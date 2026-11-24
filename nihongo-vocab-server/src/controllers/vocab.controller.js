class VocabController {
    constructor() {
        const VocabService = require('../services/vocab.service');
        this.vocabService = new VocabService();
        this.getVocabulary = this.getVocabulary.bind(this);
        this.getVocabularyById = this.getVocabularyById.bind(this);
    }

    getVocabulary(req, res) {
        try {
            const vocabulary = this.vocabService.getAllVocabulary();
            res.status(200).json(vocabulary);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving vocabulary data', error: error.message });
        }
    }

    getVocabularyById(req, res) {
        try {
            const vocabulary = this.vocabService.getVocabularyById(req.params.id);
            if (!vocabulary) {
                return res.status(404).json({ message: 'Vocabulary entry not found' });
            }
            return res.status(200).json(vocabulary);
        } catch (error) {
            return res.status(500).json({ message: 'Error retrieving vocabulary data', error: error.message });
        }
    }
}

module.exports = VocabController;