var pairgen = require('../pairgen');
var test = require('./shinout.test');
var fs = require('fs');
var XORShift = require('../lib/xorshift');
var norm_rand = require('../lib/normal_random');

/* random function */
var rand1 = new XORShift(1, true);
var rand2 = new XORShift(2, true);

var unitotal = 0;
var unidispt = 0;
var normtotal = 0;
var normdispt = 0;

var mathtotal = 0;
var mathdispt= 0;
var N = 1000;

for (var i=1; i< N; i++) {
  var val1 = rand1();
  var val2 = rand2();
  if (val1 == val2) {
    console.log(val1);
    console.log(val2);
  }
  test('ok', val1 != val2, 'two random generator returned the same value.');
  var nval = norm_rand(100, 50, rand1);
  var mval = Math.random();

  unitotal += val1;
  unidispt += val1 * val1;

  normtotal += nval;
  normdispt += nval * nval;

  mathtotal+= mval;
  mathdispt+= mval * mval;
}

var unimean = unitotal / N;
var unidisp = unidispt / N - unimean * unimean;

var normmean = normtotal / N;
var normdisp = normdispt / N - normmean * normmean;

var mathmean = mathtotal / N;
var mathdisp = mathdispt / N - mathmean * mathmean;

console.log(unimean);
console.log(unidisp);
console.log(normmean);
console.log(normdisp);
console.log(mathmean);
console.log(mathdisp);

test('ok', Math.abs(unimean - 0.5) < 0.1, 'mean of (pseudo)uniform distribution is invalid');
test('ok', Math.abs(unidisp - (1/12)) < 0.1, 'dispersion of (pseudo)uniform distribution is invalid');
test('ok', Math.abs(normmean - 100) < 5, 'mean of (pseudo)normal distribution is invalid');
test('ok', Math.abs(Math.sqrt(normdisp) - 50) < 5, 'dispersion of (pseudo)uniform distribution is invalid');

test('result', 'random test');
