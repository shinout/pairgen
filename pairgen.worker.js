const PairgenConfig = require(__dirname + '/pairgen.config');
const XORShift      = require(__dirname + '/lib/xorshift');
const norm_rand     = require(__dirname + '/lib/normal_random');
const dna           = require(__dirname + '/lib/dna');
const FASTAReader   = require(__dirname + '/lib/FASTAReader/FASTAReader');
const Junjo         = require(__dirname + '/lib/Junjo/Junjo');
const fs            = require('fs');

function Pairgen(config) {

  // random [0 -1) function
  this.random = new XORShift(config.para_id, true); // function

  // quality. IIIIIIIIIII............ 
  this.qual   = (function(){ 
    var a = '';
    for(var i = 0, l = config.readlen; i<l; i++) {
      a += 'I';
    } 
    return a;
  })();

  // fastas
  this.fastas = new FASTAReader(config.path);

  // total iteration
  this.config = config;

  /* files to write */
  this.left_file  = fs.createWriteStream(config.tmp_dir + '/left_' + config.para_id, {
    bufferSize: 40960, encoding: 'utf-8', flags: 'w'
  });

  this.right_file = fs.createWriteStream(config.tmp_dir + '/right_' + config.para_id, {
    bufferSize: 40960, encoding: 'utf-8', flags: 'w'
  });

  Object.seal(this);
}

Pairgen.prototype.run = function() {
  var j = new Junjo({timeout: 0});
  var self = this;

  j.on('end', function() {
    self.config.callback(self);
  });

  self.config.ranges.forEach(function(range) {
    j(self.runInOneRange).bind(self, range, j.callback).after();
  });

  j.run();
};

Pairgen.prototype.runInOneRange = function(range, callback) {
  // range is a bed formatted line with depth data in the 4th column
  const rname    = range[0];
  const start    = range[1];
  const end      = range[2];
  const depth    = range[3];

  const random   = this.random;
  const readlen  = this.config.readlen;
  const qual     = this.qual;
  const fastas   = this.fastas;
  const config   = this.config;
  const meanTlen = config.tlen;
  const dev      = config.dev;
  const ms       = config.modify_seq;
  const mq       = config.modify_qual;
  const gfid     = config.get_fragment_id;
  const left_id  = config.pair_id[0];
  const right_id = config.pair_id[1];
  const baselen  = end - start + 1;
  const ad1      = config.p5 + config.adapter1;
  const ad1compl = dna.complStrand(ad1, true); // 3' -> 5'
  const ad2      = config.p7 + config.adapter2;
  const ad2compl = dna.complStrand(ad2, true); // 3' -> 5'
  const para_id  = config.para_id;
  const parallel = config.parallel;

  const till = Math.floor(baselen * depth / (2 * config.readlen) / config.parallel + 0.5);

  var i = 0;

  const self = this;
  (function() {

    function next(fn) {
      i++;
      if (i == till) {
        callback();
      }
      else {
        process.nextTick(fn);
      }
    }

    var tlen = Math.floor(norm_rand(meanTlen, dev, random) + 0.5);
    if (end - tlen < start) { return next(arguments.callee) }

    var pos = Math.floor(random() * (end - tlen - start) + 0.5) + start; // leftside position of template

    if (fastas.hasN(rname, pos, tlen)) { return next(arguments.callee) }

    var template = fastas.fetch(rname, pos, tlen);

    var leftseq  = template + ad2compl;
    var rightseq = dna.complStrand(template, true) + ad1compl;

    if (leftseq.length < readlen || rightseq.length < readlen) { return next(arguments.callee) }

    var frg_id = gfid(rname, start, end, depth,   pos, tlen,   para_id, parallel,    i, till); // fragment id

    var leftread  = ms(leftseq,  readlen);
    var rightread = ms(rightseq, readlen);

    self.left_file.write(
      '@' + frg_id  + left_id + '\n' +
      leftread + '\n' +
      '+\n' + 
      mq(qual, leftread) + '\n'
    );

    self.right_file.write(
      '@' + frg_id  + right_id + '\n' +
      rightread + '\n' +
      '+\n' + 
      mq(qual, rightread) + '\n'
    );

    next(arguments.callee);

  })();
};


onmessage = function(msg) {
  const config = new PairgenConfig(msg.data);
  config.callback = function(pgen) {
    postMessage({});
  };

  var pairgen = new Pairgen(config);
  pairgen.run();
};

onerror = function(e) {
  console.log(e.stack);
  this.close();
};


onclose = function() {
};

