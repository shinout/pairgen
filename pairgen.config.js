const pth    = require('path');
const Struct = require('./lib/Struct/Struct');

PairgenConfig = (function() {
  const _ = new Struct('id');
  const M = _.Modifiers;
  function PairgenConfig(obj) {
    _.construct(this, obj, {seal: true});
  }

  _.defineStruct(PairgenConfig, {
    path : {
      required : true,
      modifier: M.file.bind({normalize: true}),
      enumerable: true,
      immutable: true
    },

    name : {
      modifier : M.string.quiet.bind({min: 1, max: 20}),
      defaultFunc : function() {
        return pth.basename(_(this).path);
      },
      enumerable: true,
      immutable: true
    },

    seq_id : {
      modifier: M.some(M.isNull, M.string),
      enumerable: true,
      immutable: true,
      _default: null
    },

    width : {
      modifier: M.integer.quiet,
      _default: 200,
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

    save_dir : {
      modifier: M.dir.bind({normalize: true}).quiet,
      _default: pth.dirname(process.argv[1]),
      enumerable: true,
      immutable: true
    },

    parallel : {
      modifier: M.integer.bind({min: 1, max: 100}).quiet,
      _default: 1,
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
          case '1':
          case '2':
          case  1 :
          case  2 :
            left_id  = '_1';
            right_id = '_2';
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
        return {
          left  : pairgen.left_path,
          right : pairgen.right_path,
        };
      },
      enumerable: true,
      immutable: true
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    modify_seq : {
      modifier: M.func,
      _default: function(fastas, rname, start, len) {
        return fastas.fetch(rname, start, len);
      },
      enumerable: true,
      immutable: true
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    modify_qual : {
      modifier: M.func,
      _default: function(qual, seq) {
        return qual;
      },
      enumerable: true,
      immutable: true
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    get_fragment_id : {
      modifier: M.func,
      _default: function(i, pos, pos2, distance) {
        return [
          'PAIRGEN',
          this.config.name,
          pos,
          pos2,
          distance,
          i,
          this.config.para_id
        ].join('_');
      },
      enumerable: true,
      immutable: true
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
