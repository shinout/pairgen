#!/bin/sh
node=node
thisdir=$(dirname $0)

echo "{file: '$1', seq_id: 'sample1', save_dir: 'test/result', parallel: 10, name: 'SOME_NAME'}" \
| $node $thisdir/pairgen.js -i
