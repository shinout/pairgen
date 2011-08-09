const ArgParser = require('argparser');
const fs        = require('fs');
const Worker    = require('./lib/node-webworker');
const PC        = require('./pairgen.config');
const spawn     = require('child_process').spawn;

function parseIntF(v) {
  var ret = parseInt(v);
  return (isNaN(ret)) ? 0 : ret;
}

function main() {
  const p = new ArgParser();
  p.defaults.valopts = undefined;
  p.addOptions([]).addValueOptions([
    'name','seq_id','width','readlen',
    'dev','depth','save_dir','parallel','pair_id', 'exename']
  ).parse();

  function showUsage() {
    const cmd = p.getOptions('exename') || (process.argv[0] + ' ' + require('path').basename(process.argv[1]));
    console.error('[usage]');
    console.error('\t' + cmd + ' <fasta file>');
    console.error('[options]');
    console.error('\t' + '--name\tname of the sequence. default = basename(path)');
    console.error('\t' + '--seq_id\tid of the sequence determined by FASTA. If null, then uses the first sequence id. default = ' + PC.getDefault('seq_id'));
    console.error('\t' + '--width\tmean pair distance ( width + readlen * 2 == total flagment length ) default = ' + PC.getDefault('width'));
    console.error('\t' + '--readlen\tlength of the read. default = ' + PC.getDefault('readlen'));
    console.error('\t' + '--dev\tstandard deviation of the total fragment length. default = ' + PC.getDefault('dev'));
    console.error('\t' + '--depth\tphysical read depth. default = ' + PC.getDefault('depth'));
    console.error('\t' + '--save_dir\tdirectory to save result. default = ' + PC.getDefault('save_dir'));
    console.error('\t' + '--pair_id <id_type>\tpair id type, put pair information explicitly. id_type is one of A, 1, F, F3.');
    console.error('\t' + '--parallel\tthe number of processes to run. default: ' + PC.getDefault('parallel'));
  }

  if (!p.getArgs(0)) {
    showUsage();
    return false;
  }

  const fastafile = p.getArgs(0);
  try {
    const config = new PC({
      path     : p.getArgs(0),
      name     : p.getOptions('name'),
      seq_id   : p.getOptions('seq_id'),
      width    : p.getOptions('width'),
      readlen  : p.getOptions('readlen'),
      dev      : p.getOptions('dev'),
      depth    : p.getOptions('depth'),
      save_dir : p.getOptions('save_dir'),
      parallel : p.getOptions('parallel'),
      pair_id  : p.getOptions('pair_id')

    });
  }
  catch (e) {
    console.error(e.stack);
    return false;
  }

  fs.mkdirSync(config.tmp_dir, '0755');

  showinfo(config);

  var total_end_count = 0;

  for (var i=0; i<config.parallel; i++) {
    (function(i) {
      var worker = new Worker('pairgen.worker.js');
      
      // REDUCE
      worker.onmessage = function(msg) {
        worker.terminate(0.1);
        total_end_count++;
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
}

function showinfo(config) {
  console.error('#############################');
  console.error('# INPUT INFORMATION');
  console.error('# FASTA FILE         : ' + config.path);
  console.error('# NAME               : ' + config.name);
  console.error('# REFERENCE NAME     : ' + (config.seq_id || '(ALL IN THE FASTA FILE)'));
  console.error('# READ LENGTH        : ' + config.readlen);
  console.error('# MEAN PAIR DISTANCE : ' + config.width);
  console.error('# STDDEV OF DISTANCE : ' + config.dev);
  console.error('# SAVE DIR           : ' + config.save_dir);
  console.error('# PARALLEL           : ' + config.parallel);
  console.error('# DEPTH OF COVERAGE  : ' + config.depth);
  console.error('# SUFFIX OF READS    : ' + "'" + config.pair_id[0] + "', '" + config.pair_id[1] + "'");
  console.error('#############################');
}

/* execution */
if (process.argv[1] == __filename) { main(); }
