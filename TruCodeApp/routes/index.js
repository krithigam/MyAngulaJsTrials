var express = require('express');
var router = express.Router();
router.get('/', function (req, res) {
  res.render('codeBooks-references-integration.html', { title: 'True Code'});
})

module.exports = router;
