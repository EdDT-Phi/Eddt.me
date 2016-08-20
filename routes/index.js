var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('game', { title: 'Express' });
});

router.get('/about', function(req, res, next) {
  res.render('about', { title: 'Express' });
});

router.get('/resume', function(req, res, next) {
  res.render('resume', { title: 'Express' });
});

router.get('/generic', function(req, res, next) {
  res.render('generic', { title: 'Express' });
});

router.get('/elements', function(req, res, next) {
  res.render('elements', { title: 'Express' });
});

router.get('/references', function(req, res, next) {
  res.render('references', { title: 'Express' });
});

module.exports = router;
