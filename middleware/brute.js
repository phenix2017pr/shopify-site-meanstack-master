'use strict';

var mongoose      = require('mongoose')
  , expressBrute  = require('express-brute')
  , mongoStore    = require('express-brute-mongo');

var store = new mongoStore(function(ready) {
  ready(mongoose.connection.collection('_brute'));
});

var options = {
  freeRetries: 10,
  minWait: 1000 * 60 * 5, // 5 minutes
  maxWait: 1000 * 60 * 60, // 1 hour
  failCallback: function(req, res, next, nextValidRequestDate) {
    var timeleft = Math.ceil((nextValidRequestDate - Date.now()) / 60000)
			, message  = "You have tried to login too many times.\r\n" + 
									 "Please try again in " + timeleft + (timeleft > 1 ? " minutes." : " minute.");
	 
		res.status(429).json({ message: message });
  }
};

module.exports = new expressBrute(store, options);