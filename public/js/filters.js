'use strict';

angular.module('app.filters', [])

.filter('isEmpty', function () {
	var bar;
	return function (obj) {
		for (bar in obj) {
			if (obj.hasOwnProperty(bar)) {
				return false;
			}
		}
		return true;
	};
})

.filter('orderByStatus', function() {
	return function(items) {
    var filtered = [];
		var priority = { pending: 1, dispatching : 1, dispatched : 1, fulfilled : 2, canceled: 3 };
		
    angular.forEach(items, function(item) {
      filtered.push(item);
    });
		
    filtered.sort(function (a, b) {
			if (priority[a.status] > priority[b.status]) {
				return 1;
			}
			if (priority[a.status] < priority[b.status]) {
				return -1;
			}
			return 0;
    });
		
    return filtered;
	};
})

.filter('tel', function() {
	return function(tel) {
		var t = tel.replace(/[^\d]/g, '');
		if (t.length == 10) {
			return t.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
		}
		return tel;
	};
});
