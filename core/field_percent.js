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
 * @fileoverview Angle input field.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.FieldPercent');

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
Blockly.FieldPercent = function (opt_value, opt_validator) {
  // Add degree symbol: '360°' (LTR) or '°360' (RTL)
  this.symbol_ = Blockly.utils.createSvgElement('tspan', {}, null);
  this.symbol_.appendChild(document.createTextNode('\u00B0'));
  
  var numRestrictor = new RegExp("[\\d]|[\\.]|[-]|[eE]");

  opt_value = (opt_value && !isNaN(opt_value)) ? String(opt_value) : '0';
  Blockly.FieldPercent.superClass_.constructor.call(
      this, opt_value, opt_validator, numRestrictor);
  this.addArgType('percent');
};
goog.inherits(Blockly.FieldPercent, Blockly.FieldTextInput);

/**
 * Construct a FieldPercent from a JSON arg object.
 * @param {!Object} options A JSON object with options (angle).
 * @returns {!Blockly.FieldPercent} The new field instance.
 * @package
 * @nocollapse
 */
Blockly.FieldPercent.fromJson = function (options) {
  return new Blockly.FieldPercent(options['percent']);
};

/**
 * Round angles to the nearest 15 degrees when using mouse.
 * Set to 0 to disable rounding.
 */
Blockly.FieldPercent.ROUND = 3.565;

/**
 * Half the width of protractor image.
 */
Blockly.FieldPercent.HALF = 120 / 2;

/* The following two settings work together to set the behaviour of the angle
 * picker.  While many combinations are possible, two modes are typical:
 * Math mode.
 *   0 deg is right, 90 is up.  This is the style used by protractors.
 *   Blockly.FieldPercent.CLOCKWISE = false;
 *   Blockly.FieldPercent.OFFSET = 0;
 * Compass mode.
 *   0 deg is up, 90 is right.  This is the style used by maps.
 *   Blockly.FieldPercent.CLOCKWISE = true;
 *   Blockly.FieldPercent.OFFSET = 90;
 */

/**
 * Angle increases clockwise (true) or counterclockwise (false).
 */
Blockly.FieldPercent.CLOCKWISE = true;

/**
 * Offset the location of 0 degrees (and all angles) by a constant.
 * Usually either 0 (0 = right) or 90 (0 = up).
 */
Blockly.FieldPercent.OFFSET = 90;

/**
 * Maximum allowed angle before wrapping.
 * Usually either 360 (for 0 to 359.9) or 180 (for -179.9 to 180).
 */
Blockly.FieldPercent.WRAP = 360;

/**
 * Radius of drag handle
 */
Blockly.FieldPercent.HANDLE_RADIUS = 10;

/**
 * Width of drag handle arrow
 */
Blockly.FieldPercent.ARROW_WIDTH = Blockly.FieldPercent.HANDLE_RADIUS;

/**
 * Half the stroke-width used for the "glow" around the drag handle, rounded up to nearest whole pixel
 */

Blockly.FieldPercent.HANDLE_GLOW_WIDTH = 3;

/**
 * Radius of protractor circle.  Slightly smaller than protractor size since
 * otherwise SVG crops off half the border at the edges.
 */
Blockly.FieldPercent.RADIUS = Blockly.FieldPercent.HALF
    - Blockly.FieldPercent.HANDLE_RADIUS - Blockly.FieldPercent.HANDLE_GLOW_WIDTH;

/**
 * Radius of central dot circle.
 */
Blockly.FieldPercent.CENTER_RADIUS = 2;

/**
 * Path to the arrow svg icon.
 */
Blockly.FieldPercent.ARROW_SVG_PATH = 'icons/arrow.svg';

/**
 * Clean up this FieldPercent, as well as the inherited FieldTextInput.
 * @return {!Function} Closure to call on destruction of the WidgetDiv.
 * @private
 */
Blockly.FieldPercent.prototype.dispose_ = function () {
  var thisField = this;
  return function() {
    Blockly.FieldPercent.superClass_.dispose_.call(thisField)();
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
Blockly.FieldPercent.prototype.showEditor_ = function () {
  var noFocus =
      goog.userAgent.MOBILE || goog.userAgent.ANDROID || goog.userAgent.IPAD;
  // Mobile browsers have issues with in-line textareas (focus & keyboards).
  Blockly.FieldPercent.superClass_.showEditor_.call(this, noFocus);
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
    'height': (Blockly.FieldPercent.HALF * 2) + 'px',
    'width': (Blockly.FieldPercent.HALF * 2) + 'px'
  }, div);
  Blockly.utils.createSvgElement('circle', {
    'cx': Blockly.FieldPercent.HALF, 'cy': Blockly.FieldPercent.HALF,
    'r': Blockly.FieldPercent.RADIUS,
    'class': 'blocklyPercentCircle'
  }, svg);
  this.gauge_ = Blockly.utils.createSvgElement('path',
      {'class': 'blocklyPercentGauge'}, svg);
  // The moving line, x2 and y2 are set in updateGraph_
  this.line_ = Blockly.utils.createSvgElement('line',{
    'x1': Blockly.FieldPercent.HALF,
    'y1': Blockly.FieldPercent.HALF,
    'class': 'blocklyPercentLine'
  }, svg);
  // The fixed vertical line at the offset
  var offsetRadians = Math.PI * Blockly.FieldPercent.OFFSET / 180;
  Blockly.utils.createSvgElement('line', {
    'x1': Blockly.FieldPercent.HALF,
    'y1': Blockly.FieldPercent.HALF,
    'x2': Blockly.FieldPercent.HALF + Blockly.FieldPercent.RADIUS * Math.cos(offsetRadians),
    'y2': Blockly.FieldPercent.HALF - Blockly.FieldPercent.RADIUS * Math.sin(offsetRadians),
    'class': 'blocklyPercentLine'
  }, svg);
  // Draw markers around the edge.
  for (var percent = 0; percent < 360; percent += 36) {
    Blockly.utils.createSvgElement('line', {
      'x1': Blockly.FieldPercent.HALF + Blockly.FieldPercent.RADIUS - 13,
      'y1': Blockly.FieldPercent.HALF,
      'x2': Blockly.FieldPercent.HALF + Blockly.FieldPercent.RADIUS - 7,
      'y2': Blockly.FieldPercent.HALF,
      'class': 'blocklyPercentMarks',
      'transform': 'rotate(' + percent + ',' +
          Blockly.FieldPercent.HALF + ',' + Blockly.FieldPercent.HALF + ')'
    }, svg);
  }
  // Center point
  Blockly.utils.createSvgElement('circle', {
    'cx': Blockly.FieldPercent.HALF, 'cy': Blockly.FieldPercent.HALF,
    'r': Blockly.FieldPercent.CENTER_RADIUS,
    'class': 'blocklyPercentCenterPoint'
  }, svg);
  // Handle group: a circle and the arrow image
  this.handle_ = Blockly.utils.createSvgElement('g', {}, svg);
  Blockly.utils.createSvgElement('circle', {
    'cx': 0,
    'cy': 0,
    'r': Blockly.FieldPercent.HANDLE_RADIUS,
    'class': 'blocklyPercentDragHandle'
  }, this.handle_);
  this.arrowSvg_ = Blockly.utils.createSvgElement('image',
      {
        'width': Blockly.FieldPercent.ARROW_WIDTH,
        'height': Blockly.FieldPercent.ARROW_WIDTH,
        'x': -Blockly.FieldPercent.ARROW_WIDTH / 2,
        'y': -Blockly.FieldPercent.ARROW_WIDTH / 2,
        'class': 'blocklyPercentDragArrow'
      },
      this.handle_);
  this.arrowSvg_.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      Blockly.mainWorkspace.options.pathToMedia + Blockly.FieldPercent.ARROW_SVG_PATH
  );

  Blockly.DropDownDiv.setColour(this.sourceBlock_.parentBlock_.getColour(),
      this.sourceBlock_.getColourTertiary());
  Blockly.DropDownDiv.setCategory(this.sourceBlock_.parentBlock_.getCategory());
  Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_);

  this.mouseDownWrapper_ =
      Blockly.bindEvent_(this.handle_, 'mousedown', this, this.onMouseDown);
	var reset_percent = Number(this.getText()) * Blockly.FieldPercent.ROUND;
	this.callValidator(reset_percent);
	this.setValue(reset_percent);
  this.updateGraph_();
};
/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldPercent.prototype.onMouseDown = function () {
  this.mouseMoveWrapper_ = Blockly.bindEvent_(document.body, 'mousemove', this, this.onMouseMove);
  this.mouseUpWrapper_ = Blockly.bindEvent_(document.body, 'mouseup', this, this.onMouseUp);
};

/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldPercent.prototype.onMouseUp = function () {
  Blockly.unbindEvent_(this.mouseMoveWrapper_);
  Blockly.unbindEvent_(this.mouseUpWrapper_);
};

/**
 * Set the angle to match the mouse's position.
 * @param {!Event} e Mouse move event.
 */
Blockly.FieldPercent.prototype.onMouseMove = function (e) {
	e.preventDefault();
  var bBox = this.gauge_.ownerSVGElement.getBoundingClientRect();
  var dx = e.clientX - bBox.left - Blockly.FieldPercent.HALF;
  var dy = e.clientY - bBox.top - Blockly.FieldPercent.HALF;
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
  if (Blockly.FieldPercent.CLOCKWISE) {
    angle = Blockly.FieldPercent.OFFSET + 360 - angle;
  } else {
    angle -= Blockly.FieldPercent.OFFSET;
  }
  if (Blockly.FieldPercent.ROUND) {
    angle = Math.round(angle / Blockly.FieldPercent.ROUND) *
        Blockly.FieldPercent.ROUND;
	}
	var tmp = angle % 360;
	Blockly.FieldTextInput.htmlInput_.value = Math.floor(tmp / Blockly.FieldPercent.ROUND); // 正解
  this.setValue(angle); // getText()
  this.validate_();
  this.resizeEditor_();
};

/**
 * Insert a degree symbol.
 * @param {?string} text New text.
 */
Blockly.FieldPercent.prototype.setText = function (text) {
  Blockly.FieldPercent.superClass_.setText.call(this, text);
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
Blockly.FieldPercent.prototype.updateGraph_ = function () {
  if (!this.gauge_) {
    return;
  }
	var angleDegrees = (Number(this.getText())) % 360 + Blockly.FieldPercent.OFFSET;
  var angleRadians = goog.math.toRadians(angleDegrees);
  var path = ['M ', Blockly.FieldPercent.HALF, ',', Blockly.FieldPercent.HALF];
  var x2 = Blockly.FieldPercent.HALF;
  var y2 = Blockly.FieldPercent.HALF;
  if (!isNaN(angleRadians)) {
    var angle1 = goog.math.toRadians(Blockly.FieldPercent.OFFSET);
    var x1 = Math.cos(angle1) * Blockly.FieldPercent.RADIUS;
    var y1 = Math.sin(angle1) * -Blockly.FieldPercent.RADIUS;
    if (Blockly.FieldPercent.CLOCKWISE) {
      angleRadians = 2 * angle1 - angleRadians;
    }
    x2 += Math.cos(angleRadians) * Blockly.FieldPercent.RADIUS;
    y2 -= Math.sin(angleRadians) * Blockly.FieldPercent.RADIUS;
    // Use large arc only if input value is greater than wrap
    var largeFlag = Math.abs(angleDegrees - Blockly.FieldPercent.OFFSET) > 180 ? 1 : 0;
    var sweepFlag = Number(Blockly.FieldPercent.CLOCKWISE);
    if (angleDegrees < Blockly.FieldPercent.OFFSET) {
      sweepFlag = 1 - sweepFlag; // Sweep opposite direction if less than the offset
    }
    path.push(' l ', x1, ',', y1,
        ' A ', Blockly.FieldPercent.RADIUS, ',', Blockly.FieldPercent.RADIUS,
        ' 0 ', largeFlag, ' ', sweepFlag, ' ', x2, ',', y2, ' z');

    // Image rotation needs to be set in degrees
    if (Blockly.FieldPercent.CLOCKWISE) {
      var imageRotation = angleDegrees + 2 * Blockly.FieldPercent.OFFSET;
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
Blockly.FieldPercent.prototype.classValidator = function(text) {
  if (text === null) {
    return null;
  }
  var n = parseFloat(text || 0);
  if (isNaN(n)) {
    return null;
  }
  return String(n);
};

Blockly.Field.register('field_percent', Blockly.FieldPercent);
