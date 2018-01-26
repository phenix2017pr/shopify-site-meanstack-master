'use strict';

module.exports = function (req, res, next) {
  if (!req.isAuthenticated()){
		res.status(401).json({ message: "Your session has expired." });
		return;
  }
  next();
}