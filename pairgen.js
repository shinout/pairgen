var SVConst = require('./lib/svgen/SVConst');
var pos2index = SVConst.pos2index;
var idx2pos = SVConst.idx2pos;
var norm_rand = require('./lib/normal_random');
var XORShift = require('./lib/xorshift');
var fs = require('fs');


function getMaxBP(path, prelen, linelen) {
  return idx2pos(fs.statSync(path).size -1 -1, prelen, linelen);// -1: char to idx, -1: remove \n
}

function pairgen(path, op) {
  if (!require('path').existsSync(path)) {
    process.stderr.write(path + ': No such file.');
    return false;
  }
  op = op || {};
  var chrom = op.chrom || 'chr?';
  var name = require('path').basename(path);
  var prelen = op.prelen || 7;
  var linelen = op.linelen || 50;
  var width = op.width || 200;
  var dev = op.dev || 50;
  var readlen = op.readlen || 108;
  var depth = op.depth || 40;
  var parallel = op.parallel || 1;
  var para_id = op.para_id || 1;
  var save_dir = op.save_dir || '.';
  var left_path = op.left_path || getWritePath({lr: 'left'});
  var right_path = op.right_path || getWritePath({lr: 'right'});

  var random = new XORShift(parallel, true);

  var max = getMaxBP(path, prelen, linelen);

  var times = Math.floor(max * depth / (width + 2 * readlen) / parallel);
  var qual = (function(){ var a = ''; for(var i=0; i<readlen; i++){a+='I';} return a;})();

  function getSeqId(ob) {
    return  '@SVGEN_PAIRGEN:'+name+':'+width+':'+dev+':'+new Date().getTime()+':'+(ob.i+1)+'_'+times+':'+depth+':'+ para_id + '_'+ parallel + ':' + chrom +':'+ob.pos +'_'+ob.pos2+':'+ob.wd;
  }

  function getWritePath(op) {
    return save_dir + '/' + name + '_' + para_id + '.' + ((op.lr=='left')?1:2) + '.fastq';
  }

  var fd = fs.openSync(path, 'r');
  var left_file = fs.createWriteStream(left_path, {bufferSize: 40960, encoding: 'utf-8', flags: 'w'});
  var right_file = fs.createWriteStream(right_path, {bufferSize: 40960, encoding: 'utf-8', flags: 'w'});

  var flags = {l: true, r: true};

  left_file.on('drain', function() { 
    flags.l = true;
    makeContig(); 
  });

  right_file.on('drain', function() { 
    flags.r = true;
    makeContig(); 
  });

  var i = 0;
  makeContig();


  function makeContig() {
    while ( i < times) {
      if (!flags.l || !flags.r) { return; }

      
      var wd = Math.floor(norm_rand(width, dev, random) + 0.5);
      var range = max - wd - readlen * 2;
      var startpos = Math.floor(random() * range + 0.5);
      var lstartIdx = pos2index(startpos, prelen, linelen)
      var lendIdx = pos2index(startpos+readlen, prelen, linelen)

      var seq_id = getSeqId({i:i, pos: startpos, pos2: startpos+readlen+wd, wd: wd});
      var leftread = fs.readSync(fd, lendIdx - lstartIdx, lstartIdx)[0].replace(/\n/g, '');

      var rstartIdx = pos2index(startpos+readlen+wd, prelen, linelen)
      var rendIdx = pos2index(startpos+readlen*2+wd, prelen, linelen)
      var rightread = SVConst.complStrand(fs.readSync(fd, rendIdx - rstartIdx, rstartIdx)[0].replace(/\n/g, '')).split('').reverse().join('');

      flags.l = left_file.write(seq_id+'\n'+leftread+'\n'+'+\n'+qual+'\n');
      flags.r = right_file.write(seq_id+'\n'+rightread+'\n'+'+\n'+qual+'\n');
      i++;
    }

    left_file.end();
    right_file.end();
    fs.closeSync(fd);
  }
}

module.exports = pairgen;
