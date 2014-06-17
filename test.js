var tape = require('tape');
var $ = require('jquery');
var RangeBar = require('./lib/rangebar.js');
var Indicator = require('./lib/indicator.js');
var raf = require('./lib/raf.js');

require('./elessar.css');

$.fn.isAfter = function(el) {
	return $(el).nextAll(this).length > 0;
};

$.fn.isBefore = function(el) {
	return $(el).prevAll(this).length > 0;
};

$.fn.contains = function(el) {
	return this.has(el).length > 0;
};

function waitForAnimation(fn) {
	raf(function() {
		process.nextTick(fn);
	});
}

function drag(el, pos) {
	el.mousedown();
	var e = $.Event('mousemove');
	e.clientX = pos.x + el.offset().left + (pos.rightEdge ? el.width() : 0);
	e.clientY = pos.y + el.offset().top + (pos.bottomEdge ? el.height() : 0);
	$(document).trigger(e);
	el.mouseup();
}

tape.test('RangeBar', function(t) {
	var r = new RangeBar();
	t.ok(r.$el, 'has an element');
	t.ok(r.$el.hasClass('elessar-rangebar'), 'has the rangebar class');

	t.test('options', function(t) {
		t.test('sets default options', function(t) {
			var r = new RangeBar();
			t.equal(r.options.min, 0, 'max');
			t.equal(r.options.max, 100, 'min');
			t.equal(r.options.maxRanges, Infinity, 'maxRanges');
			t.equal(r.options.readonly, false, 'readonly');
			t.equal(r.options.bgLabels, 0, 'bgLabels');
			t.equal(r.options.deleteTimeout, 5000, 'deleteTimeout');
			t.equal(r.options.allowDelete, false, 'allowDelete');
			t.end();
		});

		t.test('parses max and min', function(t) {
			var r = new RangeBar({
				min: 'value: 10',
				max: 'value: 20',
				valueFormat: function(v) {
					return 'value: ' + v;
				},
				valueParse: function(v) {
					return +(v.substr(7));
				}
			});

			t.equal(r.options.min, 10);
			t.equal(r.options.max, 20);

			t.end();
		});

		t.test('barClass', function(t) {
			var r = new RangeBar({barClass: 'test-class'});
			t.ok(r.$el.hasClass('test-class'), 'adds options.barClass to the element');
			t.end();
		});

		t.test('values', function(t) {
			var r = new RangeBar({values: [[10, 20], [30, 40]]});
			t.deepEqual(
				r.val(),
				[[10, 20], [30, 40]],
				'sets the initial value'
			);
			t.end();
		});

		t.test('indicator', function(t) {
			var called = false;
			var r = new RangeBar({
				indicator: function(rangeBar, indicator, refresh) {
					t.ok(rangeBar instanceof RangeBar, 'gets passed the rangebar');
					t.ok(indicator instanceof Indicator, 'gets passed the indicator');
					if(called) {
						t.equal(refresh, undefined, 'no function the second time');
						process.nextTick(function() {
							called = true;
							t.equal(
								indicator.val(),
								rangeBar.abnormalise(20),
								'return value updates the value'
							);

							t.end();
						});
					} else {
						t.ok(refresh instanceof Function, 'gets passed a function the first time');
						process.nextTick(function() {
							called = true;
							t.equal(
								indicator.val(),
								rangeBar.abnormalise(10),
								'return value sets the initial value'
							);
							refresh();
						});
					}

					return called ? 20 : 10;
				}
			});

			t.ok(r.indicator instanceof Indicator, 'adds an indicator');
		});

		t.end();
	});

	t.test('normalise and abnormalise', function(t) {
		var r = new RangeBar({
			min: 'value: 10',
			max: 'value: 20',
			valueFormat: function(v) {
				return 'value: ' + v;
			},
			valueParse: function(v) {
				return +(v.substr(7));
			}
		});

		t.equal(
			r.normaliseRaw(0.1),
			11,
			'normaliseRaw maps values [0,1] to [min,max]'
		);

		t.equal(
			r.abnormaliseRaw(11),
			0.1,
			'abnormaliseRaw maps values [min,max] to [0,1]'
		);

		t.equal(
			r.normalise(0.1),
			'value: 11',
			'normalise maps and formats values'
		);

		t.equal(
			r.abnormalise('value: 11'),
			0.1,
			'abnormalise parses and maps values'
		);

		t.end();
	});

	t.test('findGap', function(t) {
		var r = new RangeBar();
		r.ranges = [
			{val: function() { return [0.1, 0.2] }},
			{val: function() { return [0.4, 0.5] }},
			{val: function() { return [0.7, 0.8] }}
		];

		t.equal(r.findGap([0, 0.05]), 0);
		t.equal(r.findGap([0.25, 0.3]), 1);
		t.equal(r.findGap([0.55, 0.6]), 2);
		t.equal(r.findGap([0.9, 1]), 3);
		t.end();
	});

	t.test('insertRangeIndex', function(t) {
		var r = new RangeBar();
		function range() {return {$el: $('<div>')}}

		t.test('inserts ranges', function(t) {
			var r1 = range();
			r.insertRangeIndex(r1, 0);
			t.ok(r.$el.contains(r1.$el), 'at start when empty (dom)');
			t.deepEqual(r.ranges, [r1], 'at start when empty (array)');

			var r2 = range();
			r.insertRangeIndex(r2, 1);
			t.ok(r2.$el.isAfter(r1.$el), 'after existing element if exists (dom)');
			t.deepEqual(r.ranges, [r1, r2], 'after existing element if exists (array)');

			var r3 = range();
			r.insertRangeIndex(r3, 1);
			t.ok(r3.$el.isAfter(r1.$el) && r3.$el.isBefore(r2.$el), 'between existing elements (dom)');
			t.deepEqual(r.ranges, [r1, r3, r2], 'between existing elements (array)');

			var r4 = range();
			r.insertRangeIndex(r4, 0);
			t.ok(r4.$el.isBefore(r1.$el), 'before everything when index 0 (dom)');
			t.deepEqual(r.ranges, [r4, r1, r3, r2], 'before everything when index 0 (array)');

			// clean up
			r.ranges = [];
			r.$el.empty();
			t.end();
		});

		var r1 = range();
		r.insertRangeIndex(r1, 0, true);
		t.ok(r.$el.contains(r1.$el), 'inserts to dom when avoidList is true');
		t.equal(r.ranges.length, 0, 'but not to array');

		t.end();
	});

	t.test('dragging', function(t) {
		var r = new RangeBar({values: [[0, 10]]});
		r.$el.css({width: '100px'}).appendTo('body');
		waitForAnimation(function() {
			drag(r.ranges[0].$el, {x: 10, y: 0});
			waitForAnimation(function() {
				t.deepEqual(r.val(), [[10, 20]], 'dragging updates the value');
				t.end();
			});
		});
	});

	t.test('right resizing', function(t) {
		t.test('to the right', function(t) {
			var r = new RangeBar({values: [[0, 10]]});
			r.$el.css({width: '100px'}).appendTo('body');
			waitForAnimation(function() {
				drag(r.ranges[0].$el.find('.elessar-handle:last-child'), {x: 10, y: 0, rightEdge: true});
				waitForAnimation(function() {
					t.deepEqual(r.val(), [[0, 20]], 'dragging right handle updates the value');
					t.end();
				});
			});
		});
		
		t.test('to the left', function(t) {
			var r = new RangeBar({values: [[0, 20]]});
			r.$el.css({width: '100px'}).appendTo('body');
			waitForAnimation(function() {
				drag(r.ranges[0].$el.find('.elessar-handle:last-child'), {x: -10, y: 0, rightEdge: true});
				waitForAnimation(function() {
					t.deepEqual(r.val(), [[0, 10]], 'dragging right handle updates the value');
					t.end();
				});
			});
		});

		t.test('beyond the end', function(t) {
			var r = new RangeBar({values: [[85, 95]]});
			r.$el.css({width: '100px'}).appendTo('body');
			waitForAnimation(function() {
				drag(r.ranges[0].$el.find('.elessar-handle:last-child'), {x: 10, y: 0, rightEdge: true});
				waitForAnimation(function() {
					t.deepEqual(r.val(), [[85, 100]], 'dragging right handle updates the value');
					t.end();
				});
			});
		});

		t.test('to overlap another range', function(t) {
			var r = new RangeBar({values: [[0, 10], [15, 25]]});
			r.$el.css({width: '100px'}).appendTo('body');
			waitForAnimation(function() {
				drag(r.ranges[0].$el.find('.elessar-handle:last-child'), {x: 10, y: 0, rightEdge: true});
				waitForAnimation(function() {
					t.deepEqual(r.val(), [[0, 15], [15, 25]], 'dragging right handle updates the value');
					t.end();
				});
			});
		});

		t.test('beyond the start of the range resizes left', function(t) {
			var r = new RangeBar({values: [[20, 30]]});
			r.$el.css({width: '100px'}).appendTo('body');
			waitForAnimation(function() {
				drag(r.ranges[0].$el.find('.elessar-handle:last-child'), {x: -20, y: 0, rightEdge: true});
				waitForAnimation(function() {
					t.deepEqual(r.val(), [[10, 20]], 'dragging right handle updates the value');
					t.end();
				});
			});
		});

		t.end();
	});

	t.test('left resizing', function(t) {
		var r = new RangeBar({values: [[10, 20]]});
		r.$el.css({width: '100px'}).appendTo('body');
		waitForAnimation(function() {
			drag(r.ranges[0].$el.find('.elessar-handle:first-child'), {x: -10, y: 0});
			waitForAnimation(function() {
				t.deepEqual(r.val(), [[0, 20]], 'dragging left handle updates the value');
				t.end();
			});
		});
	});


	t.end();
});
