'use strict';

angular.module('app.services', ['ngResource', 'btford.socket-io'])
.factory('Account', ['$window', '$resource', function($window, $resource) {
	var account = $resource('/api/account/:action',
									{}, {
										refresh:	{method: 'GET'},
										update:		{method: 'PUT'},
										login:		{method: 'POST',		params: {action: 'auth'}},
										logout:		{method: 'DELETE',	params: {action: 'auth'}},
										recover:	{method: 'POST',		params: {action: 'recover'}},
										reset:		{method: 'PUT',			params: {action: 'recover'}}
									});

	var user = {};
	
	var _error = function(response) {
		return {
			status:		response.status, 
			message:	response.data && response.data.message || "Unexpected error, please try again."
		};
	};

	return {
		set: function(data) {
			user = data;
		},
		
		get: function() {
			return user;
		},
		
		refresh: function(done) {
			return account.refresh(function(response) {
				user = response.user;
				done(null, response);
			}, function(response){
				done(true, _error(response));
			});
		},
		
		update: function(data, done) {
			return account.update(data, function(response) {
				user = response.user;
				done(null, response);
			}, function(response){
				done(true, _error(response));
			});
		},
		
		login: function(data, done) {
			return account.login(data, function(response) {
				user = response.user;
				done(null, response);
			}, function(response){
				done(true, _error(response));
			});
		},
		
		logout: function(done) {
			return account.logout(function(){
				user = {};
				done();
			});
		},
		
		recover: function(data, done) {
			return account.recover(data, function(response) {
				done(null, response);
			}, function(response){
				done(true, _error(response));
			});
		},
		
		reset: function(data, done) {
			return account.reset(data, function(response) {
				if (response.user) {
					user = response.user;
				}
				done(null, response);
			}, function(response){
				done(true, _error(response));
			});
		}		
	}
}])
.factory('Socket', function (socketFactory) {
	var Socket = socketFactory();
	
	Socket.forward('error');
	Socket.forward('pickup');
	Socket.forward('sales');
	Socket.forward('products');
	Socket.forward('orders');
	Socket.forward('orders');

  return Socket;
});