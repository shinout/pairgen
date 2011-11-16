pairgen
==========
paired-end NGS simulator

Overview
----------------
### Installation ###
    npm install pairgen 

### Usage ###
#### command line ####
    $ pairgen [options] <fasta file> [<ranges bed file>]

    [options]
      --name  name of the sequence. default = basename(path)
      --readlen length of the read. default = 100
      --tlen  length of the template. default = 400
      --dev standard deviation of the total fragment length. default = 50
      --depth physical read depth. default = 40
      --save_dir  directory to save result. default = /home/shinout/node_modules/pairgen
      --pair_id <id_type> pair id type, put pair information explicitly. id_type is one of A, 1, F, F3.
      --parallel  the number of processes to run. default: 1
      --p5  Illumina P5 adapter. default: GATCGGAAGAGCGGTTCAGCAGGAATGCCGAG
      --p7  Illumina P7 adapter. default: ACACTCTTTCCCTACACGACGCTCTTCCGATCT
      --adapter1  Illumina Sequence Primer#1. default: AATGATACGGCGACCACCGAGATCTACACTCTTTCCCTACACGACGCTCTTCCGATCT
      --adapter2  Illumina Sequence Primer#2. default: CAAGCAGAAGACGGCATACGAGATCGGTCTCGGCATTCCTGCTGAACCGCTCTTCCGATCT
