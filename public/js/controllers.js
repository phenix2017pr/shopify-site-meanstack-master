'use strict';

moment.locale('en', {
	relativeTime : {
		future: "%s",
		past:   "%s",
		s:  "%ds",
		m:  "1m",
		mm: "%dm",
		h:  "1h",
		hh: "%dh",
		d:  "1d",
		dd: "%dd",
		M:  "1mo",
		MM: "%dmo",
		y:  "1yr",
		yy: "%dyr"
	}
});

moment.tz.setDefault('America/Los_Angeles');

moment.fn.hmFromNow = function() {
	var diff = this.diff();
	var h = Math.floor(diff / 3600000);
	var m = Math.round((diff - h * 3600000) / 60000);
	return (h > 0 ? h + 'h ' : '') + (m > 0 ? m + 'm' : '') + (h < 0 ? ' ago' : '');
}

angular.module('app.controllers', [
	'angularMoment', 
	'ui.bootstrap',
	'ngAudio'
])

.controller('LoginCtrl', ['$scope', 'Account', function($scope, Account) {
	$scope.login = function() {
		$scope.processing	= true;
		$scope.alert			= null;
		
		Account.login($scope.user, function(err, response) {
			$scope.processing	= false;
			if (err) {
				$scope.alert = { message: response.message, type: 'danger' };
			} else {
				$scope.$state.go('dashboard');
			}
		})
	};
}])

.controller('RecoverCtrl', ['$scope', 'Account', function($scope, Account) {
	if ($scope.$state.params.token){
		Account.reset({ token: $scope.$state.params.token }, function(err, response) {
			if (err) {
				$scope.mode = 'recover';
				$scope.alert = { message: response.message, type: 'danger' };
			} else {
				$scope.mode = 'reset';
			}
		});
	} else {
		$scope.mode = 'recover';
	}

	$scope.recover = function() {
		$scope.processing	= true;
		$scope.alert			= null;
		
		Account.recover({ email: $scope.email }, function(err, response){
			$scope.processing	= false;
			if (err) {
				$scope.alert = { message: response.message, type: 'danger' };
			} else {
				$scope.alert = { message: response.message, type: 'success' };
			}
		});
	};
      
	$scope.reset = function() {
		$scope.processing	= true;
		$scope.alert			= null;
		
		Account.reset({
			token:		$scope.$state.params.token,
			password:	$scope.password
		}, function(err, response){
			$scope.processing	= false;
			if (err) {
				$scope.alert = { message: response.message, type: 'danger' };
			} else {
				$scope.alert = { message: response.message, type: 'success' };
				if (response.user) {
					$scope.$state.go('dashboard');
				}
			}
		});
	};
}])

.controller('DashboardCtrl', ['$scope', '$window', '$filter', '$timeout', '$interval', '$uibModal', 'Account', 'Socket', 'ngAudio',
	function($scope, $window, $filter, $timeout, $interval, $uibModal, Account, Socket, ngAudio) {
		$scope.user = Account.get();
		$scope.$on('socket:error', function (e, data) {
			$scope.$state.go('login');
		});
		
		$scope.$on('$stateChangeSuccess', Socket.connect);
		$scope.$on('$destroy', Socket.disconnect);
		
		// logout
		$scope.logout = function() {
			Account.logout(function() {
				$scope.$state.go('login');
			});
		};
		
		// edit profile
		$scope.modalProfile = function() {
			$uibModal.open({
				animation: true,
				templateUrl: 'modal/profile.html',
				size: 'sm',
				backdrop: 'static',
				controller: 'ModalProfileCtrl'
			}).result.then(function() {
				$scope.user = Account.get();
			});
		};
		
		// order details modal
		$scope.modalOrderDetails = function(order) {
			$uibModal.open({
				animation: true,
				templateUrl: 'modal/order-details.html',
				size: 'lg',
				controller: 'ModalOrderDetails',
				resolve: {
					order: function() {
						return order;
					},
					pickup: function() {
						return $scope.pickup;
					}
				}
			});
		};
		
		$scope.showLightningBolt = function(date) {
			return Number(moment(date).format('mm')) !== 0;
		};
		
		/**
		 * Receive pickup info
		 */
		$scope.pickup = {};
		
		$scope.$on('socket:pickup', function (e, pickup) {
			$scope.pickup = pickup;
		});
		
		/**
		 * Receive products
		 */
		$scope.products	= {};
		
		function _product(p) { 
			$scope.products[p.id] = { name: p.name, type: p.type }; 
		}
		
		$scope.$on('socket:products', function(e, data) {
			if (angular.isArray(data)) {
				return angular.forEach(data, _product);
			}
			_product(data);
		});
		
		/**
		 * Receive sales
		 */
		$scope.sales = 0;
		
		$scope.$on('socket:sales', function (e, sales) {
			$scope.sales = sales;
		});
		
		/**
		 * Receive orders
		 */
		$scope.orders = [];

		$scope.$on('socket:orders', function (e, data) {
			if (angular.isArray(data)) {
				$scope.orders = data;
			} else {
				$scope.orders = $filter('filter')($scope.orders, function(v, i) { return v.id !== data.id; });
				if (['pending', 'dispatching', 'dispatched'].indexOf(data.status) > -1 || moment().isSame(moment(data.dispatch.after), 'day')) {
					$scope.orders.push(data);
				}
			}
			_refresh();
		});
				
		/**
		 * Refresh stuff
		 */
		$scope.arrive				= {};
		$scope.nextOrders		= {};
		$scope.dispatchASAP	= [];
		
		var nextXmin = { orders: [], items: {} }
			, servXmin = {};

		$interval(_refresh, 5000); // change this
		
		function _serviceStart() {
			var date = moment().hour(16).minute(0).second(0); // default today @16:00
			
			if (moment().day() === 6) {					// Sa
				date.add(2, 'days');
			} else if (moment().day() === 0) {	// Su
				date.add(1, 'days');
			} else if (moment().hour() > 21) {	// after 21
				if (moment().day() === 5) {					// Fr
					date.add(3, 'days');
				} else {														// rest of the week
					date.add(1, 'days');
				}
			}
			return date;
		}

		function _refresh() {
			
			var serviceStart	= _serviceStart()
				, serviceEnd		= moment(serviceStart).hour(21);
			
			// reset
			$scope.now					= moment().utc().format();
			$scope.nowPlus5			= moment().add(5, 'minutes').utc().format();
			$scope.nowPlus10		= moment().add(10, 'minutes').utc().format();
			$scope.serviceStart	= moment(serviceStart).utc().format();
			$scope.dispatchASAP	= [];
			
			// clear
			var arrive	= {};
			var now			= moment();
			var servXmin	= {};

			angular.forEach($scope.orders, function(order) {
				
				if (['fulfilled', 'canceled'].indexOf(order.status) === -1) {
					order.patchETA = moment(order.dispatch.after).add(20, 'minutes').utc().format();
				} else {
					order.patchETA = null;
				}
				
				// delivery interval
				order.dispatch.interval = 
					moment(order.dispatch.after).add(30, 'minutes').format( moment().isSame(moment(order.dispatch.after), 'day') ? 'h:mma' : 'dd, h:mma') 
					+ ' - ' + 
					moment(order.dispatch.after).add(90, 'minutes').format('h:mma')

				
				// nextXmin orders - once an order reaches the nextXmin arr, it stays there (regardless of eta pickup). 
				if (nextXmin.orders.indexOf(order.id) === -1 // does not already exists @nextXmin
						&& ['fulfilled', 'canceled'].indexOf(order.status) === -1 // not fulfilled/cancelled 
						&& moment(order.dispatch.after).diff() <= 0
						) {
					nextXmin.orders.push(order.id);
				}

				// service 30min orders
				if (['fulfilled', 'canceled'].indexOf(order.status) == -1 && moment(order.dispatch.after).diff(serviceStart) <= 2700000) {
					angular.forEach(order.items, function(item) {
						servXmin[item.id] = (servXmin[item.id] || 0) + item.quantity;
					});
				}
				
				// format pickup arrive before/after
				if (order.status == 'dispatched' && !order.dispatch.eta.pickup) {
					var after		= moment(order.dispatch.pickup.arrive_after)
						, before	= moment(order.dispatch.pickup.arrive_before);
			
					if (serviceStart.isSame(now, 'day') && after.isSame(now, 'day')) {
						var format = now >= serviceStart && now <= serviceEnd ? null : 'h:mma';
					} else {
						var format = 'dd, h:mma';
					}
					
					order.dispatch.pickup.format = { 
						before:	before <= now ? 'Now' : (format ? before.format(format) : before.hmFromNow()), 
						after:	after <= now ? 'Now' : (format ? after.format(format) : after.hmFromNow())
					};
				}
				
				// pickup after time for order dispatch & alarm
				if (['pending', 'dispatching'].indexOf(order.status) > -1) {
					arrive[order.id] = {
						selected:	$scope.arrive[order.id] && $scope.arrive[order.id].selected || 0,
						options:	[]
					};
					
					var after		= moment(order.dispatch.after)
						, asap		= now >= after
						, start		= asap ? now : after
						, format	= after.isSame(now, 'day') ? 'h:mma' : 'dd, h:mma';

					if (asap && moment(order.dispatch.after).diff(order.created) <= 1800000) { // ALARM EDIT
						$scope.dispatchASAP.push(order.id);
					}
					
					angular.forEach([15, 20, 25, 30], function(min) {
						var offset = moment(start).add(min, 'minutes');
						arrive[order.id].options.push({
							value:	offset.format(),
							name:		asap ? offset.fromNow() : offset.format(format)
						});
					});
				}
			});
			
			$scope.arrive = arrive; // update
			
			// nextXmin items
			nextXmin.items = {}; // clear
			angular.forEach(nextXmin.orders, function(id, index) {
				var order = $filter('filter')($scope.orders, { id: id }, true)[0];
				if (['fulfilled', 'canceled'].indexOf(order.status) > -1) {
					// order is fulfilled/canceled, remove it from nextXmin.orders
					nextXmin.orders.splice(index, 1);
				} else {
					angular.forEach(order.items, function(item) {
						nextXmin.items[item.id] = (nextXmin.items[item.id] || 0) + item.quantity;
					});
				}
			});
			
			// set nextOrders
			if (serviceStart.diff() > 0) {
				$scope.nextOrders = {
					items: servXmin,
					title: 'FIRST 45 MINS OF SERVICE:',
					noOrders: 'No orders within first 45mins of service'
				};
			} else {
				$scope.nextOrders = {
					items: nextXmin.items,
					title: 'NEXT 15 MINS:',
					noOrders: 'No orders within the next 15mins'
				};
			}
		};
		
		/**
		 * Dispatch alarm
		 */
		var alarm = ngAudio.load('/media/alarm.mp3');
		alarm.loop = true;	
		
		function toggleAlarm() {
			if ($scope.dispatchASAP.length) {
				alarm.play();
			} else {
				alarm.stop();
			}
		};

		$timeout(function() {
			if (!alarm.canPlay) {
				$uibModal.open({
					animation: true,
					templateUrl: 'modal/alarm.html',
					size: 'sm'
				}).result.then(toggleAlarm);
			}
		}, 1000);
		
		$scope.$watch('dispatchASAP', toggleAlarm);
		
		/**
		 * Dispatch order
		 */
		$scope.dispatch = function(order) {
			var status	= order.status;
			var after		= $scope.arrive[order.id].options[$scope.arrive[order.id].selected].value;
				
			order.status = 'dispatching';
			
			Socket.emit('dispatch', {
				id:			order.id,
				interval: {
					after:	after,
					before:	moment(after).add(60, 'minutes').format()
				}
			}, function(err) {
				if (err) {
					order.status = status;
					$window.alert(err);
				}
			});
		};
		
		
		/**
		 * Fulfill order
		 */
		$scope.fulfill = function(order) {
			order.dispatch.status	= 'otw_active';
			
			Socket.emit('fulfill', order.id);
		};
	}
])

.controller('ModalProfileCtrl', ['$scope', '$uibModalInstance', 'Account', function($scope, $uibModalInstance, Account) {
	$scope.processing	= true;
	
	Account.refresh(function(err, response) {
		$scope.processing	= false;
		if (err) {
			$scope.alert = { message: response.message, type: 'danger' };
		} else {
			$scope.user = angular.copy(Account.get());
		}
	});
	
	$scope.cancel = function() {
		$uibModalInstance.dismiss('cancel');
	};
	    
	$scope.edit = function(){
		$scope.processing	= true;
		$scope.alert			= null;
		
		Account.update($scope.user, function(err, response) {
			$scope.processing	= false;
			if (err) {
				$scope.alert = { message: response.message, type: 'danger' };
			} else {
				$uibModalInstance.close();
			}
		});
	};
}])

.controller('ModalOrderDetails', ['$scope', '$uibModalInstance', 'order', 'pickup', function($scope, $uibModalInstance, order, pickup) {
	$scope.order = order;
	$scope.pickup = pickup;
	
	$scope.map = {
		center:		angular.copy(pickup.address.location),
		zoom:			12,
		options:	{
			
		}
	};
	
	function _tel(tel) {
		var t = tel.replace(/[^\d]/g, '');
		if (t.length == 10) {
			return t.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
		}
		return htmlEncode(tel); // !!!
	}
	
	$scope.markers = [{
		id:				'0',
		coords:		pickup.address.location,
		options:	{
			icon: '/media/marker-venue.png'
		}
	}, {
		id:				'1',
		coords:		order.dispatch.dropoff.address.location,
		options:	{
			icon: '/media/marker-customer.png'
		}
	}];
	
	/* if (order.dispatch.status && order.dispatch.status.indexOf('done') === -1 && order.dispatch.location.latitude && order.dispatch.location.longitude) {
		$scope.markers.push({
			id:				'2',
			coords:		order.dispatch.location,
			options:	{
				icon: '/media/marker-driver.png'
			}
		});
	} */
}]);