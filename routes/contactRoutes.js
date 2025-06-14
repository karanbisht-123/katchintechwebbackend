const express = require('express');
const router = express.Router();
const { contactValidationRules, validate } = require('../middleware/validation');
const {
    submitContact,
    getContacts,
    getContactById,
    updateContactStatus
} = require('../controllers/contactController');

router.post('/submit', contactValidationRules(), validate, submitContact);


router.get('/', getContacts);
router.get('/:id', getContactById);
router.put('/:id/status', updateContactStatus);

module.exports = router;