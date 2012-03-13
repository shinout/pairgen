const pth    = require('path');
const Struct = require('shinout.struct');

PairgenConfig = (function() {
  const _ = new Struct('id');
  const M = _.Modifiers;
  function PairgenConfig(obj) {
    _.construct(this, obj, {seal: true});
  }

  _.defineStruct(PairgenConfig, {
    is_worker: {
      modifier   : M.boolean,
      _default   : false,
      enumerable : false,
      immutable  : true
    },

    path : {
      required   : true,
      modifier   : M.file.bind({normalize : true}),
      enumerable : true,
      immutable  : true
    },

    rangebed : {
      modifier   : M.some(M.isNull, M.file.bind({normalize : true})),
      enumerable : true,
      immutable  : true
    },

    name : {
      modifier : M.string.quiet.bind({min: 1, max: 20}),
      defaultFunc : function() {
        return pth.basename(_(this).path);
      },
      enumerable: true,
      immutable: true
    },

    tlen : {
      modifier: M.integer.quiet,
      _default: 400,
      enumerable: true,
      immutable: true
    },

    readlen : {
      modifier: M.integer.bind({min: 10, max: 10000}).quiet,
      _default: 100,
      enumerable: true,
      immutable: true
    },

    dev : {
      modifier: M.number.bind({min: 0}).quiet,
      _default: 50,
      enumerable: true,
      immutable: true
    },

    depth : {
      modifier: M.number.bind({min: 0.01, max: 10000}).quiet,
      _default: 40,
      enumerable: true,
      immutable: true
    },

    ranges : {
      modifier: M.array.quiet,
      _default: [],
      enumerable: true,
      immutable: true
    },

    save_dir : {
      modifier: M.dir.bind({normalize: true}).quiet,
      _default: process.cwd(),
      enumerable: true,
      immutable: true
    },

    tmp_dir : {
      get: function() { 
        if (! _(this).tmp_dir) {
          if (this.is_worker) return undefined;
          const save_dir = this.save_dir;
          var tmp = save_dir + '/.pairgen' + process.pid;
          while (_.Modifiers.dir.quiet(tmp)) {
            tmp += '.' + Math.random();
          }
          _(this).tmp_dir = tmp;
        }
        return _(this).tmp_dir;
      },

      set: function(v) {
        if (this.is_worker) {
          _(this).tmp_dir = _.Modifiers.dir(v);
        }
      },
      enumerable: false,
      required  : true,
      immutable: true
    },

    parallel : {
      modifier: M.integer.bind({min: 1, max: 100}).quiet,
      _default: 1,
      enumerable: true,
      immutable: true
    },

    index_id : {
      modifier: M.integer.bind({min: 0}).quiet,
      _default: 0,
      enumerable: true,
      immutable: true
    },

    pair_id : {
      modifier: function(v) {
        /* pair identifier */
        var left_id, right_id;
        if (v instanceof Array && v.length == 2) {
          return v;
        }

        switch (v) {
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
          case '_':
          case '1':
          case '2':
          case  1 :
          case  2 :
            left_id  = '_1';
            right_id = '_2';
            break;
        case '/':
            left_id  = '/1';
            right_id = '/2';
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
        return [left_id, right_id];
      },
      _default: ['', ''],
      enumerable: true,
      immutable: true,
    },

    para_id : {
      modifier: M.integer,
      enumerable: true,
      immutable: true
    },

    callback : {
      modifier: M.func,
      _default: function(pairgen) {
        return {};
      },
      enumerable: true,
      immutable: true
    },

    modify_seq : {
      modifier: M.func,
      _default: function(seq, len) {
        return seq.slice(0, len);
      },
      enumerable: true,
      immutable: true
    },

    modify_qual : {
      modifier: M.func,
      _default: function(qual, seq) {
        return qual;
      },
      enumerable: true,
      immutable: true
    },

    get_fragment_id : {
      modifier: M.func,
      _default: function(rname, start, end, depth, pos, tlen, rev, para_id, parallel,i, till) {
        var strand = (rev) ? "-" : "+";
        return [
          'PAIRGEN',
          rname + ':' + start + '-' + end + ':' + depth,
          'Po' + pos + '-' + (pos + tlen -1) + ':' + tlen,
          'Pa' + (para_id + 1) + ':' + parallel,
          'St' + strand,
          'It' + i + ':' + till
        ].join('_');
      },
      enumerable: true,
      immutable: true
    },

    p5 : {
      modifier   : M.string.quiet.bind({min : 10}),
      _default   : 'GATCGGAAGAGCGGTTCAGCAGGAATGCCGAG', // 5' -> 3'
      enumerable : true,
      immutable  : true
    },

    p7 : {
      modifier   : M.string.quiet.bind({min : 10}),
      _default   : 'ACACTCTTTCCCTACACGACGCTCTTCCGATCT', // 5' -> 3'
      enumerable : true,
      immutable  : true
    },

    adapter1 : {
      modifier   : M.string.quiet.bind({min : 10}),
      _default   : 'AATGATACGGCGACCACCGAGATCTACACTCTTTCCCTACACGACGCTCTTCCGATCT', // 5' -> 3'
      enumerable : true,
      immutable  : true
    },

    adapter2 : {
      modifier   : M.string.quiet.bind({min : 10}),
      _default   : 'CAAGCAGAAGACGGCATACGAGATCGGTCTCGGCATTCCTGCTGAACCGCTCTTCCGATCT', // 5' -> 3'
      enumerable : true,
      immutable  : true
    },

    allowDup : {
      modifier   : M.boolean,
      _default   : false,
      enumerable : false,
      immutable  : true
    },

    error : {
      modifier   : M.number,
      _default   : 0.2,
      enumerable : false,
      immutable  : true
    }
  });
  return PairgenConfig;
})();

function test() {
  console.log(PairgenConfig.getDefault('depth'));
  var config = new PairgenConfig({path: "pairgen.js"});
  console.log(config.toObject());
  try {
    config.depth = "ABC";
  }
  catch (e) {
    console.log(e.message);
  }
}

if (process.argv[1] == __filename) { test(); }
module.exports = PairgenConfig;
