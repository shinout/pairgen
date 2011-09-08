const ArgParser   = require('argparser');
const fs          = require('fs');
const Worker      = require('./lib/node-webworker');
const PC          = require('./pairgen.config');
const spawn       = require('child_process').spawn;
const FASTAReader = require('./lib/FASTAReader/FASTAReader');
const cl          = require('./lib/termcolor').define();

function parseIntF(v) {
  var ret = parseInt(v);
  return (isNaN(ret)) ? 0 : ret;
}

function main() {
  const p = new ArgParser();
  p.defaults.valopts = undefined;
  p.addOptions([]).addValueOptions([
    'name','width','readlen', 'tlen',
    'dev','depth','save_dir','parallel','pair_id', 'exename',
    'p5', 'p7', 'adapter1', 'adapter2'
  ]).parse();

  function showUsage() {
    const cmd = p.getOptions('exename') || (process.argv[0] + ' ' + require('path').basename(process.argv[1]));
    console.error('[usage]');
    console.error('\t' + cmd + ' <fasta file> [<ranges bed file>]');
    console.error('[options]');
    console.error('\t' + '--name\tname of the sequence. default = basename(path)');
    console.error('\t' + '--readlen\tlength of the read. default = ' + PC.getDefault('readlen'));
    console.error('\t' + '--tlen\tlength of the template. default = ' + PC.getDefault('tlen'));
    console.error('\t' + '--dev\tstandard deviation of the total fragment length. default = ' + PC.getDefault('dev'));
    console.error('\t' + '--depth\tphysical read depth. default = ' + PC.getDefault('depth'));
    console.error('\t' + '--save_dir\tdirectory to save result. default = ' + PC.getDefault('save_dir'));
    console.error('\t' + '--pair_id <id_type>\tpair id type, put pair information explicitly. id_type is one of A, 1, F, F3.');
    console.error('\t' + '--parallel\tthe number of processes to run. default: ' + PC.getDefault('parallel'));
    console.error('\t' + '--p5\tIllumina P5 adapter. default: ' + PC.getDefault('p5'));
    console.error('\t' + '--p7\tIllumina P7 adapter. default: ' + PC.getDefault('p7'));
    console.error('\t' + '--adapter1\tIllumina Sequence Primer#1. default: ' + PC.getDefault('adapter1'));
    console.error('\t' + '--adapter2\tIllumina Sequence Primer#2. default: ' + PC.getDefault('adapter2'));
  }

  if (!p.getArgs(0)) {
    showUsage();
    return false;
  }

  const fastafile = p.getArgs(0);
  try {
    if (p.getOptions('width')) {
      throw new Error('"width" is the deprecated option. Use tlen, which stands for template length ( width + 2 * readlen).');
    }
    const config = new PC({
      path     : p.getArgs(0),
      rangebed : p.getArgs(1),
      name     : p.getOptions('name'),
      tlen     : p.getOptions('tlen'),
      readlen  : p.getOptions('readlen'),
      dev      : p.getOptions('dev'),
      depth    : p.getOptions('depth'),
      save_dir : p.getOptions('save_dir'),
      parallel : p.getOptions('parallel'),
      pair_id  : p.getOptions('pair_id'),
      p5       : p.getOptions('p5'),
      p7       : p.getOptions('p7'),
      adapter1 : p.getOptions('adapter1'),
      adapter2 : p.getOptions('adapter2')
    });
  }
  catch (e) {
    console.error(e.stack);
    return false;
  }

  const freader = new FASTAReader(fastafile);
  if (config.rangebed) {
    const read = require('./pairgen.input');
    var $j = read(config.rangebed, freader);
  }
  else {
    var $j = new (require('./lib/Junjo/Junjo'))();
    $j(function(){
      var ranges = [];
      Object.keys(freader.result).forEach(function(rname) {
        var fasta = freader.result[rname];
        ranges.push([
          rname,
          1,
          fasta.getEndPos(),
          config.depth
        ]);
      });
      this.out = ranges;
    });
  }

  $j.on('end', function(err, ranges) {
    if (err) {
      console.error("terminated with errors.");
      return;
    }
    config.ranges = ranges || [];

    fs.mkdirSync(config.tmp_dir, '0755');

    showinfo(config);

    var total_end_count = 0;
    Worker.sockdir = config.tmp_dir;

    var totalFailCounts = {};
    ranges.forEach(function(range, rangeId) {
      totalFailCounts[rangeId] = [0, 0];
    });

    for (var i=0; i<config.parallel; i++) {
      (function(i) {
        var worker = new Worker('pairgen.worker.js');
        
        // REDUCE
        worker.onmessage = function(msg) {
          var failcounts = msg.data;
          worker.terminate(0.1);
          total_end_count++;
          Object.keys(failcounts).forEach(function(rangeId) {
            totalFailCounts[rangeId][0] += failcounts[rangeId][0];
            totalFailCounts[rangeId][1] += failcounts[rangeId][1];
          });
          if (total_end_count < config.parallel) return;

          var lefts  = [];
          var rights = [];
          for (var i=0; i<config.parallel; i++) {
            lefts.push(config.tmp_dir + '/left_' + i);
            rights.push(config.tmp_dir + '/right_' + i);
          }

          function filepath(lr) {
            return config.save_dir + '/' + 
                   config.name + '_' + 
                   ((lr=='l')?1:2) + '.fastq';
          }

          var finflag = 0;
          function write_end() {
            finflag++;
            if (finflag < 2) return;
            spawn('rm', ['-rf', config.tmp_dir]); // TODO recursive rmdir.

            // report output information
            console.error('#############################');
            console.error('# OUTPUT INFORMATION');
            // actural depth
            Object.keys(totalFailCounts).forEach(function(rangeId) {
              var range = ranges[rangeId];
              var depth = range[3], newdepth = depth;
              var numer = totalFailCounts[rangeId][0];
              var denom = totalFailCounts[rangeId][1];
              if (denom) {
                var newdepth = Math.floor(depth * (denom - numer) / denom * 10) / 10;
              }
              if (newdepth < depth) newdepth = cl.red(newdepth); 
              range.push(newdepth);
              console.error('# ' + range.join('\t'));
            });
            console.error('#############################');
          }

          var catleft  = spawn('cat', lefts);
          var catright = spawn('cat', rights);
          var lwrite = fs.createWriteStream(filepath('l'));
          var rwrite = fs.createWriteStream(filepath('r'));

          catleft.stdout.pipe(lwrite);
          catright.stdout.pipe(rwrite);

          catright.stdout.on('end', write_end);

          catleft.stdout.on('end', write_end);

          lwrite.on('end', write_end);
          rwrite.on('end', write_end);
        }; // worker.onmessage

        var conf4worker = config.toObject(true);
        conf4worker.is_worker = true;
        conf4worker.para_id = i;

        // MAP
        worker.postMessage(conf4worker);
      })(i);
    }
  });

  $j.run();
}

function showinfo(config) {
  const hasRanges = config.rangebed;
  console.error('#############################');
  console.error('# INPUT INFORMATION');
  console.error('# FASTA FILE         : ' + cl.green(config.path));
  console.error('# NAME               : ' + cl.green(config.name));
  console.error('# REFERENCE NAME     : ' + ((hasRanges) ? cl.green('(ALL IN THE BED FILE)') :cl.blue('(ALL IN THE FASTA FILE)')));
  console.error('# READ LENGTH        : ' + config.readlen);
  console.error('# TEMPLATE LENGTH    : ' + config.tlen);
  console.error('# STDDEV OF DISTANCE : ' + config.dev);
  console.error('# RANGES FILE        : ' + (config.rangebed ? cl.green(config.rangebed) : cl.red('not given')));
  console.error('# SAVE DIR           : ' + cl.green(config.save_dir));
  console.error('# PARALLEL           : ' + config.parallel);
  console.error('# DEPTH OF COVERAGE  : ' + ((hasRanges) ? cl.blue('(DEPENDS ON EACH RANGE DATA)') : config.depth));
  console.error('# SUFFIX OF READS    : ' + "'" + config.pair_id[0] + "', '" + config.pair_id[1] + "'");
  console.error('# P5 ADAPTER         : ' + config.p5);
  console.error('# P7 ADAPTER         : ' + config.p7);
  console.error('# PRIMER SEQUENCE 1  : ' + config.adapter1);
  console.error('# PRIMER SEQUENCE 2  : ' + config.adapter2);
  console.error('#############################');
}

/* execution */
if (process.argv[1] == __filename) { main(); }
