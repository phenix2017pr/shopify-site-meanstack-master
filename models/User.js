'use strict';

var mongoose      = require('mongoose')
  , bcrypt        = require('bcryptjs')
  , Schema        = mongoose.Schema
  , passportLocal = require('passport-local').Strategy;

var UserSchema = new Schema({
  name:  {
    first: { type: String, trim: true, required: true, maxlength: 35 },
    last:  { type: String, trim: true, required: true, maxlength: 35 }
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    required: true,
    maxlength: 254, 
   // match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email address']
   /** NOTE TO SELF: CONSIDER NORMALIZING EMAIL ADDRES AND/OR ADDING PROPER VALIDATION */
  },
  password: { type: String, required: true },
	photo:		{ type: String, required: true },
	active:		{ type: Boolean, default: true },
	reset:		{
		token:		{ type: String, unique: true },
		issued:		{ type: Date, default: Date.now },
		expire:		{ type: Date, default: Date.now }
	}
});
 
UserSchema.statics = {
  authenticate: function() {
    var _this = this;
    return new passportLocal({ usernameField: 'email' }, function(email, password, done) {
      /** NOTE TO SELF: maybe enable email validation */
      //if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email))
       // return done(null, false, 'Invalid email address.');
      
      _this.findOne({ email: email.toLowerCase() }, function(err, user) {
        if (err) {
          return done(err);
        }
        if (!user) {
          return done(null, false, 'Invalid email or password.');
        }
        if (!user.active) {
          return done(null, false, 'This account is disabled.');
        }
        bcrypt.compare(password, user.password, function(err, compare) {
          if (err) {
            return done(err);
          }
          if (compare === false) {
            return done(null, false, 'Invalid email or password.');
          } else {
            return done(null, user);
          }
        });
      });
    });
  },
  
  serialize: function() {
    return function(user, done) {
      done(null, { _id: user.id, password: user.password });
    }
  },
  
  deserialize: function() {
    var _this = this;
    return function(user, done) {
      _this.findOne(user, function(err, user) {
        done(err, user);
      });
    }
  }
};

UserSchema.pre('save', function(next) {
  var _this = this;
  if (!_this.isModified('password')) {
		return next();
	}
	
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(_this.password, salt, function(err, hash) {
      if (err) return next(err);
      _this.password = hash;
      next();
    });
  });
});

mongoose.model('User', UserSchema);