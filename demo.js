(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

/* global requestAnimationFrame */

var shell = require("gl-now")()
var mat4 =require("gl-mat4")
var Geometry = require('gl-geometry')
var normals = require('normals')
var glShader = require('gl-shader')
var bunny = require('bunny')

var vec3 = require('gl-vec3')
var createMovableCamera = require('../')

var createText = require('gl-sprite-text')
var createBasicShader = require('gl-basic-shader')
var Lato = require('bmfont-lato/32')

var camera = createMovableCamera( {position: vec3.fromValues(-30.0, 12.0, -7.0), viewDir: vec3.fromValues(0.71, -0.21, 0) } );

var shader, bunnyGeom, program

var text, textOrtho=mat4.create(), textTranslate=mat4.create(), textProgram;

shell.on("gl-init", function() {
    var gl = shell.gl;

    gl.enable(gl.DEPTH_TEST)

    /*
    Create buny geometry
     */

    bunnyGeom = Geometry(gl)
    bunnyGeom.attr('aPosition', bunny.positions)
    bunnyGeom.attr('aNormal', normals.vertexNormals(bunny.cells, bunny.positions))
    bunnyGeom.faces(bunny.cells)

    /*
    Load geometry shaders.
     */

    var vertSource = `
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

varying vec3 vNormal;

uniform mat4 uProjection;
uniform mat4 uView;

void main() {
  vNormal = aNormal;

  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}
`;

    var fragSource =
        `
precision mediump float;

varying vec3 vNormal;

void main() {
    vec3 rabbitColor = vec3(0.7);
    // do phong lighting with diffuse and ambient term. 
    gl_FragColor =vec4(0.7 * rabbitColor + dot(vNormal, vec3(0.71, 0.71, 0) ) * rabbitColor, 1.0);
}
`;

    program = glShader(gl, vertSource, fragSource);


    //build our text
    text = createText(gl, {
        font: Lato,
        text: 'Hello, World! Some\nmulti-line text for you.',
        //we can word-wrap like so:
        // wrapWidth: 140
    })

    /*
    Create text shader.
     */
    textProgram = createBasicShader(gl, {
        color: true,
        texcoord: true
    })

})

shell.on("gl-render", function(t) {

    var gl = shell.gl

    gl.clearColor(0.0, 0.4, 0.7, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    /*
     Render geometry
     */

    program.bind()

    var scratch = mat4.create()
    program.uniforms.uProjection = mat4.perspective(scratch, Math.PI/4.0, shell.width/shell.height, 0.1, 1000.0)
    program.uniforms.uView = camera.view()

    bunnyGeom.bind(program)
    bunnyGeom.draw()


    /*
    Render text
     */

    //this is necessary since our image is semi-transparent!
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    mat4.ortho(textOrtho, 0, shell.width, shell.height, 0, 0, 1)

    //gl-basic-shader gives us some matrices we can use
    textProgram.bind()
    textProgram.uniforms.projection = textOrtho

    //get bounds of text after we've adjusted all its params
    var bounds = text.getBounds()

    //here we're translating the text in a shader
    mat4.identity(textTranslate)
    mat4.translate(textTranslate, textTranslate, [10, 10-bounds.y, 0])
    textProgram.uniforms.model = textTranslate



    //Draws from upper-left corner of text box.
    //text.draw(textProgram)



    gl.disable(gl.BLEND)




})

shell.on("tick", function() {
    if(shell.wasDown("mouse-left")) {
        camera.turn(  -(shell.mouseX - shell.prevMouseX), (shell.mouseY - shell.prevMouseY) );
    }

    if(shell.wasDown("W")) {
        camera.walk(true);
    } else if(shell.wasDown("S")) {
        camera.walk(false);
    }

    if(shell.wasDown("A")) {
        camera.stride(true);
    } else if(shell.wasDown("D")) {
        camera.stride(false);
    }

    if(shell.wasDown("O")) {
        camera.fly(true);
    } else if(shell.wasDown("L")) {
        camera.fly(false);
    }

    if(shell.wasDown("M")) {
        camera.velocity = 2.5;
    } else {
        camera.velocity = 0.5;
    }
})
},{"../":2,"bmfont-lato/32":10,"bunny":12,"gl-basic-shader":32,"gl-geometry":37,"gl-mat4":49,"gl-now":64,"gl-shader":96,"gl-sprite-text":106,"gl-vec3":124,"normals":176}],2:[function(require,module,exports){
/**
 * Created by eric on 11/04/16.
 */


var vec3 = require('gl-vec3')
var rotateVectorAboutAxis = require('rotate-vector-about-axis')
var mat4 = require('gl-mat4')

module.exports = createMovableCamera

function MovableCamera (opts) {

    opts = opts || {}

    this.position = opts.position || vec3.fromValues(0,0,0);
    this.viewDir = opts.viewDir || vec3.fromValues(-1,0,0);

    // up vector
    this.up = vec3.fromValues(0,1,0);

    // right vector.
    this.right = vec3.create();
    vec3.cross(this.right, this.up, this.viewDir);
    vec3.normalize(this.right, this.right);

    this.turningVelocity = 0.01;
    this.velocity = 0.5;

    this.view = function(out) {

        if(!out) out = mat4.create();

        var cameraTarget = vec3.create();
        vec3.add(cameraTarget, this.position, this.viewDir );

        mat4.lookAt(out, this.position, cameraTarget, this.up )

        return out;
    }

    this.turn = function(
        head, pitch) {

        // rotate about up vector.
        this.viewDir = rotateVectorAboutAxis( this.viewDir,  this.up, head * this.turningVelocity)

        // rotate about right vector.
        this.viewDir = rotateVectorAboutAxis( this.viewDir, this.right , pitch * this.turningVelocity)

        // update right vector.
        vec3.cross(this.right, this.up, this.viewDir );
        vec3.normalize(this.right, this.right);
    }

    this.walk = function(
        walkForward) {

        var walkDir = vec3.create();
        vec3.copy(walkDir, this.viewDir);

        var walkAmount = this.velocity;
        if(!walkForward) {
            walkAmount *= -1; // walk backwards instead.
        }

        vec3.scale(walkDir, walkDir, walkAmount);

        vec3.add(this.position, this.position, walkDir);
    }

    this.stride = function(
        strideRight) {

        var strideDir = vec3.create();
        vec3.copy(strideDir, this.right);

        var strideAmount = this.velocity;
        if(!strideRight) {
            strideAmount *= -1; // walk right instead.
        }

        vec3.scale(strideDir, strideDir, strideAmount);

        vec3.add(this.position, this.position, strideDir);
    }

    this.fly = function(
        flyUp) {

        var flyDir = vec3.create();
        vec3.copy(flyDir, this.up);

        var flyAmount = this.velocity;
        if(!flyUp) {
            flyAmount *= -1; // fly down instead.
        }

        vec3.scale(flyDir, flyDir, flyAmount);

        vec3.add(this.position, this.position, flyDir);
    }
}

function createMovableCamera (opts) {
    return new MovableCamera(opts)
}

},{"gl-mat4":49,"gl-vec3":124,"rotate-vector-about-axis":197}],3:[function(require,module,exports){
var padLeft = require('pad-left')

module.exports = addLineNumbers
function addLineNumbers (string, start, delim) {
  start = typeof start === 'number' ? start : 1
  delim = delim || ': '

  var lines = string.split(/\r?\n/)
  var totalDigits = String(lines.length + start - 1).length
  return lines.map(function (line, i) {
    var c = i + start
    var digits = String(c).length
    var prefix = padLeft(c, totalDigits - digits)
    return prefix + delim + line
  }).join('\n')
}

},{"pad-left":4}],4:[function(require,module,exports){
/*!
 * pad-left <https://github.com/jonschlinkert/pad-left>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT license.
 */

'use strict';

var repeat = require('repeat-string');

module.exports = function padLeft(str, num, ch) {
  ch = typeof ch !== 'undefined' ? (ch + '') : ' ';
  return repeat(ch, num) + str;
};
},{"repeat-string":196}],5:[function(require,module,exports){
var dtype = require('dtype')

module.exports = pack

function pack(arr, type) {
  type = type || 'float32'

  if (!arr[0] || !arr[0].length) {
    return arr
  }

  var Arr = typeof type === 'string'
    ? dtype(type)
    : type

  var dim = arr[0].length
  var out = new Arr(arr.length * dim)
  var k = 0

  for (var i = 0; i < arr.length; i++)
  for (var j = 0; j < dim; j++) {
    out[k++] = arr[i][j]
  }

  return out
}

},{"dtype":6}],6:[function(require,module,exports){
(function (Buffer){
module.exports = function(dtype) {
  switch (dtype) {
    case 'int8':
      return Int8Array
    case 'int16':
      return Int16Array
    case 'int32':
      return Int32Array
    case 'uint8':
      return Uint8Array
    case 'uint16':
      return Uint16Array
    case 'uint32':
      return Uint32Array
    case 'float32':
      return Float32Array
    case 'float64':
      return Float64Array
    case 'array':
      return Array
    case 'uint8_clamped':
      return Uint8ClampedArray
    case 'generic':
    case 'data':
    case 'dataview':
      return ArrayBuffer
    case 'buffer':
      if (typeof Buffer === "undefined") return ArrayBuffer
      return Buffer
  }
}

}).call(this,require("buffer").Buffer)
},{"buffer":211}],7:[function(require,module,exports){
module.exports = function _atob(str) {
  return atob(str)
}

},{}],8:[function(require,module,exports){
"use strict"

function compileSearch(funcName, predicate, reversed, extraArgs, useNdarray, earlyOut) {
  var code = [
    "function ", funcName, "(a,l,h,", extraArgs.join(","),  "){",
earlyOut ? "" : "var i=", (reversed ? "l-1" : "h+1"),
";while(l<=h){\
var m=(l+h)>>>1,x=a", useNdarray ? ".get(m)" : "[m]"]
  if(earlyOut) {
    if(predicate.indexOf("c") < 0) {
      code.push(";if(x===y){return m}else if(x<=y){")
    } else {
      code.push(";var p=c(x,y);if(p===0){return m}else if(p<=0){")
    }
  } else {
    code.push(";if(", predicate, "){i=m;")
  }
  if(reversed) {
    code.push("l=m+1}else{h=m-1}")
  } else {
    code.push("h=m-1}else{l=m+1}")
  }
  code.push("}")
  if(earlyOut) {
    code.push("return -1};")
  } else {
    code.push("return i};")
  }
  return code.join("")
}

function compileBoundsSearch(predicate, reversed, suffix, earlyOut) {
  var result = new Function([
  compileSearch("A", "x" + predicate + "y", reversed, ["y"], false, earlyOut),
  compileSearch("B", "x" + predicate + "y", reversed, ["y"], true, earlyOut),
  compileSearch("P", "c(x,y)" + predicate + "0", reversed, ["y", "c"], false, earlyOut),
  compileSearch("Q", "c(x,y)" + predicate + "0", reversed, ["y", "c"], true, earlyOut),
"function dispatchBsearch", suffix, "(a,y,c,l,h){\
if(a.shape){\
if(typeof(c)==='function'){\
return Q(a,(l===undefined)?0:l|0,(h===undefined)?a.shape[0]-1:h|0,y,c)\
}else{\
return B(a,(c===undefined)?0:c|0,(l===undefined)?a.shape[0]-1:l|0,y)\
}}else{\
if(typeof(c)==='function'){\
return P(a,(l===undefined)?0:l|0,(h===undefined)?a.length-1:h|0,y,c)\
}else{\
return A(a,(c===undefined)?0:c|0,(l===undefined)?a.length-1:l|0,y)\
}}}\
return dispatchBsearch", suffix].join(""))
  return result()
}

module.exports = {
  ge: compileBoundsSearch(">=", false, "GE"),
  gt: compileBoundsSearch(">", false, "GT"),
  lt: compileBoundsSearch("<", true, "LT"),
  le: compileBoundsSearch("<=", true, "LE"),
  eq: compileBoundsSearch("-", true, "EQ", true)
}

},{}],9:[function(require,module,exports){
/**
 * Bit twiddling hacks for JavaScript.
 *
 * Author: Mikola Lysenko
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 */

"use strict"; "use restrict";

//Number of bits in an integer
var INT_BITS = 32;

//Constants
exports.INT_BITS  = INT_BITS;
exports.INT_MAX   =  0x7fffffff;
exports.INT_MIN   = -1<<(INT_BITS-1);

//Returns -1, 0, +1 depending on sign of x
exports.sign = function(v) {
  return (v > 0) - (v < 0);
}

//Computes absolute value of integer
exports.abs = function(v) {
  var mask = v >> (INT_BITS-1);
  return (v ^ mask) - mask;
}

//Computes minimum of integers x and y
exports.min = function(x, y) {
  return y ^ ((x ^ y) & -(x < y));
}

//Computes maximum of integers x and y
exports.max = function(x, y) {
  return x ^ ((x ^ y) & -(x < y));
}

//Checks if a number is a power of two
exports.isPow2 = function(v) {
  return !(v & (v-1)) && (!!v);
}

//Computes log base 2 of v
exports.log2 = function(v) {
  var r, shift;
  r =     (v > 0xFFFF) << 4; v >>>= r;
  shift = (v > 0xFF  ) << 3; v >>>= shift; r |= shift;
  shift = (v > 0xF   ) << 2; v >>>= shift; r |= shift;
  shift = (v > 0x3   ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

//Computes log base 10 of v
exports.log10 = function(v) {
  return  (v >= 1000000000) ? 9 : (v >= 100000000) ? 8 : (v >= 10000000) ? 7 :
          (v >= 1000000) ? 6 : (v >= 100000) ? 5 : (v >= 10000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

//Counts number of bits
exports.popCount = function(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

//Counts number of trailing zeros
function countTrailingZeros(v) {
  var c = 32;
  v &= -v;
  if (v) c--;
  if (v & 0x0000FFFF) c -= 16;
  if (v & 0x00FF00FF) c -= 8;
  if (v & 0x0F0F0F0F) c -= 4;
  if (v & 0x33333333) c -= 2;
  if (v & 0x55555555) c -= 1;
  return c;
}
exports.countTrailingZeros = countTrailingZeros;

//Rounds to next power of 2
exports.nextPow2 = function(v) {
  v += v === 0;
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

//Rounds down to previous power of 2
exports.prevPow2 = function(v) {
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v - (v>>>1);
}

//Computes parity of word
exports.parity = function(v) {
  v ^= v >>> 16;
  v ^= v >>> 8;
  v ^= v >>> 4;
  v &= 0xf;
  return (0x6996 >>> v) & 1;
}

var REVERSE_TABLE = new Array(256);

(function(tab) {
  for(var i=0; i<256; ++i) {
    var v = i, r = i, s = 7;
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    tab[i] = (r << s) & 0xff;
  }
})(REVERSE_TABLE);

//Reverse bits in a 32 bit word
exports.reverse = function(v) {
  return  (REVERSE_TABLE[ v         & 0xff] << 24) |
          (REVERSE_TABLE[(v >>> 8)  & 0xff] << 16) |
          (REVERSE_TABLE[(v >>> 16) & 0xff] << 8)  |
           REVERSE_TABLE[(v >>> 24) & 0xff];
}

//Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes
exports.interleave2 = function(x, y) {
  x &= 0xFFFF;
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;

  y &= 0xFFFF;
  y = (y | (y << 8)) & 0x00FF00FF;
  y = (y | (y << 4)) & 0x0F0F0F0F;
  y = (y | (y << 2)) & 0x33333333;
  y = (y | (y << 1)) & 0x55555555;

  return x | (y << 1);
}

//Extracts the nth interleaved component
exports.deinterleave2 = function(v, n) {
  v = (v >>> n) & 0x55555555;
  v = (v | (v >>> 1))  & 0x33333333;
  v = (v | (v >>> 2))  & 0x0F0F0F0F;
  v = (v | (v >>> 4))  & 0x00FF00FF;
  v = (v | (v >>> 16)) & 0x000FFFF;
  return (v << 16) >> 16;
}


//Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes
exports.interleave3 = function(x, y, z) {
  x &= 0x3FF;
  x  = (x | (x<<16)) & 4278190335;
  x  = (x | (x<<8))  & 251719695;
  x  = (x | (x<<4))  & 3272356035;
  x  = (x | (x<<2))  & 1227133513;

  y &= 0x3FF;
  y  = (y | (y<<16)) & 4278190335;
  y  = (y | (y<<8))  & 251719695;
  y  = (y | (y<<4))  & 3272356035;
  y  = (y | (y<<2))  & 1227133513;
  x |= (y << 1);
  
  z &= 0x3FF;
  z  = (z | (z<<16)) & 4278190335;
  z  = (z | (z<<8))  & 251719695;
  z  = (z | (z<<4))  & 3272356035;
  z  = (z | (z<<2))  & 1227133513;
  
  return x | (z << 2);
}

//Extracts nth interleaved component of a 3-tuple
exports.deinterleave3 = function(v, n) {
  v = (v >>> n)       & 1227133513;
  v = (v | (v>>>2))   & 3272356035;
  v = (v | (v>>>4))   & 251719695;
  v = (v | (v>>>8))   & 4278190335;
  v = (v | (v>>>16))  & 0x3FF;
  return (v<<22)>>22;
}

//Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page)
exports.nextCombination = function(v) {
  var t = v | (v - 1);
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1));
}


},{}],10:[function(require,module,exports){
module.exports = {"pages":["lato.png"],"chars":[{"id":10,"x":185,"y":424,"width":17,"height":24,"xoffset":0,"yoffset":8,"xadvance":17,"page":0,"chnl":0},{"id":32,"x":0,"y":0,"width":0,"height":0,"xoffset":0,"yoffset":0,"xadvance":6,"page":0,"chnl":0},{"id":33,"x":40,"y":438,"width":5,"height":24,"xoffset":3,"yoffset":8,"xadvance":11,"page":0,"chnl":0},{"id":34,"x":71,"y":437,"width":9,"height":8,"xoffset":2,"yoffset":8,"xadvance":13,"page":0,"chnl":0},{"id":35,"x":355,"y":194,"width":18,"height":24,"xoffset":0,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":36,"x":247,"y":277,"width":16,"height":31,"xoffset":1,"yoffset":5,"xadvance":19,"page":0,"chnl":0},{"id":37,"x":330,"y":194,"width":23,"height":24,"xoffset":1,"yoffset":8,"xadvance":25,"page":0,"chnl":0},{"id":38,"x":375,"y":194,"width":22,"height":24,"xoffset":1,"yoffset":8,"xadvance":23,"page":0,"chnl":0},{"id":39,"x":40,"y":207,"width":3,"height":8,"xoffset":2,"yoffset":8,"xadvance":7,"page":0,"chnl":0},{"id":40,"x":103,"y":353,"width":7,"height":31,"xoffset":2,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":41,"x":139,"y":480,"width":7,"height":31,"xoffset":1,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":42,"x":82,"y":437,"width":11,"height":11,"xoffset":1,"yoffset":7,"xadvance":13,"page":0,"chnl":0},{"id":43,"x":204,"y":399,"width":16,"height":16,"xoffset":1,"yoffset":13,"xadvance":19,"page":0,"chnl":0},{"id":44,"x":40,"y":464,"width":5,"height":9,"xoffset":1,"yoffset":28,"xadvance":7,"page":0,"chnl":0},{"id":45,"x":79,"y":277,"width":9,"height":3,"xoffset":1,"yoffset":20,"xadvance":11,"page":0,"chnl":0},{"id":46,"x":40,"y":217,"width":5,"height":4,"xoffset":1,"yoffset":28,"xadvance":7,"page":0,"chnl":0},{"id":47,"x":247,"y":220,"width":14,"height":26,"xoffset":-1,"yoffset":8,"xadvance":12,"page":0,"chnl":0},{"id":48,"x":310,"y":194,"width":18,"height":24,"xoffset":0,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":49,"x":204,"y":424,"width":14,"height":24,"xoffset":3,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":50,"x":185,"y":450,"width":16,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":51,"x":203,"y":450,"width":17,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":52,"x":185,"y":476,"width":18,"height":24,"xoffset":0,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":53,"x":205,"y":476,"width":16,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":54,"x":236,"y":194,"width":17,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":55,"x":255,"y":194,"width":17,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":56,"x":274,"y":194,"width":16,"height":24,"xoffset":1,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":57,"x":292,"y":194,"width":16,"height":24,"xoffset":2,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":58,"x":449,"y":84,"width":5,"height":17,"xoffset":2,"yoffset":15,"xadvance":8,"page":0,"chnl":0},{"id":59,"x":87,"y":198,"width":5,"height":22,"xoffset":2,"yoffset":15,"xadvance":8,"page":0,"chnl":0},{"id":60,"x":219,"y":336,"width":13,"height":16,"xoffset":2,"yoffset":13,"xadvance":19,"page":0,"chnl":0},{"id":61,"x":147,"y":98,"width":15,"height":8,"xoffset":2,"yoffset":17,"xadvance":19,"page":0,"chnl":0},{"id":62,"x":203,"y":380,"width":14,"height":16,"xoffset":3,"yoffset":13,"xadvance":19,"page":0,"chnl":0},{"id":63,"x":220,"y":424,"width":13,"height":24,"xoffset":0,"yoffset":8,"xadvance":13,"page":0,"chnl":0},{"id":64,"x":247,"y":248,"width":25,"height":27,"xoffset":1,"yoffset":9,"xadvance":26,"page":0,"chnl":0},{"id":65,"x":315,"y":108,"width":22,"height":24,"xoffset":0,"yoffset":8,"xadvance":22,"page":0,"chnl":0},{"id":66,"x":76,"y":283,"width":17,"height":24,"xoffset":2,"yoffset":8,"xadvance":21,"page":0,"chnl":0},{"id":67,"x":339,"y":108,"width":20,"height":24,"xoffset":1,"yoffset":8,"xadvance":22,"page":0,"chnl":0},{"id":68,"x":361,"y":108,"width":21,"height":24,"xoffset":2,"yoffset":8,"xadvance":24,"page":0,"chnl":0},{"id":69,"x":78,"y":318,"width":15,"height":24,"xoffset":2,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":70,"x":78,"y":367,"width":15,"height":24,"xoffset":2,"yoffset":8,"xadvance":18,"page":0,"chnl":0},{"id":71,"x":384,"y":108,"width":21,"height":24,"xoffset":1,"yoffset":8,"xadvance":23,"page":0,"chnl":0},{"id":72,"x":407,"y":108,"width":20,"height":24,"xoffset":2,"yoffset":8,"xadvance":24,"page":0,"chnl":0},{"id":73,"x":32,"y":262,"width":4,"height":24,"xoffset":3,"yoffset":8,"xadvance":10,"page":0,"chnl":0},{"id":74,"x":498,"y":49,"width":12,"height":24,"xoffset":0,"yoffset":8,"xadvance":14,"page":0,"chnl":0},{"id":75,"x":429,"y":108,"width":19,"height":24,"xoffset":3,"yoffset":8,"xadvance":22,"page":0,"chnl":0},{"id":76,"x":96,"y":415,"width":14,"height":24,"xoffset":2,"yoffset":8,"xadvance":16,"page":0,"chnl":0},{"id":77,"x":450,"y":108,"width":25,"height":24,"xoffset":2,"yoffset":8,"xadvance":29,"page":0,"chnl":0},{"id":78,"x":477,"y":108,"width":20,"height":24,"xoffset":2,"yoffset":8,"xadvance":24,"page":0,"chnl":0},{"id":79,"x":113,"y":480,"width":24,"height":24,"xoffset":1,"yoffset":8,"xadvance":26,"page":0,"chnl":0},{"id":80,"x":371,"y":142,"width":16,"height":24,"xoffset":3,"yoffset":8,"xadvance":20,"page":0,"chnl":0},{"id":81,"x":389,"y":142,"width":25,"height":29,"xoffset":1,"yoffset":8,"xadvance":26,"page":0,"chnl":0},{"id":82,"x":416,"y":142,"width":18,"height":24,"xoffset":3,"yoffset":8,"xadvance":21,"page":0,"chnl":0},{"id":83,"x":371,"y":168,"width":16,"height":24,"xoffset":0,"yoffset":8,"xadvance":17,"page":0,"chnl":0},{"id":84,"x":436,"y":142,"width":19,"height":24,"xoffset":0,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":85,"x":436,"y":168,"width":19,"height":24,"xoffset":2,"yoffset":8,"xadvance":23,"page":0,"chnl":0},{"id":86,"x":457,"y":142,"width":22,"height":24,"xoffset":0,"yoffset":8,"xadvance":22,"page":0,"chnl":0},{"id":87,"x":185,"y":310,"width":33,"height":24,"xoffset":0,"yoffset":8,"xadvance":33,"page":0,"chnl":0},{"id":88,"x":457,"y":168,"width":21,"height":24,"xoffset":0,"yoffset":8,"xadvance":21,"page":0,"chnl":0},{"id":89,"x":481,"y":142,"width":21,"height":24,"xoffset":0,"yoffset":8,"xadvance":20,"page":0,"chnl":0},{"id":90,"x":416,"y":168,"width":18,"height":24,"xoffset":1,"yoffset":8,"xadvance":20,"page":0,"chnl":0},{"id":91,"x":174,"y":387,"width":7,"height":31,"xoffset":2,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":92,"x":263,"y":220,"width":14,"height":26,"xoffset":-1,"yoffset":8,"xadvance":12,"page":0,"chnl":0},{"id":93,"x":223,"y":476,"width":7,"height":31,"xoffset":1,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":94,"x":319,"y":95,"width":14,"height":11,"xoffset":2,"yoffset":8,"xadvance":19,"page":0,"chnl":0},{"id":95,"x":76,"y":309,"width":13,"height":3,"xoffset":0,"yoffset":34,"xadvance":13,"page":0,"chnl":0},{"id":96,"x":32,"y":236,"width":7,"height":5,"xoffset":0,"yoffset":8,"xadvance":10,"page":0,"chnl":0},{"id":97,"x":78,"y":344,"width":14,"height":17,"xoffset":1,"yoffset":15,"xadvance":16,"page":0,"chnl":0},{"id":98,"x":96,"y":441,"width":15,"height":24,"xoffset":2,"yoffset":8,"xadvance":18,"page":0,"chnl":0},{"id":99,"x":237,"y":84,"width":14,"height":17,"xoffset":1,"yoffset":15,"xadvance":15,"page":0,"chnl":0},{"id":100,"x":96,"y":467,"width":15,"height":24,"xoffset":1,"yoffset":8,"xadvance":18,"page":0,"chnl":0},{"id":101,"x":255,"y":84,"width":15,"height":17,"xoffset":1,"yoffset":15,"xadvance":17,"page":0,"chnl":0},{"id":102,"x":499,"y":108,"width":11,"height":24,"xoffset":0,"yoffset":8,"xadvance":11,"page":0,"chnl":0},{"id":103,"x":481,"y":168,"width":16,"height":23,"xoffset":0,"yoffset":15,"xadvance":16,"page":0,"chnl":0},{"id":104,"x":218,"y":247,"width":14,"height":24,"xoffset":2,"yoffset":8,"xadvance":18,"page":0,"chnl":0},{"id":105,"x":38,"y":262,"width":5,"height":24,"xoffset":2,"yoffset":8,"xadvance":8,"page":0,"chnl":0},{"id":106,"x":86,"y":149,"width":8,"height":30,"xoffset":-1,"yoffset":8,"xadvance":8,"page":0,"chnl":0},{"id":107,"x":218,"y":273,"width":15,"height":24,"xoffset":2,"yoffset":8,"xadvance":17,"page":0,"chnl":0},{"id":108,"x":41,"y":341,"width":4,"height":24,"xoffset":2,"yoffset":8,"xadvance":8,"page":0,"chnl":0},{"id":109,"x":382,"y":85,"width":23,"height":17,"xoffset":2,"yoffset":15,"xadvance":26,"page":0,"chnl":0},{"id":110,"x":433,"y":84,"width":14,"height":17,"xoffset":2,"yoffset":15,"xadvance":18,"page":0,"chnl":0},{"id":111,"x":389,"y":173,"width":16,"height":17,"xoffset":1,"yoffset":15,"xadvance":18,"page":0,"chnl":0},{"id":112,"x":496,"y":83,"width":15,"height":23,"xoffset":2,"yoffset":15,"xadvance":18,"page":0,"chnl":0},{"id":113,"x":185,"y":336,"width":15,"height":23,"xoffset":1,"yoffset":15,"xadvance":18,"page":0,"chnl":0},{"id":114,"x":272,"y":84,"width":11,"height":17,"xoffset":2,"yoffset":15,"xadvance":13,"page":0,"chnl":0},{"id":115,"x":96,"y":493,"width":13,"height":17,"xoffset":0,"yoffset":15,"xadvance":14,"page":0,"chnl":0},{"id":116,"x":499,"y":168,"width":12,"height":23,"xoffset":0,"yoffset":9,"xadvance":12,"page":0,"chnl":0},{"id":117,"x":202,"y":336,"width":15,"height":17,"xoffset":1,"yoffset":15,"xadvance":18,"page":0,"chnl":0},{"id":118,"x":185,"y":361,"width":17,"height":17,"xoffset":0,"yoffset":15,"xadvance":16,"page":0,"chnl":0},{"id":119,"x":204,"y":361,"width":25,"height":17,"xoffset":0,"yoffset":15,"xadvance":25,"page":0,"chnl":0},{"id":120,"x":185,"y":380,"width":16,"height":17,"xoffset":0,"yoffset":15,"xadvance":16,"page":0,"chnl":0},{"id":121,"x":185,"y":399,"width":17,"height":23,"xoffset":0,"yoffset":15,"xadvance":16,"page":0,"chnl":0},{"id":122,"x":220,"y":310,"width":13,"height":17,"xoffset":1,"yoffset":15,"xadvance":15,"page":0,"chnl":0},{"id":123,"x":236,"y":220,"width":9,"height":31,"xoffset":0,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":124,"x":91,"y":99,"width":3,"height":31,"xoffset":3,"yoffset":7,"xadvance":10,"page":0,"chnl":0},{"id":125,"x":236,"y":253,"width":8,"height":31,"xoffset":1,"yoffset":6,"xadvance":10,"page":0,"chnl":0},{"id":126,"x":78,"y":393,"width":16,"height":6,"xoffset":1,"yoffset":19,"xadvance":19,"page":0,"chnl":0}],"kernings":[{"first":34,"second":38,"amount":-4},{"first":34,"second":44,"amount":-5},{"first":34,"second":45,"amount":-4},{"first":34,"second":46,"amount":-5},{"first":34,"second":47,"amount":-4},{"first":34,"second":64,"amount":-2},{"first":34,"second":65,"amount":-4},{"first":34,"second":67,"amount":-2},{"first":34,"second":71,"amount":-2},{"first":34,"second":79,"amount":-2},{"first":34,"second":81,"amount":-2},{"first":34,"second":86,"amount":1},{"first":34,"second":87,"amount":1},{"first":34,"second":92,"amount":1},{"first":34,"second":97,"amount":-2},{"first":34,"second":99,"amount":-2},{"first":34,"second":100,"amount":-2},{"first":34,"second":101,"amount":-2},{"first":34,"second":111,"amount":-2},{"first":34,"second":113,"amount":-2},{"first":39,"second":38,"amount":-4},{"first":39,"second":44,"amount":-5},{"first":39,"second":45,"amount":-4},{"first":39,"second":46,"amount":-5},{"first":39,"second":47,"amount":-4},{"first":39,"second":64,"amount":-2},{"first":39,"second":65,"amount":-4},{"first":39,"second":67,"amount":-2},{"first":39,"second":71,"amount":-2},{"first":39,"second":79,"amount":-2},{"first":39,"second":81,"amount":-2},{"first":39,"second":86,"amount":1},{"first":39,"second":87,"amount":1},{"first":39,"second":92,"amount":1},{"first":39,"second":97,"amount":-2},{"first":39,"second":99,"amount":-2},{"first":39,"second":100,"amount":-2},{"first":39,"second":101,"amount":-2},{"first":39,"second":111,"amount":-2},{"first":39,"second":113,"amount":-2},{"first":40,"second":64,"amount":-2},{"first":40,"second":67,"amount":-2},{"first":40,"second":71,"amount":-2},{"first":40,"second":79,"amount":-2},{"first":40,"second":81,"amount":-2},{"first":40,"second":99,"amount":-2},{"first":40,"second":100,"amount":-2},{"first":40,"second":101,"amount":-2},{"first":40,"second":111,"amount":-2},{"first":40,"second":113,"amount":-2},{"first":42,"second":38,"amount":-4},{"first":42,"second":44,"amount":-5},{"first":42,"second":45,"amount":-4},{"first":42,"second":46,"amount":-5},{"first":42,"second":47,"amount":-4},{"first":42,"second":64,"amount":-2},{"first":42,"second":65,"amount":-4},{"first":42,"second":67,"amount":-2},{"first":42,"second":71,"amount":-2},{"first":42,"second":79,"amount":-2},{"first":42,"second":81,"amount":-2},{"first":42,"second":86,"amount":1},{"first":42,"second":87,"amount":1},{"first":42,"second":92,"amount":1},{"first":42,"second":97,"amount":-2},{"first":42,"second":99,"amount":-2},{"first":42,"second":100,"amount":-2},{"first":42,"second":101,"amount":-2},{"first":42,"second":111,"amount":-2},{"first":42,"second":113,"amount":-2},{"first":44,"second":34,"amount":-5},{"first":44,"second":39,"amount":-5},{"first":44,"second":42,"amount":-5},{"first":44,"second":45,"amount":-3},{"first":44,"second":64,"amount":-2},{"first":44,"second":67,"amount":-2},{"first":44,"second":71,"amount":-2},{"first":44,"second":79,"amount":-2},{"first":44,"second":81,"amount":-2},{"first":44,"second":84,"amount":-4},{"first":44,"second":86,"amount":-4},{"first":44,"second":87,"amount":-3},{"first":44,"second":89,"amount":-3},{"first":44,"second":92,"amount":-4},{"first":44,"second":118,"amount":-3},{"first":44,"second":119,"amount":-2},{"first":44,"second":121,"amount":-3},{"first":45,"second":34,"amount":-4},{"first":45,"second":38,"amount":-2},{"first":45,"second":39,"amount":-4},{"first":45,"second":42,"amount":-4},{"first":45,"second":44,"amount":-3},{"first":45,"second":46,"amount":-3},{"first":45,"second":47,"amount":-2},{"first":45,"second":65,"amount":-2},{"first":45,"second":84,"amount":-4},{"first":45,"second":86,"amount":-3},{"first":45,"second":87,"amount":-2},{"first":45,"second":88,"amount":-2},{"first":45,"second":89,"amount":-4},{"first":45,"second":90,"amount":-2},{"first":45,"second":92,"amount":-3},{"first":46,"second":34,"amount":-5},{"first":46,"second":39,"amount":-5},{"first":46,"second":42,"amount":-5},{"first":46,"second":45,"amount":-3},{"first":46,"second":64,"amount":-2},{"first":46,"second":67,"amount":-2},{"first":46,"second":71,"amount":-2},{"first":46,"second":79,"amount":-2},{"first":46,"second":81,"amount":-2},{"first":46,"second":84,"amount":-4},{"first":46,"second":86,"amount":-4},{"first":46,"second":87,"amount":-3},{"first":46,"second":89,"amount":-3},{"first":46,"second":92,"amount":-4},{"first":46,"second":118,"amount":-3},{"first":46,"second":119,"amount":-2},{"first":46,"second":121,"amount":-3},{"first":47,"second":34,"amount":1},{"first":47,"second":38,"amount":-3},{"first":47,"second":39,"amount":1},{"first":47,"second":42,"amount":1},{"first":47,"second":44,"amount":-4},{"first":47,"second":45,"amount":-3},{"first":47,"second":46,"amount":-4},{"first":47,"second":47,"amount":-3},{"first":47,"second":58,"amount":-2},{"first":47,"second":59,"amount":-2},{"first":47,"second":63,"amount":1},{"first":47,"second":64,"amount":-2},{"first":47,"second":65,"amount":-3},{"first":47,"second":67,"amount":-2},{"first":47,"second":71,"amount":-2},{"first":47,"second":74,"amount":-3},{"first":47,"second":79,"amount":-2},{"first":47,"second":81,"amount":-2},{"first":47,"second":97,"amount":-3},{"first":47,"second":99,"amount":-3},{"first":47,"second":100,"amount":-3},{"first":47,"second":101,"amount":-3},{"first":47,"second":103,"amount":-3},{"first":47,"second":109,"amount":-2},{"first":47,"second":110,"amount":-2},{"first":47,"second":111,"amount":-3},{"first":47,"second":112,"amount":-2},{"first":47,"second":113,"amount":-3},{"first":47,"second":114,"amount":-2},{"first":47,"second":115,"amount":-3},{"first":47,"second":116,"amount":-2},{"first":47,"second":117,"amount":-2},{"first":47,"second":118,"amount":-2},{"first":47,"second":120,"amount":-2},{"first":47,"second":121,"amount":-2},{"first":47,"second":122,"amount":-2},{"first":64,"second":34,"amount":-2},{"first":64,"second":38,"amount":-2},{"first":64,"second":39,"amount":-2},{"first":64,"second":41,"amount":-2},{"first":64,"second":42,"amount":-2},{"first":64,"second":44,"amount":-2},{"first":64,"second":46,"amount":-2},{"first":64,"second":47,"amount":-2},{"first":64,"second":65,"amount":-2},{"first":64,"second":84,"amount":-3},{"first":64,"second":86,"amount":-2},{"first":64,"second":89,"amount":-2},{"first":64,"second":90,"amount":-2},{"first":64,"second":92,"amount":-2},{"first":64,"second":93,"amount":-2},{"first":64,"second":125,"amount":-2},{"first":65,"second":34,"amount":-4},{"first":65,"second":39,"amount":-4},{"first":65,"second":42,"amount":-4},{"first":65,"second":45,"amount":-2},{"first":65,"second":63,"amount":-2},{"first":65,"second":64,"amount":-2},{"first":65,"second":67,"amount":-2},{"first":65,"second":71,"amount":-2},{"first":65,"second":74,"amount":1},{"first":65,"second":79,"amount":-2},{"first":65,"second":81,"amount":-2},{"first":65,"second":84,"amount":-3},{"first":65,"second":85,"amount":-2},{"first":65,"second":86,"amount":-3},{"first":65,"second":87,"amount":-2},{"first":65,"second":89,"amount":-4},{"first":65,"second":92,"amount":-3},{"first":65,"second":118,"amount":-2},{"first":65,"second":121,"amount":-2},{"first":67,"second":45,"amount":-3},{"first":68,"second":34,"amount":-2},{"first":68,"second":38,"amount":-2},{"first":68,"second":39,"amount":-2},{"first":68,"second":41,"amount":-2},{"first":68,"second":42,"amount":-2},{"first":68,"second":44,"amount":-2},{"first":68,"second":46,"amount":-2},{"first":68,"second":47,"amount":-2},{"first":68,"second":65,"amount":-2},{"first":68,"second":84,"amount":-3},{"first":68,"second":86,"amount":-2},{"first":68,"second":89,"amount":-2},{"first":68,"second":90,"amount":-2},{"first":68,"second":92,"amount":-2},{"first":68,"second":93,"amount":-2},{"first":68,"second":125,"amount":-2},{"first":70,"second":38,"amount":-3},{"first":70,"second":44,"amount":-4},{"first":70,"second":46,"amount":-4},{"first":70,"second":47,"amount":-3},{"first":70,"second":58,"amount":-2},{"first":70,"second":59,"amount":-2},{"first":70,"second":65,"amount":-3},{"first":70,"second":74,"amount":-4},{"first":70,"second":99,"amount":-2},{"first":70,"second":100,"amount":-2},{"first":70,"second":101,"amount":-2},{"first":70,"second":109,"amount":-2},{"first":70,"second":110,"amount":-2},{"first":70,"second":111,"amount":-2},{"first":70,"second":112,"amount":-2},{"first":70,"second":113,"amount":-2},{"first":70,"second":114,"amount":-2},{"first":70,"second":117,"amount":-2},{"first":74,"second":38,"amount":-2},{"first":74,"second":44,"amount":-2},{"first":74,"second":46,"amount":-2},{"first":74,"second":47,"amount":-2},{"first":74,"second":65,"amount":-2},{"first":75,"second":45,"amount":-2},{"first":75,"second":99,"amount":-2},{"first":75,"second":100,"amount":-2},{"first":75,"second":101,"amount":-2},{"first":75,"second":102,"amount":-2},{"first":75,"second":111,"amount":-2},{"first":75,"second":113,"amount":-2},{"first":75,"second":116,"amount":-2},{"first":75,"second":118,"amount":-2},{"first":75,"second":119,"amount":-2},{"first":75,"second":121,"amount":-2},{"first":76,"second":34,"amount":-6},{"first":76,"second":39,"amount":-6},{"first":76,"second":42,"amount":-6},{"first":76,"second":44,"amount":1},{"first":76,"second":45,"amount":-4},{"first":76,"second":46,"amount":1},{"first":76,"second":63,"amount":-2},{"first":76,"second":64,"amount":-2},{"first":76,"second":67,"amount":-2},{"first":76,"second":71,"amount":-2},{"first":76,"second":79,"amount":-2},{"first":76,"second":81,"amount":-2},{"first":76,"second":84,"amount":-4},{"first":76,"second":86,"amount":-4},{"first":76,"second":87,"amount":-3},{"first":76,"second":89,"amount":-4},{"first":76,"second":92,"amount":-4},{"first":76,"second":99,"amount":-2},{"first":76,"second":100,"amount":-2},{"first":76,"second":101,"amount":-2},{"first":76,"second":111,"amount":-2},{"first":76,"second":113,"amount":-2},{"first":76,"second":118,"amount":-3},{"first":76,"second":119,"amount":-2},{"first":76,"second":121,"amount":-3},{"first":79,"second":34,"amount":-2},{"first":79,"second":38,"amount":-2},{"first":79,"second":39,"amount":-2},{"first":79,"second":41,"amount":-2},{"first":79,"second":42,"amount":-2},{"first":79,"second":44,"amount":-2},{"first":79,"second":46,"amount":-2},{"first":79,"second":47,"amount":-2},{"first":79,"second":65,"amount":-2},{"first":79,"second":84,"amount":-3},{"first":79,"second":86,"amount":-2},{"first":79,"second":89,"amount":-2},{"first":79,"second":90,"amount":-2},{"first":79,"second":92,"amount":-2},{"first":79,"second":93,"amount":-2},{"first":79,"second":125,"amount":-2},{"first":80,"second":38,"amount":-3},{"first":80,"second":44,"amount":-5},{"first":80,"second":46,"amount":-5},{"first":80,"second":47,"amount":-3},{"first":80,"second":65,"amount":-3},{"first":80,"second":74,"amount":-4},{"first":80,"second":97,"amount":-2},{"first":81,"second":34,"amount":-2},{"first":81,"second":38,"amount":-2},{"first":81,"second":39,"amount":-2},{"first":81,"second":41,"amount":-2},{"first":81,"second":42,"amount":-2},{"first":81,"second":44,"amount":-2},{"first":81,"second":46,"amount":-2},{"first":81,"second":47,"amount":-2},{"first":81,"second":65,"amount":-2},{"first":81,"second":84,"amount":-3},{"first":81,"second":86,"amount":-2},{"first":81,"second":89,"amount":-2},{"first":81,"second":90,"amount":-2},{"first":81,"second":92,"amount":-2},{"first":81,"second":93,"amount":-2},{"first":81,"second":125,"amount":-2},{"first":82,"second":64,"amount":-2},{"first":82,"second":67,"amount":-2},{"first":82,"second":71,"amount":-2},{"first":82,"second":79,"amount":-2},{"first":82,"second":81,"amount":-2},{"first":82,"second":84,"amount":-2},{"first":82,"second":85,"amount":-2},{"first":84,"second":38,"amount":-3},{"first":84,"second":44,"amount":-4},{"first":84,"second":45,"amount":-4},{"first":84,"second":46,"amount":-4},{"first":84,"second":47,"amount":-3},{"first":84,"second":58,"amount":-4},{"first":84,"second":59,"amount":-4},{"first":84,"second":64,"amount":-3},{"first":84,"second":65,"amount":-3},{"first":84,"second":67,"amount":-3},{"first":84,"second":71,"amount":-3},{"first":84,"second":74,"amount":-4},{"first":84,"second":79,"amount":-3},{"first":84,"second":81,"amount":-3},{"first":84,"second":97,"amount":-5},{"first":84,"second":99,"amount":-4},{"first":84,"second":100,"amount":-4},{"first":84,"second":101,"amount":-4},{"first":84,"second":103,"amount":-4},{"first":84,"second":109,"amount":-4},{"first":84,"second":110,"amount":-4},{"first":84,"second":111,"amount":-4},{"first":84,"second":112,"amount":-4},{"first":84,"second":113,"amount":-4},{"first":84,"second":114,"amount":-4},{"first":84,"second":115,"amount":-4},{"first":84,"second":117,"amount":-4},{"first":84,"second":118,"amount":-4},{"first":84,"second":119,"amount":-3},{"first":84,"second":120,"amount":-3},{"first":84,"second":121,"amount":-4},{"first":84,"second":122,"amount":-3},{"first":85,"second":38,"amount":-2},{"first":85,"second":44,"amount":-2},{"first":85,"second":46,"amount":-2},{"first":85,"second":47,"amount":-2},{"first":85,"second":65,"amount":-2},{"first":86,"second":34,"amount":1},{"first":86,"second":38,"amount":-3},{"first":86,"second":39,"amount":1},{"first":86,"second":42,"amount":1},{"first":86,"second":44,"amount":-4},{"first":86,"second":45,"amount":-3},{"first":86,"second":46,"amount":-4},{"first":86,"second":47,"amount":-3},{"first":86,"second":58,"amount":-2},{"first":86,"second":59,"amount":-2},{"first":86,"second":63,"amount":1},{"first":86,"second":64,"amount":-2},{"first":86,"second":65,"amount":-3},{"first":86,"second":67,"amount":-2},{"first":86,"second":71,"amount":-2},{"first":86,"second":74,"amount":-3},{"first":86,"second":79,"amount":-2},{"first":86,"second":81,"amount":-2},{"first":86,"second":97,"amount":-3},{"first":86,"second":99,"amount":-3},{"first":86,"second":100,"amount":-3},{"first":86,"second":101,"amount":-3},{"first":86,"second":103,"amount":-3},{"first":86,"second":109,"amount":-2},{"first":86,"second":110,"amount":-2},{"first":86,"second":111,"amount":-3},{"first":86,"second":112,"amount":-2},{"first":86,"second":113,"amount":-3},{"first":86,"second":114,"amount":-2},{"first":86,"second":115,"amount":-3},{"first":86,"second":116,"amount":-2},{"first":86,"second":117,"amount":-2},{"first":86,"second":118,"amount":-2},{"first":86,"second":120,"amount":-2},{"first":86,"second":121,"amount":-2},{"first":86,"second":122,"amount":-2},{"first":87,"second":34,"amount":1},{"first":87,"second":38,"amount":-2},{"first":87,"second":39,"amount":1},{"first":87,"second":42,"amount":1},{"first":87,"second":44,"amount":-3},{"first":87,"second":45,"amount":-2},{"first":87,"second":46,"amount":-3},{"first":87,"second":47,"amount":-2},{"first":87,"second":63,"amount":1},{"first":87,"second":65,"amount":-2},{"first":87,"second":74,"amount":-3},{"first":87,"second":97,"amount":-2},{"first":87,"second":99,"amount":-2},{"first":87,"second":100,"amount":-2},{"first":87,"second":101,"amount":-2},{"first":87,"second":103,"amount":-3},{"first":87,"second":111,"amount":-2},{"first":87,"second":113,"amount":-2},{"first":87,"second":115,"amount":-2},{"first":88,"second":45,"amount":-2},{"first":88,"second":99,"amount":-2},{"first":88,"second":100,"amount":-2},{"first":88,"second":101,"amount":-2},{"first":88,"second":102,"amount":-2},{"first":88,"second":111,"amount":-2},{"first":88,"second":113,"amount":-2},{"first":88,"second":116,"amount":-2},{"first":88,"second":118,"amount":-2},{"first":88,"second":119,"amount":-2},{"first":88,"second":121,"amount":-2},{"first":89,"second":38,"amount":-4},{"first":89,"second":44,"amount":-3},{"first":89,"second":45,"amount":-4},{"first":89,"second":46,"amount":-3},{"first":89,"second":47,"amount":-4},{"first":89,"second":58,"amount":-3},{"first":89,"second":59,"amount":-3},{"first":89,"second":63,"amount":1},{"first":89,"second":64,"amount":-2},{"first":89,"second":65,"amount":-4},{"first":89,"second":67,"amount":-2},{"first":89,"second":71,"amount":-2},{"first":89,"second":74,"amount":-4},{"first":89,"second":79,"amount":-2},{"first":89,"second":81,"amount":-2},{"first":89,"second":97,"amount":-3},{"first":89,"second":99,"amount":-4},{"first":89,"second":100,"amount":-4},{"first":89,"second":101,"amount":-4},{"first":89,"second":103,"amount":-4},{"first":89,"second":109,"amount":-3},{"first":89,"second":110,"amount":-3},{"first":89,"second":111,"amount":-4},{"first":89,"second":112,"amount":-3},{"first":89,"second":113,"amount":-4},{"first":89,"second":114,"amount":-3},{"first":89,"second":115,"amount":-3},{"first":89,"second":117,"amount":-3},{"first":89,"second":118,"amount":-3},{"first":89,"second":119,"amount":-2},{"first":89,"second":120,"amount":-3},{"first":89,"second":121,"amount":-3},{"first":90,"second":45,"amount":-2},{"first":90,"second":63,"amount":1},{"first":90,"second":64,"amount":-2},{"first":90,"second":67,"amount":-2},{"first":90,"second":71,"amount":-2},{"first":90,"second":79,"amount":-2},{"first":90,"second":81,"amount":-2},{"first":90,"second":99,"amount":-2},{"first":90,"second":100,"amount":-2},{"first":90,"second":101,"amount":-2},{"first":90,"second":111,"amount":-2},{"first":90,"second":113,"amount":-2},{"first":90,"second":118,"amount":-2},{"first":90,"second":121,"amount":-2},{"first":91,"second":64,"amount":-2},{"first":91,"second":67,"amount":-2},{"first":91,"second":71,"amount":-2},{"first":91,"second":79,"amount":-2},{"first":91,"second":81,"amount":-2},{"first":91,"second":99,"amount":-2},{"first":91,"second":100,"amount":-2},{"first":91,"second":101,"amount":-2},{"first":91,"second":111,"amount":-2},{"first":91,"second":113,"amount":-2},{"first":92,"second":34,"amount":-4},{"first":92,"second":39,"amount":-4},{"first":92,"second":42,"amount":-4},{"first":92,"second":45,"amount":-2},{"first":92,"second":63,"amount":-2},{"first":92,"second":64,"amount":-2},{"first":92,"second":67,"amount":-2},{"first":92,"second":71,"amount":-2},{"first":92,"second":74,"amount":1},{"first":92,"second":79,"amount":-2},{"first":92,"second":81,"amount":-2},{"first":92,"second":84,"amount":-3},{"first":92,"second":85,"amount":-2},{"first":92,"second":86,"amount":-3},{"first":92,"second":87,"amount":-2},{"first":92,"second":89,"amount":-4},{"first":92,"second":92,"amount":-3},{"first":92,"second":118,"amount":-2},{"first":92,"second":121,"amount":-2},{"first":97,"second":34,"amount":-2},{"first":97,"second":39,"amount":-2},{"first":97,"second":42,"amount":-2},{"first":97,"second":118,"amount":-2},{"first":97,"second":121,"amount":-2},{"first":98,"second":34,"amount":-2},{"first":98,"second":39,"amount":-2},{"first":98,"second":41,"amount":-2},{"first":98,"second":42,"amount":-2},{"first":98,"second":86,"amount":-3},{"first":98,"second":87,"amount":-2},{"first":98,"second":92,"amount":-3},{"first":98,"second":93,"amount":-2},{"first":98,"second":120,"amount":-2},{"first":98,"second":125,"amount":-2},{"first":101,"second":34,"amount":-2},{"first":101,"second":39,"amount":-2},{"first":101,"second":41,"amount":-2},{"first":101,"second":42,"amount":-2},{"first":101,"second":86,"amount":-3},{"first":101,"second":87,"amount":-2},{"first":101,"second":92,"amount":-3},{"first":101,"second":93,"amount":-2},{"first":101,"second":120,"amount":-2},{"first":101,"second":125,"amount":-2},{"first":102,"second":34,"amount":1},{"first":102,"second":39,"amount":1},{"first":102,"second":42,"amount":1},{"first":102,"second":44,"amount":-3},{"first":102,"second":46,"amount":-3},{"first":104,"second":34,"amount":-2},{"first":104,"second":39,"amount":-2},{"first":104,"second":42,"amount":-2},{"first":104,"second":118,"amount":-2},{"first":104,"second":121,"amount":-2},{"first":107,"second":99,"amount":-2},{"first":107,"second":100,"amount":-2},{"first":107,"second":101,"amount":-2},{"first":107,"second":111,"amount":-2},{"first":107,"second":113,"amount":-2},{"first":109,"second":34,"amount":-2},{"first":109,"second":39,"amount":-2},{"first":109,"second":42,"amount":-2},{"first":109,"second":118,"amount":-2},{"first":109,"second":121,"amount":-2},{"first":110,"second":34,"amount":-2},{"first":110,"second":39,"amount":-2},{"first":110,"second":42,"amount":-2},{"first":110,"second":118,"amount":-2},{"first":110,"second":121,"amount":-2},{"first":111,"second":34,"amount":-2},{"first":111,"second":39,"amount":-2},{"first":111,"second":41,"amount":-2},{"first":111,"second":42,"amount":-2},{"first":111,"second":86,"amount":-3},{"first":111,"second":87,"amount":-2},{"first":111,"second":92,"amount":-3},{"first":111,"second":93,"amount":-2},{"first":111,"second":120,"amount":-2},{"first":111,"second":125,"amount":-2},{"first":112,"second":34,"amount":-2},{"first":112,"second":39,"amount":-2},{"first":112,"second":41,"amount":-2},{"first":112,"second":42,"amount":-2},{"first":112,"second":86,"amount":-3},{"first":112,"second":87,"amount":-2},{"first":112,"second":92,"amount":-3},{"first":112,"second":93,"amount":-2},{"first":112,"second":120,"amount":-2},{"first":112,"second":125,"amount":-2},{"first":114,"second":44,"amount":-3},{"first":114,"second":46,"amount":-3},{"first":114,"second":97,"amount":-2},{"first":118,"second":38,"amount":-2},{"first":118,"second":44,"amount":-3},{"first":118,"second":46,"amount":-3},{"first":118,"second":47,"amount":-2},{"first":118,"second":65,"amount":-2},{"first":119,"second":44,"amount":-2},{"first":119,"second":46,"amount":-2},{"first":120,"second":99,"amount":-2},{"first":120,"second":100,"amount":-2},{"first":120,"second":101,"amount":-2},{"first":120,"second":111,"amount":-2},{"first":120,"second":113,"amount":-2},{"first":121,"second":38,"amount":-2},{"first":121,"second":44,"amount":-3},{"first":121,"second":46,"amount":-3},{"first":121,"second":47,"amount":-2},{"first":121,"second":65,"amount":-2},{"first":123,"second":64,"amount":-2},{"first":123,"second":67,"amount":-2},{"first":123,"second":71,"amount":-2},{"first":123,"second":79,"amount":-2},{"first":123,"second":81,"amount":-2},{"first":123,"second":99,"amount":-2},{"first":123,"second":100,"amount":-2},{"first":123,"second":101,"amount":-2},{"first":123,"second":111,"amount":-2},{"first":123,"second":113,"amount":-2}],"info":{"face":"Lato-Regular","size":32,"bold":0,"italic":0,"charset":"","unicode":1,"stretchH":100,"smooth":1,"aa":2,"padding":[0,0,0,0],"spacing":[0,0]},"common":{"lineHeight":38,"base":32,"scaleW":512,"scaleH":512,"pages":1,"packed":0,"alphaChnl":0,"redChnl":0,"greenChnl":0,"blueChnl":0}};
module.exports.images = [ require("./image").transpose(1, 0, 2) ];
},{"./image":11}],11:[function(require,module,exports){
module.exports=require('ndpack-image')(512,512,4,"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")

},{"ndpack-image":175}],12:[function(require,module,exports){
exports.positions=[[1.301895,0.122622,2.550061],[1.045326,0.139058,2.835156],[0.569251,0.155925,2.805125],[0.251886,0.144145,2.82928],[0.063033,0.131726,3.01408],[-0.277753,0.135892,3.10716],[-0.441048,0.277064,2.594331],[-1.010956,0.095285,2.668983],[-1.317639,0.069897,2.325448],[-0.751691,0.264681,2.381496],[0.684137,0.31134,2.364574],[1.347931,0.302882,2.201434],[-1.736903,0.029894,1.724111],[-1.319986,0.11998,0.912925],[1.538077,0.157372,0.481711],[1.951975,0.081742,1.1641],[1.834768,0.095832,1.602682],[2.446122,0.091817,1.37558],[2.617615,0.078644,0.742801],[-1.609748,0.04973,-0.238721],[-1.281973,0.230984,-0.180916],[-1.074501,0.248204,0.034007],[-1.201734,0.058499,0.402234],[-1.444454,0.054783,0.149579],[-4.694605,5.075882,1.043427],[-3.95963,7.767394,0.758447],[-4.753339,5.339817,0.665061],[-1.150325,9.133327,-0.368552],[-4.316107,2.893611,0.44399],[-0.809202,9.312575,-0.466061],[0.085626,5.963693,1.685666],[-1.314853,9.00142,-0.1339],[-4.364182,3.072556,1.436712],[-2.022074,7.323396,0.678657],[1.990887,6.13023,0.479643],[-3.295525,7.878917,1.409353],[0.571308,6.197569,0.670657],[0.89661,6.20018,0.337056],[0.331851,6.162372,1.186371],[-4.840066,5.599874,2.296069],[2.138989,6.031291,0.228335],[0.678923,6.026173,1.894052],[-0.781682,5.601573,1.836738],[1.181315,6.239007,0.393293],[-3.606308,7.376476,2.661452],[-0.579059,4.042511,-1.540883],[-3.064069,8.630253,-2.597539],[-2.157271,6.837012,0.300191],[-2.966013,7.821581,-1.13697],[-2.34426,8.122965,0.409043],[-0.951684,5.874251,1.415119],[-2.834853,7.748319,0.182406],[-3.242493,7.820096,0.373674],[-0.208532,5.992846,1.252084],[-3.048085,8.431527,-2.129795],[1.413245,5.806324,2.243906],[-0.051222,6.064901,0.696093],[-4.204306,2.700062,0.713875],[-4.610997,6.343405,0.344272],[-3.291336,9.30531,-3.340445],[-3.27211,7.559239,-2.324016],[-4.23882,6.498344,3.18452],[-3.945317,6.377804,3.38625],[-4.906378,5.472265,1.315193],[-3.580131,7.846717,0.709666],[-1.995504,6.645459,0.688487],[-2.595651,7.86054,0.793351],[-0.008849,0.305871,0.184484],[-0.029011,0.314116,-0.257312],[-2.522424,7.565392,1.804212],[-1.022993,8.650826,-0.855609],[-3.831265,6.595426,3.266783],[-4.042525,6.855724,3.060663],[-4.17126,7.404742,2.391387],[3.904526,3.767693,0.092179],[0.268076,6.086802,1.469223],[-3.320456,8.753222,-2.08969],[1.203048,6.26925,0.612407],[-4.406479,2.985974,0.853691],[-3.226889,6.615215,-0.404243],[0.346326,1.60211,3.509858],[-3.955476,7.253323,2.722392],[-1.23204,0.068935,1.68794],[0.625436,6.196455,1.333156],[4.469132,2.165298,1.70525],[0.950053,6.262899,0.922441],[-2.980404,5.25474,-0.663155],[-4.859043,6.28741,1.537081],[-3.077453,4.641475,-0.892167],[-0.44002,8.222503,-0.771454],[-4.034112,7.639786,0.389935],[-3.696045,6.242042,3.394679],[-1.221806,7.783617,0.196451],[0.71461,6.149895,1.656636],[-4.713539,6.163154,0.495369],[-1.509869,0.913044,-0.832413],[-1.547249,2.066753,-0.852669],[-3.757734,5.793742,3.455794],[-0.831911,0.199296,1.718536],[-3.062763,7.52718,-1.550559],[0.938688,6.103354,1.820958],[-4.037033,2.412311,0.988026],[-4.130746,2.571806,1.101689],[-0.693664,9.174283,-0.952323],[-1.286742,1.079679,-0.751219],[1.543185,1.408925,3.483132],[1.535973,2.047979,3.655029],[0.93844,5.84101,2.195219],[-0.684401,5.918492,1.20109],[1.28844,2.008676,3.710781],[-3.586722,7.435506,-1.454737],[-0.129975,4.384192,2.930593],[-1.030531,0.281374,3.214273],[-3.058751,8.137238,-3.227714],[3.649524,4.592226,1.340021],[-3.354828,7.322425,-1.412086],[0.936449,6.209237,1.512693],[-1.001832,3.590411,-1.545892],[-3.770486,4.593242,2.477056],[-0.971925,0.067797,0.921384],[-4.639832,6.865407,2.311791],[-0.441014,8.093595,-0.595999],[-2.004852,6.37142,1.635383],[4.759591,1.92818,0.328328],[3.748064,1.224074,2.140484],[-0.703601,5.285476,2.251988],[0.59532,6.21893,0.981004],[0.980799,6.257026,1.24223],[1.574697,6.204981,0.381628],[1.149594,6.173608,1.660763],[-3.501963,5.895989,3.456576],[1.071122,5.424198,2.588717],[-0.774693,8.473335,-0.276957],[3.849959,4.15542,0.396742],[-0.801715,4.973149,-1.068582],[-2.927676,0.625112,2.326393],[2.669682,4.045542,2.971184],[-4.391324,4.74086,0.343463],[1.520129,6.270031,0.775471],[1.837586,6.084731,0.109188],[1.271475,5.975024,2.032355],[-3.487968,4.513249,2.605871],[-1.32234,1.517264,-0.691879],[-1.080301,1.648226,-0.805526],[-3.365703,6.910166,-0.454902],[1.36034,0.432238,3.075004],[-3.305013,5.774685,3.39142],[3.88432,0.654141,0.12574],[3.57254,0.377934,0.302501],[4.196136,0.807999,0.212229],[3.932997,0.543123,0.380579],[4.023704,3.286125,0.537597],[1.864455,4.916544,2.691677],[-4.775427,6.499498,1.440153],[-3.464928,3.68234,2.766356],[3.648972,1.751262,2.157485],[1.179111,3.238846,3.774796],[-0.171164,0.299126,-0.592669],[-4.502912,3.316656,0.875188],[-0.948454,9.214025,-0.679508],[1.237665,6.288593,1.046],[1.523423,6.268963,1.139544],[1.436519,6.140608,1.739316],[3.723607,1.504355,2.136762],[2.009495,4.045514,3.22053],[-1.921944,7.249905,0.213973],[1.254068,1.205518,3.474709],[-0.317087,5.996269,0.525872],[-2.996914,3.934607,2.900178],[-3.316873,4.028154,2.785696],[-3.400267,4.280157,2.689268],[-3.134842,4.564875,2.697192],[1.480563,4.692567,2.834068],[0.873682,1.315452,3.541585],[1.599355,0.91622,3.246769],[-3.292102,7.125914,2.768515],[3.74296,4.511299,0.616539],[4.698935,1.55336,0.26921],[-3.274387,3.299421,2.823946],[-2.88809,3.410699,2.955248],[1.171407,1.76905,3.688472],[1.430276,3.92483,3.473666],[3.916941,2.553308,0.018941],[0.701632,2.442372,3.778639],[1.562657,2.302778,3.660957],[4.476622,1.152407,0.182131],[-0.61136,5.761367,1.598838],[-3.102154,3.691687,2.903738],[1.816012,5.546167,2.380308],[3.853928,4.25066,0.750017],[1.234681,3.581665,3.673723],[1.862271,1.361863,3.355209],[1.346844,4.146995,3.327877],[1.70672,4.080043,3.274307],[0.897242,1.908983,3.6969],[-0.587022,9.191132,-0.565301],[-0.217426,5.674606,2.019968],[0.278925,6.120777,0.485403],[1.463328,3.578742,-2.001464],[-3.072985,4.264581,2.789502],[3.62353,4.673843,0.383452],[-3.053491,8.752377,-2.908434],[-2.628687,4.505072,2.755601],[0.891047,5.113781,2.748272],[-2.923732,3.06515,2.866368],[0.848008,4.754252,2.896972],[-3.319184,8.811641,-2.327412],[0.12864,8.814781,-1.334456],[1.549501,4.549331,-1.28243],[1.647161,3.738973,3.507719],[1.250888,0.945599,3.348739],[3.809662,4.038822,0.053142],[1.483166,0.673327,3.09156],[0.829726,3.635921,3.713103],[1.352914,5.226651,2.668113],[2.237352,4.37414,3.016386],[4.507929,0.889447,0.744249],[4.57304,1.010981,0.496588],[3.931422,1.720989,2.088175],[-0.463177,5.989835,0.834346],[-2.811236,3.745023,2.969587],[-2.805135,4.219721,2.841108],[-2.836842,4.802543,2.60826],[1.776716,2.084611,3.568638],[4.046881,1.463478,2.106273],[0.316265,5.944313,1.892785],[-2.86347,2.776049,2.77242],[-2.673644,3.116508,2.907104],[-2.621149,4.018502,2.903409],[-2.573447,5.198013,2.477481],[1.104039,2.278985,3.722469],[-4.602743,4.306413,0.902296],[-2.684878,1.510731,0.535039],[0.092036,8.473269,-0.99413],[-1.280472,5.602393,1.928105],[-1.0279,4.121582,-1.403103],[-2.461081,3.304477,2.957317],[-2.375929,3.659383,2.953233],[1.417579,2.715389,3.718767],[0.819727,2.948823,3.810639],[1.329962,0.761779,3.203724],[1.73952,5.295229,2.537725],[0.952523,3.945016,3.548229],[-2.569498,0.633669,2.84818],[-2.276676,0.757013,2.780717],[-2.013147,7.354429,-0.003202],[0.93143,1.565913,3.600325],[1.249014,1.550556,3.585842],[2.287252,4.072353,3.124544],[-4.7349,7.006244,1.690653],[-3.500602,8.80386,-2.009196],[-0.582629,5.549138,2.000923],[-1.865297,6.356066,1.313593],[-3.212154,2.376143,-0.565593],[2.092889,3.493536,-1.727931],[-2.528501,2.784531,2.833758],[-2.565697,4.893154,2.559605],[-2.153366,5.04584,2.465215],[1.631311,2.568241,3.681445],[2.150193,4.699227,2.807505],[0.507599,5.01813,2.775892],[4.129862,1.863698,2.015101],[3.578279,4.50766,-0.009598],[3.491023,4.806749,1.549265],[0.619485,1.625336,3.605125],[1.107499,2.932557,3.790061],[-2.082292,6.99321,0.742601],[4.839909,1.379279,0.945274],[3.591328,4.322645,-0.259497],[1.055245,0.710686,3.16553],[-3.026494,7.842227,1.624553],[0.146569,6.119214,0.981673],[-2.043687,2.614509,2.785526],[-2.302242,3.047775,2.936355],[-2.245686,4.100424,2.87794],[2.116148,5.063507,2.572204],[-1.448406,7.64559,0.251692],[2.550717,4.9268,2.517526],[-2.955456,7.80293,-1.782407],[1.882995,4.637167,2.895436],[-2.014924,3.398262,2.954896],[-2.273654,4.771227,2.611418],[-2.162723,7.876761,0.702473],[-0.198659,5.823062,1.739272],[-1.280908,2.133189,-0.921241],[2.039932,4.251568,3.136579],[1.477815,4.354333,3.108325],[0.560504,3.744128,3.6913],[-2.234018,1.054373,2.352782],[-3.189156,7.686661,-2.514955],[-3.744736,7.69963,2.116973],[-2.283366,2.878365,2.87882],[-2.153786,4.457481,2.743529],[4.933978,1.677287,0.713773],[3.502146,0.535336,1.752511],[1.825169,4.419253,3.081198],[3.072331,0.280979,0.106534],[-0.508381,1.220392,2.878049],[-3.138824,8.445394,-1.659711],[-2.056425,2.954815,2.897241],[-2.035343,5.398477,2.215842],[-3.239915,7.126798,-0.712547],[-1.867923,7.989805,0.526518],[1.23405,6.248973,1.387189],[-0.216492,8.320933,-0.862495],[-2.079659,3.755709,2.928563],[-1.78595,4.300374,2.805295],[-1.856589,5.10678,2.386572],[-1.714362,5.544778,2.004623],[1.722403,4.200291,-1.408161],[0.195386,0.086928,-1.318006],[1.393693,3.013404,3.710686],[-0.415307,8.508471,-0.996883],[-1.853777,0.755635,2.757275],[-1.724057,3.64533,2.884251],[-1.884511,4.927802,2.530885],[-1.017174,7.783908,-0.227078],[-1.7798,2.342513,2.741749],[-1.841329,3.943996,2.88436],[1.430388,5.468067,2.503467],[-2.030296,0.940028,2.611088],[-1.677028,1.215666,2.607771],[-1.74092,2.832564,2.827295],[4.144673,0.631374,0.503358],[4.238811,0.653992,0.762436],[-1.847016,2.082815,2.642674],[4.045764,3.194073,0.852117],[-1.563989,8.112739,0.303102],[-1.781627,1.794836,2.602338],[-1.493749,2.533799,2.797251],[-1.934496,4.690689,2.658999],[-1.499174,5.777946,1.747498],[-2.387409,0.851291,1.500524],[-1.872211,8.269987,0.392533],[-4.647726,6.765771,0.833653],[-3.157482,0.341958,-0.20671],[-1.725766,3.24703,2.883579],[-1.458199,4.079031,2.836325],[-1.621548,4.515869,2.719266],[-1.607292,4.918914,2.505881],[-1.494661,5.556239,1.991599],[-1.727269,7.423769,0.012337],[-1.382497,1.161322,2.640222],[-1.52129,4.681714,2.615467],[-4.247127,2.792812,1.250843],[-1.576338,0.742947,2.769799],[-1.499257,2.172763,2.743142],[-1.480392,3.103261,2.862262],[1.049137,2.625836,3.775384],[-1.368063,1.791587,2.695516],[-1.307839,2.344534,2.767575],[-1.336758,5.092221,2.355225],[-1.5617,5.301749,2.21625],[-1.483362,8.537704,0.196752],[-1.517348,8.773614,0.074053],[-1.474302,1.492731,2.641433],[2.48718,0.644247,-0.920226],[0.818091,0.422682,3.171218],[-3.623398,6.930094,3.033045],[1.676333,3.531039,3.591591],[1.199939,5.683873,2.365623],[-1.223851,8.841201,0.025414],[-1.286307,3.847643,2.918044],[-1.25857,4.810831,2.543605],[2.603662,5.572146,1.991854],[0.138984,5.779724,2.077834],[-1.267039,3.175169,2.890889],[-1.293616,3.454612,2.911774],[-2.60112,1.277184,0.07724],[2.552779,3.649877,3.163643],[-1.038983,1.248011,2.605933],[-1.288709,4.390967,2.761214],[-1.034218,5.485963,2.011467],[-1.185576,1.464842,2.624335],[-1.045682,2.54896,2.761102],[4.259176,1.660627,2.018096],[-0.961707,1.717183,2.598342],[-1.044603,3.147464,2.855335],[-0.891998,4.685429,2.669696],[-1.027561,5.081672,2.377939],[4.386506,0.832434,0.510074],[-1.014225,9.064991,-0.175352],[-1.218752,2.895443,2.823785],[-0.972075,4.432669,2.788005],[-2.714986,0.52425,1.509798],[-0.699248,1.517219,2.645738],[-1.161581,2.078852,2.722795],[-0.845249,3.286247,2.996471],[1.068329,4.443444,2.993863],[3.98132,3.715557,1.027775],[1.658097,3.982428,-1.651688],[-4.053701,2.449888,0.734746],[-0.910935,2.214149,2.702393],[0.087824,3.96165,3.439344],[-0.779714,3.724134,2.993429],[-1.051093,3.810797,2.941957],[-0.644941,4.3859,2.870863],[-2.98403,8.666895,-3.691888],[-0.754304,2.508325,2.812999],[-4.635524,3.662891,0.913005],[-0.983299,4.125978,2.915378],[4.916497,1.905209,0.621315],[4.874983,1.728429,0.468521],[2.33127,5.181957,2.441697],[-0.653711,2.253387,2.7949],[-3.623744,8.978795,-2.46192],[-4.555927,6.160279,0.215755],[-4.940628,5.806712,1.18383],[3.308506,2.40326,-0.910776],[0.58835,5.251928,-0.992886],[2.152215,5.449733,2.331679],[-0.712755,0.766765,3.280375],[-0.741771,1.9716,2.657235],[-4.828957,5.566946,2.635623],[-3.474788,8.696771,-1.776121],[1.770417,6.205561,1.331627],[-0.620626,4.064721,2.968972],[-1.499187,2.307735,-0.978901],[4.098793,2.330245,1.667951],[1.940444,6.167057,0.935904],[-2.314436,1.104995,1.681277],[-2.733629,7.742793,1.7705],[-0.452248,4.719868,2.740834],[-0.649143,4.951713,2.541296],[-0.479417,9.43959,-0.676324],[-2.251853,6.559275,0.046819],[0.033531,8.316907,-0.789939],[-0.513125,0.995673,3.125462],[-2.637602,1.039747,0.602434],[1.527513,6.230089,1.430903],[4.036124,2.609846,1.506498],[-3.559828,7.877892,1.228076],[-4.570736,4.960193,0.838201],[-0.432121,5.157731,2.467518],[-1.206735,4.562511,-1.237054],[-0.823768,3.788746,-1.567481],[-3.095544,7.353613,-1.024577],[-4.056088,7.631119,2.062001],[-0.289385,5.382261,2.329421],[1.69752,6.136483,1.667037],[-0.168758,5.061138,2.617453],[2.853576,1.605528,-1.229958],[-4.514319,6.586675,0.352756],[-2.558081,7.741151,1.29295],[1.61116,5.92358,2.071534],[3.936921,3.354857,0.091755],[-0.1633,1.119272,3.147975],[0.067551,1.593475,3.38212],[-1.303239,2.328184,-1.011672],[-0.438093,0.73423,3.398384],[-4.62767,3.898187,0.849573],[0.286853,4.165281,3.284834],[-2.968052,8.492812,-3.493693],[-0.111896,3.696111,3.53791],[-3.808245,8.451731,-1.574742],[0.053416,5.558764,2.31107],[3.956269,3.012071,0.11121],[-0.710956,8.106561,-0.665154],[0.234725,2.717326,3.722379],[-0.031594,2.76411,3.657347],[-0.017371,4.700633,2.81911],[0.215064,5.034859,2.721426],[-0.111151,8.480333,-0.649399],[3.97942,3.575478,0.362219],[0.392962,4.735392,2.874321],[4.17015,2.085087,1.865999],[0.169054,1.244786,3.337709],[0.020049,3.165818,3.721736],[0.248212,3.595518,3.698376],[0.130706,5.295541,2.540034],[-4.541357,4.798332,1.026866],[-1.277485,1.289518,-0.667272],[3.892133,3.54263,-0.078056],[4.057379,3.03669,0.997913],[0.287719,0.884758,3.251787],[0.535771,1.144701,3.400096],[0.585303,1.399362,3.505353],[0.191551,2.076246,3.549355],[0.328656,2.394576,3.649623],[0.413124,3.240728,3.771515],[0.630361,4.501549,2.963623],[0.529441,5.854392,2.120225],[3.805796,3.769958,-0.162079],[3.447279,4.344846,-0.467276],[0.377618,5.551116,2.426017],[0.409355,1.821269,3.606333],[0.719959,2.194726,3.703851],[0.495922,3.501519,3.755661],[0.603408,5.354097,2.603088],[-4.605056,7.531978,1.19579],[0.907972,0.973128,3.356513],[0.750134,3.356137,3.765847],[0.4496,3.993244,3.504544],[-3.030738,7.48947,-1.259169],[0.707505,5.602005,2.43476],[0.668944,0.654891,3.213797],[0.593244,2.700978,3.791427],[1.467759,3.30327,3.71035],[3.316249,2.436388,2.581175],[3.26138,1.724425,2.539028],[-1.231292,7.968263,0.281414],[-0.108773,8.712307,-0.790607],[4.445684,1.819442,1.896988],[1.998959,2.281499,3.49447],[2.162269,2.113817,3.365449],[4.363397,1.406731,1.922714],[4.808,2.225842,0.611127],[2.735919,0.771812,-0.701142],[1.897735,2.878428,3.583482],[-3.31616,5.331985,3.212394],[-3.3314,6.018137,3.313018],[-3.503183,6.480103,3.222216],[-1.904453,5.750392,1.913324],[-1.339735,3.559592,-1.421817],[-1.044242,8.22539,0.037414],[1.643492,3.110676,3.647424],[3.992832,3.686244,0.710946],[1.774207,1.71842,3.475768],[-3.438842,5.5713,3.427818],[4.602447,1.2583,1.619528],[-0.925516,7.930042,0.072336],[-1.252093,3.846565,-1.420761],[-3.426857,5.072419,2.97806],[-3.160408,6.152629,3.061869],[3.739931,3.367082,2.041273],[1.027419,4.235891,3.251253],[4.777703,1.887452,1.560409],[-3.318528,6.733796,2.982968],[2.929265,4.962579,2.271079],[3.449761,2.838629,2.474576],[-3.280159,5.029875,2.787514],[4.068939,2.993629,0.741567],[0.303312,8.70927,-1.121972],[0.229852,8.981322,-1.186075],[-0.011045,9.148156,-1.047057],[-2.942683,5.579613,2.929297],[-3.145409,5.698727,3.205778],[-3.019089,6.30887,2.794323],[-3.217135,6.468191,2.970032],[-3.048298,6.993641,2.623378],[-3.07429,6.660982,2.702434],[3.612011,2.5574,2.25349],[2.54516,4.553967,2.75884],[-1.683759,7.400787,0.250868],[-1.756066,7.463557,0.448031],[-3.023761,5.149697,2.673539],[3.112376,2.677218,2.782378],[2.835327,4.581196,2.567146],[-2.973799,7.225458,2.506988],[-0.591645,8.740662,-0.505845],[3.782861,2.04337,2.03066],[3.331604,3.36343,2.605047],[2.966866,1.205497,2.537432],[0.002669,9.654748,-1.355559],[2.632801,0.58497,2.540311],[-2.819398,5.087372,2.521098],[2.616193,5.332961,2.194288],[-3.193973,4.925634,2.607924],[-3.12618,5.27524,2.944544],[-0.426003,8.516354,-0.501528],[2.802717,1.387643,2.751649],[-3.120597,7.889111,-2.75431],[2.636648,1.71702,2.991302],[-2.853151,6.711792,2.430276],[-2.843836,6.962865,2.400842],[1.9696,3.199023,3.504514],[-2.461751,0.386352,3.008994],[1.64127,0.495758,3.02958],[-4.330472,5.409831,0.025287],[-2.912387,5.980416,2.844261],[-2.490069,0.211078,2.985391],[3.581816,4.809118,0.733728],[2.693199,2.647213,3.126709],[-0.182964,8.184108,-0.638459],[-2.226855,0.444711,2.946552],[-0.720175,8.115055,0.017689],[2.645302,4.316212,2.850139],[-0.232764,9.329503,-0.918639],[4.852365,1.471901,0.65275],[2.76229,2.014994,2.957755],[-2.808374,5.354301,2.644695],[-2.790967,6.406963,2.547985],[-1.342684,0.418488,-1.669183],[2.690675,5.593587,-0.041236],[4.660146,1.6318,1.713314],[2.775667,3.007229,3.111332],[-0.396696,8.963432,-0.706202],[2.446707,2.740617,3.321433],[-4.803209,5.884634,2.603672],[-2.652003,1.6541,1.5078],[3.932327,3.972874,0.831924],[2.135906,0.955587,2.986608],[2.486131,2.053802,3.124115],[-0.386706,8.115753,-0.37565],[-2.720727,7.325044,2.224878],[-1.396946,7.638016,-0.16486],[-0.62083,7.989771,-0.144413],[-2.653272,5.729684,2.667679],[3.038188,4.65835,2.364142],[2.381721,0.739472,2.788992],[-2.345829,5.474929,2.380633],[-2.518983,6.080562,2.479383],[-2.615793,6.839622,2.186116],[-2.286566,0.143752,2.766848],[-4.771219,6.508766,1.070797],[3.717308,2.905019,2.097994],[2.50521,3.016743,3.295898],[2.208448,1.56029,3.216806],[3.346783,1.01254,2.119951],[2.653503,3.26122,3.175738],[-2.359636,5.827519,2.402297],[-1.952693,0.558102,2.853307],[-0.321562,9.414885,-1.187501],[3.138923,1.405072,2.520765],[1.493728,1.780051,3.621969],[3.01817,0.907291,2.336909],[3.183548,1.185297,2.352175],[1.608619,5.006753,2.695131],[-4.723919,6.836107,1.095288],[-1.017586,8.865429,-0.149328],[4.730762,1.214014,0.64008],[-2.135182,6.647907,1.495471],[-2.420382,6.546114,2.108209],[-2.458053,7.186346,1.896623],[3.437124,0.275798,1.138203],[0.095925,8.725832,-0.926481],[2.417376,2.429869,3.287659],[2.279951,1.200317,3.049994],[2.674753,2.326926,3.044059],[-2.328123,6.849164,1.75751],[-3.418616,7.853407,0.126248],[-3.151587,7.77543,-0.110889],[2.349144,5.653242,2.05869],[-2.273236,6.085631,2.242888],[-4.560601,4.525342,1.261241],[2.866334,3.796067,2.934717],[-2.17493,6.505518,1.791367],[3.12059,3.283157,2.818869],[3.037703,3.562356,2.866653],[0.066233,9.488418,-1.248237],[2.749941,0.975018,2.573371],[-2.155749,5.801033,2.204009],[-2.162778,6.261889,2.028596],[1.936874,0.459142,2.956718],[3.176249,4.335541,2.440447],[4.356599,1.029423,1.700589],[3.873502,3.082678,1.80431],[2.895489,4.243034,2.735259],[-0.095774,9.468195,-1.07451],[-1.124982,7.886808,-0.480851],[3.032304,3.065454,2.897927],[3.692687,4.5961,0.957858],[-3.013045,3.807235,-1.098381],[-0.790012,8.92912,-0.367572],[1.905793,0.73179,2.996728],[3.530396,3.426233,2.356583],[2.12299,0.624933,2.929167],[-2.069196,6.039284,2.01251],[-3.565623,7.182525,2.850039],[2.959264,2.376337,2.829242],[2.949071,1.822483,2.793933],[4.036142,0.763803,1.703744],[-1.993527,6.180318,1.804936],[-0.030987,0.766389,3.344766],[-0.549683,8.225193,-0.189341],[-0.765469,8.272246,-0.127174],[-2.947047,7.541648,-0.414113],[-3.050327,9.10114,-3.435619],[3.488566,2.231807,2.399836],[3.352283,4.727851,1.946438],[4.741011,2.162773,1.499574],[-1.815093,6.072079,1.580722],[-3.720969,8.267927,-0.984713],[1.932826,3.714052,3.427488],[3.323617,4.438961,2.20732],[0.254111,9.26364,-1.373244],[-1.493384,7.868585,-0.450051],[-0.841901,0.776135,-1.619467],[0.243537,6.027668,0.091687],[0.303057,0.313022,-0.531105],[-0.435273,0.474098,3.481552],[2.121507,2.622389,3.486293],[1.96194,1.101753,3.159584],[3.937991,3.407551,1.551392],[0.070906,0.295753,1.377185],[-1.93588,7.631764,0.651674],[-2.523531,0.744818,-0.30985],[2.891496,3.319875,2.983079],[4.781765,1.547061,1.523129],[-2.256064,7.571251,0.973716],[3.244861,3.058249,2.724392],[-0.145855,0.437775,3.433662],[1.586296,5.658538,2.358487],[3.658336,3.774921,2.071837],[2.840463,4.817098,2.46376],[-1.219464,8.122542,-0.672808],[-2.520906,2.664486,-1.034346],[-1.315417,8.471365,-0.709557],[3.429165,3.74686,2.446169],[3.074579,3.840758,2.767409],[3.569443,3.166337,2.333647],[2.294337,3.280051,3.359346],[2.21816,3.66578,3.269222],[2.158662,4.151444,-1.357919],[1.13862,4.380986,-1.404565],[3.388382,2.749931,-0.840949],[3.059892,5.084848,2.026066],[3.204739,2.075145,2.640706],[3.387065,1.42617,2.305275],[3.910398,2.670742,1.750179],[3.471512,1.945821,2.395881],[4.08082,1.070654,1.960171],[-1.057861,0.133036,2.146707],[-0.151749,5.53551,-0.624323],[3.233099,4.003778,2.571172],[2.611726,5.319199,-0.499388],[2.682909,1.094499,-1.206247],[-1.22823,7.656887,0.041409],[-2.293247,7.259189,0.013844],[0.081315,0.202174,3.286381],[-1.002038,5.794454,-0.187194],[3.448856,4.08091,2.258325],[0.287883,9.006888,-1.550641],[-3.851019,4.059839,-0.646922],[3.610966,4.205438,1.913129],[2.239042,2.950872,3.449959],[0.216305,0.442843,3.328052],[1.87141,2.470745,3.574559],[3.811378,2.768718,-0.228364],[2.511081,1.362724,2.969349],[-1.59813,7.866506,0.440184],[-3.307975,2.851072,-0.894978],[-0.107011,8.90573,-0.884399],[-3.855315,2.842597,-0.434541],[2.517853,1.090768,2.799687],[3.791709,2.36685,2.002703],[4.06294,2.773922,0.452723],[-2.973289,7.61703,-0.623653],[-2.95509,8.924462,-3.446319],[2.861402,0.562592,2.184397],[-1.109725,8.594206,-0.076812],[-0.725722,7.924485,-0.381133],[-1.485587,1.329994,-0.654405],[-4.342113,3.233735,1.752922],[-2.968049,7.955519,-2.09405],[-3.130948,0.446196,0.85287],[-4.958475,5.757329,1.447055],[-3.086547,7.615193,-1.953168],[-3.751923,5.412821,3.373373],[-4.599645,7.480953,1.677134],[1.133992,0.274871,0.032249],[-2.956512,8.126905,-1.785461],[-0.960645,4.73065,-1.191786],[-2.871064,0.875559,0.424881],[-4.932114,5.99614,1.483845],[-2.981761,8.124612,-1.387276],[0.362298,8.978545,-1.368024],[-4.408375,3.046271,0.602373],[2.865841,2.322263,-1.344625],[-4.7848,5.620895,0.594432],[-2.88322,0.338931,1.67231],[-4.688101,6.772931,1.872318],[-4.903948,6.164698,1.27135],[2.85663,1.005647,-0.906843],[2.691286,0.209811,0.050512],[-4.693636,6.477556,0.665796],[-4.472331,6.861067,0.477318],[0.883065,0.204907,3.073933],[-0.995867,8.048729,-0.653897],[-0.794663,5.670397,-0.390119],[3.313153,1.638006,-0.722289],[-4.856459,5.394758,1.032591],[-3.005448,7.783023,-0.819641],[3.11891,2.036974,-1.08689],[-2.364319,2.408419,2.63419],[-2.927132,8.75435,-3.537159],[-3.296222,7.964629,-3.134625],[-1.642041,4.13417,-1.301665],[2.030759,0.176372,-1.030923],[-4.559069,3.751053,0.548453],[3.438385,4.59454,-0.243215],[-2.561769,7.93935,0.177696],[2.990593,1.335314,-0.943177],[1.2808,0.276396,-0.49072],[-0.318889,0.290684,0.211143],[3.54614,3.342635,-0.767878],[-3.073372,7.780018,-2.357807],[-4.455388,4.387245,0.361038],[-4.659393,6.276064,2.767014],[0.636799,4.482223,-1.426284],[-2.987681,8.072969,-2.45245],[-2.610445,0.763554,1.792054],[3.358241,2.006707,-0.802973],[-0.498347,0.251594,0.962885],[3.1322,0.683312,2.038777],[-4.389801,7.493776,0.690247],[0.431467,4.22119,-1.614215],[-4.376181,3.213141,0.273255],[-4.872319,5.715645,0.829714],[-4.826893,6.195334,0.849912],[3.516562,2.23732,-0.677597],[3.131656,1.698841,-0.975761],[-4.754925,5.411666,1.989303],[-2.987299,7.320765,-0.629479],[-3.757635,3.274862,-0.744022],[3.487044,2.541999,-0.699933],[-4.53274,4.649505,0.77093],[-1.424192,0.099423,2.633327],[3.090867,2.476975,-1.146957],[-2.713256,0.815622,2.17311],[3.348121,3.254167,-0.984896],[-3.031379,0.16453,-0.309937],[-0.949757,4.518137,-1.309172],[-0.889509,0.095256,1.288803],[3.539594,1.966105,-0.553965],[-4.60612,7.127749,0.811958],[-2.332953,1.444713,1.624548],[3.136293,2.95805,-1.138272],[3.540808,3.069058,-0.735285],[3.678852,2.362375,-0.452543],[-4.648898,7.37438,0.954791],[-0.646871,0.19037,3.344746],[2.2825,0.29343,-0.826273],[-4.422291,7.183959,0.557517],[-4.694668,5.246103,2.541768],[-4.583691,4.145486,0.600207],[-2.934854,7.912513,-1.539269],[-3.067861,7.817472,-0.546501],[3.825095,3.229512,-0.237547],[2.532494,0.323059,2.387105],[-2.514583,0.692857,1.23597],[-4.736805,7.214384,1.259421],[-2.98071,8.409903,-2.468199],[2.621468,1.385844,-1.406355],[3.811447,3.560855,1.847828],[3.432925,1.497205,-0.489784],[3.746609,3.631538,-0.39067],[3.594909,2.832257,-0.576012],[-0.404192,5.300188,-0.856561],[-4.762996,6.483774,1.702648],[-4.756612,6.786223,1.43682],[-2.965309,8.437217,-2.785495],[2.863867,0.74087,-0.429684],[4.02503,2.968753,1.392419],[3.669036,1.833858,-0.304971],[-2.888864,0.720537,0.778057],[-2.36982,0.979443,1.054447],[-2.959259,8.222303,-2.659724],[-3.467825,7.545739,-2.333445],[2.153426,0.446256,-1.20523],[-3.229807,9.189699,-3.596609],[-3.72486,8.773707,-2.046671],[3.687218,3.297751,-0.523746],[1.381025,0.08815,-1.185668],[-2.796828,7.205622,-0.208783],[3.647194,4.066232,-0.291507],[-4.578376,3.885556,1.52546],[-2.840262,0.63094,1.89499],[-2.429514,0.922118,1.820781],[-4.675079,6.573925,2.423363],[2.806207,4.320188,-1.027372],[-1.289608,0.097241,1.321661],[-3.010731,8.141334,-2.866148],[3.202291,1.235617,-0.549025],[4.094792,2.477519,0.304581],[2.948403,0.966873,-0.664857],[-4.83297,5.920587,2.095461],[-2.169693,7.257277,0.946184],[-1.335807,3.057597,-1.303166],[-1.037877,0.64151,-1.685271],[2.627919,0.089814,0.439074],[3.815794,3.808102,1.730493],[-2.973455,8.433141,-3.08872],[-2.391558,7.331428,1.658264],[-4.333107,4.529978,1.850516],[-4.640293,3.767107,1.168841],[3.600716,4.46931,1.734024],[3.880803,1.730158,-0.172736],[3.814183,4.262372,1.167042],[4.37325,0.829542,1.413729],[2.490447,5.75111,0.011492],[3.460003,4.962436,1.188971],[3.918419,3.814234,1.358271],[-0.807595,8.840504,-0.953711],[3.752855,4.20577,1.57177],[-2.991085,8.816501,-3.244595],[-2.333196,7.128889,1.551985],[3.977718,3.570941,1.25937],[4.360071,0.755579,1.079916],[4.637579,1.027973,1.032567],[-2.317,7.421066,1.329589],[-1.013404,8.293662,-0.7823],[4.548023,1.020644,1.420462],[4.763258,1.266798,1.296203],[4.896,2.073084,1.255213],[4.015005,3.325226,1.093879],[4.94885,1.860936,0.894463],[-2.189645,6.954634,1.270077],[4.887442,1.720992,1.288526],[-3.184068,7.871802,0.956189],[-1.274318,0.839887,-1.224389],[-2.919521,7.84432,0.541629],[-2.994586,7.766102,1.96867],[-3.417504,9.241714,-3.093201],[-3.174563,7.466456,2.473617],[-3.263067,9.069412,-3.003459],[-2.841592,0.529833,2.693434],[-3.611069,9.158804,-2.829871],[-4.642828,5.927526,0.320549],[-3.809308,9.051035,-2.692749],[-2.837582,7.487987,-0.106206],[4.773025,2.330442,1.213899],[4.897435,2.209906,0.966657],[-3.067637,8.164062,-1.12661],[-3.122129,8.08074,-0.899194],[4.571019,2.358113,1.462054],[4.584884,2.454418,0.709466],[-3.661093,7.146581,-0.475948],[4.735131,2.415859,0.933939],[4.207556,2.540018,1.218293],[-3.607595,7.89161,-0.121172],[-1.527952,0.775564,-1.061903],[4.53874,2.503273,1.099583],[-3.938837,7.587988,0.082449],[-4.853582,6.152409,1.787943],[-4.752214,6.247234,2.296873],[4.602935,2.363955,0.488901],[-1.81638,6.365879,0.868272],[0.595467,4.744074,-1.32483],[1.87635,3.511986,-1.842924],[4.330947,2.534326,0.720503],[4.108736,2.750805,0.904552],[-1.890939,8.492628,-0.290768],[-3.504309,6.173058,-0.422804],[-1.611992,6.196732,0.648736],[-3.899149,7.826123,1.088845],[-3.078303,3.008813,-1.035784],[-2.798999,7.844899,1.340061],[-1.248839,5.959105,0.041761],[0.767779,4.337318,3.090817],[-3.831177,7.515605,2.432261],[-1.667528,6.156208,0.365267],[-1.726078,6.237384,1.100059],[-3.972037,4.520832,-0.370756],[-4.40449,7.636357,1.520425],[-1.34506,6.004054,1.293159],[-1.233556,6.049933,0.500651],[-3.696869,7.79732,0.37979],[-3.307798,8.949964,-2.698113],[-1.997295,6.615056,1.103691],[-3.219222,8.336394,-1.150614],[-3.452623,8.31866,-0.9417],[-3.94641,2.990494,2.212592],[-3.250025,8.030414,-0.596097],[-2.02375,1.571333,2.397939],[-3.190358,7.665013,2.268183],[-2.811918,7.618526,2.145587],[-1.005265,5.892303,0.072158],[-0.93721,5.974148,0.906669],[-4.646072,7.492193,1.45312],[-0.252931,1.797654,3.140638],[-1.076064,5.738433,1.695953],[-3.980534,7.744391,1.735791],[-0.721187,5.939396,0.526032],[-0.42818,5.919755,0.229001],[-1.43429,6.11622,0.93863],[-0.985638,5.939683,0.290636],[-4.433836,7.461372,1.966437],[-3.696398,7.844859,1.547325],[-3.390772,7.820186,1.812204],[-2.916787,7.864019,0.804341],[-3.715952,8.037269,-0.591341],[-4.204634,7.72919,1.119866],[-4.592233,5.592883,0.246264],[3.307299,5.061701,1.622917],[-3.515159,7.601467,2.368914],[-3.435742,8.533457,-1.37916],[-0.269421,4.545635,-1.366445],[-2.542124,3.768736,-1.258512],[-3.034003,7.873773,1.256854],[-2.801399,7.856028,1.080137],[3.29354,5.220894,1.081767],[-2.35109,1.299486,1.01206],[-3.232213,7.768136,2.047563],[3.290415,5.217525,0.68019],[-3.415109,7.731034,2.144326],[3.440357,4.962463,0.373387],[3.147346,5.352121,1.386923],[2.847252,5.469051,1.831981],[3.137682,5.410222,1.050188],[3.102694,5.310456,1.676434],[-3.044601,0.39515,1.994084],[2.903647,5.561338,1.518598],[-3.810148,8.093598,-0.889131],[4.234835,0.803054,1.593271],[3.240165,5.228747,0.325955],[3.037452,5.509825,0.817137],[2.635031,5.795187,1.439724],[3.071607,5.318303,0.080142],[2.909167,5.611751,1.155874],[3.044889,5.465928,0.486566],[2.502256,5.770673,1.740054],[-0.067497,0.086416,-1.190239],[2.33326,5.906051,0.138295],[0.65096,4.205423,3.308767],[-2.671137,7.936535,0.432731],[2.14463,5.879214,1.866047],[-4.776469,5.890689,0.561986],[2.72432,5.655145,0.211951],[2.730488,5.751455,0.695894],[2.572682,5.869295,1.152663],[1.906776,5.739123,2.196551],[2.344414,5.999961,0.772922],[-3.377905,7.448708,-1.863251],[2.285149,5.968156,1.459258],[2.385989,5.928974,0.3689],[2.192111,6.087516,0.959901],[2.36372,6.001101,1.074346],[1.972022,6.079603,1.591175],[1.87615,5.976698,1.91554],[-3.824761,9.05372,-2.928615],[2.044704,6.129704,1.263111],[-2.583046,0.849537,2.497344],[-0.078825,2.342205,3.520322],[-0.704686,0.537165,3.397194],[-0.257449,3.235334,3.647545],[-0.332064,1.448284,3.022583],[-2.200146,0.898284,-0.447212],[-2.497508,1.745446,1.829167],[0.30702,4.416315,2.978956],[-3.205197,3.479307,-1.040582],[0.110069,9.347725,-1.563686],[-0.82754,0.883886,3.065838],[-2.017103,1.244785,2.42512],[-0.421091,2.309929,3.153898],[-0.491604,3.796072,3.16245],[2.786955,3.501241,-1.340214],[-3.229055,4.380713,-0.899241],[3.730768,0.76845,1.90312],[-0.561079,2.652382,3.152463],[-3.461471,3.086496,2.662505],[-0.661405,3.446009,3.179939],[-0.915351,0.636755,3.243708],[-2.992964,8.915628,-3.729833],[-0.439627,3.502104,3.42665],[-1.154217,0.883181,2.800835],[-1.736193,1.465474,2.595489],[-0.423928,3.24435,3.548277],[-0.511153,2.871046,3.379749],[-0.675722,2.991756,3.143262],[-1.092602,0.599103,3.090639],[-0.89821,2.836952,2.840023],[-2.658412,0.781376,0.960575],[-2.271455,1.222857,1.330478],[-0.877861,1.111222,2.72263],[-0.306959,2.876987,3.556044],[-3.839274,7.84138,-0.918404],[-0.172094,4.083799,3.141708],[-1.548332,0.2529,2.864655],[-0.217353,4.873911,-1.223104],[-3.384242,3.181056,-0.95579],[-2.731704,0.382421,2.895502],[-1.285037,0.551267,2.947675],[0.077224,4.246579,3.066738],[-0.479979,1.77955,2.860011],[-0.716375,1.224694,2.666751],[-0.54622,3.138255,3.393457],[-2.33413,1.821222,2.124883],[-0.50653,2.037147,2.897465],[2.451291,1.211389,-1.466589],[-3.160047,2.894081,2.724286],[-4.137258,5.433431,3.21201],[0.462896,0.320456,-0.174837],[-0.37458,2.609447,3.379253],[-3.095244,0.256205,2.196446],[-4.197985,5.732991,3.262924],[-0.729747,0.246036,0.497036],[-2.356189,5.062,-0.965619],[-1.609036,0.25962,-1.487367],[-4.074381,6.074061,3.409459],[-3.619304,4.0022,2.65705],[-0.543393,8.742896,-1.056622],[-4.30356,6.858934,2.879642],[-0.716688,2.901831,-2.11202],[1.547362,0.083189,1.138764],[-0.250916,0.275268,1.201344],[-3.778035,3.13624,2.466177],[-4.594316,5.771342,3.01694],[-3.717706,3.442887,2.603344],[-4.311163,5.224669,3.019373],[-0.610389,2.095161,-1.923515],[-3.040086,6.196918,-0.429149],[-3.802695,3.768247,2.545523],[-0.159541,2.043362,3.328549],[-3.744329,4.31785,2.491889],[-3.047939,0.214155,1.873639],[-4.41685,6.113058,3.166774],[-1.165133,0.460692,-1.742134],[-1.371289,4.249996,-1.317935],[-3.447883,0.3521,0.466205],[-4.495555,6.465548,2.944147],[-3.455335,0.171653,0.390816],[-3.964028,4.017196,2.376009],[-1.323595,1.763126,-0.750772],[-3.971142,5.277524,-0.19496],[-3.222052,0.237723,0.872229],[-4.403784,3.89107,1.872077],[-3.333311,0.342997,0.661016],[-4.495871,4.29606,1.63608],[-3.636081,2.760711,2.361949],[-4.487235,3.559608,1.66737],[-4.719787,7.26888,1.658722],[-1.086143,9.035741,-0.707144],[-2.339693,1.600485,-0.404817],[-4.642011,7.123829,1.990987],[-1.498077,3.854035,-1.369787],[-4.188372,4.729363,2.02983],[-3.116344,5.882284,-0.468884],[-4.305236,4.246417,1.976991],[-3.022509,0.22819,1.065688],[-2.799916,0.52022,1.128319],[-4.262823,3.534409,2.020383],[-4.221533,3.947676,2.11735],[-3.744353,4.391712,-0.6193],[-1.272905,0.156694,-1.741753],[-3.62491,2.669825,-0.549664],[-4.180756,3.096179,1.987215],[-4.059276,4.305313,2.232924],[-2.812753,0.183226,1.370267],[-4.032437,3.512234,2.309985],[-0.03787,0.28188,0.530391],[-4.711562,5.468653,2.822838],[-4.500636,6.953314,2.564445],[-4.479433,7.216991,2.270682],[3.990562,0.50522,0.716309],[-2.512229,6.863447,-0.100658],[-2.968058,6.956639,-0.37061],[2.550375,3.142683,-1.54068],[-2.320059,3.521605,-1.279397],[-4.556319,6.64662,2.745363],[-4.281091,7.108116,2.667598],[-2.050095,8.411689,0.121353],[-2.44854,1.135487,0.851875],[3.121815,0.699943,-0.277167],[-4.69877,6.00376,2.843035],[-1.360599,8.824742,-0.595597],[1.128437,0.171611,0.301691],[-4.360146,6.289423,0.042233],[1.400795,4.088829,-1.620409],[-3.193462,8.460137,-3.559446],[-3.168771,8.878431,-3.635795],[-3.434275,9.304302,-3.460878],[-3.349993,8.808093,-3.38179],[-3.304823,8.323865,-3.325905],[-3.572607,9.308843,-3.207672],[-3.166393,8.201215,-3.43014],[-3.451638,9.05331,-3.351345],[-3.309591,8.549758,-3.375055],[-3.527992,8.793926,-3.100376],[-3.6287,8.981677,-3.076319],[-3.445505,8.001887,-2.8273],[-3.408011,8.221014,-3.039237],[-3.65928,8.740382,-2.808856],[-3.878019,8.797295,-2.462866],[-3.515132,8.232341,-2.747739],[-3.460331,8.51524,-3.06818],[-3.403703,7.658628,-2.648789],[-3.507113,8.00159,-2.582275],[-3.607373,8.174737,-2.401723],[-3.749043,8.378084,-2.226959],[-3.648514,8.502213,-2.6138],[-2.534199,0.904753,2.021148],[1.4083,5.744252,-0.571402],[-3.852536,8.571009,-2.352358],[2.868255,5.373126,-0.163705],[2.224363,4.669891,-1.061586],[-4.528281,4.885838,1.340274],[1.30817,4.609629,-1.28762],[-4.519698,3.422501,1.354826],[-3.549955,7.783228,-2.332859],[1.12313,6.120856,0.045115],[-3.620324,7.57716,-2.033423],[-0.798833,2.624133,-1.992682],[-3.617587,7.783148,-2.051383],[-3.669293,8.103776,-2.10227],[-3.892417,8.667436,-2.167288],[-0.537435,0.285345,-0.176267],[-0.841522,3.299866,-1.887861],[-0.761547,3.647082,-1.798953],[-3.661544,7.85708,-1.867924],[-3.886763,8.551783,-1.889171],[-0.591244,1.549749,-1.714784],[-0.775276,1.908218,-1.597609],[-0.961458,2.573273,-1.695549],[-2.215672,1.335009,2.143031],[-4.622674,4.130242,1.220683],[1.07344,0.290099,1.584734],[-0.976906,2.92171,-1.76667],[-1.13696,3.194401,-1.513455],[-3.743262,7.99949,-1.629286],[-2.876359,4.900986,-0.879556],[0.550835,3.905557,-2.031372],[0.777647,4.992314,-1.215703],[1.445881,4.266201,-1.414663],[1.274222,5.510543,-0.824495],[-0.864685,2.318581,-1.702389],[-0.627458,3.820722,-1.743153],[-3.867699,8.30866,-1.850066],[1.635287,5.45587,-0.83844],[-1.037876,2.538589,-1.513504],[-4.38993,4.73926,1.699639],[0.048709,4.765232,-1.279506],[-0.626548,1.339887,-1.595114],[-3.682827,7.643453,-1.723398],[-3.868783,8.180191,-1.511743],[-0.76988,1.508373,-1.419599],[-1.138374,2.766765,-1.448163],[1.699883,5.780752,-0.475361],[1.214305,0.308517,1.866405],[-1.713642,0.373461,-1.265204],[-1.582388,0.58294,-1.267977],[-0.879549,1.821581,-1.313787],[0.519057,5.858757,-0.381397],[-3.770989,2.449208,-0.132655],[0.087576,0.156713,-1.53616],[-0.942622,2.146534,-1.421494],[-1.026192,1.022164,-1.145423],[-0.964079,1.645473,-1.067631],[-1.109128,2.458789,-1.29106],[-1.037478,0.209489,-1.805424],[-3.724391,7.599686,-1.273458],[-3.787898,7.951792,-1.304794],[3.821677,2.165581,-0.181535],[-2.39467,0.304606,-0.570375],[-2.352928,1.0439,2.079369],[-0.288899,9.640684,-1.006079],[-3.472118,7.263001,-1.080326],[-1.240769,0.972352,-0.976446],[-1.845253,0.356801,-0.995574],[-2.32279,7.915361,-0.057477],[-1.08092,2.179315,-1.168821],[4.598833,2.156768,0.280264],[-4.725417,6.442373,2.056809],[-0.490347,9.46429,-0.981092],[-1.99652,0.09737,-0.765828],[-1.137793,1.888846,-0.894165],[-0.37247,4.29661,-1.465199],[-0.184631,5.692946,-0.421398],[-3.751694,7.742231,-1.086908],[-1.001416,1.298225,-0.904674],[-3.536884,7.190777,-0.788609],[-3.737597,7.511281,-0.940052],[-1.766651,0.669388,-0.873054],[3.112245,3.474345,-1.129672],[-0.175504,3.81298,-2.0479],[-3.766762,7.412514,-0.681569],[-0.63375,9.439424,-0.785128],[-0.518199,4.768982,-1.258625],[0.790619,4.212759,-1.610218],[-3.761951,3.742528,-0.756283],[0.897483,5.679808,-0.612423],[2.221126,4.427468,-1.252155],[-0.728577,5.846457,0.062702],[0.194451,9.503908,-1.482461],[-0.099243,9.385459,-1.39564],[0.643185,3.636855,-2.180247],[0.894522,5.900601,-0.356935],[2.595516,4.75731,-0.893245],[1.108497,3.936893,-1.905098],[1.989894,5.789726,-0.343268],[-3.802345,7.655508,-0.613817],[2.339353,4.96257,-0.90308],[0.12564,4.013324,-1.879236],[-4.078965,3.683254,-0.445439],[2.092899,5.256128,-0.831607],[0.427571,0.291769,1.272964],[2.335549,3.480056,-1.581949],[-0.15687,0.324827,-1.648922],[-0.536522,5.760786,-0.203535],[1.507082,0.078251,-0.923109],[-1.854742,0.134826,2.698774],[-3.939827,3.168498,-0.526144],[-3.98461,3.39869,-0.533212],[-3.961738,4.217132,-0.489147],[4.273789,2.181164,0.153786],[-0.470498,5.645664,-0.439079],[-0.414539,5.488017,-0.673379],[-0.097462,5.062739,-1.114863],[1.198092,5.882232,-0.391699],[2.855834,5.085022,-0.498678],[1.037998,4.129757,-1.701811],[1.728091,5.068444,-1.063761],[-3.832258,2.625141,-0.311384],[-4.078526,3.070256,-0.284362],[-4.080365,3.954243,-0.440471],[-0.152578,5.276267,-0.929815],[-1.489635,8.928082,-0.295891],[0.759294,5.15585,-1.087374],[-4.000338,2.801647,-0.235135],[-4.290801,3.823209,-0.19374],[-4.221493,4.25618,-0.189894],[-4.066195,4.71916,-0.201724],[-0.155386,4.076396,-1.662865],[3.054571,4.414305,-0.825985],[-1.652919,8.726499,-0.388504],[-3.042753,0.560068,-0.126425],[-2.434456,1.118088,-0.213563],[-2.623502,1.845062,-0.283697],[-4.233371,3.43941,-0.202918],[2.726702,3.82071,-1.280097],[0.184199,4.14639,-1.673653],[-1.289203,0.624562,-1.560929],[-3.823676,7.382458,-0.407223],[0.476667,5.064419,-1.143742],[-3.873651,4.955112,-0.269389],[1.349666,5.312227,-1.000274],[-2.043776,8.434488,-0.108891],[-2.763964,0.733395,-0.129294],[-4.380505,3.664409,-0.024546],[-0.71211,5.341811,-0.803281],[-3.960858,7.183112,-0.118407],[-3.822277,7.712853,-0.263221],[-2.346808,8.108588,0.063244],[-1.841731,8.642999,-0.142496],[-2.600055,0.985604,-0.043595],[-3.513057,2.213243,-0.044151],[-3.963492,2.603055,-0.080898],[-4.258066,3.14537,-0.027046],[-4.261572,5.00334,0.13004],[0.795464,3.99873,-1.905688],[-3.300873,0.384761,0.013271],[-2.770244,0.881942,0.077313],[-3.456227,1.993871,0.301054],[-4.441987,3.914144,0.177867],[-4.367075,6.611414,0.165312],[-3.201767,0.576292,0.105769],[-3.174354,0.645009,0.440373],[-2.996576,0.74262,0.161325],[-2.724979,1.656497,0.092983],[-3.261757,2.017742,-0.070763],[-4.280173,4.518235,-0.002999],[-4.471073,5.945358,0.05202],[-3.877137,2.40743,0.274928],[-4.371219,4.252758,0.078039],[-3.400914,0.40983,0.238599],[-4.44293,3.523242,0.146339],[-4.574528,5.279761,0.353923],[-4.226643,7.191282,0.269256],[-4.16361,2.843204,0.097727],[-4.528506,5.011661,0.536625],[0.35514,5.664802,-0.572814],[2.508711,5.580976,-0.266636],[2.556226,3.633779,-1.426362],[1.878456,4.533714,-1.223744],[2.460709,4.440241,-1.1395],[2.218589,5.514603,-0.560066],[2.263712,5.737023,-0.250694],[2.964981,3.814858,-1.139927],[0.991384,5.304131,-0.999867],[2.81187,4.547292,-0.916025],[2.918089,4.768382,-0.702808],[3.262403,4.414286,-0.657935],[0.652136,6.089113,0.069089],[3.361389,3.5052,-0.946123],[2.613042,5.037192,-0.697153],[0.094339,4.36858,-1.451238],[3.290862,4.155716,-0.732318],[2.658063,4.073614,-1.217455],[3.260349,3.753257,-0.946819],[1.124268,4.862463,-1.207855],[3.35158,4.899247,-0.027586],[3.194057,4.691257,-0.524566],[3.090119,5.116085,-0.23255],[2.418965,3.811753,-1.419399],[2.191789,3.877038,-1.47023],[4.043166,2.034188,0.015477],[-1.026966,0.86766,-1.410912],[1.937563,3.860005,-1.617465],[2.98904,4.101806,-0.998132],[-0.142611,5.865305,-0.100872],[3.972673,2.292069,0.089463],[3.23349,3.959925,-0.849829],[0.16304,5.857276,-0.216704],[4.122964,1.770061,-0.114906],[2.099057,4.978374,-0.98449],[3.502411,3.76181,-0.667502],[2.079484,5.939614,-0.036205],[-0.084568,3.525193,-2.253506],[0.423859,4.06095,-1.845327],[1.6013,6.006466,-0.153429],[0.271701,3.844964,-2.078748],[0.273577,5.218904,-0.994711],[-0.410578,3.92165,-1.773635],[1.941954,5.60041,-0.621569],[0.100825,5.462131,-0.774256],[-0.53016,3.619892,-2.027451],[-0.822371,5.517453,-0.605747],[-2.474925,7.670892,-0.020174],[4.01571,0.830194,-0.013793],[-0.400092,5.094112,-1.041992],[-2.887284,5.581246,-0.525324],[-1.559841,6.050972,0.079301],[-0.469317,3.291673,-2.235211],[0.337397,3.467926,-2.295458],[-2.632074,5.573701,-0.582717],[-0.030318,6.011395,0.276616],[-0.934373,0.388987,-1.780523],[-2.661263,5.844838,-0.425966],[0.549353,5.489646,-0.807268],[-2.194355,6.197491,-0.109322],[-2.289618,5.664813,-0.581098],[1.583583,3.796366,-1.844498],[0.855295,0.215979,-1.425557],[-2.627569,5.300236,-0.767174],[4.333347,2.384332,0.399129],[-1.880401,5.583843,-0.696561],[-2.172346,5.324859,-0.846246],[-2.27058,5.906265,-0.388373],[-1.960049,5.889346,-0.397593],[0.965756,3.67547,-2.105671],[-2.014066,6.431125,0.287254],[-1.776173,5.287097,-0.89091],[-2.025852,5.089562,-0.980218],[-1.886418,6.108358,-0.000667],[-1.600803,5.785347,-0.491069],[-1.66188,4.968053,-1.042535],[-1.600621,5.962818,-0.188044],[-1.588831,5.615418,-0.665456],[4.46901,1.880138,0.057248],[-1.978845,0.927399,-0.554856],[-1.408074,5.325266,-0.83967],[1.923123,4.843955,-1.101389],[-2.87378,0.117106,-0.412735],[-1.222193,5.62638,-0.539981],[-2.632537,0.166349,-0.489218],[-1.370865,5.838832,-0.341026],[-1.067742,5.448874,-0.692701],[-1.073798,5.220878,-0.908779],[-1.147562,4.950417,-1.079727],[-2.789115,4.531047,-1.042713],[-3.550826,4.170487,-0.806058],[-3.331694,4.798177,-0.69568],[-3.689404,4.688543,-0.534317],[-3.511509,5.106246,-0.483632],[1.796344,0.076137,0.080455],[-3.306354,5.473605,-0.478764],[-2.692503,3.346604,-1.20959],[-3.963056,5.187462,3.113156],[-3.901231,6.391477,-0.246984],[4.484234,1.518638,-0.001617],[4.308829,1.657716,-0.119275],[4.290045,1.339528,-0.110626],[-3.514938,3.524974,-0.909109],[-2.1943,2.12163,-0.71966],[4.108206,1.091087,-0.11416],[3.785312,1.392435,-0.28588],[4.092886,1.480476,-0.210655],[-2.965937,6.469006,-0.379085],[-3.708581,2.962974,-0.63979],[-3.297971,2.218917,-0.299872],[3.806949,0.804703,-0.11438],[3.747957,1.059258,-0.273069],[-3.101827,4.111444,-1.006255],[-1.536445,4.658913,-1.195049],[-3.549826,2.450555,-0.375694],[-3.676495,2.108366,0.534323],[-3.674738,5.925075,-0.400011],[-2.250115,2.848335,-1.121174],[-3.698062,5.667567,-0.381396],[3.468966,0.734643,-0.190624],[-3.97972,5.670078,-0.26874],[-3.002087,4.337837,-1.033421],[-3.356392,2.608308,-0.713323],[-1.833016,3.359983,-1.28775],[-1.989069,3.632416,-1.305607],[3.591254,0.542371,0.026146],[3.364927,1.082572,-0.342613],[-3.393759,3.866801,-0.937266],[-4.124865,5.549529,-0.161729],[-4.423423,5.687223,0.000103],[-1.496881,2.601785,-1.114328],[-2.642297,6.496932,-0.264175],[-3.684236,6.819423,-0.320233],[-2.286996,3.167067,-1.246651],[-1.624896,8.44848,-0.530014],[-3.666787,2.159266,0.268149],[-2.402625,2.011243,-0.56446],[-2.736166,2.259839,-0.6943],[-2.168611,3.89078,-1.292206],[-2.065956,3.345708,-1.281346],[-2.778147,2.675605,-0.995706],[-3.507431,4.513272,-0.71829],[-2.301184,4.293911,-1.238182],[3.205808,0.211078,0.394349],[-2.129936,4.870577,-1.080781],[-2.287977,2.496593,-0.934069],[-2.701833,2.931814,-1.114509],[3.294795,0.50631,-0.081062],[-2.552829,7.468771,-0.021541],[3.06721,0.944066,-0.43074],[-2.86086,1.973622,-0.303132],[-3.598818,5.419613,-0.401645],[-1.524381,0.080156,-1.61662],[-1.907291,2.646274,-1.039438],[2.950783,0.407562,-0.105407],[-1.663048,1.655038,-0.689787],[-1.728102,1.110064,-0.635963],[-2.085823,7.686296,-0.159745],[2.883518,3.157009,-1.30858],[-2.724116,0.417169,-0.389719],[-1.788636,7.862672,-0.346413],[-2.186418,1.249609,-0.434583],[-3.092434,2.606657,-0.860002],[-1.737314,3.874201,-1.330986],[2.564522,0.422967,-0.390903],[1.670782,3.538432,-1.924753],[-2.338131,4.02578,-1.286673],[-1.916516,4.054121,-1.301788],[2.87159,2.034949,-1.267139],[-1.931518,3.062883,-1.197227],[-0.816602,0.135682,3.104104],[0.469392,0.213916,-1.489608],[2.574055,1.950091,-1.514427],[2.733595,2.682546,-1.461213],[-1.915407,4.693647,-1.151721],[-3.412883,5.867094,-0.450528],[2.28822,0.120432,-0.04102],[2.244477,0.14424,-0.376933],[-1.676198,3.570698,-1.328031],[-1.821193,4.366982,-1.266271],[-1.552208,8.099221,-0.53262],[-1.727419,2.39097,-0.989456],[-2.468226,4.711663,-1.069766],[-2.451669,6.113319,-0.273788],[2.635447,2.295842,-1.518361],[-2.020809,8.150253,-0.246714],[2.292455,0.805596,-1.3042],[2.641556,1.65665,-1.466962],[2.409062,2.842538,-1.635025],[2.456682,1.459484,-1.57543],[-1.691047,3.173582,-1.247082],[-1.865642,1.957608,-0.768683],[-3.401579,0.20407,0.100932],[2.301981,1.7102,-1.650461],[2.342929,2.611944,-1.690713],[-1.676111,2.923894,-1.17835],[-2.992039,3.547631,-1.118945],[-3.571677,6.504634,-0.375455],[2.141764,1.460869,-1.702464],[-3.221958,5.146049,-0.615632],[2.19238,2.949367,-1.747242],[2.320791,2.232971,-1.706842],[2.088678,2.585235,-1.813159],[-2.196404,0.592218,-0.569709],[-2.120811,1.836483,-0.62338],[-1.949935,2.271249,-0.874128],[2.235901,1.110183,-1.510719],[2.020157,3.241128,-1.803917],[2.054336,1.949394,-1.792332],[-3.094117,4.996595,-0.740238],[2.038063,0.635949,-1.402041],[1.980644,1.684408,-1.76778],[1.587432,3.306542,-1.991131],[1.935322,0.976267,-1.602208],[1.922621,1.235522,-1.698813],[1.712495,1.911874,-1.903234],[1.912802,2.259273,-1.888698],[1.884367,0.355453,-1.312633],[1.676427,0.76283,-1.539455],[1.78453,2.83662,-1.943035],[1.697312,0.120281,-1.150324],[1.648318,2.484973,-1.999505],[-4.051804,5.958472,-0.231731],[-1.964823,1.464607,-0.58115],[1.55996,2.183486,-1.971378],[1.628125,1.045912,-1.707832],[1.701684,1.540428,-1.827156],[1.567475,4.869481,-1.184665],[1.432492,0.843779,-1.648083],[1.173837,2.978983,-2.156687],[1.235287,3.37975,-2.09515],[1.252589,1.525293,-1.949205],[1.159334,2.336379,-2.105361],[1.49061,2.695263,-2.083216],[-4.122486,6.782604,-0.02545],[1.173388,0.279193,-1.423418],[1.505684,0.380815,-1.414395],[1.391423,1.343031,-1.843557],[1.263449,2.73225,-2.144961],[1.295858,0.597122,-1.515628],[1.245851,3.729126,-1.993015],[-2.761439,6.23717,-0.365856],[0.978887,1.664888,-2.046633],[1.219542,0.982729,-1.785486],[1.315915,1.91748,-2.02788],[-3.052746,2.127222,-0.369082],[0.977656,1.36223,-1.944119],[0.936122,3.39447,-2.203007],[-2.740036,4.184702,-1.122849],[0.853581,2.864694,-2.260847],[0.719569,0.818762,-1.763618],[0.839115,1.159359,-1.907943],[0.932069,1.94559,-2.117962],[0.579321,3.326747,-2.299369],[0.86324,0.597822,-1.565106],[0.574567,1.158452,-1.943123],[0.525138,2.137252,-2.213867],[0.779941,2.342019,-2.206157],[0.915255,2.618102,-2.209041],[0.526426,3.02241,-2.321826],[0.495431,2.521396,-2.295905],[0.80799,3.156817,-2.286432],[0.273556,1.304936,-2.012509],[0.664326,1.530024,-2.048722],[0.219173,2.32907,-2.323212],[0.405324,0.695359,-1.704884],[0.398827,0.946649,-1.843899],[0.345109,1.608829,-2.100174],[-2.356743,0.062032,-0.4947],[-3.001084,0.27146,2.560034],[-2.064663,0.303055,-0.697324],[0.221271,3.174023,-2.374399],[0.195842,0.437865,-1.621473],[-0.385613,0.297763,1.960096],[1.999609,0.108928,-0.79125],[0.351698,9.227494,-1.57565],[0.021477,2.191913,-2.309353],[0.246381,2.836575,-2.356365],[1.543281,0.237539,1.901906],[0.031881,9.147022,-1.454203],[-0.001881,1.648503,-2.108044],[0.333423,1.907088,-2.204533],[0.044063,2.634032,-2.368412],[-0.028148,3.053684,-2.390082],[0.02413,3.34297,-2.36544],[-0.272645,9.02879,-1.238685],[-0.006348,0.832044,-1.758222],[-0.321105,1.458754,-1.886313],[-0.153948,8.618809,-1.105353],[-0.409303,1.137783,-1.720556],[-0.410054,1.742789,-1.957989],[-0.287905,2.380404,-2.294509],[-0.261375,2.646629,-2.356322],[-0.221986,3.215303,-2.345844],[-0.31608,0.687581,-1.71901],[-0.537705,0.855802,-1.648585],[-0.142834,1.193053,-1.87371],[-0.24371,2.044435,-2.176958],[-0.437999,2.959748,-2.299698],[-0.78895,0.176226,-1.729046],[-0.608509,0.546932,-1.734032],[-0.693698,4.478782,-1.369372],[-0.669153,8.469645,-0.911149],[-0.741857,1.082705,-1.458474],[-0.554059,2.440325,-2.141785],[2.09261,0.153182,2.57581],[1.792547,0.111794,2.563777],[1.855787,0.189541,2.835089],[1.492601,0.232246,2.987681],[-0.284918,0.236687,3.429738],[2.604841,0.11997,1.01506],[0.331271,0.168113,3.124031],[0.280606,0.308368,2.495937],[0.544591,0.325711,2.081274],[0.193145,0.19154,-0.977556],[3.810099,0.42324,1.032202],[3.54622,0.379245,1.392814],[0.61402,0.276328,0.849356],[-1.198628,0.144953,2.911457],[4.17199,0.68037,1.391526],[0.88279,0.321339,2.059129],[1.93035,0.109992,2.054154],[1.620331,0.121986,2.37203],[2.374812,0.10921,1.734876],[-0.031227,0.294412,2.593687],[4.075018,0.561914,1.038065],[-0.570366,0.126583,2.975558],[0.950052,0.318463,1.804012],[1.130034,0.117125,0.98385],[2.123049,0.08946,1.665911],[2.087572,0.068621,0.335013],[2.927337,0.167117,0.289611],[0.528876,0.313434,3.205969],[1.174911,0.162744,1.328262],[-4.88844,5.59535,1.661134],[-4.709607,5.165338,1.324082],[0.871199,0.277021,1.263831],[-3.910877,2.349318,1.272269],[1.56824,0.118605,2.768112],[1.179176,0.152617,-0.858003],[1.634629,0.247872,2.128625],[-4.627425,5.126935,1.617836],[3.845542,0.54907,1.45601],[2.654006,0.165508,1.637169],[-0.678324,0.26488,1.974741],[2.451139,0.100377,0.213768],[0.633199,0.286719,0.403357],[-0.533042,0.2524,1.373267],[0.99317,0.171106,0.624966],[-0.100063,0.306466,2.170225],[1.245943,0.092351,0.661031],[1.390414,0.198996,-0.0864],[-4.457265,5.030531,2.138242],[2.89776,0.146575,1.297468],[1.802703,0.088824,-0.490405],[1.055447,0.309261,2.392437],[2.300436,0.142429,2.104254],[2.33399,0.187756,2.416935],[2.325183,0.134349,0.574063],[2.410924,0.370971,2.637115],[1.132924,0.290511,3.061],[1.764028,0.070212,-0.80535],[2.156994,0.397657,2.844061],[0.920711,0.225527,-0.882456],[-4.552135,5.24096,2.85514],[0.210016,0.309396,2.064296],[0.612067,0.136815,-1.086002],[3.150236,0.426757,1.802703],[-0.24824,0.282258,1.470997],[0.974269,0.301311,-0.640898],[-4.401413,5.03966,2.535553],[0.644319,0.274006,-0.817806],[0.332922,0.309077,0.108474],[3.610001,0.317447,0.689353],[3.335681,0.358195,0.118477],[0.623544,0.318983,-0.4193],[-0.11012,0.307747,1.831331],[-0.407528,0.291044,2.282935],[0.069783,0.285095,0.950289],[0.970135,0.310392,-0.283742],[0.840564,0.306898,0.098854],[-0.541827,0.267753,1.683795],[-3.956082,4.55713,2.297164],[-4.161036,2.834481,1.64183],[-4.093952,4.977551,2.747747],[2.661819,0.261867,1.926145],[-3.749926,2.161875,0.895238],[-2.497776,1.3629,0.791855],[0.691482,0.304968,1.582939],[-4.013193,4.830963,2.4769],[-3.639585,2.091265,1.304415],[-3.9767,2.563053,1.6284],[-3.979915,2.788616,1.977977],[0.388782,0.312656,1.709168],[-3.40873,1.877324,0.851652],[-3.671637,5.136974,3.170734],[-3.12964,1.852012,0.157682],[-3.629687,4.852698,2.686837],[-3.196164,1.793459,0.452804],[-3.746338,2.31357,1.648551],[2.992192,0.125251,0.575976],[-3.254051,0.054431,0.314152],[-3.474644,1.925288,1.134116],[-3.418372,2.022882,1.578901],[-2.920955,1.705403,0.29842],[-3.57229,2.152022,1.607572],[-3.251259,0.09013,-0.106174],[-3.299952,1.877781,1.348623],[-3.666819,2.441459,2.004838],[-2.912646,1.824748,-0.045348],[-3.399511,2.479484,2.340393],[-3.009754,0.015286,0.075567],[-3.381443,2.316937,2.156923],[-3.352801,2.133341,1.857366],[-3.01788,1.687685,0.645867],[-2.931857,1.678712,1.158472],[-3.301008,0.08836,0.591001],[1.358025,0.19795,1.599144],[-2.999565,1.845016,1.618396],[-2.767957,0.028397,-0.196436],[-2.93962,2.078779,2.140593],[-3.346648,2.674056,2.518097],[3.324322,0.20822,0.628605],[3.091677,0.137202,0.9345],[-2.881807,0.009952,0.318439],[-2.764946,1.786619,1.693439],[-2.905542,1.932343,1.900002],[-3.140854,2.271384,2.274946],[-2.88995,2.487856,2.574759],[-2.367194,-0.000943,-0.15576],[-3.050738,0.068703,0.742988],[-2.759525,1.55679,0.877782],[-3.151775,2.48054,2.482749],[-2.578618,-0.002885,0.165716],[-2.651618,1.877246,1.981189],[-2.933973,0.133731,1.631023],[1.047628,0.100284,-1.085248],[-1.585123,0.062083,-1.394896],[-2.287917,-0.002671,0.214434],[-2.524899,0.007481,0.471788],[-2.815492,2.188198,2.343294],[-2.095142,-0.003149,-0.094574],[-2.172686,-0.000133,0.47963],[-2.732704,0.074306,1.742079],[-2.49653,2.145668,2.42691],[-1.343683,0.047721,-1.506391],[-2.581185,0.048703,0.975528],[-2.905101,0.083158,2.010052],[-2.601514,2.007801,2.223089],[-2.339464,0.02634,1.484304],[-2.907873,0.10367,2.378149],[-1.368796,0.062516,-1.049125],[-1.93244,0.02443,-0.427603],[-2.705081,0.060513,2.303802],[3.372155,0.206274,0.892293],[-1.761827,0.093202,-1.037404],[-1.700667,0.0397,-0.614221],[-1.872291,0.011979,-0.135753],[-1.929257,0.074005,0.728999],[-2.520128,0.049665,1.99054],[-2.699411,0.10092,2.603116],[3.211701,0.27302,1.423357],[-1.445362,0.1371,-0.626491],[2.921332,0.259112,1.645525],[-0.993242,0.058686,-1.408916],[-0.944986,0.157541,-1.097665],[-2.154301,0.032749,1.882001],[-2.108789,1.988557,2.442673],[-1.015659,0.25497,-0.416665],[-1.898411,0.015872,0.16715],[-1.585517,0.027121,0.453445],[-2.311105,0.061264,2.327061],[-2.637042,0.152224,2.832201],[-2.087515,2.292972,2.617585],[-0.750611,0.056697,-1.504516],[-0.472029,0.075654,-1.360203],[-0.710798,0.139244,-1.183863],[-0.97755,0.26052,-0.831167],[-0.655814,0.260843,-0.880068],[-0.897513,0.275537,-0.133042],[-2.049194,0.084947,2.455422],[-0.177837,0.076362,-1.449009],[-0.553393,0.279083,-0.59573],[-1.788636,0.06163,2.231198],[-0.34761,0.255578,-0.999614],[-1.398589,0.036482,0.65871],[-1.133918,0.05617,0.69473],[-1.43369,0.058226,1.977865],[-2.505459,1.492266,1.19295]]
exports.cells=[[2,1661,3],[1676,7,6],[712,1694,9],[3,1674,1662],[11,1672,0],[1705,0,1],[5,6,1674],[4,5,1674],[7,8,712],[2,1662,10],[1,10,1705],[11,1690,1672],[1705,11,0],[5,1676,6],[7,9,6],[7,712,9],[2,3,1662],[3,4,1674],[1,2,10],[12,82,1837],[1808,12,1799],[1808,1799,1796],[12,861,82],[861,1808,13],[1808,861,12],[1799,12,1816],[1680,14,1444],[15,17,16],[14,1678,1700],[16,17,1679],[15,1660,17],[14,1084,1678],[15,1708,18],[15,18,1660],[1680,1084,14],[1680,15,1084],[15,1680,1708],[793,813,119],[1076,793,119],[1076,1836,22],[23,19,20],[21,1076,22],[21,22,23],[23,20,21],[1076,119,1836],[806,634,470],[432,1349,806],[251,42,125],[809,1171,791],[953,631,827],[634,1210,1176],[157,1832,1834],[56,219,53],[126,38,83],[37,85,43],[59,1151,1154],[83,75,41],[77,85,138],[201,948,46],[1362,36,37],[452,775,885],[1237,95,104],[966,963,1262],[85,77,43],[36,85,37],[1018,439,1019],[41,225,481],[85,83,127],[93,83,41],[935,972,962],[116,93,100],[98,82,813],[41,75,225],[298,751,54],[1021,415,1018],[77,138,128],[766,823,1347],[593,121,573],[905,885,667],[786,744,747],[100,41,107],[604,334,765],[779,450,825],[968,962,969],[225,365,481],[365,283,196],[161,160,303],[875,399,158],[328,1817,954],[62,61,1079],[358,81,72],[74,211,133],[160,161,138],[91,62,1079],[167,56,1405],[56,167,219],[913,914,48],[344,57,102],[43,77,128],[1075,97,1079],[389,882,887],[219,108,53],[1242,859,120],[604,840,618],[754,87,762],[197,36,1362],[1439,88,1200],[1652,304,89],[81,44,940],[445,463,151],[717,520,92],[129,116,100],[1666,1811,624],[1079,97,91],[62,91,71],[688,898,526],[463,74,133],[278,826,99],[961,372,42],[799,94,1007],[100,93,41],[1314,943,1301],[184,230,109],[875,1195,231],[133,176,189],[751,755,826],[101,102,57],[1198,513,117],[748,518,97],[1145,1484,1304],[358,658,81],[971,672,993],[445,151,456],[252,621,122],[36,271,126],[85,36,126],[116,83,93],[141,171,1747],[1081,883,103],[1398,1454,149],[457,121,593],[127,116,303],[697,70,891],[457,891,1652],[1058,1668,112],[518,130,97],[214,319,131],[185,1451,1449],[463,133,516],[1428,123,177],[113,862,561],[215,248,136],[186,42,251],[127,83,116],[160,85,127],[162,129,140],[154,169,1080],[169,170,1080],[210,174,166],[1529,1492,1524],[450,875,231],[399,875,450],[171,141,170],[113,1155,452],[131,319,360],[44,175,904],[452,872,113],[746,754,407],[147,149,150],[309,390,1148],[53,186,283],[757,158,797],[303,129,162],[429,303,162],[154,168,169],[673,164,193],[38,271,75],[320,288,1022],[246,476,173],[175,548,904],[182,728,456],[199,170,169],[168,199,169],[199,171,170],[184,238,230],[246,247,180],[1496,1483,1467],[147,150,148],[828,472,445],[53,108,186],[56,53,271],[186,961,42],[1342,391,57],[1664,157,1834],[1070,204,178],[178,204,179],[285,215,295],[692,55,360],[192,193,286],[359,673,209],[586,195,653],[121,89,573],[202,171,199],[238,515,311],[174,210,240],[174,105,166],[717,276,595],[1155,1149,452],[1405,56,197],[53,283,30],[75,53,30],[45,235,1651],[210,166,490],[181,193,192],[185,620,217],[26,798,759],[1070,226,204],[220,187,179],[220,168,187],[202,222,171],[359,209,181],[182,456,736],[964,167,1405],[76,250,414],[807,1280,1833],[70,883,1652],[227,179,204],[221,199,168],[221,202,199],[360,494,131],[214,241,319],[105,247,166],[205,203,260],[388,480,939],[482,855,211],[8,807,1833],[226,255,204],[228,221,168],[166,173,490],[701,369,702],[211,855,262],[631,920,630],[1448,1147,1584],[255,227,204],[237,220,179],[228,168,220],[222,256,555],[215,259,279],[126,271,38],[108,50,186],[227,236,179],[236,237,179],[220,237,228],[228,202,221],[256,222,202],[555,256,229],[259,152,279],[27,1296,31],[186,50,961],[961,234,372],[1651,235,812],[1572,1147,1448],[255,226,1778],[255,236,227],[256,257,229],[106,184,109],[241,410,188],[177,578,620],[209,673,181],[1136,1457,79],[1507,245,718],[255,273,236],[275,410,241],[206,851,250],[1459,253,1595],[1406,677,1650],[228,274,202],[202,281,256],[348,239,496],[205,172,203],[369,248,702],[261,550,218],[261,465,550],[574,243,566],[921,900,1220],[291,273,255],[348,238,265],[109,230,194],[149,380,323],[443,270,421],[272,291,255],[274,228,237],[274,292,202],[281,257,256],[276,543,341],[152,259,275],[1111,831,249],[632,556,364],[299,273,291],[299,236,273],[280,237,236],[202,292,281],[247,246,173],[282,49,66],[1620,1233,1553],[299,280,236],[280,305,237],[237,305,274],[306,292,274],[330,257,281],[246,194,264],[166,247,173],[912,894,896],[611,320,244],[1154,1020,907],[969,962,290],[272,299,291],[305,318,274],[145,212,240],[164,248,285],[259,277,275],[193,164,295],[269,240,210],[1033,288,320],[46,948,206],[336,280,299],[330,281,292],[257,307,300],[369,136,248],[145,240,269],[502,84,465],[193,295,286],[164,285,295],[282,302,49],[161,303,429],[318,306,274],[306,330,292],[315,257,330],[315,307,257],[307,352,300],[300,352,308],[275,277,403],[353,1141,333],[1420,425,47],[611,313,320],[85,126,83],[128,1180,43],[303,116,129],[280,314,305],[314,318,305],[190,181,242],[203,214,131],[820,795,815],[322,299,272],[322,336,299],[315,339,307],[172,152,617],[172,214,203],[321,1033,320],[1401,941,946],[85,160,138],[976,454,951],[747,60,786],[317,322,272],[339,352,307],[266,33,867],[163,224,218],[247,614,180],[648,639,553],[388,172,205],[611,345,313],[313,345,320],[160,127,303],[454,672,951],[317,329,322],[314,280,336],[306,338,330],[330,339,315],[1236,115,436],[342,321,320],[1046,355,328],[328,346,325],[325,346,317],[367,314,336],[314,337,318],[337,306,318],[338,343,330],[342,320,345],[355,349,328],[346,329,317],[347,336,322],[314,362,337],[330,343,339],[340,308,352],[135,906,1022],[239,156,491],[194,230,486],[40,1015,1003],[321,355,1046],[329,382,322],[382,347,322],[347,367,336],[337,371,306],[306,371,338],[1681,296,1493],[286,172,388],[230,348,486],[348,183,486],[384,332,830],[328,349,346],[367,362,314],[371,343,338],[339,351,352],[57,344,78],[342,355,321],[386,346,349],[386,350,346],[346,350,329],[347,366,367],[343,363,339],[323,380,324],[152,275,241],[345,1045,342],[350,374,329],[339,363,351],[234,340,352],[353,361,354],[40,34,1015],[373,355,342],[373,349,355],[374,382,329],[366,347,382],[371,363,343],[351,379,352],[379,372,352],[372,234,352],[156,190,491],[319,241,692],[354,361,31],[366,377,367],[363,379,351],[133,590,516],[197,56,271],[1045,370,342],[370,373,342],[374,350,386],[377,366,382],[367,395,362],[400,337,362],[400,371,337],[378,363,371],[106,109,614],[181,673,193],[953,920,631],[376,349,373],[376,386,349],[378,379,363],[224,375,218],[279,152,172],[361,619,381],[1347,823,795],[760,857,384],[392,374,386],[394,395,367],[383,371,400],[383,378,371],[218,375,261],[197,271,36],[414,454,976],[385,376,373],[1051,382,374],[387,394,367],[377,387,367],[395,400,362],[279,172,295],[30,365,225],[450,231,825],[385,373,370],[398,374,392],[1051,377,382],[396,378,383],[348,496,183],[295,172,286],[357,269,495],[1148,390,1411],[75,30,225],[206,76,54],[412,386,376],[412,392,386],[396,383,400],[651,114,878],[123,1241,506],[238,311,265],[381,653,29],[618,815,334],[427,1032,411],[298,414,976],[791,332,384],[129,100,140],[412,404,392],[392,404,398],[140,107,360],[395,394,400],[423,379,378],[385,412,376],[406,94,58],[419,415,1021],[422,423,378],[423,125,379],[258,508,238],[311,156,265],[213,287,491],[449,411,1024],[412,1068,404],[55,140,360],[76,414,54],[394,416,400],[400,416,396],[422,378,396],[1258,796,789],[427,411,449],[427,297,1032],[1385,1366,483],[417,448,284],[1507,341,245],[162,140,444],[658,44,81],[433,125,423],[438,251,125],[429,162,439],[1342,57,1348],[765,766,442],[697,891,695],[1057,396,416],[440,423,422],[440,433,423],[433,438,125],[438,196,251],[74,482,211],[1136,79,144],[29,195,424],[242,1004,492],[57,757,28],[414,298,54],[238,348,230],[224,163,124],[295,215,279],[495,269,490],[449,446,427],[446,297,427],[1020,1163,909],[128,138,419],[66,980,443],[415,439,1018],[111,396,1057],[111,422,396],[840,249,831],[593,664,596],[218,550,155],[109,194,180],[483,268,855],[161,415,419],[1737,232,428],[360,107,494],[1006,1011,410],[444,140,55],[919,843,430],[190,242,213],[275,403,410],[131,494,488],[449,663,446],[138,161,419],[128,419,34],[439,162,444],[460,440,422],[440,438,433],[472,74,445],[491,190,213],[238,508,515],[46,206,54],[972,944,962],[1241,1428,1284],[111,460,422],[470,432,806],[248,164,702],[1025,467,453],[553,1235,648],[263,114,881],[267,293,896],[469,438,440],[455,196,438],[287,242,492],[239,265,156],[213,242,287],[1684,746,63],[663,474,446],[415,161,429],[140,100,107],[1055,459,467],[469,455,438],[259,542,277],[446,474,466],[446,466,447],[439,444,1019],[614,109,180],[190,359,181],[156,497,190],[726,474,663],[1023,458,459],[461,440,460],[269,210,490],[246,180,194],[590,133,189],[163,218,155],[467,468,453],[1063,1029,111],[111,1029,460],[1029,464,460],[461,469,440],[150,149,323],[828,445,456],[375,502,261],[474,475,466],[573,426,462],[478,1023,477],[478,458,1023],[458,479,467],[459,458,467],[468,393,453],[464,461,460],[484,365,455],[1232,182,1380],[172,617,214],[547,694,277],[542,547,277],[184,258,238],[261,502,465],[467,479,468],[484,455,469],[1380,182,864],[475,476,466],[80,447,476],[466,476,447],[415,429,439],[479,487,468],[487,287,468],[492,393,468],[260,469,461],[481,365,484],[531,473,931],[692,360,319],[726,495,474],[468,287,492],[480,464,1029],[260,461,464],[494,481,484],[74,472,482],[174,240,212],[223,106,614],[486,477,485],[478,496,458],[491,487,479],[123,402,177],[488,469,260],[488,484,469],[265,239,348],[248,215,285],[474,490,475],[477,486,478],[458,496,479],[239,491,479],[1584,1147,1334],[488,494,484],[401,123,506],[495,490,474],[490,173,475],[80,476,264],[491,287,487],[480,1029,1004],[480,205,464],[173,476,475],[485,194,486],[486,183,478],[478,183,496],[496,239,479],[848,1166,60],[268,262,855],[205,260,464],[260,203,488],[203,131,488],[246,264,476],[194,485,264],[1002,310,1664],[311,515,497],[515,359,497],[565,359,515],[1250,1236,301],[736,456,151],[654,174,567],[577,534,648],[519,505,645],[725,565,508],[150,1723,148],[584,502,505],[584,526,502],[502,526,84],[607,191,682],[560,499,660],[607,517,191],[1038,711,124],[951,672,971],[716,507,356],[868,513,1198],[615,794,608],[682,191,174],[1313,928,1211],[617,241,214],[511,71,91],[408,800,792],[192,286,525],[80,485,447],[91,97,130],[1675,324,888],[207,756,532],[582,1097,1124],[311,497,156],[510,130,146],[523,511,510],[608,708,616],[546,690,650],[511,527,358],[536,146,518],[465,418,550],[418,709,735],[520,514,500],[584,505,519],[536,518,509],[146,536,510],[538,527,511],[876,263,669],[646,524,605],[510,536,523],[527,175,358],[724,876,669],[721,724,674],[524,683,834],[558,509,522],[558,536,509],[523,538,511],[611,243,574],[528,706,556],[668,541,498],[523,537,538],[527,540,175],[532,756,533],[1013,60,747],[551,698,699],[92,520,500],[535,536,558],[536,569,523],[538,540,527],[539,548,175],[567,212,145],[401,896,293],[534,675,639],[1510,595,1507],[557,545,530],[569,536,535],[537,540,538],[540,539,175],[569,537,523],[1135,718,47],[587,681,626],[580,535,558],[99,747,278],[701,565,725],[665,132,514],[665,514,575],[132,549,653],[176,651,189],[65,47,266],[597,569,535],[569,581,537],[537,581,540],[563,539,540],[539,564,548],[1509,1233,1434],[132,653,740],[550,710,155],[714,721,644],[410,1011,188],[732,534,586],[560,562,729],[555,557,222],[580,558,545],[597,535,580],[581,563,540],[5,821,1676],[576,215,136],[649,457,741],[564,539,563],[124,711,224],[550,668,710],[550,541,668],[565,701,673],[560,613,499],[233,532,625],[545,555,580],[601,581,569],[594,904,548],[1463,1425,434],[185,149,1454],[721,674,644],[185,380,149],[577,424,586],[462,586,559],[597,601,569],[594,548,564],[566,603,574],[165,543,544],[457,89,121],[586,424,195],[725,587,606],[1078,582,1124],[588,925,866],[462,559,593],[189,878,590],[555,229,580],[602,563,581],[904,594,956],[434,1425,1438],[1024,112,821],[572,587,626],[600,597,580],[599,591,656],[600,580,229],[601,622,581],[581,622,602],[602,564,563],[602,594,564],[603,611,574],[498,529,546],[697,1145,70],[592,628,626],[610,597,600],[597,610,601],[222,557,171],[604,765,799],[573,462,593],[133,200,176],[729,607,627],[1011,692,188],[518,146,130],[585,687,609],[682,627,607],[1712,599,656],[562,592,607],[643,656,654],[257,600,229],[601,633,622],[623,594,602],[174,212,567],[725,606,701],[609,701,606],[610,633,601],[633,642,622],[380,216,324],[142,143,1249],[501,732,586],[534,577,586],[648,1235,577],[610,641,633],[310,1002,1831],[618,334,604],[1710,145,269],[707,498,659],[501,586,462],[625,501,462],[726,663,691],[300,600,257],[641,610,600],[622,629,602],[602,629,623],[55,692,444],[518,748,509],[929,1515,1411],[620,578,267],[71,511,358],[707,668,498],[650,687,585],[600,300,641],[641,657,633],[1675,888,1669],[622,636,629],[505,502,375],[541,529,498],[332,420,1053],[637,551,638],[534,639,648],[69,623,873],[300,512,641],[633,657,642],[562,660,579],[687,637,638],[709,646,605],[775,738,885],[559,549,132],[646,683,524],[641,512,657],[266,897,949],[1712,643,1657],[184,727,258],[674,724,669],[699,714,647],[628,659,572],[657,662,642],[571,881,651],[517,607,504],[598,706,528],[598,694,547],[640,552,560],[655,693,698],[698,693,721],[91,510,511],[144,301,1136],[324,216,888],[870,764,1681],[575,514,520],[276,544,543],[658,175,44],[645,505,711],[659,546,572],[700,524,655],[605,700,529],[266,867,897],[1695,1526,764],[579,659,628],[654,591,682],[586,549,559],[698,721,714],[896,401,506],[640,734,599],[664,665,575],[621,629,636],[1712,656,643],[547,644,598],[710,668,707],[640,560,734],[655,698,551],[694,528,277],[512,662,657],[504,592,626],[688,584,519],[152,241,617],[587,725,681],[598,669,706],[526,670,84],[598,528,694],[710,707,499],[579,592,562],[660,659,579],[323,324,1134],[326,895,473],[195,29,653],[84,670,915],[560,660,562],[504,626,681],[711,505,224],[651,881,114],[216,620,889],[1362,678,197],[493,99,48],[1659,691,680],[529,690,546],[430,843,709],[655,524,693],[174,191,105],[674,669,598],[98,712,82],[572,546,585],[72,61,71],[912,911,894],[106,223,184],[664,132,665],[843,646,709],[635,699,136],[699,698,714],[593,132,664],[688,526,584],[185,177,620],[533,675,534],[687,638,635],[1652,89,457],[896,506,912],[132,740,514],[689,685,282],[691,449,680],[48,436,493],[136,699,647],[739,640,554],[549,586,653],[532,533,625],[1530,695,649],[653,381,619],[736,151,531],[188,692,241],[177,402,578],[33,689,867],[689,33,685],[593,559,132],[949,65,266],[711,1038,661],[939,480,1004],[609,369,701],[616,552,615],[619,361,740],[151,463,516],[513,521,117],[691,663,449],[186,251,196],[333,302,327],[613,560,552],[616,613,552],[690,551,637],[660,707,659],[704,208,1203],[418,735,550],[163,708,124],[524,834,693],[554,640,599],[245,341,165],[565,673,359],[155,710,708],[105,191,517],[1515,198,1411],[1709,554,599],[60,289,786],[838,1295,1399],[533,534,625],[710,499,708],[556,632,410],[217,620,216],[591,627,682],[504,503,223],[643,654,567],[690,637,650],[545,557,555],[174,654,682],[719,691,1659],[727,681,508],[645,711,661],[794,615,739],[565,515,508],[282,685,302],[1150,397,1149],[638,699,635],[544,685,33],[719,726,691],[1742,1126,1733],[1724,1475,148],[556,410,403],[185,217,380],[503,504,681],[277,556,403],[32,1178,158],[1712,1709,599],[605,529,541],[635,136,369],[687,635,369],[529,700,690],[700,551,690],[89,304,573],[625,534,732],[730,302,685],[503,681,727],[702,673,701],[730,327,302],[327,353,333],[596,664,575],[660,499,707],[585,546,650],[560,729,734],[700,655,551],[176,571,651],[517,504,223],[730,685,544],[1661,1682,726],[1682,495,726],[1250,301,917],[605,524,700],[609,687,369],[516,389,895],[1553,686,1027],[673,702,164],[656,591,654],[520,596,575],[402,123,401],[828,456,728],[1645,677,1653],[528,556,277],[638,551,699],[190,497,359],[276,730,544],[1117,1525,933],[1027,686,1306],[155,708,163],[709,605,541],[647,644,547],[650,637,687],[599,734,591],[578,293,267],[1682,357,495],[510,91,130],[734,729,627],[576,542,215],[709,541,735],[735,541,550],[276,500,730],[500,327,730],[653,619,740],[414,851,454],[734,627,591],[729,562,607],[615,552,640],[525,181,192],[308,512,300],[223,503,727],[266,165,33],[92,500,276],[321,1046,1033],[585,609,606],[1200,1559,86],[628,572,626],[301,436,803],[714,644,647],[708,499,613],[721,693,724],[514,353,327],[353,740,361],[344,158,78],[708,613,616],[615,640,739],[500,514,327],[514,740,353],[1449,177,185],[462,233,625],[851,405,1163],[608,616,615],[647,542,576],[625,732,501],[1097,582,1311],[1235,424,577],[579,628,592],[607,592,504],[24,432,470],[105,614,247],[104,742,471],[542,259,215],[365,196,455],[1420,47,65],[223,727,184],[547,542,647],[572,585,606],[587,572,606],[262,780,1370],[647,576,136],[644,674,598],[271,53,75],[727,508,258],[471,742,142],[505,375,224],[357,1710,269],[725,508,681],[659,498,546],[743,1178,32],[1195,634,231],[1176,24,470],[743,1110,1178],[135,809,857],[63,746,407],[634,1176,470],[159,1112,27],[1176,1685,24],[399,450,779],[1178,856,875],[751,744,54],[436,48,772],[634,1108,1210],[769,1285,1286],[751,298,755],[746,1684,754],[754,924,87],[722,1625,756],[87,839,153],[489,795,820],[758,808,1518],[839,840,153],[831,1111,959],[1111,749,959],[810,1253,1363],[1247,1394,713],[1388,1329,1201],[1242,120,761],[857,791,384],[758,1523,808],[296,764,1504],[70,1652,891],[207,233,1638],[1348,57,28],[858,420,332],[964,1379,1278],[420,1194,816],[784,1076,1186],[1076,21,1186],[1710,767,1],[849,822,778],[806,137,787],[786,790,744],[790,54,744],[771,63,407],[785,852,818],[774,1823,272],[895,151,516],[135,1022,809],[99,826,48],[48,826,755],[808,705,408],[833,441,716],[1733,743,32],[1385,836,852],[772,827,737],[1005,49,781],[793,1697,813],[1518,441,1537],[1139,1132,859],[782,801,770],[1510,1530,676],[770,814,835],[231,787,825],[207,722,756],[26,771,798],[782,863,865],[832,54,790],[865,842,507],[799,765,94],[1175,1261,1353],[800,408,805],[262,986,200],[792,800,814],[801,792,770],[704,1203,1148],[356,1514,822],[165,544,33],[561,776,113],[1043,738,775],[815,831,820],[773,792,801],[772,48,914],[772,737,803],[436,772,803],[808,817,705],[1624,822,1527],[588,1144,788],[799,762,604],[821,1520,1676],[854,803,666],[828,482,472],[445,74,463],[831,489,820],[828,836,482],[716,782,763],[334,815,766],[815,823,766],[334,766,765],[819,805,837],[1716,1521,1412],[1684,924,754],[800,805,819],[1709,829,554],[806,1349,137],[99,1013,747],[341,595,276],[817,810,818],[1176,1691,1685],[763,782,865],[830,846,1052],[865,1499,842],[982,846,1053],[847,832,790],[1178,875,158],[817,818,705],[1302,1392,45],[96,417,284],[223,614,517],[356,507,1514],[1166,848,1179],[1349,432,26],[717,92,276],[770,835,863],[522,509,1745],[847,841,832],[832,841,46],[829,739,554],[802,824,39],[397,1043,775],[1567,849,778],[1385,483,855],[1349,26,1346],[441,801,782],[402,401,293],[1043,667,738],[759,798,1007],[819,837,728],[728,837,828],[837,852,828],[1537,441,833],[148,1475,147],[805,705,837],[716,441,782],[483,1371,780],[814,819,844],[845,753,1336],[1661,719,4],[862,847,790],[737,827,666],[201,46,841],[810,785,818],[408,705,805],[1560,1536,849],[1585,853,1786],[7,1668,807],[7,807,8],[822,1514,1527],[800,819,814],[847,862,841],[991,857,760],[705,818,837],[808,408,773],[402,293,578],[791,858,332],[1480,1228,1240],[814,844,835],[785,1385,852],[1132,120,859],[1743,1726,684],[1704,783,1279],[1623,1694,1731],[959,489,831],[1518,808,773],[862,872,841],[441,773,801],[331,512,308],[380,217,216],[841,872,201],[818,852,837],[448,1480,1240],[856,1108,1195],[1527,1514,1526],[819,182,1232],[871,724,693],[852,836,828],[770,792,814],[803,737,666],[751,826,278],[1674,1727,1699],[849,356,822],[871,693,834],[507,842,1514],[1406,1097,869],[1328,1349,1346],[823,815,795],[744,751,278],[1110,856,1178],[520,717,316],[871,834,683],[884,876,724],[165,266,47],[716,763,507],[216,889,888],[853,1585,1570],[1536,716,356],[886,873,623],[782,770,863],[432,24,26],[683,882,871],[884,724,871],[114,876,884],[516,590,389],[11,1218,1628],[862,113,872],[886,623,629],[830,1052,1120],[762,153,604],[773,408,792],[763,865,507],[153,840,604],[882,884,871],[531,151,326],[886,890,873],[133,262,200],[819,1232,844],[621,636,122],[645,892,519],[1130,1076,784],[114,263,876],[1670,10,1663],[911,670,894],[452,885,872],[872,885,201],[887,882,683],[878,884,882],[590,878,882],[890,867,689],[897,629,621],[897,886,629],[819,728,182],[519,893,688],[894,670,526],[898,894,526],[1536,356,849],[810,1363,785],[878,114,884],[879,888,892],[892,889,893],[893,898,688],[895,683,843],[895,887,683],[889,620,267],[590,882,389],[418,465,84],[949,897,621],[897,890,886],[889,267,893],[898,267,896],[531,326,473],[189,651,878],[843,683,646],[897,867,890],[888,889,892],[893,267,898],[896,894,898],[473,895,843],[895,389,887],[974,706,669],[513,1115,521],[326,151,895],[809,791,857],[211,262,133],[920,923,947],[923,90,947],[90,25,947],[25,972,935],[64,431,899],[52,899,901],[903,905,59],[437,967,73],[839,1242,761],[904,975,44],[917,301,144],[915,670,911],[905,201,885],[1684,63,1685],[1033,1194,288],[950,913,755],[912,918,911],[950,914,913],[506,918,912],[922,919,915],[911,922,915],[1004,451,492],[1263,553,639],[922,911,918],[630,920,947],[916,506,926],[916,918,506],[521,1115,1098],[916,922,918],[919,418,915],[83,38,75],[24,1685,771],[110,1230,1213],[712,8,1837],[922,930,919],[919,430,418],[1395,1402,1187],[930,922,916],[594,623,69],[35,431,968],[35,968,969],[866,924,1684],[1625,1263,675],[631,630,52],[930,931,919],[430,709,418],[302,333,49],[1446,978,1138],[799,1007,798],[931,843,919],[947,25,64],[885,738,667],[1262,963,964],[899,970,901],[1401,946,938],[1117,933,1091],[1685,63,771],[905,948,201],[979,937,980],[951,953,950],[937,270,443],[1154,903,59],[1194,954,1067],[909,405,907],[850,1151,59],[1769,811,1432],[76,206,250],[938,946,966],[965,927,942],[938,966,957],[955,975,904],[927,965,934],[52,51,631],[59,905,667],[431,935,968],[786,289,561],[252,122,671],[481,494,107],[954,1817,1067],[795,25,90],[958,965,945],[795,972,25],[902,983,955],[972,489,944],[1256,29,424],[671,331,945],[946,958,963],[956,955,904],[902,955,956],[671,512,331],[945,331,961],[662,671,122],[671,662,512],[934,65,927],[630,947,52],[666,631,910],[850,59,667],[961,331,234],[1024,411,1042],[890,69,873],[252,671,945],[975,290,940],[283,186,196],[30,283,365],[950,755,298],[946,965,958],[985,290,975],[969,290,985],[405,851,206],[935,431,64],[941,1423,1420],[964,963,167],[942,252,945],[78,757,57],[49,1005,66],[937,979,270],[631,666,827],[980,937,443],[66,689,282],[421,902,956],[947,64,52],[35,979,899],[951,971,953],[762,87,153],[27,31,381],[924,839,87],[946,963,966],[331,308,340],[957,966,1262],[473,843,931],[953,971,920],[270,969,902],[935,962,968],[51,1005,781],[969,983,902],[437,73,940],[69,421,956],[761,249,840],[263,974,669],[962,944,967],[962,437,290],[985,975,955],[907,405,948],[720,957,1262],[25,935,64],[176,200,571],[108,945,50],[250,851,414],[200,986,571],[881,974,263],[827,772,953],[970,899,980],[29,159,27],[234,331,340],[948,405,206],[980,899,979],[986,984,571],[571,984,881],[990,706,974],[946,934,965],[970,980,66],[1113,1486,1554],[984,981,881],[881,987,974],[689,66,443],[1005,901,66],[983,985,955],[165,47,718],[987,990,974],[1370,986,262],[901,970,66],[51,901,1005],[981,987,881],[988,706,990],[942,945,965],[290,437,940],[64,899,52],[988,556,706],[941,934,946],[431,35,899],[996,989,984],[984,989,981],[981,989,987],[35,969,270],[1370,995,986],[986,995,984],[989,999,987],[987,992,990],[992,988,990],[962,967,437],[951,950,976],[979,35,270],[421,270,902],[998,995,1370],[987,999,992],[988,364,556],[969,985,983],[689,443,890],[995,1000,984],[219,958,108],[998,1000,995],[999,997,992],[914,953,772],[845,1336,745],[806,787,231],[1000,996,984],[989,996,999],[50,945,961],[443,421,69],[797,158,779],[1098,1463,434],[996,1009,999],[1001,988,992],[1001,364,988],[903,907,905],[26,759,973],[997,1001,992],[632,364,1001],[1346,26,973],[998,1008,1000],[1000,1009,996],[531,931,736],[252,949,621],[286,388,525],[1174,1008,998],[1009,1010,999],[999,1010,997],[1014,1001,997],[614,105,517],[958,945,108],[525,1004,242],[963,958,219],[233,426,304],[1000,1008,1009],[1010,1014,997],[1001,1006,632],[824,413,39],[642,636,622],[480,388,205],[28,757,797],[1014,1006,1001],[1006,410,632],[975,940,44],[1234,420,858],[54,832,46],[1009,1012,1010],[167,963,219],[41,481,107],[1017,1010,1012],[122,636,662],[939,525,388],[525,939,1004],[950,953,914],[829,1735,739],[1008,880,1015],[1008,1015,1009],[1263,639,675],[956,594,69],[795,90,1347],[1179,848,1013],[759,1007,973],[1009,1015,1012],[1012,1016,1017],[1017,1014,1010],[1019,1011,1006],[927,65,949],[649,316,595],[913,48,755],[976,950,298],[1003,1015,880],[1018,1006,1014],[1021,1018,1014],[444,692,1011],[451,1029,1063],[1185,851,1163],[29,27,381],[181,525,242],[1021,1014,1017],[1016,1021,1017],[1018,1019,1006],[1019,444,1011],[927,949,942],[451,393,492],[903,1154,907],[391,101,57],[94,765,58],[419,1016,1012],[949,252,942],[907,1020,909],[765,442,58],[94,406,908],[1007,94,908],[34,1012,1015],[34,419,1012],[419,1021,1016],[451,1057,393],[907,948,905],[1034,1073,1039],[1061,906,1619],[1068,960,1034],[471,1249,104],[112,1024,1042],[372,379,125],[341,543,165],[141,1094,170],[566,243,1061],[398,1034,1039],[325,317,1823],[1493,296,1724],[850,667,1043],[1054,297,1065],[1619,135,1074],[1061,243,906],[680,1024,821],[1103,96,1245],[1440,1123,1491],[1047,1025,1044],[672,454,1231],[1484,697,1530],[993,672,1231],[178,154,1088],[1044,1041,1066],[112,1062,1058],[1530,649,676],[178,1088,1040],[1046,328,954],[243,244,1022],[954,1194,1033],[1042,411,1032],[971,993,1056],[960,1093,1034],[1754,1338,232],[385,1064,412],[1057,1063,111],[748,1071,1447],[1530,697,695],[971,1056,1270],[977,1059,1211],[649,741,316],[1060,1452,1030],[353,354,1323],[695,768,649],[398,404,1034],[596,316,741],[1836,119,13],[1513,1115,1528],[883,1081,1652],[1039,1073,1048],[462,426,233],[31,1296,354],[1055,1047,1066],[1032,1054,1045],[1521,310,1224],[119,861,13],[1194,1234,288],[1109,1771,1070],[1166,1160,776],[1044,1035,1041],[1026,960,1064],[1050,1032,1045],[1049,1041,387],[115,1013,99],[1046,954,1033],[1321,920,971],[611,1058,345],[1048,1066,1049],[1023,1055,1073],[1029,451,1004],[118,1094,141],[1094,1080,170],[1042,1032,1050],[1026,1064,385],[15,16,1084],[1096,1079,61],[1075,1071,748],[325,1817,328],[909,1163,405],[1022,1234,809],[374,398,1051],[1082,72,81],[1023,1034,1093],[1817,1794,1067],[86,1445,1400],[1507,1535,1510],[1079,1096,1075],[568,1478,1104],[1070,178,1040],[1034,1023,1073],[776,1155,113],[1103,143,142],[1140,81,73],[1082,81,1140],[1060,1030,936],[1040,1086,1109],[370,1065,385],[61,72,1082],[1087,1096,1144],[1040,1088,1086],[1651,812,752],[1062,1050,1045],[187,154,178],[179,187,178],[1099,1344,1101],[1668,1058,807],[1073,1055,1048],[1099,1336,1344],[1283,943,1123],[1049,387,1051],[1024,680,449],[61,1082,1100],[967,749,1111],[1439,1037,88],[742,1505,142],[398,1039,1051],[1107,1336,1099],[1344,1542,1101],[142,1505,1103],[477,1093,447],[477,1023,1093],[471,142,1249],[1041,1035,394],[1328,568,1104],[61,1100,1096],[154,1092,1088],[112,1042,1050],[154,187,168],[435,235,45],[1075,1096,1087],[97,1075,748],[1049,1066,1041],[816,1067,1028],[846,982,1142],[1245,96,284],[1092,154,1080],[1057,451,1063],[387,377,1051],[1055,1025,1047],[1075,1087,1089],[1106,1108,856],[1068,1034,404],[1480,1545,868],[906,135,1619],[1074,991,1095],[570,566,1061],[1025,453,1044],[745,1336,1107],[1035,1057,416],[1092,1102,1129],[1074,135,991],[1105,745,1107],[447,1026,446],[394,387,1041],[73,81,940],[1118,1108,1106],[1210,1108,874],[243,1022,906],[412,1064,1068],[1280,611,603],[960,447,1093],[1051,1039,1049],[1040,1109,1070],[1471,1037,1439],[69,890,443],[1377,703,1374],[1092,1080,1102],[1096,1100,788],[1096,788,1144],[1114,967,1111],[446,1026,297],[70,1112,883],[453,393,1057],[1118,874,1108],[1054,370,1045],[1080,1094,1102],[1039,1048,1049],[428,753,845],[1047,1044,1066],[1044,453,1035],[1472,731,1512],[1126,1121,743],[743,1121,1110],[1032,297,1054],[1480,868,1216],[71,358,72],[1133,967,1114],[1105,1119,745],[1035,453,1057],[1026,447,960],[454,851,1190],[1030,1477,652],[589,816,1028],[1110,1121,1106],[1122,1118,1106],[1116,874,1118],[1048,1055,1066],[1194,1067,816],[744,278,747],[745,1120,845],[845,1052,428],[1105,1780,1119],[1065,297,385],[1098,1529,1463],[731,1060,936],[235,434,812],[1445,1525,1117],[1106,1121,1122],[1122,1127,1118],[1127,1116,1118],[1094,118,1732],[1119,1120,745],[1406,1124,1097],[435,117,235],[1462,1440,1037],[1126,1129,1121],[1088,1092,1129],[1133,73,967],[1120,1052,845],[812,434,752],[1441,1559,1200],[1131,588,413],[1054,1065,370],[235,1098,434],[1052,1142,428],[1737,428,1142],[1496,1446,1483],[1182,1083,1654],[1121,1129,1122],[1732,1116,1127],[768,457,649],[761,1114,249],[1064,960,1068],[1135,1481,1136],[1126,952,1129],[1087,588,1131],[1087,1144,588],[859,788,1139],[1140,1133,1132],[1133,1140,73],[1822,570,1061],[394,1035,416],[1055,1023,459],[80,264,485],[1119,1128,1120],[145,1658,567],[695,891,768],[1129,1102,1122],[1122,1102,1127],[1416,1077,1413],[297,1026,385],[1052,846,1142],[1445,1117,1400],[952,1086,1129],[1714,1089,1131],[1131,1089,1087],[1100,1139,788],[112,1050,1062],[1323,354,1296],[49,333,1141],[1142,982,1737],[79,1457,1091],[1088,1129,1086],[1102,1094,1127],[1127,1094,1732],[1100,1082,1139],[1082,1132,1139],[1082,1140,1132],[1150,1043,397],[60,1166,289],[1696,1146,1698],[1297,1202,1313],[409,1297,1313],[1234,1194,420],[1408,1391,1394],[424,1235,1243],[1203,309,1148],[485,477,447],[1152,1156,850],[1153,1149,1155],[1153,1157,1149],[1149,1152,1150],[1156,1154,1151],[776,1153,1155],[1157,1152,1149],[1217,1393,1208],[1156,1159,1154],[1153,1165,1157],[1165,1152,1157],[1159,1020,1154],[1161,1153,776],[1161,1165,1153],[1165,1158,1152],[1152,1158,1156],[1158,1159,1156],[1166,776,561],[1160,1161,776],[1161,1164,1165],[1161,1160,1164],[1158,1162,1159],[1159,1162,1020],[1270,1321,971],[1164,1170,1165],[1165,1162,1158],[1162,1163,1020],[588,788,925],[1166,1167,1160],[1165,1170,1162],[1160,1167,1164],[1162,1170,1163],[1179,1167,1166],[1167,1168,1164],[1164,1168,1170],[1168,1169,1170],[1234,1022,288],[802,39,866],[1179,1168,1167],[1169,1173,1170],[1170,1173,1163],[1173,1185,1163],[1360,1267,1364],[1169,1185,1173],[611,244,243],[900,1226,1376],[1260,1408,1350],[618,840,831],[1181,1183,1179],[1179,1184,1168],[1208,1274,1291],[1183,1184,1179],[1168,1184,1169],[1387,1395,1254],[1208,1204,1172],[1182,1197,1083],[1187,1083,1197],[1213,1183,1181],[1169,1207,1185],[135,857,991],[1013,1213,1181],[1189,1183,1213],[1183,1189,1184],[1169,1184,1207],[1207,1190,1185],[1180,1389,1288],[1191,1192,1640],[1640,1192,1090],[1090,1205,1654],[1654,1205,1182],[1188,1395,1187],[1126,743,1733],[788,859,925],[809,1234,1171],[1193,1197,1182],[1189,1199,1184],[1639,1191,1637],[1639,1212,1191],[1205,1193,1182],[1198,1187,1197],[1199,1207,1184],[332,1053,846],[1090,1192,1205],[117,1188,1187],[435,1188,117],[435,1206,1188],[1199,1189,1213],[420,816,1053],[1212,1215,1191],[117,1187,1198],[45,1206,435],[120,1132,1133],[874,1116,1210],[1191,1215,1192],[1193,1216,1197],[1216,1198,1197],[1199,1214,1207],[117,521,235],[1220,1311,1078],[1220,900,1311],[1653,1215,1212],[1192,1225,1205],[1205,1209,1193],[1209,1216,1193],[1389,1217,1172],[1207,1214,454],[171,557,1747],[1805,1078,1787],[1805,1219,1078],[1198,1216,868],[666,910,854],[1230,1231,1213],[1213,1231,1199],[1199,1231,1214],[1219,1220,1078],[1215,1221,1192],[1192,1221,1225],[1225,1228,1205],[1205,1228,1209],[1209,1228,1216],[1464,1325,1223],[1215,1227,1221],[1228,1480,1216],[1226,1653,1376],[1653,1249,1215],[1221,1240,1225],[1225,1240,1228],[839,761,840],[1238,1219,1805],[1238,1220,1219],[1232,1380,1375],[1226,1249,1653],[1221,1227,1240],[233,207,532],[110,1236,1230],[1248,1231,1230],[1231,454,1214],[1249,1227,1215],[1248,1056,1231],[489,959,944],[448,1240,284],[925,859,1242],[1805,1244,1238],[1252,1220,1238],[1252,921,1220],[1236,1251,1230],[1230,1251,1248],[1056,993,1231],[1031,1264,1263],[68,1186,157],[1227,1245,1240],[1103,1245,143],[1243,1235,612],[1252,95,921],[1249,1226,1237],[1390,1387,1254],[1120,384,830],[830,332,846],[1227,143,1245],[1315,1369,1358],[1356,1269,1386],[972,795,489],[1831,1224,310],[1250,1255,1251],[1251,1056,1248],[1256,1243,103],[658,358,175],[1620,1238,1244],[1620,1252,1238],[1506,95,1252],[104,1249,1237],[1249,143,1227],[1268,1419,1329],[634,806,231],[618,831,815],[924,1242,839],[1255,1270,1251],[1251,1270,1056],[866,925,1242],[103,29,1256],[424,1243,1256],[134,1651,752],[1250,917,1255],[1172,1204,1260],[1352,1036,1276],[1265,1201,1329],[804,1282,1259],[1259,1294,723],[335,1330,1305],[407,762,799],[875,856,1195],[32,158,344],[967,944,749],[372,125,42],[1175,1354,1261],[553,612,1235],[1259,1273,1294],[1294,1283,723],[757,78,158],[407,799,798],[901,51,52],[139,1386,1389],[1386,1269,1389],[1389,1269,1217],[1148,1590,1268],[1428,1449,1450],[804,1281,1282],[1273,1259,1282],[158,399,779],[771,407,798],[521,1098,235],[917,1312,1255],[1312,1270,1255],[1217,1269,1393],[1195,1108,634],[1110,1106,856],[1210,1691,1176],[27,1112,1145],[1296,27,1145],[1171,858,791],[704,1148,1290],[1430,1436,1437],[1282,1308,1273],[1300,943,1283],[1393,1355,1274],[720,1278,769],[1287,1059,1399],[1310,1388,1272],[1312,1321,1270],[851,1185,1190],[1296,1145,1304],[26,24,771],[51,910,631],[1329,1290,1268],[1290,1148,1268],[1298,1293,733],[1281,1293,1282],[1282,1293,1308],[1308,1299,1273],[1300,1283,1294],[1340,943,1300],[1340,1301,943],[407,754,762],[1287,1399,1295],[34,139,128],[1288,1172,1260],[120,1133,1114],[1306,1113,1511],[1464,1223,1292],[1299,1294,1273],[1299,1300,1294],[1286,1295,838],[1285,1247,1286],[1247,713,1286],[1201,1265,1390],[1378,1368,1357],[1482,1320,917],[917,1320,1312],[850,1156,1151],[588,39,413],[1324,1306,686],[789,1365,928],[1223,1326,1292],[1292,1326,1298],[869,1097,1311],[790,786,561],[1323,1304,932],[1323,1296,1304],[1317,1324,686],[1306,368,1113],[1325,1342,1223],[1326,1348,1298],[1293,1327,1308],[1308,1318,1299],[704,1290,1258],[1320,1321,1312],[761,120,1114],[1684,802,866],[1674,6,1727],[1316,1323,932],[1335,1337,1305],[1348,1327,1293],[1298,1348,1293],[1333,1300,1299],[1333,1343,1300],[1328,1301,1340],[1328,1314,1301],[838,1399,1319],[921,1237,900],[409,1391,1408],[1376,1653,677],[1281,804,1458],[1331,1324,1317],[1324,368,1306],[368,1338,1307],[1327,797,1308],[797,1345,1308],[1308,1345,1318],[1318,1333,1299],[1341,1147,1572],[923,1321,1320],[923,920,1321],[39,588,866],[1141,1323,1316],[1330,1335,1305],[1337,1335,1336],[1339,1332,1325],[1223,1342,1326],[1342,1348,1326],[1348,797,1327],[1345,1333,1318],[1343,1340,1300],[1419,1265,1329],[1347,1320,1584],[1535,1141,1316],[1078,1311,582],[1344,1335,1330],[753,1331,1337],[368,1324,1331],[753,368,1331],[1332,1485,1325],[1325,1485,1342],[787,1343,1333],[137,1328,1340],[973,1341,1479],[406,1147,1341],[1171,1234,858],[1141,1535,1322],[49,1141,1322],[1344,1336,1335],[973,908,1341],[766,1347,1584],[1347,923,1320],[781,49,1322],[368,232,1338],[787,1340,1343],[787,137,1340],[568,1346,973],[58,1147,406],[442,1334,1147],[58,442,1147],[442,766,1334],[90,923,1347],[428,368,753],[779,1333,1345],[825,787,1333],[137,1349,1328],[1328,1346,568],[908,406,1341],[924,866,1242],[1336,753,1337],[428,232,368],[1115,777,1098],[1348,28,797],[797,779,1345],[779,825,1333],[1007,908,973],[583,1351,880],[1365,1246,977],[1658,145,1710],[1310,796,1388],[718,245,165],[1302,1272,1254],[1174,1351,583],[1174,715,1351],[1358,1260,1204],[1374,1373,1276],[1377,1374,1276],[678,1362,1382],[1377,1276,254],[139,34,40],[1008,1174,583],[1396,1286,1319],[768,891,457],[1316,932,1535],[1289,1371,1360],[182,736,864],[1355,1364,1274],[860,1367,1354],[1362,1222,1382],[1376,869,1311],[1590,1411,198],[1232,1375,877],[1394,1295,1286],[880,1356,1386],[880,1351,1356],[1211,1059,1287],[197,678,1405],[880,1386,1003],[1368,1253,1357],[1357,1253,1036],[715,1289,1364],[1354,1367,703],[1383,877,1375],[1266,1288,1260],[1373,1374,703],[1372,1289,1174],[1303,1366,1378],[1351,715,1355],[1665,1666,624],[1309,1357,1036],[900,1237,1226],[1174,1289,715],[1337,1331,1317],[1360,1303,1359],[1267,1354,1175],[1241,1284,1414],[1377,254,929],[1385,855,836],[1396,1319,1436],[1361,1366,1303],[1381,1368,1378],[1313,1211,1391],[1368,1385,1363],[813,82,861],[1058,1280,807],[893,519,892],[1359,1303,860],[1382,1350,1247],[1371,1303,1360],[1267,1175,1271],[769,1286,1396],[712,1837,82],[1366,1385,1381],[1365,796,1310],[1003,1386,40],[780,1371,1370],[561,862,790],[1284,1380,864],[1449,1428,177],[611,1280,1058],[1284,1375,1380],[926,506,1241],[1305,1337,1317],[309,1203,208],[1388,1201,1390],[1309,1036,1352],[1377,929,1411],[1399,1059,1257],[1112,70,1145],[289,1166,561],[1288,1389,1172],[1362,37,1180],[713,1394,1286],[1355,1393,1269],[1401,1423,941],[1274,1271,1384],[860,1378,1367],[715,1364,1355],[677,1406,869],[1297,1358,1202],[1388,1258,1329],[1180,1288,1266],[1008,583,880],[1524,1425,1463],[1390,1403,1387],[1278,1379,1247],[1278,1247,1285],[964,1278,1262],[1358,1369,1202],[1715,1699,1726],[926,1241,1414],[1341,1572,1479],[926,930,916],[1397,51,781],[409,1358,1297],[1236,436,301],[1376,677,869],[1351,1355,1356],[758,1534,1523],[1378,1357,1367],[977,1211,1365],[1135,1136,854],[1394,1391,1295],[1266,1260,1222],[1365,1302,1246],[1232,877,844],[736,930,864],[1408,1358,409],[1508,817,1523],[1381,1385,1368],[718,854,910],[854,718,1135],[1382,1222,1350],[1391,1211,1287],[1391,1287,1295],[1257,1651,134],[1414,1284,864],[1291,1369,1315],[1202,928,1313],[86,1400,1413],[1413,1200,86],[1263,1625,1031],[1413,1400,1404],[1002,1664,1834],[930,926,1414],[1399,1257,134],[520,316,596],[1393,1274,1208],[1657,1655,1712],[1407,1404,1400],[1404,1410,1413],[1649,1229,1406],[1362,1266,1222],[1384,1271,1175],[900,1376,1311],[1274,1384,1291],[1291,1384,1431],[1433,1396,1436],[1267,1359,1354],[309,1353,703],[838,1319,1286],[1407,1410,1404],[441,1518,773],[1241,123,1428],[1622,1521,1224],[1217,1208,1172],[1130,793,1076],[425,1409,1481],[1481,1409,1533],[1303,1378,860],[1350,1408,1394],[1246,1651,977],[1289,1360,1364],[1727,1694,1623],[1417,1407,1533],[1417,1410,1407],[1406,1650,1649],[1319,134,1437],[1414,864,930],[1406,1229,1124],[1354,1359,860],[1433,769,1396],[1417,1533,1409],[1416,1413,1410],[1415,1416,1410],[95,1237,921],[1392,1254,1395],[1360,1359,1267],[1258,1290,1329],[1180,128,1389],[1420,1409,425],[1417,1418,1410],[1418,1415,1410],[1422,1077,1416],[1247,1350,1394],[37,43,1180],[1204,1315,1358],[1428,1383,1375],[1356,1355,1269],[1409,1418,1417],[1302,45,1246],[1421,1416,1415],[1421,1422,1416],[1422,1494,1077],[957,720,938],[1423,1409,1420],[1423,1418,1409],[752,434,1438],[1260,1358,1408],[1363,1385,785],[1423,1426,1418],[1426,1424,1418],[1229,1649,1124],[1222,1260,1350],[1508,1523,1137],[1278,1285,769],[1482,917,144],[1418,1424,1415],[1425,1422,1421],[1425,1524,1422],[1272,1388,1390],[1391,409,1313],[1378,1366,1381],[1371,483,1361],[720,1262,1278],[29,103,159],[1271,1364,1267],[1424,1427,1415],[1537,1522,1518],[134,752,1438],[1420,934,941],[1428,1375,1284],[1277,1224,1831],[1362,1180,1266],[1401,1426,1423],[1577,1369,1291],[268,483,262],[1383,1450,1456],[1384,1175,1431],[1430,1415,1427],[1430,1421,1415],[1430,1425,1421],[1379,1382,1247],[1252,1553,1429],[1206,1392,1395],[1433,1430,1427],[309,208,1353],[1272,1390,1254],[1361,483,1366],[1523,817,808],[1302,1254,1392],[1371,1361,1303],[1426,1435,1424],[1435,1433,1424],[1433,1427,1424],[720,769,1433],[796,1258,1388],[1590,1419,1268],[1289,1372,1371],[1305,1317,1509],[998,1372,1174],[40,1386,139],[1261,1354,703],[1364,1271,1274],[134,1438,1437],[1436,1319,1437],[1317,686,1509],[1484,932,1304],[1434,1432,1509],[1420,65,934],[931,930,736],[1367,1357,1309],[1372,1370,1371],[1204,1208,1315],[1426,938,1435],[1368,1363,1253],[1207,454,1190],[1302,1310,1272],[309,1377,390],[390,1377,1411],[1370,1372,998],[1411,1590,1148],[720,1433,1435],[1450,1383,1428],[1379,678,1382],[1405,678,1379],[1208,1291,1315],[1399,134,1319],[1367,1309,1373],[1373,1352,1276],[596,741,593],[553,1264,612],[1433,1436,1430],[1437,1438,1430],[964,1405,1379],[1373,1309,1352],[1265,1403,1390],[1233,1618,1434],[1365,1310,1302],[789,796,1365],[720,1435,938],[128,139,1389],[1466,933,1525],[1191,1640,1637],[1314,1442,943],[1141,353,1323],[1489,1138,1474],[1462,1477,1440],[1474,1138,1488],[1442,1314,1443],[1446,1030,1546],[1484,1145,697],[1549,1443,1445],[1470,1572,1468],[1397,1239,1507],[1649,1825,1824],[1259,1440,1477],[1451,1450,1449],[978,1446,652],[1454,1456,1451],[1451,1456,1450],[341,1507,595],[933,1547,79],[804,1452,1060],[1454,1455,1456],[1398,1460,1454],[1455,877,1456],[1277,1831,1825],[804,1060,1458],[1339,1459,1595],[1314,1104,1443],[933,1448,1547],[147,1460,1398],[1460,1461,1454],[1454,1461,1455],[1292,1125,1464],[417,1531,1480],[1459,1339,1325],[811,1756,335],[1512,936,1490],[777,1529,1098],[147,1475,1460],[1464,253,1459],[836,855,482],[1487,1486,1307],[1104,1501,1443],[1439,1200,1532],[1475,1469,1460],[1460,1469,1461],[1325,1464,1459],[1277,1825,1649],[1532,1200,1077],[844,877,1455],[1572,933,1466],[1479,568,973],[1509,335,1305],[1339,1595,1759],[1469,1476,1461],[1461,1476,1455],[1104,1470,1468],[1464,1472,253],[1117,1091,1407],[1756,1542,335],[1206,1395,1188],[335,1542,1330],[835,844,1455],[1471,1598,1462],[1491,1442,1441],[835,1455,1476],[1441,1442,1443],[1489,1474,1473],[1251,1236,1250],[1030,1452,1477],[1598,1439,1532],[978,1598,1492],[1426,1401,938],[1448,1584,1482],[1724,1497,1475],[1475,1497,1469],[1484,1535,932],[1307,1486,1113],[1487,696,1495],[1037,1491,1441],[1030,1446,936],[1453,1487,1495],[696,1467,1495],[1138,1489,1483],[1497,1143,1469],[1469,1143,1476],[652,1598,978],[850,1043,1150],[1482,1584,1320],[1731,98,1697],[1113,1554,1573],[1524,1532,1494],[1496,1467,696],[1452,1259,1477],[296,1504,1497],[1504,1143,1497],[1143,1499,1476],[718,910,1498],[868,1540,1528],[817,1253,810],[1490,696,1487],[1440,1491,1037],[1510,676,595],[1488,1492,1517],[781,1239,1397],[1467,1519,1503],[1500,1307,1759],[1149,397,452],[1504,1514,1143],[1514,842,1143],[1125,733,1458],[1503,1531,1555],[1276,1036,1137],[1440,723,1123],[1036,1508,1137],[817,1508,1253],[103,883,1112],[1458,731,1472],[1512,1490,1487],[1487,1453,1486],[1138,978,1488],[1036,1253,1508],[1398,149,147],[1474,1517,1513],[1125,1458,1472],[1486,1453,1554],[1518,1534,758],[345,1058,1062],[928,1202,1369],[1554,1541,1505],[1464,1125,1472],[1504,764,1514],[304,426,573],[1505,742,1506],[1479,1572,1478],[1519,1483,1489],[833,716,1069],[1522,1534,1518],[1115,1513,777],[811,335,1432],[1591,1533,1407],[777,1517,1529],[1513,1517,777],[1498,910,1397],[1069,1539,833],[833,1539,1537],[1522,1551,1534],[1534,1551,1523],[1538,1137,1523],[910,51,1397],[1367,1373,703],[1466,1525,1468],[157,1186,1832],[1429,1511,1506],[1573,1505,1506],[1259,1452,804],[1503,1495,1467],[262,483,780],[1572,1466,1468],[1536,1556,716],[716,1556,1069],[1544,1523,1551],[1544,1538,1523],[1511,1573,1506],[933,1572,1448],[1543,1537,1539],[1537,1543,1522],[1091,933,79],[1519,1540,1545],[1549,1445,86],[1069,1548,1539],[1548,1543,1539],[1543,1551,1522],[1500,1487,1307],[68,784,1186],[1552,1544,1551],[1550,1538,1544],[1538,1550,1137],[1519,1473,1540],[1547,1448,1482],[1560,1563,1536],[1536,1563,1556],[1556,1548,1069],[1543,1558,1551],[1137,1550,1276],[1453,1495,1555],[1561,1543,1548],[1543,1561,1558],[1558,1566,1551],[1552,1550,1544],[1569,1557,1550],[1557,1276,1550],[1276,1557,254],[1531,1503,1480],[1535,1530,1510],[1545,1503,1519],[1547,1482,79],[1566,1552,1551],[1552,1569,1550],[1503,1545,1480],[703,1377,309],[1625,675,756],[1037,1441,88],[929,254,1557],[849,1567,1560],[1556,1564,1548],[1492,1529,1517],[1252,1429,1506],[1553,1027,1429],[1453,1555,1541],[1554,1453,1541],[1233,686,1553],[1328,1104,1314],[1564,1576,1548],[1548,1576,1561],[1557,1562,929],[1520,112,1668],[1483,1446,1138],[778,1570,1567],[1563,1564,1556],[1561,1565,1558],[1565,1566,1558],[1569,1552,1566],[1562,1557,1569],[1530,1535,1484],[1387,1402,1395],[1621,1634,1387],[1567,1568,1560],[1560,1568,1563],[1571,1569,1566],[1344,1330,1542],[1577,1431,1353],[1638,233,304],[1524,1463,1529],[1353,1431,1175],[1077,1200,1413],[1478,1470,1104],[1568,1575,1563],[1563,1575,1564],[1575,1576,1564],[1561,1576,1565],[1565,1574,1566],[1562,1515,929],[1555,96,1541],[1531,417,96],[1555,1531,96],[1246,45,1651],[208,1577,1353],[1586,1568,1567],[1574,1571,1566],[1571,1583,1569],[1474,1513,1528],[1239,1322,1535],[1478,1572,1470],[1570,1586,1567],[1488,1517,1474],[8,1833,1837],[1123,1442,1491],[1589,1568,1586],[1576,1594,1565],[1565,1594,1574],[1562,198,1515],[1559,1441,1549],[1441,1443,1549],[1135,425,1481],[1239,1535,1507],[1595,1487,1500],[1570,1585,1586],[1589,1578,1568],[1568,1578,1575],[1579,1569,1583],[1177,1577,208],[115,1236,110],[1578,1593,1575],[1587,1576,1575],[1576,1581,1594],[1571,1582,1583],[1588,1579,1583],[1579,1580,1562],[1569,1579,1562],[1562,1580,198],[1027,1511,1429],[1589,1593,1578],[1587,1581,1576],[1582,1574,1594],[1574,1582,1571],[1575,1593,1587],[1583,1582,1588],[1580,1590,198],[1587,1593,1581],[1505,1541,96],[1369,1577,1177],[1573,1554,1505],[1479,1478,568],[1585,1589,1586],[1369,1177,704],[766,1584,1334],[977,1257,1059],[1091,1591,1407],[1591,1091,1457],[1585,1604,1589],[1581,1592,1594],[1602,1582,1594],[1582,1608,1588],[1608,1579,1588],[1579,1597,1580],[1419,1590,1580],[1597,1419,1580],[1431,1577,1291],[1589,1604,1593],[1601,1596,1593],[1593,1596,1581],[1306,1511,1027],[1511,1113,1573],[1786,1412,1585],[1412,1604,1585],[1581,1596,1592],[1592,1602,1594],[1608,1599,1579],[1599,1611,1579],[1579,1611,1597],[1512,1487,253],[1519,1489,1473],[1545,1540,868],[1083,1187,1402],[1117,1407,1400],[1292,733,1125],[284,1240,1245],[1604,1600,1593],[1600,1601,1593],[1582,1607,1608],[789,1369,704],[1467,1483,1519],[1601,1613,1596],[1596,1613,1592],[1602,1607,1582],[1620,1553,1252],[1601,1605,1613],[1592,1613,1602],[1602,1606,1607],[1608,1609,1599],[1599,1609,1611],[1603,1597,1611],[1265,1419,1597],[1603,1265,1597],[1392,1206,45],[928,1369,789],[1474,1528,1473],[1104,1468,1501],[1412,1521,1604],[1613,1631,1602],[1607,1610,1608],[1608,1610,1609],[1476,863,835],[1495,1503,1555],[1498,1397,718],[1520,1668,7],[1604,1615,1600],[1605,1601,1600],[1602,1631,1606],[1606,1610,1607],[1759,1595,1500],[1292,1298,733],[1615,1604,1521],[1609,1603,1611],[652,1462,1598],[1468,1525,1445],[1443,1501,1445],[1134,1723,150],[1521,1622,1615],[1615,1616,1600],[1616,1605,1600],[1605,1616,1612],[1605,1612,1613],[1612,1617,1613],[1613,1617,1631],[1606,1614,1610],[1265,1603,1403],[448,417,1480],[1595,253,1487],[1501,1468,1445],[1383,1456,877],[1490,1496,696],[1610,1627,1609],[1627,1621,1609],[1591,1481,1533],[1598,1471,1439],[1353,1261,703],[1606,1631,1614],[1609,1621,1403],[1532,1077,1494],[1528,1115,513],[1546,652,1446],[1211,928,1365],[1540,1473,1528],[1078,1502,1787],[1425,1430,1438],[1617,1630,1631],[959,749,944],[566,570,603],[1716,310,1521],[775,452,397],[1615,1636,1616],[1616,1636,1612],[1610,1632,1627],[789,704,1258],[1457,1481,1591],[1769,1756,811],[207,1629,722],[1629,1625,722],[1224,1277,1622],[1622,1636,1615],[1636,1646,1612],[1612,1630,1617],[1631,1626,1614],[1614,1632,1610],[1506,104,95],[1481,1457,1136],[1123,943,1442],[936,1446,1496],[1499,863,1476],[1629,1031,1625],[1233,1509,686],[1633,1634,1621],[1621,1387,1403],[1472,1512,253],[1177,208,704],[1277,1636,1622],[1626,1632,1614],[1627,1633,1621],[936,1496,1490],[185,1454,1451],[731,936,1512],[1638,1635,207],[553,1263,1264],[1653,1212,1639],[1633,1627,1632],[1633,1387,1634],[1458,1060,731],[368,1307,1113],[1264,1031,1629],[1152,850,1150],[1277,1644,1636],[1646,1637,1612],[1637,1630,1612],[1647,1631,1630],[1647,1626,1631],[1422,1524,1494],[1030,652,1546],[1635,1629,207],[1635,1264,1629],[1639,1646,1636],[1637,1640,1630],[1641,1632,1626],[1632,1642,1633],[1633,1643,1387],[842,1499,1143],[865,863,1499],[1516,978,1492],[67,1130,784],[1103,1505,96],[88,1441,1200],[1644,1639,1636],[1640,1647,1630],[1647,1641,1626],[1633,1648,1643],[1492,1532,1524],[1488,1516,1492],[1037,1471,1462],[612,1264,1635],[1502,1078,1124],[1641,1642,1632],[1648,1633,1642],[1528,513,868],[1492,1598,1532],[1095,991,760],[679,157,1664],[760,1128,1785],[1277,1650,1644],[320,1022,244],[1559,1549,86],[1676,1520,7],[1488,978,1516],[1095,760,1785],[1128,384,1120],[304,312,1638],[1081,1638,312],[1081,1635,1638],[103,612,1635],[652,1477,1462],[1650,1645,1644],[1645,1639,1644],[1639,1637,1646],[1640,1090,1647],[1654,1641,1647],[1654,1642,1641],[1654,1648,1642],[1643,1402,1387],[1432,335,1509],[384,1128,760],[1652,312,304],[103,1243,612],[1277,1649,1650],[1090,1654,1647],[1643,1648,1402],[1134,324,1675],[679,68,157],[1652,1081,312],[1136,301,803],[1653,1639,1645],[723,1440,1259],[803,854,1136],[104,1506,742],[1112,159,103],[1654,1083,1648],[977,1651,1257],[1397,1507,718],[1081,103,1635],[1650,677,1645],[1083,1402,1648],[1706,1655,1671],[1624,1704,1711],[767,2,1],[608,794,294],[1678,1683,1686],[767,1682,2],[1669,1692,1675],[296,1681,764],[1671,1656,1672],[17,1673,1679],[1706,1671,1673],[1662,1674,1699],[1655,1657,1656],[418,84,915],[1526,1514,764],[1658,1657,567],[870,1695,764],[813,1697,98],[1659,821,5],[60,1013,848],[1013,110,1213],[661,1038,1692],[1660,1703,17],[1693,1673,17],[1663,1715,1743],[1013,115,110],[344,1733,32],[1670,1663,1743],[1670,1743,1738],[1677,1670,1738],[1661,4,3],[1084,1683,1678],[1728,793,1130],[1683,1767,1196],[1677,1738,1196],[1279,1786,853],[294,1038,608],[1279,1689,1786],[870,18,1708],[870,1680,1695],[1705,10,1670],[1084,1767,1683],[1196,1738,1686],[1750,870,1681],[1750,18,870],[1773,1703,1660],[1135,47,425],[150,323,1134],[1707,1655,1706],[1741,344,1687],[1685,1691,1684],[1684,1691,802],[1672,1656,0],[1038,124,608],[1671,1672,1690],[1628,1218,1767],[1686,1275,1667],[1493,1750,1681],[1773,18,1750],[1773,1660,18],[1679,1671,16],[1735,1706,1673],[1667,1678,1686],[1688,1658,1],[1656,1688,0],[1293,1281,1458],[1698,1678,1667],[1696,1130,1722],[1698,1667,1696],[1715,1662,1699],[1692,1038,294],[1682,767,357],[1669,661,1692],[802,1702,824],[1028,1067,1784],[822,1624,778],[119,813,861],[1218,1670,1677],[1703,1693,17],[1658,1710,1],[750,1730,1729],[1701,750,1729],[1693,1735,1673],[1731,1694,98],[1691,1702,802],[783,1729,1719],[1680,870,1708],[1707,1709,1655],[533,756,675],[1691,1210,1702],[11,1705,1670],[1767,1218,1196],[1218,1677,1196],[1664,1716,1721],[1729,1725,1719],[1729,1072,1725],[1210,1116,1702],[1702,1720,824],[1682,1661,2],[1713,1719,1721],[1716,1786,1713],[1730,1722,1072],[294,1717,1811],[1692,294,1666],[1659,680,821],[824,1720,1714],[1726,1731,1718],[345,1062,1045],[1738,1743,1275],[1075,1089,1071],[783,1719,1689],[1275,684,1728],[1692,1666,1665],[1675,1692,1665],[294,1811,1666],[1716,1664,310],[1678,1698,1700],[6,9,1727],[676,649,595],[381,31,361],[1723,1804,1772],[1727,9,1694],[1720,1089,1714],[1786,1716,1412],[1683,1196,1686],[1718,1697,1085],[1116,1739,1702],[1739,1734,1720],[1702,1739,1720],[1089,1720,1734],[509,748,1745],[1743,1715,1726],[1717,294,794],[1116,1732,1739],[1718,1731,1697],[1696,1667,1130],[1134,1665,1723],[1694,712,98],[101,1687,102],[391,1736,101],[662,636,642],[1734,1447,1089],[1089,1447,1071],[436,99,493],[1689,1279,783],[1485,1465,1342],[1736,1687,101],[344,1741,1733],[1741,1742,1733],[1735,829,1706],[829,1707,1706],[1485,1332,1465],[952,1126,1742],[1747,1447,1734],[879,892,645],[1730,1146,1696],[829,1709,1707],[1709,1712,1655],[118,1739,1732],[1332,1744,1465],[1687,1749,1741],[1741,1758,1742],[679,1072,68],[1072,1722,68],[118,1747,1739],[1747,1734,1739],[1465,1744,1736],[1736,1740,1687],[1704,1701,783],[1665,624,1723],[1722,1130,67],[1025,1055,467],[1444,14,1701],[558,522,530],[1657,1658,1688],[1339,1746,1332],[1332,1748,1744],[1687,1740,1749],[1741,1749,1758],[1109,952,1742],[1747,118,141],[1671,1690,1628],[1671,1628,16],[1657,1688,1656],[1745,748,1447],[357,767,1710],[1746,1748,1332],[1146,1700,1698],[1759,1307,1338],[1239,781,1322],[1745,1447,1747],[522,1745,1747],[316,717,595],[148,1493,1724],[1758,1109,1742],[1725,1072,679],[726,719,1661],[1695,1680,1526],[1772,1750,1493],[148,1772,1493],[1542,1751,1101],[952,1109,1086],[1744,1752,1736],[1736,1752,1740],[1753,1755,1740],[391,1342,1736],[821,112,1520],[557,530,1747],[530,522,1747],[994,879,645],[1542,1756,1751],[1813,1693,1703],[1746,1754,1748],[1748,1764,1744],[1752,1757,1740],[1740,1757,1753],[1749,1740,1755],[1755,1763,1749],[1763,1758,1749],[1275,1743,684],[1813,1735,1693],[1107,1099,1101],[1723,624,1804],[1403,1603,1609],[1748,1754,1764],[1744,1757,1752],[1760,1109,1758],[1465,1736,1342],[436,115,99],[1686,1738,1275],[1751,1766,1101],[1759,1754,1746],[1755,1753,1763],[1570,1279,853],[1701,1146,750],[1655,1656,1671],[11,1670,1218],[1761,1751,1756],[1766,1107,1101],[1726,1623,1731],[1711,1704,1279],[67,784,68],[558,530,545],[1620,1618,1233],[1769,1761,1756],[102,1687,344],[1338,1754,1759],[1754,232,1764],[1744,1765,1757],[1757,1763,1753],[1762,1760,1758],[1760,1771,1109],[1339,1759,1746],[1675,1665,1134],[1730,1696,1722],[1774,1751,1761],[1766,1780,1107],[1780,1105,1107],[1764,1765,1744],[1763,1762,1758],[1772,1773,1750],[1811,1813,1703],[1434,1769,1432],[1780,1766,1751],[232,1781,1764],[1711,1279,1570],[1688,1,0],[1774,1780,1751],[1764,1781,1765],[1765,1768,1757],[1757,1768,1763],[1777,1782,1760],[1762,1777,1760],[1769,1774,1761],[1763,1777,1762],[1760,1782,1771],[232,1737,1781],[1768,1776,1763],[272,255,774],[1669,994,661],[1618,1769,1434],[1765,589,1768],[1770,1777,1763],[1701,1729,783],[1783,1774,1769],[1789,1780,1774],[589,1775,1768],[1776,1770,1763],[1782,1778,1771],[1771,1778,1070],[624,1703,1773],[624,1811,1703],[1620,1244,1618],[1779,1769,1618],[1779,1783,1769],[739,1735,1813],[1775,1776,1768],[1790,1777,1770],[1777,1778,1782],[1725,679,1721],[733,1293,1458],[1802,1618,1244],[1802,1779,1618],[1788,1783,1779],[1789,1774,1783],[1796,1780,1789],[1796,1119,1780],[1823,1817,325],[1699,1727,1623],[750,1146,1730],[1497,1724,296],[1128,1119,1796],[61,62,71],[1131,413,824],[1114,1111,249],[1784,1776,1775],[1123,723,1283],[1791,1788,1779],[1788,1789,1783],[1095,1797,1074],[1028,1784,1775],[1784,1770,1776],[1777,1790,1778],[1793,1797,1095],[1797,1800,1074],[1798,1790,1770],[1805,1802,1244],[1802,1791,1779],[1792,1789,1788],[1793,1785,1128],[1793,1095,1785],[1074,1800,1619],[741,457,593],[1798,1770,1784],[1798,1794,1790],[1786,1689,1713],[684,1726,1718],[1728,1085,793],[1795,1787,1502],[1806,1802,1805],[1819,1788,1791],[1067,1798,1784],[1790,1794,1778],[1795,1502,1124],[1801,1805,1787],[1807,1791,1802],[1807,1819,1791],[1819,1792,1788],[1799,1128,1796],[994,645,661],[684,1085,1728],[684,1718,1085],[1699,1623,1726],[1801,1787,1795],[1808,1789,1792],[1808,1796,1789],[1799,1793,1128],[1809,1797,1793],[1809,1803,1797],[1803,1800,1797],[1067,1794,1798],[774,255,1778],[1673,1671,1679],[879,1669,888],[19,1807,1802],[1810,1619,1800],[879,994,1669],[1794,774,1778],[1723,1772,148],[1804,1773,1772],[1814,1795,1124],[1649,1814,1124],[1814,1801,1795],[1812,1806,1805],[19,1802,1806],[19,1819,1807],[1810,1800,1803],[1804,624,1773],[1714,1131,824],[1801,1812,1805],[1812,19,1806],[1808,1792,1819],[1799,1809,1793],[1821,1810,1803],[1717,739,1813],[1061,1619,1822],[1794,1817,774],[79,1482,144],[1815,1801,1814],[23,1819,19],[589,1028,1775],[1817,1823,774],[1689,1719,1713],[1824,1814,1649],[1827,1818,1801],[1818,1812,1801],[1818,19,1812],[1818,20,19],[1816,1809,1799],[1821,1803,1809],[1822,1619,1810],[124,708,608],[1663,10,1715],[1815,1827,1801],[1820,1808,1819],[23,1820,1819],[603,1810,1821],[603,1822,1810],[1085,1697,793],[1628,1690,11],[1527,1704,1624],[1730,1072,1729],[1526,1444,1704],[1526,1680,1444],[1704,1444,1701],[1816,1821,1809],[1722,67,68],[317,272,1823],[1716,1713,1721],[16,1628,1767],[1527,1526,1704],[1824,1826,1814],[1814,1826,1815],[1818,21,20],[1835,1808,1820],[603,570,1822],[226,1070,1778],[1013,1181,1179],[1721,679,1664],[1717,1813,1811],[1828,1827,1815],[22,1820,23],[22,1835,1820],[1830,603,1821],[719,1659,5],[643,567,1657],[1717,794,739],[1825,1826,1824],[1828,1815,1826],[1829,21,1818],[1808,1835,13],[4,719,5],[10,1662,1715],[1828,1832,1827],[1832,1818,1827],[12,1833,1816],[1833,1821,1816],[1833,1830,1821],[14,1146,1701],[1186,1829,1818],[1280,603,1830],[14,1700,1146],[1667,1728,1130],[1825,1834,1826],[1834,1828,1826],[1832,1186,1818],[1836,13,1835],[1624,1711,1570],[778,1624,1570],[1719,1725,1721],[1002,1825,1831],[1002,1834,1825],[1834,1832,1828],[1186,21,1829],[1836,1835,22],[1837,1833,12],[1280,1830,1833],[1667,1275,1728],[16,1767,1084],[589,1765,1838],[1765,1781,1838],[1781,1737,1838],[1737,982,1838],[982,1053,1838],[1053,816,1838],[816,589,1838]]

},{}],13:[function(require,module,exports){
"use strict"

var createThunk = require("./lib/thunk.js")

function Procedure() {
  this.argTypes = []
  this.shimArgs = []
  this.arrayArgs = []
  this.arrayBlockIndices = []
  this.scalarArgs = []
  this.offsetArgs = []
  this.offsetArgIndex = []
  this.indexArgs = []
  this.shapeArgs = []
  this.funcName = ""
  this.pre = null
  this.body = null
  this.post = null
  this.debug = false
}

function compileCwise(user_args) {
  //Create procedure
  var proc = new Procedure()
  
  //Parse blocks
  proc.pre    = user_args.pre
  proc.body   = user_args.body
  proc.post   = user_args.post

  //Parse arguments
  var proc_args = user_args.args.slice(0)
  proc.argTypes = proc_args
  for(var i=0; i<proc_args.length; ++i) {
    var arg_type = proc_args[i]
    if(arg_type === "array" || (typeof arg_type === "object" && arg_type.blockIndices)) {
      proc.argTypes[i] = "array"
      proc.arrayArgs.push(i)
      proc.arrayBlockIndices.push(arg_type.blockIndices ? arg_type.blockIndices : 0)
      proc.shimArgs.push("array" + i)
      if(i < proc.pre.args.length && proc.pre.args[i].count>0) {
        throw new Error("cwise: pre() block may not reference array args")
      }
      if(i < proc.post.args.length && proc.post.args[i].count>0) {
        throw new Error("cwise: post() block may not reference array args")
      }
    } else if(arg_type === "scalar") {
      proc.scalarArgs.push(i)
      proc.shimArgs.push("scalar" + i)
    } else if(arg_type === "index") {
      proc.indexArgs.push(i)
      if(i < proc.pre.args.length && proc.pre.args[i].count > 0) {
        throw new Error("cwise: pre() block may not reference array index")
      }
      if(i < proc.body.args.length && proc.body.args[i].lvalue) {
        throw new Error("cwise: body() block may not write to array index")
      }
      if(i < proc.post.args.length && proc.post.args[i].count > 0) {
        throw new Error("cwise: post() block may not reference array index")
      }
    } else if(arg_type === "shape") {
      proc.shapeArgs.push(i)
      if(i < proc.pre.args.length && proc.pre.args[i].lvalue) {
        throw new Error("cwise: pre() block may not write to array shape")
      }
      if(i < proc.body.args.length && proc.body.args[i].lvalue) {
        throw new Error("cwise: body() block may not write to array shape")
      }
      if(i < proc.post.args.length && proc.post.args[i].lvalue) {
        throw new Error("cwise: post() block may not write to array shape")
      }
    } else if(typeof arg_type === "object" && arg_type.offset) {
      proc.argTypes[i] = "offset"
      proc.offsetArgs.push({ array: arg_type.array, offset:arg_type.offset })
      proc.offsetArgIndex.push(i)
    } else {
      throw new Error("cwise: Unknown argument type " + proc_args[i])
    }
  }
  
  //Make sure at least one array argument was specified
  if(proc.arrayArgs.length <= 0) {
    throw new Error("cwise: No array arguments specified")
  }
  
  //Make sure arguments are correct
  if(proc.pre.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in pre() block")
  }
  if(proc.body.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in body() block")
  }
  if(proc.post.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in post() block")
  }

  //Check debug flag
  proc.debug = !!user_args.printCode || !!user_args.debug
  
  //Retrieve name
  proc.funcName = user_args.funcName || "cwise"
  
  //Read in block size
  proc.blockSize = user_args.blockSize || 64

  return createThunk(proc)
}

module.exports = compileCwise

},{"./lib/thunk.js":15}],14:[function(require,module,exports){
"use strict"

var uniq = require("uniq")

// This function generates very simple loops analogous to how you typically traverse arrays (the outermost loop corresponds to the slowest changing index, the innermost loop to the fastest changing index)
// TODO: If two arrays have the same strides (and offsets) there is potential for decreasing the number of "pointers" and related variables. The drawback is that the type signature would become more specific and that there would thus be less potential for caching, but it might still be worth it, especially when dealing with large numbers of arguments.
function innerFill(order, proc, body) {
  var dimension = order.length
    , nargs = proc.arrayArgs.length
    , has_index = proc.indexArgs.length>0
    , code = []
    , vars = []
    , idx=0, pidx=0, i, j
  for(i=0; i<dimension; ++i) { // Iteration variables
    vars.push(["i",i,"=0"].join(""))
  }
  //Compute scan deltas
  for(j=0; j<nargs; ++j) {
    for(i=0; i<dimension; ++i) {
      pidx = idx
      idx = order[i]
      if(i === 0) { // The innermost/fastest dimension's delta is simply its stride
        vars.push(["d",j,"s",i,"=t",j,"p",idx].join(""))
      } else { // For other dimensions the delta is basically the stride minus something which essentially "rewinds" the previous (more inner) dimension
        vars.push(["d",j,"s",i,"=(t",j,"p",idx,"-s",pidx,"*t",j,"p",pidx,")"].join(""))
      }
    }
  }
  code.push("var " + vars.join(","))
  //Scan loop
  for(i=dimension-1; i>=0; --i) { // Start at largest stride and work your way inwards
    idx = order[i]
    code.push(["for(i",i,"=0;i",i,"<s",idx,";++i",i,"){"].join(""))
  }
  //Push body of inner loop
  code.push(body)
  //Advance scan pointers
  for(i=0; i<dimension; ++i) {
    pidx = idx
    idx = order[i]
    for(j=0; j<nargs; ++j) {
      code.push(["p",j,"+=d",j,"s",i].join(""))
    }
    if(has_index) {
      if(i > 0) {
        code.push(["index[",pidx,"]-=s",pidx].join(""))
      }
      code.push(["++index[",idx,"]"].join(""))
    }
    code.push("}")
  }
  return code.join("\n")
}

// Generate "outer" loops that loop over blocks of data, applying "inner" loops to the blocks by manipulating the local variables in such a way that the inner loop only "sees" the current block.
// TODO: If this is used, then the previous declaration (done by generateCwiseOp) of s* is essentially unnecessary.
//       I believe the s* are not used elsewhere (in particular, I don't think they're used in the pre/post parts and "shape" is defined independently), so it would be possible to make defining the s* dependent on what loop method is being used.
function outerFill(matched, order, proc, body) {
  var dimension = order.length
    , nargs = proc.arrayArgs.length
    , blockSize = proc.blockSize
    , has_index = proc.indexArgs.length > 0
    , code = []
  for(var i=0; i<nargs; ++i) {
    code.push(["var offset",i,"=p",i].join(""))
  }
  //Generate loops for unmatched dimensions
  // The order in which these dimensions are traversed is fairly arbitrary (from small stride to large stride, for the first argument)
  // TODO: It would be nice if the order in which these loops are placed would also be somehow "optimal" (at the very least we should check that it really doesn't hurt us if they're not).
  for(var i=matched; i<dimension; ++i) {
    code.push(["for(var j"+i+"=SS[", order[i], "]|0;j", i, ">0;){"].join("")) // Iterate back to front
    code.push(["if(j",i,"<",blockSize,"){"].join("")) // Either decrease j by blockSize (s = blockSize), or set it to zero (after setting s = j).
    code.push(["s",order[i],"=j",i].join(""))
    code.push(["j",i,"=0"].join(""))
    code.push(["}else{s",order[i],"=",blockSize].join(""))
    code.push(["j",i,"-=",blockSize,"}"].join(""))
    if(has_index) {
      code.push(["index[",order[i],"]=j",i].join(""))
    }
  }
  for(var i=0; i<nargs; ++i) {
    var indexStr = ["offset"+i]
    for(var j=matched; j<dimension; ++j) {
      indexStr.push(["j",j,"*t",i,"p",order[j]].join(""))
    }
    code.push(["p",i,"=(",indexStr.join("+"),")"].join(""))
  }
  code.push(innerFill(order, proc, body))
  for(var i=matched; i<dimension; ++i) {
    code.push("}")
  }
  return code.join("\n")
}

//Count the number of compatible inner orders
// This is the length of the longest common prefix of the arrays in orders.
// Each array in orders lists the dimensions of the correspond ndarray in order of increasing stride.
// This is thus the maximum number of dimensions that can be efficiently traversed by simple nested loops for all arrays.
function countMatches(orders) {
  var matched = 0, dimension = orders[0].length
  while(matched < dimension) {
    for(var j=1; j<orders.length; ++j) {
      if(orders[j][matched] !== orders[0][matched]) {
        return matched
      }
    }
    ++matched
  }
  return matched
}

//Processes a block according to the given data types
// Replaces variable names by different ones, either "local" ones (that are then ferried in and out of the given array) or ones matching the arguments that the function performing the ultimate loop will accept.
function processBlock(block, proc, dtypes) {
  var code = block.body
  var pre = []
  var post = []
  for(var i=0; i<block.args.length; ++i) {
    var carg = block.args[i]
    if(carg.count <= 0) {
      continue
    }
    var re = new RegExp(carg.name, "g")
    var ptrStr = ""
    var arrNum = proc.arrayArgs.indexOf(i)
    switch(proc.argTypes[i]) {
      case "offset":
        var offArgIndex = proc.offsetArgIndex.indexOf(i)
        var offArg = proc.offsetArgs[offArgIndex]
        arrNum = offArg.array
        ptrStr = "+q" + offArgIndex // Adds offset to the "pointer" in the array
      case "array":
        ptrStr = "p" + arrNum + ptrStr
        var localStr = "l" + i
        var arrStr = "a" + arrNum
        if (proc.arrayBlockIndices[arrNum] === 0) { // Argument to body is just a single value from this array
          if(carg.count === 1) { // Argument/array used only once(?)
            if(dtypes[arrNum] === "generic") {
              if(carg.lvalue) {
                pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // Is this necessary if the argument is ONLY used as an lvalue? (keep in mind that we can have a += something, so we would actually need to check carg.rvalue)
                code = code.replace(re, localStr)
                post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
              } else {
                code = code.replace(re, [arrStr, ".get(", ptrStr, ")"].join(""))
              }
            } else {
              code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""))
            }
          } else if(dtypes[arrNum] === "generic") {
            pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // TODO: Could we optimize by checking for carg.rvalue?
            code = code.replace(re, localStr)
            if(carg.lvalue) {
              post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
            }
          } else {
            pre.push(["var ", localStr, "=", arrStr, "[", ptrStr, "]"].join("")) // TODO: Could we optimize by checking for carg.rvalue?
            code = code.replace(re, localStr)
            if(carg.lvalue) {
              post.push([arrStr, "[", ptrStr, "]=", localStr].join(""))
            }
          }
        } else { // Argument to body is a "block"
          var reStrArr = [carg.name], ptrStrArr = [ptrStr]
          for(var j=0; j<Math.abs(proc.arrayBlockIndices[arrNum]); j++) {
            reStrArr.push("\\s*\\[([^\\]]+)\\]")
            ptrStrArr.push("$" + (j+1) + "*t" + arrNum + "b" + j) // Matched index times stride
          }
          re = new RegExp(reStrArr.join(""), "g")
          ptrStr = ptrStrArr.join("+")
          if(dtypes[arrNum] === "generic") {
            /*if(carg.lvalue) {
              pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // Is this necessary if the argument is ONLY used as an lvalue? (keep in mind that we can have a += something, so we would actually need to check carg.rvalue)
              code = code.replace(re, localStr)
              post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
            } else {
              code = code.replace(re, [arrStr, ".get(", ptrStr, ")"].join(""))
            }*/
            throw new Error("cwise: Generic arrays not supported in combination with blocks!")
          } else {
            // This does not produce any local variables, even if variables are used multiple times. It would be possible to do so, but it would complicate things quite a bit.
            code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""))
          }
        }
      break
      case "scalar":
        code = code.replace(re, "Y" + proc.scalarArgs.indexOf(i))
      break
      case "index":
        code = code.replace(re, "index")
      break
      case "shape":
        code = code.replace(re, "shape")
      break
    }
  }
  return [pre.join("\n"), code, post.join("\n")].join("\n").trim()
}

function typeSummary(dtypes) {
  var summary = new Array(dtypes.length)
  var allEqual = true
  for(var i=0; i<dtypes.length; ++i) {
    var t = dtypes[i]
    var digits = t.match(/\d+/)
    if(!digits) {
      digits = ""
    } else {
      digits = digits[0]
    }
    if(t.charAt(0) === 0) {
      summary[i] = "u" + t.charAt(1) + digits
    } else {
      summary[i] = t.charAt(0) + digits
    }
    if(i > 0) {
      allEqual = allEqual && summary[i] === summary[i-1]
    }
  }
  if(allEqual) {
    return summary[0]
  }
  return summary.join("")
}

//Generates a cwise operator
function generateCWiseOp(proc, typesig) {

  //Compute dimension
  // Arrays get put first in typesig, and there are two entries per array (dtype and order), so this gets the number of dimensions in the first array arg.
  var dimension = (typesig[1].length - Math.abs(proc.arrayBlockIndices[0]))|0
  var orders = new Array(proc.arrayArgs.length)
  var dtypes = new Array(proc.arrayArgs.length)
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    dtypes[i] = typesig[2*i]
    orders[i] = typesig[2*i+1]
  }
  
  //Determine where block and loop indices start and end
  var blockBegin = [], blockEnd = [] // These indices are exposed as blocks
  var loopBegin = [], loopEnd = [] // These indices are iterated over
  var loopOrders = [] // orders restricted to the loop indices
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    if (proc.arrayBlockIndices[i]<0) {
      loopBegin.push(0)
      loopEnd.push(dimension)
      blockBegin.push(dimension)
      blockEnd.push(dimension+proc.arrayBlockIndices[i])
    } else {
      loopBegin.push(proc.arrayBlockIndices[i]) // Non-negative
      loopEnd.push(proc.arrayBlockIndices[i]+dimension)
      blockBegin.push(0)
      blockEnd.push(proc.arrayBlockIndices[i])
    }
    var newOrder = []
    for(var j=0; j<orders[i].length; j++) {
      if (loopBegin[i]<=orders[i][j] && orders[i][j]<loopEnd[i]) {
        newOrder.push(orders[i][j]-loopBegin[i]) // If this is a loop index, put it in newOrder, subtracting loopBegin, to make sure that all loopOrders are using a common set of indices.
      }
    }
    loopOrders.push(newOrder)
  }

  //First create arguments for procedure
  var arglist = ["SS"] // SS is the overall shape over which we iterate
  var code = ["'use strict'"]
  var vars = []
  
  for(var j=0; j<dimension; ++j) {
    vars.push(["s", j, "=SS[", j, "]"].join("")) // The limits for each dimension.
  }
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    arglist.push("a"+i) // Actual data array
    arglist.push("t"+i) // Strides
    arglist.push("p"+i) // Offset in the array at which the data starts (also used for iterating over the data)
    
    for(var j=0; j<dimension; ++j) { // Unpack the strides into vars for looping
      vars.push(["t",i,"p",j,"=t",i,"[",loopBegin[i]+j,"]"].join(""))
    }
    
    for(var j=0; j<Math.abs(proc.arrayBlockIndices[i]); ++j) { // Unpack the strides into vars for block iteration
      vars.push(["t",i,"b",j,"=t",i,"[",blockBegin[i]+j,"]"].join(""))
    }
  }
  for(var i=0; i<proc.scalarArgs.length; ++i) {
    arglist.push("Y" + i)
  }
  if(proc.shapeArgs.length > 0) {
    vars.push("shape=SS.slice(0)") // Makes the shape over which we iterate available to the user defined functions (so you can use width/height for example)
  }
  if(proc.indexArgs.length > 0) {
    // Prepare an array to keep track of the (logical) indices, initialized to dimension zeroes.
    var zeros = new Array(dimension)
    for(var i=0; i<dimension; ++i) {
      zeros[i] = "0"
    }
    vars.push(["index=[", zeros.join(","), "]"].join(""))
  }
  for(var i=0; i<proc.offsetArgs.length; ++i) { // Offset arguments used for stencil operations
    var off_arg = proc.offsetArgs[i]
    var init_string = []
    for(var j=0; j<off_arg.offset.length; ++j) {
      if(off_arg.offset[j] === 0) {
        continue
      } else if(off_arg.offset[j] === 1) {
        init_string.push(["t", off_arg.array, "p", j].join(""))      
      } else {
        init_string.push([off_arg.offset[j], "*t", off_arg.array, "p", j].join(""))
      }
    }
    if(init_string.length === 0) {
      vars.push("q" + i + "=0")
    } else {
      vars.push(["q", i, "=", init_string.join("+")].join(""))
    }
  }

  //Prepare this variables
  var thisVars = uniq([].concat(proc.pre.thisVars)
                      .concat(proc.body.thisVars)
                      .concat(proc.post.thisVars))
  vars = vars.concat(thisVars)
  code.push("var " + vars.join(","))
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    code.push("p"+i+"|=0")
  }
  
  //Inline prelude
  if(proc.pre.body.length > 3) {
    code.push(processBlock(proc.pre, proc, dtypes))
  }

  //Process body
  var body = processBlock(proc.body, proc, dtypes)
  var matched = countMatches(loopOrders)
  if(matched < dimension) {
    code.push(outerFill(matched, loopOrders[0], proc, body)) // TODO: Rather than passing loopOrders[0], it might be interesting to look at passing an order that represents the majority of the arguments for example.
  } else {
    code.push(innerFill(loopOrders[0], proc, body))
  }

  //Inline epilog
  if(proc.post.body.length > 3) {
    code.push(processBlock(proc.post, proc, dtypes))
  }
  
  if(proc.debug) {
    console.log("-----Generated cwise routine for ", typesig, ":\n" + code.join("\n") + "\n----------")
  }
  
  var loopName = [(proc.funcName||"unnamed"), "_cwise_loop_", orders[0].join("s"),"m",matched,typeSummary(dtypes)].join("")
  var f = new Function(["function ",loopName,"(", arglist.join(","),"){", code.join("\n"),"} return ", loopName].join(""))
  return f()
}
module.exports = generateCWiseOp

},{"uniq":201}],15:[function(require,module,exports){
"use strict"

// The function below is called when constructing a cwise function object, and does the following:
// A function object is constructed which accepts as argument a compilation function and returns another function.
// It is this other function that is eventually returned by createThunk, and this function is the one that actually
// checks whether a certain pattern of arguments has already been used before and compiles new loops as needed.
// The compilation passed to the first function object is used for compiling new functions.
// Once this function object is created, it is called with compile as argument, where the first argument of compile
// is bound to "proc" (essentially containing a preprocessed version of the user arguments to cwise).
// So createThunk roughly works like this:
// function createThunk(proc) {
//   var thunk = function(compileBound) {
//     var CACHED = {}
//     return function(arrays and scalars) {
//       if (dtype and order of arrays in CACHED) {
//         var func = CACHED[dtype and order of arrays]
//       } else {
//         var func = CACHED[dtype and order of arrays] = compileBound(dtype and order of arrays)
//       }
//       return func(arrays and scalars)
//     }
//   }
//   return thunk(compile.bind1(proc))
// }

var compile = require("./compile.js")

function createThunk(proc) {
  var code = ["'use strict'", "var CACHED={}"]
  var vars = []
  var thunkName = proc.funcName + "_cwise_thunk"
  
  //Build thunk
  code.push(["return function ", thunkName, "(", proc.shimArgs.join(","), "){"].join(""))
  var typesig = []
  var string_typesig = []
  var proc_args = [["array",proc.arrayArgs[0],".shape.slice(", // Slice shape so that we only retain the shape over which we iterate (which gets passed to the cwise operator as SS).
                    Math.max(0,proc.arrayBlockIndices[0]),proc.arrayBlockIndices[0]<0?(","+proc.arrayBlockIndices[0]+")"):")"].join("")]
  var shapeLengthConditions = [], shapeConditions = []
  // Process array arguments
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    var j = proc.arrayArgs[i]
    vars.push(["t", j, "=array", j, ".dtype,",
               "r", j, "=array", j, ".order"].join(""))
    typesig.push("t" + j)
    typesig.push("r" + j)
    string_typesig.push("t"+j)
    string_typesig.push("r"+j+".join()")
    proc_args.push("array" + j + ".data")
    proc_args.push("array" + j + ".stride")
    proc_args.push("array" + j + ".offset|0")
    if (i>0) { // Gather conditions to check for shape equality (ignoring block indices)
      shapeLengthConditions.push("array" + proc.arrayArgs[0] + ".shape.length===array" + j + ".shape.length+" + (Math.abs(proc.arrayBlockIndices[0])-Math.abs(proc.arrayBlockIndices[i])))
      shapeConditions.push("array" + proc.arrayArgs[0] + ".shape[shapeIndex+" + Math.max(0,proc.arrayBlockIndices[0]) + "]===array" + j + ".shape[shapeIndex+" + Math.max(0,proc.arrayBlockIndices[i]) + "]")
    }
  }
  // Check for shape equality
  if (proc.arrayArgs.length > 1) {
    code.push("if (!(" + shapeLengthConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same dimensionality!')")
    code.push("for(var shapeIndex=array" + proc.arrayArgs[0] + ".shape.length-" + Math.abs(proc.arrayBlockIndices[0]) + "; shapeIndex-->0;) {")
    code.push("if (!(" + shapeConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same shape!')")
    code.push("}")
  }
  // Process scalar arguments
  for(var i=0; i<proc.scalarArgs.length; ++i) {
    proc_args.push("scalar" + proc.scalarArgs[i])
  }
  // Check for cached function (and if not present, generate it)
  vars.push(["type=[", string_typesig.join(","), "].join()"].join(""))
  vars.push("proc=CACHED[type]")
  code.push("var " + vars.join(","))
  
  code.push(["if(!proc){",
             "CACHED[type]=proc=compile([", typesig.join(","), "])}",
             "return proc(", proc_args.join(","), ")}"].join(""))

  if(proc.debug) {
    console.log("-----Generated thunk:\n" + code.join("\n") + "\n----------")
  }
  
  //Compile thunk
  var thunk = new Function("compile", code.join("\n"))
  return thunk(compile.bind(undefined, proc))
}

module.exports = createThunk

},{"./compile.js":14}],16:[function(require,module,exports){
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()

}('domready', function () {

  var fns = [], listener
    , doc = document
    , hack = doc.documentElement.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState)


  if (!loaded)
  doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener)
    loaded = 1
    while (listener = fns.shift()) listener()
  })

  return function (fn) {
    loaded ? setTimeout(fn, 0) : fns.push(fn)
  }

});

},{}],17:[function(require,module,exports){
module.exports = function(dtype) {
  switch (dtype) {
    case 'int8':
      return Int8Array
    case 'int16':
      return Int16Array
    case 'int32':
      return Int32Array
    case 'uint8':
      return Uint8Array
    case 'uint16':
      return Uint16Array
    case 'uint32':
      return Uint32Array
    case 'float32':
      return Float32Array
    case 'float64':
      return Float64Array
    case 'array':
      return Array
  }
}
},{}],18:[function(require,module,exports){
"use strict"

function dupe_array(count, value, i) {
  var c = count[i]|0
  if(c <= 0) {
    return []
  }
  var result = new Array(c), j
  if(i === count.length-1) {
    for(j=0; j<c; ++j) {
      result[j] = value
    }
  } else {
    for(j=0; j<c; ++j) {
      result[j] = dupe_array(count, value, i+1)
    }
  }
  return result
}

function dupe_number(count, value) {
  var result, i
  result = new Array(count)
  for(i=0; i<count; ++i) {
    result[i] = value
  }
  return result
}

function dupe(count, value) {
  if(typeof value === "undefined") {
    value = 0
  }
  switch(typeof count) {
    case "number":
      if(count > 0) {
        return dupe_number(count|0, value)
      }
    break
    case "object":
      if(typeof (count.length) === "number") {
        return dupe_array(count, value, 0)
      }
    break
  }
  return []
}

module.exports = dupe
},{}],19:[function(require,module,exports){
function glyph(data) {
    return {
        page: data.page,
        hbx: data.xoffset,
        hby: data.yoffset,
        width: data.width,
        height: data.height,
        xoff: data.xadvance,
        x: data.x,
        y: data.y
    }
}

function glyphs(chars) {
    var out = {}
    chars.forEach(function(c) {
        out[String.fromCharCode(c.id)] = glyph(c)
    })
    return out
}

module.exports = function(bmfont) {
    return {
        pages: bmfont.pages,
        resolution: 72,
        size: bmfont.info.size,
        units_per_EM: 1,
        bitmap: true,
        family_name: bmfont.info.face,
        height: bmfont.common.lineHeight,
        descender: bmfont.common.base,
        ascender: bmfont.common.base,
        glyphs: glyphs(bmfont.chars),
        kerning: bmfont.kernings.map(function(k) {
            return [String.fromCharCode(k.first),String.fromCharCode(k.second),k.amount]
        })
    }
}
},{}],20:[function(require,module,exports){
var util = require('fontpath-util');

var DEFAULT_TAB_WIDTH = 4;

function GlyphIterator(font, fontSize) {
    this._fontSize = undefined;
    this._fontScale = undefined;
    this._font = undefined;
    this.fontScale = 1.0;
    this.kerning = true;
    this.letterSpacing = 0;
    this.lineHeight = undefined;
    
    this.fontSize = typeof fontSize === 'number'
            ? fontSize
            : (font ? font.size : undefined);
    this.font = font;

    //Number of spaces for a tab character
    this.tabWidth = DEFAULT_TAB_WIDTH;
    this._tabGlyph = null;

    this.origin = { x: 0, y: 0 };
    this.pen = { x: 0, y: 0 };
}

Object.defineProperty(GlyphIterator.prototype, "font", {
    get: function() {
        return this._font;
    },

    set: function(font) {
        this._font = font;

        //Determine the new scaling factor...
        if (font) {
            this.fontScale = util.getPxScale(font, this.fontSize);

            //Updates the tab glyph
            this.tabWidth = this._tabWidth;
        }
    },
});

//There might be a better way of handling tab width using FreeType ? 
Object.defineProperty(GlyphIterator.prototype, "tabWidth", {

    get: function() {
        return this._tabWidth;
    },

    set: function(val) {
        this._tabWidth = val===0 || val ? val : DEFAULT_TAB_WIDTH;
        this._tabGlyph = {};

        var spaceGlyph = this.font ? this.font.glyphs[" "] : null;
        if (spaceGlyph) {
            this._tabGlyph = {};
            for (var k in spaceGlyph) {
                this._tabGlyph[k] = spaceGlyph[k];
            }
            if (this._tabGlyph.xoff)
                this._tabGlyph.xoff *= this._tabWidth;
        }
    },
});

Object.defineProperty(GlyphIterator.prototype, "fontSize", {
    get: function() {
        if (typeof this._fontSize !== 'number')
            return this.font.bitmap 
                ? this.font.size 
                : util.pointToPixel(this.font.size)
        return this._fontSize;
    },

    set: function(val) {
        this._fontSize = val;

        //If the font is already set, determine the new scaling factor
        if (this._font) {
            this.fontScale = util.getPxScale(this._font, this._fontSize);
        }
    },
});

GlyphIterator.prototype.getKerning = function(left, right) {
    var font = this.font;

    if (!font || !font.kerning)
        return 0;

    var table = this.kerningTable;

    for (var i=0; i<font.kerning.length; i++) {
        var k = font.kerning[i];
        if (k[0] === left && k[1] === right) 
            return k[2];
    }
    return 0;
};

GlyphIterator.prototype.begin = function(x, y) {
    this.origin.x = x||0;
    this.origin.y = y||0;

    this.pen.x = this.origin.x;
    this.pen.y = this.origin.y;
};

GlyphIterator.prototype.end = function() {
    //.. mainly for consistency with begin()
    //Might be useful later on
};

GlyphIterator.prototype.getLineGap = function() {
    //Line height handling is a mess in browsers.
    //Maybe the best solution is to encourage users to 
    //specify pixel line heights if they want to match browser standards,
    //otherwise it's unreasonable to expect the line gaps to line up exactly
    //across all browsers. Example of the disaster:
    //http://lists.w3.org/Archives/Public/www-style/2008Jan/0413.html

    //For reference, some baseline-to-baseline calculations:
    //http://www.microsoft.com/typography/otspec/recom.htm
    //freetype.org/freetype2/docs/reference/ft2-base_interface.html
    //http://www.freetype.org/freetype2/docs/glyphs/glyphs-3.html

    //Unfortunately none of these are producing line-heights that avoid overlapping
    //or resemble browser rendering in any way. 

    // If CSS uses 1em or 1, the browser offsets the line by the 
    // font's pixel size. If an exact pixel line-height is specified,
    // the browser will use that + a computed "linegap." 
    // If 'auto' is specified for line-height, the calculations seem
    // much more complex and browser/platform dependent (not included here).
    
    var font = this.font,
        scale = this.fontScale;
    var gap = (font.height - font.ascender + Math.abs(font.descender)) * scale;    
    var lineHeight = this.lineHeight;
    
    lineHeight = (lineHeight===0||lineHeight) 
            ? (lineHeight + gap)
            : this.fontSize;
    return lineHeight;
};

GlyphIterator.prototype.translate = function(x, y) {
    this.origin.x += x||0;
    this.origin.y += y||0;

    this.pen.x += x||0;
    this.pen.y += y||0;
};

GlyphIterator.prototype.step = function(text, index) {
    var scale = this.fontScale,
        font = this._font;

    var chr = text.charAt(index); 

    if (chr === '\t' && this._tabGlyph) {
        return this._tabGlyph;
    }

    //Skip missing characters...
    if (!(chr in font.glyphs))
        return;
    
    var glyph = font.glyphs[chr];

    //If we have a char to the left, determine its kerning
    if (index > 0 && this.kerning) {
        var kern = this.getKerning(text.charAt(index-1), chr);
        this.pen.x += (kern*scale);
    }

    return glyph;
};

GlyphIterator.prototype.advanceLine = function() {
    this.pen.y += this.getLineGap();
    this.pen.x = this.origin.x;
};

/**
 * Called after step. 
 */
GlyphIterator.prototype.advance = function(glyph) {
    var advance = (glyph.xoff * this.fontScale);
    // Advance to next pen position
    this.pen.x += advance + this.letterSpacing;
    return advance;
};

/**
 * This is a utility function that provides the bounds of the given
 * text (from start and end positions) as if they were laid out horizontally,
 * left to right.
 *
 * For convenience, this will not alter the current pen and origin positions.
 * This way it can be utilized inside a glyph iteration (i.e. for rendering).
 *
 * If `availableWidth` is specified, this will break before reaching the specified
 * pixel width, to ensure that all glyphs will fit inside the bounds. 
 *
 * The return object also includes a `glyphs` property, which is the number of glyphs
 * that are visible within the returned bounds. 
 *
 * If `out` is specified (an object with x, y, width, height, and glyph properties),
 * it will be re-used. Otherwise a new object is created.
 * 
 * @param {String} text the text to check
 * @param {Number} start the start position, defaults to 0
 * @param {Number} end the end position, exclusive, defaults to text length
 * @param {Number} availableWidth the width before stopping the bound check
 * @param {Object} out an object to re-use for the return value
 * @return {Object} the bounds and glyph count {x,y,width,height,glyphs}
 */
GlyphIterator.prototype.getBounds = function(text, start, end, availableWidth, out) {
    if (!out)
        out = { x:0, y:0, width: 0, height: 0, glyphs: 0 };

    var checkWidth = availableWidth===0||availableWidth;

    start = start||0;
    end = end===0||end ? end : text.length;

    var maxHeight = 0;

    out.x = 0;
    out.y = 0;
    out.glyphs = 0;

    var oldPenX = this.pen.x,
        oldPenY = this.pen.y,
        oldOriginX = this.origin.x,
        oldOriginY = this.origin.y;


    var font = this.font;
    this.begin();
    for (var i=start; i<end; i++) {
        var chr = text.charAt(i);

        //step the iterator
        var glyph = this.step(text, i);

        //if the glyph is valid, we can advance past it and calculate new height
        if (glyph) {
            var height = (glyph.height)*this.fontScale;

            out.y = Math.max(out.y, this.fontScale*(glyph.height-glyph.hby));

            maxHeight = Math.max(maxHeight, height);
            var lastAdvance = this.advance(glyph);

            //if we're past the available width
            var newWidth = this.pen.x - this.origin.x;
            if (checkWidth && (newWidth - availableWidth > 0.001)) {
                this.pen.x -= lastAdvance;
                break;
            }

            out.glyphs++;
        }
    }
    this.end();

    out.width = this.pen.x - this.origin.x;
    out.height = maxHeight;

    this.pen.x = oldPenX;
    this.pen.y = oldPenY;
    this.origin.x = oldOriginX;
    this.origin.y = oldOriginY;

    return out;
};

module.exports = GlyphIterator;
},{"fontpath-util":23}],21:[function(require,module,exports){
var GlyphIterator = require('fontpath-glyph-iterator');
var WordWrap = require('fontpath-wordwrap');

var tmpBounds = { x: 0, y: 0, width: 0, height: 0, glyphs: 0 };

function TextRenderer(options) {
    if (!(this instanceof TextRenderer))
        return new TextRenderer(options);
    options = options||{}

    this.iterator = new GlyphIterator(options.font, options.fontSize);
    this.wordwrap = new WordWrap();

    this.align = 'left';
    this.underline = false;

    this.underlineThickness = undefined;
    this.underlinePosition = undefined;
    this._text = "";

    if (typeof options.align === 'string')
        this.align = options.align;
    if (typeof options.underline === 'boolean')
        this.underline = options.underline;
    if (typeof options.underlineThickness === 'number')
        this.underlineThickness = options.underlineThickness;
    if (typeof options.underlinePosition === 'number')
        this.underlinePosition = options.underlinePosition;
    if (typeof options.text === 'string')
        this.text = options.text;
    if (typeof options.lineHeight === 'number')
        this.lineHeight = options.lineHeight;
    if (typeof options.letterSpacing === 'number')
        this.letterSpacing = options.letterSpacing;
    if (typeof options.wrapMode === 'string')
        this.wordwrap.mode = options.wrapMode;
    if (typeof options.wrapWidth === 'number')
        this.layout(options.wrapWidth);
}

//Internally we will use integers to avoid string comparison for each glyph
var LEFT_ALIGN = 0, CENTER_ALIGN = 1, RIGHT_ALIGN = 2;
var ALIGN_ARRAY = [
    'left', 
    'center', 
    'right'
];
    
Object.defineProperties(TextRenderer.prototype, {
    /**
     * If the new font differs from the last, the text layout is cleared
     * and placed onto a single line. Users must manually re-layout the text 
     * for word wrapping.
     */
    "font": {
        get: function() {
            return this.iterator.font;
        },
        set: function(val) {
            var oldFont = this.iterator.font;
            this.iterator.font = val;
            if (oldFont !== this.iterator.font)
                this.clearLayout();
        },
    },

    /**
     * If the new font size differs from the last, the text layout is cleared
     * and placed onto a single line. Users must manually re-layout the text 
     * for word wrapping.
     */
    "fontSize": {
        get: function() {
            return this.iterator.fontSize;
        },
        set: function(val) {
            var oldSize = this.iterator.fontSize;

            this.iterator.fontSize = val;

            if (oldSize !== this.iterator.fontSize)
                this.clearLayout();
        },
    },
    "lineHeight": {
        get: function() {
            return this.iterator.lineHeight;
        },
        set: function(val) {
            this.iterator.lineHeight = val;
        },
    },
    "letterSpacing": {
         get: function() {
            return this.iterator.letterSpacing;
        },
        set: function(val) {
            this.iterator.letterSpacing = val;
        },
    },

    /**
     * If the new text is different from the last, the layout (i.e. word-wrapping)
     * is cleared and the result is a single line of text (similar to HTML5 canvas text
     * rendering).
     * 
     * The text then needs to be re-wordwrapped with a call to `layout()`.
     */
    "text": {
        get: function() {
            return this._text;
        },

        set: function(text) {
            text = text||"";

            var old = this._text;
            this._text = text;
            this.wordwrap.text = this.text;

            if (this._text !== old) 
                this.clearLayout();
        }
    }
});

/**
 * Clears the text layout and word-wrapping, placing all of it on a single line.
 */
TextRenderer.prototype.clearLayout = function() {
    this.wordwrap.text = this.text;
    this.wordwrap.empty();

    if (this.iterator.font) //font might not have been passed at constructor
        this.wordwrap.clearLayout(this.iterator);
};

/**
 * Calls the word wrapper to layout the current text string,
 * based on the wrap width and any current wordwrapping options.
 *
 * This is called when the text is changed. 
 * 
 * @return {[type]} [description]
 */
TextRenderer.prototype.layout = function(wrapWidth) {
    this.wordwrap.text = this.text;
    this.wordwrap.empty();
    this.wordwrap.layout(this.iterator, wrapWidth);
};

/**
 * "Renders" this glyph at the given location. This may involve filling
 * a VBO with vertex data, or it may be a direct call to draw a bitmap glyph
 * or shape outline.
 * @return {[type]} [description]
 */
TextRenderer.prototype.renderGlyph = function() {

};

TextRenderer.prototype.renderUnderline = function() {

};

/**
 * Returns the bounds of the current text layout. 
 *
 * The height does not extend past the baseline of the
 * last line; unless `includeUnderline` is true, in which
 * case the underline's position and height is included
 * in the calculation. 
 *
 * The bounding y position is offset so that the box has an upper-left
 * origin, for parity with HTML5 canvas rendering.
 * 
 * @param {Boolean} includeUnderline whether to include the underline in the calculation, default false
 * @param {Object} out an optional {width, height} object for re-use
 * @return {Object} a size with { width, height } properties
 */
TextRenderer.prototype.getBounds = function (includeUnderline, out) {
    if (!out)
        out = { x: 0, y: 0, width: 0, height: 0 };

    var wordwrapper = this.wordwrap;
    var itr = this.iterator;

    //tighten the bounding box around the first line..
    var firstLineHeight = 0;
    if (wordwrapper.lines.length > 0) {
        var firstLine = wordwrapper.lines[0];
        itr.getBounds(this.text, firstLine.start, firstLine.end, undefined, tmpBounds);
        firstLineHeight = tmpBounds.height;
    }

    out.width = wordwrapper.getMaxLineWidth();   
    out.height = Math.max(0, wordwrapper.lines.length-1) * itr.getLineGap() + firstLineHeight;

    out.x = 0;
    out.y = -out.height;

    if (includeUnderline) {
        var underlineHeight = this.computeUnderlineHeight();
        var underlinePosition = this.computeUnderlinePosition();
        var underlineOff = underlinePosition+underlineHeight/2;
        out.height += underlineOff;
    }

    return out;
};

/**
 * Computes the scaled underline height as pixels, based on 
 * the explicit `underlineHeight` (in pixels). If `underlineHeight` is
 * undefined or null, it will try to use the font's non-zero underline height, 
 * otherwise default to 1/8 of the font's EM square.
 * 
 * @return {Number} the pixel height of the underline 
 */
TextRenderer.prototype.computeUnderlineHeight = function () {
    var font = this.font;
    var scale = this.iterator.fontScale;
    if (this.underlineThickness===0||this.underlineThickness) {
        return this.underlineThickness; 
    } else if (font.underline_thickness) {
        return font.underline_thickness * scale; 
    } else if (font.bitmap)
        return font.size/8;
    else
        return (font.units_per_EM/8)*scale;
};

/**
 * Computes the scaled underline height as pixels, based on 
 * the explicit `underlinePosition` (in pixels). If `underlinePosition` is
 * undefined or null, it will try to use the font's non-zero underline position, 
 * otherwise default to 1/4 of the font's EM square.
 *
 * This is the Y offset from the text baseline to the center of the underline 
 * bar, in pixels. It is generally a positive value.
 * 
 * @return {Number} the pixel position of the underline 
 */
TextRenderer.prototype.computeUnderlinePosition = function () {
    var font = this.font;
    var scale = this.iterator.fontScale;
        
    if (this.underlinePosition===0||this.underlinePosition) {
        return this.underlinePosition; 
    } else if (font.underline_position) {
        return -font.underline_position * scale; 
    } else if (font.bitmap) {
        return font.size/4;
    } else {
        return (font.units_per_EM/4)*scale;
    }
};

/**
 * Gets the descent of the current font (assumes its size 
 * is already set). This is an absolute (positive) value.
 * 
 * @return {[type]} [description]
 */
TextRenderer.prototype.getDescender = function () {
    return Math.abs(this.iterator.fontScale * this.iterator.font.descender);
};

/**
 * Gets the descent of the current font (assumes its size 
 * is already set). This is an absolute (positive) value.
 * 
 * @return {[type]} [description]
 */
TextRenderer.prototype.getAscender = function () {
    return Math.abs(this.iterator.fontScale * this.iterator.font.ascender);
};

//Signals for subclasses to optionally implmeent
//This may be useful to stop/start paths with different fills
TextRenderer.prototype.onBegin = function() { }
TextRenderer.prototype.onEnd = function() { }
TextRenderer.prototype.onBeginLine = function(lineIndex) { }
TextRenderer.prototype.onEndLine = function(lineIndex) { }

/**
 * Renders the current text layout, where lower-left is 
 * the origin. Multiple lines will be positioned above the
 * origin.
 */
TextRenderer.prototype.render = function (x, y, start, end) {
    x = x||0;
    y = y||0;

    var text = this.text;
    var wordwrapper = this.wordwrap;

    //if we have nothing to draw
    if (!text || wordwrapper.lines.length === 0)
        return;

    //default start/end params
    start = start||0;
    end = typeof end === "number" ? end : text.length;

    var itr = this.iterator;
    var scale = itr.fontScale;
    var font = itr.font;
    var underline = this.underline;

    //used for alignment...
    var maxLineWidth = wordwrapper.getMaxLineWidth();
    
    y -= Math.max(0, wordwrapper.lines.length-1) * itr.getLineGap();


    //use numbers to avoid str compare for each glyph
    var alignType = ALIGN_ARRAY.indexOf(this.align||"");
    if (alignType===-1)
        alignType = LEFT_ALIGN;

    var underlineX = 0;
    var underlineStartX = 0;
    var underlineY = 0;
    var underlineWidth = 0;

    var underlineStarted = false;

    //Try to use user-specified underline settings, otherwise use the font if possible,
    //otherwise just use a rough default based on EM square.    
    var underlinePos = this.computeUnderlinePosition();
    var underlineHeight = this.computeUnderlineHeight();

    this.onBegin();
    
    //set the origin and pen position
    itr.begin(x, y);
    for (var k=0; k<wordwrapper.lines.length; k++) {
        var line = wordwrapper.lines[k];
        underlineStarted = false;

        var lastAdvance = 0;

        var lineX = itr.pen.x;
        var lineY = itr.pen.y;

        this.onBeginLine(k);

        //TODO: use multiple Nodes inside a single line
        //a node will have attributes like font, size, color, 
        //letter-spacing, underline, etc.
        //This will affect the line height, as it will have to be the max of all nodes.

        for (var i=line.start; i<line.end; i++) {
            var chr = text.charAt(i);

            //Step the iterator, moving forward based on kerning from last char
            var glyph = itr.step(text, i);

            if (!glyph)
                continue;

            //within desired range
            if (i >= start && i < end) {
                var tx = itr.pen.x;
                var ty = itr.pen.y;

                if (alignType === CENTER_ALIGN) {
                    tx += (maxLineWidth-line.width)/2;
                } else if (alignType === RIGHT_ALIGN) {
                    tx += (maxLineWidth-line.width);
                }

                if (!underlineStarted) {
                    underlineX = tx;
                    underlineStartX = tx;
                    underlineY = ty + underlinePos;
                    underlineWidth = 0;
                    underlineStarted = true;
                } else {
                    underlineWidth = tx - underlineStartX;
                }

                this.renderGlyph(i, glyph, scale, tx, ty);
            }

            //Advance the iterator to the next glyph in the string
            var newAdvance = itr.advance(glyph);

            if (i >= start && i < end)
                lastAdvance = newAdvance;
        }

        this.onEndLine(k);

        if (underline) {
            underlineWidth += lastAdvance;
            this.renderUnderline(underlineX, underlineY-underlineHeight/2, underlineWidth, underlineHeight);
        }
        
        //Steps down a line...
        if (k < wordwrapper.lines.length-1) {
            itr.advanceLine();
        }
    }

    //finish the iterator...
    itr.end();
    this.onEnd();
};

module.exports = TextRenderer;
},{"fontpath-glyph-iterator":20,"fontpath-wordwrap":24}],22:[function(require,module,exports){
var Base = require('fontpath-renderer')
var inherits = require('inherits')

//TODO: Eventually lots of this code will just replace fontpath-renderer...

function FontpathRenderer(options) {
    if (!(this instanceof FontpathRenderer))
        return new FontpathRenderer(options)
    Base.call(this, options)

    this.data = {
        glyphs: [],
        underlines: []
    }
}

inherits(FontpathRenderer, Base)

FontpathRenderer.prototype.renderGlyph = function(i, glyph, scale, x, y) {
    this.data.glyphs.push(new Glyph(i, glyph, 
                this.text.charCodeAt(i), 
                [ scale, this.font.bitmap ? scale : -scale ],
                [ x, y ]))
}

FontpathRenderer.prototype.renderUnderline = function(x, y, width, height) {
    this.data.underlines.push(new Underline(
        [ x, y ],
        [ width, height ]
    ))
}

FontpathRenderer.prototype.render = function(x, y, start, end) {
    //new data for result
    this.data.glyphs.length = 0
    this.data.underlines.length = 0
    Base.prototype.render.call(this, x, y, start, end)
    return this.data
}

function Glyph(index, glyph, charCode, scale, position) {
    this.glyph = glyph
    this.index = index
    this.charCode = charCode
    this.position = position
    this.scale = scale
}

function Underline(position, size) {
    this.position = position
    this.size = size
}

module.exports = FontpathRenderer
},{"fontpath-renderer":21,"inherits":166}],23:[function(require,module,exports){
// module.exports.pointsToPixels = function(pointSize, resolution) {
// 	resolution = typeof resolution === "number" ? resolution : 72;
// 	return pointSize * resolution / 72;
// };

// module.exports.coordToPixel = function(coord, pixelSize, emSize) {
// 	emSize = typeof emSize === "number" ? emSize : 2048;
// 	return coord * pixelSize / emSize;
// };

/**
 * Converts a pt size to px size, namely useful for matching
 * size with CSS styles. If no DPI is specified, 96 is assumed
 * (as it leads to correct rendering in all browsers).
 * 
 * @param  {Number} fontSize the desired font size in points
 * @param  {Number} dpi      the expected DPI, generally 96 for browsers
 * @return {Number}          the rounded pixel font size
 */
module.exports.pointToPixel = function(fontSize, dpi) {
    dpi = dpi||dpi===0 ? dpi : 96;
    fontSize = fontSize * dpi / 72;
    return Math.round(fontSize);
};

/**
 * For the given font and (pixel) font size, this method returns the
 * scale that will need to be applied to EM units (i.e. font paths) 
 * to have the font render at the expected size (i.e. to match the browser).
 *
 * If no font size is specified, we will use the default font size (which is in points)
 * and convert it to pixels. 
 * 
 * @param  {Font} font     a font object from the fontpath tool
 * @param  {Number} fontSize the desired font size, defaults to the font's default size
 * @return {Number} returns the scale for this font size         
 */
module.exports.getPxScale = function(font, fontSize) {
    if (font.bitmap)
        return 1.0;

    //If no fontSize is specified, it will just fall back to using the font's own size with 96 DPI.
    fontSize = typeof fontSize === "number" ? fontSize : this.pointToPixel(font.size);

    //Takes in a font size in PIXELS and gives us the expected scaling factor
    var sz = font.units_per_EM/64;
    sz = (sz/font.size * fontSize);

    return ((font.resolution * 1/72 * sz) / font.units_per_EM);
};

/**
 * For the given font and (point) font size, this method returns the
 * scale that will need to be applied to EM units (i.e. font paths) 
 * to have the font render at the expected size (i.e. to match the browser).
 * 
 * If no font size is specified, we will use the default font size.
 * 
 * @param  {Font} font       a font object from the fontpath tool
 * @param  {Number} fontSize the desired font size, defaults to the font's default size
 * @return {Number}          the scale for this font size
 */
module.exports.getPtScale = function(font, fontSize) {
    fontSize = typeof fontSize === "number" ? fontSize : font.size;
    fontSize = this.pointToPixel(fontSize);
    return this.getPxScale(font, fontSize);
};

},{}],24:[function(require,module,exports){
var tmpBounds = { x: 0, y: 0, width: 0, height: 0, glyphs: 0 };
var wordWrap = require('word-wrapper').lines

function isWhitespace(chr) {
	return chr===' '
		|| chr==='\n'
		|| chr==='\r'
		|| chr==='\t';
}

function idxOf(text, chr, start, end) {
	var idx = text.indexOf(chr, start);
	if (idx === -1 || idx > end)
		return end;
	return idx;
}

function WordWrap(text) {
	/**
	 * The text being operated on.
	 * @param {String} text
	 */
	this.text = text||"";

	/**
	 * An array of lines representing the state of this word wrapper.
	 * @param {Array} lines
	 */
	this.lines = [];

	/** 
	 * The newline character to break on, default '\n'
	 * @param {String} newline
	 */
	this.newline = '\n';

	/**
	 * The mode for wordwrapping: 'pre', 'normal', or 'nowrap'.
	 *
	 * You can also use the `PRE`, `NORMAL`, and `NOWRAP` constants
	 * in `WordWrap.Mode`.
	 * 
	 * @param {String} mode
	 */
	this.mode = WordWrap.Mode.NORMAL;
}

WordWrap.Mode = {
	PRE: 'pre',       //whitespace isn't collapsed
	NORMAL: 'normal', //whitespace is collapsed
	NOWRAP: 'nowrap'  //only break on '\n'
};

/**
 * Clears any multi-line layout by placing all the text in a single Line object.
 * 
 * @param {GlyphIterator} iterator the iterator to use 
 * @method  clearLayout
 */
WordWrap.prototype.clearLayout = function(iterator) {
	this.lines.length = 0;
	
	if (this.text.length > 0) {
		iterator.getBounds(this.text, 0, this.text.length, undefined, tmpBounds);
		
		var line = new WordWrap.Line(0, this.text.length, tmpBounds.width);
		this.lines.push(line);
	}
};

/**
 * Resets the word wrapper by emptying all current lines.
 * @method  empty
 */
WordWrap.prototype.empty = function() {
	this.lines.length = 0;
};

/**
 * Word-wraps the given text into multiple lines.
 * @param  {[type]} iterator [description]
 * @param  {[type]} width    [description]
 * @param  {[type]} start    [description]
 * @param  {[type]} end      [description]
 * @return {[type]}          [description]
 */
WordWrap.prototype.layout = function(iterator, wrapWidth, start, end) {
	var text = this.text;
	var measure = createMetrics(iterator);
	var lines = wordWrap(text, {
		start: start,
		end: end,
		width: wrapWidth,
		measure: measure,
		mode: this.mode
	});
	//append new lines
	this.lines = this.lines.concat(lines);
};

/**
 * A convenience method to return the maximum width of all current lines.
 * This is useful for aligning blocks of text.
 *
 * @method  getMaxLineWidth
 * @return {Number} the maximum width of all lines
 */
WordWrap.prototype.getMaxLineWidth = function() {
	var maxWidth = 0;
	for (var i=0; i<this.lines.length; i++) {
		var line = this.lines[i];
		maxWidth = Math.max(line.width, maxWidth);
	}
	return maxWidth;
};

/**
 * The Line object holds the start and end indices into the string,
 * and the width as computed by GlyphIterator.
 * 
 * @class  WordWrap.Line
 * @param {Number} start the start index, inclusive
 * @param {Number} end   the end index, exclusive
 * @param {Number} width the computed width of this line
 */
WordWrap.Line = function(start, end, width) {
	this.start = start;
	this.end = end;
	this.width = width;
};

module.exports = WordWrap;

function createMetrics(iterator) {
	return function(text, start, end, width) {
		iterator.getBounds(text, start, end, width, tmpBounds);
		return new WordWrap.Line(start, start + tmpBounds.glyphs, tmpBounds.width);
	}
}
},{"word-wrapper":208}],25:[function(require,module,exports){
if(typeof window.performance === "object") {
  if(window.performance.now) {
    module.exports = function() { return window.performance.now() }
  } else if(window.performance.webkitNow) {
    module.exports = function() { return window.performance.webkitNow() }
  }
} else if(Date.now) {
  module.exports = Date.now
} else {
  module.exports = function() { return (new Date()).getTime() }
}

},{}],26:[function(require,module,exports){
//Adapted from here: https://developer.mozilla.org/en-US/docs/Web/Reference/Events/wheel?redirectlocale=en-US&redirectslug=DOM%2FMozilla_event_reference%2Fwheel

var prefix = "", _addEventListener, onwheel, support;

// detect event model
if ( window.addEventListener ) {
  _addEventListener = "addEventListener";
} else {
  _addEventListener = "attachEvent";
  prefix = "on";
}

// detect available wheel event
support = "onwheel" in document.createElement("div") ? "wheel" : // Modern browsers support "wheel"
          document.onmousewheel !== undefined ? "mousewheel" : // Webkit and IE support at least "mousewheel"
          "DOMMouseScroll"; // let's assume that remaining browsers are older Firefox

function _addWheelListener( elem, eventName, callback, useCapture ) {
  elem[ _addEventListener ]( prefix + eventName, support == "wheel" ? callback : function( originalEvent ) {
    !originalEvent && ( originalEvent = window.event );

    // create a normalized event object
    var event = {
      // keep a ref to the original event object
      originalEvent: originalEvent,
      target: originalEvent.target || originalEvent.srcElement,
      type: "wheel",
      deltaMode: originalEvent.type == "MozMousePixelScroll" ? 0 : 1,
      deltaX: 0,
      delatZ: 0,
      preventDefault: function() {
        originalEvent.preventDefault ?
          originalEvent.preventDefault() :
          originalEvent.returnValue = false;
      }
    };
    
    // calculate deltaY (and deltaX) according to the event
    if ( support == "mousewheel" ) {
      event.deltaY = - 1/40 * originalEvent.wheelDelta;
      // Webkit also support wheelDeltaX
      originalEvent.wheelDeltaX && ( event.deltaX = - 1/40 * originalEvent.wheelDeltaX );
    } else {
      event.deltaY = originalEvent.detail;
    }

    // it's time to fire the callback
    return callback( event );
  }, useCapture || false );
}

module.exports = function( elem, callback, useCapture ) {
  _addWheelListener( elem, support, callback, useCapture );

  // handle MozMousePixelScroll in older Firefox
  if( support == "DOMMouseScroll" ) {
    _addWheelListener( elem, "MozMousePixelScroll", callback, useCapture );
  }
};
},{}],27:[function(require,module,exports){
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
 
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
 
// MIT license
var lastTime = 0;
var vendors = ['ms', 'moz', 'webkit', 'o'];
for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                               || window[vendors[x]+'CancelRequestAnimationFrame'];
}

if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
        var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
          timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };

if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
        clearTimeout(id);
    };

},{}],28:[function(require,module,exports){
"use strict"

var EventEmitter = require("events").EventEmitter
  , util         = require("util")
  , domready     = require("domready")
  , vkey         = require("vkey")
  , invert       = require("invert-hash")
  , uniq         = require("uniq")
  , bsearch      = require("binary-search-bounds")
  , iota         = require("iota-array")
  , min          = Math.min

//Browser compatibility hacks
require("./lib/raf-polyfill.js")
var addMouseWheel = require("./lib/mousewheel-polyfill.js")
var hrtime = require("./lib/hrtime-polyfill.js")

//Remove angle braces and other useless crap
var filtered_vkey = (function() {
  var result = new Array(256)
    , i, j, k
  for(i=0; i<256; ++i) {
    result[i] = "UNK"
  }
  for(i in vkey) {
    k = vkey[i]
    if(k.charAt(0) === '<' && k.charAt(k.length-1) === '>') {
      k = k.substring(1, k.length-1)
    }
    k = k.replace(/\s/g, "-")
    result[parseInt(i)] = k
  }
  return result
})()

//Compute minimal common set of keyboard functions
var keyNames = uniq(Object.keys(invert(filtered_vkey)))

//Translates a virtual keycode to a normalized keycode
function virtualKeyCode(key) {
  return bsearch.eq(keyNames, key)
}

//Maps a physical keycode to a normalized keycode
function physicalKeyCode(key) {
  return virtualKeyCode(filtered_vkey[key])
}

//Game shell
function GameShell() {
  EventEmitter.call(this)
  this._curKeyState  = new Array(keyNames.length)
  this._pressCount   = new Array(keyNames.length)
  this._releaseCount = new Array(keyNames.length)
  
  this._tickInterval = null
  this._rafHandle = null
  this._tickRate = 0
  this._lastTick = hrtime()
  this._frameTime = 0.0
  this._paused = true
  this._width = 0
  this._height = 0
  
  this._wantFullscreen = false
  this._wantPointerLock = false
  this._fullscreenActive = false
  this._pointerLockActive = false
  
  this._render = render.bind(undefined, this)

  this.preventDefaults = true
  this.stopPropagation = false
  
  for(var i=0; i<keyNames.length; ++i) {
    this._curKeyState[i] = false
    this._pressCount[i] = this._releaseCount[i] = 0
  }
  
  //Public members
  this.element = null
  this.bindings = {}
  this.frameSkip = 100.0
  this.tickCount = 0
  this.frameCount = 0
  this.startTime = hrtime()
  this.tickTime = this._tickRate
  this.frameTime = 10.0
  this.stickyFullscreen = false
  this.stickyPointerLock = false
  
  //Scroll stuff
  this.scroll = [0,0,0]
    
  //Mouse state
  this.mouseX = 0
  this.mouseY = 0
  this.prevMouseX = 0
  this.prevMouseY = 0
}

util.inherits(GameShell, EventEmitter)

var proto = GameShell.prototype

//Bind keynames
proto.keyNames = keyNames

//Binds a virtual keyboard event to a physical key
proto.bind = function(virtual_key) {
  //Look up previous key bindings
  var arr
  if(virtual_key in this.bindings) {
    arr = this.bindings[virtual_key]
  } else {
    arr = []
  }
  //Add keys to list
  var physical_key
  for(var i=1, n=arguments.length; i<n; ++i) {
    physical_key = arguments[i]
    if(virtualKeyCode(physical_key) >= 0) {
      arr.push(physical_key)
    } else if(physical_key in this.bindings) {
      var keybinds = this.bindings[physical_key]
      for(var j=0; j<keybinds.length; ++j) {
        arr.push(keybinds[j])
      }
    }
  }
  //Remove any duplicate keys
  arr = uniq(arr)
  if(arr.length > 0) {
    this.bindings[virtual_key] = arr
  }
  this.emit('bind', virtual_key, arr)
}

//Unbinds a virtual keyboard event
proto.unbind = function(virtual_key) {
  if(virtual_key in this.bindings) {
    delete this.bindings[virtual_key]
  }
  this.emit('unbind', virtual_key)
}

//Checks if a key is set in a given state
function lookupKey(state, bindings, key) {
  if(key in bindings) {
    var arr = bindings[key]
    for(var i=0, n=arr.length; i<n; ++i) {
      if(state[virtualKeyCode(arr[i])]) {
        return true
      }
    }
    return false
  }
  var kc = virtualKeyCode(key)
  if(kc >= 0) {
    return state[kc]
  }
  return false
}

//Checks if a key is set in a given state
function lookupCount(state, bindings, key) {
  if(key in bindings) {
    var arr = bindings[key], r = 0
    for(var i=0, n=arr.length; i<n; ++i) {
      r += state[virtualKeyCode(arr[i])]
    }
    return r
  }
  var kc = virtualKeyCode(key)
  if(kc >= 0) {
    return state[kc]
  }
  return 0
}

//Checks if a key (either physical or virtual) is currently held down
proto.down = function(key) {
  return lookupKey(this._curKeyState, this.bindings, key)
}

//Checks if a key was ever down
proto.wasDown = function(key) {
  return this.down(key) || !!this.press(key)
}

//Opposite of down
proto.up = function(key) {
  return !this.down(key)
}

//Checks if a key was released during previous frame
proto.wasUp = function(key) {
  return this.up(key) || !!this.release(key)
}

//Returns the number of times a key was pressed since last tick
proto.press = function(key) {
  return lookupCount(this._pressCount, this.bindings, key)
}

//Returns the number of times a key was released since last tick
proto.release = function(key) {
  return lookupCount(this._releaseCount, this.bindings, key)
}

//Pause/unpause the game loop
Object.defineProperty(proto, "paused", {
  get: function() {
    return this._paused
  },
  set: function(state) {
    var ns = !!state
    if(ns !== this._paused) {
      if(!this._paused) {
        this._paused = true
        this._frameTime = min(1.0, (hrtime() - this._lastTick) / this._tickRate)
        clearInterval(this._tickInterval)
        //cancelAnimationFrame(this._rafHandle)
      } else {
        this._paused = false
        this._lastTick = hrtime() - Math.floor(this._frameTime * this._tickRate)
        this._tickInterval = setInterval(tick, this._tickRate, this)
        this._rafHandle = requestAnimationFrame(this._render)
      }
    }
  }
})

//Fullscreen state toggle

function tryFullscreen(shell) {
  //Request full screen
  var elem = shell.element
  
  if(shell._wantFullscreen && !shell._fullscreenActive) {
    var fs = elem.requestFullscreen ||
             elem.requestFullScreen ||
             elem.webkitRequestFullscreen ||
             elem.webkitRequestFullScreen ||
             elem.mozRequestFullscreen ||
             elem.mozRequestFullScreen ||
             function() {}
    fs.call(elem)
  }
  if(shell._wantPointerLock && !shell._pointerLockActive) {
    var pl =  elem.requestPointerLock ||
              elem.webkitRequestPointerLock ||
              elem.mozRequestPointerLock ||
              elem.msRequestPointerLock ||
              elem.oRequestPointerLock ||
              function() {}
    pl.call(elem)
  }
}

var cancelFullscreen = document.exitFullscreen ||
                       document.cancelFullscreen ||  //Why can no one agree on this?
                       document.cancelFullScreen ||
                       document.webkitCancelFullscreen ||
                       document.webkitCancelFullScreen ||
                       document.mozCancelFullscreen ||
                       document.mozCancelFullScreen ||
                       function(){}

Object.defineProperty(proto, "fullscreen", {
  get: function() {
    return this._fullscreenActive
  },
  set: function(state) {
    var ns = !!state
    if(!ns) {
      this._wantFullscreen = false
      cancelFullscreen.call(document)
    } else {
      this._wantFullscreen = true
      tryFullscreen(this)
    }
    return this._fullscreenActive
  }
})

function handleFullscreen(shell) {
  shell._fullscreenActive = document.fullscreen ||
                            document.mozFullScreen ||
                            document.webkitIsFullScreen ||
                            false
  if(!shell.stickyFullscreen && shell._fullscreenActive) {
    shell._wantFullscreen = false
  }
}

//Pointer lock state toggle
var exitPointerLock = document.exitPointerLock ||
                      document.webkitExitPointerLock ||
                      document.mozExitPointerLock ||
                      function() {}

Object.defineProperty(proto, "pointerLock", {
  get: function() {
    return this._pointerLockActive
  },
  set: function(state) {
    var ns = !!state
    if(!ns) {
      this._wantPointerLock = false
      exitPointerLock.call(document)
    } else {
      this._wantPointerLock = true
      tryFullscreen(this)
    }
    return this._pointerLockActive
  }
})

function handlePointerLockChange(shell, event) {
  shell._pointerLockActive = shell.element === (
      document.pointerLockElement ||
      document.mozPointerLockElement ||
      document.webkitPointerLockElement ||
      null)
  if(!shell.stickyPointerLock && shell._pointerLockActive) {
    shell._wantPointerLock = false
  }
}

//Width and height
Object.defineProperty(proto, "width", {
  get: function() {
    return this.element.clientWidth
  }
})
Object.defineProperty(proto, "height", {
  get: function() {
    return this.element.clientHeight
  }
})

//Set key state
function setKeyState(shell, key, state) {
  var ps = shell._curKeyState[key]
  if(ps !== state) {
    if(state) {
      shell._pressCount[key]++
    } else {
      shell._releaseCount[key]++
    }
    shell._curKeyState[key] = state
  }
}

//Ticks the game state one update
function tick(shell) {
  var skip = hrtime() + shell.frameSkip
    , pCount = shell._pressCount
    , rCount = shell._releaseCount
    , i, s, t
    , tr = shell._tickRate
    , n = keyNames.length
  while(!shell._paused &&
        hrtime() >= shell._lastTick + tr) {
    
    //Skip frames if we are over budget
    if(hrtime() > skip) {
      shell._lastTick = hrtime() + tr
      return
    }
    
    //Tick the game
    s = hrtime()
    shell.emit("tick")
    t = hrtime()
    shell.tickTime = t - s
    
    //Update counters and time
    ++shell.tickCount
    shell._lastTick += tr
    
    //Shift input state
    for(i=0; i<n; ++i) {
      pCount[i] = rCount[i] = 0
    }
    if(shell._pointerLockActive) {
      shell.prevMouseX = shell.mouseX = shell.width>>1
      shell.prevMouseY = shell.mouseY = shell.height>>1
    } else {
      shell.prevMouseX = shell.mouseX
      shell.prevMouseY = shell.mouseY
    }
    shell.scroll[0] = shell.scroll[1] = shell.scroll[2] = 0
  }
}

//Render stuff
function render(shell) {

  //Request next frame
  shell._rafHandle = requestAnimationFrame(shell._render)

  //Tick the shell
  tick(shell)
  
  //Compute frame time
  var dt
  if(shell._paused) {
    dt = shell._frameTime
  } else {
    dt = min(1.0, (hrtime() - shell._lastTick) / shell._tickRate)
  }
  
  //Draw a frame
  ++shell.frameCount
  var s = hrtime()
  shell.emit("render", dt)
  var t = hrtime()
  shell.frameTime = t - s
  
}

function isFocused(shell) {
  return (document.activeElement === document.body) ||
         (document.activeElement === shell.element)
}

function handleEvent(shell, ev) {
  if(shell.preventDefaults) {
    ev.preventDefault()
  }
  if(shell.stopPropagation) {
    ev.stopPropagation()
  }
}

//Set key up
function handleKeyUp(shell, ev) {
  handleEvent(shell, ev)
  var kc = physicalKeyCode(ev.keyCode || ev.char || ev.which || ev.charCode)
  if(kc >= 0) {
    setKeyState(shell, kc, false)
  }
}

//Set key down
function handleKeyDown(shell, ev) {
  if(!isFocused(shell)) {
    return
  }
  handleEvent(shell, ev)
  if(ev.metaKey) {
    //Hack: Clear key state when meta gets pressed to prevent keys sticking
    handleBlur(shell, ev)
  } else {
    var kc = physicalKeyCode(ev.keyCode || ev.char || ev.which || ev.charCode)
    if(kc >= 0) {
      setKeyState(shell, kc, true)
    }
  }
}

//Mouse events are really annoying
var mouseCodes = iota(32).map(function(n) {
  return virtualKeyCode("mouse-" + (n+1))
})

function setMouseButtons(shell, buttons) {
  for(var i=0; i<32; ++i) {
    setKeyState(shell, mouseCodes[i], !!(buttons & (1<<i)))
  }
}

function handleMouseMove(shell, ev) {
  handleEvent(shell, ev)
  if(shell._pointerLockActive) {
    var movementX = ev.movementX       ||
                    ev.mozMovementX    ||
                    ev.webkitMovementX ||
                    0,
        movementY = ev.movementY       ||
                    ev.mozMovementY    ||
                    ev.webkitMovementY ||
                    0
    shell.mouseX += movementX
    shell.mouseY += movementY
  } else {
    shell.mouseX = ev.clientX - shell.element.offsetLeft
    shell.mouseY = ev.clientY - shell.element.offsetTop
  }
  return false
}

function handleMouseDown(shell, ev) {
  handleEvent(shell, ev)
  setKeyState(shell, mouseCodes[ev.button], true)
  return false
}

function handleMouseUp(shell, ev) {
  handleEvent(shell, ev)
  setKeyState(shell, mouseCodes[ev.button], false)
  return false
}

function handleMouseEnter(shell, ev) {
  handleEvent(shell, ev)
  if(shell._pointerLockActive) {
    shell.prevMouseX = shell.mouseX = shell.width>>1
    shell.prevMouseY = shell.mouseY = shell.height>>1
  } else {
    shell.prevMouseX = shell.mouseX = ev.clientX - shell.element.offsetLeft
    shell.prevMouseY = shell.mouseY = ev.clientY - shell.element.offsetTop
  }
  return false
}

function handleMouseLeave(shell, ev) {
  handleEvent(shell, ev)
  setMouseButtons(shell, 0)
  return false
}

//Handle mouse wheel events
function handleMouseWheel(shell, ev) {
  handleEvent(shell, ev)
  var scale = 1
  switch(ev.deltaMode) {
    case 0: //Pixel
      scale = 1
    break
    case 1: //Line
      scale = 12
    break
    case 2: //Page
       scale = shell.height
    break
  }
  //Add scroll
  shell.scroll[0] +=  ev.deltaX * scale
  shell.scroll[1] +=  ev.deltaY * scale
  shell.scroll[2] += (ev.deltaZ * scale)||0.0
  return false
}

function handleContexMenu(shell, ev) {
  handleEvent(shell, ev)
  return false
}

function handleBlur(shell, ev) {
  var n = keyNames.length
    , c = shell._curKeyState
    , r = shell._releaseCount
    , i
  for(i=0; i<n; ++i) {
    if(c[i]) {
      ++r[i]
    }
    c[i] = false
  }
  return false
}

function handleResizeElement(shell, ev) {
  var w = shell.element.clientWidth|0
  var h = shell.element.clientHeight|0
  if((w !== shell._width) || (h !== shell._height)) {
    shell._width = w
    shell._height = h
    shell.emit("resize", w, h)
  }
}

function makeDefaultContainer() {
  var container = document.createElement("div")
  container.tabindex = 1
  container.style.position = "absolute"
  container.style.left = "0px"
  container.style.right = "0px"
  container.style.top = "0px"
  container.style.bottom = "0px"
  container.style.height = "100%"
  container.style.overflow = "hidden"
  document.body.appendChild(container)
  document.body.style.overflow = "hidden" //Prevent bounce
  document.body.style.height = "100%"
  return container
}

function createShell(options) {
  options = options || {}
  
  //Check fullscreen and pointer lock flags
  var useFullscreen = !!options.fullscreen
  var usePointerLock = useFullscreen
  if(typeof options.pointerLock !== undefined) {
    usePointerLock = !!options.pointerLock
  }
  
  //Create initial shell
  var shell = new GameShell()
  shell._tickRate = options.tickRate || 30
  shell.frameSkip = options.frameSkip || (shell._tickRate+5) * 5
  shell.stickyFullscreen = !!options.stickyFullscreen || !!options.sticky
  shell.stickyPointerLock = !!options.stickyPointerLock || !!options.sticky
  
  //Set bindings
  if(options.bindings) {
    shell.bindings = options.bindings
  }
  
  //Wait for dom to intiailize
  setTimeout(function() { domready(function initGameShell() {
    
    //Retrieve element
    var element = options.element
    if(typeof element === "string") {
      var e = document.querySelector(element)
      if(!e) {
        e = document.getElementById(element)
      }
      if(!e) {
        e = document.getElementByClass(element)[0]
      }
      if(!e) {
        e = makeDefaultContainer()
      }
      shell.element = e
    } else if(typeof element === "object" && !!element) {
      shell.element = element
    } else if(typeof element === "function") {
      shell.element = element()
    } else {
      shell.element = makeDefaultContainer()
    }
    
    //Disable user-select
    if(shell.element.style) {
      shell.element.style["-webkit-touch-callout"] = "none"
      shell.element.style["-webkit-user-select"] = "none"
      shell.element.style["-khtml-user-select"] = "none"
      shell.element.style["-moz-user-select"] = "none"
      shell.element.style["-ms-user-select"] = "none"
      shell.element.style["user-select"] = "none"
    }
    
    //Hook resize handler
    shell._width = shell.element.clientWidth
    shell._height = shell.element.clientHeight
    var handleResize = handleResizeElement.bind(undefined, shell)
    if(typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(handleResize)
      observer.observe(shell.element, {
        attributes: true,
        subtree: true
      })
    } else {
      shell.element.addEventListener("DOMSubtreeModified", handleResize, false)
    }
    window.addEventListener("resize", handleResize, false)
    
    //Hook keyboard listener
    window.addEventListener("keydown", handleKeyDown.bind(undefined, shell), false)
    window.addEventListener("keyup", handleKeyUp.bind(undefined, shell), false)
    
    //Disable right click
    shell.element.oncontextmenu = handleContexMenu.bind(undefined, shell)
    
    //Hook mouse listeners
    shell.element.addEventListener("mousedown", handleMouseDown.bind(undefined, shell), false)
    shell.element.addEventListener("mouseup", handleMouseUp.bind(undefined, shell), false)
    shell.element.addEventListener("mousemove", handleMouseMove.bind(undefined, shell), false)
    shell.element.addEventListener("mouseenter", handleMouseEnter.bind(undefined, shell), false)
    
    //Mouse leave
    var leave = handleMouseLeave.bind(undefined, shell)
    shell.element.addEventListener("mouseleave", leave, false)
    shell.element.addEventListener("mouseout", leave, false)
    window.addEventListener("mouseleave", leave, false)
    window.addEventListener("mouseout", leave, false)
    
    //Blur event 
    var blur = handleBlur.bind(undefined, shell)
    shell.element.addEventListener("blur", blur, false)
    shell.element.addEventListener("focusout", blur, false)
    shell.element.addEventListener("focus", blur, false)
    window.addEventListener("blur", blur, false)
    window.addEventListener("focusout", blur, false)
    window.addEventListener("focus", blur, false)

    //Mouse wheel handler
    addMouseWheel(shell.element, handleMouseWheel.bind(undefined, shell), false)

    //Fullscreen handler
    var fullscreenChange = handleFullscreen.bind(undefined, shell)
    document.addEventListener("fullscreenchange", fullscreenChange, false)
    document.addEventListener("mozfullscreenchange", fullscreenChange, false)
    document.addEventListener("webkitfullscreenchange", fullscreenChange, false)

    //Stupid fullscreen hack
    shell.element.addEventListener("click", tryFullscreen.bind(undefined, shell), false)

    //Pointer lock change handler
    var pointerLockChange = handlePointerLockChange.bind(undefined, shell)
    document.addEventListener("pointerlockchange", pointerLockChange, false)
    document.addEventListener("mozpointerlockchange", pointerLockChange, false)
    document.addEventListener("webkitpointerlockchange", pointerLockChange, false)
    document.addEventListener("pointerlocklost", pointerLockChange, false)
    document.addEventListener("webkitpointerlocklost", pointerLockChange, false)
    document.addEventListener("mozpointerlocklost", pointerLockChange, false)
    
    //Update flags
    shell.fullscreen = useFullscreen
    shell.pointerLock = usePointerLock
  
    //Default mouse button aliases
    shell.bind("mouse-left",   "mouse-1")
    shell.bind("mouse-right",  "mouse-3")
    shell.bind("mouse-middle", "mouse-2")
    
    //Initialize tick counter
    shell._lastTick = hrtime()
    shell.startTime = hrtime()

    //Unpause shell
    shell.paused = false
    
    //Emit initialize event
    shell.emit("init")
  })}, 0)
  
  return shell
}

module.exports = createShell

},{"./lib/hrtime-polyfill.js":25,"./lib/mousewheel-polyfill.js":26,"./lib/raf-polyfill.js":27,"binary-search-bounds":8,"domready":16,"events":213,"invert-hash":167,"iota-array":168,"uniq":201,"util":218,"vkey":202}],29:[function(require,module,exports){
var createVAOEmulated = require("./lib/vao-emulated.js")

function createVAO(gl, attributes, elements, elementsType) {
  var vao = createVAOEmulated(gl)
  vao.update(attributes, elements, elementsType)
  return vao
}

module.exports = createVAO
},{"./lib/vao-emulated.js":31}],30:[function(require,module,exports){
function getAttributeLocation(name, shader) {
    if (!name)
        return null
    var attr = shader.attributes
    if (attr[name]) 
        return attr[name].location
    return null
}

var nattribs = null
var bound = null

function doBind(gl, elements, attributes, shader) {
    if (elements) {
        elements.bind()
    } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    }
    if (nattribs === null) {
      nattribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) | 0
      bound = new Array(nattribs)
    }

    if (attributes) {
        if (attributes.length > nattribs) {
            throw new Error("gl-vao: Too many vertex attributes")
        }

        var lastBound = null

        for (i=0; i<nattribs; i++)
          bound[i] = false

        //now bind aliased attributes
        for (i=0; i<attributes.length; i++) {
            var attrib = attributes[i]
            var loc = getAttributeLocation(attrib.name, shader)
            if (loc === null)
                continue

            bound[loc] = true

            if(attrib.buffer) {
              var buffer = attrib.buffer
              var size = attrib.size || 4
              var type = attrib.type || gl.FLOAT
              var normalized = !!attrib.normalized
              var stride = attrib.stride || 0
              var offset = attrib.offset || 0
              if (lastBound !== buffer) {
                buffer.bind()
                lastBound = buffer
              }
              gl.enableVertexAttribArray(loc)
              gl.vertexAttribPointer(loc, size, type, normalized, stride, offset)
            } else {
              if(typeof attrib === "number") {
                gl.vertexAttrib1f(loc, attrib)
              } else if(attrib.length === 1) {
                gl.vertexAttrib1f(loc, attrib[0])
              } else if(attrib.length === 2) {
                gl.vertexAttrib2f(loc, attrib[0], attrib[1])
              } else if(attrib.length === 3) {
                gl.vertexAttrib3f(loc, attrib[0], attrib[1], attrib[2])
              } else if(attrib.length === 4) {
                gl.vertexAttrib4f(loc, attrib[0], attrib[1], attrib[2], attrib[3])
              } else {
                throw new Error("gl-vao: Invalid vertex attribute")
              }
              gl.disableVertexAttribArray(loc)
            }

        }
        
        for (i=0; i<nattribs; i++) {
          if (!bound[i])
            gl.disableVertexAttribArray(i)
        }
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      for(var i=0; i<nattribs; ++i) {
        gl.disableVertexAttribArray(i)
      }
    }
}

module.exports = doBind
},{}],31:[function(require,module,exports){
var bindAttribs = require("./do-bind.js")

function VAOEmulated(gl) {
  this.gl = gl
  this._elements = null
  this._attributes = null
  this._elementsType = gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.bind = function(shader) {
  if (!shader)
    throw new Error('must associate shader with vertex array')
  bindAttribs(this.gl, this._elements, this._attributes, shader)
}

VAOEmulated.prototype.update = function(attributes, elements, elementsType) {
  this._elements = elements
  this._attributes = attributes
  this._elementsType = elementsType || this.gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.dispose = function() { }
VAOEmulated.prototype.unbind = function() {
  bindAttribs(this.gl)
}

VAOEmulated.prototype.draw = function(mode, count, offset) {
  offset = offset || 0
  var gl = this.gl
  if(this._elements) {
    gl.drawElements(mode, count, this._elementsType, offset)
  } else {
    gl.drawArrays(mode, offset, count)
  }
}

function createVAOEmulated(gl) {
  return new VAOEmulated(gl)
}

module.exports = createVAOEmulated
},{"./do-bind.js":30}],32:[function(require,module,exports){
var identity = require('gl-mat4/identity')
var createShader = require('gl-shader-core')

var POSITION_ATTRIBUTE = 'position',
    NORMAL_ATTRIBUTE = 'normal',
    COLOR_ATTRIBUTE = 'color',
    TEXCOORD_ATTRIBUTE = 'texcoord';


module.exports = function(gl, options) {
    options = options||{}
    options.texcoord = typeof options.texcoord === 'number' 
                ? options.texcoord : (options.texcoord||0)
        
    var shaderSource = module.exports.generate(options),
        vert = shaderSource.vertex,
        frag = shaderSource.fragment,
        uniforms = shaderSource.uniforms,
        attribs = shaderSource.attributes
    
    var shader = createShader(gl, vert, frag, uniforms, attribs)
    shader.bind()
    for (var i=0; i<options.texcoord; i++) 
        shader.uniforms['texture'+i] = i

    var arr = identity( new Float32Array(16) )
    shader.uniforms.projection = arr
    shader.uniforms.model = arr
    shader.uniforms.view = arr
    shader.uniforms.tint = options.tint || [1, 1, 1, 1]

    return shader
}

module.exports.generate = function(options) {
    options = options||{}
    options.texcoord = typeof options.texcoord === 'number' 
                ? options.texcoord : (options.texcoord||0)

    var pointSize = typeof options.pointSize === 'number' ? options.pointSize : 1;
    var vert = typeof options.vertex === 'string'
            ? options.vertex : createVertexShader(options.normal, options.color, options.texcoord, pointSize)
    var frag = typeof options.fragment === 'string'
            ? options.fragment : createFragmentShader(options.color, options.texcoord)

    var uniforms = [
        { type: 'mat4', name: 'projection' },
        { type: 'mat4', name: 'view' },
        { type: 'mat4', name: 'model' },
        { type: 'vec4', name: 'tint' }
    ]

    //Similar to old school pipeline, we will use fixed locations
    //http://www.opengl.org/sdk/docs/tutorials/ClockworkCoders/attributes.php
    var attribs = [
        { type: 'vec4', name: POSITION_ATTRIBUTE, location: 0 }
    ]

    if (options.normal)
        attribs.push({ type: 'vec3', name: NORMAL_ATTRIBUTE, location: 1 })
    if (options.color)
        attribs.push({ type: 'vec4', name: COLOR_ATTRIBUTE, location: 2 })

    var idx = 3
    for (var i=0; i<options.texcoord; i++) {
        uniforms.push({ type: 'sampler2D', name: 'texture'+i })
        attribs.push({ type: 'vec2', name: TEXCOORD_ATTRIBUTE+i, location: idx++ })
    }

    return { vertex: vert, fragment: frag, uniforms: uniforms, attributes: attribs }
}


function createVertexShader(hasNormals, hasColors, numTexCoords, pointSize) {
    numTexCoords = numTexCoords || 0;
    var shader = "";
    shader += "attribute vec4 "+POSITION_ATTRIBUTE+";\n"
         + (hasNormals ? "attribute vec3 " + NORMAL_ATTRIBUTE + ";\n" : "")
         + (hasColors ? "attribute vec4 " + COLOR_ATTRIBUTE + ";\n" : "");

    var i;
    pointSize = pointSize.toFixed(5);

    for (i = 0; i < numTexCoords; i++) {
        shader += "attribute vec2 " + TEXCOORD_ATTRIBUTE + i + ";\n";
    }

    shader += "uniform mat4 projection;\n";
    shader += "uniform mat4 view;\n";
    shader += "uniform mat4 model;\n";
    
    shader += (hasColors ? "varying vec4 v_col;\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "varying vec2 v_tex" + i + ";\n";
    }

    shader += "\nvoid main() {\n" + "   gl_Position = projection * view * model * " + POSITION_ATTRIBUTE + ";\n"
            + (hasColors ? "   v_col = " + COLOR_ATTRIBUTE + ";\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "   v_tex" + i + " = " + TEXCOORD_ATTRIBUTE + i + ";\n";
    }
    shader += "   gl_PointSize = "+pointSize+";\n";
    shader += "}\n";

    return shader;
}

function createFragmentShader(hasColors, numTexCoords) {
    numTexCoords = numTexCoords || 0;
    var shader = "#ifdef GL_ES\n" + "precision mediump float;\n" + "#endif\n\n";
 
    if (hasColors) 
        shader += "varying vec4 v_col;\n";

    var i;
    for (i = 0; i < numTexCoords; i++) {
        shader += "varying vec2 v_tex" + i + ";\n";
        shader += "uniform sampler2D texture" + i + ";\n";
    }
    shader += "uniform vec4 tint;\n";

    shader += "\nvoid main() {\n" + "   gl_FragColor = ";

    if (hasColors)
        shader += "v_col"

    if (hasColors && numTexCoords > 0) 
        shader += " * ";
    else if (!hasColors && !numTexCoords)
        shader += "vec4(1.0)"

    for (i = 0; i < numTexCoords; i++) {
        if (i == numTexCoords - 1) {
                shader += " texture2D(texture" + i + ",  v_tex" + i + ")";
        } else {
                shader += " texture2D(texture" + i + ",  v_tex" + i + ") *";
        }
    }

    shader += " * tint"
    shader += ";\n}";
    return shader;
}
},{"gl-mat4/identity":48,"gl-shader-core":95}],33:[function(require,module,exports){
"use strict"

var pool = require("typedarray-pool")
var ops = require("ndarray-ops")
var ndarray = require("ndarray")

var SUPPORTED_TYPES = [
  "uint8",
  "uint8_clamped",
  "uint16",
  "uint32",
  "int8",
  "int16",
  "int32",
  "float32" ]

function GLBuffer(gl, type, handle, length, usage) {
  this.gl = gl
  this.type = type
  this.handle = handle
  this.length = length
  this.usage = usage
}

var proto = GLBuffer.prototype

proto.bind = function() {
  this.gl.bindBuffer(this.type, this.handle)
}

proto.unbind = function() {
  this.gl.bindBuffer(this.type, null)
}

proto.dispose = function() {
  this.gl.deleteBuffer(this.handle)
}

function updateTypeArray(gl, type, len, usage, data, offset) {
  var dataLen = data.length * data.BYTES_PER_ELEMENT
  if(offset < 0) {
    gl.bufferData(type, data, usage)
    return dataLen
  }
  if(dataLen + offset > len) {
    throw new Error("gl-buffer: If resizing buffer, must not specify offset")
  }
  gl.bufferSubData(type, offset, data)
  return len
}

function makeScratchTypeArray(array, dtype) {
  var res = pool.malloc(array.length, dtype)
  var n = array.length
  for(var i=0; i<n; ++i) {
    res[i] = array[i]
  }
  return res
}

function isPacked(shape, stride) {
  var n = 1
  for(var i=stride.length-1; i>=0; --i) {
    if(stride[i] !== n) {
      return false
    }
    n *= shape[i]
  }
  return true
}

proto.update = function(array, offset) {
  if(typeof offset !== "number") {
    offset = -1
  }
  this.bind()
  if(typeof array === "object" && typeof array.shape !== "undefined") { //ndarray
    var dtype = array.dtype
    if(SUPPORTED_TYPES.indexOf(dtype) < 0) {
      dtype = "float32"
    }
    if(this.type === this.gl.ELEMENT_ARRAY_BUFFER) {
      var ext = gl.getExtension('OES_element_index_uint')
      if(ext && dtype !== "uint16") {
        dtype = "uint32"
      } else {
        dtype = "uint16"
      }
    }
    if(dtype === array.dtype && isPacked(array.shape, array.stride)) {
      if(array.offset === 0 && array.data.length === array.shape[0]) {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array.data, offset)
      } else {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array.data.subarray(array.offset, array.shape[0]), offset)
      }
    } else {
      var tmp = pool.malloc(array.size, dtype)
      var ndt = ndarray(tmp, array.shape)
      ops.assign(ndt, array)
      if(offset < 0) {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, tmp, offset)
      } else {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, tmp.subarray(0, array.size), offset)
      }
      pool.free(tmp)
    }
  } else if(Array.isArray(array)) { //Vanilla array
    var t
    if(this.type === this.gl.ELEMENT_ARRAY_BUFFER) {
      t = makeScratchTypeArray(array, "uint16")
    } else {
      t = makeScratchTypeArray(array, "float32")
    }
    if(offset < 0) {
      this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, t, offset)
    } else {
      this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, t.subarray(0, array.length), offset)
    }
    pool.free(t)
  } else if(typeof array === "object" && typeof array.length === "number") { //Typed array
    this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array, offset)
  } else if(typeof array === "number" || array === undefined) { //Number/default
    if(offset >= 0) {
      throw new Error("gl-buffer: Cannot specify offset when resizing buffer")
    }
    array = array | 0
    if(array <= 0) {
      array = 1
    }
    this.gl.bufferData(this.type, array|0, this.usage)
    this.length = array
  } else { //Error, case should not happen
    throw new Error("gl-buffer: Invalid data type")
  }
}

function createBuffer(gl, data, type, usage) {
  type = type || gl.ARRAY_BUFFER
  usage = usage || gl.DYNAMIC_DRAW
  if(type !== gl.ARRAY_BUFFER && type !== gl.ELEMENT_ARRAY_BUFFER) {
    throw new Error("gl-buffer: Invalid type for webgl buffer, must be either gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER")
  }
  if(usage !== gl.DYNAMIC_DRAW && usage !== gl.STATIC_DRAW && usage !== gl.STREAM_DRAW) {
    throw new Error("gl-buffer: Invalid usage for buffer, must be either gl.DYNAMIC_DRAW, gl.STATIC_DRAW or gl.STREAM_DRAW")
  }
  var handle = gl.createBuffer()
  var result = new GLBuffer(gl, type, handle, 0, usage)
  result.update(data)
  return result
}

module.exports = createBuffer

},{"ndarray":174,"ndarray-ops":173,"typedarray-pool":200}],34:[function(require,module,exports){
module.exports = {
  0: 'NONE',
  1: 'ONE',
  2: 'LINE_LOOP',
  3: 'LINE_STRIP',
  4: 'TRIANGLES',
  5: 'TRIANGLE_STRIP',
  6: 'TRIANGLE_FAN',
  256: 'DEPTH_BUFFER_BIT',
  512: 'NEVER',
  513: 'LESS',
  514: 'EQUAL',
  515: 'LEQUAL',
  516: 'GREATER',
  517: 'NOTEQUAL',
  518: 'GEQUAL',
  519: 'ALWAYS',
  768: 'SRC_COLOR',
  769: 'ONE_MINUS_SRC_COLOR',
  770: 'SRC_ALPHA',
  771: 'ONE_MINUS_SRC_ALPHA',
  772: 'DST_ALPHA',
  773: 'ONE_MINUS_DST_ALPHA',
  774: 'DST_COLOR',
  775: 'ONE_MINUS_DST_COLOR',
  776: 'SRC_ALPHA_SATURATE',
  1024: 'STENCIL_BUFFER_BIT',
  1028: 'FRONT',
  1029: 'BACK',
  1032: 'FRONT_AND_BACK',
  1280: 'INVALID_ENUM',
  1281: 'INVALID_VALUE',
  1282: 'INVALID_OPERATION',
  1285: 'OUT_OF_MEMORY',
  1286: 'INVALID_FRAMEBUFFER_OPERATION',
  2304: 'CW',
  2305: 'CCW',
  2849: 'LINE_WIDTH',
  2884: 'CULL_FACE',
  2885: 'CULL_FACE_MODE',
  2886: 'FRONT_FACE',
  2928: 'DEPTH_RANGE',
  2929: 'DEPTH_TEST',
  2930: 'DEPTH_WRITEMASK',
  2931: 'DEPTH_CLEAR_VALUE',
  2932: 'DEPTH_FUNC',
  2960: 'STENCIL_TEST',
  2961: 'STENCIL_CLEAR_VALUE',
  2962: 'STENCIL_FUNC',
  2963: 'STENCIL_VALUE_MASK',
  2964: 'STENCIL_FAIL',
  2965: 'STENCIL_PASS_DEPTH_FAIL',
  2966: 'STENCIL_PASS_DEPTH_PASS',
  2967: 'STENCIL_REF',
  2968: 'STENCIL_WRITEMASK',
  2978: 'VIEWPORT',
  3024: 'DITHER',
  3042: 'BLEND',
  3088: 'SCISSOR_BOX',
  3089: 'SCISSOR_TEST',
  3106: 'COLOR_CLEAR_VALUE',
  3107: 'COLOR_WRITEMASK',
  3317: 'UNPACK_ALIGNMENT',
  3333: 'PACK_ALIGNMENT',
  3379: 'MAX_TEXTURE_SIZE',
  3386: 'MAX_VIEWPORT_DIMS',
  3408: 'SUBPIXEL_BITS',
  3410: 'RED_BITS',
  3411: 'GREEN_BITS',
  3412: 'BLUE_BITS',
  3413: 'ALPHA_BITS',
  3414: 'DEPTH_BITS',
  3415: 'STENCIL_BITS',
  3553: 'TEXTURE_2D',
  4352: 'DONT_CARE',
  4353: 'FASTEST',
  4354: 'NICEST',
  5120: 'BYTE',
  5121: 'UNSIGNED_BYTE',
  5122: 'SHORT',
  5123: 'UNSIGNED_SHORT',
  5124: 'INT',
  5125: 'UNSIGNED_INT',
  5126: 'FLOAT',
  5386: 'INVERT',
  5890: 'TEXTURE',
  6401: 'STENCIL_INDEX',
  6402: 'DEPTH_COMPONENT',
  6406: 'ALPHA',
  6407: 'RGB',
  6408: 'RGBA',
  6409: 'LUMINANCE',
  6410: 'LUMINANCE_ALPHA',
  7680: 'KEEP',
  7681: 'REPLACE',
  7682: 'INCR',
  7683: 'DECR',
  7936: 'VENDOR',
  7937: 'RENDERER',
  7938: 'VERSION',
  9728: 'NEAREST',
  9729: 'LINEAR',
  9984: 'NEAREST_MIPMAP_NEAREST',
  9985: 'LINEAR_MIPMAP_NEAREST',
  9986: 'NEAREST_MIPMAP_LINEAR',
  9987: 'LINEAR_MIPMAP_LINEAR',
  10240: 'TEXTURE_MAG_FILTER',
  10241: 'TEXTURE_MIN_FILTER',
  10242: 'TEXTURE_WRAP_S',
  10243: 'TEXTURE_WRAP_T',
  10497: 'REPEAT',
  10752: 'POLYGON_OFFSET_UNITS',
  16384: 'COLOR_BUFFER_BIT',
  32769: 'CONSTANT_COLOR',
  32770: 'ONE_MINUS_CONSTANT_COLOR',
  32771: 'CONSTANT_ALPHA',
  32772: 'ONE_MINUS_CONSTANT_ALPHA',
  32773: 'BLEND_COLOR',
  32774: 'FUNC_ADD',
  32777: 'BLEND_EQUATION_RGB',
  32778: 'FUNC_SUBTRACT',
  32779: 'FUNC_REVERSE_SUBTRACT',
  32819: 'UNSIGNED_SHORT_4_4_4_4',
  32820: 'UNSIGNED_SHORT_5_5_5_1',
  32823: 'POLYGON_OFFSET_FILL',
  32824: 'POLYGON_OFFSET_FACTOR',
  32854: 'RGBA4',
  32855: 'RGB5_A1',
  32873: 'TEXTURE_BINDING_2D',
  32926: 'SAMPLE_ALPHA_TO_COVERAGE',
  32928: 'SAMPLE_COVERAGE',
  32936: 'SAMPLE_BUFFERS',
  32937: 'SAMPLES',
  32938: 'SAMPLE_COVERAGE_VALUE',
  32939: 'SAMPLE_COVERAGE_INVERT',
  32968: 'BLEND_DST_RGB',
  32969: 'BLEND_SRC_RGB',
  32970: 'BLEND_DST_ALPHA',
  32971: 'BLEND_SRC_ALPHA',
  33071: 'CLAMP_TO_EDGE',
  33170: 'GENERATE_MIPMAP_HINT',
  33189: 'DEPTH_COMPONENT16',
  33306: 'DEPTH_STENCIL_ATTACHMENT',
  33635: 'UNSIGNED_SHORT_5_6_5',
  33648: 'MIRRORED_REPEAT',
  33901: 'ALIASED_POINT_SIZE_RANGE',
  33902: 'ALIASED_LINE_WIDTH_RANGE',
  33984: 'TEXTURE0',
  33985: 'TEXTURE1',
  33986: 'TEXTURE2',
  33987: 'TEXTURE3',
  33988: 'TEXTURE4',
  33989: 'TEXTURE5',
  33990: 'TEXTURE6',
  33991: 'TEXTURE7',
  33992: 'TEXTURE8',
  33993: 'TEXTURE9',
  33994: 'TEXTURE10',
  33995: 'TEXTURE11',
  33996: 'TEXTURE12',
  33997: 'TEXTURE13',
  33998: 'TEXTURE14',
  33999: 'TEXTURE15',
  34000: 'TEXTURE16',
  34001: 'TEXTURE17',
  34002: 'TEXTURE18',
  34003: 'TEXTURE19',
  34004: 'TEXTURE20',
  34005: 'TEXTURE21',
  34006: 'TEXTURE22',
  34007: 'TEXTURE23',
  34008: 'TEXTURE24',
  34009: 'TEXTURE25',
  34010: 'TEXTURE26',
  34011: 'TEXTURE27',
  34012: 'TEXTURE28',
  34013: 'TEXTURE29',
  34014: 'TEXTURE30',
  34015: 'TEXTURE31',
  34016: 'ACTIVE_TEXTURE',
  34024: 'MAX_RENDERBUFFER_SIZE',
  34041: 'DEPTH_STENCIL',
  34055: 'INCR_WRAP',
  34056: 'DECR_WRAP',
  34067: 'TEXTURE_CUBE_MAP',
  34068: 'TEXTURE_BINDING_CUBE_MAP',
  34069: 'TEXTURE_CUBE_MAP_POSITIVE_X',
  34070: 'TEXTURE_CUBE_MAP_NEGATIVE_X',
  34071: 'TEXTURE_CUBE_MAP_POSITIVE_Y',
  34072: 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
  34073: 'TEXTURE_CUBE_MAP_POSITIVE_Z',
  34074: 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
  34076: 'MAX_CUBE_MAP_TEXTURE_SIZE',
  34338: 'VERTEX_ATTRIB_ARRAY_ENABLED',
  34339: 'VERTEX_ATTRIB_ARRAY_SIZE',
  34340: 'VERTEX_ATTRIB_ARRAY_STRIDE',
  34341: 'VERTEX_ATTRIB_ARRAY_TYPE',
  34342: 'CURRENT_VERTEX_ATTRIB',
  34373: 'VERTEX_ATTRIB_ARRAY_POINTER',
  34466: 'NUM_COMPRESSED_TEXTURE_FORMATS',
  34467: 'COMPRESSED_TEXTURE_FORMATS',
  34660: 'BUFFER_SIZE',
  34661: 'BUFFER_USAGE',
  34816: 'STENCIL_BACK_FUNC',
  34817: 'STENCIL_BACK_FAIL',
  34818: 'STENCIL_BACK_PASS_DEPTH_FAIL',
  34819: 'STENCIL_BACK_PASS_DEPTH_PASS',
  34877: 'BLEND_EQUATION_ALPHA',
  34921: 'MAX_VERTEX_ATTRIBS',
  34922: 'VERTEX_ATTRIB_ARRAY_NORMALIZED',
  34930: 'MAX_TEXTURE_IMAGE_UNITS',
  34962: 'ARRAY_BUFFER',
  34963: 'ELEMENT_ARRAY_BUFFER',
  34964: 'ARRAY_BUFFER_BINDING',
  34965: 'ELEMENT_ARRAY_BUFFER_BINDING',
  34975: 'VERTEX_ATTRIB_ARRAY_BUFFER_BINDING',
  35040: 'STREAM_DRAW',
  35044: 'STATIC_DRAW',
  35048: 'DYNAMIC_DRAW',
  35632: 'FRAGMENT_SHADER',
  35633: 'VERTEX_SHADER',
  35660: 'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  35661: 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  35663: 'SHADER_TYPE',
  35664: 'FLOAT_VEC2',
  35665: 'FLOAT_VEC3',
  35666: 'FLOAT_VEC4',
  35667: 'INT_VEC2',
  35668: 'INT_VEC3',
  35669: 'INT_VEC4',
  35670: 'BOOL',
  35671: 'BOOL_VEC2',
  35672: 'BOOL_VEC3',
  35673: 'BOOL_VEC4',
  35674: 'FLOAT_MAT2',
  35675: 'FLOAT_MAT3',
  35676: 'FLOAT_MAT4',
  35678: 'SAMPLER_2D',
  35680: 'SAMPLER_CUBE',
  35712: 'DELETE_STATUS',
  35713: 'COMPILE_STATUS',
  35714: 'LINK_STATUS',
  35715: 'VALIDATE_STATUS',
  35716: 'INFO_LOG_LENGTH',
  35717: 'ATTACHED_SHADERS',
  35718: 'ACTIVE_UNIFORMS',
  35719: 'ACTIVE_UNIFORM_MAX_LENGTH',
  35720: 'SHADER_SOURCE_LENGTH',
  35721: 'ACTIVE_ATTRIBUTES',
  35722: 'ACTIVE_ATTRIBUTE_MAX_LENGTH',
  35724: 'SHADING_LANGUAGE_VERSION',
  35725: 'CURRENT_PROGRAM',
  36003: 'STENCIL_BACK_REF',
  36004: 'STENCIL_BACK_VALUE_MASK',
  36005: 'STENCIL_BACK_WRITEMASK',
  36006: 'FRAMEBUFFER_BINDING',
  36007: 'RENDERBUFFER_BINDING',
  36048: 'FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE',
  36049: 'FRAMEBUFFER_ATTACHMENT_OBJECT_NAME',
  36050: 'FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL',
  36051: 'FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE',
  36053: 'FRAMEBUFFER_COMPLETE',
  36054: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
  36055: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
  36057: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
  36061: 'FRAMEBUFFER_UNSUPPORTED',
  36064: 'COLOR_ATTACHMENT0',
  36096: 'DEPTH_ATTACHMENT',
  36128: 'STENCIL_ATTACHMENT',
  36160: 'FRAMEBUFFER',
  36161: 'RENDERBUFFER',
  36162: 'RENDERBUFFER_WIDTH',
  36163: 'RENDERBUFFER_HEIGHT',
  36164: 'RENDERBUFFER_INTERNAL_FORMAT',
  36168: 'STENCIL_INDEX8',
  36176: 'RENDERBUFFER_RED_SIZE',
  36177: 'RENDERBUFFER_GREEN_SIZE',
  36178: 'RENDERBUFFER_BLUE_SIZE',
  36179: 'RENDERBUFFER_ALPHA_SIZE',
  36180: 'RENDERBUFFER_DEPTH_SIZE',
  36181: 'RENDERBUFFER_STENCIL_SIZE',
  36194: 'RGB565',
  36336: 'LOW_FLOAT',
  36337: 'MEDIUM_FLOAT',
  36338: 'HIGH_FLOAT',
  36339: 'LOW_INT',
  36340: 'MEDIUM_INT',
  36341: 'HIGH_INT',
  36346: 'SHADER_COMPILER',
  36347: 'MAX_VERTEX_UNIFORM_VECTORS',
  36348: 'MAX_VARYING_VECTORS',
  36349: 'MAX_FRAGMENT_UNIFORM_VECTORS',
  37440: 'UNPACK_FLIP_Y_WEBGL',
  37441: 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
  37442: 'CONTEXT_LOST_WEBGL',
  37443: 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
  37444: 'BROWSER_DEFAULT_WEBGL'
}

},{}],35:[function(require,module,exports){
var gl10 = require('./1.0/numbers')

module.exports = function lookupConstant (number) {
  return gl10[number]
}

},{"./1.0/numbers":34}],36:[function(require,module,exports){

var sprintf = require('sprintf-js').sprintf;
var glConstants = require('gl-constants/lookup');
var shaderName = require('glsl-shader-name');
var addLineNumbers = require('add-line-numbers');

module.exports = formatCompilerError;

function formatCompilerError(errLog, src, type) {
    "use strict";

    var name = shaderName(src) || 'of unknown name (see npm glsl-shader-name)';

    var typeName = 'unknown type';
    if (type !== undefined) {
        typeName = type === glConstants.FRAGMENT_SHADER ? 'fragment' : 'vertex'
    }

    var longForm = sprintf('Error compiling %s shader %s:\n', typeName, name);
    var shortForm = sprintf("%s%s", longForm, errLog);

    var errorStrings = errLog.split('\n');
    var errors = {};

    for (var i = 0; i < errorStrings.length; i++) {
        var errorString = errorStrings[i];
        if (errorString === '') continue;
        var lineNo = parseInt(errorString.split(':')[2]);
        if (isNaN(lineNo)) {
            throw new Error(sprintf('Could not parse error: %s', errorString));
        }
        errors[lineNo] = errorString;
    }

    var lines = addLineNumbers(src).split('\n');

    for (var i = 0; i < lines.length; i++) {
        if (!errors[i+3] && !errors[i+2] && !errors[i+1]) continue;
        var line = lines[i];
        longForm += line + '\n';
        if (errors[i+1]) {
            var e = errors[i+1];
            e = e.substr(e.split(':', 3).join(':').length + 1).trim();
            longForm += sprintf('^^^ %s\n\n', e);
        }
    }

    return {
        long: longForm.trim(),
        short: shortForm.trim()
    };
}


},{"add-line-numbers":3,"gl-constants/lookup":35,"glsl-shader-name":158,"sprintf-js":198}],37:[function(require,module,exports){
var normalize = require('./normalize')
var glType = require('gl-to-dtype')
var createVAO = require('gl-vao')
var dtype = require('dtype')

module.exports = GLGeometry

function GLGeometry (gl) {
  if (!(this instanceof GLGeometry)) {
    return new GLGeometry(gl)
  }

  this._elementsType = 5123
  this._elementsBytes = 2
  this._attributes = []
  this._dirty = true
  this._attrLength = 0
  this._facesLength = 0
  this._index = null
  this._vao = null
  this._keys = []
  this.gl = gl
}

GLGeometry.prototype.dispose = function () {
  for (var i = 0; i < this._attributes.length; i++) {
    this._attributes[i].buffer.dispose()
  }

  this._attributes = []
  this._keys = []
  this._attrLength = 0 // Length of this attribute (the number of vertices it feeds)
  this._facesLength = 0 // Number of vertices needed to draw all faces
  this._dirty = true

  if (this._index) {
    this._index.dispose()
    this._index = null
  }

  if (this._vao) {
    this._vao.dispose()
    this._vao = null
  }
}

GLGeometry.prototype.faces = function faces (attr, opts) {
  var size = opts && opts.size || 3
  attr = attr.cells ? attr.cells : attr

  this._dirty = true

  if (this._index) {
    this._index.dispose()
  }

  this._index = normalize.create(this.gl
    , attr
    , size
    , this.gl.ELEMENT_ARRAY_BUFFER
    , 'uint16'
  )

  this._facesLength = this._index.length * size
  this._index = this._index.buffer

  return this
}

GLGeometry.prototype.attr = function attr (name, attr, opts) {
  // If we get a simplicial complex
  if (attr.cells && attr.positions) {
    return this.attr(name, attr.positions).faces(attr.cells, opts)
  }

  opts = opts || {}
  var size = opts.size || 3

  // Is this a known attribute (ie, an update)?
  var keyIndex = this._keys.indexOf(name)
  if (keyIndex > -1) {
    var toUpdate = this._attributes[keyIndex].buffer
    var offset = opts.offset || undefined
    normalize.update(toUpdate, attr, size, 'float32', offset)
    this._attrLength = toUpdate.length / size / 4
    return this
  }

  this._dirty = true

  var gl = this.gl
  var first = !this._attributes.length

  var attribute = normalize.create(gl, attr, size, gl.ARRAY_BUFFER, 'float32')
  if (!attribute) {
    throw new Error(
      'Unexpected attribute format: needs an ndarray, array, typed array, ' +
      'gl-buffer or simplicial complex'
    )
  }

  var buffer = attribute.buffer
  var length = attribute.length

  this._keys.push(name)
  this._attributes.push({
    size: size,
    buffer: buffer
  })

  if (first) {
    this._attrLength = length
  }

  return this
}

GLGeometry.prototype.bind = function bind (shader) {
  this.update()
  this._vao.bind()

  if (!this._keys) return
  if (!shader) return

  for (var i = 0; i < this._keys.length; i++) {
    var attr = shader.attributes[this._keys[i]]
    if (attr) attr.location = i
  }

  shader.bind()
}

GLGeometry.prototype.draw = function draw (mode, start, stop) {
  start = typeof start === 'undefined' ? 0 : start
  mode = typeof mode === 'undefined' ? this.gl.TRIANGLES : mode

  this.update()

  if (this._vao._useElements) {
    stop = typeof stop === 'undefined' ? this._facesLength : stop
    this.gl.drawElements(mode, stop - start, this._elementsType, start * this._elementsBytes)
  } else {
    stop = typeof stop === 'undefined' ? this._attrLength : stop
    this.gl.drawArrays(mode, start, stop - start)
  }
}

GLGeometry.prototype.unbind = function unbind () {
  this.update()
  this._vao.unbind()
}

GLGeometry.prototype.update = function update () {
  if (!this._dirty) return
  this._dirty = false
  if (this._vao) this._vao.dispose()

  this._vao = createVAO(this.gl, this._attributes, this._index)
  this._elementsType = this._vao._elementsType
  this._elementsBytes = dtype(
    glType(this._elementsType) || 'array'
  ).BYTES_PER_ELEMENT || 2
}

},{"./normalize":38,"dtype":17,"gl-to-dtype":108,"gl-vao":112}],38:[function(require,module,exports){
var pack = require('array-pack-2d')
var ista = require('is-typedarray')
var createBuffer = require('gl-buffer')
var isnd = require('isndarray')
var dtype = require('dtype')

module.exports.create = create
module.exports.update = update

function create (gl, attr, size, mode, type) {
  // if we get a gl-buffer
  if (attr.handle instanceof WebGLBuffer) {
    return {
      buffer: attr,
      length: attr.length / size / 4
    }
  }

  var arr = normalize(attr, size, type)
  return {
    buffer: createBuffer(gl, arr.data, mode),
    length: arr.length
  }
}

function update (buffer, attr, size, type, offset) {
  // if we get a gl-buffer
  if (attr.handle instanceof WebGLBuffer) {
    throw new Error('Unhandled update case: WebGLBuffer')
  }

  var arr = normalize(attr, size, type)
  buffer.update(arr.data, offset)
}

function normalize (attr, size, type) {
  // if we get a nested 2D array
  if (Array.isArray(attr) && Array.isArray(attr[0])) {
    return {
      data: pack(attr, type),
      length: attr.length
    }
  }

  // if we get a nested 2D array (with the second array being typed)
  if (Array.isArray(attr) && ista(attr[0])) {
    return {
      data: pack(attr, type),
      length: (attr.length * attr[0].length) / size
    }
  }

  // if we get a 1D array
  if (Array.isArray(attr)) {
    return {
      data: new (dtype(type))(attr),
      length: attr.length / size
    }
  }

  // if we get an ndarray
  if (isnd(attr)) {
    return {
      data: attr,
      length: ndlength(attr.shape) / size
    }
  }

  // if we get a typed array
  if (ista(attr)) {
    if (type && !(attr instanceof dtype(type))) {
      attr = convert(attr, dtype(type))
    }

    return {
      data: attr,
      length: attr.length / size
    }
  }
}

function ndlength (shape) {
  var length = 1
  for (var i = 0; i < shape.length; i++) length *= shape[i]
  return length
}

function convert (a, B) {
  var b = new B(a.length)
  for (var i = 0; i < a.length; i++) b[i] = a[i]
  return b
}

},{"array-pack-2d":5,"dtype":17,"gl-buffer":33,"is-typedarray":170,"isndarray":171}],39:[function(require,module,exports){
module.exports = create

/**
 * Creates a new identity mat3
 *
 * @alias mat3.create
 * @returns {mat3} a new 3x3 matrix
 */
function create() {
  var out = new Float32Array(9)
  out[0] = 1
  out[1] = 0
  out[2] = 0
  out[3] = 0
  out[4] = 1
  out[5] = 0
  out[6] = 0
  out[7] = 0
  out[8] = 1
  return out
}

},{}],40:[function(require,module,exports){
module.exports = adjoint;

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function adjoint(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return out;
};
},{}],41:[function(require,module,exports){
module.exports = clone;

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
function clone(a) {
    var out = new Float32Array(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],42:[function(require,module,exports){
module.exports = copy;

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],43:[function(require,module,exports){
module.exports = create;

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
function create() {
    var out = new Float32Array(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};
},{}],44:[function(require,module,exports){
module.exports = determinant;

/**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */
function determinant(a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};
},{}],45:[function(require,module,exports){
module.exports = fromQuat;

/**
 * Creates a matrix from a quaternion rotation.
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @returns {mat4} out
 */
function fromQuat(out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;

    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;

    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
};
},{}],46:[function(require,module,exports){
module.exports = fromRotationTranslation;

/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */
function fromRotationTranslation(out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    
    return out;
};
},{}],47:[function(require,module,exports){
module.exports = frustum;

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
function frustum(out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return out;
};
},{}],48:[function(require,module,exports){
module.exports = identity;

/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
function identity(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};
},{}],49:[function(require,module,exports){
module.exports = {
  create: require('./create')
  , clone: require('./clone')
  , copy: require('./copy')
  , identity: require('./identity')
  , transpose: require('./transpose')
  , invert: require('./invert')
  , adjoint: require('./adjoint')
  , determinant: require('./determinant')
  , multiply: require('./multiply')
  , translate: require('./translate')
  , scale: require('./scale')
  , rotate: require('./rotate')
  , rotateX: require('./rotateX')
  , rotateY: require('./rotateY')
  , rotateZ: require('./rotateZ')
  , fromRotationTranslation: require('./fromRotationTranslation')
  , fromQuat: require('./fromQuat')
  , frustum: require('./frustum')
  , perspective: require('./perspective')
  , perspectiveFromFieldOfView: require('./perspectiveFromFieldOfView')
  , ortho: require('./ortho')
  , lookAt: require('./lookAt')
  , str: require('./str')
}
},{"./adjoint":40,"./clone":41,"./copy":42,"./create":43,"./determinant":44,"./fromQuat":45,"./fromRotationTranslation":46,"./frustum":47,"./identity":48,"./invert":50,"./lookAt":51,"./multiply":52,"./ortho":53,"./perspective":54,"./perspectiveFromFieldOfView":55,"./rotate":56,"./rotateX":57,"./rotateY":58,"./rotateZ":59,"./scale":60,"./str":61,"./translate":62,"./transpose":63}],50:[function(require,module,exports){
module.exports = invert;

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function invert(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
};
},{}],51:[function(require,module,exports){
var identity = require('./identity');

module.exports = lookAt;

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */
function lookAt(out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye[0],
        eyey = eye[1],
        eyez = eye[2],
        upx = up[0],
        upy = up[1],
        upz = up[2],
        centerx = center[0],
        centery = center[1],
        centerz = center[2];

    if (Math.abs(eyex - centerx) < 0.000001 &&
        Math.abs(eyey - centery) < 0.000001 &&
        Math.abs(eyez - centerz) < 0.000001) {
        return identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
};
},{"./identity":48}],52:[function(require,module,exports){
module.exports = multiply;

/**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */
function multiply(out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};
},{}],53:[function(require,module,exports){
module.exports = ortho;

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function ortho(out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
};
},{}],54:[function(require,module,exports){
module.exports = perspective;

/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function perspective(out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
};
},{}],55:[function(require,module,exports){
module.exports = perspectiveFromFieldOfView;

/**
 * Generates a perspective projection matrix with the given field of view.
 * This is primarily useful for generating projection matrices to be used
 * with the still experiemental WebVR API.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fov Object containing the following values: upDegrees, downDegrees, leftDegrees, rightDegrees
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function perspectiveFromFieldOfView(out, fov, near, far) {
    var upTan = Math.tan(fov.upDegrees * Math.PI/180.0),
        downTan = Math.tan(fov.downDegrees * Math.PI/180.0),
        leftTan = Math.tan(fov.leftDegrees * Math.PI/180.0),
        rightTan = Math.tan(fov.rightDegrees * Math.PI/180.0),
        xScale = 2.0 / (leftTan + rightTan),
        yScale = 2.0 / (upTan + downTan);

    out[0] = xScale;
    out[1] = 0.0;
    out[2] = 0.0;
    out[3] = 0.0;
    out[4] = 0.0;
    out[5] = yScale;
    out[6] = 0.0;
    out[7] = 0.0;
    out[8] = -((leftTan - rightTan) * xScale * 0.5);
    out[9] = ((upTan - downTan) * yScale * 0.5);
    out[10] = far / (near - far);
    out[11] = -1.0;
    out[12] = 0.0;
    out[13] = 0.0;
    out[14] = (far * near) / (near - far);
    out[15] = 0.0;
    return out;
}


},{}],56:[function(require,module,exports){
module.exports = rotate;

/**
 * Rotates a mat4 by the given angle
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
function rotate(out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2],
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < 0.000001) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
};
},{}],57:[function(require,module,exports){
module.exports = rotateX;

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateX(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[0]  = a[0];
        out[1]  = a[1];
        out[2]  = a[2];
        out[3]  = a[3];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};
},{}],58:[function(require,module,exports){
module.exports = rotateY;

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateY(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[4]  = a[4];
        out[5]  = a[5];
        out[6]  = a[6];
        out[7]  = a[7];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};
},{}],59:[function(require,module,exports){
module.exports = rotateZ;

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateZ(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[8]  = a[8];
        out[9]  = a[9];
        out[10] = a[10];
        out[11] = a[11];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};
},{}],60:[function(require,module,exports){
module.exports = scale;

/**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
function scale(out, a, v) {
    var x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],61:[function(require,module,exports){
module.exports = str;

/**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
function str(a) {
    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};
},{}],62:[function(require,module,exports){
module.exports = translate;

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */
function translate(out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23;

    if (a === out) {
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

        out[12] = a00 * x + a10 * y + a20 * z + a[12];
        out[13] = a01 * x + a11 * y + a21 * z + a[13];
        out[14] = a02 * x + a12 * y + a22 * z + a[14];
        out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
};
},{}],63:[function(require,module,exports){
module.exports = transpose;

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function transpose(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a03 = a[3],
            a12 = a[6], a13 = a[7],
            a23 = a[11];

        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
    } else {
        out[0] = a[0];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a[1];
        out[5] = a[5];
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a[2];
        out[9] = a[6];
        out[10] = a[10];
        out[11] = a[14];
        out[12] = a[3];
        out[13] = a[7];
        out[14] = a[11];
        out[15] = a[15];
    }
    
    return out;
};
},{}],64:[function(require,module,exports){
"use strict"

var makeGameShell = require("game-shell")
var webglew = require("webglew")

function createGLShell(options) {
  options = options || {}
  
  var extensions = options.extensions || []

  //First create shell
  var shell = makeGameShell(options)
  var scale = shell.scale || 1
  var contextOptions = options.glOptions

  shell.on("init", function initGLNow() {
  
    //Create canvas
    var canvas = document.createElement("canvas")
    
    //Try initializing WebGL
    var gl = canvas.getContext("webgl", contextOptions) || 
             canvas.getContext("experimental-webgl", contextOptions)
    if(!gl) {
      shell.emit("gl-error", new Error("Unable to initialize WebGL"))
      return
    }
    
    //Check extensions
    var ext = webglew(gl)
    for(var i=0; i<extensions.length; ++i) {
      if(!(extensions[i] in ext)) {
        shell.emit("gl-error", new Error("Missing extension: " + extensions[i]))
        return
      }
    }

    //Set canvas style
    canvas.style.position = "absolute"
    canvas.style.left = "0px"
    canvas.style.top = "0px"
    shell.element.appendChild(canvas)

    //Add variables to game-shell
    shell.canvas = canvas
    shell.gl = gl

    //Load width/height
    resize()

    //Load default parameters
    shell.clearFlags = options.clearFlags === undefined ? (gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) : options.clearFlags
    shell.clearColor = options.clearColor || [0,0,0,0]
    shell.clearDepth = options.clearDepth || 1.0
    shell.clearStencil = options.clearStencil || 0

    shell.on("resize", resize)

    //Hook render event
    shell.on("render", function renderGLNow(t) {
    
      //Bind default framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      
      //Set viewport
      gl.viewport(0, 0, (shell._width / scale)|0, (shell._height / scale)|0)

      //Clear buffers
      if(shell.clearFlags & gl.STENCIL_BUFFER_BIT) {
        gl.clearStencil(shell.clearStencil)
      }
      if(shell.clearFlags & gl.COLOR_BUFFER_BIT) {
        gl.clearColor(shell.clearColor[0], shell.clearColor[1], shell.clearColor[2], shell.clearColor[3])
      }
      if(shell.clearFlags & gl.DEPTH_BUFFER_BIT) {
        gl.clearDepth(shell.clearDepth)
      }
      if(shell.clearFlags) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
      }
    
      //Render frame
      shell.emit("gl-render", t)
    })
    
    //WebGL initialized
    shell.emit("gl-init")
  })

  function resize() {
    var nw = (shell._width/scale)|0
    var nh = (shell._height/scale)|0
    shell.canvas.width = nw
    shell.canvas.height = nh
    shell.canvas.style.width = shell._width + 'px'
    shell.canvas.style.height = shell._height + 'px'
    shell.emit("gl-resize", nw, nh)
  }

  Object.defineProperty(shell, 'scale', {
    get: function() {
      return scale
    },
    set: function(_scale) {
      _scale = +_scale
      if((_scale <= 0) || isNaN(_scale) || (scale === _scale)) {
        return scale
      }
      scale = _scale
      resize()
      return scale
    }
  })

  Object.defineProperty(shell, "width", {
    get: function() {
      return (shell._width / scale)|0
    }
  })

  Object.defineProperty(shell, "height", {
    get: function() {
      return (shell._height / scale)|0
    }
  })

  Object.defineProperty(shell, "mouse", {
    get: function() {
      return [shell.mouseX/scale, shell.mouseY/scale]
    }
  })

  Object.defineProperty(shell, "prevMouse", {
    get: function() {
      return [shell.prevMouseX/scale, shell.prevMouseY/scale]
    }
  })

  return shell
}

module.exports = createGLShell
},{"game-shell":28,"webglew":207}],65:[function(require,module,exports){
/**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/add')

},{"gl-vec4/add":146}],66:[function(require,module,exports){
module.exports = calculateW

/**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate W component of
 * @returns {quat} out
 */
function calculateW (out, a) {
  var x = a[0], y = a[1], z = a[2]

  out[0] = x
  out[1] = y
  out[2] = z
  out[3] = Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z))
  return out
}

},{}],67:[function(require,module,exports){
/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {quat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */
module.exports = require('gl-vec4/clone')

},{"gl-vec4/clone":147}],68:[function(require,module,exports){
module.exports = conjugate

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */
function conjugate (out, a) {
  out[0] = -a[0]
  out[1] = -a[1]
  out[2] = -a[2]
  out[3] = a[3]
  return out
}

},{}],69:[function(require,module,exports){
/**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the source quaternion
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/copy')

},{"gl-vec4/copy":148}],70:[function(require,module,exports){
module.exports = create

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
function create () {
  var out = new Float32Array(4)
  out[0] = 0
  out[1] = 0
  out[2] = 0
  out[3] = 1
  return out
}

},{}],71:[function(require,module,exports){
/**
 * Calculates the dot product of two quat's
 *
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
module.exports = require('gl-vec4/dot')

},{"gl-vec4/dot":149}],72:[function(require,module,exports){
module.exports = fromMat3

/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {mat3} m rotation matrix
 * @returns {quat} out
 * @function
 */
function fromMat3 (out, m) {
  // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
  // article "Quaternion Calculus and Fast Animation".
  var fTrace = m[0] + m[4] + m[8]
  var fRoot

  if (fTrace > 0.0) {
    // |w| > 1/2, may as well choose w > 1/2
    fRoot = Math.sqrt(fTrace + 1.0)  // 2w
    out[3] = 0.5 * fRoot
    fRoot = 0.5 / fRoot  // 1/(4w)
    out[0] = (m[5] - m[7]) * fRoot
    out[1] = (m[6] - m[2]) * fRoot
    out[2] = (m[1] - m[3]) * fRoot
  } else {
    // |w| <= 1/2
    var i = 0
    if (m[4] > m[0]) {
      i = 1
    }
    if (m[8] > m[i * 3 + i]) {
      i = 2
    }
    var j = (i + 1) % 3
    var k = (i + 2) % 3

    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0)
    out[i] = 0.5 * fRoot
    fRoot = 0.5 / fRoot
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot
  }

  return out
}

},{}],73:[function(require,module,exports){
/**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */
module.exports = require('gl-vec4/fromValues')

},{"gl-vec4/fromValues":150}],74:[function(require,module,exports){
module.exports = identity

/**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
function identity (out) {
  out[0] = 0
  out[1] = 0
  out[2] = 0
  out[3] = 1
  return out
}

},{}],75:[function(require,module,exports){
module.exports = {
  add: require('./add'),
  calculateW: require('./calculateW'),
  clone: require('./clone'),
  conjugate: require('./conjugate'),
  copy: require('./copy'),
  create: require('./create'),
  dot: require('./dot'),
  fromMat3: require('./fromMat3'),
  fromValues: require('./fromValues'),
  identity: require('./identity'),
  invert: require('./invert'),
  length: require('./length'),
  lerp: require('./lerp'),
  multiply: require('./multiply'),
  normalize: require('./normalize'),
  rotateX: require('./rotateX'),
  rotateY: require('./rotateY'),
  rotateZ: require('./rotateZ'),
  rotationTo: require('./rotationTo'),
  scale: require('./scale'),
  set: require('./set'),
  setAxes: require('./setAxes'),
  setAxisAngle: require('./setAxisAngle'),
  slerp: require('./slerp'),
  sqlerp: require('./sqlerp'),
  squaredLength: require('./squaredLength')
}

},{"./add":65,"./calculateW":66,"./clone":67,"./conjugate":68,"./copy":69,"./create":70,"./dot":71,"./fromMat3":72,"./fromValues":73,"./identity":74,"./invert":76,"./length":77,"./lerp":78,"./multiply":79,"./normalize":80,"./rotateX":81,"./rotateY":82,"./rotateZ":83,"./rotationTo":84,"./scale":85,"./set":86,"./setAxes":87,"./setAxisAngle":88,"./slerp":89,"./sqlerp":90,"./squaredLength":91}],76:[function(require,module,exports){
module.exports = invert

/**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate inverse of
 * @returns {quat} out
 */
function invert (out, a) {
  var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
    dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3,
    invDot = dot ? 1.0 / dot : 0

  // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

  out[0] = -a0 * invDot
  out[1] = -a1 * invDot
  out[2] = -a2 * invDot
  out[3] = a3 * invDot
  return out
}

},{}],77:[function(require,module,exports){
/**
 * Calculates the length of a quat
 *
 * @param {quat} a vector to calculate length of
 * @returns {Number} length of a
 * @function
 */
module.exports = require('gl-vec4/length')

},{"gl-vec4/length":151}],78:[function(require,module,exports){
/**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/lerp')

},{"gl-vec4/lerp":152}],79:[function(require,module,exports){
module.exports = multiply

/**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 */
function multiply (out, a, b) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    bx = b[0], by = b[1], bz = b[2], bw = b[3]

  out[0] = ax * bw + aw * bx + ay * bz - az * by
  out[1] = ay * bw + aw * by + az * bx - ax * bz
  out[2] = az * bw + aw * bz + ax * by - ay * bx
  out[3] = aw * bw - ax * bx - ay * by - az * bz
  return out
}

},{}],80:[function(require,module,exports){
/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/normalize')

},{"gl-vec4/normalize":153}],81:[function(require,module,exports){
module.exports = rotateX

/**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
function rotateX (out, a, rad) {
  rad *= 0.5

  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    bx = Math.sin(rad), bw = Math.cos(rad)

  out[0] = ax * bw + aw * bx
  out[1] = ay * bw + az * bx
  out[2] = az * bw - ay * bx
  out[3] = aw * bw - ax * bx
  return out
}

},{}],82:[function(require,module,exports){
module.exports = rotateY

/**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
function rotateY (out, a, rad) {
  rad *= 0.5

  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    by = Math.sin(rad), bw = Math.cos(rad)

  out[0] = ax * bw - az * by
  out[1] = ay * bw + aw * by
  out[2] = az * bw + ax * by
  out[3] = aw * bw - ay * by
  return out
}

},{}],83:[function(require,module,exports){
module.exports = rotateZ

/**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
function rotateZ (out, a, rad) {
  rad *= 0.5

  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    bz = Math.sin(rad), bw = Math.cos(rad)

  out[0] = ax * bw + ay * bz
  out[1] = ay * bw - ax * bz
  out[2] = az * bw + aw * bz
  out[3] = aw * bw - az * bz
  return out
}

},{}],84:[function(require,module,exports){
var vecDot = require('gl-vec3/dot')
var vecCross = require('gl-vec3/cross')
var vecLength = require('gl-vec3/length')
var vecNormalize = require('gl-vec3/normalize')

var quatNormalize = require('./normalize')
var quatAxisAngle = require('./setAxisAngle')

module.exports = rotationTo

var tmpvec3 = [0, 0, 0]
var xUnitVec3 = [1, 0, 0]
var yUnitVec3 = [0, 1, 0]

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */
function rotationTo (out, a, b) {
  var dot = vecDot(a, b)
  if (dot < -0.999999) {
    vecCross(tmpvec3, xUnitVec3, a)
    if (vecLength(tmpvec3) < 0.000001) {
      vecCross(tmpvec3, yUnitVec3, a)
    }
    vecNormalize(tmpvec3, tmpvec3)
    quatAxisAngle(out, tmpvec3, Math.PI)
    return out
  } else if (dot > 0.999999) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    out[3] = 1
    return out
  } else {
    vecCross(tmpvec3, a, b)
    out[0] = tmpvec3[0]
    out[1] = tmpvec3[1]
    out[2] = tmpvec3[2]
    out[3] = 1 + dot
    return quatNormalize(out, out)
  }
}

},{"./normalize":80,"./setAxisAngle":88,"gl-vec3/cross":118,"gl-vec3/dot":121,"gl-vec3/length":126,"gl-vec3/normalize":132}],85:[function(require,module,exports){
/**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {quat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/scale')

},{"gl-vec4/scale":154}],86:[function(require,module,exports){
/**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */
module.exports = require('gl-vec4/set')

},{"gl-vec4/set":155}],87:[function(require,module,exports){
var mat3create = require('gl-mat3/create')
var fromMat3 = require('./fromMat3')
var normalize = require('./normalize')

module.exports = setAxes

var matr = mat3create()

/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {vec3} view  the vector representing the viewing direction
 * @param {vec3} right the vector representing the local "right" direction
 * @param {vec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */
function setAxes (out, view, right, up) {
  matr[0] = right[0]
  matr[3] = right[1]
  matr[6] = right[2]

  matr[1] = up[0]
  matr[4] = up[1]
  matr[7] = up[2]

  matr[2] = -view[0]
  matr[5] = -view[1]
  matr[8] = -view[2]

  return normalize(out, fromMat3(out, matr))
}

},{"./fromMat3":72,"./normalize":80,"gl-mat3/create":39}],88:[function(require,module,exports){
module.exports = setAxisAngle

/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {vec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/
function setAxisAngle (out, axis, rad) {
  rad = rad * 0.5
  var s = Math.sin(rad)
  out[0] = s * axis[0]
  out[1] = s * axis[1]
  out[2] = s * axis[2]
  out[3] = Math.cos(rad)
  return out
}

},{}],89:[function(require,module,exports){
module.exports = slerp

/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */
function slerp (out, a, b, t) {
  // benchmarks:
  //    http://jsperf.com/quaternion-slerp-implementations

  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    bx = b[0], by = b[1], bz = b[2], bw = b[3]

  var omega, cosom, sinom, scale0, scale1

  // calc cosine
  cosom = ax * bx + ay * by + az * bz + aw * bw
  // adjust signs (if necessary)
  if (cosom < 0.0) {
    cosom = -cosom
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  // calculate coefficients
  if ((1.0 - cosom) > 0.000001) {
    // standard case (slerp)
    omega = Math.acos(cosom)
    sinom = Math.sin(omega)
    scale0 = Math.sin((1.0 - t) * omega) / sinom
    scale1 = Math.sin(t * omega) / sinom
  } else {
    // "from" and "to" quaternions are very close
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t
    scale1 = t
  }
  // calculate final values
  out[0] = scale0 * ax + scale1 * bx
  out[1] = scale0 * ay + scale1 * by
  out[2] = scale0 * az + scale1 * bz
  out[3] = scale0 * aw + scale1 * bw

  return out
}

},{}],90:[function(require,module,exports){
var slerp = require('./slerp')

module.exports = sqlerp

var temp1 = [0, 0, 0, 1]
var temp2 = [0, 0, 0, 1]

/**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {quat} c the third operand
 * @param {quat} d the fourth operand
 * @param {Number} t interpolation amount
 * @returns {quat} out
 */
function sqlerp (out, a, b, c, d, t) {
  slerp(temp1, a, d, t)
  slerp(temp2, b, c, t)
  slerp(out, temp1, temp2, 2 * t * (1 - t))

  return out
}

},{"./slerp":89}],91:[function(require,module,exports){
/**
 * Calculates the squared length of a quat
 *
 * @param {quat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
module.exports = require('gl-vec4/squaredLength')

},{"gl-vec4/squaredLength":156}],92:[function(require,module,exports){
'use strict'

module.exports = createAttributeWrapper

//Shader attribute class
function ShaderAttribute(gl, program, location, dimension, name, constFunc, relink) {
  this._gl = gl
  this._program = program
  this._location = location
  this._dimension = dimension
  this._name = name
  this._constFunc = constFunc
  this._relink = relink
}

var proto = ShaderAttribute.prototype

proto.pointer = function setAttribPointer(type, normalized, stride, offset) {
  var gl = this._gl
  gl.vertexAttribPointer(this._location, this._dimension, type||gl.FLOAT, !!normalized, stride||0, offset||0)
  this._gl.enableVertexAttribArray(this._location)
}

Object.defineProperty(proto, 'location', {
  get: function() {
    return this._location
  }
  , set: function(v) {
    if(v !== this._location) {
      this._location = v
      this._gl.bindAttribLocation(this._program, v, this._name)
      this._gl.linkProgram(this._program)
      this._relink()
    }
  }
})


//Adds a vector attribute to obj
function addVectorAttribute(gl, program, location, dimension, obj, name, doLink) {
  var constFuncArgs = [ 'gl', 'v' ]
  var varNames = []
  for(var i=0; i<dimension; ++i) {
    constFuncArgs.push('x'+i)
    varNames.push('x'+i)
  }
  constFuncArgs.push([
    'if(x0.length===void 0){return gl.vertexAttrib', dimension, 'f(v,', varNames.join(), ')}else{return gl.vertexAttrib', dimension, 'fv(v,x0)}'
  ].join(''))
  var constFunc = Function.apply(undefined, constFuncArgs)
  var attr = new ShaderAttribute(gl, program, location, dimension, name, constFunc, doLink)
  Object.defineProperty(obj, name, {
    set: function(x) {
      gl.disableVertexAttribArray(attr._location)
      constFunc(gl, attr._location, x)
      return x
    }
    , get: function() {
      return attr
    }
    , enumerable: true
  })
}

//Create shims for attributes
function createAttributeWrapper(gl, program, attributes, doLink) {
  var obj = {}
  for(var i=0, n=attributes.length; i<n; ++i) {
    var a = attributes[i]
    var name = a.name
    var type = a.type
    var location = gl.getAttribLocation(program, name)
    
    switch(type) {
      case 'bool':
      case 'int':
      case 'float':
        addVectorAttribute(gl, program, location, 1, obj, name, doLink)
      break
      
      default:
        if(type.indexOf('vec') >= 0) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new Error('gl-shader: Invalid data type for attribute ' + name + ': ' + type)
          }
          addVectorAttribute(gl, program, location, d, obj, name, doLink)
        } else {
          throw new Error('gl-shader: Unknown data type for attribute ' + name + ': ' + type)
        }
      break
    }
  }
  return obj
}
},{}],93:[function(require,module,exports){
'use strict'

var dup = require('dup')
var coallesceUniforms = require('./reflect')

module.exports = createUniformWrapper

//Binds a function and returns a value
function identity(x) {
  var c = new Function('y', 'return function(){return y}')
  return c(x)
}

//Create shims for uniforms
function createUniformWrapper(gl, program, uniforms, locations) {

  function makeGetter(index) {
    var proc = new Function('gl', 'prog', 'locations', 
      'return function(){return gl.getUniform(prog,locations[' + index + '])}') 
    return proc(gl, program, locations)
  }

  function makePropSetter(path, index, type) {
    switch(type) {
      case 'bool':
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 'gl.uniform1i(locations[' + index + '],obj' + path + ')'
      case 'float':
        return 'gl.uniform1f(locations[' + index + '],obj' + path + ')'
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new Error('gl-shader: Invalid data type')
          }
          switch(type.charAt(0)) {
            case 'b':
            case 'i':
              return 'gl.uniform' + d + 'iv(locations[' + index + '],obj' + path + ')'
            case 'v':
              return 'gl.uniform' + d + 'fv(locations[' + index + '],obj' + path + ')'
            default:
              throw new Error('gl-shader: Unrecognized data type for vector ' + name + ': ' + type)
          }
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new Error('gl-shader: Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return 'gl.uniformMatrix' + d + 'fv(locations[' + index + '],false,obj' + path + ')'
        } else {
          throw new Error('gl-shader: Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function enumerateIndices(prefix, type) {
    if(typeof type !== 'object') {
      return [ [prefix, type] ]
    }
    var indices = []
    for(var id in type) {
      var prop = type[id]
      var tprefix = prefix
      if(parseInt(id) + '' === id) {
        tprefix += '[' + id + ']'
      } else {
        tprefix += '.' + id
      }
      if(typeof prop === 'object') {
        indices.push.apply(indices, enumerateIndices(tprefix, prop))
      } else {
        indices.push([tprefix, prop])
      }
    }
    return indices
  }

  function makeSetter(type) {
    var code = [ 'return function updateProperty(obj){' ]
    var indices = enumerateIndices('', type)
    for(var i=0; i<indices.length; ++i) {
      var item = indices[i]
      var path = item[0]
      var idx  = item[1]
      if(locations[idx]) {
        code.push(makePropSetter(path, idx, uniforms[idx].type))
      }
    }
    code.push('return obj}')
    var proc = new Function('gl', 'prog', 'locations', code.join('\n'))
    return proc(gl, program, locations)
  }

  function defaultValue(type) {
    switch(type) {
      case 'bool':
        return false
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 0
      case 'float':
        return 0.0
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new Error('gl-shader: Invalid data type')
          }
          if(type.charAt(0) === 'b') {
            return dup(d, false)
          }
          return dup(d)
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new Error('gl-shader: Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return dup([d,d])
        } else {
          throw new Error('gl-shader: Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function storeProperty(obj, prop, type) {
    if(typeof type === 'object') {
      var child = processObject(type)
      Object.defineProperty(obj, prop, {
        get: identity(child),
        set: makeSetter(type),
        enumerable: true,
        configurable: false
      })
    } else {
      if(locations[type]) {
        Object.defineProperty(obj, prop, {
          get: makeGetter(type),
          set: makeSetter(type),
          enumerable: true,
          configurable: false
        })
      } else {
        obj[prop] = defaultValue(uniforms[type].type)
      }
    }
  }

  function processObject(obj) {
    var result
    if(Array.isArray(obj)) {
      result = new Array(obj.length)
      for(var i=0; i<obj.length; ++i) {
        storeProperty(result, i, obj[i])
      }
    } else {
      result = {}
      for(var id in obj) {
        storeProperty(result, id, obj[id])
      }
    }
    return result
  }

  //Return data
  var coallesced = coallesceUniforms(uniforms, true)
  return {
    get: identity(processObject(coallesced)),
    set: makeSetter(coallesced),
    enumerable: true,
    configurable: true
  }
}

},{"./reflect":94,"dup":18}],94:[function(require,module,exports){
'use strict'

module.exports = makeReflectTypes

//Construct type info for reflection.
//
// This iterates over the flattened list of uniform type values and smashes them into a JSON object.
//
// The leaves of the resulting object are either indices or type strings representing primitive glslify types
function makeReflectTypes(uniforms, useIndex) {
  var obj = {}
  for(var i=0; i<uniforms.length; ++i) {
    var n = uniforms[i].name
    var parts = n.split(".")
    var o = obj
    for(var j=0; j<parts.length; ++j) {
      var x = parts[j].split("[")
      if(x.length > 1) {
        if(!(x[0] in o)) {
          o[x[0]] = []
        }
        o = o[x[0]]
        for(var k=1; k<x.length; ++k) {
          var y = parseInt(x[k])
          if(k<x.length-1 || j<parts.length-1) {
            if(!(y in o)) {
              if(k < x.length-1) {
                o[y] = []
              } else {
                o[y] = {}
              }
            }
            o = o[y]
          } else {
            if(useIndex) {
              o[y] = i
            } else {
              o[y] = uniforms[i].type
            }
          }
        }
      } else if(j < parts.length-1) {
        if(!(x[0] in o)) {
          o[x[0]] = {}
        }
        o = o[x[0]]
      } else {
        if(useIndex) {
          o[x[0]] = i
        } else {
          o[x[0]] = uniforms[i].type
        }
      }
    }
  }
  return obj
}
},{}],95:[function(require,module,exports){
'use strict'

var createUniformWrapper = require('./lib/create-uniforms')
var createAttributeWrapper = require('./lib/create-attributes')
var makeReflect = require('./lib/reflect')

//Shader object
function Shader(gl, prog, vertShader, fragShader) {
  this.gl = gl
  this.handle = prog
  this.attributes = null
  this.uniforms = null
  this.types = null
  this.vertexShader = vertShader
  this.fragmentShader = fragShader
}

//Binds the shader
Shader.prototype.bind = function() {
  this.gl.useProgram(this.handle)
}

//Destroy shader, release resources
Shader.prototype.dispose = function() {
  var gl = this.gl
  gl.deleteShader(this.vertexShader)
  gl.deleteShader(this.fragmentShader)
  gl.deleteProgram(this.handle)
}

Shader.prototype.updateExports = function(uniforms, attributes) {
  var locations = new Array(uniforms.length)
  var program = this.handle
  var gl = this.gl

  var doLink = relinkUniforms.bind(void 0,
    gl,
    program,
    locations,
    uniforms
  )
  doLink()

  this.types = {
    uniforms: makeReflect(uniforms),
    attributes: makeReflect(attributes)
  }

  this.attributes = createAttributeWrapper(
    gl,
    program,
    attributes,
    doLink
  )

  Object.defineProperty(this, 'uniforms', createUniformWrapper(
    gl,
    program,
    uniforms,
    locations
  ))
}

//Relinks all uniforms
function relinkUniforms(gl, program, locations, uniforms) {
  for(var i=0; i<uniforms.length; ++i) {
    locations[i] = gl.getUniformLocation(program, uniforms[i].name)
  }
}

//Compiles and links a shader program with the given attribute and vertex list
function createShader(
    gl
  , vertSource
  , fragSource
  , uniforms
  , attributes) {
  
  //Compile vertex shader
  var vertShader = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(vertShader, vertSource)
  gl.compileShader(vertShader)
  if(!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    var errLog = gl.getShaderInfoLog(vertShader)
    console.error('gl-shader: Error compling vertex shader:', errLog)
    throw new Error('gl-shader: Error compiling vertex shader:' + errLog)
  }
  
  //Compile fragment shader
  var fragShader = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(fragShader, fragSource)
  gl.compileShader(fragShader)
  if(!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    var errLog = gl.getShaderInfoLog(fragShader)
    console.error('gl-shader: Error compiling fragment shader:', errLog)
    throw new Error('gl-shader: Error compiling fragment shader:' + errLog)
  }
  
  //Link program
  var program = gl.createProgram()
  gl.attachShader(program, fragShader)
  gl.attachShader(program, vertShader)

  //Optional default attriubte locations
  attributes.forEach(function(a) {
    if (typeof a.location === 'number') 
      gl.bindAttribLocation(program, a.location, a.name)
  })

  gl.linkProgram(program)
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var errLog = gl.getProgramInfoLog(program)
    console.error('gl-shader: Error linking shader program:', errLog)
    throw new Error('gl-shader: Error linking shader program:' + errLog)
  }
  
  //Return final linked shader object
  var shader = new Shader(
    gl,
    program,
    vertShader,
    fragShader
  )
  shader.updateExports(uniforms, attributes)

  return shader
}

module.exports = createShader

},{"./lib/create-attributes":92,"./lib/create-uniforms":93,"./lib/reflect":94}],96:[function(require,module,exports){
'use strict'

var createUniformWrapper   = require('./lib/create-uniforms')
var createAttributeWrapper = require('./lib/create-attributes')
var makeReflect            = require('./lib/reflect')
var shaderCache            = require('./lib/shader-cache')
var runtime                = require('./lib/runtime-reflect')
var GLError                = require("./lib/GLError")

//Shader object
function Shader(gl) {
  this.gl         = gl

  //Default initialize these to null
  this._vref      =
  this._fref      =
  this._relink    =
  this.vertShader =
  this.fragShader =
  this.program    =
  this.attributes =
  this.uniforms   =
  this.types      = null
}

var proto = Shader.prototype

proto.bind = function() {
  if(!this.program) {
    this._relink()
  }
  this.gl.useProgram(this.program)
}

proto.dispose = function() {
  if(this._fref) {
    this._fref.dispose()
  }
  if(this._vref) {
    this._vref.dispose()
  }
  this.attributes =
  this.types      =
  this.vertShader =
  this.fragShader =
  this.program    =
  this._relink    =
  this._fref      =
  this._vref      = null
}

function compareAttributes(a, b) {
  if(a.name < b.name) {
    return -1
  }
  return 1
}

//Update export hook for glslify-live
proto.update = function(
    vertSource
  , fragSource
  , uniforms
  , attributes) {

  //If only one object passed, assume glslify style output
  if(!fragSource || arguments.length === 1) {
    var obj = vertSource
    vertSource = obj.vertex
    fragSource = obj.fragment
    uniforms   = obj.uniforms
    attributes = obj.attributes
  }

  var wrapper = this
  var gl      = wrapper.gl

  //Compile vertex and fragment shaders
  var pvref = wrapper._vref
  wrapper._vref = shaderCache.shader(gl, gl.VERTEX_SHADER, vertSource)
  if(pvref) {
    pvref.dispose()
  }
  wrapper.vertShader = wrapper._vref.shader
  var pfref = this._fref
  wrapper._fref = shaderCache.shader(gl, gl.FRAGMENT_SHADER, fragSource)
  if(pfref) {
    pfref.dispose()
  }
  wrapper.fragShader = wrapper._fref.shader

  //If uniforms/attributes is not specified, use RT reflection
  if(!uniforms || !attributes) {

    //Create initial test program
    var testProgram = gl.createProgram()
    gl.attachShader(testProgram, wrapper.fragShader)
    gl.attachShader(testProgram, wrapper.vertShader)
    gl.linkProgram(testProgram)
    if(!gl.getProgramParameter(testProgram, gl.LINK_STATUS)) {
      var errLog = gl.getProgramInfoLog(testProgram)
      throw new GLError(errLog, 'Error linking program:' + errLog)
    }

    //Load data from runtime
    uniforms   = uniforms   || runtime.uniforms(gl, testProgram)
    attributes = attributes || runtime.attributes(gl, testProgram)

    //Release test program
    gl.deleteProgram(testProgram)
  }

  //Sort attributes lexicographically
  // overrides undefined WebGL behavior for attribute locations
  attributes = attributes.slice()
  attributes.sort(compareAttributes)

  //Convert attribute types, read out locations
  var attributeUnpacked  = []
  var attributeNames     = []
  var attributeLocations = []
  for(var i=0; i<attributes.length; ++i) {
    var attr = attributes[i]
    if(attr.type.indexOf('mat') >= 0) {
      var size = attr.type.charAt(attr.type.length-1)|0
      var locVector = new Array(size)
      for(var j=0; j<size; ++j) {
        locVector[j] = attributeLocations.length
        attributeNames.push(attr.name + '[' + j + ']')
        if(typeof attr.location === 'number') {
          attributeLocations.push(attr.location + j)
        } else if(Array.isArray(attr.location) &&
                  attr.location.length === size &&
                  typeof attr.location[j] === 'number') {
          attributeLocations.push(attr.location[j]|0)
        } else {
          attributeLocations.push(-1)
        }
      }
      attributeUnpacked.push({
        name: attr.name,
        type: attr.type,
        locations: locVector
      })
    } else {
      attributeUnpacked.push({
        name: attr.name,
        type: attr.type,
        locations: [ attributeLocations.length ]
      })
      attributeNames.push(attr.name)
      if(typeof attr.location === 'number') {
        attributeLocations.push(attr.location|0)
      } else {
        attributeLocations.push(-1)
      }
    }
  }

  //For all unspecified attributes, assign them lexicographically min attribute
  var curLocation = 0
  for(var i=0; i<attributeLocations.length; ++i) {
    if(attributeLocations[i] < 0) {
      while(attributeLocations.indexOf(curLocation) >= 0) {
        curLocation += 1
      }
      attributeLocations[i] = curLocation
    }
  }

  //Rebuild program and recompute all uniform locations
  var uniformLocations = new Array(uniforms.length)
  function relink() {
    wrapper.program = shaderCache.program(
        gl
      , wrapper._vref
      , wrapper._fref
      , attributeNames
      , attributeLocations)

    for(var i=0; i<uniforms.length; ++i) {
      uniformLocations[i] = gl.getUniformLocation(
          wrapper.program
        , uniforms[i].name)
    }
  }

  //Perform initial linking, reuse program used for reflection
  relink()

  //Save relinking procedure, defer until runtime
  wrapper._relink = relink

  //Generate type info
  wrapper.types = {
    uniforms:   makeReflect(uniforms),
    attributes: makeReflect(attributes)
  }

  //Generate attribute wrappers
  wrapper.attributes = createAttributeWrapper(
      gl
    , wrapper
    , attributeUnpacked
    , attributeLocations)

  //Generate uniform wrappers
  Object.defineProperty(wrapper, 'uniforms', createUniformWrapper(
      gl
    , wrapper
    , uniforms
    , uniformLocations))
}

//Compiles and links a shader program with the given attribute and vertex list
function createShader(
    gl
  , vertSource
  , fragSource
  , uniforms
  , attributes) {

  var shader = new Shader(gl)

  shader.update(
      vertSource
    , fragSource
    , uniforms
    , attributes)

  return shader
}

module.exports = createShader

},{"./lib/GLError":97,"./lib/create-attributes":98,"./lib/create-uniforms":99,"./lib/reflect":100,"./lib/runtime-reflect":101,"./lib/shader-cache":102}],97:[function(require,module,exports){
function GLError (rawError, shortMessage, longMessage) {
    this.shortMessage = shortMessage || ''
    this.longMessage = longMessage || ''
    this.rawError = rawError || ''
    this.message =
      'gl-shader: ' + (shortMessage || rawError || '') +
      (longMessage ? '\n'+longMessage : '')
    this.stack = (new Error()).stack
}
GLError.prototype = new Error
GLError.prototype.name = 'GLError'
GLError.prototype.constructor = GLError
module.exports = GLError

},{}],98:[function(require,module,exports){
'use strict'

module.exports = createAttributeWrapper

var GLError = require("./GLError")

function ShaderAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , constFunc) {
  this._gl        = gl
  this._wrapper   = wrapper
  this._index     = index
  this._locations = locations
  this._dimension = dimension
  this._constFunc = constFunc
}

var proto = ShaderAttribute.prototype

proto.pointer = function setAttribPointer(
    type
  , normalized
  , stride
  , offset) {

  var self      = this
  var gl        = self._gl
  var location  = self._locations[self._index]

  gl.vertexAttribPointer(
      location
    , self._dimension
    , type || gl.FLOAT
    , !!normalized
    , stride || 0
    , offset || 0)
  gl.enableVertexAttribArray(location)
}

proto.set = function(x0, x1, x2, x3) {
  return this._constFunc(this._locations[this._index], x0, x1, x2, x3)
}

Object.defineProperty(proto, 'location', {
  get: function() {
    return this._locations[this._index]
  }
  , set: function(v) {
    if(v !== this._locations[this._index]) {
      this._locations[this._index] = v|0
      this._wrapper.program = null
    }
    return v|0
  }
})

//Adds a vector attribute to obj
function addVectorAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , obj
  , name) {

  //Construct constant function
  var constFuncArgs = [ 'gl', 'v' ]
  var varNames = []
  for(var i=0; i<dimension; ++i) {
    constFuncArgs.push('x'+i)
    varNames.push('x'+i)
  }
  constFuncArgs.push(
    'if(x0.length===void 0){return gl.vertexAttrib' +
    dimension + 'f(v,' +
    varNames.join() +
    ')}else{return gl.vertexAttrib' +
    dimension +
    'fv(v,x0)}')
  var constFunc = Function.apply(null, constFuncArgs)

  //Create attribute wrapper
  var attr = new ShaderAttribute(
      gl
    , wrapper
    , index
    , locations
    , dimension
    , constFunc)

  //Create accessor
  Object.defineProperty(obj, name, {
    set: function(x) {
      gl.disableVertexAttribArray(locations[index])
      constFunc(gl, locations[index], x)
      return x
    }
    , get: function() {
      return attr
    }
    , enumerable: true
  })
}

function addMatrixAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , obj
  , name) {

  var parts = new Array(dimension)
  var attrs = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    addVectorAttribute(
        gl
      , wrapper
      , index[i]
      , locations
      , dimension
      , parts
      , i)
    attrs[i] = parts[i]
  }

  Object.defineProperty(parts, 'location', {
    set: function(v) {
      if(Array.isArray(v)) {
        for(var i=0; i<dimension; ++i) {
          attrs[i].location = v[i]
        }
      } else {
        for(var i=0; i<dimension; ++i) {
          attrs[i].location = v + i
        }
      }
      return v
    }
    , get: function() {
      var result = new Array(dimension)
      for(var i=0; i<dimension; ++i) {
        result[i] = locations[index[i]]
      }
      return result
    }
    , enumerable: true
  })

  parts.pointer = function(type, normalized, stride, offset) {
    type       = type || gl.FLOAT
    normalized = !!normalized
    stride     = stride || (dimension * dimension)
    offset     = offset || 0
    for(var i=0; i<dimension; ++i) {
      var location = locations[index[i]]
      gl.vertexAttribPointer(
            location
          , dimension
          , type
          , normalized
          , stride
          , offset + i * dimension)
      gl.enableVertexAttribArray(location)
    }
  }

  var scratch = new Array(dimension)
  var vertexAttrib = gl['vertexAttrib' + dimension + 'fv']

  Object.defineProperty(obj, name, {
    set: function(x) {
      for(var i=0; i<dimension; ++i) {
        var loc = locations[index[i]]
        gl.disableVertexAttribArray(loc)
        if(Array.isArray(x[0])) {
          vertexAttrib.call(gl, loc, x[i])
        } else {
          for(var j=0; j<dimension; ++j) {
            scratch[j] = x[dimension*i + j]
          }
          vertexAttrib.call(gl, loc, scratch)
        }
      }
      return x
    }
    , get: function() {
      return parts
    }
    , enumerable: true
  })
}

//Create shims for attributes
function createAttributeWrapper(
    gl
  , wrapper
  , attributes
  , locations) {

  var obj = {}
  for(var i=0, n=attributes.length; i<n; ++i) {

    var a = attributes[i]
    var name = a.name
    var type = a.type
    var locs = a.locations

    switch(type) {
      case 'bool':
      case 'int':
      case 'float':
        addVectorAttribute(
            gl
          , wrapper
          , locs[0]
          , locations
          , 1
          , obj
          , name)
      break

      default:
        if(type.indexOf('vec') >= 0) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type for attribute ' + name + ': ' + type)
          }
          addVectorAttribute(
              gl
            , wrapper
            , locs[0]
            , locations
            , d
            , obj
            , name)
        } else if(type.indexOf('mat') >= 0) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type for attribute ' + name + ': ' + type)
          }
          addMatrixAttribute(
              gl
            , wrapper
            , locs
            , locations
            , d
            , obj
            , name)
        } else {
          throw new GLError('', 'Unknown data type for attribute ' + name + ': ' + type)
        }
      break
    }
  }
  return obj
}

},{"./GLError":97}],99:[function(require,module,exports){
'use strict'

var coallesceUniforms = require('./reflect')
var GLError = require("./GLError")

module.exports = createUniformWrapper

//Binds a function and returns a value
function identity(x) {
  var c = new Function('y', 'return function(){return y}')
  return c(x)
}

function makeVector(length, fill) {
  var result = new Array(length)
  for(var i=0; i<length; ++i) {
    result[i] = fill
  }
  return result
}

//Create shims for uniforms
function createUniformWrapper(gl, wrapper, uniforms, locations) {

  function makeGetter(index) {
    var proc = new Function(
        'gl'
      , 'wrapper'
      , 'locations'
      , 'return function(){return gl.getUniform(wrapper.program,locations[' + index + '])}')
    return proc(gl, wrapper, locations)
  }

  function makePropSetter(path, index, type) {
    switch(type) {
      case 'bool':
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 'gl.uniform1i(locations[' + index + '],obj' + path + ')'
      case 'float':
        return 'gl.uniform1f(locations[' + index + '],obj' + path + ')'
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type')
          }
          switch(type.charAt(0)) {
            case 'b':
            case 'i':
              return 'gl.uniform' + d + 'iv(locations[' + index + '],obj' + path + ')'
            case 'v':
              return 'gl.uniform' + d + 'fv(locations[' + index + '],obj' + path + ')'
            default:
              throw new GLError('', 'Unrecognized data type for vector ' + name + ': ' + type)
          }
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return 'gl.uniformMatrix' + d + 'fv(locations[' + index + '],false,obj' + path + ')'
        } else {
          throw new GLError('', 'Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function enumerateIndices(prefix, type) {
    if(typeof type !== 'object') {
      return [ [prefix, type] ]
    }
    var indices = []
    for(var id in type) {
      var prop = type[id]
      var tprefix = prefix
      if(parseInt(id) + '' === id) {
        tprefix += '[' + id + ']'
      } else {
        tprefix += '.' + id
      }
      if(typeof prop === 'object') {
        indices.push.apply(indices, enumerateIndices(tprefix, prop))
      } else {
        indices.push([tprefix, prop])
      }
    }
    return indices
  }

  function makeSetter(type) {
    var code = [ 'return function updateProperty(obj){' ]
    var indices = enumerateIndices('', type)
    for(var i=0; i<indices.length; ++i) {
      var item = indices[i]
      var path = item[0]
      var idx  = item[1]
      if(locations[idx]) {
        code.push(makePropSetter(path, idx, uniforms[idx].type))
      }
    }
    code.push('return obj}')
    var proc = new Function('gl', 'locations', code.join('\n'))
    return proc(gl, locations)
  }

  function defaultValue(type) {
    switch(type) {
      case 'bool':
        return false
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 0
      case 'float':
        return 0.0
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type')
          }
          if(type.charAt(0) === 'b') {
            return makeVector(d, false)
          }
          return makeVector(d, 0)
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return makeVector(d*d, 0)
        } else {
          throw new GLError('', 'Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function storeProperty(obj, prop, type) {
    if(typeof type === 'object') {
      var child = processObject(type)
      Object.defineProperty(obj, prop, {
        get: identity(child),
        set: makeSetter(type),
        enumerable: true,
        configurable: false
      })
    } else {
      if(locations[type]) {
        Object.defineProperty(obj, prop, {
          get: makeGetter(type),
          set: makeSetter(type),
          enumerable: true,
          configurable: false
        })
      } else {
        obj[prop] = defaultValue(uniforms[type].type)
      }
    }
  }

  function processObject(obj) {
    var result
    if(Array.isArray(obj)) {
      result = new Array(obj.length)
      for(var i=0; i<obj.length; ++i) {
        storeProperty(result, i, obj[i])
      }
    } else {
      result = {}
      for(var id in obj) {
        storeProperty(result, id, obj[id])
      }
    }
    return result
  }

  //Return data
  var coallesced = coallesceUniforms(uniforms, true)
  return {
    get: identity(processObject(coallesced)),
    set: makeSetter(coallesced),
    enumerable: true,
    configurable: true
  }
}

},{"./GLError":97,"./reflect":100}],100:[function(require,module,exports){
arguments[4][94][0].apply(exports,arguments)
},{"dup":94}],101:[function(require,module,exports){
'use strict'

exports.uniforms    = runtimeUniforms
exports.attributes  = runtimeAttributes

var GL_TO_GLSL_TYPES = {
  'FLOAT':       'float',
  'FLOAT_VEC2':  'vec2',
  'FLOAT_VEC3':  'vec3',
  'FLOAT_VEC4':  'vec4',
  'INT':         'int',
  'INT_VEC2':    'ivec2',
  'INT_VEC3':    'ivec3',
  'INT_VEC4':    'ivec4',
  'BOOL':        'bool',
  'BOOL_VEC2':   'bvec2',
  'BOOL_VEC3':   'bvec3',
  'BOOL_VEC4':   'bvec4',
  'FLOAT_MAT2':  'mat2',
  'FLOAT_MAT3':  'mat3',
  'FLOAT_MAT4':  'mat4',
  'SAMPLER_2D':  'sampler2D',
  'SAMPLER_CUBE':'samplerCube'
}

var GL_TABLE = null

function getType(gl, type) {
  if(!GL_TABLE) {
    var typeNames = Object.keys(GL_TO_GLSL_TYPES)
    GL_TABLE = {}
    for(var i=0; i<typeNames.length; ++i) {
      var tn = typeNames[i]
      GL_TABLE[gl[tn]] = GL_TO_GLSL_TYPES[tn]
    }
  }
  return GL_TABLE[type]
}

function runtimeUniforms(gl, program) {
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  var result = []
  for(var i=0; i<numUniforms; ++i) {
    var info = gl.getActiveUniform(program, i)
    if(info) {
      var type = getType(gl, info.type)
      if(info.size > 1) {
        for(var j=0; j<info.size; ++j) {
          result.push({
            name: info.name.replace('[0]', '[' + j + ']'),
            type: type
          })
        }
      } else {
        result.push({
          name: info.name,
          type: type
        })
      }
    }
  }
  return result
}

function runtimeAttributes(gl, program) {
  var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  var result = []
  for(var i=0; i<numAttributes; ++i) {
    var info = gl.getActiveAttrib(program, i)
    if(info) {
      result.push({
        name: info.name,
        type: getType(gl, info.type)
      })
    }
  }
  return result
}

},{}],102:[function(require,module,exports){
'use strict'

exports.shader   = getShaderReference
exports.program  = createProgram

var GLError = require("./GLError")
var formatCompilerError = require('gl-format-compiler-error');

var weakMap = typeof WeakMap === 'undefined' ? require('weakmap-shim') : WeakMap
var CACHE = new weakMap()

var SHADER_COUNTER = 0

function ShaderReference(id, src, type, shader, programs, count, cache) {
  this.id       = id
  this.src      = src
  this.type     = type
  this.shader   = shader
  this.count    = count
  this.programs = []
  this.cache    = cache
}

ShaderReference.prototype.dispose = function() {
  if(--this.count === 0) {
    var cache    = this.cache
    var gl       = cache.gl

    //Remove program references
    var programs = this.programs
    for(var i=0, n=programs.length; i<n; ++i) {
      var p = cache.programs[programs[i]]
      if(p) {
        delete cache.programs[i]
        gl.deleteProgram(p)
      }
    }

    //Remove shader reference
    gl.deleteShader(this.shader)
    delete cache.shaders[(this.type === gl.FRAGMENT_SHADER)|0][this.src]
  }
}

function ContextCache(gl) {
  this.gl       = gl
  this.shaders  = [{}, {}]
  this.programs = {}
}

var proto = ContextCache.prototype

function compileShader(gl, type, src) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var errLog = gl.getShaderInfoLog(shader)
    try {
        var fmt = formatCompilerError(errLog, src, type);
    } catch (e){
        console.warn('Failed to format compiler error: ' + e);
        throw new GLError(errLog, 'Error compiling shader:\n' + errLog)
    }
    throw new GLError(errLog, fmt.short, fmt.long)
  }
  return shader
}

proto.getShaderReference = function(type, src) {
  var gl      = this.gl
  var shaders = this.shaders[(type === gl.FRAGMENT_SHADER)|0]
  var shader  = shaders[src]
  if(!shader || !gl.isShader(shader.shader)) {
    var shaderObj = compileShader(gl, type, src)
    shader = shaders[src] = new ShaderReference(
      SHADER_COUNTER++,
      src,
      type,
      shaderObj,
      [],
      1,
      this)
  } else {
    shader.count += 1
  }
  return shader
}

function linkProgram(gl, vshader, fshader, attribs, locations) {
  var program = gl.createProgram()
  gl.attachShader(program, vshader)
  gl.attachShader(program, fshader)
  for(var i=0; i<attribs.length; ++i) {
    gl.bindAttribLocation(program, locations[i], attribs[i])
  }
  gl.linkProgram(program)
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var errLog = gl.getProgramInfoLog(program)
    throw new GLError(errLog, 'Error linking program: ' + errLog)
  }
  return program
}

proto.getProgram = function(vref, fref, attribs, locations) {
  var token = [vref.id, fref.id, attribs.join(':'), locations.join(':')].join('@')
  var prog  = this.programs[token]
  if(!prog || !this.gl.isProgram(prog)) {
    this.programs[token] = prog = linkProgram(
      this.gl,
      vref.shader,
      fref.shader,
      attribs,
      locations)
    vref.programs.push(token)
    fref.programs.push(token)
  }
  return prog
}

function getCache(gl) {
  var ctxCache = CACHE.get(gl)
  if(!ctxCache) {
    ctxCache = new ContextCache(gl)
    CACHE.set(gl, ctxCache)
  }
  return ctxCache
}

function getShaderReference(gl, type, src) {
  return getCache(gl).getShaderReference(type, src)
}

function createProgram(gl, vref, fref, attribs, locations) {
  return getCache(gl).getProgram(vref, fref, attribs, locations)
}

},{"./GLError":97,"gl-format-compiler-error":36,"weakmap-shim":206}],103:[function(require,module,exports){
var createVAO = require('gl-aliased-vao') //TODO: improve this with gl-vao
var createBuffer = require('gl-buffer')

module.exports.floatsPerVertex = 5

function createIndices(capacity) {
    var numIndices = capacity * 6
    var indices = new Uint16Array(numIndices)

    for (var i = 0, j = 0; i < numIndices; i += 6, j += 4) {
        indices[i + 0] = j + 0
        indices[i + 1] = j + 1
        indices[i + 2] = j + 2
        indices[i + 3] = j + 0
        indices[i + 4] = j + 2
        indices[i + 5] = j + 3
    }
    return indices
}

module.exports.mixins = {

    create: function create(opt) {
        opt = opt||{}
        this.clear()

        //dispose before building...
        if (this.vao)
            this.dispose()

        var capacity = typeof opt.capacity === 'number' ? opt.capacity : 100

        // 65535 is max index, so 65535 / 6 = 10922.
        if (capacity > 10922)
            throw new Error("Can't have more than 10922 quads per batch: " + capacity)

        this._capacity = capacity

        //the total number of floats in our batch
        var numVerts = capacity * 4 * module.exports.floatsPerVertex

        this.vertices = new Float32Array(numVerts)
        this.indices = createIndices(capacity)

        var gl = this.gl
        var usage = opt.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
        this.vertexBuffer = createBuffer(gl, this.vertices, gl.ARRAY_BUFFER, usage)
        this.indexBuffer = createBuffer(gl, this.indices, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW)

        var stride = 5 * 4
        this.vao = createVAO(gl, [{ //position XY
            name: 'position',
            buffer: this.vertexBuffer,
            size: 2,
            stride: stride
        }, { //texcoord UV
            name: 'texcoord0',
            buffer: this.vertexBuffer,
            size: 2,
            offset: 2 * 4,
            stride: stride
        }, { //color (packed) C
            name: 'color',
            buffer: this.vertexBuffer,
            size: 4,
            stride: stride,
            offset: 4 * 4,
            type: gl.UNSIGNED_BYTE,
            normalized: true
        }], this.indexBuffer)
        return this
    },

    ensureCapacity: function(capacity) {
        if (this.capacity < capacity)
            this.create({ capacity: capacity })
        return this
    }
}
},{"gl-aliased-vao":29,"gl-buffer":33}],104:[function(require,module,exports){
var colorToFloat = require('./pack-rgba-float')
var mixes = require('mixes')
var premult = require('premultiplied-rgba')
var WhiteTex = require('gl-white-texture')

var vertNumFloats = require('./common').floatsPerVertex

//Temporary arrays to avoid GC thrashing
var position = [0, 0],
    shape = [0, 0],
    texcoord = [0, 0, 0, 0],
    color = [0, 0, 0, 0]

var tmp4 = [0, 0, 0, 0],
    rotOrigin = [0, 0],
    tmp2 = [0, 0]

function SpriteBatch(gl, opt) {
    if (!(this instanceof SpriteBatch))
        return new SpriteBatch(gl, opt)
    if (!gl)
        throw new Error("must specify gl context")
    this.gl = gl
    opt = opt || {}
    
    this._bound = false
    this.idx = 0

    //no transform means identity
    this.transform = null

    //white texture is akin to "no texture" (without switching shaders)
    this._defaultTexture = opt.defaultTexture || WhiteTex(gl)
    this._ownsDefault = !opt.defaultTexture
    this._lastTexture = this._defaultTexture
    this._texture = this._defaultTexture
    this.texture = null

    this.mode = typeof opt.mode === 'number' ? opt.mode : gl.TRIANGLES
    this.premultiplied = opt.premultiplied || false

    this._dirty = true
    this.create(opt)

    //set default attributes
    this.defaults()
}

//mix in create() and ensureCapacity() functions
mixes(SpriteBatch, require('./common').mixins)

mixes(SpriteBatch, {

    capacity: {
        get: function() {
            return this._capacity
        }
    },

    texture: {
        get: function() {
            return this._texture
        },

        set: function(tex) {
            this._texture = tex || this._defaultTexture
        }
    },

    dispose: function() {
        if (this.vertexBuffer)
            this.vertexBuffer.dispose()
        if (this.indexBuffer)
            this.indexBuffer.dispose()
        if (this.vao)
            this.vao.dispose()
        if (this._ownsDefault)
            this._defaultTexture.dispose()
    },

    clear: function() {
        this.idx = 0
        return this
    },

    bind: function(shader) {
        shader.bind()
        this.vao.bind(shader)
        this._bound = true
    },

    unbind: function() {
        this.vao.unbind()
        this._bound = false
    },

    defaults: function() {
        this.position = copy2(position, 0, 0)
        this.texcoord = copy4(texcoord, 0, 0, 1, 1)
        this.color = copy4(color, 1, 1, 1, 1)
        this.shape = copy2(shape, 0, 0)
        return this
    },

    push: function(sprite) {
        //if we are defining attributes on the fly
        if (sprite) {
            this.texture = sprite.texture
            this.position = sprite.position || copy2(position, 0, 0)
            this.texcoord = sprite.texcoord || copy4(texcoord, 0, 0, 1, 1)
            this.color = sprite.color || copy4(color, 1, 1, 1, 1)
            this.shape = sprite.shape || copy2(shape, 0, 0)
        }

        if (this.texture !== this._lastTexture) {
            //new texture, flush previous data
            if (this._bound)
                this.flush()
            this._lastTexture = this.texture
        } else if (this.idx === this.vertices.length) {
            //if we AREN'T bound, we need to stop pushing vertex data!
            if (!this._bound)
                return this

            //if we ARE bound, we can flush the batch and continue drawing
            this.flush()
        }

        this._dirty = true

        //get RGBA components and pack into a single float
        var colorRGBA = this.premultiplied ? premult(this.color, tmp4) : this.color
        var c = colorToFloat(colorRGBA)

        var u1 = this.texcoord[0],
            v1 = this.texcoord[1],
            u2 = this.texcoord[2],
            v2 = this.texcoord[3]

        var x = this.position[0],
            y = this.position[1],
            width = this.shape[0],
            height = this.shape[1]

        this._vert(x, y, u1, v1, c)
        this._vert(x+width, y, u2, v1, c)
        this._vert(x+width, y+height, u2, v2, c)
        this._vert(x, y+height, u1, v2, c)
        
        return this
    },

    _vert: function(x1, y1, u1, v1, c) {
        var idx = this.idx,
            verts = this.vertices,
            transform = this.transform

        if (transform) {
            var x = x1, y = y1
            x1 = transform[0] * x + transform[4] * y + transform[12]
            y1 = transform[1] * x + transform[5] * y + transform[13]
        }

        //xy
        verts[idx++] = x1
        verts[idx++] = y1
        //uv
        verts[idx++] = u1
        verts[idx++] = v1
        //color
        verts[idx++] = c
        this.idx = idx
    },

    flush: function() {
        this.draw()
        return this.clear()
    },

    draw: function() {
        //If we've reached a new texture or capacity
        //while not bound, then we will just clear the batch
        //to zero and draw nothing
        if (this.idx === 0 || !this._bound)
            return this

        var gl = this.gl
        
        if (this._dirty) {
            var view = this.vertices.subarray(0, this.idx)
            this.vertexBuffer.update(view, 0)
            this._dirty = false
        }

        if (this._lastTexture)
            this._lastTexture.bind()
        this._lastTexture = this.texture

        var sprites = (this.idx / (vertNumFloats * 4))
        if (sprites > 0)
            this.vao.draw(this.mode, sprites * 6, 0)
        return this
    },
})

module.exports = SpriteBatch

//TODO: will use modular gl-matrix for these...
function copy2(out, x, y) {
    out[0] = x
    out[1] = y
    return out
}

function copy4(out, x, y, z, w) {
    out[0] = x
    out[1] = y
    out[2] = z
    out[3] = w
    return out
}

function copyVec2(out, vec) {
    return copy2(out, vec[0], vec[1])
}

function transformMat4(out, a, m) {
    var x = a[0], 
        y = a[1]
    out[0] = m[0] * x + m[4] * y + m[12]
    out[1] = m[1] * x + m[5] * y + m[13]
    return out
}
},{"./common":103,"./pack-rgba-float":105,"gl-white-texture":157,"mixes":172,"premultiplied-rgba":195}],105:[function(require,module,exports){
var packColor = require('number-util').colorToFloat

module.exports = function colorToFloat(rgba) {
    return packColor(
        ~~(rgba[0] * 255),
        ~~(rgba[1] * 255),
        ~~(rgba[2] * 255),
        ~~(rgba[3] * 255)
    )
}
},{"number-util":177}],106:[function(require,module,exports){
var Base = require('fontpath-simple-renderer')
var inherits = require('inherits')
var bmfont2fontpath = require('fontpath-bmfont')
var texcoord = require('texcoord')
var xtend = require('xtend')
var createTexture = require('gl-texture2d')

var Batch = require('gl-sprite-batch')

var tmpPos = [0, 0],
    tmpShape = [0, 0],
    tmp1 = [0, 0],
    tmp2 = [0, 0]
var DEFAULT_TEXCOORD = [0, 0, 1, 1]
var maxInitialCapacity = 500

function texcoordGlyph(glyph, atlas, out) {
    tmp1[0] = glyph.x
    tmp1[1] = glyph.y
    tmp2[0] = glyph.width
    tmp2[1] = glyph.height
    return texcoord(tmp1, tmp2, atlas, out)
}

function TextRenderer(gl, opt) {
    if (!(this instanceof TextRenderer))
        return new TextRenderer(gl, opt)
    opt = opt||{}

    if (!opt.font) 
        throw new Error('must specify bmfont at creation time')

    //if the font has Image/ndarray array
    if (!opt.textures && Array.isArray(opt.font.images)) {
        opt.textures = opt.font.images.map(function(img) {
            return createTexture(gl, img)
        })
    }

    opt.font = bmfont2fontpath(opt.font)

    Base.call(this, opt)

    this.textures = opt.textures || []
    this.gl = gl
    if (!gl)
        throw new Error("must specify gl context")
    
    //assume text will be used dynamically 
    if (typeof opt.dynamic !== 'boolean')
        opt.dynamic = true

    var batch = opt.batch
    if (!batch)
        this.defaultBatch = Batch(gl, opt)
    this.batch = batch || this.defaultBatch

    if (typeof opt.wrapWidth !== 'number')
        this.layout()
}

inherits(TextRenderer, Base)

TextRenderer.prototype.dispose = function(textures) {
    if (this.defaultBatch)
        this.defaultBatch.dispose()
    if (textures) {
        this.textures.forEach(function(t) {
            if (typeof t.dispose === 'function')
                t.dispose()
        })
    }
    return this
}

TextRenderer.prototype.uncache = function() {
    this._cache = false
    this.batch.clear()
    return this
}

TextRenderer.prototype.cache = function(x, y, start, end) {
    // if (this.underline || this.font.pages.length > 1)
    //     throw new Error('currently cached text does not support underlines or multiple texture pages')
    
    this._cache = true
    this.batch.ensureCapacity(this.text.length)
    this.batch.clear()
    this._build(x, y, start, end)
    return this
}

TextRenderer.prototype.draw = function(shader, x, y, start, end) {
    var batch = this.batch
    batch.bind(shader)

    //if we're drawing dynamically
    if (!this._cache) {
        batch.clear()
        this._build(x, y, start, end)
    }
    
    batch.draw()
    batch.unbind()
    return this
}

TextRenderer.prototype._build = function(x, y, start, end) {
    var result = this.render(x, y, start, end)

    var batch = this.batch
    var i = 0
    
    //underlines currently not supported with cache()
    if (!this._cache) {
        batch.texcoord = DEFAULT_TEXCOORD
        batch.texture = null

        for (i = 0; i < result.underlines.length; i++) {
            var underline = result.underlines[i]
            batch.position = underline.position
            batch.shape = underline.size
            batch.push()
        }
    }

    //now draw our glyphs into the batch...
    for (i = 0; i < result.glyphs.length; i++) {
        var g = result.glyphs[i]
        this._drawGlyph(batch, g)
    }
}

TextRenderer.prototype._drawGlyph = function(batch, data) {
    //... we could sort these by texture page to reduce draws
    var glyph = data.glyph
    var img = this.textures[glyph.page]
    tmpPos[0] = data.position[0]+glyph.hbx
    tmpPos[1] = data.position[1]+glyph.hby - this.font.descender
    tmpShape[0] = glyph.width * data.scale[0]
    tmpShape[1] = glyph.height * data.scale[1]
    
    batch.texture = img
    texcoordGlyph(glyph, img && img.shape, batch.texcoord)
    batch.position = tmpPos
    batch.shape = tmpShape
    batch.push()
}

module.exports = TextRenderer
},{"fontpath-bmfont":19,"fontpath-simple-renderer":22,"gl-sprite-batch":104,"gl-texture2d":107,"inherits":166,"texcoord":199,"xtend":209}],107:[function(require,module,exports){
'use strict'

var ndarray = require('ndarray')
var ops     = require('ndarray-ops')
var pool    = require('typedarray-pool')

module.exports = createTexture2D

var linearTypes = null
var filterTypes = null
var wrapTypes   = null

function lazyInitLinearTypes(gl) {
  linearTypes = [
    gl.LINEAR,
    gl.NEAREST_MIPMAP_LINEAR,
    gl.LINEAR_MIPMAP_NEAREST,
    gl.LINEAR_MIPMAP_NEAREST
  ]
  filterTypes = [
    gl.NEAREST,
    gl.LINEAR,
    gl.NEAREST_MIPMAP_NEAREST,
    gl.NEAREST_MIPMAP_LINEAR,
    gl.LINEAR_MIPMAP_NEAREST,
    gl.LINEAR_MIPMAP_LINEAR
  ]
  wrapTypes = [
    gl.REPEAT,
    gl.CLAMP_TO_EDGE,
    gl.MIRRORED_REPEAT
  ]
}

var convertFloatToUint8 = function(out, inp) {
  ops.muls(out, inp, 255.0)
}

function reshapeTexture(tex, w, h) {
  var gl = tex.gl
  var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(w < 0 || w > maxSize || h < 0 || h > maxSize) {
    throw new Error('gl-texture2d: Invalid texture size')
  }
  tex._shape = [w, h]
  tex.bind()
  gl.texImage2D(gl.TEXTURE_2D, 0, tex.format, w, h, 0, tex.format, tex.type, null)
  tex._mipLevels = [0]
  return tex
}

function Texture2D(gl, handle, width, height, format, type) {
  this.gl = gl
  this.handle = handle
  this.format = format
  this.type = type
  this._shape = [width, height]
  this._mipLevels = [0]
  this._magFilter = gl.NEAREST
  this._minFilter = gl.NEAREST
  this._wrapS = gl.CLAMP_TO_EDGE
  this._wrapT = gl.CLAMP_TO_EDGE
  this._anisoSamples = 1

  var parent = this
  var wrapVector = [this._wrapS, this._wrapT]
  Object.defineProperties(wrapVector, [
    {
      get: function() {
        return parent._wrapS
      },
      set: function(v) {
        return parent.wrapS = v
      }
    },
    {
      get: function() {
        return parent._wrapT
      },
      set: function(v) {
        return parent.wrapT = v
      }
    }
  ])
  this._wrapVector = wrapVector

  var shapeVector = [this._shape[0], this._shape[1]]
  Object.defineProperties(shapeVector, [
    {
      get: function() {
        return parent._shape[0]
      },
      set: function(v) {
        return parent.width = v
      }
    },
    {
      get: function() {
        return parent._shape[1]
      },
      set: function(v) {
        return parent.height = v
      }
    }
  ])
  this._shapeVector = shapeVector
}

var proto = Texture2D.prototype

Object.defineProperties(proto, {
  minFilter: {
    get: function() {
      return this._minFilter
    },
    set: function(v) {
      this.bind()
      var gl = this.gl
      if(this.type === gl.FLOAT && linearTypes.indexOf(v) >= 0) {
        if(!gl.getExtension('OES_texture_float_linear')) {
          v = gl.NEAREST
        }
      }
      if(filterTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown filter mode ' + v)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, v)
      return this._minFilter = v
    }
  },
  magFilter: {
    get: function() {
      return this._magFilter
    },
    set: function(v) {
      this.bind()
      var gl = this.gl
      if(this.type === gl.FLOAT && linearTypes.indexOf(v) >= 0) {
        if(!gl.getExtension('OES_texture_float_linear')) {
          v = gl.NEAREST
        }
      }
      if(filterTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown filter mode ' + v)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, v)
      return this._magFilter = v
    }
  },
  mipSamples: {
    get: function() {
      return this._anisoSamples
    },
    set: function(i) {
      var psamples = this._anisoSamples
      this._anisoSamples = Math.max(i, 1)|0
      if(psamples !== this._anisoSamples) {
        var ext = gl.getExtension('EXT_texture_filter_anisotropic')
        if(ext) {
          this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this._anisoSamples)
        }
      }
      return this._anisoSamples
    }
  },
  wrapS: {
    get: function() {
      return this._wrapS
    },
    set: function(v) {
      this.bind()
      if(wrapTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown wrap mode ' + v)
      }
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, v)
      return this._wrapS = v
    }
  },
  wrapT: {
    get: function() {
      return this._wrapT
    },
    set: function(v) {
      this.bind()
      if(wrapTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown wrap mode ' + v)
      }
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, v)
      return this._wrapT = v
    }
  },
  wrap: {
    get: function() {
      return this._wrapVector
    },
    set: function(v) {
      if(!Array.isArray(v)) {
        v = [v,v]
      }
      if(v.length !== 2) {
        throw new Error('gl-texture2d: Must specify wrap mode for rows and columns')
      }
      for(var i=0; i<2; ++i) {
        if(wrapTypes.indexOf(v[i]) < 0) {
          throw new Error('gl-texture2d: Unknown wrap mode ' + v)
        }
      }
      this._wrapS = v[0]
      this._wrapT = v[1]

      var gl = this.gl
      this.bind()
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this._wrapS)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this._wrapT)

      return v
    }
  },
  shape: {
    get: function() {
      return this._shapeVector
    },
    set: function(x) {
      if(!Array.isArray(x)) {
        x = [x|0,x|0]
      } else {
        if(x.length !== 2) {
          throw new Error('gl-texture2d: Invalid texture shape')
        }
      }
      reshapeTexture(this, x[0]|0, x[1]|0)
      return [x[0]|0, x[1]|0]
    }
  },
  width: {
    get: function() {
      return this._shape[0]
    },
    set: function(w) {
      w = w|0
      reshapeTexture(this, w, this._shape[1])
      return w
    }
  },
  height: {
    get: function() {
      return this._shape[1]
    },
    set: function(h) {
      h = h|0
      reshapeTexture(this, this._shape[0], h)
      return h
    }
  }
})

proto.bind = function(unit) {
  var gl = this.gl
  if(unit !== undefined) {
    gl.activeTexture(gl.TEXTURE0 + (unit|0))
  }
  gl.bindTexture(gl.TEXTURE_2D, this.handle)
  if(unit !== undefined) {
    return (unit|0)
  }
  return gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0
}

proto.dispose = function() {
  this.gl.deleteTexture(this.handle)
}

proto.generateMipmap = function() {
  this.bind()
  this.gl.generateMipmap(this.gl.TEXTURE_2D)

  //Update mip levels
  var l = Math.min(this._shape[0], this._shape[1])
  for(var i=0; l>0; ++i, l>>>=1) {
    if(this._mipLevels.indexOf(i) < 0) {
      this._mipLevels.push(i)
    }
  }
}

proto.setPixels = function(data, x_off, y_off, mip_level) {
  var gl = this.gl
  this.bind()
  if(Array.isArray(x_off)) {
    mip_level = y_off
    y_off = x_off[1]|0
    x_off = x_off[0]|0
  } else {
    x_off = x_off || 0
    y_off = y_off || 0
  }
  mip_level = mip_level || 0
  if(data instanceof HTMLCanvasElement ||
     data instanceof ImageData ||
     data instanceof HTMLImageElement ||
     data instanceof HTMLVideoElement) {
    var needsMip = this._mipLevels.indexOf(mip_level) < 0
    if(needsMip) {
      gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, this.type, data)
      this._mipLevels.push(mip_level)
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, this.format, this.type, data)
    }
  } else if(data.shape && data.stride && data.data) {
    if(data.shape.length < 2 ||
       x_off + data.shape[1] > this._shape[1]>>>mip_level ||
       y_off + data.shape[0] > this._shape[0]>>>mip_level ||
       x_off < 0 ||
       y_off < 0) {
      throw new Error('gl-texture2d: Texture dimensions are out of bounds')
    }
    texSubImageArray(gl, x_off, y_off, mip_level, this.format, this.type, this._mipLevels, data)
  } else {
    throw new Error('gl-texture2d: Unsupported data type')
  }
}


function isPacked(shape, stride) {
  if(shape.length === 3) {
    return  (stride[2] === 1) &&
            (stride[1] === shape[0]*shape[2]) &&
            (stride[0] === shape[2])
  }
  return  (stride[0] === 1) &&
          (stride[1] === shape[0])
}

function texSubImageArray(gl, x_off, y_off, mip_level, cformat, ctype, mipLevels, array) {
  var dtype = array.dtype
  var shape = array.shape.slice()
  if(shape.length < 2 || shape.length > 3) {
    throw new Error('gl-texture2d: Invalid ndarray, must be 2d or 3d')
  }
  var type = 0, format = 0
  var packed = isPacked(shape, array.stride.slice())
  if(dtype === 'float32') {
    type = gl.FLOAT
  } else if(dtype === 'float64') {
    type = gl.FLOAT
    packed = false
    dtype = 'float32'
  } else if(dtype === 'uint8') {
    type = gl.UNSIGNED_BYTE
  } else {
    type = gl.UNSIGNED_BYTE
    packed = false
    dtype = 'uint8'
  }
  var channels = 1
  if(shape.length === 2) {
    format = gl.LUMINANCE
    shape = [shape[0], shape[1], 1]
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset)
  } else if(shape.length === 3) {
    if(shape[2] === 1) {
      format = gl.ALPHA
    } else if(shape[2] === 2) {
      format = gl.LUMINANCE_ALPHA
    } else if(shape[2] === 3) {
      format = gl.RGB
    } else if(shape[2] === 4) {
      format = gl.RGBA
    } else {
      throw new Error('gl-texture2d: Invalid shape for pixel coords')
    }
    channels = shape[2]
  } else {
    throw new Error('gl-texture2d: Invalid shape for texture')
  }
  //For 1-channel textures allow conversion between formats
  if((format  === gl.LUMINANCE || format  === gl.ALPHA) &&
     (cformat === gl.LUMINANCE || cformat === gl.ALPHA)) {
    format = cformat
  }
  if(format !== cformat) {
    throw new Error('gl-texture2d: Incompatible texture format for setPixels')
  }
  var size = array.size
  var needsMip = mipLevels.indexOf(mip_level) < 0
  if(needsMip) {
    mipLevels.push(mip_level)
  }
  if(type === ctype && packed) {
    //Array data types are compatible, can directly copy into texture
    if(array.offset === 0 && array.data.length === size) {
      if(needsMip) {
        gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, array.data)
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, array.data)
      }
    } else {
      if(needsMip) {
        gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, array.data.subarray(array.offset, array.offset+size))
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, array.data.subarray(array.offset, array.offset+size))
      }
    }
  } else {
    //Need to do type conversion to pack data into buffer
    var pack_buffer
    if(ctype === gl.FLOAT) {
      pack_buffer = pool.mallocFloat32(size)
    } else {
      pack_buffer = pool.mallocUint8(size)
    }
    var pack_view = ndarray(pack_buffer, shape, [shape[2], shape[2]*shape[0], 1])
    if(type === gl.FLOAT && ctype === gl.UNSIGNED_BYTE) {
      convertFloatToUint8(pack_view, array)
    } else {
      ops.assign(pack_view, array)
    }
    if(needsMip) {
      gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, pack_buffer.subarray(0, size))
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, pack_buffer.subarray(0, size))
    }
    if(ctype === gl.FLOAT) {
      pool.freeFloat32(pack_buffer)
    } else {
      pool.freeUint8(pack_buffer)
    }
  }
}

function initTexture(gl) {
  var tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

function createTextureShape(gl, width, height, format, type) {
  var maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(width < 0 || width > maxTextureSize || height < 0 || height  > maxTextureSize) {
    throw new Error('gl-texture2d: Invalid texture shape')
  }
  if(type === gl.FLOAT && !gl.getExtension('OES_texture_float')) {
    throw new Error('gl-texture2d: Floating point textures not supported on this platform')
  }
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, null)
  return new Texture2D(gl, tex, width, height, format, type)
}

function createTextureDOM(gl, element, format, type) {
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, format, type, element)
  return new Texture2D(gl, tex, element.width|0, element.height|0, format, type)
}

//Creates a texture from an ndarray
function createTextureArray(gl, array) {
  var dtype = array.dtype
  var shape = array.shape.slice()
  var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(shape[0] < 0 || shape[0] > maxSize || shape[1] < 0 || shape[1] > maxSize) {
    throw new Error('gl-texture2d: Invalid texture size')
  }
  var packed = isPacked(shape, array.stride.slice())
  var type = 0
  if(dtype === 'float32') {
    type = gl.FLOAT
  } else if(dtype === 'float64') {
    type = gl.FLOAT
    packed = false
    dtype = 'float32'
  } else if(dtype === 'uint8') {
    type = gl.UNSIGNED_BYTE
  } else {
    type = gl.UNSIGNED_BYTE
    packed = false
    dtype = 'uint8'
  }
  var format = 0
  if(shape.length === 2) {
    format = gl.LUMINANCE
    shape = [shape[0], shape[1], 1]
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset)
  } else if(shape.length === 3) {
    if(shape[2] === 1) {
      format = gl.ALPHA
    } else if(shape[2] === 2) {
      format = gl.LUMINANCE_ALPHA
    } else if(shape[2] === 3) {
      format = gl.RGB
    } else if(shape[2] === 4) {
      format = gl.RGBA
    } else {
      throw new Error('gl-texture2d: Invalid shape for pixel coords')
    }
  } else {
    throw new Error('gl-texture2d: Invalid shape for texture')
  }
  if(type === gl.FLOAT && !gl.getExtension('OES_texture_float')) {
    type = gl.UNSIGNED_BYTE
    packed = false
  }
  var buffer, buf_store
  var size = array.size
  if(!packed) {
    var stride = [shape[2], shape[2]*shape[0], 1]
    buf_store = pool.malloc(size, dtype)
    var buf_array = ndarray(buf_store, shape, stride, 0)
    if((dtype === 'float32' || dtype === 'float64') && type === gl.UNSIGNED_BYTE) {
      convertFloatToUint8(buf_array, array)
    } else {
      ops.assign(buf_array, array)
    }
    buffer = buf_store.subarray(0, size)
  } else if (array.offset === 0 && array.data.length === size) {
    buffer = array.data
  } else {
    buffer = array.data.subarray(array.offset, array.offset + size)
  }
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, shape[0], shape[1], 0, format, type, buffer)
  if(!packed) {
    pool.free(buf_store)
  }
  return new Texture2D(gl, tex, shape[0], shape[1], format, type)
}

function createTexture2D(gl) {
  if(arguments.length <= 1) {
    throw new Error('gl-texture2d: Missing arguments for texture2d constructor')
  }
  if(!linearTypes) {
    lazyInitLinearTypes(gl)
  }
  if(typeof arguments[1] === 'number') {
    return createTextureShape(gl, arguments[1], arguments[2], arguments[3]||gl.RGBA, arguments[4]||gl.UNSIGNED_BYTE)
  }
  if(Array.isArray(arguments[1])) {
    return createTextureShape(gl, arguments[1][0]|0, arguments[1][1]|0, arguments[2]||gl.RGBA, arguments[3]||gl.UNSIGNED_BYTE)
  }
  if(typeof arguments[1] === 'object') {
    var obj = arguments[1]
    if(obj instanceof HTMLCanvasElement ||
       obj instanceof HTMLImageElement ||
       obj instanceof HTMLVideoElement ||
       obj instanceof ImageData) {
      return createTextureDOM(gl, obj, arguments[2]||gl.RGBA, arguments[3]||gl.UNSIGNED_BYTE)
    } else if(obj.shape && obj.data && obj.stride) {
      return createTextureArray(gl, obj)
    }
  }
  throw new Error('gl-texture2d: Invalid arguments for texture2d constructor')
}

},{"ndarray":174,"ndarray-ops":173,"typedarray-pool":200}],108:[function(require,module,exports){
module.exports = glToType
function glToType (flag) {
  switch (flag) {
    case 5126: return 'float32'   // gl.FLOAT
    case 5125: return 'uint32'    // gl.UNSIGNED_INT
    case 5124: return 'int32'     // gl.INT
    case 5123: return 'uint16'    // gl.UNSIGNED_SHORT
    case 32819: return 'uint16'   // gl.UNSIGNED_SHORT_4_4_4_4
    case 32820: return 'uint16'   // gl.UNSIGNED_SHORT_5_5_5_1
    case 33635: return 'uint16'   // gl.UNSIGNED_SHORT_5_6_5
    case 5122: return 'int16'     // gl.SHORT
    case 5121: return 'uint8'     // gl.UNSIGNED_BYTE
    case 5120: return 'int8'      // gl.BYTE
    default: return null
  }
}

},{}],109:[function(require,module,exports){
"use strict"

function doBind(gl, elements, attributes) {
  if(elements) {
    elements.bind()
  } else {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
  var nattribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)|0
  if(attributes) {
    if(attributes.length > nattribs) {
      throw new Error("gl-vao: Too many vertex attributes")
    }
    for(var i=0; i<attributes.length; ++i) {
      var attrib = attributes[i]
      if(attrib.buffer) {
        var buffer = attrib.buffer
        var size = attrib.size || 4
        var type = attrib.type || gl.FLOAT
        var normalized = !!attrib.normalized
        var stride = attrib.stride || 0
        var offset = attrib.offset || 0
        buffer.bind()
        gl.enableVertexAttribArray(i)
        gl.vertexAttribPointer(i, size, type, normalized, stride, offset)
      } else {
        if(typeof attrib === "number") {
          gl.vertexAttrib1f(i, attrib)
        } else if(attrib.length === 1) {
          gl.vertexAttrib1f(i, attrib[0])
        } else if(attrib.length === 2) {
          gl.vertexAttrib2f(i, attrib[0], attrib[1])
        } else if(attrib.length === 3) {
          gl.vertexAttrib3f(i, attrib[0], attrib[1], attrib[2])
        } else if(attrib.length === 4) {
          gl.vertexAttrib4f(i, attrib[0], attrib[1], attrib[2], attrib[3])
        } else {
          throw new Error("gl-vao: Invalid vertex attribute")
        }
        gl.disableVertexAttribArray(i)
      }
    }
    for(; i<nattribs; ++i) {
      gl.disableVertexAttribArray(i)
    }
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    for(var i=0; i<nattribs; ++i) {
      gl.disableVertexAttribArray(i)
    }
  }
}

module.exports = doBind
},{}],110:[function(require,module,exports){
"use strict"

var bindAttribs = require("./do-bind.js")

function VAOEmulated(gl) {
  this.gl = gl
  this._elements = null
  this._attributes = null
  this._elementsType = gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.bind = function() {
  bindAttribs(this.gl, this._elements, this._attributes)
}

VAOEmulated.prototype.update = function(attributes, elements, elementsType) {
  this._elements = elements
  this._attributes = attributes
  this._elementsType = elementsType || this.gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.dispose = function() { }
VAOEmulated.prototype.unbind = function() { }

VAOEmulated.prototype.draw = function(mode, count, offset) {
  offset = offset || 0
  var gl = this.gl
  if(this._elements) {
    gl.drawElements(mode, count, this._elementsType, offset)
  } else {
    gl.drawArrays(mode, offset, count)
  }
}

function createVAOEmulated(gl) {
  return new VAOEmulated(gl)
}

module.exports = createVAOEmulated
},{"./do-bind.js":109}],111:[function(require,module,exports){
"use strict"

var bindAttribs = require("./do-bind.js")

function VertexAttribute(location, dimension, a, b, c, d) {
  this.location = location
  this.dimension = dimension
  this.a = a
  this.b = b
  this.c = c
  this.d = d
}

VertexAttribute.prototype.bind = function(gl) {
  switch(this.dimension) {
    case 1:
      gl.vertexAttrib1f(this.location, this.a)
    break
    case 2:
      gl.vertexAttrib2f(this.location, this.a, this.b)
    break
    case 3:
      gl.vertexAttrib3f(this.location, this.a, this.b, this.c)
    break
    case 4:
      gl.vertexAttrib4f(this.location, this.a, this.b, this.c, this.d)
    break
  }
}

function VAONative(gl, ext, handle) {
  this.gl = gl
  this._ext = ext
  this.handle = handle
  this._attribs = []
  this._useElements = false
  this._elementsType = gl.UNSIGNED_SHORT
}

VAONative.prototype.bind = function() {
  this._ext.bindVertexArrayOES(this.handle)
  for(var i=0; i<this._attribs.length; ++i) {
    this._attribs[i].bind(this.gl)
  }
}

VAONative.prototype.unbind = function() {
  this._ext.bindVertexArrayOES(null)
}

VAONative.prototype.dispose = function() {
  this._ext.deleteVertexArrayOES(this.handle)
}

VAONative.prototype.update = function(attributes, elements, elementsType) {
  this.bind()
  bindAttribs(this.gl, elements, attributes)
  this.unbind()
  this._attribs.length = 0
  if(attributes)
  for(var i=0; i<attributes.length; ++i) {
    var a = attributes[i]
    if(typeof a === "number") {
      this._attribs.push(new VertexAttribute(i, 1, a))
    } else if(Array.isArray(a)) {
      this._attribs.push(new VertexAttribute(i, a.length, a[0], a[1], a[2], a[3]))
    }
  }
  this._useElements = !!elements
  this._elementsType = elementsType || this.gl.UNSIGNED_SHORT
}

VAONative.prototype.draw = function(mode, count, offset) {
  offset = offset || 0
  var gl = this.gl
  if(this._useElements) {
    gl.drawElements(mode, count, this._elementsType, offset)
  } else {
    gl.drawArrays(mode, offset, count)
  }
}

function createVAONative(gl, ext) {
  return new VAONative(gl, ext, ext.createVertexArrayOES())
}

module.exports = createVAONative
},{"./do-bind.js":109}],112:[function(require,module,exports){
"use strict"

var createVAONative = require("./lib/vao-native.js")
var createVAOEmulated = require("./lib/vao-emulated.js")

function createVAO(gl, attributes, elements, elementsType) {
  var ext = gl.getExtension('OES_vertex_array_object')
  var vao
  if(ext) {
    vao = createVAONative(gl, ext)
  } else {
    vao = createVAOEmulated(gl)
  }
  vao.update(attributes, elements, elementsType)
  return vao
}

module.exports = createVAO

},{"./lib/vao-emulated.js":110,"./lib/vao-native.js":111}],113:[function(require,module,exports){
module.exports = add;

/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function add(out, a, b) {
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    out[2] = a[2] + b[2]
    return out
}
},{}],114:[function(require,module,exports){
module.exports = angle

var fromValues = require('./fromValues')
var normalize = require('./normalize')
var dot = require('./dot')

/**
 * Get the angle between two 3D vectors
 * @param {vec3} a The first operand
 * @param {vec3} b The second operand
 * @returns {Number} The angle in radians
 */
function angle(a, b) {
    var tempA = fromValues(a[0], a[1], a[2])
    var tempB = fromValues(b[0], b[1], b[2])
 
    normalize(tempA, tempA)
    normalize(tempB, tempB)
 
    var cosine = dot(tempA, tempB)

    if(cosine > 1.0){
        return 0
    } else {
        return Math.acos(cosine)
    }     
}

},{"./dot":121,"./fromValues":123,"./normalize":132}],115:[function(require,module,exports){
module.exports = clone;

/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {vec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */
function clone(a) {
    var out = new Float32Array(3)
    out[0] = a[0]
    out[1] = a[1]
    out[2] = a[2]
    return out
}
},{}],116:[function(require,module,exports){
module.exports = copy;

/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the source vector
 * @returns {vec3} out
 */
function copy(out, a) {
    out[0] = a[0]
    out[1] = a[1]
    out[2] = a[2]
    return out
}
},{}],117:[function(require,module,exports){
module.exports = create;

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */
function create() {
    var out = new Float32Array(3)
    out[0] = 0
    out[1] = 0
    out[2] = 0
    return out
}
},{}],118:[function(require,module,exports){
module.exports = cross;

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function cross(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2]

    out[0] = ay * bz - az * by
    out[1] = az * bx - ax * bz
    out[2] = ax * by - ay * bx
    return out
}
},{}],119:[function(require,module,exports){
module.exports = distance;

/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} distance between a and b
 */
function distance(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2]
    return Math.sqrt(x*x + y*y + z*z)
}
},{}],120:[function(require,module,exports){
module.exports = divide;

/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function divide(out, a, b) {
    out[0] = a[0] / b[0]
    out[1] = a[1] / b[1]
    out[2] = a[2] / b[2]
    return out
}
},{}],121:[function(require,module,exports){
module.exports = dot;

/**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
},{}],122:[function(require,module,exports){
module.exports = forEach;

var vec = require('./create')()

/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
function forEach(a, stride, offset, count, fn, arg) {
        var i, l
        if(!stride) {
            stride = 3
        }

        if(!offset) {
            offset = 0
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length)
        } else {
            l = a.length
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i] 
            vec[1] = a[i+1] 
            vec[2] = a[i+2]
            fn(vec, vec, arg)
            a[i] = vec[0] 
            a[i+1] = vec[1] 
            a[i+2] = vec[2]
        }
        
        return a
}
},{"./create":117}],123:[function(require,module,exports){
module.exports = fromValues;

/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */
function fromValues(x, y, z) {
    var out = new Float32Array(3)
    out[0] = x
    out[1] = y
    out[2] = z
    return out
}
},{}],124:[function(require,module,exports){
module.exports = {
  create: require('./create')
  , clone: require('./clone')
  , angle: require('./angle')
  , fromValues: require('./fromValues')
  , copy: require('./copy')
  , set: require('./set')
  , add: require('./add')
  , subtract: require('./subtract')
  , multiply: require('./multiply')
  , divide: require('./divide')
  , min: require('./min')
  , max: require('./max')
  , scale: require('./scale')
  , scaleAndAdd: require('./scaleAndAdd')
  , distance: require('./distance')
  , squaredDistance: require('./squaredDistance')
  , length: require('./length')
  , squaredLength: require('./squaredLength')
  , negate: require('./negate')
  , inverse: require('./inverse')
  , normalize: require('./normalize')
  , dot: require('./dot')
  , cross: require('./cross')
  , lerp: require('./lerp')
  , random: require('./random')
  , transformMat4: require('./transformMat4')
  , transformMat3: require('./transformMat3')
  , transformQuat: require('./transformQuat')
  , rotateX: require('./rotateX')
  , rotateY: require('./rotateY')
  , rotateZ: require('./rotateZ')
  , forEach: require('./forEach')
}
},{"./add":113,"./angle":114,"./clone":115,"./copy":116,"./create":117,"./cross":118,"./distance":119,"./divide":120,"./dot":121,"./forEach":122,"./fromValues":123,"./inverse":125,"./length":126,"./lerp":127,"./max":128,"./min":129,"./multiply":130,"./negate":131,"./normalize":132,"./random":133,"./rotateX":134,"./rotateY":135,"./rotateZ":136,"./scale":137,"./scaleAndAdd":138,"./set":139,"./squaredDistance":140,"./squaredLength":141,"./subtract":142,"./transformMat3":143,"./transformMat4":144,"./transformQuat":145}],125:[function(require,module,exports){
module.exports = inverse;

/**
 * Returns the inverse of the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to invert
 * @returns {vec3} out
 */
function inverse(out, a) {
  out[0] = 1.0 / a[0]
  out[1] = 1.0 / a[1]
  out[2] = 1.0 / a[2]
  return out
}
},{}],126:[function(require,module,exports){
module.exports = length;

/**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */
function length(a) {
    var x = a[0],
        y = a[1],
        z = a[2]
    return Math.sqrt(x*x + y*y + z*z)
}
},{}],127:[function(require,module,exports){
module.exports = lerp;

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */
function lerp(out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2]
    out[0] = ax + t * (b[0] - ax)
    out[1] = ay + t * (b[1] - ay)
    out[2] = az + t * (b[2] - az)
    return out
}
},{}],128:[function(require,module,exports){
module.exports = max;

/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function max(out, a, b) {
    out[0] = Math.max(a[0], b[0])
    out[1] = Math.max(a[1], b[1])
    out[2] = Math.max(a[2], b[2])
    return out
}
},{}],129:[function(require,module,exports){
module.exports = min;

/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function min(out, a, b) {
    out[0] = Math.min(a[0], b[0])
    out[1] = Math.min(a[1], b[1])
    out[2] = Math.min(a[2], b[2])
    return out
}
},{}],130:[function(require,module,exports){
module.exports = multiply;

/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function multiply(out, a, b) {
    out[0] = a[0] * b[0]
    out[1] = a[1] * b[1]
    out[2] = a[2] * b[2]
    return out
}
},{}],131:[function(require,module,exports){
module.exports = negate;

/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to negate
 * @returns {vec3} out
 */
function negate(out, a) {
    out[0] = -a[0]
    out[1] = -a[1]
    out[2] = -a[2]
    return out
}
},{}],132:[function(require,module,exports){
module.exports = normalize;

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */
function normalize(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2]
    var len = x*x + y*y + z*z
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len)
        out[0] = a[0] * len
        out[1] = a[1] * len
        out[2] = a[2] * len
    }
    return out
}
},{}],133:[function(require,module,exports){
module.exports = random;

/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */
function random(out, scale) {
    scale = scale || 1.0

    var r = Math.random() * 2.0 * Math.PI
    var z = (Math.random() * 2.0) - 1.0
    var zScale = Math.sqrt(1.0-z*z) * scale

    out[0] = Math.cos(r) * zScale
    out[1] = Math.sin(r) * zScale
    out[2] = z * scale
    return out
}
},{}],134:[function(require,module,exports){
module.exports = rotateX;

/**
 * Rotate a 3D vector around the x-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */
function rotateX(out, a, b, c){
    var p = [], r=[]
    //Translate point to the origin
    p[0] = a[0] - b[0]
    p[1] = a[1] - b[1]
    p[2] = a[2] - b[2]

    //perform rotation
    r[0] = p[0]
    r[1] = p[1]*Math.cos(c) - p[2]*Math.sin(c)
    r[2] = p[1]*Math.sin(c) + p[2]*Math.cos(c)

    //translate to correct position
    out[0] = r[0] + b[0]
    out[1] = r[1] + b[1]
    out[2] = r[2] + b[2]

    return out
}
},{}],135:[function(require,module,exports){
module.exports = rotateY;

/**
 * Rotate a 3D vector around the y-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */
function rotateY(out, a, b, c){
    var p = [], r=[]
    //Translate point to the origin
    p[0] = a[0] - b[0]
    p[1] = a[1] - b[1]
    p[2] = a[2] - b[2]
  
    //perform rotation
    r[0] = p[2]*Math.sin(c) + p[0]*Math.cos(c)
    r[1] = p[1]
    r[2] = p[2]*Math.cos(c) - p[0]*Math.sin(c)
  
    //translate to correct position
    out[0] = r[0] + b[0]
    out[1] = r[1] + b[1]
    out[2] = r[2] + b[2]
  
    return out
}
},{}],136:[function(require,module,exports){
module.exports = rotateZ;

/**
 * Rotate a 3D vector around the z-axis
 * @param {vec3} out The receiving vec3
 * @param {vec3} a The vec3 point to rotate
 * @param {vec3} b The origin of the rotation
 * @param {Number} c The angle of rotation
 * @returns {vec3} out
 */
function rotateZ(out, a, b, c){
    var p = [], r=[]
    //Translate point to the origin
    p[0] = a[0] - b[0]
    p[1] = a[1] - b[1]
    p[2] = a[2] - b[2]
  
    //perform rotation
    r[0] = p[0]*Math.cos(c) - p[1]*Math.sin(c)
    r[1] = p[0]*Math.sin(c) + p[1]*Math.cos(c)
    r[2] = p[2]
  
    //translate to correct position
    out[0] = r[0] + b[0]
    out[1] = r[1] + b[1]
    out[2] = r[2] + b[2]
  
    return out
}
},{}],137:[function(require,module,exports){
module.exports = scale;

/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */
function scale(out, a, b) {
    out[0] = a[0] * b
    out[1] = a[1] * b
    out[2] = a[2] * b
    return out
}
},{}],138:[function(require,module,exports){
module.exports = scaleAndAdd;

/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */
function scaleAndAdd(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale)
    out[1] = a[1] + (b[1] * scale)
    out[2] = a[2] + (b[2] * scale)
    return out
}
},{}],139:[function(require,module,exports){
module.exports = set;

/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */
function set(out, x, y, z) {
    out[0] = x
    out[1] = y
    out[2] = z
    return out
}
},{}],140:[function(require,module,exports){
module.exports = squaredDistance;

/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} squared distance between a and b
 */
function squaredDistance(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2]
    return x*x + y*y + z*z
}
},{}],141:[function(require,module,exports){
module.exports = squaredLength;

/**
 * Calculates the squared length of a vec3
 *
 * @param {vec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
function squaredLength(a) {
    var x = a[0],
        y = a[1],
        z = a[2]
    return x*x + y*y + z*z
}
},{}],142:[function(require,module,exports){
module.exports = subtract;

/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function subtract(out, a, b) {
    out[0] = a[0] - b[0]
    out[1] = a[1] - b[1]
    out[2] = a[2] - b[2]
    return out
}
},{}],143:[function(require,module,exports){
module.exports = transformMat3;

/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */
function transformMat3(out, a, m) {
    var x = a[0], y = a[1], z = a[2]
    out[0] = x * m[0] + y * m[3] + z * m[6]
    out[1] = x * m[1] + y * m[4] + z * m[7]
    out[2] = x * m[2] + y * m[5] + z * m[8]
    return out
}
},{}],144:[function(require,module,exports){
module.exports = transformMat4;

/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec3} out
 */
function transformMat4(out, a, m) {
    var x = a[0], y = a[1], z = a[2],
        w = m[3] * x + m[7] * y + m[11] * z + m[15]
    w = w || 1.0
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    return out
}
},{}],145:[function(require,module,exports){
module.exports = transformQuat;

/**
 * Transforms the vec3 with a quat
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec3} out
 */
function transformQuat(out, a, q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations

    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx
    return out
}
},{}],146:[function(require,module,exports){
module.exports = add

/**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
function add (out, a, b) {
  out[0] = a[0] + b[0]
  out[1] = a[1] + b[1]
  out[2] = a[2] + b[2]
  out[3] = a[3] + b[3]
  return out
}

},{}],147:[function(require,module,exports){
module.exports = clone

/**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {vec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */
function clone (a) {
  var out = new Float32Array(4)
  out[0] = a[0]
  out[1] = a[1]
  out[2] = a[2]
  out[3] = a[3]
  return out
}

},{}],148:[function(require,module,exports){
module.exports = copy

/**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the source vector
 * @returns {vec4} out
 */
function copy (out, a) {
  out[0] = a[0]
  out[1] = a[1]
  out[2] = a[2]
  out[3] = a[3]
  return out
}

},{}],149:[function(require,module,exports){
module.exports = dot

/**
 * Calculates the dot product of two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} dot product of a and b
 */
function dot (a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
}

},{}],150:[function(require,module,exports){
module.exports = fromValues

/**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */
function fromValues (x, y, z, w) {
  var out = new Float32Array(4)
  out[0] = x
  out[1] = y
  out[2] = z
  out[3] = w
  return out
}

},{}],151:[function(require,module,exports){
module.exports = length

/**
 * Calculates the length of a vec4
 *
 * @param {vec4} a vector to calculate length of
 * @returns {Number} length of a
 */
function length (a) {
  var x = a[0],
    y = a[1],
    z = a[2],
    w = a[3]
  return Math.sqrt(x * x + y * y + z * z + w * w)
}

},{}],152:[function(require,module,exports){
module.exports = lerp

/**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec4} out
 */
function lerp (out, a, b, t) {
  var ax = a[0],
    ay = a[1],
    az = a[2],
    aw = a[3]
  out[0] = ax + t * (b[0] - ax)
  out[1] = ay + t * (b[1] - ay)
  out[2] = az + t * (b[2] - az)
  out[3] = aw + t * (b[3] - aw)
  return out
}

},{}],153:[function(require,module,exports){
module.exports = normalize

/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to normalize
 * @returns {vec4} out
 */
function normalize (out, a) {
  var x = a[0],
    y = a[1],
    z = a[2],
    w = a[3]
  var len = x * x + y * y + z * z + w * w
  if (len > 0) {
    len = 1 / Math.sqrt(len)
    out[0] = x * len
    out[1] = y * len
    out[2] = z * len
    out[3] = w * len
  }
  return out
}

},{}],154:[function(require,module,exports){
module.exports = scale

/**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */
function scale (out, a, b) {
  out[0] = a[0] * b
  out[1] = a[1] * b
  out[2] = a[2] * b
  out[3] = a[3] * b
  return out
}

},{}],155:[function(require,module,exports){
module.exports = set

/**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */
function set (out, x, y, z, w) {
  out[0] = x
  out[1] = y
  out[2] = z
  out[3] = w
  return out
}

},{}],156:[function(require,module,exports){
module.exports = squaredLength

/**
 * Calculates the squared length of a vec4
 *
 * @param {vec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
function squaredLength (a) {
  var x = a[0],
    y = a[1],
    z = a[2],
    w = a[3]
  return x * x + y * y + z * z + w * w
}

},{}],157:[function(require,module,exports){
var create = require('gl-texture2d')
var ndarray = require('ndarray')

module.exports = function(gl) {
    //fill an array with 0xff
    var data = Array.apply(null, new Array(16))
            .map(Number.prototype.valueOf, 0xFF);
    //create a 2D ndarray
    var array = ndarray(new Uint8Array(data), [2, 2, 4])
    return create(gl, array)
}
},{"gl-texture2d":107,"ndarray":174}],158:[function(require,module,exports){
var tokenize = require('glsl-tokenizer')
var atob     = require('atob-lite')

module.exports = getName

function getName(src) {
  var tokens = Array.isArray(src)
    ? src
    : tokenize(src)

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
    if (token.type !== 'preprocessor') continue
    var match = token.data.match(/\#define\s+SHADER_NAME(_B64)?\s+(.+)$/)
    if (!match) continue
    if (!match[2]) continue

    var b64  = match[1]
    var name = match[2]

    return (b64 ? atob(name) : name).trim()
  }
}

},{"atob-lite":7,"glsl-tokenizer":165}],159:[function(require,module,exports){
module.exports = tokenize

var literals100 = require('./lib/literals')
  , operators = require('./lib/operators')
  , builtins100 = require('./lib/builtins')
  , literals300es = require('./lib/literals-300es')
  , builtins300es = require('./lib/builtins-300es')

var NORMAL = 999          // <-- never emitted
  , TOKEN = 9999          // <-- never emitted
  , BLOCK_COMMENT = 0
  , LINE_COMMENT = 1
  , PREPROCESSOR = 2
  , OPERATOR = 3
  , INTEGER = 4
  , FLOAT = 5
  , IDENT = 6
  , BUILTIN = 7
  , KEYWORD = 8
  , WHITESPACE = 9
  , EOF = 10
  , HEX = 11

var map = [
    'block-comment'
  , 'line-comment'
  , 'preprocessor'
  , 'operator'
  , 'integer'
  , 'float'
  , 'ident'
  , 'builtin'
  , 'keyword'
  , 'whitespace'
  , 'eof'
  , 'integer'
]

function tokenize(opt) {
  var i = 0
    , total = 0
    , mode = NORMAL
    , c
    , last
    , content = []
    , tokens = []
    , token_idx = 0
    , token_offs = 0
    , line = 1
    , col = 0
    , start = 0
    , isnum = false
    , isoperator = false
    , input = ''
    , len

  opt = opt || {}
  var allBuiltins = builtins100
  var allLiterals = literals100
  if (opt.version === '300 es') {
    allBuiltins = builtins300es
    allLiterals = literals300es
  }

  return function(data) {
    tokens = []
    if (data !== null) return write(data)
    return end()
  }

  function token(data) {
    if (data.length) {
      tokens.push({
        type: map[mode]
      , data: data
      , position: start
      , line: line
      , column: col
      })
    }
  }

  function write(chunk) {
    i = 0
    input += chunk
    len = input.length

    var last

    while(c = input[i], i < len) {
      last = i

      switch(mode) {
        case BLOCK_COMMENT: i = block_comment(); break
        case LINE_COMMENT: i = line_comment(); break
        case PREPROCESSOR: i = preprocessor(); break
        case OPERATOR: i = operator(); break
        case INTEGER: i = integer(); break
        case HEX: i = hex(); break
        case FLOAT: i = decimal(); break
        case TOKEN: i = readtoken(); break
        case WHITESPACE: i = whitespace(); break
        case NORMAL: i = normal(); break
      }

      if(last !== i) {
        switch(input[last]) {
          case '\n': col = 0; ++line; break
          default: ++col; break
        }
      }
    }

    total += i
    input = input.slice(i)
    return tokens
  }

  function end(chunk) {
    if(content.length) {
      token(content.join(''))
    }

    mode = EOF
    token('(eof)')
    return tokens
  }

  function normal() {
    content = content.length ? [] : content

    if(last === '/' && c === '*') {
      start = total + i - 1
      mode = BLOCK_COMMENT
      last = c
      return i + 1
    }

    if(last === '/' && c === '/') {
      start = total + i - 1
      mode = LINE_COMMENT
      last = c
      return i + 1
    }

    if(c === '#') {
      mode = PREPROCESSOR
      start = total + i
      return i
    }

    if(/\s/.test(c)) {
      mode = WHITESPACE
      start = total + i
      return i
    }

    isnum = /\d/.test(c)
    isoperator = /[^\w_]/.test(c)

    start = total + i
    mode = isnum ? INTEGER : isoperator ? OPERATOR : TOKEN
    return i
  }

  function whitespace() {
    if(/[^\s]/g.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }

  function preprocessor() {
    if(c === '\n' && last !== '\\') {
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }

  function line_comment() {
    return preprocessor()
  }

  function block_comment() {
    if(c === '/' && last === '*') {
      content.push(c)
      token(content.join(''))
      mode = NORMAL
      return i + 1
    }

    content.push(c)
    last = c
    return i + 1
  }

  function operator() {
    if(last === '.' && /\d/.test(c)) {
      mode = FLOAT
      return i
    }

    if(last === '/' && c === '*') {
      mode = BLOCK_COMMENT
      return i
    }

    if(last === '/' && c === '/') {
      mode = LINE_COMMENT
      return i
    }

    if(c === '.' && content.length) {
      while(determine_operator(content));

      mode = FLOAT
      return i
    }

    if(c === ';' || c === ')' || c === '(') {
      if(content.length) while(determine_operator(content));
      token(c)
      mode = NORMAL
      return i + 1
    }

    var is_composite_operator = content.length === 2 && c !== '='
    if(/[\w_\d\s]/.test(c) || is_composite_operator) {
      while(determine_operator(content));
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function determine_operator(buf) {
    var j = 0
      , idx
      , res

    do {
      idx = operators.indexOf(buf.slice(0, buf.length + j).join(''))
      res = operators[idx]

      if(idx === -1) {
        if(j-- + buf.length > 0) continue
        res = buf.slice(0, 1).join('')
      }

      token(res)

      start += res.length
      content = content.slice(res.length)
      return content.length
    } while(1)
  }

  function hex() {
    if(/[^a-fA-F0-9]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function integer() {
    if(c === '.') {
      content.push(c)
      mode = FLOAT
      last = c
      return i + 1
    }

    if(/[eE]/.test(c)) {
      content.push(c)
      mode = FLOAT
      last = c
      return i + 1
    }

    if(c === 'x' && content.length === 1 && content[0] === '0') {
      mode = HEX
      content.push(c)
      last = c
      return i + 1
    }

    if(/[^\d]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function decimal() {
    if(c === 'f') {
      content.push(c)
      last = c
      i += 1
    }

    if(/[eE]/.test(c)) {
      content.push(c)
      last = c
      return i + 1
    }

    if (c === '-' && /[eE]/.test(last)) {
      content.push(c)
      last = c
      return i + 1
    }

    if(/[^\d]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function readtoken() {
    if(/[^\d\w_]/.test(c)) {
      var contentstr = content.join('')
      if(allLiterals.indexOf(contentstr) > -1) {
        mode = KEYWORD
      } else if(allBuiltins.indexOf(contentstr) > -1) {
        mode = BUILTIN
      } else {
        mode = IDENT
      }
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }
}

},{"./lib/builtins":161,"./lib/builtins-300es":160,"./lib/literals":163,"./lib/literals-300es":162,"./lib/operators":164}],160:[function(require,module,exports){
// 300es builtins/reserved words that were previously valid in v100
var v100 = require('./builtins')

// The texture2D|Cube functions have been removed
// And the gl_ features are updated
v100 = v100.slice().filter(function (b) {
  return !/^(gl\_|texture)/.test(b)
})

module.exports = v100.concat([
  // the updated gl_ constants
    'gl_VertexID'
  , 'gl_InstanceID'
  , 'gl_Position'
  , 'gl_PointSize'
  , 'gl_FragCoord'
  , 'gl_FrontFacing'
  , 'gl_FragDepth'
  , 'gl_PointCoord'
  , 'gl_MaxVertexAttribs'
  , 'gl_MaxVertexUniformVectors'
  , 'gl_MaxVertexOutputVectors'
  , 'gl_MaxFragmentInputVectors'
  , 'gl_MaxVertexTextureImageUnits'
  , 'gl_MaxCombinedTextureImageUnits'
  , 'gl_MaxTextureImageUnits'
  , 'gl_MaxFragmentUniformVectors'
  , 'gl_MaxDrawBuffers'
  , 'gl_MinProgramTexelOffset'
  , 'gl_MaxProgramTexelOffset'
  , 'gl_DepthRangeParameters'
  , 'gl_DepthRange'

  // other builtins
  , 'trunc'
  , 'round'
  , 'roundEven'
  , 'isnan'
  , 'isinf'
  , 'floatBitsToInt'
  , 'floatBitsToUint'
  , 'intBitsToFloat'
  , 'uintBitsToFloat'
  , 'packSnorm2x16'
  , 'unpackSnorm2x16'
  , 'packUnorm2x16'
  , 'unpackUnorm2x16'
  , 'packHalf2x16'
  , 'unpackHalf2x16'
  , 'outerProduct'
  , 'transpose'
  , 'determinant'
  , 'inverse'
  , 'texture'
  , 'textureSize'
  , 'textureProj'
  , 'textureLod'
  , 'textureOffset'
  , 'texelFetch'
  , 'texelFetchOffset'
  , 'textureProjOffset'
  , 'textureLodOffset'
  , 'textureProjLod'
  , 'textureProjLodOffset'
  , 'textureGrad'
  , 'textureGradOffset'
  , 'textureProjGrad'
  , 'textureProjGradOffset'
])

},{"./builtins":161}],161:[function(require,module,exports){
module.exports = [
  // Keep this list sorted
  'abs'
  , 'acos'
  , 'all'
  , 'any'
  , 'asin'
  , 'atan'
  , 'ceil'
  , 'clamp'
  , 'cos'
  , 'cross'
  , 'dFdx'
  , 'dFdy'
  , 'degrees'
  , 'distance'
  , 'dot'
  , 'equal'
  , 'exp'
  , 'exp2'
  , 'faceforward'
  , 'floor'
  , 'fract'
  , 'gl_BackColor'
  , 'gl_BackLightModelProduct'
  , 'gl_BackLightProduct'
  , 'gl_BackMaterial'
  , 'gl_BackSecondaryColor'
  , 'gl_ClipPlane'
  , 'gl_ClipVertex'
  , 'gl_Color'
  , 'gl_DepthRange'
  , 'gl_DepthRangeParameters'
  , 'gl_EyePlaneQ'
  , 'gl_EyePlaneR'
  , 'gl_EyePlaneS'
  , 'gl_EyePlaneT'
  , 'gl_Fog'
  , 'gl_FogCoord'
  , 'gl_FogFragCoord'
  , 'gl_FogParameters'
  , 'gl_FragColor'
  , 'gl_FragCoord'
  , 'gl_FragData'
  , 'gl_FragDepth'
  , 'gl_FragDepthEXT'
  , 'gl_FrontColor'
  , 'gl_FrontFacing'
  , 'gl_FrontLightModelProduct'
  , 'gl_FrontLightProduct'
  , 'gl_FrontMaterial'
  , 'gl_FrontSecondaryColor'
  , 'gl_LightModel'
  , 'gl_LightModelParameters'
  , 'gl_LightModelProducts'
  , 'gl_LightProducts'
  , 'gl_LightSource'
  , 'gl_LightSourceParameters'
  , 'gl_MaterialParameters'
  , 'gl_MaxClipPlanes'
  , 'gl_MaxCombinedTextureImageUnits'
  , 'gl_MaxDrawBuffers'
  , 'gl_MaxFragmentUniformComponents'
  , 'gl_MaxLights'
  , 'gl_MaxTextureCoords'
  , 'gl_MaxTextureImageUnits'
  , 'gl_MaxTextureUnits'
  , 'gl_MaxVaryingFloats'
  , 'gl_MaxVertexAttribs'
  , 'gl_MaxVertexTextureImageUnits'
  , 'gl_MaxVertexUniformComponents'
  , 'gl_ModelViewMatrix'
  , 'gl_ModelViewMatrixInverse'
  , 'gl_ModelViewMatrixInverseTranspose'
  , 'gl_ModelViewMatrixTranspose'
  , 'gl_ModelViewProjectionMatrix'
  , 'gl_ModelViewProjectionMatrixInverse'
  , 'gl_ModelViewProjectionMatrixInverseTranspose'
  , 'gl_ModelViewProjectionMatrixTranspose'
  , 'gl_MultiTexCoord0'
  , 'gl_MultiTexCoord1'
  , 'gl_MultiTexCoord2'
  , 'gl_MultiTexCoord3'
  , 'gl_MultiTexCoord4'
  , 'gl_MultiTexCoord5'
  , 'gl_MultiTexCoord6'
  , 'gl_MultiTexCoord7'
  , 'gl_Normal'
  , 'gl_NormalMatrix'
  , 'gl_NormalScale'
  , 'gl_ObjectPlaneQ'
  , 'gl_ObjectPlaneR'
  , 'gl_ObjectPlaneS'
  , 'gl_ObjectPlaneT'
  , 'gl_Point'
  , 'gl_PointCoord'
  , 'gl_PointParameters'
  , 'gl_PointSize'
  , 'gl_Position'
  , 'gl_ProjectionMatrix'
  , 'gl_ProjectionMatrixInverse'
  , 'gl_ProjectionMatrixInverseTranspose'
  , 'gl_ProjectionMatrixTranspose'
  , 'gl_SecondaryColor'
  , 'gl_TexCoord'
  , 'gl_TextureEnvColor'
  , 'gl_TextureMatrix'
  , 'gl_TextureMatrixInverse'
  , 'gl_TextureMatrixInverseTranspose'
  , 'gl_TextureMatrixTranspose'
  , 'gl_Vertex'
  , 'greaterThan'
  , 'greaterThanEqual'
  , 'inversesqrt'
  , 'length'
  , 'lessThan'
  , 'lessThanEqual'
  , 'log'
  , 'log2'
  , 'matrixCompMult'
  , 'max'
  , 'min'
  , 'mix'
  , 'mod'
  , 'normalize'
  , 'not'
  , 'notEqual'
  , 'pow'
  , 'radians'
  , 'reflect'
  , 'refract'
  , 'sign'
  , 'sin'
  , 'smoothstep'
  , 'sqrt'
  , 'step'
  , 'tan'
  , 'texture2D'
  , 'texture2DLod'
  , 'texture2DProj'
  , 'texture2DProjLod'
  , 'textureCube'
  , 'textureCubeLod'
  , 'texture2DLodEXT'
  , 'texture2DProjLodEXT'
  , 'textureCubeLodEXT'
  , 'texture2DGradEXT'
  , 'texture2DProjGradEXT'
  , 'textureCubeGradEXT'
]

},{}],162:[function(require,module,exports){
var v100 = require('./literals')

module.exports = v100.slice().concat([
   'layout'
  , 'centroid'
  , 'smooth'
  , 'case'
  , 'mat2x2'
  , 'mat2x3'
  , 'mat2x4'
  , 'mat3x2'
  , 'mat3x3'
  , 'mat3x4'
  , 'mat4x2'
  , 'mat4x3'
  , 'mat4x4'
  , 'uint'
  , 'uvec2'
  , 'uvec3'
  , 'uvec4'
  , 'samplerCubeShadow'
  , 'sampler2DArray'
  , 'sampler2DArrayShadow'
  , 'isampler2D'
  , 'isampler3D'
  , 'isamplerCube'
  , 'isampler2DArray'
  , 'usampler2D'
  , 'usampler3D'
  , 'usamplerCube'
  , 'usampler2DArray'
  , 'coherent'
  , 'restrict'
  , 'readonly'
  , 'writeonly'
  , 'resource'
  , 'atomic_uint'
  , 'noperspective'
  , 'patch'
  , 'sample'
  , 'subroutine'
  , 'common'
  , 'partition'
  , 'active'
  , 'filter'
  , 'image1D'
  , 'image2D'
  , 'image3D'
  , 'imageCube'
  , 'iimage1D'
  , 'iimage2D'
  , 'iimage3D'
  , 'iimageCube'
  , 'uimage1D'
  , 'uimage2D'
  , 'uimage3D'
  , 'uimageCube'
  , 'image1DArray'
  , 'image2DArray'
  , 'iimage1DArray'
  , 'iimage2DArray'
  , 'uimage1DArray'
  , 'uimage2DArray'
  , 'image1DShadow'
  , 'image2DShadow'
  , 'image1DArrayShadow'
  , 'image2DArrayShadow'
  , 'imageBuffer'
  , 'iimageBuffer'
  , 'uimageBuffer'
  , 'sampler1DArray'
  , 'sampler1DArrayShadow'
  , 'isampler1D'
  , 'isampler1DArray'
  , 'usampler1D'
  , 'usampler1DArray'
  , 'isampler2DRect'
  , 'usampler2DRect'
  , 'samplerBuffer'
  , 'isamplerBuffer'
  , 'usamplerBuffer'
  , 'sampler2DMS'
  , 'isampler2DMS'
  , 'usampler2DMS'
  , 'sampler2DMSArray'
  , 'isampler2DMSArray'
  , 'usampler2DMSArray'
])

},{"./literals":163}],163:[function(require,module,exports){
module.exports = [
  // current
    'precision'
  , 'highp'
  , 'mediump'
  , 'lowp'
  , 'attribute'
  , 'const'
  , 'uniform'
  , 'varying'
  , 'break'
  , 'continue'
  , 'do'
  , 'for'
  , 'while'
  , 'if'
  , 'else'
  , 'in'
  , 'out'
  , 'inout'
  , 'float'
  , 'int'
  , 'void'
  , 'bool'
  , 'true'
  , 'false'
  , 'discard'
  , 'return'
  , 'mat2'
  , 'mat3'
  , 'mat4'
  , 'vec2'
  , 'vec3'
  , 'vec4'
  , 'ivec2'
  , 'ivec3'
  , 'ivec4'
  , 'bvec2'
  , 'bvec3'
  , 'bvec4'
  , 'sampler1D'
  , 'sampler2D'
  , 'sampler3D'
  , 'samplerCube'
  , 'sampler1DShadow'
  , 'sampler2DShadow'
  , 'struct'

  // future
  , 'asm'
  , 'class'
  , 'union'
  , 'enum'
  , 'typedef'
  , 'template'
  , 'this'
  , 'packed'
  , 'goto'
  , 'switch'
  , 'default'
  , 'inline'
  , 'noinline'
  , 'volatile'
  , 'public'
  , 'static'
  , 'extern'
  , 'external'
  , 'interface'
  , 'long'
  , 'short'
  , 'double'
  , 'half'
  , 'fixed'
  , 'unsigned'
  , 'input'
  , 'output'
  , 'hvec2'
  , 'hvec3'
  , 'hvec4'
  , 'dvec2'
  , 'dvec3'
  , 'dvec4'
  , 'fvec2'
  , 'fvec3'
  , 'fvec4'
  , 'sampler2DRect'
  , 'sampler3DRect'
  , 'sampler2DRectShadow'
  , 'sizeof'
  , 'cast'
  , 'namespace'
  , 'using'
]

},{}],164:[function(require,module,exports){
module.exports = [
    '<<='
  , '>>='
  , '++'
  , '--'
  , '<<'
  , '>>'
  , '<='
  , '>='
  , '=='
  , '!='
  , '&&'
  , '||'
  , '+='
  , '-='
  , '*='
  , '/='
  , '%='
  , '&='
  , '^^'
  , '^='
  , '|='
  , '('
  , ')'
  , '['
  , ']'
  , '.'
  , '!'
  , '~'
  , '*'
  , '/'
  , '%'
  , '+'
  , '-'
  , '<'
  , '>'
  , '&'
  , '^'
  , '|'
  , '?'
  , ':'
  , '='
  , ','
  , ';'
  , '{'
  , '}'
]

},{}],165:[function(require,module,exports){
var tokenize = require('./index')

module.exports = tokenizeString

function tokenizeString(str, opt) {
  var generator = tokenize(opt)
  var tokens = []

  tokens = tokens.concat(generator(str))
  tokens = tokens.concat(generator(null))

  return tokens
}

},{"./index":159}],166:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],167:[function(require,module,exports){
"use strict"

function invert(hash) {
  var result = {}
  for(var i in hash) {
    if(hash.hasOwnProperty(i)) {
      result[hash[i]] = i
    }
  }
  return result
}

module.exports = invert
},{}],168:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],169:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],170:[function(require,module,exports){
module.exports      = isTypedArray
isTypedArray.strict = isStrictTypedArray
isTypedArray.loose  = isLooseTypedArray

var toString = Object.prototype.toString
var names = {
    '[object Int8Array]': true
  , '[object Int16Array]': true
  , '[object Int32Array]': true
  , '[object Uint8Array]': true
  , '[object Uint16Array]': true
  , '[object Uint32Array]': true
  , '[object Float32Array]': true
  , '[object Float64Array]': true
}

function isTypedArray(arr) {
  return (
       isStrictTypedArray(arr)
    || isLooseTypedArray(arr)
  )
}

function isStrictTypedArray(arr) {
  return (
       arr instanceof Int8Array
    || arr instanceof Int16Array
    || arr instanceof Int32Array
    || arr instanceof Uint8Array
    || arr instanceof Uint16Array
    || arr instanceof Uint32Array
    || arr instanceof Float32Array
    || arr instanceof Float64Array
  )
}

function isLooseTypedArray(arr) {
  return names[toString.call(arr)]
}

},{}],171:[function(require,module,exports){
module.exports = function(arr) {
  if (!arr) return false
  if (!arr.dtype) return false
  var re = new RegExp('function View[0-9]+d(:?' + arr.dtype + ')+')
  return re.test(String(arr.constructor))
}

},{}],172:[function(require,module,exports){
var xtend = require('xtend')

var defaults = {
	enumerable: true,
	configurable: true
}

function mix(obj, entries) {
	for (var k in entries) {
		if (!entries.hasOwnProperty(k))
			continue
		var f = entries[k]
		if (typeof f === 'function') {
			obj[k] = f
		} else if (f && typeof f === 'object') {
			var def = xtend(defaults, f)
			Object.defineProperty(obj, k, def);
		}
	}
}

module.exports = function mixes(ctor, entries) {
	mix(ctor.prototype, entries)
}

module.exports.mix = mix
},{"xtend":209}],173:[function(require,module,exports){
"use strict"

var compile = require("cwise-compiler")

var EmptyProc = {
  body: "",
  args: [],
  thisVars: [],
  localVars: []
}

function fixup(x) {
  if(!x) {
    return EmptyProc
  }
  for(var i=0; i<x.args.length; ++i) {
    var a = x.args[i]
    if(i === 0) {
      x.args[i] = {name: a, lvalue:true, rvalue: !!x.rvalue, count:x.count||1 }
    } else {
      x.args[i] = {name: a, lvalue:false, rvalue:true, count: 1}
    }
  }
  if(!x.thisVars) {
    x.thisVars = []
  }
  if(!x.localVars) {
    x.localVars = []
  }
  return x
}

function pcompile(user_args) {
  return compile({
    args:     user_args.args,
    pre:      fixup(user_args.pre),
    body:     fixup(user_args.body),
    post:     fixup(user_args.proc),
    funcName: user_args.funcName
  })
}

function makeOp(user_args) {
  var args = []
  for(var i=0; i<user_args.args.length; ++i) {
    args.push("a"+i)
  }
  var wrapper = new Function("P", [
    "return function ", user_args.funcName, "_ndarrayops(", args.join(","), ") {P(", args.join(","), ");return a0}"
  ].join(""))
  return wrapper(pcompile(user_args))
}

var assign_ops = {
  add:  "+",
  sub:  "-",
  mul:  "*",
  div:  "/",
  mod:  "%",
  band: "&",
  bor:  "|",
  bxor: "^",
  lshift: "<<",
  rshift: ">>",
  rrshift: ">>>"
}
;(function(){
  for(var id in assign_ops) {
    var op = assign_ops[id]
    exports[id] = makeOp({
      args: ["array","array","array"],
      body: {args:["a","b","c"],
             body: "a=b"+op+"c"},
      funcName: id
    })
    exports[id+"eq"] = makeOp({
      args: ["array","array"],
      body: {args:["a","b"],
             body:"a"+op+"=b"},
      rvalue: true,
      funcName: id+"eq"
    })
    exports[id+"s"] = makeOp({
      args: ["array", "array", "scalar"],
      body: {args:["a","b","s"],
             body:"a=b"+op+"s"},
      funcName: id+"s"
    })
    exports[id+"seq"] = makeOp({
      args: ["array","scalar"],
      body: {args:["a","s"],
             body:"a"+op+"=s"},
      rvalue: true,
      funcName: id+"seq"
    })
  }
})();

var unary_ops = {
  not: "!",
  bnot: "~",
  neg: "-",
  recip: "1.0/"
}
;(function(){
  for(var id in unary_ops) {
    var op = unary_ops[id]
    exports[id] = makeOp({
      args: ["array", "array"],
      body: {args:["a","b"],
             body:"a="+op+"b"},
      funcName: id
    })
    exports[id+"eq"] = makeOp({
      args: ["array"],
      body: {args:["a"],
             body:"a="+op+"a"},
      rvalue: true,
      count: 2,
      funcName: id+"eq"
    })
  }
})();

var binary_ops = {
  and: "&&",
  or: "||",
  eq: "===",
  neq: "!==",
  lt: "<",
  gt: ">",
  leq: "<=",
  geq: ">="
}
;(function() {
  for(var id in binary_ops) {
    var op = binary_ops[id]
    exports[id] = makeOp({
      args: ["array","array","array"],
      body: {args:["a", "b", "c"],
             body:"a=b"+op+"c"},
      funcName: id
    })
    exports[id+"s"] = makeOp({
      args: ["array","array","scalar"],
      body: {args:["a", "b", "s"],
             body:"a=b"+op+"s"},
      funcName: id+"s"
    })
    exports[id+"eq"] = makeOp({
      args: ["array", "array"],
      body: {args:["a", "b"],
             body:"a=a"+op+"b"},
      rvalue:true,
      count:2,
      funcName: id+"eq"
    })
    exports[id+"seq"] = makeOp({
      args: ["array", "scalar"],
      body: {args:["a","s"],
             body:"a=a"+op+"s"},
      rvalue:true,
      count:2,
      funcName: id+"seq"
    })
  }
})();

var math_unary = [
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "floor",
  "log",
  "round",
  "sin",
  "sqrt",
  "tan"
]
;(function() {
  for(var i=0; i<math_unary.length; ++i) {
    var f = math_unary[i]
    exports[f] = makeOp({
                    args: ["array", "array"],
                    pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                    body: {args:["a","b"], body:"a=this_f(b)", thisVars:["this_f"]},
                    funcName: f
                  })
    exports[f+"eq"] = makeOp({
                      args: ["array"],
                      pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                      body: {args: ["a"], body:"a=this_f(a)", thisVars:["this_f"]},
                      rvalue: true,
                      count: 2,
                      funcName: f+"eq"
                    })
  }
})();

var math_comm = [
  "max",
  "min",
  "atan2",
  "pow"
]
;(function(){
  for(var i=0; i<math_comm.length; ++i) {
    var f= math_comm[i]
    exports[f] = makeOp({
                  args:["array", "array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(b,c)", thisVars:["this_f"]},
                  funcName: f
                })
    exports[f+"s"] = makeOp({
                  args:["array", "array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(b,c)", thisVars:["this_f"]},
                  funcName: f+"s"
                  })
    exports[f+"eq"] = makeOp({ args:["array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(a,b)", thisVars:["this_f"]},
                  rvalue: true,
                  count: 2,
                  funcName: f+"eq"
                  })
    exports[f+"seq"] = makeOp({ args:["array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(a,b)", thisVars:["this_f"]},
                  rvalue:true,
                  count:2,
                  funcName: f+"seq"
                  })
  }
})();

var math_noncomm = [
  "atan2",
  "pow"
]
;(function(){
  for(var i=0; i<math_noncomm.length; ++i) {
    var f= math_noncomm[i]
    exports[f+"op"] = makeOp({
                  args:["array", "array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(c,b)", thisVars:["this_f"]},
                  funcName: f+"op"
                })
    exports[f+"ops"] = makeOp({
                  args:["array", "array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(c,b)", thisVars:["this_f"]},
                  funcName: f+"ops"
                  })
    exports[f+"opeq"] = makeOp({ args:["array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(b,a)", thisVars:["this_f"]},
                  rvalue: true,
                  count: 2,
                  funcName: f+"opeq"
                  })
    exports[f+"opseq"] = makeOp({ args:["array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(b,a)", thisVars:["this_f"]},
                  rvalue:true,
                  count:2,
                  funcName: f+"opseq"
                  })
  }
})();

exports.any = compile({
  args:["array"],
  pre: EmptyProc,
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "if(a){return true}", localVars: [], thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return false"},
  funcName: "any"
})

exports.all = compile({
  args:["array"],
  pre: EmptyProc,
  body: {args:[{name:"x", lvalue:false, rvalue:true, count:1}], body: "if(!x){return false}", localVars: [], thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return true"},
  funcName: "all"
})

exports.sum = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "this_s+=a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "sum"
})

exports.prod = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=1"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "this_s*=a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "prod"
})

exports.norm2squared = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:2}], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norm2squared"
})
  
exports.norm2 = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:2}], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return Math.sqrt(this_s)"},
  funcName: "norm2"
})
  

exports.norminf = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:4}], body:"if(-a>this_s){this_s=-a}else if(a>this_s){this_s=a}", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norminf"
})

exports.norm1 = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:3}], body: "this_s+=a<0?-a:a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norm1"
})

exports.sup = compile({
  args: [ "array" ],
  pre:
   { body: "this_h=-Infinity",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] },
  body:
   { body: "if(_inline_1_arg0_>this_h)this_h=_inline_1_arg0_",
     args: [{"name":"_inline_1_arg0_","lvalue":false,"rvalue":true,"count":2} ],
     thisVars: [ "this_h" ],
     localVars: [] },
  post:
   { body: "return this_h",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] }
 })

exports.inf = compile({
  args: [ "array" ],
  pre:
   { body: "this_h=Infinity",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] },
  body:
   { body: "if(_inline_1_arg0_<this_h)this_h=_inline_1_arg0_",
     args: [{"name":"_inline_1_arg0_","lvalue":false,"rvalue":true,"count":2} ],
     thisVars: [ "this_h" ],
     localVars: [] },
  post:
   { body: "return this_h",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] }
 })

exports.argmin = compile({
  args:["index","array","shape"],
  pre:{
    body:"{this_v=Infinity;this_i=_inline_0_arg2_.slice(0)}",
    args:[
      {name:"_inline_0_arg0_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg1_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg2_",lvalue:false,rvalue:true,count:1}
      ],
    thisVars:["this_i","this_v"],
    localVars:[]},
  body:{
    body:"{if(_inline_1_arg1_<this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
    args:[
      {name:"_inline_1_arg0_",lvalue:false,rvalue:true,count:2},
      {name:"_inline_1_arg1_",lvalue:false,rvalue:true,count:2}],
    thisVars:["this_i","this_v"],
    localVars:["_inline_1_k"]},
  post:{
    body:"{return this_i}",
    args:[],
    thisVars:["this_i"],
    localVars:[]}
})

exports.argmax = compile({
  args:["index","array","shape"],
  pre:{
    body:"{this_v=-Infinity;this_i=_inline_0_arg2_.slice(0)}",
    args:[
      {name:"_inline_0_arg0_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg1_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg2_",lvalue:false,rvalue:true,count:1}
      ],
    thisVars:["this_i","this_v"],
    localVars:[]},
  body:{
    body:"{if(_inline_1_arg1_>this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
    args:[
      {name:"_inline_1_arg0_",lvalue:false,rvalue:true,count:2},
      {name:"_inline_1_arg1_",lvalue:false,rvalue:true,count:2}],
    thisVars:["this_i","this_v"],
    localVars:["_inline_1_k"]},
  post:{
    body:"{return this_i}",
    args:[],
    thisVars:["this_i"],
    localVars:[]}
})  

exports.random = makeOp({
  args: ["array"],
  pre: {args:[], body:"this_f=Math.random", thisVars:["this_f"]},
  body: {args: ["a"], body:"a=this_f()", thisVars:["this_f"]},
  funcName: "random"
})

exports.assign = makeOp({
  args:["array", "array"],
  body: {args:["a", "b"], body:"a=b"},
  funcName: "assign" })

exports.assigns = makeOp({
  args:["array", "scalar"],
  body: {args:["a", "b"], body:"a=b"},
  funcName: "assigns" })


exports.equals = compile({
  args:["array", "array"],
  pre: EmptyProc,
  body: {args:[{name:"x", lvalue:false, rvalue:true, count:1},
               {name:"y", lvalue:false, rvalue:true, count:1}], 
        body: "if(x!==y){return false}", 
        localVars: [], 
        thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return true"},
  funcName: "equals"
})



},{"cwise-compiler":13}],174:[function(require,module,exports){
var iota = require("iota-array")
var isBuffer = require("is-buffer")

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

module.exports = wrappedNDArrayCtor

},{"iota-array":168,"is-buffer":169}],175:[function(require,module,exports){
(function (Buffer){
'use strict'

module.exports = unpackPNG

var ndarray = require('ndarray')
var parse = require('pngparse-sync')

function decodeB64(str) {
  return new Buffer(str, 'base64')
}

function unpackPNG(w, h, c, str) {
  var pixels = parse(decodeB64(str))
  return ndarray(pixels.data, [h, w, pixels.channels], [pixels.channels*w, pixels.channels, 1], 0)
}
}).call(this,require("buffer").Buffer)
},{"buffer":211,"ndarray":174,"pngparse-sync":194}],176:[function(require,module,exports){
var EPSILON = 1e-6;

//Estimate the vertex normals of a mesh
exports.vertexNormals = function(faces, positions) {
  
  var N         = positions.length;
  var normals   = new Array(N);
  
  //Initialize normal array
  for(var i=0; i<N; ++i) {
    normals[i] = [0.0, 0.0, 0.0];
  }
  
  //Walk over all the faces and add per-vertex contribution to normal weights
  for(var i=0; i<faces.length; ++i) {
    var f = faces[i];
    var p = 0;
    var c = f[f.length-1];
    var n = f[0];
    for(var j=0; j<f.length; ++j) {
    
      //Shift indices back
      p = c;
      c = n;
      n = f[(j+1) % f.length];
    
      var v0 = positions[p];
      var v1 = positions[c];
      var v2 = positions[n];
      
      //Compute infineteismal arcs
      var d01 = new Array(3);
      var m01 = 0.0;
      var d21 = new Array(3);
      var m21 = 0.0;
      for(var k=0; k<3; ++k) {
        d01[k] = v0[k]  - v1[k];
        m01   += d01[k] * d01[k];
        d21[k] = v2[k]  - v1[k];
        m21   += d21[k] * d21[k];
      }

      //Accumulate values in normal
      if(m01 * m21 > EPSILON) {
        var norm = normals[c];
        var w = 1.0 / Math.sqrt(m01 * m21);
        for(var k=0; k<3; ++k) {
          var u = (k+1)%3;
          var v = (k+2)%3;
          norm[k] += w * (d21[u] * d01[v] - d21[v] * d01[u]);
        }
      }
    }
  }
  
  //Scale all normals to unit length
  for(var i=0; i<N; ++i) {
    var norm = normals[i];
    var m = 0.0;
    for(var k=0; k<3; ++k) {
      m += norm[k] * norm[k];
    }
    if(m > EPSILON) {
      var w = 1.0 / Math.sqrt(m);
      for(var k=0; k<3; ++k) {
        norm[k] *= w;
      }
    } else {
      for(var k=0; k<3; ++k) {
        norm[k] = 0.0;
      }
    }
  }

  //Return the resulting set of patches
  return normals;
}

//Compute face normals of a mesh
exports.faceNormals = function(faces, positions) {
  var N         = faces.length;
  var normals   = new Array(N);
  
  for(var i=0; i<N; ++i) {
    var f = faces[i];
    var pos = new Array(3);
    for(var j=0; j<3; ++j) {
      pos[j] = positions[f[j]];
    }
    
    var d01 = new Array(3);
    var d21 = new Array(3);
    for(var j=0; j<3; ++j) {
      d01[j] = pos[1][j] - pos[0][j];
      d21[j] = pos[2][j] - pos[0][j];
    }
    
    var n = new Array(3);
    var l = 0.0;
    for(var j=0; j<3; ++j) {
      var u = (j+1)%3;
      var v = (j+2)%3;
      n[j] = d01[u] * d21[v] - d01[v] * d21[u];
      l += n[j] * n[j];
    }
    if(l > EPSILON) {
      l = 1.0 / Math.sqrt(l);
    } else {
      l = 0.0;
    }
    for(var j=0; j<3; ++j) {
      n[j] *= l;
    }
    normals[i] = n;
  }
  return normals;
}



},{}],177:[function(require,module,exports){
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);

/**
 * A singleton for number utilities. 
 * @class NumberUtil
 */
var NumberUtil = function() {

};


/**
 * Returns a float representation of the given int bits. ArrayBuffer
 * is used for the conversion.
 *
 * @method  intBitsToFloat
 * @static
 * @param  {Number} i the int to cast
 * @return {Number}   the float
 */
NumberUtil.intBitsToFloat = function(i) {
	int32[0] = i;
	return float32[0];
};

/**
 * Returns the int bits from the given float. ArrayBuffer is used
 * for the conversion.
 *
 * @method  floatToIntBits
 * @static
 * @param  {Number} f the float to cast
 * @return {Number}   the int bits
 */
NumberUtil.floatToIntBits = function(f) {
	float32[0] = f;
	return int32[0];
};

/**
 * Encodes ABGR int as a float, with slight precision loss.
 *
 * @method  intToFloatColor
 * @static
 * @param {Number} value an ABGR packed integer
 */
NumberUtil.intToFloatColor = function(value) {
	return NumberUtil.intBitsToFloat( value & 0xfeffffff );
};

/**
 * Returns a float encoded ABGR value from the given RGBA
 * bytes (0 - 255). Useful for saving bandwidth in vertex data.
 *
 * @method  colorToFloat
 * @static
 * @param {Number} r the Red byte (0 - 255)
 * @param {Number} g the Green byte (0 - 255)
 * @param {Number} b the Blue byte (0 - 255)
 * @param {Number} a the Alpha byte (0 - 255)
 * @return {Float32}  a Float32 of the RGBA color
 */
NumberUtil.colorToFloat = function(r, g, b, a) {
	var bits = (a << 24 | b << 16 | g << 8 | r);
	return NumberUtil.intToFloatColor(bits);
};

/**
 * Returns true if the number is a power-of-two.
 *
 * @method  isPowerOfTwo
 * @param  {Number}  n the number to test
 * @return {Boolean}   true if power-of-two
 */
NumberUtil.isPowerOfTwo = function(n) {
	return (n & (n - 1)) === 0;
};

/**
 * Returns the next highest power-of-two from the specified number. 
 * 
 * @param  {Number} n the number to test
 * @return {Number}   the next highest power of two
 */
NumberUtil.nextPowerOfTwo = function(n) {
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n+1;
};

module.exports = NumberUtil;
},{}],178:[function(require,module,exports){
// Top level file is just a mixin of submodules & constants
'use strict';

var assign    = require('./lib/utils/common').assign;

var deflate   = require('./lib/deflate');
var inflate   = require('./lib/inflate');
var constants = require('./lib/zlib/constants');

var pako = {};

assign(pako, deflate, inflate, constants);

module.exports = pako;

},{"./lib/deflate":179,"./lib/inflate":180,"./lib/utils/common":181,"./lib/zlib/constants":184}],179:[function(require,module,exports){
'use strict';


var zlib_deflate = require('./zlib/deflate.js');
var utils = require('./utils/common');
var strings = require('./utils/strings');
var msg = require('./zlib/messages');
var zstream = require('./zlib/zstream');

var toString = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

var Z_NO_FLUSH      = 0;
var Z_FINISH        = 4;

var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_SYNC_FLUSH    = 2;

var Z_DEFAULT_COMPRESSION = -1;

var Z_DEFAULT_STRATEGY    = 0;

var Z_DEFLATED  = 8;

/* ===========================================================================*/


/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overriden.
 **/

/**
 * Deflate.result -> Uint8Array|Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
 * push a chunk with explicit flush (call [[Deflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/


/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
var Deflate = function(options) {

  this.options = utils.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY,
    to: ''
  }, options || {});

  var opt = this.options;

  if (opt.raw && (opt.windowBits > 0)) {
    opt.windowBits = -opt.windowBits;
  }

  else if (opt.gzip && (opt.windowBits > 0) && (opt.windowBits < 16)) {
    opt.windowBits += 16;
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm = new zstream();
  this.strm.avail_out = 0;

  var status = zlib_deflate.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );

  if (status !== Z_OK) {
    throw new Error(msg[status]);
  }

  if (opt.header) {
    zlib_deflate.deflateSetHeader(this.strm, opt.header);
  }
};

/**
 * Deflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` meansh Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Deflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the compression context.
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * array format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate.prototype.push = function(data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status, _mode;

  if (this.ended) { return false; }

  _mode = (mode === ~~mode) ? mode : ((mode === true) ? Z_FINISH : Z_NO_FLUSH);

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = zlib_deflate.deflate(strm, _mode);    /* no bad return value */

    if (status !== Z_STREAM_END && status !== Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }
    if (strm.avail_out === 0 || (strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH))) {
      if (this.options.to === 'string') {
        this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
      } else {
        this.onData(utils.shrinkBuf(strm.output, strm.next_out));
      }
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);

  // Finalize on the last chunk.
  if (_mode === Z_FINISH) {
    status = zlib_deflate.deflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === Z_SYNC_FLUSH) {
    this.onEnd(Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};


/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): ouput data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};


/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate.prototype.onEnd = function(status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * deflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate alrorythm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , data = Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate(input, options) {
  var deflator = new Deflate(options);

  deflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) { throw deflator.msg; }

  return deflator.result;
}


/**
 * deflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate(input, options);
}


/**
 * gzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate(input, options);
}


exports.Deflate = Deflate;
exports.deflate = deflate;
exports.deflateRaw = deflateRaw;
exports.gzip = gzip;

},{"./utils/common":181,"./utils/strings":182,"./zlib/deflate.js":186,"./zlib/messages":191,"./zlib/zstream":193}],180:[function(require,module,exports){
'use strict';


var zlib_inflate = require('./zlib/inflate.js');
var utils = require('./utils/common');
var strings = require('./utils/strings');
var c = require('./zlib/constants');
var msg = require('./zlib/messages');
var zstream = require('./zlib/zstream');
var gzheader = require('./zlib/gzheader');

var toString = Object.prototype.toString;

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overriden.
 **/

/**
 * Inflate.result -> Uint8Array|Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
 * push a chunk with explicit flush (call [[Inflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/


/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
var Inflate = function(options) {

  this.options = utils.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ''
  }, options || {});

  var opt = this.options;

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) { opt.windowBits = -15; }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
      !(options && options.windowBits)) {
    opt.windowBits += 32;
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm   = new zstream();
  this.strm.avail_out = 0;

  var status  = zlib_inflate.inflateInit2(
    this.strm,
    opt.windowBits
  );

  if (status !== c.Z_OK) {
    throw new Error(msg[status]);
  }

  this.header = new gzheader();

  zlib_inflate.inflateGetHeader(this.strm, this.header);
};

/**
 * Inflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` meansh Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the decompression context.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate.prototype.push = function(data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status, _mode;
  var next_out_utf8, tail, utf8str;

  // Flag to properly process Z_BUF_ERROR on testing inflate call
  // when we check that all output data was flushed.
  var allowBufError = false;

  if (this.ended) { return false; }
  _mode = (mode === ~~mode) ? mode : ((mode === true) ? c.Z_FINISH : c.Z_NO_FLUSH);

  // Convert data if needed
  if (typeof data === 'string') {
    // Only binary strings can be decompressed on practice
    strm.input = strings.binstring2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);    /* no bad return value */

    if (status === c.Z_BUF_ERROR && allowBufError === true) {
      status = c.Z_OK;
      allowBufError = false;
    }

    if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === c.Z_STREAM_END || (strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH))) {

        if (this.options.to === 'string') {

          next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

          tail = strm.next_out - next_out_utf8;
          utf8str = strings.buf2string(strm.output, next_out_utf8);

          // move tail
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) { utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0); }

          this.onData(utf8str);

        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    }

    // When no more input data, we should check that internal inflate buffers
    // are flushed. The only way to do it when avail_out = 0 - run one more
    // inflate pass. But if output data not exists, inflate return Z_BUF_ERROR.
    // Here we set flag to process this error properly.
    //
    // NOTE. Deflate does not return error in this case and does not needs such
    // logic.
    if (strm.avail_in === 0 && strm.avail_out === 0) {
      allowBufError = true;
    }

  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);

  if (status === c.Z_STREAM_END) {
    _mode = c.Z_FINISH;
  }

  // Finalize on the last chunk.
  if (_mode === c.Z_FINISH) {
    status = zlib_inflate.inflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === c.Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === c.Z_SYNC_FLUSH) {
    this.onEnd(c.Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};


/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): ouput data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};


/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate.prototype.onEnd = function(status) {
  // On success - join
  if (status === c.Z_OK) {
    if (this.options.to === 'string') {
      // Glue & convert here, until we teach pako to send
      // utf8 alligned strings to onData
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * inflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
 *   , output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err)
 *   console.log(err);
 * }
 * ```
 **/
function inflate(input, options) {
  var inflator = new Inflate(options);

  inflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) { throw inflator.msg; }

  return inflator.result;
}


/**
 * inflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate(input, options);
}


/**
 * ungzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/


exports.Inflate = Inflate;
exports.inflate = inflate;
exports.inflateRaw = inflateRaw;
exports.ungzip  = inflate;

},{"./utils/common":181,"./utils/strings":182,"./zlib/constants":184,"./zlib/gzheader":187,"./zlib/inflate.js":189,"./zlib/messages":191,"./zlib/zstream":193}],181:[function(require,module,exports){
'use strict';


var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
                (typeof Uint16Array !== 'undefined') &&
                (typeof Int32Array !== 'undefined');


exports.assign = function (obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    var source = sources.shift();
    if (!source) { continue; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (var p in source) {
      if (source.hasOwnProperty(p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// reduce buffer size, avoiding mem copy
exports.shrinkBuf = function (buf, size) {
  if (buf.length === size) { return buf; }
  if (buf.subarray) { return buf.subarray(0, size); }
  buf.length = size;
  return buf;
};


var fnTyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs+len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i=0; i<len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function(chunks) {
    var i, l, len, pos, chunk, result;

    // calculate data length
    len = 0;
    for (i=0, l=chunks.length; i<l; i++) {
      len += chunks[i].length;
    }

    // join chunks
    result = new Uint8Array(len);
    pos = 0;
    for (i=0, l=chunks.length; i<l; i++) {
      chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result;
  }
};

var fnUntyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    for (var i=0; i<len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function(chunks) {
    return [].concat.apply([], chunks);
  }
};


// Enable/Disable typed arrays use, for testing
//
exports.setTyped = function (on) {
  if (on) {
    exports.Buf8  = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, fnTyped);
  } else {
    exports.Buf8  = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, fnUntyped);
  }
};

exports.setTyped(TYPED_OK);

},{}],182:[function(require,module,exports){
// String encode/decode helpers
'use strict';


var utils = require('./common');


// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safary
//
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;

try { String.fromCharCode.apply(null, [0]); } catch(__) { STR_APPLY_OK = false; }
try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch(__) { STR_APPLY_UIA_OK = false; }


// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new utils.Buf8(256);
for (var q=0; q<256; q++) {
  _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
}
_utf8len[254]=_utf8len[254]=1; // Invalid sequence start


// convert string to array (typed, when possible)
exports.string2buf = function (str) {
  var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
      c2 = str.charCodeAt(m_pos+1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // allocate buffer
  buf = new utils.Buf8(buf_len);

  // convert
  for (i=0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
      c2 = str.charCodeAt(m_pos+1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c;
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xC0 | (c >>> 6);
      buf[i++] = 0x80 | (c & 0x3f);
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xE0 | (c >>> 12);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | (c >>> 18);
      buf[i++] = 0x80 | (c >>> 12 & 0x3f);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    }
  }

  return buf;
};

// Helper (used in 2 places)
function buf2binstring(buf, len) {
  // use fallback for big arrays to avoid stack overflow
  if (len < 65537) {
    if ((buf.subarray && STR_APPLY_UIA_OK) || (!buf.subarray && STR_APPLY_OK)) {
      return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
    }
  }

  var result = '';
  for (var i=0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
}


// Convert byte array to binary string
exports.buf2binstring = function(buf) {
  return buf2binstring(buf, buf.length);
};


// Convert binary string (typed, when possible)
exports.binstring2buf = function(str) {
  var buf = new utils.Buf8(str.length);
  for (var i=0, len=buf.length; i < len; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
};


// convert array to string
exports.buf2string = function (buf, max) {
  var i, out, c, c_len;
  var len = max || buf.length;

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  var utf16buf = new Array(len*2);

  for (out=0, i=0; i<len;) {
    c = buf[i++];
    // quick process ascii
    if (c < 0x80) { utf16buf[out++] = c; continue; }

    c_len = _utf8len[c];
    // skip 5 & 6 byte codes
    if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len-1; continue; }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
    // join the rest
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 0x3f);
      c_len--;
    }

    // terminated by end of string?
    if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

    if (c < 0x10000) {
      utf16buf[out++] = c;
    } else {
      c -= 0x10000;
      utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
      utf16buf[out++] = 0xdc00 | (c & 0x3ff);
    }
  }

  return buf2binstring(utf16buf, out);
};


// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
exports.utf8border = function(buf, max) {
  var pos;

  max = max || buf.length;
  if (max > buf.length) { max = buf.length; }

  // go back from last position, until start of sequence found
  pos = max-1;
  while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

  // Fuckup - very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) { return max; }

  // If we came to start of buffer - that means vuffer is too small,
  // return max too.
  if (pos === 0) { return max; }

  return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

},{"./common":181}],183:[function(require,module,exports){
'use strict';

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It doesn't worth to make additional optimizationa as in original.
// Small size is preferable.

function adler32(adler, buf, len, pos) {
  var s1 = (adler & 0xffff) |0,
      s2 = ((adler >>> 16) & 0xffff) |0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
}


module.exports = adler32;

},{}],184:[function(require,module,exports){
module.exports = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

},{}],185:[function(require,module,exports){
'use strict';

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.


// Use ordinary array, since untyped makes no boost here
function makeTable() {
  var c, table = [];

  for (var n =0; n < 256; n++) {
    c = n;
    for (var k =0; k < 8; k++) {
      c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();


function crc32(crc, buf, len, pos) {
  var t = crcTable,
      end = pos + len;

  crc = crc ^ (-1);

  for (var i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
}


module.exports = crc32;

},{}],186:[function(require,module,exports){
'use strict';

var utils   = require('../utils/common');
var trees   = require('./trees');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var msg   = require('./messages');

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
var Z_NO_FLUSH      = 0;
var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
//var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
//var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
//var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;


/* compression levels */
//var Z_NO_COMPRESSION      = 0;
//var Z_BEST_SPEED          = 1;
//var Z_BEST_COMPRESSION    = 9;
var Z_DEFAULT_COMPRESSION = -1;


var Z_FILTERED            = 1;
var Z_HUFFMAN_ONLY        = 2;
var Z_RLE                 = 3;
var Z_FIXED               = 4;
var Z_DEFAULT_STRATEGY    = 0;

/* Possible values of the data_type field (though see inflate()) */
//var Z_BINARY              = 0;
//var Z_TEXT                = 1;
//var Z_ASCII               = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;


/* The deflate compression method */
var Z_DEFLATED  = 8;

/*============================================================================*/


var MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_MEM_LEVEL = 8;


var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
var LITERALS      = 256;
/* number of literal bytes 0..255 */
var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
var D_CODES       = 30;
/* number of distance codes */
var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
var HEAP_SIZE     = 2*L_CODES + 1;
/* maximum heap size */
var MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

var PRESET_DICT = 0x20;

var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;

var BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
var BS_BLOCK_DONE     = 2; /* block flush performed */
var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
var BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

function err(strm, errorCode) {
  strm.msg = msg[errorCode];
  return errorCode;
}

function rank(f) {
  return ((f) << 1) - ((f) > 4 ? 9 : 0);
}

function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }


/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm) {
  var s = strm.state;

  //_tr_flush_bits(s);
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}


function flush_block_only (s, last) {
  trees._tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}


function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB(s, b) {
//  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
}


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  utils.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
}


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;      /* max hash chain length */
  var scan = s.strstart; /* current string */
  var match;                       /* matched string */
  var len;                           /* length of current match */
  var best_len = s.prev_length;              /* best match length so far */
  var nice_match = s.nice_match;             /* stop if match long enough */
  var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  var _win = s.window; // shortcut

  var wmask = s.w_mask;
  var prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  var strend = s.strstart + MAX_MATCH;
  var scan_end1  = _win[scan + best_len - 1];
  var scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = (m >= _w_size ? m - _w_size : 0);
      } while (--n);

      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH-1]) & s.hash_mask;

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    var curr = s.strstart + s.lookahead;
//    var init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush) {
  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  var max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
//      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
//        s.block_start >= s.w_size)) {
//        throw  new Error("slide too late");
//      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
//    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    var max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/


    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush) {
  var hash_head;        /* head of the hash chain */
  var bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH-1)) ? s.strstart : MIN_MATCH-1);
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush) {
  var hash_head;          /* head of hash chain */
  var bflush;              /* set if current block must be flushed */

  var max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH-1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size-MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH-1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = trees._tr_tally(s, s.strstart - 1- s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length-1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH-1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart-1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart-1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH-1 ? s.strstart : MIN_MATCH-1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
}


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush) {
  var bflush;            /* set if current block must be flushed */
  var prev;              /* byte at distance one to match */
  var scan, strend;      /* scan goes up to strend for length of run */

  var _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush) {
  var bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
var Config = function (good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
};

var configuration_table;

configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init(s) {
  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new utils.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree  = new utils.Buf16((2*D_CODES+1) * 2);
  this.bl_tree    = new utils.Buf16((2*BL_CODES+1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new utils.Buf16(MAX_BITS+1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new utils.Buf16(2*L_CODES+1);  /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new utils.Buf16(2*L_CODES+1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0;          /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0;      /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


function deflateResetKeep(strm) {
  var s;

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH;
  trees._tr_init(s);
  return Z_OK;
}


function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
}


function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  if (strm.state.wrap !== 2) { return Z_STREAM_ERROR; }
  strm.state.gzhead = head;
  return Z_OK;
}


function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR;
  }
  var wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  var s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new utils.Buf8(s.w_size * 2);
  s.head = new utils.Buf16(s.hash_size);
  s.prev = new utils.Buf16(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new utils.Buf8(s.pending_buf_size);

  s.d_buf = s.lit_bufsize >> 1;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
}

function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
}


function deflate(strm, flush) {
  var old_flush, s;
  var beg, val; // for gzip header write only

  if (!strm || !strm.state ||
    flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }

  s = strm.state;

  if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }

  s.strm = strm; /* just in case */
  old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) { // GZIP header
      strm.adler = 0;  //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) { // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      }
      else {
        put_byte(s, (s.gzhead.text ? 1 : 0) +
                    (s.gzhead.hcrc ? 2 : 0) +
                    (!s.gzhead.extra ? 0 : 4) +
                    (!s.gzhead.name ? 0 : 8) +
                    (!s.gzhead.comment ? 0 : 16)
                );
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, (s.gzhead.time >> 8) & 0xff);
        put_byte(s, (s.gzhead.time >> 16) & 0xff);
        put_byte(s, (s.gzhead.time >> 24) & 0xff);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    else // DEFLATE header
    {
      var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8;
      var level_flags = -1;

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= (level_flags << 6);
      if (s.strstart !== 0) { header |= PRESET_DICT; }
      header += 31 - (header % 31);

      s.status = BUSY_STATE;
      putShortMSB(s, header);

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
      }
      strm.adler = 1; // adler32(0L, Z_NULL, 0);
    }
  }

//#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */

      while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    }
    else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    }
    else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    }
    else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >> 8) & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    }
    else {
      s.status = BUSY_STATE;
    }
  }
//#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
    var bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
      (s.strategy === Z_RLE ? deflate_rle(s, flush) :
        configuration_table[s.level].func(s, flush));

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      }
      else if (flush !== Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */

        trees._tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH) { return Z_OK; }
  if (s.wrap <= 0) { return Z_STREAM_END; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK : Z_STREAM_END;
}

function deflateEnd(strm) {
  var status;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  status = strm.state.status;
  if (status !== INIT_STATE &&
    status !== EXTRA_STATE &&
    status !== NAME_STATE &&
    status !== COMMENT_STATE &&
    status !== HCRC_STATE &&
    status !== BUSY_STATE &&
    status !== FINISH_STATE
  ) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
}

/* =========================================================================
 * Copy the source state to the destination state
 */
//function deflateCopy(dest, source) {
//
//}

exports.deflateInit = deflateInit;
exports.deflateInit2 = deflateInit2;
exports.deflateReset = deflateReset;
exports.deflateResetKeep = deflateResetKeep;
exports.deflateSetHeader = deflateSetHeader;
exports.deflate = deflate;
exports.deflateEnd = deflateEnd;
exports.deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
exports.deflateBound = deflateBound;
exports.deflateCopy = deflateCopy;
exports.deflateSetDictionary = deflateSetDictionary;
exports.deflateParams = deflateParams;
exports.deflatePending = deflatePending;
exports.deflatePrime = deflatePrime;
exports.deflateTune = deflateTune;
*/

},{"../utils/common":181,"./adler32":183,"./crc32":185,"./messages":191,"./trees":192}],187:[function(require,module,exports){
'use strict';


function GZheader() {
  /* true if compressed data believed to be text */
  this.text       = 0;
  /* modification time */
  this.time       = 0;
  /* extra flags (not used when writing a gzip file) */
  this.xflags     = 0;
  /* operating system */
  this.os         = 0;
  /* pointer to extra field or Z_NULL if none */
  this.extra      = null;
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len  = 0; // Actually, we don't need it in JS,
                       // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name       = '';
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment    = '';
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc       = 0;
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done       = false;
}

module.exports = GZheader;

},{}],188:[function(require,module,exports){
'use strict';

// See state defs from inflate.js
var BAD = 30;       /* got a data error -- remain here until reset */
var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
module.exports = function inflate_fast(strm, start) {
  var state;
  var _in;                    /* local strm.input */
  var last;                   /* have enough input while in < last */
  var _out;                   /* local strm.output */
  var beg;                    /* inflate()'s initial strm.output */
  var end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  var dmax;                   /* maximum distance from zlib header */
//#endif
  var wsize;                  /* window size or zero if not using window */
  var whave;                  /* valid bytes in the window */
  var wnext;                  /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  var s_window;               /* allocated sliding window, if wsize != 0 */
  var hold;                   /* local strm.hold */
  var bits;                   /* local strm.bits */
  var lcode;                  /* local strm.lencode */
  var dcode;                  /* local strm.distcode */
  var lmask;                  /* mask for first level of length codes */
  var dmask;                  /* mask for first level of distance codes */
  var here;                   /* retrieved table entry */
  var op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  var len;                    /* match length, unused bytes */
  var dist;                   /* match distance */
  var from;                   /* where to copy match from */
  var from_source;


  var input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD;
                  break top;
                }

// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

},{}],189:[function(require,module,exports){
'use strict';


var utils = require('../utils/common');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var inflate_fast = require('./inffast');
var inflate_table = require('./inftrees');

var CODES = 0;
var LENS = 1;
var DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED  = 8;


/* STATES ====================================================================*/
/* ===========================================================================*/


var    HEAD = 1;       /* i: waiting for magic header */
var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
var    TIME = 3;       /* i: waiting for modification time (gzip) */
var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
var    NAME = 7;       /* i: waiting for end of file name (gzip) */
var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
var    HCRC = 9;       /* i: waiting for header crc (gzip) */
var    DICTID = 10;    /* i: waiting for dictionary check value */
var    DICT = 11;      /* waiting for inflateSetDictionary() call */
var        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
var        STORED = 14;    /* i: waiting for stored size (length and complement) */
var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
var        LENLENS = 18;   /* i: waiting for code length code lengths */
var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
var            LEN = 21;       /* i: waiting for length/lit/eob code */
var            LENEXT = 22;    /* i: waiting for length extra bits */
var            DIST = 23;      /* i: waiting for distance code */
var            DISTEXT = 24;   /* i: waiting for distance extra bits */
var            MATCH = 25;     /* o: waiting for output space to copy string */
var            LIT = 26;       /* o: waiting for output space to write literal */
var    CHECK = 27;     /* i: waiting for 32-bit check value */
var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
var    DONE = 29;      /* finished check, done -- remain here until reset */
var    BAD = 30;       /* got a data error -- remain here until reset */
var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;


function ZSWAP32(q) {
  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
}


function InflateState() {
  this.mode = 0;             /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib) */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
  this.work = new utils.Buf16(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}

function inflateResetKeep(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK;
}

function inflateReset(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

}

function inflateReset2(strm, windowBits) {
  var wrap;
  var state;

  /* get the state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
  var ret;
  var state;

  if (!strm) { return Z_STREAM_ERROR; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null/*Z_NULL*/;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
}

function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    var sym;

    lenfix = new utils.Buf32(512);
    distfix = new utils.Buf32(32);

    /* literal/length table */
    sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inflate_table(LENS,  state.lens, 0, 288, lenfix,   0, state.work, {bits: 9});

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inflate_table(DISTS, state.lens, 0, 32,   distfix, 0, state.work, {bits: 5});

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new utils.Buf8(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    utils.arraySet(state.window,src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    utils.arraySet(state.window,src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      utils.arraySet(state.window,src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
}

function inflate(strm, flush) {
  var state;
  var input, output;          // input/output buffers
  var next;                   /* next input INDEX */
  var put;                    /* next output INDEX */
  var have, left;             /* available input and output */
  var hold;                   /* bit buffer */
  var bits;                   /* bits in bit buffer */
  var _in, _out;              /* save starting available input and output */
  var copy;                   /* number of stored or match bytes to copy */
  var from;                   /* where to copy match bytes from */
  var from_source;
  var here = 0;               /* current decoding table entry */
  var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //var last;                   /* parent table entry */
  var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  var len;                    /* length to copy for repeats, bits to drop */
  var ret;                    /* return code */
  var hbuf = new utils.Buf8(4);    /* buffer for gzip header crc calculation */
  var opts;

  var n; // temporary var for NEED_BITS

  var order = /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];


  if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
    case HEAD:
      if (state.wrap === 0) {
        state.mode = TYPEDO;
        break;
      }
      //=== NEEDBITS(16);
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
        state.check = 0/*crc32(0L, Z_NULL, 0)*/;
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//

        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = FLAGS;
        break;
      }
      state.flags = 0;           /* expect zlib header */
      if (state.head) {
        state.head.done = false;
      }
      if (!(state.wrap & 1) ||   /* check if zlib header allowed */
        (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
        strm.msg = 'incorrect header check';
        state.mode = BAD;
        break;
      }
      if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
        strm.msg = 'unknown compression method';
        state.mode = BAD;
        break;
      }
      //--- DROPBITS(4) ---//
      hold >>>= 4;
      bits -= 4;
      //---//
      len = (hold & 0x0f)/*BITS(4)*/ + 8;
      if (state.wbits === 0) {
        state.wbits = len;
      }
      else if (len > state.wbits) {
        strm.msg = 'invalid window size';
        state.mode = BAD;
        break;
      }
      state.dmax = 1 << len;
      //Tracev((stderr, "inflate:   zlib header ok\n"));
      strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
      state.mode = hold & 0x200 ? DICTID : TYPE;
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      break;
    case FLAGS:
      //=== NEEDBITS(16); */
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.flags = hold;
      if ((state.flags & 0xff) !== Z_DEFLATED) {
        strm.msg = 'unknown compression method';
        state.mode = BAD;
        break;
      }
      if (state.flags & 0xe000) {
        strm.msg = 'unknown header flags set';
        state.mode = BAD;
        break;
      }
      if (state.head) {
        state.head.text = ((hold >> 8) & 1);
      }
      if (state.flags & 0x0200) {
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = TIME;
      /* falls through */
    case TIME:
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if (state.head) {
        state.head.time = hold;
      }
      if (state.flags & 0x0200) {
        //=== CRC4(state.check, hold)
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        hbuf[2] = (hold >>> 16) & 0xff;
        hbuf[3] = (hold >>> 24) & 0xff;
        state.check = crc32(state.check, hbuf, 4, 0);
        //===
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = OS;
      /* falls through */
    case OS:
      //=== NEEDBITS(16); */
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if (state.head) {
        state.head.xflags = (hold & 0xff);
        state.head.os = (hold >> 8);
      }
      if (state.flags & 0x0200) {
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = EXLEN;
      /* falls through */
    case EXLEN:
      if (state.flags & 0x0400) {
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.length = hold;
        if (state.head) {
          state.head.extra_len = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
      }
      else if (state.head) {
        state.head.extra = null/*Z_NULL*/;
      }
      state.mode = EXTRA;
      /* falls through */
    case EXTRA:
      if (state.flags & 0x0400) {
        copy = state.length;
        if (copy > have) { copy = have; }
        if (copy) {
          if (state.head) {
            len = state.head.extra_len - state.length;
            if (!state.head.extra) {
              // Use untyped array for more conveniend processing later
              state.head.extra = new Array(state.head.extra_len);
            }
            utils.arraySet(
              state.head.extra,
              input,
              next,
              // extra field is limited to 65536 bytes
              // - no need for additional size check
              copy,
              /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
              len
            );
            //zmemcpy(state.head.extra + len, next,
            //        len + copy > state.head.extra_max ?
            //        state.head.extra_max - len : copy);
          }
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          state.length -= copy;
        }
        if (state.length) { break inf_leave; }
      }
      state.length = 0;
      state.mode = NAME;
      /* falls through */
    case NAME:
      if (state.flags & 0x0800) {
        if (have === 0) { break inf_leave; }
        copy = 0;
        do {
          // TODO: 2 or 1 bytes?
          len = input[next + copy++];
          /* use constant limit because in js we should not preallocate memory */
          if (state.head && len &&
              (state.length < 65536 /*state.head.name_max*/)) {
            state.head.name += String.fromCharCode(len);
          }
        } while (len && copy < have);

        if (state.flags & 0x0200) {
          state.check = crc32(state.check, input, copy, next);
        }
        have -= copy;
        next += copy;
        if (len) { break inf_leave; }
      }
      else if (state.head) {
        state.head.name = null;
      }
      state.length = 0;
      state.mode = COMMENT;
      /* falls through */
    case COMMENT:
      if (state.flags & 0x1000) {
        if (have === 0) { break inf_leave; }
        copy = 0;
        do {
          len = input[next + copy++];
          /* use constant limit because in js we should not preallocate memory */
          if (state.head && len &&
              (state.length < 65536 /*state.head.comm_max*/)) {
            state.head.comment += String.fromCharCode(len);
          }
        } while (len && copy < have);
        if (state.flags & 0x0200) {
          state.check = crc32(state.check, input, copy, next);
        }
        have -= copy;
        next += copy;
        if (len) { break inf_leave; }
      }
      else if (state.head) {
        state.head.comment = null;
      }
      state.mode = HCRC;
      /* falls through */
    case HCRC:
      if (state.flags & 0x0200) {
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (hold !== (state.check & 0xffff)) {
          strm.msg = 'header crc mismatch';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
      }
      if (state.head) {
        state.head.hcrc = ((state.flags >> 9) & 1);
        state.head.done = true;
      }
      strm.adler = state.check = 0 /*crc32(0L, Z_NULL, 0)*/;
      state.mode = TYPE;
      break;
    case DICTID:
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      strm.adler = state.check = ZSWAP32(hold);
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = DICT;
      /* falls through */
    case DICT:
      if (state.havedict === 0) {
        //--- RESTORE() ---
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        //---
        return Z_NEED_DICT;
      }
      strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
      state.mode = TYPE;
      /* falls through */
    case TYPE:
      if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case TYPEDO:
      if (state.last) {
        //--- BYTEBITS() ---//
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        state.mode = CHECK;
        break;
      }
      //=== NEEDBITS(3); */
      while (bits < 3) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.last = (hold & 0x01)/*BITS(1)*/;
      //--- DROPBITS(1) ---//
      hold >>>= 1;
      bits -= 1;
      //---//

      switch ((hold & 0x03)/*BITS(2)*/) {
      case 0:                             /* stored block */
        //Tracev((stderr, "inflate:     stored block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = STORED;
        break;
      case 1:                             /* fixed block */
        fixedtables(state);
        //Tracev((stderr, "inflate:     fixed codes block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = LEN_;             /* decode codes */
        if (flush === Z_TREES) {
          //--- DROPBITS(2) ---//
          hold >>>= 2;
          bits -= 2;
          //---//
          break inf_leave;
        }
        break;
      case 2:                             /* dynamic block */
        //Tracev((stderr, "inflate:     dynamic codes block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = TABLE;
        break;
      case 3:
        strm.msg = 'invalid block type';
        state.mode = BAD;
      }
      //--- DROPBITS(2) ---//
      hold >>>= 2;
      bits -= 2;
      //---//
      break;
    case STORED:
      //--- BYTEBITS() ---// /* go to byte boundary */
      hold >>>= bits & 7;
      bits -= bits & 7;
      //---//
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
        strm.msg = 'invalid stored block lengths';
        state.mode = BAD;
        break;
      }
      state.length = hold & 0xffff;
      //Tracev((stderr, "inflate:       stored length %u\n",
      //        state.length));
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = COPY_;
      if (flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case COPY_:
      state.mode = COPY;
      /* falls through */
    case COPY:
      copy = state.length;
      if (copy) {
        if (copy > have) { copy = have; }
        if (copy > left) { copy = left; }
        if (copy === 0) { break inf_leave; }
        //--- zmemcpy(put, next, copy); ---
        utils.arraySet(output, input, next, copy, put);
        //---//
        have -= copy;
        next += copy;
        left -= copy;
        put += copy;
        state.length -= copy;
        break;
      }
      //Tracev((stderr, "inflate:       stored end\n"));
      state.mode = TYPE;
      break;
    case TABLE:
      //=== NEEDBITS(14); */
      while (bits < 14) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
      //--- DROPBITS(5) ---//
      hold >>>= 5;
      bits -= 5;
      //---//
      state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
      //--- DROPBITS(5) ---//
      hold >>>= 5;
      bits -= 5;
      //---//
      state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
      //--- DROPBITS(4) ---//
      hold >>>= 4;
      bits -= 4;
      //---//
//#ifndef PKZIP_BUG_WORKAROUND
      if (state.nlen > 286 || state.ndist > 30) {
        strm.msg = 'too many length or distance symbols';
        state.mode = BAD;
        break;
      }
//#endif
      //Tracev((stderr, "inflate:       table sizes ok\n"));
      state.have = 0;
      state.mode = LENLENS;
      /* falls through */
    case LENLENS:
      while (state.have < state.ncode) {
        //=== NEEDBITS(3);
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
        //--- DROPBITS(3) ---//
        hold >>>= 3;
        bits -= 3;
        //---//
      }
      while (state.have < 19) {
        state.lens[order[state.have++]] = 0;
      }
      // We have separate tables & no pointers. 2 commented lines below not needed.
      //state.next = state.codes;
      //state.lencode = state.next;
      // Switch to use dynamic table
      state.lencode = state.lendyn;
      state.lenbits = 7;

      opts = {bits: state.lenbits};
      ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;

      if (ret) {
        strm.msg = 'invalid code lengths set';
        state.mode = BAD;
        break;
      }
      //Tracev((stderr, "inflate:       code lengths ok\n"));
      state.have = 0;
      state.mode = CODELENS;
      /* falls through */
    case CODELENS:
      while (state.have < state.nlen + state.ndist) {
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_val < 16) {
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.lens[state.have++] = here_val;
        }
        else {
          if (here_val === 16) {
            //=== NEEDBITS(here.bits + 2);
            n = here_bits + 2;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            if (state.have === 0) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            len = state.lens[state.have - 1];
            copy = 3 + (hold & 0x03);//BITS(2);
            //--- DROPBITS(2) ---//
            hold >>>= 2;
            bits -= 2;
            //---//
          }
          else if (here_val === 17) {
            //=== NEEDBITS(here.bits + 3);
            n = here_bits + 3;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            len = 0;
            copy = 3 + (hold & 0x07);//BITS(3);
            //--- DROPBITS(3) ---//
            hold >>>= 3;
            bits -= 3;
            //---//
          }
          else {
            //=== NEEDBITS(here.bits + 7);
            n = here_bits + 7;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            len = 0;
            copy = 11 + (hold & 0x7f);//BITS(7);
            //--- DROPBITS(7) ---//
            hold >>>= 7;
            bits -= 7;
            //---//
          }
          if (state.have + copy > state.nlen + state.ndist) {
            strm.msg = 'invalid bit length repeat';
            state.mode = BAD;
            break;
          }
          while (copy--) {
            state.lens[state.have++] = len;
          }
        }
      }

      /* handle error breaks in while */
      if (state.mode === BAD) { break; }

      /* check for end-of-block code (better have one) */
      if (state.lens[256] === 0) {
        strm.msg = 'invalid code -- missing end-of-block';
        state.mode = BAD;
        break;
      }

      /* build code tables -- note: do not change the lenbits or distbits
         values here (9 and 6) without reading the comments in inftrees.h
         concerning the ENOUGH constants, which depend on those values */
      state.lenbits = 9;

      opts = {bits: state.lenbits};
      ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
      // We have separate tables & no pointers. 2 commented lines below not needed.
      // state.next_index = opts.table_index;
      state.lenbits = opts.bits;
      // state.lencode = state.next;

      if (ret) {
        strm.msg = 'invalid literal/lengths set';
        state.mode = BAD;
        break;
      }

      state.distbits = 6;
      //state.distcode.copy(state.codes);
      // Switch to use dynamic table
      state.distcode = state.distdyn;
      opts = {bits: state.distbits};
      ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
      // We have separate tables & no pointers. 2 commented lines below not needed.
      // state.next_index = opts.table_index;
      state.distbits = opts.bits;
      // state.distcode = state.next;

      if (ret) {
        strm.msg = 'invalid distances set';
        state.mode = BAD;
        break;
      }
      //Tracev((stderr, 'inflate:       codes ok\n'));
      state.mode = LEN_;
      if (flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case LEN_:
      state.mode = LEN;
      /* falls through */
    case LEN:
      if (have >= 6 && left >= 258) {
        //--- RESTORE() ---
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        //---
        inflate_fast(strm, _out);
        //--- LOAD() ---
        put = strm.next_out;
        output = strm.output;
        left = strm.avail_out;
        next = strm.next_in;
        input = strm.input;
        have = strm.avail_in;
        hold = state.hold;
        bits = state.bits;
        //---

        if (state.mode === TYPE) {
          state.back = -1;
        }
        break;
      }
      state.back = 0;
      for (;;) {
        here = state.lencode[hold & ((1 << state.lenbits) -1)];  /*BITS(state.lenbits)*/
        here_bits = here >>> 24;
        here_op = (here >>> 16) & 0xff;
        here_val = here & 0xffff;

        if (here_bits <= bits) { break; }
        //--- PULLBYTE() ---//
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
        //---//
      }
      if (here_op && (here_op & 0xf0) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (;;) {
          here = state.lencode[last_val +
                  ((hold & ((1 << (last_bits + last_op)) -1))/*BITS(last.bits + last.op)*/ >> last_bits)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((last_bits + here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        //--- DROPBITS(last.bits) ---//
        hold >>>= last_bits;
        bits -= last_bits;
        //---//
        state.back += last_bits;
      }
      //--- DROPBITS(here.bits) ---//
      hold >>>= here_bits;
      bits -= here_bits;
      //---//
      state.back += here_bits;
      state.length = here_val;
      if (here_op === 0) {
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        state.mode = LIT;
        break;
      }
      if (here_op & 32) {
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.back = -1;
        state.mode = TYPE;
        break;
      }
      if (here_op & 64) {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break;
      }
      state.extra = here_op & 15;
      state.mode = LENEXT;
      /* falls through */
    case LENEXT:
      if (state.extra) {
        //=== NEEDBITS(state.extra);
        n = state.extra;
        while (bits < n) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.length += hold & ((1 << state.extra) -1)/*BITS(state.extra)*/;
        //--- DROPBITS(state.extra) ---//
        hold >>>= state.extra;
        bits -= state.extra;
        //---//
        state.back += state.extra;
      }
      //Tracevv((stderr, "inflate:         length %u\n", state.length));
      state.was = state.length;
      state.mode = DIST;
      /* falls through */
    case DIST:
      for (;;) {
        here = state.distcode[hold & ((1 << state.distbits) -1)];/*BITS(state.distbits)*/
        here_bits = here >>> 24;
        here_op = (here >>> 16) & 0xff;
        here_val = here & 0xffff;

        if ((here_bits) <= bits) { break; }
        //--- PULLBYTE() ---//
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
        //---//
      }
      if ((here_op & 0xf0) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (;;) {
          here = state.distcode[last_val +
                  ((hold & ((1 << (last_bits + last_op)) -1))/*BITS(last.bits + last.op)*/ >> last_bits)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((last_bits + here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        //--- DROPBITS(last.bits) ---//
        hold >>>= last_bits;
        bits -= last_bits;
        //---//
        state.back += last_bits;
      }
      //--- DROPBITS(here.bits) ---//
      hold >>>= here_bits;
      bits -= here_bits;
      //---//
      state.back += here_bits;
      if (here_op & 64) {
        strm.msg = 'invalid distance code';
        state.mode = BAD;
        break;
      }
      state.offset = here_val;
      state.extra = (here_op) & 15;
      state.mode = DISTEXT;
      /* falls through */
    case DISTEXT:
      if (state.extra) {
        //=== NEEDBITS(state.extra);
        n = state.extra;
        while (bits < n) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.offset += hold & ((1 << state.extra) -1)/*BITS(state.extra)*/;
        //--- DROPBITS(state.extra) ---//
        hold >>>= state.extra;
        bits -= state.extra;
        //---//
        state.back += state.extra;
      }
//#ifdef INFLATE_STRICT
      if (state.offset > state.dmax) {
        strm.msg = 'invalid distance too far back';
        state.mode = BAD;
        break;
      }
//#endif
      //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
      state.mode = MATCH;
      /* falls through */
    case MATCH:
      if (left === 0) { break inf_leave; }
      copy = _out - left;
      if (state.offset > copy) {         /* copy from window */
        copy = state.offset - copy;
        if (copy > state.whave) {
          if (state.sane) {
            strm.msg = 'invalid distance too far back';
            state.mode = BAD;
            break;
          }
// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
        }
        if (copy > state.wnext) {
          copy -= state.wnext;
          from = state.wsize - copy;
        }
        else {
          from = state.wnext - copy;
        }
        if (copy > state.length) { copy = state.length; }
        from_source = state.window;
      }
      else {                              /* copy from output */
        from_source = output;
        from = put - state.offset;
        copy = state.length;
      }
      if (copy > left) { copy = left; }
      left -= copy;
      state.length -= copy;
      do {
        output[put++] = from_source[from++];
      } while (--copy);
      if (state.length === 0) { state.mode = LEN; }
      break;
    case LIT:
      if (left === 0) { break inf_leave; }
      output[put++] = state.length;
      left--;
      state.mode = LEN;
      break;
    case CHECK:
      if (state.wrap) {
        //=== NEEDBITS(32);
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          // Use '|' insdead of '+' to make sure that result is signed
          hold |= input[next++] << bits;
          bits += 8;
        }
        //===//
        _out -= left;
        strm.total_out += _out;
        state.total += _out;
        if (_out) {
          strm.adler = state.check =
              /*UPDATE(state.check, put - _out, _out);*/
              (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

        }
        _out = left;
        // NB: crc32 stored as signed 32-bit int, ZSWAP32 returns signed too
        if ((state.flags ? hold : ZSWAP32(hold)) !== state.check) {
          strm.msg = 'incorrect data check';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        //Tracev((stderr, "inflate:   check matches trailer\n"));
      }
      state.mode = LENGTH;
      /* falls through */
    case LENGTH:
      if (state.wrap && state.flags) {
        //=== NEEDBITS(32);
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (hold !== (state.total & 0xffffffff)) {
          strm.msg = 'incorrect length check';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        //Tracev((stderr, "inflate:   length matches trailer\n"));
      }
      state.mode = DONE;
      /* falls through */
    case DONE:
      ret = Z_STREAM_END;
      break inf_leave;
    case BAD:
      ret = Z_DATA_ERROR;
      break inf_leave;
    case MEM:
      return Z_MEM_ERROR;
    case SYNC:
      /* falls through */
    default:
      return Z_STREAM_ERROR;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}

function inflateEnd(strm) {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
    return Z_STREAM_ERROR;
  }

  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}

function inflateGetHeader(strm, head) {
  var state;

  /* check state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK;
}


exports.inflateReset = inflateReset;
exports.inflateReset2 = inflateReset2;
exports.inflateResetKeep = inflateResetKeep;
exports.inflateInit = inflateInit;
exports.inflateInit2 = inflateInit2;
exports.inflate = inflate;
exports.inflateEnd = inflateEnd;
exports.inflateGetHeader = inflateGetHeader;
exports.inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
exports.inflateCopy = inflateCopy;
exports.inflateGetDictionary = inflateGetDictionary;
exports.inflateMark = inflateMark;
exports.inflatePrime = inflatePrime;
exports.inflateSetDictionary = inflateSetDictionary;
exports.inflateSync = inflateSync;
exports.inflateSyncPoint = inflateSyncPoint;
exports.inflateUndermine = inflateUndermine;
*/

},{"../utils/common":181,"./adler32":183,"./crc32":185,"./inffast":188,"./inftrees":190}],190:[function(require,module,exports){
'use strict';


var utils = require('../utils/common');

var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
];

var lext = [ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
];

var dbase = [ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
];

var dext = [ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
];

module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
{
  var bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  var len = 0;               /* a code's length in bits */
  var sym = 0;               /* index of code symbols */
  var min = 0, max = 0;          /* minimum and maximum code lengths */
  var root = 0;              /* number of index bits for root table */
  var curr = 0;              /* number of index bits for current table */
  var drop = 0;              /* code bits to drop for sub-table */
  var left = 0;                   /* number of prefix codes available */
  var used = 0;              /* code entries in table used */
  var huff = 0;              /* Huffman code */
  var incr;              /* for incrementing code, index */
  var fill;              /* index for replicating entries */
  var low;               /* low bits for current root entry */
  var mask;              /* mask for low root bits */
  var next;             /* next available space in table */
  var base = null;     /* base value table to use */
  var base_index = 0;
//  var shoextra;    /* extra bits table to use */
  var end;                    /* use base and extra for symbol > end */
  var count = new utils.Buf16(MAXBITS+1); //[MAXBITS+1];    /* number of codes of each length */
  var offs = new utils.Buf16(MAXBITS+1); //[MAXBITS+1];     /* offsets in table for each length */
  var extra = null;
  var extra_index = 0;

  var here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES) {
    base = extra = work;    /* dummy value--not used */
    end = 19;

  } else if (type === LENS) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;

  } else {                    /* DISTS */
    base = dbase;
    extra = dext;
    end = -1;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS && used > ENOUGH_LENS) ||
    (type === DISTS && used > ENOUGH_DISTS)) {
    return 1;
  }

  var i=0;
  /* process all codes and make table entries */
  for (;;) {
    i++;
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS && used > ENOUGH_LENS) ||
        (type === DISTS && used > ENOUGH_DISTS)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};

},{"../utils/common":181}],191:[function(require,module,exports){
'use strict';

module.exports = {
  '2':    'need dictionary',     /* Z_NEED_DICT       2  */
  '1':    'stream end',          /* Z_STREAM_END      1  */
  '0':    '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

},{}],192:[function(require,module,exports){
'use strict';


var utils = require('../utils/common');

/* Public constants ==========================================================*/
/* ===========================================================================*/


//var Z_FILTERED          = 1;
//var Z_HUFFMAN_ONLY      = 2;
//var Z_RLE               = 3;
var Z_FIXED               = 4;
//var Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
var Z_BINARY              = 0;
var Z_TEXT                = 1;
//var Z_ASCII             = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;

/*============================================================================*/


function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES    = 2;
/* The three kinds of block type */

var MIN_MATCH    = 3;
var MAX_MATCH    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS      = 256;
/* number of literal bytes 0..255 */

var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES       = 30;
/* number of distance codes */

var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE     = 2*L_CODES + 1;
/* maximum heap size */

var MAX_BITS      = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK   = 256;
/* end of block literal code */

var REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

var extra_lbits =   /* extra bits for each length code */
  [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];

var extra_dbits =   /* extra bits for each distance code */
  [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

var extra_blbits =  /* extra bits for each bit length code */
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];

var bl_order =
  [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array insdead of structure, Freq = i*2, Len = i*2+1
var static_ltree  = new Array((L_CODES+2) * 2);
zero(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

var static_dtree  = new Array(D_CODES * 2);
zero(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

var _dist_code    = new Array(DIST_CODE_LEN);
zero(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

var _length_code  = new Array(MAX_MATCH-MIN_MATCH+1);
zero(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

var base_length   = new Array(LENGTH_CODES);
zero(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

var base_dist     = new Array(D_CODES);
zero(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


var StaticTreeDesc = function (static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
};


var static_l_desc;
var static_d_desc;
var static_bl_desc;


var TreeDesc = function(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
};



function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short (s, w) {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
}


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
function send_bits(s, value, length) {
  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
}


function send_code(s, c, tree) {
  send_bits(s, tree[c*2]/*.Code*/, tree[c*2 + 1]/*.Len*/);
}


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  var tree            = desc.dyn_tree;
  var max_code        = desc.max_code;
  var stree           = desc.stat_desc.static_tree;
  var has_stree       = desc.stat_desc.has_stree;
  var extra           = desc.stat_desc.extra_bits;
  var base            = desc.stat_desc.extra_base;
  var max_length      = desc.stat_desc.max_length;
  var h;              /* heap index */
  var n, m;           /* iterate over the tree elements */
  var bits;           /* bit length */
  var xbits;          /* extra bits */
  var f;              /* frequency */
  var overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max]*2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max+1; h < HEAP_SIZE; h++) {
    n = s.heap[h];
    bits = tree[tree[n*2 +1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n*2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n-base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n*2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length-1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits+1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m*2 + 1]/*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m*2 + 1]/*.Len*/)*tree[m*2]/*.Freq*/;
        tree[m*2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
}


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes(tree, max_code, bl_count)
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  var next_code = new Array(MAX_BITS+1); /* next code value for each bit length */
  var code = 0;              /* running code value */
  var bits;                  /* bit index */
  var n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = (code + bl_count[bits-1]) << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    var len = tree[n*2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n*2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
function tr_static_init() {
  var n;        /* iterates over tree elements */
  var bits;     /* bit counter */
  var length;   /* length value */
  var code;     /* code value */
  var dist;     /* distance index */
  var bl_count = new Array(MAX_BITS+1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES-1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1<<extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length-1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0 ; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1<<extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1<<(extra_dbits[code]-7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n*2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n*2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n*2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n*2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES+1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n*2 + 1]/*.Len*/ = 5;
    static_dtree[n*2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS+1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES, MAX_BITS);
  static_bl_desc =new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES, MAX_BL_BITS);

  //static_init_done = true;
}


/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s) {
  var n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES;  n++) { s.dyn_ltree[n*2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES;  n++) { s.dyn_dtree[n*2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES; n++) { s.bl_tree[n*2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK*2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s)
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s);        /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
//  while (len--) {
//    put_byte(s, *buf++);
//  }
  utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth) {
  var _n2 = n*2;
  var _m2 = m*2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  var v = s.heap[k];
  var j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j+1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
}


// inlined manually
// var SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  var dist;           /* distance of matched string */
  var lc;             /* match length or unmatched char (if dist == 0) */
  var lx = 0;         /* running index in l_buf */
  var code;           /* the code to send */
  var extra;          /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = (s.pending_buf[s.d_buf + lx*2] << 8) | (s.pending_buf[s.d_buf + lx*2 + 1]);
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code+LITERALS+1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");

    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
}


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  var tree     = desc.dyn_tree;
  var stree    = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems    = desc.stat_desc.elems;
  var n, m;          /* iterate over heap elements */
  var max_code = -1; /* largest code with non zero frequency */
  var node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n*2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node*2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n*2 + 1]/*.Dad*/ = tree[m*2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
}


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0*2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code+1)*2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n+1)*2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6*2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10*2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138*2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0*2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n+1)*2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count-3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count-3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count-11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s) {
  var max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES-1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex]*2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3*(max_blindex+1) + 5+5+4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
}


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  var rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes-257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes-1,   5);
  send_bits(s, blcodes-4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank]*2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes-1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes-1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s) {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  var black_mask = 0xf3ffc07f;
  var n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if ((black_mask & 1) && (s.dyn_ltree[n*2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
}


var static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s)
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
}


/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK<<1)+(last ? 1 : 0), 3);    /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
}


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s) {
  send_bits(s, STATIC_TREES<<1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  var opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  var max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len+3+7) >>> 3;
    static_lenb = (s.static_len+3+7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len+4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES<<1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES<<1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code+1, s.d_desc.max_code+1, max_blindex+1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally(s, dist, lc)
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //var out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc*2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc]+LITERALS+1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility

//#ifdef TRUNCATE_BLOCK
//  /* Try to guess if it is profitable to stop the current block here */
//  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
//    /* Compute an upper bound for the compressed length */
//    out_length = s.last_lit*8;
//    in_length = s.strstart - s.block_start;
//
//    for (dcode = 0; dcode < D_CODES; dcode++) {
//      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
//    }
//    out_length >>>= 3;
//    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//    //       s->last_lit, in_length, out_length,
//    //       100L - out_length*100L/in_length));
//    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
//      return true;
//    }
//  }
//#endif

  return (s.last_lit === s.lit_bufsize-1);
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
}

exports._tr_init  = _tr_init;
exports._tr_stored_block = _tr_stored_block;
exports._tr_flush_block  = _tr_flush_block;
exports._tr_tally = _tr_tally;
exports._tr_align = _tr_align;

},{"../utils/common":181}],193:[function(require,module,exports){
'use strict';


function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

module.exports = ZStream;

},{}],194:[function(require,module,exports){
(function (Buffer){
"use strict"

module.exports = parseData

var pako = require("pako"),
    HEADER = new Buffer("89504e470d0a1a0a", "hex")

function ImageData(width, height, channels, data, trailer) {
  this.width    = width;
  this.height   = height;
  this.channels = channels;
  this.data     = data;
  this.trailer  = trailer;
}

function paeth(a, b, c) {
  var p  = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c)

  if((pa <= pb) && (pa <= pc))
    return a

  if(pb <= pc)
    return b

  return c
}

function parseData(dataBuffer) {
  var state             = 0,
      off               = 0,
      buf               = new Buffer(13),
      b                 = -1,
      p                 = 0,
      pngPaletteEntries = 0,
      pngAlphaEntries   = 0,
      chunkLength, pngWidth, pngHeight, pngBitDepth, pngDepthMult,
      pngColorType, pngPixels, pngSamplesPerPixel, pngBytesPerPixel,
      pngBytesPerScanline, pngSamples, currentScanline, priorScanline,
      scanlineFilter, pngTrailer, pngPalette, pngAlpha, idChannels;


  var inflateQueue = []
  function inputData(data) {
    var len = data.length,
        i   = 0,
        tmp, j;

    while(i !== len)
      switch(state) {
        case 0: /* PNG header */
          if(data.readUInt8(i++) !== HEADER[off++])
            return false

          if(off === HEADER.length) {
            state = 1
            off   = 0
          }
          break

        case 1: /* PNG chunk length and type */
          if(len - i < 8 - off) {
            data.copy(buf, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(buf, off, i, i + 8 - off)

            i          += 8 - off
            off         = 0
            chunkLength = buf.readUInt32BE(0)

            switch(buf.toString("ascii", 4, 8)) {
              case "IHDR":
                state = 2
                break

              case "PLTE":
                /* The PNG spec states that PLTE is only required for type 3.
                 * It may appear in other types, but is only useful if the
                 * display does not support true color. Since we're just a data
                 * storage format, we don't have to worry about it. */
                if(pngColorType !== 3)
                  state = 7

                else {
                  if(chunkLength % 3 !== 0)
                    return false

                  pngPaletteEntries = chunkLength / 3
                  pngPalette        = new Buffer(chunkLength)
                  state             = 3
                }
                break

              case "tRNS":
                if(pngColorType !== 3)
                  return false

                /* We only support tRNS on paletted images right now. Those
                 * images may either have 1 or 3 channels, but in either case
                 * we add one for transparency. */
                idChannels       ++

                pngAlphaEntries = chunkLength
                pngAlpha        = new Buffer(chunkLength)
                state           = 4
                break

              case "IDAT":
                /* Allocate the PNG if we havn't yet. (We wait to do it until
                 * here since tRNS may change idChannels, so we can't be sure of
                 * the size needed until we hit IDAT. With all that, might as
                 * well wait until we're actually going to start filling the
                 * buffer in case of errors...) */
                if(!pngPixels)
                  pngPixels = new Uint8Array(pngWidth * pngHeight * idChannels)

                state = 5
                break

              case "IEND":
                state = 6
                break

              default:
                state = 7
                break
            }
          }
          break

        case 2: /* IHDR */
          if(chunkLength !== 13)
            return false

          else if(len - i < chunkLength - off) {
            data.copy(buf, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(buf, off, i, i + chunkLength - off)

            if(buf.readUInt8(10) !== 0)
              return false

            if(buf.readUInt8(11) !== 0)
              return false

            if(buf.readUInt8(12) !== 0)
              return false

            i           += chunkLength - off
            state        = 8
            off          = 0
            pngWidth     = buf.readUInt32BE(0)
            pngHeight    = buf.readUInt32BE(4)
            pngBitDepth  = buf.readUInt8(8)
            pngDepthMult = 255 / ((1 << pngBitDepth) - 1)
            pngColorType = buf.readUInt8(9)

            switch(pngColorType) {
              case 0:
                pngSamplesPerPixel = 1
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.125)
                idChannels         = 1
                break

              case 2:
                pngSamplesPerPixel = 3
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.375)
                idChannels         = 3
                break

              case 3:
                pngSamplesPerPixel = 1
                pngBytesPerPixel   = 1
                idChannels         = 3
                break

              case 4:
                pngSamplesPerPixel = 2
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.250)
                idChannels         = 2
                break

              case 6:
                pngSamplesPerPixel = 4
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.5)
                idChannels         = 4
                break

              default:
                return false
            }

            pngBytesPerScanline = Math.ceil(
              pngWidth * pngBitDepth * pngSamplesPerPixel / 8
            )
            pngSamples          = new Buffer(pngSamplesPerPixel)
            currentScanline     = new Buffer(pngBytesPerScanline)
            priorScanline       = new Buffer(pngBytesPerScanline)
            currentScanline.fill(0)
          }
          break

        case 3: /* PLTE */
          if(len - i < chunkLength - off) {
            data.copy(pngPalette, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(pngPalette, off, i, i + chunkLength - off)
            i    += chunkLength - off
            state = 8
            off   = 0

            /* If each entry in the color palette is grayscale, set the channel
             * count to 1. */
            idChannels = 1;
            for(j = pngPaletteEntries; j--; )
              if(pngPalette[j * 3 + 0] !== pngPalette[j * 3 + 1] ||
                 pngPalette[j * 3 + 0] !== pngPalette[j * 3 + 2]) {
                idChannels = 3;
                break;
              }
          }
          break

        case 4: /* tRNS */
          if(len - i < chunkLength - off) {
            data.copy(pngAlpha, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(pngAlpha, off, i, i + chunkLength - off)
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 5: /* IDAT */
          /* If the amount available is less than the amount remaining, then
           * feed as much as we can to the inflator. */
          if(len - i < chunkLength - off) {
            /* FIXME: Do I need to be smart and check the return value? */
            inflateQueue.push(data.slice(i))
            off += len - i
            i    = len
          }

          /* Otherwise, write the last bit of the data to the inflator, and
           * finish processing the chunk. */
          else {
            /* FIXME: Do I need to be smart and check the return value? */
            inflateQueue.push(data.slice(i, i + chunkLength - off))
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 6: /* IEND */
          if(chunkLength !== 0)
            return false

          else if(len - i < 4 - off) {
            off += len - i
            i    = len
          }

          else {
            pngTrailer = new Buffer(0)
            i         += 4 - off
            state      = 9
            off        = 0
          }
          break

        case 7: /* unrecognized chunk */
          if(len - i < chunkLength - off) {
            off += len - i
            i    = len
          }

          else {
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 8: /* chunk crc */
          /* FIXME: CRC is blatantly ignored */
          if(len - i < 4 - off) {
            off += len - i
            i    = len
          }

          else {
            i    += 4 - off
            state = 1
            off   = 0
          }
          break

        case 9: /* trailing data */
          /* FIXME: It is inefficient to create a trailer buffer of length zero
           * and keep reallocating it every time we want to add more data. */
          tmp = new Buffer(off + len - i)
          pngTrailer.copy(tmp)
          data.copy(tmp, off, i, len)
          pngTrailer = tmp
          off       += len - i
          i          = len
          break
      }

    return true
  }

  //Try parsing header data
  if(!inputData(dataBuffer)) {
    return null
  }

  if(state !== 9) {
    return null
  }

  //Concatenate all inflate buffers
  var inflateBuffer = Buffer.concat(inflateQueue)
  var inflateData = pako.inflate(new Uint8Array(inflateBuffer))

  function unpackPixels(data) {
    var len = data.length,
        i, tmp, x, j, k

    for(i = 0; i !== len; ++i) {
      if(b === -1) {
        scanlineFilter  = data[i]
        tmp             = currentScanline
        currentScanline = priorScanline
        priorScanline   = tmp
      }

      else
        switch(scanlineFilter) {
          case 0:
            currentScanline[b] = data[i]
            break

          case 1:
            currentScanline[b] =
              b < pngBytesPerPixel ?
                data[i] :
                (data[i] + currentScanline[b - pngBytesPerPixel]) & 255
            break

          case 2:
            currentScanline[b] = (data[i] + priorScanline[b]) & 255
            break

          case 3:
            currentScanline[b] = (data[i] + ((
              b < pngBytesPerPixel ?
                priorScanline[b] :
                currentScanline[b - pngBytesPerPixel] + priorScanline[b]
            ) >>> 1)) & 255
            break

          case 4:
            currentScanline[b] = (data[i] + (
              b < pngBytesPerPixel ?
                priorScanline[b] :
                paeth(
                  currentScanline[b - pngBytesPerPixel],
                  priorScanline[b],
                  priorScanline[b - pngBytesPerPixel]
                )
            )) & 255
            break

          default:
            return null
        }

      if(++b === pngBytesPerScanline) {
        /* One scanline too many? */
        if(p === pngPixels.length)
          return null

        /* We have now read a complete scanline, so unfilter it and write it
         * into the pixel array. */
        for(j = 0, x = 0; x !== pngWidth; ++x) {
          /* Read all of the samples into the sample buffer. */
          for(k = 0; k !== pngSamplesPerPixel; ++j, ++k)
            switch(pngBitDepth) {
              case 1:
                pngSamples[k] =
                  (currentScanline[(j >>> 3)] >> (7 - (j & 7))) & 1
                break

              case 2:
                pngSamples[k] =
                  (currentScanline[(j >>> 2)] >> ((3 - (j & 3)) << 1)) & 3
                break

              case 4:
                pngSamples[k] =
                  (currentScanline[(j >>> 1)] >> ((1 - (j & 1)) << 2)) & 15
                break

              case 8:
                pngSamples[k] = currentScanline[j]
                break

              default:
                return null
            }

          /* Write the pixel based off of the samples so collected. */
          switch(pngColorType) {
            case 0:
              pngPixels[p++] = pngSamples[0] * pngDepthMult;
              break;

            case 2:
              pngPixels[p++] = pngSamples[0] * pngDepthMult;
              pngPixels[p++] = pngSamples[1] * pngDepthMult;
              pngPixels[p++] = pngSamples[2] * pngDepthMult;
              break;

            case 3:
              if(pngSamples[0] >= pngPaletteEntries)
                return null

              switch(idChannels) {
                case 1:
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3];
                  break;

                case 2:
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3];
                  pngPixels[p++] =
                    pngSamples[0] < pngAlphaEntries ?
                      pngAlpha[pngSamples[0]] :
                      255;
                  break;

                case 3:
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 0];
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 1];
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 2];
                  break;

                case 4:
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 0];
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 1];
                  pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 2];
                  pngPixels[p++] =
                    pngSamples[0] < pngAlphaEntries ?
                      pngAlpha[pngSamples[0]] :
                      255;
                  break;
              }
              break;

            case 4:
              pngPixels[p++] = pngSamples[0] * pngDepthMult;
              pngPixels[p++] = pngSamples[1] * pngDepthMult;
              break;

            case 6:
              pngPixels[p++] = pngSamples[0] * pngDepthMult;
              pngPixels[p++] = pngSamples[1] * pngDepthMult;
              pngPixels[p++] = pngSamples[2] * pngDepthMult;
              pngPixels[p++] = pngSamples[3] * pngDepthMult;
              break;
          }
        }

        b = -1;
      }
    }
    return true
  }

  if(!unpackPixels(inflateData)) {
    return null
  }

  if(p !== pngPixels.length) {
    return null
  }

  return new ImageData(pngWidth, pngHeight, idChannels, pngPixels, pngTrailer)
}
}).call(this,require("buffer").Buffer)
},{"buffer":211,"pako":178}],195:[function(require,module,exports){
function premultiply(rgba, out) {
	if (!out || typeof out === 'number')
		out = [0,0,0,0]
	out[0] = rgba[0] * rgba[3]
	out[1] = rgba[1] * rgba[3]
	out[2] = rgba[2] * rgba[3]
	out[3] = rgba[3]
	return out
}
module.exports = premultiply
},{}],196:[function(require,module,exports){
/*!
 * repeat-string <https://github.com/jonschlinkert/repeat-string>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

/**
 * Results cache
 */

var res = '';
var cache;

/**
 * Expose `repeat`
 */

module.exports = repeat;

/**
 * Repeat the given `string` the specified `number`
 * of times.
 *
 * **Example:**
 *
 * ```js
 * var repeat = require('repeat-string');
 * repeat('A', 5);
 * //=> AAAAA
 * ```
 *
 * @param {String} `string` The string to repeat
 * @param {Number} `number` The number of times to repeat the string
 * @return {String} Repeated string
 * @api public
 */

function repeat(str, num) {
  if (typeof str !== 'string') {
    throw new TypeError('repeat-string expects a string.');
  }

  // cover common, quick use cases
  if (num === 1) return str;
  if (num === 2) return str + str;

  var max = str.length * num;
  if (cache !== str || typeof cache === 'undefined') {
    cache = str;
    res = '';
  }

  while (max > res.length && num > 0) {
    if (num & 1) {
      res += str;
    }

    num >>= 1;
    if (!num) break;
    str += str;
  }

  return res.substr(0, max);
}


},{}],197:[function(require,module,exports){
var quat = require('gl-quat')
var vec3 = require('gl-vec3')

module.exports = rotateVectorAboutAxis

function rotateVectorAboutAxis(v, axis, angle) {
    var sinHalfAngle = Math.sin(angle / 2.0)
    var cosHalfAngle = Math.cos(angle / 2.0)

    var rX = axis[0] * sinHalfAngle
    var rY = axis[1] * sinHalfAngle
    var rZ = axis[2] * sinHalfAngle
    var rW = cosHalfAngle

    var q = quat.fromValues(rX, rY, rZ, rW)

    // find the conjugate of q.
    var q_conj = quat.create()
    quat.copy(q_conj, q)
    quat.conjugate(q_conj, q_conj)

    var p = quat.fromValues(v[0], v[1], v[2], 0)

    var result = quat.create()

    /*
     Compute the product (q * p * q_conj)
     For more details, please see page 75 in "Real-time rendering - Third edition"
     */
    quat.multiply(result, q, p)
    quat.multiply(result, result, q_conj)

    return vec3.fromValues(result[0], result[1], result[2])

}

},{"gl-quat":75,"gl-vec3":124}],198:[function(require,module,exports){
(function(window) {
    var re = {
        not_string: /[^s]/,
        number: /[diefg]/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijosuxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[\+\-]/
    }

    function sprintf() {
        var key = arguments[0], cache = sprintf.cache
        if (!(cache[key] && cache.hasOwnProperty(key))) {
            cache[key] = sprintf.parse(key)
        }
        return sprintf.format.call(null, cache[key], arguments)
    }

    sprintf.format = function(parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, node_type = "", arg, output = [], i, k, match, pad, pad_character, pad_length, is_positive = true, sign = ""
        for (i = 0; i < tree_length; i++) {
            node_type = get_type(parse_tree[i])
            if (node_type === "string") {
                output[output.length] = parse_tree[i]
            }
            else if (node_type === "array") {
                match = parse_tree[i] // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor]
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw new Error(sprintf("[sprintf] property '%s' does not exist", match[2][k]))
                        }
                        arg = arg[match[2][k]]
                    }
                }
                else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]]
                }
                else { // positional argument (implicit)
                    arg = argv[cursor++]
                }

                if (get_type(arg) == "function") {
                    arg = arg()
                }

                if (re.not_string.test(match[8]) && re.not_json.test(match[8]) && (get_type(arg) != "number" && isNaN(arg))) {
                    throw new TypeError(sprintf("[sprintf] expecting number but found %s", get_type(arg)))
                }

                if (re.number.test(match[8])) {
                    is_positive = arg >= 0
                }

                switch (match[8]) {
                    case "b":
                        arg = arg.toString(2)
                    break
                    case "c":
                        arg = String.fromCharCode(arg)
                    break
                    case "d":
                    case "i":
                        arg = parseInt(arg, 10)
                    break
                    case "j":
                        arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6]) : 0)
                    break
                    case "e":
                        arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential()
                    break
                    case "f":
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg)
                    break
                    case "g":
                        arg = match[7] ? parseFloat(arg).toPrecision(match[7]) : parseFloat(arg)
                    break
                    case "o":
                        arg = arg.toString(8)
                    break
                    case "s":
                        arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg)
                    break
                    case "u":
                        arg = arg >>> 0
                    break
                    case "x":
                        arg = arg.toString(16)
                    break
                    case "X":
                        arg = arg.toString(16).toUpperCase()
                    break
                }
                if (re.json.test(match[8])) {
                    output[output.length] = arg
                }
                else {
                    if (re.number.test(match[8]) && (!is_positive || match[3])) {
                        sign = is_positive ? "+" : "-"
                        arg = arg.toString().replace(re.sign, "")
                    }
                    else {
                        sign = ""
                    }
                    pad_character = match[4] ? match[4] === "0" ? "0" : match[4].charAt(1) : " "
                    pad_length = match[6] - (sign + arg).length
                    pad = match[6] ? (pad_length > 0 ? str_repeat(pad_character, pad_length) : "") : ""
                    output[output.length] = match[5] ? sign + arg + pad : (pad_character === "0" ? sign + pad + arg : pad + sign + arg)
                }
            }
        }
        return output.join("")
    }

    sprintf.cache = {}

    sprintf.parse = function(fmt) {
        var _fmt = fmt, match = [], parse_tree = [], arg_names = 0
        while (_fmt) {
            if ((match = re.text.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = match[0]
            }
            else if ((match = re.modulo.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = "%"
            }
            else if ((match = re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1
                    var field_list = [], replacement_field = match[2], field_match = []
                    if ((field_match = re.key.exec(replacement_field)) !== null) {
                        field_list[field_list.length] = field_match[1]
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== "") {
                            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            }
                            else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            }
                            else {
                                throw new SyntaxError("[sprintf] failed to parse named argument key")
                            }
                        }
                    }
                    else {
                        throw new SyntaxError("[sprintf] failed to parse named argument key")
                    }
                    match[2] = field_list
                }
                else {
                    arg_names |= 2
                }
                if (arg_names === 3) {
                    throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported")
                }
                parse_tree[parse_tree.length] = match
            }
            else {
                throw new SyntaxError("[sprintf] unexpected placeholder")
            }
            _fmt = _fmt.substring(match[0].length)
        }
        return parse_tree
    }

    var vsprintf = function(fmt, argv, _argv) {
        _argv = (argv || []).slice(0)
        _argv.splice(0, 0, fmt)
        return sprintf.apply(null, _argv)
    }

    /**
     * helpers
     */
    function get_type(variable) {
        return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()
    }

    function str_repeat(input, multiplier) {
        return Array(multiplier + 1).join(input)
    }

    /**
     * export to either browser or node.js
     */
    if (typeof exports !== "undefined") {
        exports.sprintf = sprintf
        exports.vsprintf = vsprintf
    }
    else {
        window.sprintf = sprintf
        window.vsprintf = vsprintf

        if (typeof define === "function" && define.amd) {
            define(function() {
                return {
                    sprintf: sprintf,
                    vsprintf: vsprintf
                }
            })
        }
    }
})(typeof window === "undefined" ? this : window);

},{}],199:[function(require,module,exports){
module.exports = function texcoord(position, shape, texShape, out) {
    if (!out)
        out = [0, 0, 1, 1]

    position = position || [0, 0]
    shape = shape || [1, 1]

    texShape = texShape || shape

    var invWidth = 1 / texShape[0]
    var invHeight = 1 / texShape[1]
    var x = position[0],
        y = position[1],
        w = shape[0],
        h = shape[1]

    out[0] = x * invWidth
    out[1] = y * invHeight
    out[2] = (x + w) * invWidth
    out[3] = (y + h) * invHeight
    return out
}
},{}],200:[function(require,module,exports){
(function (global,Buffer){
'use strict'

var bits = require('bit-twiddle')
var dup = require('dup')

//Legacy pool support
if(!global.__TYPEDARRAY_POOL) {
  global.__TYPEDARRAY_POOL = {
      UINT8   : dup([32, 0])
    , UINT16  : dup([32, 0])
    , UINT32  : dup([32, 0])
    , INT8    : dup([32, 0])
    , INT16   : dup([32, 0])
    , INT32   : dup([32, 0])
    , FLOAT   : dup([32, 0])
    , DOUBLE  : dup([32, 0])
    , DATA    : dup([32, 0])
    , UINT8C  : dup([32, 0])
    , BUFFER  : dup([32, 0])
  }
}

var hasUint8C = (typeof Uint8ClampedArray) !== 'undefined'
var POOL = global.__TYPEDARRAY_POOL

//Upgrade pool
if(!POOL.UINT8C) {
  POOL.UINT8C = dup([32, 0])
}
if(!POOL.BUFFER) {
  POOL.BUFFER = dup([32, 0])
}

//New technique: Only allocate from ArrayBufferView and Buffer
var DATA    = POOL.DATA
  , BUFFER  = POOL.BUFFER

exports.free = function free(array) {
  if(Buffer.isBuffer(array)) {
    BUFFER[bits.log2(array.length)].push(array)
  } else {
    if(Object.prototype.toString.call(array) !== '[object ArrayBuffer]') {
      array = array.buffer
    }
    if(!array) {
      return
    }
    var n = array.length || array.byteLength
    var log_n = bits.log2(n)|0
    DATA[log_n].push(array)
  }
}

function freeArrayBuffer(buffer) {
  if(!buffer) {
    return
  }
  var n = buffer.length || buffer.byteLength
  var log_n = bits.log2(n)
  DATA[log_n].push(buffer)
}

function freeTypedArray(array) {
  freeArrayBuffer(array.buffer)
}

exports.freeUint8 =
exports.freeUint16 =
exports.freeUint32 =
exports.freeInt8 =
exports.freeInt16 =
exports.freeInt32 =
exports.freeFloat32 = 
exports.freeFloat =
exports.freeFloat64 = 
exports.freeDouble = 
exports.freeUint8Clamped = 
exports.freeDataView = freeTypedArray

exports.freeArrayBuffer = freeArrayBuffer

exports.freeBuffer = function freeBuffer(array) {
  BUFFER[bits.log2(array.length)].push(array)
}

exports.malloc = function malloc(n, dtype) {
  if(dtype === undefined || dtype === 'arraybuffer') {
    return mallocArrayBuffer(n)
  } else {
    switch(dtype) {
      case 'uint8':
        return mallocUint8(n)
      case 'uint16':
        return mallocUint16(n)
      case 'uint32':
        return mallocUint32(n)
      case 'int8':
        return mallocInt8(n)
      case 'int16':
        return mallocInt16(n)
      case 'int32':
        return mallocInt32(n)
      case 'float':
      case 'float32':
        return mallocFloat(n)
      case 'double':
      case 'float64':
        return mallocDouble(n)
      case 'uint8_clamped':
        return mallocUint8Clamped(n)
      case 'buffer':
        return mallocBuffer(n)
      case 'data':
      case 'dataview':
        return mallocDataView(n)

      default:
        return null
    }
  }
  return null
}

function mallocArrayBuffer(n) {
  var n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var d = DATA[log_n]
  if(d.length > 0) {
    return d.pop()
  }
  return new ArrayBuffer(n)
}
exports.mallocArrayBuffer = mallocArrayBuffer

function mallocUint8(n) {
  return new Uint8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocUint8 = mallocUint8

function mallocUint16(n) {
  return new Uint16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocUint16 = mallocUint16

function mallocUint32(n) {
  return new Uint32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocUint32 = mallocUint32

function mallocInt8(n) {
  return new Int8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocInt8 = mallocInt8

function mallocInt16(n) {
  return new Int16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocInt16 = mallocInt16

function mallocInt32(n) {
  return new Int32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocInt32 = mallocInt32

function mallocFloat(n) {
  return new Float32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocFloat32 = exports.mallocFloat = mallocFloat

function mallocDouble(n) {
  return new Float64Array(mallocArrayBuffer(8*n), 0, n)
}
exports.mallocFloat64 = exports.mallocDouble = mallocDouble

function mallocUint8Clamped(n) {
  if(hasUint8C) {
    return new Uint8ClampedArray(mallocArrayBuffer(n), 0, n)
  } else {
    return mallocUint8(n)
  }
}
exports.mallocUint8Clamped = mallocUint8Clamped

function mallocDataView(n) {
  return new DataView(mallocArrayBuffer(n), 0, n)
}
exports.mallocDataView = mallocDataView

function mallocBuffer(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = BUFFER[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Buffer(n)
}
exports.mallocBuffer = mallocBuffer

exports.clearCache = function clearCache() {
  for(var i=0; i<32; ++i) {
    POOL.UINT8[i].length = 0
    POOL.UINT16[i].length = 0
    POOL.UINT32[i].length = 0
    POOL.INT8[i].length = 0
    POOL.INT16[i].length = 0
    POOL.INT32[i].length = 0
    POOL.FLOAT[i].length = 0
    POOL.DOUBLE[i].length = 0
    POOL.UINT8C[i].length = 0
    DATA[i].length = 0
    BUFFER[i].length = 0
  }
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"bit-twiddle":9,"buffer":211,"dup":18}],201:[function(require,module,exports){
"use strict"

function unique_pred(list, compare) {
  var ptr = 1
    , len = list.length
    , a=list[0], b=list[0]
  for(var i=1; i<len; ++i) {
    b = a
    a = list[i]
    if(compare(a, b)) {
      if(i === ptr) {
        ptr++
        continue
      }
      list[ptr++] = a
    }
  }
  list.length = ptr
  return list
}

function unique_eq(list) {
  var ptr = 1
    , len = list.length
    , a=list[0], b = list[0]
  for(var i=1; i<len; ++i, b=a) {
    b = a
    a = list[i]
    if(a !== b) {
      if(i === ptr) {
        ptr++
        continue
      }
      list[ptr++] = a
    }
  }
  list.length = ptr
  return list
}

function unique(list, compare, sorted) {
  if(list.length === 0) {
    return list
  }
  if(compare) {
    if(!sorted) {
      list.sort(compare)
    }
    return unique_pred(list, compare)
  }
  if(!sorted) {
    list.sort()
  }
  return unique_eq(list)
}

module.exports = unique

},{}],202:[function(require,module,exports){
var ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
  , isOSX = /OS X/.test(ua)
  , isOpera = /Opera/.test(ua)
  , maybeFirefox = !/like Gecko/.test(ua) && !isOpera

var i, output = module.exports = {
  0:  isOSX ? '<menu>' : '<UNK>'
, 1:  '<mouse 1>'
, 2:  '<mouse 2>'
, 3:  '<break>'
, 4:  '<mouse 3>'
, 5:  '<mouse 4>'
, 6:  '<mouse 5>'
, 8:  '<backspace>'
, 9:  '<tab>'
, 12: '<clear>'
, 13: '<enter>'
, 16: '<shift>'
, 17: '<control>'
, 18: '<alt>'
, 19: '<pause>'
, 20: '<caps-lock>'
, 21: '<ime-hangul>'
, 23: '<ime-junja>'
, 24: '<ime-final>'
, 25: '<ime-kanji>'
, 27: '<escape>'
, 28: '<ime-convert>'
, 29: '<ime-nonconvert>'
, 30: '<ime-accept>'
, 31: '<ime-mode-change>'
, 27: '<escape>'
, 32: '<space>'
, 33: '<page-up>'
, 34: '<page-down>'
, 35: '<end>'
, 36: '<home>'
, 37: '<left>'
, 38: '<up>'
, 39: '<right>'
, 40: '<down>'
, 41: '<select>'
, 42: '<print>'
, 43: '<execute>'
, 44: '<snapshot>'
, 45: '<insert>'
, 46: '<delete>'
, 47: '<help>'
, 91: '<meta>'  // meta-left -- no one handles left and right properly, so we coerce into one.
, 92: '<meta>'  // meta-right
, 93: isOSX ? '<meta>' : '<menu>'      // chrome,opera,safari all report this for meta-right (osx mbp).
, 95: '<sleep>'
, 106: '<num-*>'
, 107: '<num-+>'
, 108: '<num-enter>'
, 109: '<num-->'
, 110: '<num-.>'
, 111: '<num-/>'
, 144: '<num-lock>'
, 145: '<scroll-lock>'
, 160: '<shift-left>'
, 161: '<shift-right>'
, 162: '<control-left>'
, 163: '<control-right>'
, 164: '<alt-left>'
, 165: '<alt-right>'
, 166: '<browser-back>'
, 167: '<browser-forward>'
, 168: '<browser-refresh>'
, 169: '<browser-stop>'
, 170: '<browser-search>'
, 171: '<browser-favorites>'
, 172: '<browser-home>'

  // ff/osx reports '<volume-mute>' for '-'
, 173: isOSX && maybeFirefox ? '-' : '<volume-mute>'
, 174: '<volume-down>'
, 175: '<volume-up>'
, 176: '<next-track>'
, 177: '<prev-track>'
, 178: '<stop>'
, 179: '<play-pause>'
, 180: '<launch-mail>'
, 181: '<launch-media-select>'
, 182: '<launch-app 1>'
, 183: '<launch-app 2>'
, 186: ';'
, 187: '='
, 188: ','
, 189: '-'
, 190: '.'
, 191: '/'
, 192: '`'
, 219: '['
, 220: '\\'
, 221: ']'
, 222: "'"
, 223: '<meta>'
, 224: '<meta>'       // firefox reports meta here.
, 226: '<alt-gr>'
, 229: '<ime-process>'
, 231: isOpera ? '`' : '<unicode>'
, 246: '<attention>'
, 247: '<crsel>'
, 248: '<exsel>'
, 249: '<erase-eof>'
, 250: '<play>'
, 251: '<zoom>'
, 252: '<no-name>'
, 253: '<pa-1>'
, 254: '<clear>'
}

for(i = 58; i < 65; ++i) {
  output[i] = String.fromCharCode(i)
}

// 0-9
for(i = 48; i < 58; ++i) {
  output[i] = (i - 48)+''
}

// A-Z
for(i = 65; i < 91; ++i) {
  output[i] = String.fromCharCode(i)
}

// num0-9
for(i = 96; i < 106; ++i) {
  output[i] = '<num-'+(i - 96)+'>'
}

// F1-F24
for(i = 112; i < 136; ++i) {
  output[i] = 'F'+(i-111)
}

},{}],203:[function(require,module,exports){
// Copyright (C) 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Install a leaky WeakMap emulation on platforms that
 * don't provide a built-in one.
 *
 * <p>Assumes that an ES5 platform where, if {@code WeakMap} is
 * already present, then it conforms to the anticipated ES6
 * specification. To run this file on an ES5 or almost ES5
 * implementation where the {@code WeakMap} specification does not
 * quite conform, run <code>repairES5.js</code> first.
 *
 * <p>Even though WeakMapModule is not global, the linter thinks it
 * is, which is why it is in the overrides list below.
 *
 * <p>NOTE: Before using this WeakMap emulation in a non-SES
 * environment, see the note below about hiddenRecord.
 *
 * @author Mark S. Miller
 * @requires crypto, ArrayBuffer, Uint8Array, navigator, console
 * @overrides WeakMap, ses, Proxy
 * @overrides WeakMapModule
 */

/**
 * This {@code WeakMap} emulation is observably equivalent to the
 * ES-Harmony WeakMap, but with leakier garbage collection properties.
 *
 * <p>As with true WeakMaps, in this emulation, a key does not
 * retain maps indexed by that key and (crucially) a map does not
 * retain the keys it indexes. A map by itself also does not retain
 * the values associated with that map.
 *
 * <p>However, the values associated with a key in some map are
 * retained so long as that key is retained and those associations are
 * not overridden. For example, when used to support membranes, all
 * values exported from a given membrane will live for the lifetime
 * they would have had in the absence of an interposed membrane. Even
 * when the membrane is revoked, all objects that would have been
 * reachable in the absence of revocation will still be reachable, as
 * far as the GC can tell, even though they will no longer be relevant
 * to ongoing computation.
 *
 * <p>The API implemented here is approximately the API as implemented
 * in FF6.0a1 and agreed to by MarkM, Andreas Gal, and Dave Herman,
 * rather than the offially approved proposal page. TODO(erights):
 * upgrade the ecmascript WeakMap proposal page to explain this API
 * change and present to EcmaScript committee for their approval.
 *
 * <p>The first difference between the emulation here and that in
 * FF6.0a1 is the presence of non enumerable {@code get___, has___,
 * set___, and delete___} methods on WeakMap instances to represent
 * what would be the hidden internal properties of a primitive
 * implementation. Whereas the FF6.0a1 WeakMap.prototype methods
 * require their {@code this} to be a genuine WeakMap instance (i.e.,
 * an object of {@code [[Class]]} "WeakMap}), since there is nothing
 * unforgeable about the pseudo-internal method names used here,
 * nothing prevents these emulated prototype methods from being
 * applied to non-WeakMaps with pseudo-internal methods of the same
 * names.
 *
 * <p>Another difference is that our emulated {@code
 * WeakMap.prototype} is not itself a WeakMap. A problem with the
 * current FF6.0a1 API is that WeakMap.prototype is itself a WeakMap
 * providing ambient mutability and an ambient communications
 * channel. Thus, if a WeakMap is already present and has this
 * problem, repairES5.js wraps it in a safe wrappper in order to
 * prevent access to this channel. (See
 * PATCH_MUTABLE_FROZEN_WEAKMAP_PROTO in repairES5.js).
 */

/**
 * If this is a full <a href=
 * "http://code.google.com/p/es-lab/wiki/SecureableES5"
 * >secureable ES5</a> platform and the ES-Harmony {@code WeakMap} is
 * absent, install an approximate emulation.
 *
 * <p>If WeakMap is present but cannot store some objects, use our approximate
 * emulation as a wrapper.
 *
 * <p>If this is almost a secureable ES5 platform, then WeakMap.js
 * should be run after repairES5.js.
 *
 * <p>See {@code WeakMap} for documentation of the garbage collection
 * properties of this WeakMap emulation.
 */
(function WeakMapModule() {
  "use strict";

  if (typeof ses !== 'undefined' && ses.ok && !ses.ok()) {
    // already too broken, so give up
    return;
  }

  /**
   * In some cases (current Firefox), we must make a choice betweeen a
   * WeakMap which is capable of using all varieties of host objects as
   * keys and one which is capable of safely using proxies as keys. See
   * comments below about HostWeakMap and DoubleWeakMap for details.
   *
   * This function (which is a global, not exposed to guests) marks a
   * WeakMap as permitted to do what is necessary to index all host
   * objects, at the cost of making it unsafe for proxies.
   *
   * Do not apply this function to anything which is not a genuine
   * fresh WeakMap.
   */
  function weakMapPermitHostObjects(map) {
    // identity of function used as a secret -- good enough and cheap
    if (map.permitHostObjects___) {
      map.permitHostObjects___(weakMapPermitHostObjects);
    }
  }
  if (typeof ses !== 'undefined') {
    ses.weakMapPermitHostObjects = weakMapPermitHostObjects;
  }

  // IE 11 has no Proxy but has a broken WeakMap such that we need to patch
  // it using DoubleWeakMap; this flag tells DoubleWeakMap so.
  var doubleWeakMapCheckSilentFailure = false;

  // Check if there is already a good-enough WeakMap implementation, and if so
  // exit without replacing it.
  if (typeof WeakMap === 'function') {
    var HostWeakMap = WeakMap;
    // There is a WeakMap -- is it good enough?
    if (typeof navigator !== 'undefined' &&
        /Firefox/.test(navigator.userAgent)) {
      // We're now *assuming not*, because as of this writing (2013-05-06)
      // Firefox's WeakMaps have a miscellany of objects they won't accept, and
      // we don't want to make an exhaustive list, and testing for just one
      // will be a problem if that one is fixed alone (as they did for Event).

      // If there is a platform that we *can* reliably test on, here's how to
      // do it:
      //  var problematic = ... ;
      //  var testHostMap = new HostWeakMap();
      //  try {
      //    testHostMap.set(problematic, 1);  // Firefox 20 will throw here
      //    if (testHostMap.get(problematic) === 1) {
      //      return;
      //    }
      //  } catch (e) {}

    } else {
      // IE 11 bug: WeakMaps silently fail to store frozen objects.
      var testMap = new HostWeakMap();
      var testObject = Object.freeze({});
      testMap.set(testObject, 1);
      if (testMap.get(testObject) !== 1) {
        doubleWeakMapCheckSilentFailure = true;
        // Fall through to installing our WeakMap.
      } else {
        module.exports = WeakMap;
        return;
      }
    }
  }

  var hop = Object.prototype.hasOwnProperty;
  var gopn = Object.getOwnPropertyNames;
  var defProp = Object.defineProperty;
  var isExtensible = Object.isExtensible;

  /**
   * Security depends on HIDDEN_NAME being both <i>unguessable</i> and
   * <i>undiscoverable</i> by untrusted code.
   *
   * <p>Given the known weaknesses of Math.random() on existing
   * browsers, it does not generate unguessability we can be confident
   * of.
   *
   * <p>It is the monkey patching logic in this file that is intended
   * to ensure undiscoverability. The basic idea is that there are
   * three fundamental means of discovering properties of an object:
   * The for/in loop, Object.keys(), and Object.getOwnPropertyNames(),
   * as well as some proposed ES6 extensions that appear on our
   * whitelist. The first two only discover enumerable properties, and
   * we only use HIDDEN_NAME to name a non-enumerable property, so the
   * only remaining threat should be getOwnPropertyNames and some
   * proposed ES6 extensions that appear on our whitelist. We monkey
   * patch them to remove HIDDEN_NAME from the list of properties they
   * returns.
   *
   * <p>TODO(erights): On a platform with built-in Proxies, proxies
   * could be used to trap and thereby discover the HIDDEN_NAME, so we
   * need to monkey patch Proxy.create, Proxy.createFunction, etc, in
   * order to wrap the provided handler with the real handler which
   * filters out all traps using HIDDEN_NAME.
   *
   * <p>TODO(erights): Revisit Mike Stay's suggestion that we use an
   * encapsulated function at a not-necessarily-secret name, which
   * uses the Stiegler shared-state rights amplification pattern to
   * reveal the associated value only to the WeakMap in which this key
   * is associated with that value. Since only the key retains the
   * function, the function can also remember the key without causing
   * leakage of the key, so this doesn't violate our general gc
   * goals. In addition, because the name need not be a guarded
   * secret, we could efficiently handle cross-frame frozen keys.
   */
  var HIDDEN_NAME_PREFIX = 'weakmap:';
  var HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'ident:' + Math.random() + '___';

  if (typeof crypto !== 'undefined' &&
      typeof crypto.getRandomValues === 'function' &&
      typeof ArrayBuffer === 'function' &&
      typeof Uint8Array === 'function') {
    var ab = new ArrayBuffer(25);
    var u8s = new Uint8Array(ab);
    crypto.getRandomValues(u8s);
    HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'rand:' +
      Array.prototype.map.call(u8s, function(u8) {
        return (u8 % 36).toString(36);
      }).join('') + '___';
  }

  function isNotHiddenName(name) {
    return !(
        name.substr(0, HIDDEN_NAME_PREFIX.length) == HIDDEN_NAME_PREFIX &&
        name.substr(name.length - 3) === '___');
  }

  /**
   * Monkey patch getOwnPropertyNames to avoid revealing the
   * HIDDEN_NAME.
   *
   * <p>The ES5.1 spec requires each name to appear only once, but as
   * of this writing, this requirement is controversial for ES6, so we
   * made this code robust against this case. If the resulting extra
   * search turns out to be expensive, we can probably relax this once
   * ES6 is adequately supported on all major browsers, iff no browser
   * versions we support at that time have relaxed this constraint
   * without providing built-in ES6 WeakMaps.
   */
  defProp(Object, 'getOwnPropertyNames', {
    value: function fakeGetOwnPropertyNames(obj) {
      return gopn(obj).filter(isNotHiddenName);
    }
  });

  /**
   * getPropertyNames is not in ES5 but it is proposed for ES6 and
   * does appear in our whitelist, so we need to clean it too.
   */
  if ('getPropertyNames' in Object) {
    var originalGetPropertyNames = Object.getPropertyNames;
    defProp(Object, 'getPropertyNames', {
      value: function fakeGetPropertyNames(obj) {
        return originalGetPropertyNames(obj).filter(isNotHiddenName);
      }
    });
  }

  /**
   * <p>To treat objects as identity-keys with reasonable efficiency
   * on ES5 by itself (i.e., without any object-keyed collections), we
   * need to add a hidden property to such key objects when we
   * can. This raises several issues:
   * <ul>
   * <li>Arranging to add this property to objects before we lose the
   *     chance, and
   * <li>Hiding the existence of this new property from most
   *     JavaScript code.
   * <li>Preventing <i>certification theft</i>, where one object is
   *     created falsely claiming to be the key of an association
   *     actually keyed by another object.
   * <li>Preventing <i>value theft</i>, where untrusted code with
   *     access to a key object but not a weak map nevertheless
   *     obtains access to the value associated with that key in that
   *     weak map.
   * </ul>
   * We do so by
   * <ul>
   * <li>Making the name of the hidden property unguessable, so "[]"
   *     indexing, which we cannot intercept, cannot be used to access
   *     a property without knowing the name.
   * <li>Making the hidden property non-enumerable, so we need not
   *     worry about for-in loops or {@code Object.keys},
   * <li>monkey patching those reflective methods that would
   *     prevent extensions, to add this hidden property first,
   * <li>monkey patching those methods that would reveal this
   *     hidden property.
   * </ul>
   * Unfortunately, because of same-origin iframes, we cannot reliably
   * add this hidden property before an object becomes
   * non-extensible. Instead, if we encounter a non-extensible object
   * without a hidden record that we can detect (whether or not it has
   * a hidden record stored under a name secret to us), then we just
   * use the key object itself to represent its identity in a brute
   * force leaky map stored in the weak map, losing all the advantages
   * of weakness for these.
   */
  function getHiddenRecord(key) {
    if (key !== Object(key)) {
      throw new TypeError('Not an object: ' + key);
    }
    var hiddenRecord = key[HIDDEN_NAME];
    if (hiddenRecord && hiddenRecord.key === key) { return hiddenRecord; }
    if (!isExtensible(key)) {
      // Weak map must brute force, as explained in doc-comment above.
      return void 0;
    }

    // The hiddenRecord and the key point directly at each other, via
    // the "key" and HIDDEN_NAME properties respectively. The key
    // field is for quickly verifying that this hidden record is an
    // own property, not a hidden record from up the prototype chain.
    //
    // NOTE: Because this WeakMap emulation is meant only for systems like
    // SES where Object.prototype is frozen without any numeric
    // properties, it is ok to use an object literal for the hiddenRecord.
    // This has two advantages:
    // * It is much faster in a performance critical place
    // * It avoids relying on Object.create(null), which had been
    //   problematic on Chrome 28.0.1480.0. See
    //   https://code.google.com/p/google-caja/issues/detail?id=1687
    hiddenRecord = { key: key };

    // When using this WeakMap emulation on platforms where
    // Object.prototype might not be frozen and Object.create(null) is
    // reliable, use the following two commented out lines instead.
    // hiddenRecord = Object.create(null);
    // hiddenRecord.key = key;

    // Please contact us if you need this to work on platforms where
    // Object.prototype might not be frozen and
    // Object.create(null) might not be reliable.

    try {
      defProp(key, HIDDEN_NAME, {
        value: hiddenRecord,
        writable: false,
        enumerable: false,
        configurable: false
      });
      return hiddenRecord;
    } catch (error) {
      // Under some circumstances, isExtensible seems to misreport whether
      // the HIDDEN_NAME can be defined.
      // The circumstances have not been isolated, but at least affect
      // Node.js v0.10.26 on TravisCI / Linux, but not the same version of
      // Node.js on OS X.
      return void 0;
    }
  }

  /**
   * Monkey patch operations that would make their argument
   * non-extensible.
   *
   * <p>The monkey patched versions throw a TypeError if their
   * argument is not an object, so it should only be done to functions
   * that should throw a TypeError anyway if their argument is not an
   * object.
   */
  (function(){
    var oldFreeze = Object.freeze;
    defProp(Object, 'freeze', {
      value: function identifyingFreeze(obj) {
        getHiddenRecord(obj);
        return oldFreeze(obj);
      }
    });
    var oldSeal = Object.seal;
    defProp(Object, 'seal', {
      value: function identifyingSeal(obj) {
        getHiddenRecord(obj);
        return oldSeal(obj);
      }
    });
    var oldPreventExtensions = Object.preventExtensions;
    defProp(Object, 'preventExtensions', {
      value: function identifyingPreventExtensions(obj) {
        getHiddenRecord(obj);
        return oldPreventExtensions(obj);
      }
    });
  })();

  function constFunc(func) {
    func.prototype = null;
    return Object.freeze(func);
  }

  var calledAsFunctionWarningDone = false;
  function calledAsFunctionWarning() {
    // Future ES6 WeakMap is currently (2013-09-10) expected to reject WeakMap()
    // but we used to permit it and do it ourselves, so warn only.
    if (!calledAsFunctionWarningDone && typeof console !== 'undefined') {
      calledAsFunctionWarningDone = true;
      console.warn('WeakMap should be invoked as new WeakMap(), not ' +
          'WeakMap(). This will be an error in the future.');
    }
  }

  var nextId = 0;

  var OurWeakMap = function() {
    if (!(this instanceof OurWeakMap)) {  // approximate test for new ...()
      calledAsFunctionWarning();
    }

    // We are currently (12/25/2012) never encountering any prematurely
    // non-extensible keys.
    var keys = []; // brute force for prematurely non-extensible keys.
    var values = []; // brute force for corresponding values.
    var id = nextId++;

    function get___(key, opt_default) {
      var index;
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        return id in hiddenRecord ? hiddenRecord[id] : opt_default;
      } else {
        index = keys.indexOf(key);
        return index >= 0 ? values[index] : opt_default;
      }
    }

    function has___(key) {
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        return id in hiddenRecord;
      } else {
        return keys.indexOf(key) >= 0;
      }
    }

    function set___(key, value) {
      var index;
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        hiddenRecord[id] = value;
      } else {
        index = keys.indexOf(key);
        if (index >= 0) {
          values[index] = value;
        } else {
          // Since some browsers preemptively terminate slow turns but
          // then continue computing with presumably corrupted heap
          // state, we here defensively get keys.length first and then
          // use it to update both the values and keys arrays, keeping
          // them in sync.
          index = keys.length;
          values[index] = value;
          // If we crash here, values will be one longer than keys.
          keys[index] = key;
        }
      }
      return this;
    }

    function delete___(key) {
      var hiddenRecord = getHiddenRecord(key);
      var index, lastIndex;
      if (hiddenRecord) {
        return id in hiddenRecord && delete hiddenRecord[id];
      } else {
        index = keys.indexOf(key);
        if (index < 0) {
          return false;
        }
        // Since some browsers preemptively terminate slow turns but
        // then continue computing with potentially corrupted heap
        // state, we here defensively get keys.length first and then use
        // it to update both the keys and the values array, keeping
        // them in sync. We update the two with an order of assignments,
        // such that any prefix of these assignments will preserve the
        // key/value correspondence, either before or after the delete.
        // Note that this needs to work correctly when index === lastIndex.
        lastIndex = keys.length - 1;
        keys[index] = void 0;
        // If we crash here, there's a void 0 in the keys array, but
        // no operation will cause a "keys.indexOf(void 0)", since
        // getHiddenRecord(void 0) will always throw an error first.
        values[index] = values[lastIndex];
        // If we crash here, values[index] cannot be found here,
        // because keys[index] is void 0.
        keys[index] = keys[lastIndex];
        // If index === lastIndex and we crash here, then keys[index]
        // is still void 0, since the aliasing killed the previous key.
        keys.length = lastIndex;
        // If we crash here, keys will be one shorter than values.
        values.length = lastIndex;
        return true;
      }
    }

    return Object.create(OurWeakMap.prototype, {
      get___:    { value: constFunc(get___) },
      has___:    { value: constFunc(has___) },
      set___:    { value: constFunc(set___) },
      delete___: { value: constFunc(delete___) }
    });
  };

  OurWeakMap.prototype = Object.create(Object.prototype, {
    get: {
      /**
       * Return the value most recently associated with key, or
       * opt_default if none.
       */
      value: function get(key, opt_default) {
        return this.get___(key, opt_default);
      },
      writable: true,
      configurable: true
    },

    has: {
      /**
       * Is there a value associated with key in this WeakMap?
       */
      value: function has(key) {
        return this.has___(key);
      },
      writable: true,
      configurable: true
    },

    set: {
      /**
       * Associate value with key in this WeakMap, overwriting any
       * previous association if present.
       */
      value: function set(key, value) {
        return this.set___(key, value);
      },
      writable: true,
      configurable: true
    },

    'delete': {
      /**
       * Remove any association for key in this WeakMap, returning
       * whether there was one.
       *
       * <p>Note that the boolean return here does not work like the
       * {@code delete} operator. The {@code delete} operator returns
       * whether the deletion succeeds at bringing about a state in
       * which the deleted property is absent. The {@code delete}
       * operator therefore returns true if the property was already
       * absent, whereas this {@code delete} method returns false if
       * the association was already absent.
       */
      value: function remove(key) {
        return this.delete___(key);
      },
      writable: true,
      configurable: true
    }
  });

  if (typeof HostWeakMap === 'function') {
    (function() {
      // If we got here, then the platform has a WeakMap but we are concerned
      // that it may refuse to store some key types. Therefore, make a map
      // implementation which makes use of both as possible.

      // In this mode we are always using double maps, so we are not proxy-safe.
      // This combination does not occur in any known browser, but we had best
      // be safe.
      if (doubleWeakMapCheckSilentFailure && typeof Proxy !== 'undefined') {
        Proxy = undefined;
      }

      function DoubleWeakMap() {
        if (!(this instanceof OurWeakMap)) {  // approximate test for new ...()
          calledAsFunctionWarning();
        }

        // Preferable, truly weak map.
        var hmap = new HostWeakMap();

        // Our hidden-property-based pseudo-weak-map. Lazily initialized in the
        // 'set' implementation; thus we can avoid performing extra lookups if
        // we know all entries actually stored are entered in 'hmap'.
        var omap = undefined;

        // Hidden-property maps are not compatible with proxies because proxies
        // can observe the hidden name and either accidentally expose it or fail
        // to allow the hidden property to be set. Therefore, we do not allow
        // arbitrary WeakMaps to switch to using hidden properties, but only
        // those which need the ability, and unprivileged code is not allowed
        // to set the flag.
        //
        // (Except in doubleWeakMapCheckSilentFailure mode in which case we
        // disable proxies.)
        var enableSwitching = false;

        function dget(key, opt_default) {
          if (omap) {
            return hmap.has(key) ? hmap.get(key)
                : omap.get___(key, opt_default);
          } else {
            return hmap.get(key, opt_default);
          }
        }

        function dhas(key) {
          return hmap.has(key) || (omap ? omap.has___(key) : false);
        }

        var dset;
        if (doubleWeakMapCheckSilentFailure) {
          dset = function(key, value) {
            hmap.set(key, value);
            if (!hmap.has(key)) {
              if (!omap) { omap = new OurWeakMap(); }
              omap.set(key, value);
            }
            return this;
          };
        } else {
          dset = function(key, value) {
            if (enableSwitching) {
              try {
                hmap.set(key, value);
              } catch (e) {
                if (!omap) { omap = new OurWeakMap(); }
                omap.set___(key, value);
              }
            } else {
              hmap.set(key, value);
            }
            return this;
          };
        }

        function ddelete(key) {
          var result = !!hmap['delete'](key);
          if (omap) { return omap.delete___(key) || result; }
          return result;
        }

        return Object.create(OurWeakMap.prototype, {
          get___:    { value: constFunc(dget) },
          has___:    { value: constFunc(dhas) },
          set___:    { value: constFunc(dset) },
          delete___: { value: constFunc(ddelete) },
          permitHostObjects___: { value: constFunc(function(token) {
            if (token === weakMapPermitHostObjects) {
              enableSwitching = true;
            } else {
              throw new Error('bogus call to permitHostObjects___');
            }
          })}
        });
      }
      DoubleWeakMap.prototype = OurWeakMap.prototype;
      module.exports = DoubleWeakMap;

      // define .constructor to hide OurWeakMap ctor
      Object.defineProperty(WeakMap.prototype, 'constructor', {
        value: WeakMap,
        enumerable: false,  // as default .constructor is
        configurable: true,
        writable: true
      });
    })();
  } else {
    // There is no host WeakMap, so we must use the emulation.

    // Emulated WeakMaps are incompatible with native proxies (because proxies
    // can observe the hidden name), so we must disable Proxy usage (in
    // ArrayLike and Domado, currently).
    if (typeof Proxy !== 'undefined') {
      Proxy = undefined;
    }

    module.exports = OurWeakMap;
  }
})();

},{}],204:[function(require,module,exports){
var hiddenStore = require('./hidden-store.js');

module.exports = createStore;

function createStore() {
    var key = {};

    return function (obj) {
        if ((typeof obj !== 'object' || obj === null) &&
            typeof obj !== 'function'
        ) {
            throw new Error('Weakmap-shim: Key must be object')
        }

        var store = obj.valueOf(key);
        return store && store.identity === key ?
            store : hiddenStore(obj, key);
    };
}

},{"./hidden-store.js":205}],205:[function(require,module,exports){
module.exports = hiddenStore;

function hiddenStore(obj, key) {
    var store = { identity: key };
    var valueOf = obj.valueOf;

    Object.defineProperty(obj, "valueOf", {
        value: function (value) {
            return value !== key ?
                valueOf.apply(this, arguments) : store;
        },
        writable: true
    });

    return store;
}

},{}],206:[function(require,module,exports){
// Original - @Gozola. 
// https://gist.github.com/Gozala/1269991
// This is a reimplemented version (with a few bug fixes).

var createStore = require('./create-store.js');

module.exports = weakMap;

function weakMap() {
    var privates = createStore();

    return {
        'get': function (key, fallback) {
            var store = privates(key)
            return store.hasOwnProperty('value') ?
                store.value : fallback
        },
        'set': function (key, value) {
            privates(key).value = value;
        },
        'has': function(key) {
            return 'value' in privates(key);
        },
        'delete': function (key) {
            return delete privates(key).value;
        }
    }
}

},{"./create-store.js":204}],207:[function(require,module,exports){
'use strict'

var weakMap = typeof WeakMap === 'undefined' ? require('weak-map') : WeakMap

var WebGLEWStruct = new weakMap()

function baseName(ext_name) {
  return ext_name.replace(/^[A-Z]+_/, '')
}

function initWebGLEW(gl) {
  var struct = WebGLEWStruct.get(gl)
  if(struct) {
    return struct
  }
  var extensions = {}
  var supported = gl.getSupportedExtensions()
  for(var i=0; i<supported.length; ++i) {
    var extName = supported[i]

    //Skip MOZ_ extensions
    if(extName.indexOf('MOZ_') === 0) {
      continue
    }
    var ext = gl.getExtension(supported[i])
    if(!ext) {
      continue
    }
    while(true) {
      extensions[extName] = ext
      var base = baseName(extName)
      if(base === extName) {
        break
      }
      extName = base
    }
  }
  WebGLEWStruct.set(gl, extensions)
  return extensions
}
module.exports = initWebGLEW
},{"weak-map":203}],208:[function(require,module,exports){
var newline = /\n/
var newlineChar = '\n'
var whitespace = /\s/

module.exports = function(text, opt) {
    var lines = module.exports.lines(text, opt)
    return lines.map(function(line) {
        return text.substring(line.start, line.end)
    }).join('\n')
}

module.exports.lines = function wordwrap(text, opt) {
    opt = opt||{}

    //zero width results in nothing visible
    if (opt.width === 0 && opt.mode !== 'nowrap') 
        return []

    text = text||''
    var width = typeof opt.width === 'number' ? opt.width : Number.MAX_VALUE
    var start = Math.max(0, opt.start||0)
    var end = typeof opt.end === 'number' ? opt.end : text.length
    var mode = opt.mode

    var measure = opt.measure || monospace
    if (mode === 'pre')
        return pre(measure, text, start, end, width)
    else
        return greedy(measure, text, start, end, width, mode)
}

function idxOf(text, chr, start, end) {
    var idx = text.indexOf(chr, start)
    if (idx === -1 || idx > end)
        return end
    return idx
}

function isWhitespace(chr) {
    return whitespace.test(chr)
}

function pre(measure, text, start, end, width) {
    var lines = []
    var lineStart = start
    for (var i=start; i<end && i<text.length; i++) {
        var chr = text.charAt(i)
        var isNewline = newline.test(chr)

        //If we've reached a newline, then step down a line
        //Or if we've reached the EOF
        if (isNewline || i===end-1) {
            var lineEnd = isNewline ? i : i+1
            var measured = measure(text, lineStart, lineEnd, width)
            lines.push(measured)
            
            lineStart = i+1
        }
    }
    return lines
}

function greedy(measure, text, start, end, width, mode) {
    //A greedy word wrapper based on LibGDX algorithm
    //https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/BitmapFontCache.java
    var lines = []

    var testWidth = width
    //if 'nowrap' is specified, we only wrap on newline chars
    if (mode === 'nowrap')
        testWidth = Number.MAX_VALUE

    while (start < end && start < text.length) {
        //get next newline position
        var newLine = idxOf(text, newlineChar, start, end)

        //eat whitespace at start of line
        while (start < newLine) {
            if (!isWhitespace( text.charAt(start) ))
                break
            start++
        }

        //determine visible # of glyphs for the available width
        var measured = measure(text, start, newLine, testWidth)

        var lineEnd = start + (measured.end-measured.start)
        var nextStart = lineEnd + newlineChar.length

        //if we had to cut the line before the next newline...
        if (lineEnd < newLine) {
            //find char to break on
            while (lineEnd > start) {
                if (isWhitespace(text.charAt(lineEnd)))
                    break
                lineEnd--
            }
            if (lineEnd === start) {
                if (nextStart > start + newlineChar.length) nextStart--
                lineEnd = nextStart // If no characters to break, show all.
            } else {
                nextStart = lineEnd
                //eat whitespace at end of line
                while (lineEnd > start) {
                    if (!isWhitespace(text.charAt(lineEnd - newlineChar.length)))
                        break
                    lineEnd--
                }
            }
        }
        if (lineEnd >= start) {
            var result = measure(text, start, lineEnd, testWidth)
            lines.push(result)
        }
        start = nextStart
    }
    return lines
}

//determines the visible number of glyphs within a given width
function monospace(text, start, end, width) {
    var glyphs = Math.min(width, end-start)
    return {
        start: start,
        end: start+glyphs
    }
}
},{}],209:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],210:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],211:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":210,"ieee754":214,"isarray":212}],212:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],213:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],214:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],215:[function(require,module,exports){
arguments[4][166][0].apply(exports,arguments)
},{"dup":166}],216:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],217:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],218:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":217,"_process":216,"inherits":215}]},{},[1]);
