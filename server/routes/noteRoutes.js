const express = require('express');
const router = express.Router();
const { getNotes, createNote, updateNote, deleteNote, shareNote } = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All note routes are protected

router.get('/', getNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);
router.post('/share/:id', shareNote);

module.exports = router;
