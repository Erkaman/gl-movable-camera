# gl-movable-camera

A camera that can easily be moved and turned.

The camera is defined by the three vectors

* `up`, which is always the vector `(0,1,0)`
* `viewDir`, the viewing direction, which can be controlled through the API.
* `right`, which is the cross product of `up` and `viewdir`


[![NPM](https://nodei.co/npm/gl-movable-camera.png)](https://www.npmjs.com/package/gl-movable-camera)

## Demo

A demo is provided:
http://erkaman.github.io/gl-movable-camera/

The camera in the demo is controlled as follows:

* Keys `W` and `S` are used to walk forward and backward.
* Keys `A` and `D` are used to stride left and right.
* Keys `O` and `L` are used to fly up and down.
* Hold down the key `M` to speed up the camera.
* Hold down the left mouse button and move the mouse to turn the camera.

## Install

```sh
npm install gl-movable-camera
```

## API

```js
var createMovableCamera = require('gl-movable-camera')
```

### Constructor

#### `var camera = createMovableCamera([opts])`

Creates a movable camera. The optional arguments are

* `opts.position` Initial position of the camera
* `opts.viewDir` Initial viewing direciton of the camera.

### Methods

#### `camera.view(view)`

Yields the view matrix of the camera.


#### `camera.turn (head, pitch)`

Rotates the viewing direction  `head` radians around `up`, and
rotates the viewing direction `pitch` radians around `right`.

### `camera.walk(walkForward)`

If `walkForward` is `true`, walk `velocity` units in the direction of
`viewDir`. Else, walk backward.

### `camera.stride(strideRight)`

If `strideRight` is `true`, stride `velocity` units in the direction of
`right`. Else, stride in the opposite direciton.

### `camera.fly(flyUp)`

If `flyUp` is `true`, fly `velocity` units in the direction of
`up`. Else, fly down in the opposite direciton.

### `camera.velocity`

By setting this variable, you can control the movement speed of the camera.

### `camera.turning`

By setting this variable, you can control the turning velocity of the camera.









