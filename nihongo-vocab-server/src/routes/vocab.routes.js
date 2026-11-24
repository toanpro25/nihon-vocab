const express = require('express');
const VocabController = require('../controllers/vocab.controller');

const router = express.Router();
const vocabController = new VocabController();

router.get('/vocab', vocabController.getVocabulary);
router.get('/vocab/:id', vocabController.getVocabularyById);

module.exports = router;