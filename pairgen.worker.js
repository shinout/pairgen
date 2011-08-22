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
  const width    = config.width;
  const dev      = config.width;
  const ms       = config.modify_seq;
  const mq       = config.modify_qual;
  const gfid     = config.get_fragment_id;
  const left_id  = config.pair_id[0];
  const right_id = config.pair_id[1];
  const baselen  = end - start + 1;

  const till     = Math.floor(baselen * depth / (2 * config.readlen) / config.parallel + 0.5);

  var i = 0;

  const self = this;
  var timerId = setTimeout(function() {
    var callee = arguments.callee;
    var next = function() { timerId = setTimeout(callee, 0) };
    if (i == till) {
      clearInterval(timerId);
      callback();
      return;
    }

    do {
      var distance = Math.floor(norm_rand(width, dev, random) + 0.5);
      var maxpos    = end - distance - readlen * 2;
    } while (distance < - readlen || maxpos < start || maxpos > end);

    // limit position equals max - distance - readlen * 2
    var startpos  = Math.floor(random() * (maxpos - start) + 0.5) + start;
    var startpos2 = startpos + readlen + distance;
    var flg_id    = gfid.call(self, i, startpos, startpos2, distance);
    var leftread  = ms.call(self, fastas, rname, startpos, readlen).toUpperCase();
    var rightread = dna.complStrand(ms.call(self, fastas, rname, startpos2, readlen).toUpperCase(), true);

    if (fastas.hasN(rname, startpos, readlen)) next();
    if (fastas.hasN(rname, startpos2, readlen)) next();

    var left_written = self.left_file.write(
      '@' + flg_id  + left_id + '\n' + 
      leftread  + '\n' + 
      '+\n' + 
      mq.call(self, qual, leftread) + '\n'
    );

    var right_written = self.right_file.write(
      '@' + flg_id + right_id + '\n' + 
      rightread + '\n' +
      '+\n' + 
      mq.call(self, qual, rightread) + '\n'
    );
    i++;
    next();
  }, 0);
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

