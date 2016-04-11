'use strict'

/* global requestAnimationFrame */

var shell = require("gl-now")()
var mat4 =require("gl-mat4")
var Geometry = require('gl-geometry')
var normals = require('normals')
var glShader = require('gl-shader')
var bunny = require('bunny')
var glslify = require('glslify')
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