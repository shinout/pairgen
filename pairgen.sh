#!/bin/sh
node=node
thisdir=$(dirname $0)

fasta=$1
save_dir=$2
num=10
if [ ! -z $3 ]; then
  num=$3
fi

if [ ! -e $fasta ]; then
  echo "$fasta: No such file."
  exit
fi

if [ ! -d $save_dir ]; then
  echo "$save_dir: No such directory."
  exit
fi

has_seq=$(which seq)
if [ ! -z $has_seq ]; then
  seq="seq 1"
else
  seq="jot"
fi


for item in $($seq $num)
do
  file1=$($node $thisdir/pairgen_filename.js $fasta $save_dir $item $num left)
  file2=$($node $thisdir/pairgen_filename.js $fasta $save_dir $item $num right)
  echo "$node $thisdir/pairgen_exe.js $fasta $save_dir $item $num 1>$file1 2>$file2 &"
  $node $thisdir/pairgen_exe.js $fasta $save_dir $item $num 1>$file1 2>$file2 &
done

