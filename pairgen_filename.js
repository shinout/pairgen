if (process.argv.length < 7) {
  console.log("invalid arguments. node pairgen-exe.js <fasta file> <save_dir> <parallel id> <total parallel num> <left|right>");
  process.exit();
}

var pairgen = require('./pairgen');

var filename = pairgen.getFileName(process.argv[2], {
  chrom: 'chr11',
  parallel: process.argv[5],
  para_id: process.argv[4],
  save_dir: process.argv[3],
  lr: process.argv[6]
});

console.log(filename);
