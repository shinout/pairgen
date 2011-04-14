if (process.argv.length < 6) {
  console.log("invalid arguments. node pairgen-exe.js <fasta file> <save_dir> <parallel id> <total parallel num>");
  process.exit();
}

var pairgen = require('./pairgen');

pairgen(process.argv[2], {
  chrom: 'chr11',
  parallel: process.argv[5],
  para_id: process.argv[4],
  save_dir: process.argv[3]
});
