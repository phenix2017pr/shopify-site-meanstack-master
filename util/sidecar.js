'use strict';

var config		= require('../config')
	, async			= require('async')
	, request		= require('request')
	, moment		= require('moment')
	, mongoose	= require('mongoose')
	, Product		= mongoose.model('Product')
	, Order			= mongoose.model('Order');
	
module.exports = function(order, interval, callback) {
	
	if (!order) {
		return callback("Order does not exist.\r\nPlease refresh your dashboard for an updated status.");
	}
	
	if (order.status != 'pending') {
		return callback("You cannot dispatch this order.\r\nPlease refresh your dashboard for an updated status.");
	}
	
	if (!order.items.length) {
		return callback("No items in this order.\r\nPlease refresh your dashboard for an updated status.");
	}
	
	var description;

	async.waterfall([
		function(callback) {
			order.status = 'dispatching';
			order.save(function(err) {
				if (err) {
					err = "Unexpected sys error(#001), please try again."
				}
				callback(err);
			});
		},
		
		function(callback) {
			var items = {};
			
			order.items.forEach(function(item) {
				items[item.id] = {
					quantity:	( items[item.id] && items[item.id].quantity ? items[item.id].quantity : 0 ) + item.quantity,
					name: 		'#' + item.id
				}
			});
			
			Product.find({
				id : { $in : Object.keys(items) }
			}).select('name id -_id').exec(function(err, products) {
				if (err) {
					err = "Unexpected sys error(#002), please try again."
				} else {
					products.forEach(function(product) {
						items[product.id].name = product.name;
					});
					
					description = Object.keys(items).map(function(id){
						return items[id].quantity + 'x' + items[id].name;
					}).join(', ');
				}
								
				callback(err);
			});
		},
		
		function(callback) {
			var payload = {
				tracking_tag:     order.number.toString(),
				description:      description,
				pickup_waypoint:  JSON.parse(JSON.stringify(config.pickup)),
				dropoff_waypoint: order.dispatch.dropoff.toObject(),
				return_waypoint:  JSON.parse(JSON.stringify(config.pickup))
			};
			
			payload.pickup_waypoint.arrive_after		= interval.after;
			payload.pickup_waypoint.arrive_before		= interval.before;
			payload.dropoff_waypoint.arrive_after		= interval.after;
			payload.dropoff_waypoint.arrive_before	= interval.before;
			
			var auth = new Buffer(config.sidecarKey + ':').toString('base64');
			
			request({
				url: "https://delivery.side.cr/shipper/v0/orders",
				method: "POST",
				headers: {
					"Authorization": "Basic " + auth
				},
				json: payload
			}, function(err, response, body) {
				if (!err && response.statusCode != 200) {
					err = 'Sidecar ERROR: ' + (body.message || JSON.stringify(body.errors) || 'HTTP status ' + response.statusCode);
				}
				callback(err, body);
			});
		}
	], function(err, dispatch) {
		order.status = err ? 'pending' : 'dispatched';
		
		if (!err && dispatch) {
			order.dispatch.id			= dispatch.id;
			order.dispatch.status	= dispatch.delivery_status;
			order.dispatch.pickup.arrive_after	= interval.after;
			order.dispatch.pickup.arrive_before	= interval.before;
		}
		
		order.save(function(saveErr) {
			if (saveErr) {
				err += err 
								? "\r\nAdditionally, an error has occurred while trying to update the local database." 
								: 'Order successfully dispatched, but an error has occurred while trying to update the local database!';
			}
			err = err ? "ORDER #" + order.number + ":\r\n" + err : null; // annotate
			
			callback(err, order);
		});
	});
};