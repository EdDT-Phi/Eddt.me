'use strict';
var angular = require(angular);

// In production, the bundled pdf.js shall be used instead of RequireJS.
require.config({paths: {'pdfjs': 'about/js/pdf'}});
require(['pdfjs/display/api', 'pdfjs/display/global'], function (api, global) {
  // In production, change this to point to the built `pdf.worker.js` file.
  global.PDFJS.workerSrc = '../../src/worker_loader.js';

  // Fetch the PDF document from the URL using promises.
  api.getDocument('about/assets/Eddie_Tribaldos_Resume.pdf').then(function (pdf) {
    // Fetch the page.
    pdf.getPage(1).then(function (page) {

      var scale = 1.5;

      if(window.innerWidth  < 1000) {
        scale = 1;
      }

      console.log(window.innerWidth);
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