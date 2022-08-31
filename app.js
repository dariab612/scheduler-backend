const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const checkAuth = require('./middleware');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const secret = 'canyoukeepasecret';

app.post('/api/register', function(req, res) {
  const { email, password } = req.body;
  console.log('email', email, 'password', password);
  res.status(200).send("Successful registration");
});

app.post('/api/authenticate', function(req, res) {
  const { email, password } = req.body;
  const payload = { email };
  const token = jwt.sign(payload, secret, {
    expiresIn: '1h'
  });
  res.cookie('token', token, { httpOnly: true }).sendStatus(200);
});

app.get('/checkToken', checkAuth, function(req, res) {
  res.sendStatus(200);
});

app.listen(process.env.PORT || 8080);

