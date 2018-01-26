'use strict';

var config		= require('../config')
	,	mandrill  = require('node-mandrill')(config.mandrillKey);
	
module.exports = mandrill;