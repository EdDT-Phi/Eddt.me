'use strict';
var app = angular.module('resume', []);
// In production, the bundled pdf.js shall be used instead of RequireJS.
require.config({paths: {'pdfjs': 'about/js/pdf'}});

function getJsonFromUrl() {
  var query = location.search.substr(1);
  var result = {};
  query.split("&").forEach(function(part) {
    var item = part.split("=");
    result[item[0]] = decodeURIComponent(item[1]);
  });
  return result;
}


app.controller('resumeCtrl', [
'$scope', '$http',
function($scope, $http){

  $scope.text = true;

  var init = function() {
    displayPDF();
  }

  var mobile = window.innerWidth  < 1000;

  $( window ).resize(function() {
    // $( "#log" ).append( "<div>Handler for .resize() called.</div>" );
    if(mobile && window.innerWidth > 1000) {
      mobile = false;
      displayPDF();
    }
    if(!mobile && window.innerWidth < 1000) {
      mobile = true;
      displayPDF();
    }
  });

  var displayPDF = function() {
    require(['pdfjs/display/api', 'pdfjs/display/global'], function (api, global) {
      // In production, change this to point to the built `pdf.worker.js` file.
      global.PDFJS.workerSrc = '../../src/worker_loader.js';

      // Fetch the PDF document from the URL using promises.
      api.getDocument('about/assets/Eddie_Tribaldos_Resume.pdf').then(function (pdf) {
        // Fetch the page.
        pdf.getPage(1).then(function (page) {

          var scale = 1.5;

          if(mobile) {
            scale = 1;
          }

          var viewport = page.getViewport(scale);

          // Prepare canvas using PDF page dimensions.
          var canvas = document.getElementById('the-canvas');
          var context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render PDF page into canvas context.
          var renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          page.render(renderContext);
        });
      });
    });
  }

  init();
}]);


