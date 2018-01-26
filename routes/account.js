'use strict';

var express   = require('express')
  , mongoose  = require('mongoose')
  , async     = require('async')
  , crypto    = require('crypto')
  , passport  = require('passport')
  , brute     = require('../middleware/brute')
  , router    = express.Router()
  , checkAuth = require('../middleware/auth')
  , mandrill	= require('../util/mandrill')
  , User			= mongoose.model('User');

	
var ensureAuth = function(req, res, next) {
	if (!req.isAuthenticated()){
		return res.status(401).json({ message: "Not logged in." });
	}
	next();
}

var ensureNoAuth = function(req, res, next) {
	if (req.isAuthenticated()){
		return res.status(400).json({ message: "It appears you are already logged in." });
	}
	next();
}
	
// get account
router.get('/', ensureAuth, function(req, res, next) {
	var user = req.user.toObject();
	delete user.password;
	delete user.reset;
	
	res.status(200).json({user: user});
});

// update account
router.put('/', ensureAuth, function(req, res, next) {

	req.user.name		= req.body.name;
	req.user.photo	= req.body.photo;
	
	if (req.body.password) {
		req.user.password = req.body.password;
	}
	
	req.user.save(function(err) {
		if (err) {
			return next(err)
		}
		
		var user = req.user.toObject();
		delete user.password;
		delete user.reset;
		
		return res.status(200).json({user: user});
	})
});

// login
router.post('/auth', brute.prevent, function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) {
			return next(err);
		}
		
    if (!user) {
			return res.status(401).json({ message: info });
		}
    
    req.logIn(user, function(err) {
      if (err) {
				return next(err);
			}
      
      req.session.cookie.maxAge = req.body.remember ? 1000 * 60 * 60 * 24 * 365 : null; // 1y r
			
			user = user.toObject();
			delete user.password;
			delete user.reset;
			
			res.status(200).json({user: user});
    });
  })(req, res, next);
});

// logout
router.delete('/auth', function(req, res, next) {
  req.logout();
	res.sendStatus(200);
});

// recover password - init
router.post('/recover', ensureNoAuth, function(req, res, next) {
	
	var user;
	
	async.series([
    function(callback) {  // email & request issued check
      User.findOne({ 
        'email': req.body.email 
      }).select('reset name _id email').exec(function (err, doc) {
               
        if (!err && !doc) {
          var err = {
            status: 400,
            message: "No account registered with this email address."
          };
        }
        
        // check if an other request was initiated within the last 15 minutes
        if (!err && doc && doc.reset.issued > Date.now() - 1000 * 60 * 15) {
          var timeleft = Math.ceil((1000 * 60 * 15 - (Date.now() - doc.reset.issued)) / 60000);
          var err = {
            status: 400,
            message: "You have already initiated a recovery request within the last 15 minutes. " +
                     "Please wait " + timeleft + (timeleft > 1 ? ' minutes.' : ' minute.') + " and try again."
          };
        }
        
        user = doc;
        callback(err);
      })
    },
    function(callback) {  // generate token
      crypto.randomBytes(20, function(err, buf) {
        if (!err) {
          user.reset = {
						token: buf.toString('hex'),
            issued: Date.now(),
            expire: Date.now() + 1000 * 60 * 60 * 24 // one day
          };
        }
        callback(err);
      });
    },
    function(callback) {  // send email
			mandrill('/messages/send', {
				message: {
					to: [{ email: user.email, name: user.name.first + " " + user.name.last }],
					from_email: "noreply@" + req.hostname,
					subject: "Password recovery",
					text: "Hi " + user.name.first + ",\r\n\r\n" +
								"A password recovery request was initiated for your account.\r\n" + 
								"Please follow this link to reset your password: " + req.protocol + "://" + req.get('host') + "/#/recover/" + user.reset.token + "\r\n" +
								"If you have not initiated a password recovery request, ignore this message. The recovery link will expire in 24 hours.\r\n"
				}
			}, function(err) {
				if (err) {
					err = {
						status: 400,
						message: "Could not send recovery email, please try again."
					};
				}
				callback(err);
			});
    },
    function(callback) {
      user.save(user, callback);
    }
  ], function(err) {
		if (err) {
			return next(err);
		}
		
		res.status(200).json({ message: "Reset instructions sent, check your email." });
  });
});

// recover password - check token/reset passwd
router.put('/recover', ensureNoAuth, function(req, res, next) {

	User.findOne({
    'reset.token':	req.body.token,
    'reset.expire':	{ $gte: Date.now() }
  }).select('_id name email reset').exec(function (err, user) {
    if (err) {
      return next(err);
    }
		
    if (!user) {
      return next({ status: 400, message: "Invalid or expired token.\r\nPlease initiate a new password recovery request."});
    }

    if (req.body.password) {
      user.password = req.body.password;
      user.reset.expire = Date.now(); // invalidate token
     
      // 'n save
      user.save(function(err) {
        if (err){ 
					return next(err); 
				}
        req.logIn(user, function(err) {
					var message = "Password successfully updated.";
					if (err) {
						// could not login user, but password was successfully updated
						return res.status(200).json({ message: message });
					}
					
					user = user.toObject();
					delete user.password;
					delete user.reset;
			
					res.status(200).json({ message: message, user: user });
        });
      });
    } else {
			res.status(200).json({ message: "Token ok." });
    }
  });
});

module.exports = router;