/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2013 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Untiangle input field.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.FieldUntiangle');

goog.require('Blockly.DropDownDiv');
goog.require('Blockly.FieldTextInput');
goog.require('goog.math');
goog.require('goog.userAgent');


/**
 * Class for an editable angle field.
 * @param {(string|number)=} opt_value The initial content of the field. The
 *     value should cast to a number, and if it does not, '0' will be used.
 * @param {Function=} opt_validator An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns the accepted text or null to abort
 *     the change.
 * @extends {Blockly.FieldTextInput}
 * @constructor
 */
Blockly.FieldUntiangle = function(opt_value, opt_validator) {
  // Add degree symbol: '360°' (LTR) or '°360' (RTL)
  this.symbol_ = Blockly.utils.createSvgElement('tspan', {}, null);
  this.symbol_.appendChild(document.createTextNode('\u00B0'));
  
  var numRestrictor = new RegExp("[\\d]|[\\.]|[-]|[eE]");

  opt_value = (opt_value && !isNaN(opt_value)) ? String(opt_value) : '0';
  Blockly.FieldUntiangle.superClass_.constructor.call(
      this, opt_value, opt_validator, numRestrictor);
  this.addArgType('untiangle');
};
goog.inherits(Blockly.FieldUntiangle, Blockly.FieldTextInput);

/**
 * Construct a FieldUntiangle from a JSON arg object.
 * @param {!Object} options A JSON object with options (angle).
 * @returns {!Blockly.FieldUntiangle} The new field instance.
 * @package
 * @nocollapse
 */
Blockly.FieldUntiangle.fromJson = function(options) {
  return new Blockly.FieldUntiangle(options['untiangle']);
};

/**
 * Round angles to the nearest 15 degrees when using mouse.
 * Set to 0 to disable rounding.
 */
Blockly.FieldUntiangle.ROUND = 15;

/**
 * Half the width of protractor image.
 */
Blockly.FieldUntiangle.HALF = 120 / 2;

/* The following two settings work together to set the behaviour of the angle
 * picker.  While many combinations are possible, two modes are typical:
 * Math mode.
 *   0 deg is right, 90 is up.  This is the style used by protractors.
 *   Blockly.FieldUntiangle.CLOCKWISE = false;
 *   Blockly.FieldUntiangle.OFFSET = 0;
 * Compass mode.
 *   0 deg is up, 90 is right.  This is the style used by maps.
 *   Blockly.FieldUntiangle.CLOCKWISE = true;
 *   Blockly.FieldUntiangle.OFFSET = 90;
 */

/**
 * Untiangle increases clockwise (true) or counterclockwise (false).
 */
Blockly.FieldUntiangle.CLOCKWISE = false;

/**
 * Offset the location of 0 degrees (and all angles) by a constant.
 * Usually either 0 (0 = right) or 90 (0 = up).
 */
Blockly.FieldUntiangle.OFFSET = 90;

/**
 * Maximum allowed angle before wrapping.
 * Usually either 360 (for 0 to 359.9) or 180 (for -179.9 to 180).
 */
Blockly.FieldUntiangle.WRAP = 180;

/**
 * Radius of drag handle
 */
Blockly.FieldUntiangle.HANDLE_RADIUS = 10;

/**
 * Width of drag handle arrow
 */
Blockly.FieldUntiangle.ARROW_WIDTH = Blockly.FieldUntiangle.HANDLE_RADIUS;

/**
 * Half the stroke-width used for the "glow" around the drag handle, rounded up to nearest whole pixel
 */

Blockly.FieldUntiangle.HANDLE_GLOW_WIDTH = 3;

/**
 * Radius of protractor circle.  Slightly smaller than protractor size since
 * otherwise SVG crops off half the border at the edges.
 */
Blockly.FieldUntiangle.RADIUS = Blockly.FieldUntiangle.HALF
    - Blockly.FieldUntiangle.HANDLE_RADIUS - Blockly.FieldUntiangle.HANDLE_GLOW_WIDTH;

/**
 * Radius of central dot circle.
 */
Blockly.FieldUntiangle.CENTER_RADIUS = 2;

/**
 * Path to the arrow svg icon.
 */
Blockly.FieldUntiangle.ARROW_SVG_PATH = 'icons/arrow.svg';

/**
 * Clean up this FieldUntiangle, as well as the inherited FieldTextInput.
 * @return {!Function} Closure to call on destruction of the WidgetDiv.
 * @private
 */
Blockly.FieldUntiangle.prototype.dispose_ = function() {
  var thisField = this;
  return function() {
    Blockly.FieldUntiangle.superClass_.dispose_.call(thisField)();
    thisField.gauge_ = null;
    if (thisField.mouseDownWrapper_) {
      Blockly.unbindEvent_(thisField.mouseDownWrapper_);
    }
    if (thisField.mouseUpWrapper_) {
      Blockly.unbindEvent_(thisField.mouseUpWrapper_);
    }
    if (thisField.mouseMoveWrapper_) {
      Blockly.unbindEvent_(thisField.mouseMoveWrapper_);
    }
  };
};

/**
 * Show the inline free-text editor on top of the text.
 * @private
 */
Blockly.FieldUntiangle.prototype.showEditor_ = function() {
  var noFocus =
      goog.userAgent.MOBILE || goog.userAgent.ANDROID || goog.userAgent.IPAD;
  // Mobile browsers have issues with in-line textareas (focus & keyboards).
  Blockly.FieldUntiangle.superClass_.showEditor_.call(this, noFocus);
  // If there is an existing drop-down someone else owns, hide it immediately and clear it.
  Blockly.DropDownDiv.hideWithoutAnimation();
  Blockly.DropDownDiv.clearContent();
  var div = Blockly.DropDownDiv.getContentDiv();
  // Build the SVG DOM.
  var svg = Blockly.utils.createSvgElement('svg', {
    'xmlns': 'http://www.w3.org/2000/svg',
    'xmlns:html': 'http://www.w3.org/1999/xhtml',
    'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    'version': '1.1',
    'height': (Blockly.FieldUntiangle.HALF * 2) + 'px',
    'width': (Blockly.FieldUntiangle.HALF * 2) + 'px'
  }, div);
  Blockly.utils.createSvgElement('circle', {
    'cx': Blockly.FieldUntiangle.HALF, 'cy': Blockly.FieldUntiangle.HALF,
    'r': Blockly.FieldUntiangle.RADIUS,
    'class': 'blocklyUntiangleCircle'
  }, svg);
  this.gauge_ = Blockly.utils.createSvgElement('path',
      {'class': 'blocklyUntiangleGauge'}, svg);
  // The moving line, x2 and y2 are set in updateGraph_
  this.line_ = Blockly.utils.createSvgElement('line',{
    'x1': Blockly.FieldUntiangle.HALF,
    'y1': Blockly.FieldUntiangle.HALF,
    'class': 'blocklyUntiangleLine'
  }, svg);
  // The fixed vertical line at the offset
  var offsetRadians = Math.PI * Blockly.FieldUntiangle.OFFSET / 180;
  Blockly.utils.createSvgElement('line', {
    'x1': Blockly.FieldUntiangle.HALF,
    'y1': Blockly.FieldUntiangle.HALF,
    'x2': Blockly.FieldUntiangle.HALF + Blockly.FieldUntiangle.RADIUS * Math.cos(offsetRadians),
    'y2': Blockly.FieldUntiangle.HALF - Blockly.FieldUntiangle.RADIUS * Math.sin(offsetRadians),
    'class': 'blocklyUntiangleLine'
  }, svg);
  // Draw markers around the edge.
  for (var angle = 0; angle < 360; angle += 15) {
    Blockly.utils.createSvgElement('line', {
      'x1': Blockly.FieldUntiangle.HALF + Blockly.FieldUntiangle.RADIUS - 13,
      'y1': Blockly.FieldUntiangle.HALF,
      'x2': Blockly.FieldUntiangle.HALF + Blockly.FieldUntiangle.RADIUS - 7,
      'y2': Blockly.FieldUntiangle.HALF,
      'class': 'blocklyUntiangleMarks',
      'transform': 'rotate(' + angle + ',' +
          Blockly.FieldUntiangle.HALF + ',' + Blockly.FieldUntiangle.HALF + ')'
    }, svg);
  }
  // Center point
  Blockly.utils.createSvgElement('circle', {
    'cx': Blockly.FieldUntiangle.HALF, 'cy': Blockly.FieldUntiangle.HALF,
    'r': Blockly.FieldUntiangle.CENTER_RADIUS,
    'class': 'blocklyUntiangleCenterPoint'
  }, svg);
  // Handle group: a circle and the arrow image
  this.handle_ = Blockly.utils.createSvgElement('g', {}, svg);
  Blockly.utils.createSvgElement('circle', {
    'cx': 0,
    'cy': 0,
    'r': Blockly.FieldUntiangle.HANDLE_RADIUS,
    'class': 'blocklyUntiangleDragHandle'
  }, this.handle_);
  this.arrowSvg_ = Blockly.utils.createSvgElement('image',
      {
        'width': Blockly.FieldUntiangle.ARROW_WIDTH,
        'height': Blockly.FieldUntiangle.ARROW_WIDTH,
        'x': -Blockly.FieldUntiangle.ARROW_WIDTH / 2,
        'y': -Blockly.FieldUntiangle.ARROW_WIDTH / 2,
        'class': 'blocklyUntiangleDragArrow'
      },
      this.handle_);
  this.arrowSvg_.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      Blockly.mainWorkspace.options.pathToMedia + Blockly.FieldUntiangle.ARROW_SVG_PATH
  );

  Blockly.DropDownDiv.setColour(this.sourceBlock_.parentBlock_.getColour(),
      this.sourceBlock_.getColourTertiary());
  Blockly.DropDownDiv.setCategory(this.sourceBlock_.parentBlock_.getCategory());
  Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_);

  this.mouseDownWrapper_ =
      Blockly.bindEvent_(this.handle_, 'mousedown', this, this.onMouseDown);

  this.updateGraph_();
};
/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldUntiangle.prototype.onMouseDown = function() {
  this.mouseMoveWrapper_ = Blockly.bindEvent_(document.body, 'mousemove', this, this.onMouseMove);
  this.mouseUpWrapper_ = Blockly.bindEvent_(document.body, 'mouseup', this, this.onMouseUp);
};

/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldUntiangle.prototype.onMouseUp = function() {
  Blockly.unbindEvent_(this.mouseMoveWrapper_);
  Blockly.unbindEvent_(this.mouseUpWrapper_);
};

/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldUntiangle.prototype.onMouseMove = function(e) {
  e.preventDefault();
  var bBox = this.gauge_.ownerSVGElement.getBoundingClientRect();
  var dx = e.clientX - bBox.left - Blockly.FieldUntiangle.HALF;
  var dy = e.clientY - bBox.top - Blockly.FieldUntiangle.HALF;
  var angle = Math.atan(-dy / dx);
  if (isNaN(angle)) {
    // This shouldn't happen, but let's not let this error propagate further.
    return;
  }
  angle = goog.math.toDegrees(angle);
  // 0: East, 90: North, 180: West, 270: South.
  if (dx < 0) {
    angle += 180;
  } else if (dy > 0) {
    angle += 360;
  }
  if (Blockly.FieldUntiangle.CLOCKWISE) {
    angle = Blockly.FieldUntiangle.OFFSET + 360 - angle;
  } else {
    angle -= Blockly.FieldUntiangle.OFFSET;
  }
  if (Blockly.FieldUntiangle.ROUND) {
    angle = Math.round(angle / Blockly.FieldUntiangle.ROUND) *
        Blockly.FieldUntiangle.ROUND;
  }
  angle = this.callValidator(angle);
  Blockly.FieldTextInput.htmlInput_.value = angle;
  this.setValue(angle);
  this.validate_();
  this.resizeEditor_();
};

/**
 * Insert a degree symbol.
 * @param {?string} text New text.
 */
Blockly.FieldUntiangle.prototype.setText = function(text) {
  Blockly.FieldUntiangle.superClass_.setText.call(this, text);
  if (!this.textElement_) {
    // Not rendered yet.
    return;
  }
  this.updateGraph_();
  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;
};

/**
 * Redraw the graph with the current angle.
 * @private
 */
Blockly.FieldUntiangle.prototype.updateGraph_ = function() {
  if (!this.gauge_) {
    return;
  }
  var angleDegrees = Number(this.getText()) % 360 + Blockly.FieldUntiangle.OFFSET;
  var angleRadians = goog.math.toRadians(angleDegrees);
  var path = ['M ', Blockly.FieldUntiangle.HALF, ',', Blockly.FieldUntiangle.HALF];
  var x2 = Blockly.FieldUntiangle.HALF;
  var y2 = Blockly.FieldUntiangle.HALF;
  if (!isNaN(angleRadians)) {
    var angle1 = goog.math.toRadians(Blockly.FieldUntiangle.OFFSET);
    var x1 = Math.cos(angle1) * Blockly.FieldUntiangle.RADIUS;
    var y1 = Math.sin(angle1) * -Blockly.FieldUntiangle.RADIUS;
    if (Blockly.FieldUntiangle.CLOCKWISE) {
      angleRadians = 2 * angle1 - angleRadians;
    }
    x2 += Math.cos(angleRadians) * Blockly.FieldUntiangle.RADIUS;
    y2 -= Math.sin(angleRadians) * Blockly.FieldUntiangle.RADIUS;
    // Use large arc only if input value is greater than wrap
    var largeFlag = Math.abs(angleDegrees - Blockly.FieldUntiangle.OFFSET) > 180 ? 1 : 0;
    var sweepFlag = Number(Blockly.FieldUntiangle.CLOCKWISE);
    if (angleDegrees < Blockly.FieldUntiangle.OFFSET) {
      sweepFlag = 1 - sweepFlag; // Sweep opposite direction if less than the offset
    }
    path.push(' l ', x1, ',', y1,
        ' A ', Blockly.FieldUntiangle.RADIUS, ',', Blockly.FieldUntiangle.RADIUS,
        ' 0 ', largeFlag, ' ', sweepFlag, ' ', x2, ',', y2, ' z');

    // Image rotation needs to be set in degrees
    if (Blockly.FieldUntiangle.CLOCKWISE) {
      var imageRotation = angleDegrees + 2 * Blockly.FieldUntiangle.OFFSET;
    } else {
      var imageRotation = -angleDegrees;
    }
    this.arrowSvg_.setAttribute('transform', 'rotate(' + (imageRotation) + ')');
  }
  this.gauge_.setAttribute('d', path.join(''));
  this.line_.setAttribute('x2', x2);
  this.line_.setAttribute('y2', y2);
  this.handle_.setAttribute('transform', 'translate(' + x2 + ',' + y2 + ')');
};

/**
 * Ensure that only an angle may be entered.
 * @param {string} text The user's text.
 * @return {?string} A string representing a valid angle, or null if invalid.
 */
Blockly.FieldUntiangle.prototype.classValidator = function(text) {
  if (text === null) {
    return null;
  }
  var n = parseFloat(text || 0);
  if (isNaN(n)) {
    return null;
  }
  n = n % 360;
  if (n < 0) {
    n += 360;
  }
  if (n > Blockly.FieldUntiangle.WRAP) {
    n -= 360;
  }
  return String(n);
};

Blockly.Field.register('field_untiangle', Blockly.FieldUntiangle);
