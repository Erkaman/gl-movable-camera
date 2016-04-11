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
