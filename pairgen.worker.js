const PairgenConfig = require(__dirname + '/pairgen.config');
const XORShift      = require(__dirname + '/lib/xorshift');
const norm_rand     = require(__dirname + '/lib/normal_random');
const WSelection    = require(__dirname + '/lib/WeightedSelection');
const dna           = require(__dirname + '/lib/dna');
const FASTAReader   = require(__dirname + '/lib/FASTAReader/FASTAReader');
const fs            = require('fs');

function Pairgen(config, make_contig) {
	const self = this;

  function getWritePath(lr) {
    return config.save_dir + '/' + 
		       config.name + '_' + 
//					 config.para_id + '.' + 
					 ((lr=='left')?1:2) + '.fastq';
  }

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

	// output files
	this.left_path  = getWritePath('left');
	this.right_path = getWritePath('right');

  // weighted selection of rnames
  this.rselect = new WSelection((function(){
    var ret = {};
    Object.keys(self.fastas.result).forEach(function(rname) {
      ret[rname] = self.fastas.result[rname].getEndPos();
    });
    return ret;
  })() , this.random); 

	// total iteration
  this.times  = Math.floor(this.rselect.total() * config.depth / (2 * config.readlen) / config.parallel + 0.5);
	this.config = config;
	this.flags  = {l : true, r : true};


  /* files to write */
  this.left_file  = fs.createWriteStream(this.left_path,  {
		bufferSize: 40960, encoding: 'utf-8', flags: 'a'
	});

  this.right_file = fs.createWriteStream(this.right_path, {
		bufferSize: 40960, encoding: 'utf-8', flags: 'a'
	});


  this.left_file.on('drain', function() { 
    self.flags.l = true;
    self.run(); 
  });

  this.right_file.on('drain', function() { 
    self.flags.r = true;
    self.run(); 
  });

	this.i = 0;
  this.running = false;

	Object.seal(this);
}

Pairgen.prototype.run = function() {
	const width    = this.config.width;
	const dev      = this.config.width;
	const random   = this.random;
	const readlen  = this.config.readlen;
	const rselect  = this.rselect;
	const qual     = this.qual;
	const fastas   = this.fastas;
	const ms       = this.config.modify_seq;
	const mq       = this.config.modify_qual;
	const gfid     = this.config.get_fragment_id;
	const left_id  = this.config.pair_id[0];
	const right_id = this.config.pair_id[1];

  if (this.running) return;
  this.running = true;
	while (this.i < this.times) {
		if (!this.flags.l || !this.flags.r) {
      this.running = false;
      return;
    }

		var rname   = rselect.random();
		var baselen = fastas.result[rname].getEndPos();
    do {
      var distance = Math.floor(norm_rand(width, dev, random) + 0.5);
    } while ( baselen - distance - readlen * 2 <= 0);

		// limit position equals max - distance - readlen * 2
    var range     = baselen - distance - readlen * 2;
    var startpos  = 1 + Math.floor(random() * (range-1) + 0.5);
    var startpos2 = startpos + readlen + distance;
    var flg_id    = gfid.call(this, this.i, startpos, startpos2, distance);
    var leftread  = ms.call(this, fastas, rname, startpos, readlen).toUpperCase();
    var rightread = dna.complStrand(ms.call(this, fastas, rname, startpos2, readlen).toUpperCase(), true);

    if (fastas.hasN(rname, startpos, readlen)) continue;
    if (fastas.hasN(rname, startpos2, readlen)) continue;

    this.flags.l = this.left_file.write(
			'@' + flg_id  + left_id + '\n' + 
			leftread  + '\n' + 
			'+\n' + 
			mq.call(this, qual, leftread) + '\n'
		);

    this.flags.r = this.right_file.write(
			'@' + flg_id + right_id + '\n' + 
			rightread + '\n' +
			'+\n' + 
			mq.call(this, qual, rightread) + '\n'
		);

    this.i++;
	}

	// on end
	this.config.callback(this);
};


onmessage = function(msg) {
  const config = new PairgenConfig(msg.data);
  config.callback = function(pgen) {
    postMessage({
      left  : pgen.left_path,
      right : pgen.right_path
    });
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

