var dna         = require('./lib/dna');
var FASTAReader = require('./lib/FASTAReader/FASTAReader');
var pos2index   = FASTAReader.pos2index;
var idx2pos     = FASTAReader.idx2pos;
var norm_rand   = require('./lib/normal_random');
var XORShift    = require('./lib/xorshift');
var fs          = require('fs');
var pth         = require('path');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;

function main() {
  var contents = '';
  var rstream;

  // stdin detection
  if (process.argv[2] == '-i') {
    process.stdin.resume();
    rstream = process.stdin;
  }

  // arguments
  else if (process.argv[2] == '-a') {
    contents = process.argv[3];
    getConfig();
    return;
  }

  // read from file
  else {
    var config_file = process.argv[2];
    if (!config_file) {
      process.stderr.write('usage: ' +  process.argv[0] + ' ' + process.argv[1] + ' <config file>\n');
      process.stderr.write('usage: cat <config file> | ' +  process.argv[0] + ' ' + process.argv[1] + ' -i\n');
      return false;
    }

    if (!pth.existsSync(config_file)) {
      process.stderr.write(config_file + ': No such file (config file).\n');
      return false;
    }

    rstream = fs.createReadStream(config_file);
  }


  rstream.on('data', function(data) {
    contents += data.toString();
  });

  rstream.on('error', function(e) {
    process.stderr.write(e);
  });

  rstream.on('end', getConfig);

  function getConfig() {
    try {
      var config;
      (function() {
        var __filename = config_file || __filename;
        var __dirname  = pth.dirname(__filename);
        config = eval(
          '('+ contents +')'
        );
      })();

    }
    catch (e) {
      process.stderr.write(e);
      process.stderr.write('\nError. cannot read config file: ' + config_file + '\n');
      return false;
    }
    runWithConfig(config);
  }
}


function runWithConfig(config, nextfunc) {

  if (!pth.existsSync(config.file)) {
    if (!config.file) {
      process.stderr.write('Specify a fasta file with "file" option.\n');
    }
    else {
      process.stderr.write(config.file + ': No such file.\n');
    }
    return false;
  }

  nextfunc = (typeof nextfunc == "function") ? nextfunc : function(files) {
    //console.log(files);
  };
  config.parallel = config.parallel || 1;
  config.spawn    = (config.spawn != null) ? config.spawn : ( (config.parallel == 1) ? false : true); // spawn child process or not
  

  if (!config.spawn) {
    return pairgen(config.file, config);
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
    childConfig.spawn   = false;
    var script = __filename;
    var nodes = [];
    /* spawn multi process */
    for (var i=0; i < config.parallel; i++) {
      childConfig.para_id = (Number(i)+1); 
      nodes[i] = spawn(nodePath, [script, '-a', JSON.stringify(childConfig)]);

      var node = nodes[i];

      //node.stdin.write(JSON.stringify(childConfig));
      //node.stdin.end();

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

              nextfunc({left: catl.filename, right: catr.filename});
            }
          };
          catl.stdout.on('end', onend);
          catr.stdout.on('end', onend);
        }
      });
    }
  }
  function concat(lr) {
    var filename = (config.save_dir || '.') + '/' + (config.name || pth.basename(config.file)) 
    + '_' + ((lr == 'left') ? '1':'2') + '.fastq';
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
  var getFlagmentId = op.getFlagmentId || function(ob) {
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
    process.stderr.write(seq_id + ': No such seq id in .'+ path +'\n');
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
      var flg_id    = getFlagmentId({
        i        : i,
        pos      : startpos,
        pos2     : startpos2,
        distance : distance
      });

      var leftread = fasta.fetch(startpos, readlen);
      var rightread = dna.complStrand(fasta.fetch(startpos2, readlen), true);

      flags.l = left_file.write(flg_id  + '\n' + leftread  + '\n' + '+\n' + qual + '\n');
      flags.r = right_file.write(flg_id + '\n' + rightread + '\n' + '+\n' + qual + '\n');
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


pairgen.run  = runWithConfig;

module.exports = pairgen;

/* execution */
if (process.argv[1] == __filename) {
  main();
}
