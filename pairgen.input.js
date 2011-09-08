const fs          = require('fs');
const path        = require('path');
const Junjo       = require('./lib/Junjo/Junjo');
const FASTAReader = require('./lib/FASTAReader/FASTAReader');
const AP          = require('argparser');
const SortedList  = require('./lib/SortedList');

function main() {
  const p = new AP().parse();
  var bedfile = p.getArgs(0);
  var reference = p.getArgs(1);

  if (!bedfile) {
    console.error('bed file is required.');
    showUsage();
    return;
  }

  if (!reference) {
    console.error('fasta file is required.');
    showUsage();
    return;
  }

  var freader = new FASTAReader(reference);
  var j = read(bedfile, freader);

  j.on('end', function(err, result) {
    if (!err) {
      result.forEach(function(v) {
        console.log(v.join('\t'));
      });
    }
    else {
      console.error(err);
    }
  });

  j.run();

  function showUsage() {
    const cmd = process.argv[0] + ' ' + path.basename(process.argv[1]);
    console.error('[usage]');
    console.error('\t' + cmd + ' <bed file> <fasta file>');
  }
}

function read(bedfile, freader) {
  j = new Junjo({
    firstError: true,
    timeout      : 1
  });

  j(function() {
    if (!bedfile) 
      throw new Error('bed file is not given.');

    if (!(freader instanceof FASTAReader)) 
      throw new Error('FASTAReader is not given.');
  });


  j(path.exists).bind(fs, bedfile, j.callback)
  .firstError(false)
  .after();

  j(function(exists) {
    if (!exists) throw new Error(bedfile+ ' : no such file.');
    fs.readFile(bedfile, this.callback);
  }).after();

  j(function(err, data) {
    data = data.toString();
    var lines= data.split('\n');

    var lists = {}, ret = [];

    lines.forEach(function(line, k) {
      if (!line || line.charAt(0) == '#') return;
      var values = line.split('\t');
      if (values.length < 4) return;
      if (!(freader.result[values[0]] instanceof FASTAReader.FASTA)) return;

      var fasta = freader.result[values[0]];
      var end   = fasta.getEndPos();
      if (values[2] == '*') values[2] = end;

      values[1] = Number(values[1]);
      values[2] = Number(values[2]);
      values[3] = Number(values[3]);

      if (isNaN(values[1]) || isNaN(values[2]) || isNaN(values[3]))
        throw new Error("values in 2nd, 3rd 4th columns must be number. in line " + (k+1));
      if (values[2] > end || values[1] > end || values[1] > values[2])
        throw new Error("start should be smaller than end, and end should be smaller than the total end position. in line " + (k+1));
      if (values[3] < 0) throw new Error("depth must be zero or positive. in line " + (k+1));

      if (!lists[values[0]]) {
        lists[values[0]] = new SortedList(null, {
          filter: function(val, pos) {
            return (this.arr[pos]   == null || (this.arr[pos]   != null && this.arr[pos][2] < val[1])) 
              &&   (this.arr[pos+1] == null || (this.arr[pos+1] != null && val[2] < this.arr[pos+1][1]));
          },
          compare: function(a, b) {
            if (a == null) return -1;
            if (b == null) return  1;
            var c = a[1] - b[1];
            return (c > 0) ? 1 : (c == 0)  ? 0 : -1;
          }
        });
      }
      var list = lists[values[0]];

      var bool = list.insert(values);
      if (!bool) throw new Error("duplication of the region. in line " + (k+1));

      j.emit('bed', values); // future API
      ret.push(values);
      // console.log(values.join('\t'));
    });
    this.out = ret;
  }).after();

  j.catchesAbove(function(e) {
    j.err = e;
    console.error(e.message);
    j.terminate();
  });

  return j;
}

if (process.argv[1] == __filename) { main(); }
module.exports = read;
