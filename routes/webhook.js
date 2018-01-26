'use strict';

var config		=	require('../config')
	, express   = require('express')
	, mongoose  = require('mongoose')
	, async     = require('async')
	, moment		= require('moment-timezone')
	, request		= require('request')
	, distance	= require('google-distance')
	, sidecar		= require('../util/sidecar')
	, mandrill	= require('../util/mandrill')
	, router    = express.Router()
	, Product		= mongoose.model('Product')
	, Order			= mongoose.model('Order')
	, emitOrder	= require('../util/emit-order') // order emit (including how many orders customer has had)
	, emitSales = require('../util/emit-sales');


var routes = function(io) {
	
	// Shopify product callback
	router.post('/shopify/product', function(req, res, next) {
		if (config.shopifySecret != req.query.secret) {
			return res.sendStatus(401);
		}
		
		Product.findOne({ id: req.body.id }, function(err, product) {
			if (err) {
				return next(err);
			}
			
			if (!product) {
				product = new Product();
			}
			
			if (moment(req.body.updated_at).diff(moment(product.updated)) <= 0) {
				return res.sendStatus(304);
			}
			
			product.id			= req.body.id;
			product.created	= req.body.created_at;
			product.updated	= req.body.updated_at;
			product.title		= req.body.title;
			product.name		= req.body.variants[0].barcode || '#' + req.body.id;
			product.type		= req.body.product_type.toLowerCase() == 'entrée' ? 'entree' : req.body.product_type.toLowerCase();
			product.image		= req.body.image && req.body.image.src ? req.body.image.src : 'https://cdn.shopify.com/s/images/admin/no-image-large.gif';
			product.handle	= req.body.handle;
			
			product.save(function(err) {
				if (err) {
					return next(err);
				}
				
				io.emit('products', product);
				res.sendStatus(200);
			});
		});
	});
	
	// Shopify order callback
	router.post('/shopify/order', function(req, res, next) {
		if (config.shopifySecret != req.query.secret) {
			return res.sendStatus(401);
		}
		
		if (!req.body.line_items || !req.body.refunds || !req.body.shipping_address) {
			return res.sendStatus(304); // hopefully Shopify won't delete the hooks anymore
		}
		
		setTimeout(function() { // delay order updates by 1s - monkey fix for multiple update events triggered by Shopify when an order is placed
			Order.findOne({ id: req.body.id }, function(err, order) {
				if (err) {
					return next(err);
				}
				
				if (!order) {
					order = new Order();
				}
				
				if (moment(req.body.updated_at).diff(moment(order.updated)) <= 0) {
					return res.sendStatus(304);
				}
					
				// monkey loops @items
				order.items  = [];
				var earnings = 0;
				var items    = {};
				var cartType = 'primary';

				req.body.line_items.forEach(function(item) {
					if (!item.gift_card) {
						items[item.product_id] = {
							id: item.product_id,
							quantity: (items[item.product_id] ? items[item.product_id].quantity : 0) + item.quantity,
							price: item.price
						};
					}
				});
				
				req.body.refunds.forEach(function(refund) {
					refund.refund_line_items.forEach(function(item) {
						var id	= item.line_item.product_id;
						
						if (items[id]) {
							var quantity = items[id].quantity - item.quantity;
							if (quantity < 1) {
								delete items[id];
							} else {
								items[id].quantity = quantity;
							}
						}
					});
				});
			
				Object.keys(items).forEach(function(id) {
					order.items.push(items[id]);
					earnings += items[id].quantity * items[id].price;
				});

				order.id				= req.body.id;
				order.number		= req.body.order_number;
				order.created		= req.body.created_at;
				order.updated		= req.body.updated_at;
				order.canceled	= req.body.cancelled_at;
				order.fulfilled	= req.body.fulfillment_status;
				
				order.tracking.cart		= req.body.cart_token;
				order.tracking.notify = req.body.buyer_accepts_marketing;
				
				order.price			= {
					subtotal:	req.body.subtotal_price,
					discount:	req.body.total_discounts,
					delivery:	req.body.shipping_lines.length && req.body.shipping_lines[0].price ? req.body.shipping_lines[0].price : 0,
					tax:			req.body.total_tax,
					total:		req.body.total_price,
					earnings:	earnings
				};
				
				order.customer	= {
					id:					req.body.customer && req.body.customer.id ? req.body.customer.id : null,
					first_name:	req.body.shipping_address.first_name,
					last_name:	req.body.shipping_address.last_name
				};
							
				order.discounts = req.body.discount_codes;
				
				order.dispatch.dropoff = {
					address: {
							street1:	req.body.shipping_address.address1,
							street2:	req.body.shipping_address.address2,
							company:	req.body.shipping_address.company,
							phone:		req.body.shipping_address.phone,
							email:		req.body.contact_email,
							name:			req.body.shipping_address.name,
							city:			req.body.shipping_address.city,
							zip:			req.body.shipping_address.zip,
							state:		req.body.shipping_address.province_code,
							country:	req.body.shipping_address.country_code,
							location:	{
								latitude:		req.body.shipping_address.latitude,
								longitude:	req.body.shipping_address.longitude
							}
					},
					instructions: req.body.note
				};
				
				// pending, dispatching, dispatched, fulfilled, canceled
				order.status = order.status || 'pending';
				if (order.canceled || order.items.length == 0) {
					order.status = 'canceled';
				} else if (order.fulfilled) {
					order.status = 'fulfilled';
				}
				
				// cart attributes
				req.body.note_attributes.forEach(function(attribute) {
					// delivery time (@note) 
					if (['delivery_time', 'deliveryTime'].indexOf(attribute.name) >= 0) {
						order.dispatch.after = moment(attribute.value.trim());
					}
					
					// cutlery
					if (order.status != 'canceled' && attribute.name == 'cutlery' && attribute.value > 0) {
						order.items.push({
							id: 0,
							quantity: attribute.value
						});
					}
					
					// cart type
					if (attribute.name == 'cartType' && attribute.value == 'secondary') {
						cartType = 'secondary';
					}
					
					// tracking secret
					if (attribute.name == 'trackingId') {
						order.tracking.id = attribute.value;
					}
				});
			
				order.save(function(err) {
					if (err) {
						return next(err);
					}
					
					emitOrder(io, order);
					emitSales(io);
					
					res.sendStatus(200);
				});
			});
		}, req.query.create ? 0 : 1000);
	});

	// Sidecar
	router.post('/sidecar', function(req, res, next) {

		if (config.sidecarSecret != req.query.secret) {
			return res.sendStatus(401);
		}
		
		var update = req.body.order_update;
		
		if (!update) {
			return res.status(400).json({ message: 'Missing "order_update".' });
		}
		
		Order.findOne({
			"dispatch.id": update.order_id
		}).exec(function(err, order) {
			if (err) {
				return next(err);
			}
			
			if (!order) {
				return res.status(400).json({ message: 'Order not found.' });
			}
			
			if (update.status) {
				order.dispatch.status = update.status.type;
				
				if (order.status == 'dispatched' && order.dispatch.status == 'otw_active') {
					order.status = 'fulfilled';
					
					// fulfill order @Shopify
					request({
						url: 'https://' + config.shopifyAPI.store + '/admin/orders/' + order.id + '/fulfillments.json',
						method: 'POST',
						headers: {
							'Authorization': 'Basic ' + new Buffer(config.shopifyAPI.key + ':' + config.shopifyAPI.password).toString('base64')
						},
						json: {
							fulfillment: { 
								tracking_number: order.dispatch.id, 
								tracking_url: 'https://delivery.side.cr/shipper/v0/ui/details?id=' + order.dispatch.id + '&api_key=' + config.sidecarKey,
								notify_customer: false 
							} 
						}
					});
					
					// send text notification
					if (order.tracking.notify && order.tracking.id && order.dispatch.eta.dropoff) {
						var text = 'Hi ' + order.customer.first_name + 
											 ', your Mealmade order is on the way and should arrive at ' + moment(order.dispatch.eta.dropoff).tz('America/Los_Angeles').format('h:mma') + '. ' +
											 'Track your delivery, here: http://mealma.de/' + order.number + '-' + order.tracking.id + '. Thanks!';
						
						request({
							url: 'https://www.sendsonar.com/api/v1/messages',
							method: 'POST',
							headers: {
								'X-Token': config.sendsonarKey
							},
							json: {
								to: order.dispatch.dropoff.address.phone,
								text: text
							}
						});
					}
				}
			}
			
			if (update.estimates) {
				order.dispatch.eta.pickup		= update.estimates.pickup_eta || order.dispatch.eta.pickup;
				order.dispatch.eta.dropoff	= update.estimates.dropoff_eta || order.dispatch.eta.dropoff;
			}
			
			if (update.location) {
				order.dispatch.location = update.location;
			}
			
			order.save(function(err) {
				if (err) {
					return next(err);
				}
				
				emitOrder(io, order);
				res.sendStatus(200);
			});
		})
	});
	
	return router;
};

module.exports = routes;