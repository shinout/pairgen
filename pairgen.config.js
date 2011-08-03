const pth = require('path');

PairgenConfig = (function() {
  const props = {};
  const curid = 0;

  /**
   * CLASS DEFINITION
   *
   **/
  function PairgenConfig(obj) {
    /**
     * GENERATING UNIQUE ID
     **/
    Object.defineProperty(this, 'id', {
      value    : ++curid,
      writable : false
    });

    props[this.id] = {};

    /**
     * PUTTING VARIABLES
     **/
    Object.keys(PairgenConfig.prototype).forEach(function(k) {
      if (typeof obj[k] !== "undefined") {
        this[k] = obj[k];
      }
    }, this);

    Object.seal(this);

  }

  /**
   * PROPERTIES
   **/
  addProps(PairgenConfig.prototype, {
    path : {
      validate : validatePath,
      required : true
    },

    name : {
      validate : function(v) {
        v = v.toString();
        if (!v) throw new Error('name must be specified.');
        return v;
      },

      get : function() {
        if (_(this).name === undefined) {
          _(this).name = pth.basename(_(this).path);
        }
        return get('name').call(this);
      }
    },

    seq_id : {
      validate : function(v) {
        if (v === null) return null;
        v = v.toString();
        if (!v) throw new Error('name must be specified.');
        return v;
      },
      _default: null
    },

    width : {
      validate: validateInt,
      _default: 200
    },

    readlen : {
      validate: validateInt,
      _default: 100
    },

    dev : {
      validate: validateInt,
      _default: 50
    },

    depth : {
      validate: validateInt,
      _default: 40
    },

    save_dir : {
      validate: validatePath,
      _default: '.'
    },

    parallel : {
      validate: validateInt,
      _default: 1
    },

    pair_id : {
      set : function(v) {
        /* pair identifier */
        var left_id, right_id;
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
        _(this).pair_id  = [left_id, right_id];
      },
      _default: ['', '']
    },

    para_id : {
      validate: validateInt
    },

    callback : {
      validate: validateFunction,
      _default: function(pairgen) {
        return {
          left  : pairgen.left_path,
          right : pairgen.right_path,
        };
      }
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    modify_seq : {
      validate: validateFunction,
      _default: function(fastas, rname, start, len) {
        return fastas.fetch(rname, start, len);
      }
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    modify_qual : {
      validate: validateFunction,
      _default: function(qual, seq) {
        return qual;
      }
    },

    // the "this" of this fucntion is an instance of Pairgen. (not PairgenConfig)
    get_fragment_id : {
      validate: validateFunction,
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
      }
    }

  });


  /** 
   * STUFFS TO SUPPORT PRIVATE VARIABLES IN CLASS.
   * NO NEED TO SEE 
   **/
  function _(o) { return props[o.id] }
  const _defaults = props[0];
  Object.freeze(_defaults);

  function get(property, required) {
    return function() {
      var ret = _(this)[property];
      if (ret !== undefined) return ret 
      if (required) throw new Error(property + ' is required.');
      return _defaults[property];
    };
  }

  function set(property, fn) {
    if (typeof fn == 'function') {
      return function(v) { _(this)[property] = fn.call(this, v); }
    }
    else {
      return function(v) { _(this)[property] = v; }
    }
  }

  function addProps(obj, vals) {
    props[0] = {};
    Object.keys(vals).forEach(function(name) {
      Object.defineProperty(obj, name, {
        get : (typeof vals[name].get === "function") ? vals[name].get : get(name, vals[name].required),
        set : (typeof vals[name].set === "function") ? vals[name].set : set(name, vals[name].validate),
        enumerable : (vals[name].enumerable !== undefined) ? vals[name].enumerable : true,
        configurable : (vals[name].configurable !== undefined) ? vals[name].configurable : true,
      });
      props[0][name] = vals[name]._default;
    });
  }

  /**
   * UTILITY FUNCTIONS
   **/
  function validateInt(v) {
    var ret = parseInt(v);
    if (isNaN(ret) || v === false || v === null || v === undefined) throw new Error("invalid int.");
    return ret;
  }

  function validatePath(v) {
    if (!pth.existsSync(v)) throw new Error(v + ': No such file or directory.');
    return v;
  }

  function validateFunction(v) {
    if (typeof v != "function") throw new Error(v + ' is not a function');
    return v;
  }

  PairgenConfig._defaults = _defaults;

  PairgenConfig.prototype.toHash = function() {
    var ret = {};
    Object.keys(PairgenConfig.prototype).forEach(function(k) {
      ret[k] = this[k];
    }, this);
    return ret;
  };

  return PairgenConfig;
})();



function test() {
  var config = new PairgenConfig({name :"shinout", path: "pairgen.js"});
  console.log(config.path);
  console.log(config.name);
  console.log(config.save_dir);
  console.log(config.depth);
  try {
    config.depth = "unko";
  }
  catch (e) {
    console.log(e.message);
  }
}

if (process.argv[1] == __filename) { test(); }
module.exports = PairgenConfig;
