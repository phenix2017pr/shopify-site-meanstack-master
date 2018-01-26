'use strict';

var config		=	require('../config')
	, express   = require('express')
	, mongoose  = require('mongoose')
	, async     = require('async')
	, router    = express.Router()
	, Product		= mongoose.model('Product')
	, Order			= mongoose.model('Order');

router.get('/:token', function(req, res, next) {
	
	// consider adding some "bruteforce protection"
	
	var token = req.params.token
		, query = { 'tracking.cart': token };
		
	if (token.length < 32) {
		token = req.params.token.split('-');

		if (token[0].length < 4 || token[1].length !== 6) {
			return res.sendStatus(400);
		}
		
		query = {
			'number':	token[0],
			'tracking.id':	token[1]
		}
	}
	
	Order.findOne(query)
		.select('-price.earnings')
		.exec(function (err, order) {
			if (err) {
				return next(err);
			}
			
			if (!order) {
				return res.sendStatus(400);
			}
			
			order = order.toObject();
			
			// "populate" would have worked great :(
			async.each(order.items, function(item, callback) {
				Product.findOne({ id: item.id }).exec(function(err, product) {
					if (!err && product) {
						for (var atr in product.toObject()) {
							item[atr] = product[atr];
						}
					}

					callback(err);
				});
			}, function(err){
				if (err) {
					return next(err);
				}
				
				res.jsonp(order);
			});
		});
});

module.exports = router;