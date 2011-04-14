var SVConst = require('./lib/svgen/SVConst');
var pos2index = SVConst.pos2index;
var idx2pos = SVConst.idx2pos;
var random = require('./lib/normal_random');
var fs = require('fs');


function getMaxBP(path, prelen, linelen) {
  if (!require('path').existsSync(path)) {
    return false;
  }
  return idx2pos(fs.statSync(path).size -1 -1, prelen, linelen);// -1: char to idx, -1: remove \n
}

function pairgen(path, op) {
  op = op || {};
  var chrom = op.chrom || 'chr?';
  var prelen = op.prelen || 7;
  var linelen = op.linelen || 50;
  var width = op.width || 200;
  var dev = op.dev || 50;
  var readlen = op.readlen || 100;
  var depth = op.depth || 40;
  var parallel = op.parallel || 1;
  var para_id = op.para_id || 1;
  var max = getMaxBP(path, prelen, linelen);

  var times = Math.floor(max * depth / (width + 2 * readlen) / parallel);
  var fd = fs.openSync(path, 'r');
  var qual = (function(){ var a = ''; for(var i=0; i<readlen; i++){a+='I';} return a;})();

  function getSeqId(ob) {
    return  '@SVGEN_PAIRGEN:'+new Date().getTime()+':'+ob.i+':'+depth+':'+ para_id + '/'+ parallel + ':' + chrom +':'+ob.pos + ':'+ob.wd+':'+ ob.ori;
  }

  for (var i=0; i<times; i++) {
    var wd = Math.floor(random(width, dev) + 0.5);
    var range = max - wd - readlen * 2;
    var startpos = Math.floor(Math.random() * range + 0.5);
    var lstartIdx = pos2index(startpos, prelen, linelen)
    var lendIdx = pos2index(startpos+readlen, prelen, linelen)

    var lseq_id = getSeqId({i:i, pos: startpos, wd: wd, ori: 'L+'});
    console.log(lseq_id);
    var leftread = fs.readSync(fd, lendIdx - lstartIdx, lstartIdx)[0].replace(/\n/g, '');

    var rstartIdx = pos2index(startpos+readlen+wd, prelen, linelen)
    var rendIdx = pos2index(startpos+readlen*2+wd, prelen, linelen)
    var rightread = SVConst.complStrand(fs.readSync(fd, rendIdx - rstartIdx, rstartIdx)[0].replace(/\n/g, '')).split('').reverse().join('');
    var rseq_id = getSeqId({i:i, pos: startpos + readlen + wd, wd: wd, ori: 'R-'});
    console.log(rseq_id);
  }

  fs.closeSync(fd);
}
module.exports = pairgen;
