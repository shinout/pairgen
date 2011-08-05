const dna         = require('./lib/dna');
const FASTAReader = require('./lib/FASTAReader/FASTAReader');
const ArgParser   = require('argparser');
const pos2index   = FASTAReader.pos2index;
const idx2pos     = FASTAReader.idx2pos;
const norm_rand   = require('./lib/normal_random');
const XORShift    = require('./lib/xorshift');
const fs          = require('fs');
const pth         = require('path');
const spawn       = require('child_process').spawn;
const exec        = require('child_process').exec;

function parseIntF(v) {
  var ret = parseInt(v);
  return (isNaN(ret)) ? 0 : ret;
}

function main() {
  const p = new ArgParser().addOptions(['spawn']).addValueOptions([
    'name','seq_id','width','readlen',
    'dev','depth','save_dir','parallel','para_id', 'pair_id', 'exename']
  ).parse();

  function showUsage() {
    const cmd = p.getOptions('exename') || (process.argv[0] + ' ' + require('path').basename(process.argv[1]));
    console.error('[usage]');
    console.error('\t' + cmd + ' <fasta file>');
    console.error('[options]');
    console.error('\t' + '--name\tname of the sequence. default = basename(file)');
    console.error('\t' + '--seq_id\tid of the sequence determined by FASTA. If null, then uses the first sequence id.');
    console.error('\t' + '--width\tmean pair distance ( width + readlen * 2 == total flagment length ) default = 200');
    console.error('\t' + '--readlen\tlength of the read. default = 108');
    console.error('\t' + '--dev\tstandard deviation of the total fragment length. default = 50');
    console.error('\t' + '--depth\tphysical read depth. default = 40');
    console.error('\t' + '--save_dir\tdirectory to save result. default = "."');
    console.error('\t' + '--parallel\tthe number of processes to run. default: 1');
    console.error('\t' + '--pair_id <id_type>\tpair id type, put pair information explicitly. id_type is one of A, 1, F, F3.');
  }

  if (!p.getArgs(0)) {
    showUsage();
    return false;
  }

  if (!pth.existsSync(p.getArgs(0))) {
    process.stderr.write(p.getArgs(0) + ': No such file (fasta file).\n');
    showUsage();
    return false;
  }

  const fastafile = p.getArgs(0);
  const config = {
    name     : p.getOptions('name') || pth.basename(fastafile),
    seq_id   : p.getOptions('seq_id') || null,
    width    : parseIntF(p.getOptions('width')) || 200,
    readlen  : parseIntF(p.getOptions('readlen')) || 108,
    dev      : parseIntF(p.getOptions('dev')) || 50,
    depth    : parseIntF(p.getOptions('depth')) || 40,
    save_dir : p.getOptions('save_dir') || '.',
    parallel : parseIntF(p.getOptions('parallel')) || 1,
    para_id  : parseIntF(p.getOptions('para_id')) || 1,
    pair_id  : p.getOptions('pair_id') || 'n'
  };
  config.spawn = (p.getOptions('spawn')) ? parseIntF(p.getOptions('spawn')) : ( (config.parallel == 1) ? 0 : 1);
  /* pair identifier */
  var left_id, right_id;
  switch (config.pair_id) {
    case 'n':
    default: 
      left_id  = '';
      right_id = '';
      break;
    case 'A':
    case 'B':
      left_id  = '_A';
      right_id = '_B';
      break;
    case '1':
    case '2':
    case  1 :
    case  2 :
      left_id  = '_1';
      right_id = '_2';
      break;
    case 'F':
    case 'R':
      left_id  = '_F';
      right_id = '_R';
      break;
    case 'F3':
    case 'R3':
      left_id  = '_F3';
      right_id = '_R3';
      break;
  }
  config.left_id  = left_id;
  config.right_id = right_id;

  if (!config.spawn) {
    return pairgen(fastafile, config);
  }

  /* multi process spawning */
  else {
    var files = {left: [], right: []}; // for concatinate
    var errflag = false;

    /* get node path */
    var nodePath = process.argv[0];
    var endcount = 0;

    // TODO: make childConfig with deep clone method.
    var childConfig = config;
    childConfig.spawn = 0;
    var script = __filename;
    var nodes = [];
    /* spawn multi process */
    for (var i=0; i < config.parallel; i++) {
      childConfig.para_id = (Number(i)+1);
      // console.error([script, fastafile].concat(ArgParser.getOptionString(childConfig).split(' ').filter(function(v){ return (v!='')})).join(' '));
      nodes[i] = spawn(nodePath, [script, fastafile].concat(ArgParser.getOptionString(childConfig).split(' ').filter(function(v){ return (v!='')})));
      var node = nodes[i];

      node.stdin.on('error', function(e) {
        // catch an error happening in node.stdin.end()
        // console.log(e);
      });

      node.stderr.on('data', function(d) {
        errflag = true;
        console.log(d.toString());
      });

      node.stdout.on('data', function(d) {
        try {
          var arr = JSON.parse(d.toString());
          files.left.push(arr[0]);
          files.right.push(arr[1]);
        } catch (e) {
          console.log(d.toString());
        }
      });

      node.on('exit', function(code, signal) {
        endcount++;
        if (endcount == config.parallel) {
          if (errflag) {
            console.error("error...");
            process.exit();
          }
          var endflag = 0;
          var catl = concat('left');
          var catr = concat('right');
          var onend = function() {
            endflag++;
            if (endflag == 2) {
              // remove temporal data
              if (config.remove !== false) {
                spawn('rm', files.left);
                spawn('rm', files.right);
              }
            }
          };
          catl.stdout.on('end', onend);
          catr.stdout.on('end', onend);
        }
      });
    }
  }
  function concat(lr) {
    var filename = config.save_dir + '/' + config.name + '_' + ((lr == 'left') ? '1':'2') + '.fastq';
    var cat = spawn('cat', files[lr]);
    cat.stdout.pipe(fs.createWriteStream(filename));
    cat.filename = filename;
    return cat;
  }
}


function pairgen(path, op) {
  if (!pth.existsSync(path)) {
    process.stderr.write(path + ': No such file (at pairgen() ).\n');
    return false;
  }
  //console.error(op);

  /* configuration */
  op = op || {};
  var seq_id        = op.seq_id        || null;
  var name          = op.name          || pth.basename(path);
  var width         = op.width         || 200;
  var dev           = op.dev           || 50;
  var readlen       = op.readlen       || 108;
  var depth         = op.depth         || 40;
  var parallel      = op.parallel      || 1;
  var para_id       = op.para_id       || 1;
  var save_dir      = op.save_dir      || '.';
  var left_path     = op.left_path     || getWritePath({lr: 'left'});
  var right_path    = op.right_path    || getWritePath({lr: 'right'});
  var left_id       = op.left_id || '';
  var right_id      = op.right_id|| '';
  var getFragmentId = op.getFragmentId || function(ob) {
    return  '@SVGEN_PAIRGEN:' + name + ':' + width + ':' + dev + ':' + new Date().getTime() +
            ':'+(ob.i+1)+'_'+times+':'+depth+':'+ para_id + '_'+ parallel + 
            ':' + seq_id +':'+ob.pos +'_'+ob.pos2+':'+ob.distance;
  };

  /* non customizable variables */
  var random = new XORShift(parallel, true); // function
  var qual   = (function(){ var a = ''; for(var i = 0; i<readlen; i++){a += 'I';} return a;})();
  var fastas = new FASTAReader(path);

  function getWritePath(op) {
    return save_dir + '/' + name + '_' + para_id + '.' + ((op.lr=='left')?1:2) + '.fastq';
  }

  /* check required */
  if (!seq_id) {
    try {
      seq_id = Object.keys(fastas.result)[0];
    }
    catch (e) {
      process.stderr.write('given fasta file doesn\'t seems to be FASTA format.\n');
      return false;
    }
  }

  if (!fastas.result[seq_id]) {
    process.stderr.write(seq_id + ': No such seq id in '+ path +'\n');
    return false;
  }
  var fasta = fastas.result[seq_id];
  var max   = fasta.getEndPos();
  var times = Math.floor(max * depth / (2 * readlen) / parallel);

  /* files to write */
  var left_file  = fs.createWriteStream(left_path,  {bufferSize: 40960, encoding: 'utf-8', flags: 'w'});
  var right_file = fs.createWriteStream(right_path, {bufferSize: 40960, encoding: 'utf-8', flags: 'w'});
  var flags      = {l: true, r: true};

  left_file.on('drain', function() { 
    flags.l = true;
    makeContig(); 
  });

  right_file.on('drain', function() { 
    flags.r = true;
    makeContig(); 
  });


  /* execute writing */
  var i = 0;
  makeContig();

  function makeContig() {
    while ( i < times) {
      if (!flags.l || !flags.r) { return; }
      
      do {
        var distance  = Math.floor(norm_rand(width, dev, random) + 0.5);
      } while ( max - distance - readlen * 2 <= 0);


      var range     = max - distance - readlen * 2; // limit position equals max - distance - readlen * 2
      var startpos  = 1 + Math.floor(random() * (range-1) + 0.5);
      var startpos2 = startpos + readlen + distance;
      var flg_id    = getFragmentId({
        i        : i,
        pos      : startpos,
        pos2     : startpos2,
        distance : distance
      });

      var leftread = fasta.fetch(startpos, readlen);
      var rightread = dna.complStrand(fasta.fetch(startpos2, readlen), true);

      flags.l = left_file.write(flg_id  + left_id + '\n' + leftread  + '\n' + '+\n' + qual + '\n');
      flags.r = right_file.write(flg_id + right_id + '\n' + rightread + '\n' + '+\n' + qual + '\n');
      i++;
    }

    // on end
    left_file.end();
    right_file.end();

    if (parallel > 1) {
      process.stdout.write(JSON.stringify([left_path, right_path]));
    }
  }
  return true;
}

module.exports = pairgen;

/* execution */
if (process.argv[1] == __filename) {
  main();
}
