const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getSessions,
  registerSession,
  generateQRToken,
  linkDevice,
  removeSession,
  removeAllSessions,
} = require('../controllers/deviceController');

router.use(protect);

router.get('/',                 getSessions);
router.post('/register',        registerSession);
router.post('/qr-token',        generateQRToken);
router.post('/link',            linkDevice);
router.delete('/all',           removeAllSessions);
router.delete('/:sessionId',    removeSession);

module.exports = router;
