'use strict';

angular.module('app.directives', [])

.directive('compare', function() {
  return {
    require: 'ngModel',
    scope: {
      otherModelValue: '=compare'
    },
    link: function(scope, element, attributes, ngModel) {
      ngModel.$validators.compare = function(modelValue) {
        return modelValue == scope.otherModelValue;
      };
      scope.$watch('otherModelValue', function() {
        ngModel.$validate();
      });
    }
  };
})

.directive('password', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attributes, ngModel) {
      ngModel.$validators.password = function(modelValue) {
        return modelValue ? /(?=^.{8,45}$)(?=.*\d)(?=.*[!@#$%^&*]+)(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/.test(modelValue) : true;
      };
    }
  };
})

.directive('lowercase', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, modelCtrl) {
      var lowercase = function(inputValue) {
        if (inputValue == undefined) inputValue = '';
        var capitalized = inputValue.toLowerCase();
        if (capitalized !== inputValue) {
          modelCtrl.$setViewValue(capitalized);
          modelCtrl.$render();
        }
        return capitalized;
      }
      modelCtrl.$parsers.push(lowercase);
      lowercase(scope[attrs.ngModel]);
    }
  };
});