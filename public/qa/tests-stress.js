var loadtest = require('loadtest');
var expect = require('chai').expect;

suite('Stress tests', function(){

      test('Homepage should handle 50 requests in under a second', function(done){
          var options = {
              url: 'http://localhost:3000/newsletter',
              concurrency: 4,
              maxRequests: 100,
          };
          loadtest.loadTest(options, function(err,result){
            expect(!err);
            expect(result.totalTimeSeconds < 1);
            done();
          });
      });

});
