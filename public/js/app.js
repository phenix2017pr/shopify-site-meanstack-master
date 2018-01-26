'use strict';

angular.module('app', [
  'ngCookies',
  'ui.router',
	'ui.bootstrap.showErrors',
	'uiGmapgoogle-maps',
	'app.controllers',
	'app.directives',
	'app.filters',
	'app.services'
])
.config(['$stateProvider', '$urlRouterProvider', '$httpProvider', 'uiGmapGoogleMapApiProvider', 
	function($stateProvider, $urlRouterProvider, $httpProvider, uiGmapGoogleMapApiProvider) {
		
		uiGmapGoogleMapApiProvider.configure({
			libraries: 'geometry,visualization'
		});

		//$httpProvider.interceptors.push('httpInterceptor');
		$urlRouterProvider.when('', '/');
		$urlRouterProvider.otherwise('/');
		
		// public routes
		$stateProvider
			.state('login', {
				url: '/',
				templateUrl: 'login.html',
				controller: 'LoginCtrl'
			})
			.state('recover', {
				url: '/recover/:token',
				templateUrl: 'recover.html',
				controller: 'RecoverCtrl'
			})
			.state('dashboard', {
				url: '/dashboard',
				templateUrl: 'dashboard.html',
				controller: 'DashboardCtrl'
			});
	}
])
.run(['$rootScope', '$cookies', '$state', '$window', 'Account', function($rootScope, $cookies, $state, $window, Account) {
	Account.set($window.user);
		
	$rootScope.$state = $state;
	
	$rootScope.$on('$stateChangeStart', function(event, to, from) {
		var user = Account.get();
		
		jQuery('#favicon').attr('href', user._id ? user.photo : '/favicon.ico'); // a bit crap :(
		
		if (to.name == 'dashboard' && !user._id) {
			event.preventDefault();
			$state.go('login');
			return;
		} 
		
		if (['login', 'reset', 'recover'].indexOf(to.name) != -1 && user._id) {
			event.preventDefault();
			$state.go('dashboard');
			return;
		}
	});
	
	$rootScope.$on('$stateChangeSuccess', function() {
		$window.scrollTo(0, 0);
	});
}]);