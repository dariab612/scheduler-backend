const jwt = require('jsonwebtoken');
const secret = 'canyoukeepasecret';

const checkAuth = function(req, res, next) {
  const token = 
      req.body.token ||
      req.query.token ||
      req.headers['x-access-token'] ||
      req.cookies.token;

  if (!token) {
    res.status(401).send('Unauthorized: token not found');
  } else {
    jwt.verify(token, secret, function(err, decoded) {
      if (err) {
        res.status(401).send('Unauthorized: invalid token');
      } else {
        req.user_data = decoded;
        next();
      }
    });
  }
}

module.exports = checkAuth;
